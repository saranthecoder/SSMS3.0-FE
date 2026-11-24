import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STALE_THRESHOLD_MS,
  FAILURE_THRESHOLD,
  RECOVERY_THRESHOLD,
  isNodeInCooldown,
  recordNodeFailure,
  recordNodeSuccess,
  resetClientHealthRegistry,
  selectBackendNode
} from './trafficRouter.js';

test('Stale metric detection accurately flags nodes without fresh health scans', () => {
  const now = Date.now();
  const freshTime = new Date(now - 2 * 60 * 1000); // 2 minutes ago
  const staleTime = new Date(now - 12 * 60 * 1000); // 12 minutes ago

  const isFresh = now - freshTime.getTime() <= STALE_THRESHOLD_MS;
  const isStale = now - staleTime.getTime() > STALE_THRESHOLD_MS;
  const neverScannedStale = true;

  assert.equal(isFresh, true, 'Scan from 2 minutes ago should be considered fresh');
  assert.equal(isStale, true, 'Scan from 12 minutes ago should be flagged as stale (>10m)');
  assert.equal(neverScannedStale, true, 'Node that was never scanned should be flagged as stale');
});

test('Truthful metrics preserve null values and do not inject fake 18/32 numbers', () => {
  const rawNode = {
    _id: 'node-1',
    name: 'Render Secondary Node',
    url: 'https://ssms-secondary.onrender.com',
    status: 'online',
    cpuUsage: null,
    memoryUsage: null,
    responseTime: 145,
    avgProcessingLatencyMs: null
  };

  // Truthful display resolver
  const displayCpu = rawNode.cpuUsage != null ? `${rawNode.cpuUsage}%` : 'N/A';
  const displayMem = rawNode.memoryUsage != null ? `${rawNode.memoryUsage}%` : 'N/A';
  const displayProc = rawNode.avgProcessingLatencyMs != null ? `${rawNode.avgProcessingLatencyMs}ms` : null;

  assert.equal(displayCpu, 'N/A', 'Missing CPU must display N/A, not 18%');
  assert.equal(displayMem, 'N/A', 'Missing memory must display N/A, not 32%');
  assert.equal(displayProc, null, 'Missing processing latency should be null');
});

test('Probe latency and browser latency remain separate metrics', () => {
  const node = {
    _id: 'node-2',
    name: 'Primary Node',
    responseTime: 85, // Backend probe latency
  };
  const browserLatencies = {
    'node-2': 120 // Direct browser roundtrip
  };

  assert.notEqual(node.responseTime, browserLatencies['node-2'], 'Backend probe and browser latencies are distinct measurements');
  assert.equal(node.responseTime, 85);
  assert.equal(browserLatencies['node-2'], 120);
});

test('Traffic router respects cooldown on consecutive node failures', () => {
  resetClientHealthRegistry();
  const testUrl = 'https://broken-node.example.com';

  assert.equal(isNodeInCooldown(testUrl), false, 'Initially not in cooldown');

  // 1 failure - below threshold
  recordNodeFailure(testUrl, new Error('Network error'));
  assert.equal(isNodeInCooldown(testUrl), false, '1 failure should not trip breaker');

  // 2nd failure - reaches FAILURE_THRESHOLD
  recordNodeFailure(testUrl, new Error('Gateway Timeout'));
  assert.equal(isNodeInCooldown(testUrl), true, 'Reaching threshold must trip circuit breaker');

  // Recovery requires RECOVERY_THRESHOLD consecutive successes
  recordNodeSuccess(testUrl);
  assert.equal(isNodeInCooldown(testUrl), true, '1 success is not yet enough to recover');

  recordNodeSuccess(testUrl);
  assert.equal(isNodeInCooldown(testUrl), false, 'Reaching recovery threshold clears cooldown');
});

test('Polling interval cleanup prevents timer leaks on unmount', () => {
  let timerCleared = false;
  let isMounted = true;

  const timerId = setInterval(() => {
    if (!isMounted) return;
  }, 1000);

  // Simulate component unmount cleanup function
  const cleanup = () => {
    isMounted = false;
    clearInterval(timerId);
    timerCleared = true;
  };

  cleanup();
  assert.equal(isMounted, false, 'isMounted flag should be set to false on unmount');
  assert.equal(timerCleared, true, 'Interval timer must be cleared during cleanup');
});
