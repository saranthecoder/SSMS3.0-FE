/**
 * SSMS Traffic Router & Client-Side Node Selector
 *
 * NOTE ON ARCHITECTURE:
 * This client-side dynamic URL selection mechanism operates within the browser's Axios interceptors.
 * It is an application-level request distributor, NOT an infrastructure gateway or reverse proxy.
 * True multi-instance high availability and load balancing in production requires an infrastructure-level
 * reverse proxy (such as Cloudflare Load Balancing, Nginx, or an AWS Application Load Balancer) to ensure
 * unified TLS termination, shared cookie sessions across origins, and centralized WebSocket pub/sub (e.g., via Redis).
 */

export const FAILURE_THRESHOLD = 2;
export const RECOVERY_THRESHOLD = 2;
export const COOLDOWN_MS = 30000; // 30 seconds cooldown when circuit breaker trips
export const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// In-memory client-side health registry to track real-time failure state and prevent rapid switching
const clientNodeRegistry = new Map();

/**
 * Resets the in-memory health registry (useful for testing or initial bootstrap)
 */
export const resetClientHealthRegistry = () => {
  clientNodeRegistry.clear();
};

/**
 * Gets the current snapshot of client-side node health tracking
 */
export const getClientHealthRegistry = () => {
  return new Map(clientNodeRegistry);
};

/**
 * Normalizes a URL by trimming whitespace and removing trailing slashes.
 */
export const normalizeUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  while (trimmed.endsWith('/')) {
    trimmed = trimmed.slice(0, -1);
  }
  if (trimmed.endsWith('/api')) {
    trimmed = trimmed.slice(0, -4);
  }
  return trimmed;
};

/**
 * Records a client-side request failure for a node URL.
 * When failures reach FAILURE_THRESHOLD, trips the circuit breaker into a cooldown window.
 */
export const recordNodeFailure = (url, error, now = Date.now()) => {
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return;

  const current = clientNodeRegistry.get(cleanUrl) || {
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    cooldownUntil: 0
  };

  current.failures += 1;
  current.successes = 0;
  current.lastFailureTime = now;

  if (current.failures >= FAILURE_THRESHOLD) {
    current.cooldownUntil = now + COOLDOWN_MS;
    console.warn(`[TrafficRouter] Node ${cleanUrl} tripped circuit breaker (${current.failures} consecutive failures). In cooldown for ${COOLDOWN_MS / 1000}s.`);
  }

  clientNodeRegistry.set(cleanUrl, current);
};

/**
 * Records a client-side request success for a node URL.
 * When successes reach RECOVERY_THRESHOLD, clears any prior cooldown.
 */
export const recordNodeSuccess = (url) => {
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return;

  const current = clientNodeRegistry.get(cleanUrl) || {
    failures: 0,
    successes: 0,
    lastFailureTime: 0,
    cooldownUntil: 0
  };

  current.successes += 1;

  if (current.successes >= RECOVERY_THRESHOLD) {
    current.failures = 0;
    current.cooldownUntil = 0;
  }

  clientNodeRegistry.set(cleanUrl, current);
};

/**
 * Checks whether a node is currently in client-side circuit-breaker cooldown.
 */
export const isNodeInCooldown = (url, now = Date.now()) => {
  const cleanUrl = normalizeUrl(url);
  const entry = clientNodeRegistry.get(cleanUrl);
  if (!entry) return false;
  return entry.cooldownUntil > now;
};

/**
 * Resolves the primary environment server without hardcoding production domains.
 */
export const getPrimaryEnvServer = (envApiUrl) => {
  const rawUrl = envApiUrl !== undefined
    ? envApiUrl
    : (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL ? import.meta.env.VITE_API_URL : '');

  const cleanUrl = normalizeUrl(rawUrl) || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  return {
    id: 'env_primary',
    name: 'Primary Server (.env)',
    url: cleanUrl,
    isPrimary: true,
    status: 'online',
    responseTime: 0,
    isActive: true
  };
};

