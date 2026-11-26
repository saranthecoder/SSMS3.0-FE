import test, { beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  normalizeUrl,
  getPrimaryEnvServer,
  isNodeEligible,
  selectBackendNode,
  isIdempotentRequest,
  shouldRetryRequest,
  getFallbackServer,
  recordNodeFailure,
  recordNodeSuccess,
  isNodeInCooldown,
  resetClientHealthRegistry,
  FAILURE_THRESHOLD,
  RECOVERY_THRESHOLD,
  COOLDOWN_MS,
  STALE_THRESHOLD_MS
} from './trafficRouter.js';

beforeEach(() => {
  resetClientHealthRegistry();
});

test('normalizeUrl trims whitespace and removes trailing slashes', () => {
  assert.strictEqual(normalizeUrl('  https://api.example.com/  '), 'https://api.example.com');
  assert.strictEqual(normalizeUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(normalizeUrl(''), '');
  assert.strictEqual(normalizeUrl(null), '');
});

test('getPrimaryEnvServer resolves without hardcoding secrets or production domains', () => {
  const custom = getPrimaryEnvServer('https://custom-gateway.io');
  assert.strictEqual(custom.url, 'https://custom-gateway.io');
  assert.strictEqual(custom.isPrimary, true);
  assert.strictEqual(custom.status, 'online');
});

test('isNodeEligible excludes unhealthy, disabled, and unknown nodes', () => {
  const now = Date.now();
  // Valid online node
  assert.strictEqual(isNodeEligible({ url: 'https://node1.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) }), true);

  // Offline status excluded
  assert.strictEqual(isNodeEligible({ url: 'https://node1.io', status: 'offline', isActive: true }), false);

  // Unknown status excluded
  assert.strictEqual(isNodeEligible({ url: 'https://node1.io', status: 'unknown', isActive: true }), false);

  // Deactivated node excluded
  assert.strictEqual(isNodeEligible({ url: 'https://node1.io', status: 'online', isActive: false }), false);

  // Explicitly stale node excluded
  assert.strictEqual(isNodeEligible({ url: 'https://node1.io', status: 'online', isActive: true, isStale: true }), false);

  // Stale health check timestamp (> 10m) excluded
  const elevenMinutesAgo = new Date(now - 11 * 60 * 1000);
  assert.strictEqual(isNodeEligible({ url: 'https://node1.io', status: 'online', isActive: true, lastHealthCheck: elevenMinutesAgo }, { now }), false);

  // Localhost excluded when running on live web domain
  assert.strictEqual(isNodeEligible({ url: 'http://localhost:3000', status: 'online', isActive: true }, { isOnWebDomain: true }), false);
  assert.strictEqual(isNodeEligible({ url: 'http://localhost:3000', status: 'online', isActive: true }, { isOnWebDomain: false }), true);
});

test('isNodeEligible excludes nodes currently in circuit-breaker cooldown', () => {
  const now = 1000000;
  const nodeUrl = 'https://tripped-node.io';

  // 1 failure does not trip
  recordNodeFailure(nodeUrl, new Error('timeout'), now);
  assert.strictEqual(isNodeInCooldown(nodeUrl, now), false);
  assert.strictEqual(isNodeEligible({ url: nodeUrl, status: 'online', isActive: true }, { now }), true);

  // 2nd failure trips circuit breaker
  recordNodeFailure(nodeUrl, new Error('503 Service Unavailable'), now);
  assert.strictEqual(isNodeInCooldown(nodeUrl, now), true);
  assert.strictEqual(isNodeEligible({ url: nodeUrl, status: 'online', isActive: true }, { now }), false);

  // After cooldown window expires, node is eligible again
  const afterCooldown = now + COOLDOWN_MS + 1000;
  assert.strictEqual(isNodeInCooldown(nodeUrl, afterCooldown), false);
  assert.strictEqual(isNodeEligible({ url: nodeUrl, status: 'online', isActive: true }, { now: afterCooldown }), true);
});

test('Circuit breaker recovery requires RECOVERY_THRESHOLD consecutive successes', () => {
  const now = 1000000;
  const nodeUrl = 'https://recovering-node.io';

  // Trip circuit breaker
  recordNodeFailure(nodeUrl, new Error('network error'), now);
  recordNodeFailure(nodeUrl, new Error('network error'), now);
  assert.strictEqual(isNodeInCooldown(nodeUrl, now), true);

  // 1 success is not enough to reset failures
  recordNodeSuccess(nodeUrl);
  // Still in cooldown if time has not passed
  assert.strictEqual(isNodeInCooldown(nodeUrl, now), true);

  // 2nd consecutive success clears cooldown and resets failures
  recordNodeSuccess(nodeUrl);
  assert.strictEqual(isNodeInCooldown(nodeUrl, now), false);
});

test('Active-Backup Failover selects primary when healthy, and backup when primary is unavailable', () => {
  const primaryUrl = 'https://primary.io';
  const backupUrl = 'https://backup.io';
  const now = Date.now();

  const servers = [
    { id: '1', url: primaryUrl, status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { id: '2', url: backupUrl, status: 'online', isActive: true, lastHealthCheck: new Date(now) }
  ];

  // Primary healthy: routes to primary
  const healthyResult = selectBackendNode({ policy: 'failover', servers, primaryUrl, now });
  assert.strictEqual(healthyResult.selectedUrl, primaryUrl);
  assert.strictEqual(healthyResult.allNodesUnavailable, false);

  // Primary goes offline: selects healthy backup
  servers[0].status = 'offline';
  const failoverResult = selectBackendNode({ policy: 'failover', servers, primaryUrl, now });
  assert.strictEqual(failoverResult.selectedUrl, backupUrl);
  assert.strictEqual(failoverResult.selectedServer.id, '2');
  assert.strictEqual(failoverResult.isBackupActive, true);

  // Primary trips circuit breaker: selects healthy backup
  servers[0].status = 'online';
  recordNodeFailure(primaryUrl, new Error('502 Bad Gateway'), now);
  recordNodeFailure(primaryUrl, new Error('502 Bad Gateway'), now);

  const circuitBreakerResult = selectBackendNode({ policy: 'failover', servers, primaryUrl, now });
  assert.strictEqual(circuitBreakerResult.selectedUrl, backupUrl);
  assert.strictEqual(circuitBreakerResult.isBackupActive, true);
});

test('Round-Robin distributes requests strictly across eligible nodes', () => {
  const now = Date.now();
  const servers = [
    { id: '1', url: 'https://node1.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { id: '2', url: 'https://node2.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { id: '3', url: 'https://node3.io', status: 'offline', isActive: true }, // Excluded
    { id: '4', url: 'https://node4.io', status: 'online', isActive: false }  // Excluded
  ];

  const first = selectBackendNode({ policy: 'round-robin', servers, rrIndex: 0, now });
  assert.strictEqual(first.selectedUrl, 'https://node1.io');
  assert.strictEqual(first.nextRrIndex, 1);

  const second = selectBackendNode({ policy: 'round-robin', servers, rrIndex: first.nextRrIndex, now });
  assert.strictEqual(second.selectedUrl, 'https://node2.io');
  assert.strictEqual(second.nextRrIndex, 0);

  // Continues rotation only among eligible nodes
  const third = selectBackendNode({ policy: 'round-robin', servers, rrIndex: second.nextRrIndex, now });
  assert.strictEqual(third.selectedUrl, 'https://node1.io');
});

test('Latency-Optimized routing selects lowest fresh response time and penalizes stale/unmeasured nodes', () => {
  const now = Date.now();
  const servers = [
    { id: '1', url: 'https://slow.io', status: 'online', isActive: true, responseTime: 650, lastHealthCheck: new Date(now) },
    { id: '2', url: 'https://fast.io', status: 'online', isActive: true, responseTime: 85, lastHealthCheck: new Date(now) },
    { id: '3', url: 'https://unmeasured.io', status: 'online', isActive: true, responseTime: 0, lastHealthCheck: new Date(now) }
  ];

  const result = selectBackendNode({ policy: 'latency', servers, now });
  assert.strictEqual(result.selectedUrl, 'https://fast.io');
  assert.strictEqual(result.selectedServer.id, '2');
});

test('CPU-Adaptive routing prioritizes lowest CPU under threshold', () => {
  const now = Date.now();
  const servers = [
    { id: '1', url: 'https://high-cpu.io', status: 'online', isActive: true, cpuUsage: 90, lastHealthCheck: new Date(now) },
    { id: '2', url: 'https://mid-cpu.io', status: 'online', isActive: true, cpuUsage: 40, lastHealthCheck: new Date(now) },
    { id: '3', url: 'https://low-cpu.io', status: 'online', isActive: true, cpuUsage: 15, lastHealthCheck: new Date(now) }
  ];

  const result = selectBackendNode({ policy: 'cpu-adaptive', servers, cpuThreshold: 80, now });
  assert.strictEqual(result.selectedUrl, 'https://low-cpu.io');
  assert.strictEqual(result.selectedServer.id, '3');
});

test('Handles situation where EVERY node is unavailable gracefully', () => {
  const primaryUrl = 'https://primary.io';
  const now = Date.now();

  const servers = [
    { id: '1', url: primaryUrl, status: 'offline', isActive: true },
    { id: '2', url: 'https://backup1.io', status: 'offline', isActive: true },
    { id: '3', url: 'https://backup2.io', status: 'unknown', isActive: true }
  ];

  // Must not throw an unhandled exception or crash
  const result = selectBackendNode({ policy: 'failover', servers, primaryUrl, now });
  assert.strictEqual(result.allNodesUnavailable, true);
  assert.strictEqual(result.selectedServer, null);
  assert.strictEqual(result.selectedUrl, primaryUrl); // Safe fallback
});

test('isIdempotentRequest correctly identifies safe HTTP methods for retry', () => {
  assert.strictEqual(isIdempotentRequest({ method: 'GET' }), true);
  assert.strictEqual(isIdempotentRequest({ method: 'get' }), true);
  assert.strictEqual(isIdempotentRequest({ method: 'HEAD' }), true);
  assert.strictEqual(isIdempotentRequest({ method: 'OPTIONS' }), true);

  assert.strictEqual(isIdempotentRequest({ method: 'POST' }), false);
  assert.strictEqual(isIdempotentRequest({ method: 'PUT' }), false);
  assert.strictEqual(isIdempotentRequest({ method: 'DELETE' }), false);
  assert.strictEqual(isIdempotentRequest({ method: 'PATCH' }), false);
});

test('shouldRetryRequest permits retry only for idempotent requests on 502-504 or network errors', () => {
  const getReq = { method: 'GET' };
  const postReq = { method: 'POST' };

  // 503 on GET -> retry
  assert.strictEqual(shouldRetryRequest({ response: { status: 503 } }, getReq), true);

  // Network timeout on GET -> retry
  assert.strictEqual(shouldRetryRequest({ response: null }, getReq), true);

  // 503 on POST -> MUST NOT retry (prevents duplicate mutations)
  assert.strictEqual(shouldRetryRequest({ response: { status: 503 } }, postReq), false);

  // 400 Bad Request on GET -> MUST NOT retry
  assert.strictEqual(shouldRetryRequest({ response: { status: 400 } }, getReq), false);

  // Already retried request -> MUST NOT retry again with default maxRetries=1
  assert.strictEqual(shouldRetryRequest({ response: { status: 503 } }, { method: 'GET', _retryCount: 1 }), false);

  // Multi-hop failover permits additional retries up to maxRetries
  assert.strictEqual(shouldRetryRequest({ response: { status: 503 } }, { method: 'GET', _retryCount: 1 }, { maxRetries: 3 }), true);
  assert.strictEqual(shouldRetryRequest({ response: { status: 503 } }, { method: 'GET', _retryCount: 3 }, { maxRetries: 3 }), false);
});

test('getFallbackServer excludes all previously tried URLs during multi-hop failover', () => {
  const now = Date.now();
  const servers = [
    { url: 'https://n1.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { url: 'https://n2.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { url: 'https://n3.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) }
  ];

  const fallback = getFallbackServer(servers, 'https://n2.io/api', {
    now,
    excludeUrls: ['https://n1.io/api', 'https://n2.io/api']
  });
  assert.strictEqual(fallback.url, 'https://n3.io');
});

test('getFallbackServer finds a healthy alternate node', () => {
  const now = Date.now();
  const servers = [
    { url: 'https://failing.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { url: 'https://healthy.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) }
  ];

  const fallback = getFallbackServer(servers, 'https://failing.io/api', { now });
  assert.strictEqual(fallback.url, 'https://healthy.io');
});

test('Equal Round-Robin and crash redirection distribute traffic evenly across 4 surviving servers', () => {
  const now = Date.now();
  const servers = [
    { id: '1', url: 'https://s1.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { id: '2', url: 'https://s2.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { id: '3', url: 'https://s3.io', status: 'offline', isActive: true, lastHealthCheck: new Date(now) }, // Crashed
    { id: '4', url: 'https://s4.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) },
    { id: '5', url: 'https://s5.io', status: 'online', isActive: true, lastHealthCheck: new Date(now) }
  ];

  // Equal rotation across remaining 4 nodes
  let idx = 0;
  const picked = [];
  for (let i = 0; i < 4; i++) {
    const res = selectBackendNode({ policy: 'round-robin', servers, rrIndex: idx, now });
    picked.push(res.selectedUrl);
    idx = res.nextRrIndex;
  }
  assert.deepStrictEqual(picked, ['https://s1.io', 'https://s2.io', 'https://s4.io', 'https://s5.io']);

  // Fallback rotation spreads crashed requests across all healthy survivors instead of hitting only s1
  const fb0 = getFallbackServer(servers, 'https://s3.io/api', { now, rrIndex: 0 });
  const fb1 = getFallbackServer(servers, 'https://s3.io/api', { now, rrIndex: 1 });
  const fb2 = getFallbackServer(servers, 'https://s3.io/api', { now, rrIndex: 2 });
  const fb3 = getFallbackServer(servers, 'https://s3.io/api', { now, rrIndex: 3 });
  assert.deepStrictEqual([fb0.url, fb1.url, fb2.url, fb3.url], ['https://s1.io', 'https://s2.io', 'https://s4.io', 'https://s5.io']);
});