/**
 * Determines whether a backend node is currently eligible and healthy to receive requests.
 * Evaluates:
 * 1. Explicit active switch (isActive !== false)
 * 2. Node status ('online' required; 'offline' or 'unknown' excluded)
 * 3. Stale-health detection (lastHealthCheck older than maxStaleMs is excluded)
 * 4. Client-side circuit breaker (nodes in cooldown are excluded)
 * 5. Environment constraints (localhost excluded when hosted on web domains)
 */
export const isNodeEligible = (
  server,
  { isOnWebDomain = false, now = Date.now(), maxStaleMs = STALE_THRESHOLD_MS } = {}
) => {
  if (!server || !server.url) return false;
  if (server.isActive === false) return false;
  if (server.status === 'offline' || server.status === 'unknown') return false;
  if (server.isStale === true) return false;

  const url = normalizeUrl(server.url);
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;

  // Stale health check detection
  if (server.lastHealthCheck) {
    const checkTime = new Date(server.lastHealthCheck).getTime();
    if (!isNaN(checkTime) && (now - checkTime > maxStaleMs)) {
      return false;
    }
  }

  // Client-side circuit breaker cooldown check
  if (isNodeInCooldown(url, now)) {
    return false;
  }

  // Prevent routing to localhost / 127.0.0.1 when running on a live web domain
  if (isOnWebDomain && (url.includes('localhost') || url.includes('127.0.0.1'))) {
    return false;
  }

  return true;
};

/**
 * Selects an eligible backend node according to the configured routing policy.
 *
 * Supported Policies:
 * - 'failover': Routes to primary when healthy. When primary fails or is in cooldown,
 *               immediately selects a healthy eligible backup node.
 * - 'round-robin': Distributes requests evenly across all eligible healthy nodes.
 * - 'latency': Selects the node with the lowest measured fresh responseTime.
 * - 'cpu-adaptive': Selects the node with the lowest CPU usage below the defined threshold.
 * - 'manual': Routes directly to the admin-selected node if healthy, falling back to primary or backup.
 *
 * Handles the edge case where every node is unavailable gracefully without throwing an unhandled exception.
 */
export const selectBackendNode = ({
  policy = 'failover',
  servers = [],
  manualSelectedServerId = null,
  cpuThreshold = 80,
  rrIndex = 0,
  isOnWebDomain = false,
  primaryUrl = '',
  now = Date.now()
} = {}) => {
  const eligible = (Array.isArray(servers) ? servers : []).filter(s =>
    isNodeEligible(s, { isOnWebDomain, now })
  );

  const cleanPrimary = normalizeUrl(primaryUrl);

  // Handle situation where every node is unavailable
  if (eligible.length === 0) {
    return {
      selectedServer: null,
      selectedUrl: cleanPrimary,
      allNodesUnavailable: true,
      nextRrIndex: rrIndex
    };
  }

  switch (policy) {
    case 'manual': {
      const target = eligible.find(s =>
        (s.id && s.id === manualSelectedServerId) ||
        (s._id && s._id === manualSelectedServerId)
      );
      if (target) {
        return {
          selectedServer: target,
          selectedUrl: normalizeUrl(target.url),
          allNodesUnavailable: false,
          nextRrIndex: rrIndex
        };
      }
      // Fallback if manual target is offline/unhealthy
      const primaryOnline = eligible.find(s => normalizeUrl(s.url) === cleanPrimary);
      const fallback = primaryOnline || eligible[0];
      return {
        selectedServer: fallback,
        selectedUrl: normalizeUrl(fallback.url),
        allNodesUnavailable: false,
        nextRrIndex: rrIndex
      };
    }

    case 'latency': {
      // Sort nodes by fresh response time ascending. Nodes with measured responseTime <= 0 are penalized.
      const sorted = [...eligible].sort((a, b) => {
        const timeA = (a.responseTime && a.responseTime > 0 && !a.isStale) ? a.responseTime : 99999;
        const timeB = (b.responseTime && b.responseTime > 0 && !b.isStale) ? b.responseTime : 99999;
        return timeA - timeB;
      });
      return {
        selectedServer: sorted[0],
        selectedUrl: normalizeUrl(sorted[0].url),
        allNodesUnavailable: false,
        nextRrIndex: rrIndex
      };
    }

    case 'cpu-adaptive': {
      const threshold = Number(cpuThreshold) || 80;
      const underLoaded = eligible.filter(s => (Number(s.cpuUsage) || 0) < threshold);
      const candidatePool = underLoaded.length > 0 ? underLoaded : eligible;

      const sortedByCpu = [...candidatePool].sort((a, b) =>
        (Number(a.cpuUsage) || 0) - (Number(b.cpuUsage) || 0)
      );

      return {
        selectedServer: sortedByCpu[0],
        selectedUrl: normalizeUrl(sortedByCpu[0].url),
        allNodesUnavailable: false,
        nextRrIndex: rrIndex
      };
    }

    case 'round-robin': {
      const safeIndex = Math.abs(rrIndex) % eligible.length;
      const chosen = eligible[safeIndex];
      const nextRrIndex = (safeIndex + 1) % eligible.length;

      return {
        selectedServer: chosen,
        selectedUrl: normalizeUrl(chosen.url),
        allNodesUnavailable: false,
        nextRrIndex
      };
    }

    case 'failover':
    default: {
      const primaryOnline = eligible.find(s => normalizeUrl(s.url) === cleanPrimary);
      if (primaryOnline) {
        return {
          selectedServer: primaryOnline,
          selectedUrl: normalizeUrl(primaryOnline.url),
          allNodesUnavailable: false,
          nextRrIndex: rrIndex
        };
      }
      // Primary is unavailable/in cooldown: select first healthy backup node
      const backupNode = eligible.find(s => normalizeUrl(s.url) !== cleanPrimary) || eligible[0];
      return {
        selectedServer: backupNode,
        selectedUrl: normalizeUrl(backupNode.url),
        allNodesUnavailable: false,
        isBackupActive: true,
        nextRrIndex: rrIndex
      };
    }
  }
};

/**
 * Checks whether an HTTP method is idempotent per RFC 9110.
 * GET, HEAD, and OPTIONS are safe to retry on network failures or gateway errors.
 * State-changing methods (POST, PUT, DELETE, PATCH) MUST NOT be retried automatically
 * because the outcome on the server is uncertain and retrying may cause duplicate operations.
 */
export const isIdempotentRequest = (config) => {
  if (!config) return false;
  const method = (config.method || 'get').toUpperCase();
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
};

/**
 * Evaluates whether an Axios request failure should trigger an automatic failover retry.
 */
export const shouldRetryRequest = (error, originalRequest, { maxRetries = 1 } = {}) => {
  if (!originalRequest) return false;
  if ((originalRequest._retryCount || 0) >= maxRetries) return false;

  // Strict idempotency safeguard
  if (!isIdempotentRequest(originalRequest)) {
    return false;
  }

  if (!error.response) return true;
  const status = error.response.status;

  // Gateway / server errors / rate limits
  if ((status >= 502 && status <= 504) || status === 429 || status === 500) {
    return true;
  }

  // Cloudflare / edge 403 or stale-node 403 (exclude explicit student block/suspension)
  if (status === 403 && !error.response.data?.isBlocked && !error.response.data?.isSuspended) {
    return true;
  }

  return false;
};

/**
 * Finds an alternate healthy backup node excluding failing URL(s), distributing fallbacks evenly via rrIndex.
 */
export const getFallbackServer = (
  servers,
  currentBaseURL,
  { isOnWebDomain = false, now = Date.now(), rrIndex = 0, excludeUrls = [] } = {}
) => {
  if (!Array.isArray(servers) || servers.length === 0) return null;

  const excluded = new Set(
    [currentBaseURL, ...(Array.isArray(excludeUrls) ? excludeUrls : [])]
      .filter(Boolean)
      .map(u => normalizeUrl(u).replace(/\/api$/, ''))
  );

  const candidates = servers.filter(s => {
    if (!isNodeEligible(s, { isOnWebDomain, now })) return false;
    const sClean = normalizeUrl(s.url);
    return !excluded.has(sClean);
  });

  if (candidates.length === 0) return null;
  const idx = Math.abs(Number(rrIndex) || 0) % candidates.length;
  return candidates[idx];
};
