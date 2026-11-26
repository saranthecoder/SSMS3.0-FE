import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import {
  getPrimaryEnvServer,
  selectBackendNode,
  shouldRetryRequest,
  getFallbackServer,
  normalizeUrl,
  recordNodeFailure,
  recordNodeSuccess,
  resetClientHealthRegistry
} from '../utils/trafficRouter';

// Set global axios defaults
const primaryServerConfig = getPrimaryEnvServer();
axios.defaults.baseURL = `${primaryServerConfig.url}/api`;
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

let rrIndex = 0; // Round-robin index counter
let consecutiveGlobalFailures = 0;
let lastFailureAt = 0;
let lastOutagePopupAt = 0;
let lastResumeAt = Date.now();
let activeOutageSwalOpen = false;
let isProbingConnectivity = false;
const OUTAGE_FAILURE_THRESHOLD = 4;
const FAILURE_WINDOW_MS = 20 * 1000;
const RESUME_GRACE_MS = 10000;
const OUTAGE_POPUP_COOLDOWN_MS = 3 * 60 * 1000;
const MAX_IDEMPOTENT_FAILOVER_RETRIES = 3;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

  const isOnWebDomain = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';

  // State for traffic manager
  const [trafficConfig, setTrafficConfig] = useState(() => {
    const primaryServer = getPrimaryEnvServer();
    try {
      const saved = localStorage.getItem('trafficConfig');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && Array.isArray(parsed.servers)) {
        const secondaryServers = parsed.servers
          .filter(s => s && s.url && normalizeUrl(s.url) !== normalizeUrl(primaryServer.url))
          .map(s => ({ ...s, isPrimary: false }));
        return {
          policy: parsed.policy || 'round-robin',
          manualSelectedServerId: parsed.manualSelectedServerId || null,
          cpuThreshold: parsed.cpuThreshold || 80,
          servers: [primaryServer, ...secondaryServers]
        };
      }
      return { policy: 'round-robin', manualSelectedServerId: null, cpuThreshold: 80, servers: [primaryServer] };
    } catch (e) {
      return { policy: 'round-robin', manualSelectedServerId: null, cpuThreshold: 80, servers: [primaryServer] };
    }
  });

  const trafficConfigRef = useRef(trafficConfig);
  useEffect(() => {
    trafficConfigRef.current = trafficConfig;
  }, [trafficConfig]);

  // Fetch public config (active servers list + policy)
  const refreshTrafficConfig = async () => {
    try {
      const primaryServer = getPrimaryEnvServer();
      const candidates = [
        primaryServer.url,
        import.meta.env.VITE_API_URL1,
        import.meta.env.VITE_API_URL2,
        import.meta.env.VITE_API_URL3,
        ...(trafficConfigRef.current.servers?.map(s => s.url) || [])
      ].filter(Boolean);

      const uniqueCandidates = [...new Set(candidates.map(u => normalizeUrl(u)))];

      let data = null;
      let legacyFallback = null;
      for (const baseUrl of uniqueCandidates) {
        try {
          const res = await axios.get(`${baseUrl}/api/traffic/public-config`, { timeout: 4000, _skipOutagePopup: true });
          if (res.data && Array.isArray(res.data.servers)) {
            if (res.data.apiVersion || typeof res.data.cpuThreshold === 'number') {
              data = res.data;
              break;
            }
            if (!legacyFallback) legacyFallback = res.data;
          }
        } catch (e) {
          // ignore & try next candidate
        }
      }
      if (!data) data = legacyFallback;

      if (!data) return;

      setTrafficConfig(prev => {
        const normalizedPrimaryUrl = normalizeUrl(primaryServer.url);
        const dbServers = (data.servers || []).map(dbS => {
          const cleanUrl = normalizeUrl(dbS.url);
          const isPrimary = cleanUrl === normalizedPrimaryUrl || Boolean(dbS.isPrimary);
          return {
            id: dbS.id || dbS._id,
            name: dbS.name || (cleanUrl === normalizedPrimaryUrl ? primaryServer.name : cleanUrl),
            url: cleanUrl,
            isPrimary,
            status: dbS.status || 'unknown',
            isStale: Boolean(dbS.isStale),
            lastHealthCheck: dbS.lastHealthCheck || null,
            responseTime: dbS.responseTime || 0,
            cpuUsage: dbS.cpuUsage ?? null,
            isActive: dbS.isActive !== undefined ? dbS.isActive : true
          };
        });

        // Respect DB status/activation for all nodes including primary; only fall back to env primary if DB list is empty
        const merged = dbServers.length > 0 ? dbServers : [primaryServer];

        // Ensure active policy from DB applies directly to student traffic
        const nextConfig = {
          policy: data.policy || prev.policy || 'failover',
          manualSelectedServerId: data.manualSelectedServerId !== undefined ? data.manualSelectedServerId : prev.manualSelectedServerId,
          cpuThreshold: data.cpuThreshold !== undefined ? Number(data.cpuThreshold) : (prev.cpuThreshold || 80),
          servers: merged
        };

        localStorage.setItem('trafficConfig', JSON.stringify(nextConfig));
        return nextConfig;
      });
    } catch (err) {
      console.error('Failed to fetch public traffic config, using local cache:', err);
    }
  };

  // Background config sync for traffic routing (single effect without duplicate listeners)
  useEffect(() => {
    const syncConfig = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      await refreshTrafficConfig();
    };

    const triggerWakeRecovery = () => {
      lastResumeAt = Date.now();
      consecutiveGlobalFailures = 0;
      resetClientHealthRegistry();
      if (activeOutageSwalOpen) {
        activeOutageSwalOpen = false;
        Swal.close();
      }
    };

    const handleBackOnline = () => {
      triggerWakeRecovery();
      lastOutagePopupAt = 0;
      setTimeout(() => refreshTrafficConfig(), 800);
    };

    const handleVisibilityResume = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        triggerWakeRecovery();
      }
    };

    const handleWindowFocus = () => {
      triggerWakeRecovery();
    };

    // Detect OS/tab sleep clock jumps even when the tab remained focused before sleep
    let lastHeartbeatAt = Date.now();
    const sleepDetectorId = setInterval(() => {
      const now = Date.now();
      if (now - lastHeartbeatAt > 10000) {
        triggerWakeRecovery();
      }
      lastHeartbeatAt = now;
    }, 2000);

    syncConfig();
    const intervalId = setInterval(syncConfig, 60000);
    window.addEventListener('online', handleBackOnline);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('pageshow', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityResume);

    return () => {
      clearInterval(intervalId);
      clearInterval(sleepDetectorId);
      window.removeEventListener('online', handleBackOnline);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('pageshow', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityResume);
    };
  }, []);

  // Calculate active socket URL: Pinned to healthy Primary node with Active-Backup failover
  const getSocketUrl = () => {
    const currentConfig = trafficConfigRef.current || trafficConfig;
    const primaryServer = getPrimaryEnvServer();
    // Pin persistent socket connections to primary node to ensure room membership convergence
    const { selectedUrl } = selectBackendNode({
      policy: 'active-backup',
      servers: currentConfig.servers,
      manualSelectedServerId: currentConfig.manualSelectedServerId,
      cpuThreshold: currentConfig.cpuThreshold,
      rrIndex: 0,
      isOnWebDomain,
      primaryUrl: primaryServer.url
    });
    return selectedUrl || primaryServer.url;
  };

  const socketUrl = getSocketUrl();
  const userIdStr = user?._id || '';

  // Set up socket connection based on current active backend server
  useEffect(() => {
    if (userIdStr) {
      console.log(`Connecting socket to: ${socketUrl}`);
      const newSocket = io(socketUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'], // Prioritize WebSocket to prevent session-affinity mismatches across multi-instance URLs
        auth: { userId: userIdStr, role: user?.role },
        query: { userId: userIdStr, role: user?.role },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 15000,
        randomizationFactor: 0.5
      });
      let socketErrors = 0;
      newSocket.on('connect', () => {
        socketErrors = 0;
        recordNodeSuccess(socketUrl);
      });
      newSocket.on('connect_error', (err) => {
        socketErrors += 1;
        recordNodeFailure(socketUrl, err);
        if (socketErrors >= 2) {
          socketErrors = 0;
          setTrafficConfig(prev => ({ ...prev })); // Re-evaluate getSocketUrl() to fail over to a healthy node
          refreshTrafficConfig();
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    } else {
      setSocket(null);
    }
  }, [userIdStr, socketUrl]);

  // Set up axios interceptors for header and dynamic load-balancing
  useEffect(() => {
    // 1. Request Interceptor
    const requestInterceptor = axios.interceptors.request.use((config) => {
      // Add custom header if user session is present
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed && parsed._id) {
            config.headers['x-user-id'] = parsed._id;
          }
        } catch (e) {}
      }

      // Skip dynamic node routing if URL is already absolute OR if this is a failover retry pinned to a fallback node
      if (
        (config.url && (config.url.startsWith('http://') || config.url.startsWith('https://'))) ||
        (config._retryCount > 0 && config.baseURL)
      ) {
        return config;
      }

      const currentConfig = trafficConfigRef.current;
      const primaryServer = getPrimaryEnvServer();

      // Deterministically select backend node based on active routing policy
      const { selectedUrl, nextRrIndex, allNodesUnavailable } = selectBackendNode({
        policy: currentConfig.policy,
        servers: currentConfig.servers,
        manualSelectedServerId: currentConfig.manualSelectedServerId,
        cpuThreshold: currentConfig.cpuThreshold,
        rrIndex,
        isOnWebDomain,
        primaryUrl: primaryServer.url
      });

      if (allNodesUnavailable) {
        console.warn('[TrafficRouter] All registered backend nodes are currently unavailable or in cooldown. Defaulting to primary endpoint.');
      }

      rrIndex = nextRrIndex;
      config.baseURL = `${selectedUrl}/api`;
      return config;
    });

    // 2. Response Interceptor for Automatic Failover & Safe Retry
    const responseInterceptor = axios.interceptors.response.use(
      (response) => {
        // Record node success to clear cooldown upon recovery
        consecutiveGlobalFailures = 0;
        lastFailureAt = 0;
        if (activeOutageSwalOpen) {
          activeOutageSwalOpen = false;
          Swal.close();
        }
        if (response.config && response.config.baseURL) {
          recordNodeSuccess(response.config.baseURL);
        }
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;
        const now = Date.now();
        const isBrowserOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const isTabHidden = typeof document !== 'undefined' && document.hidden;
        const isInWakeGrace = (now - lastResumeAt) < RESUME_GRACE_MS;
        const isNetworkCut = !error.response;
        const isNodeOrEdgeFailure =
          isNetworkCut ||
          status >= 500 ||
          status === 429 ||
          (status === 403 && !error.response?.data?.isBlocked && !error.response?.data?.isSuspended);

        if (originalRequest && originalRequest.baseURL && isNodeOrEdgeFailure && !isBrowserOffline && !isInWakeGrace) {
          recordNodeFailure(originalRequest.baseURL, error);
        }

        // Idempotency check: retry GET/HEAD/OPTIONS across up to MAX_IDEMPOTENT_FAILOVER_RETRIES distinct healthy nodes
        if (!isBrowserOffline && originalRequest && shouldRetryRequest(error, originalRequest, { maxRetries: MAX_IDEMPOTENT_FAILOVER_RETRIES })) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          const currentConfig = trafficConfigRef.current;
          const currentBaseURL = originalRequest.baseURL;
          originalRequest._triedUrls = Array.isArray(originalRequest._triedUrls) ? originalRequest._triedUrls : [];
          if (currentBaseURL) {
            originalRequest._triedUrls.push(currentBaseURL);
          }

          const fallbackServer = getFallbackServer(currentConfig.servers, currentBaseURL, {
            isOnWebDomain,
            rrIndex,
            excludeUrls: originalRequest._triedUrls
          });

          if (fallbackServer) {
            rrIndex = rrIndex + 1;
            originalRequest.baseURL = `${normalizeUrl(fallbackServer.url)}/api`;
            console.warn(`Idempotent request failed on ${currentBaseURL}. Retrying (${originalRequest._retryCount}/${MAX_IDEMPOTENT_FAILOVER_RETRIES}) on fallback node: ${fallbackServer.name} (${fallbackServer.url})`);
            return axios(originalRequest);
          }
        }

        // Ignore transient wake-up / hidden-tab errors and passive background polls
        if (
          isNodeOrEdgeFailure &&
          !originalRequest?._skipOutagePopup &&
          !axios.isCancel?.(error) &&
          !isTabHidden &&
          !isInWakeGrace
        ) {
          if (now - lastFailureAt > FAILURE_WINDOW_MS) {
            consecutiveGlobalFailures = 0;
          }
          lastFailureAt = now;
          consecutiveGlobalFailures += 1;

          const currentConfig = trafficConfigRef.current;
          const primaryServer = getPrimaryEnvServer();
          const { allNodesUnavailable, selectedUrl: probeBase } = selectBackendNode({
            policy: currentConfig.policy,
            servers: currentConfig.servers,
            manualSelectedServerId: currentConfig.manualSelectedServerId,
            cpuThreshold: currentConfig.cpuThreshold,
            rrIndex,
            isOnWebDomain,
            primaryUrl: primaryServer.url
          });

          if (
            (isBrowserOffline || (allNodesUnavailable && consecutiveGlobalFailures >= 2) || consecutiveGlobalFailures >= OUTAGE_FAILURE_THRESHOLD) &&
            !Swal.isVisible() &&
            !isProbingConnectivity &&
            now - lastOutagePopupAt > OUTAGE_POPUP_COOLDOWN_MS
          ) {
            let confirmedOutage = isBrowserOffline;
            if (!confirmedOutage) {
              isProbingConnectivity = true;
              try {
                await axios.get(`${normalizeUrl(probeBase || primaryServer.url)}/api/health/live`, {
                  timeout: 5000,
                  _skipOutagePopup: true,
                  _retryCount: MAX_IDEMPOTENT_FAILOVER_RETRIES
                });
                // Platform IS reachable; failures were from stale sockets or a slow endpoint
                consecutiveGlobalFailures = 0;
                confirmedOutage = false;
              } catch {
                confirmedOutage = true;
              } finally {
                isProbingConnectivity = false;
              }
            }

            if (confirmedOutage && !Swal.isVisible()) {
              lastOutagePopupAt = Date.now();
              activeOutageSwalOpen = true;
              const popupTitle = isBrowserOffline
                ? 'No Internet Connection'
                : isNetworkCut
                  ? 'Network / Connection Issue'
                  : 'Server Busy — Please Wait';
              const popupHtml = isBrowserOffline
                ? '<p style="font-size:14px;line-height:1.6;">Your device appears to be <strong>offline</strong>.<br/><br/>Please check your <strong>Wi-Fi or mobile internet</strong> and click <strong>Retry Connection</strong>. Your saved progress and attendance remain safe.</p>'
                : isNetworkCut
                  ? '<p style="font-size:14px;line-height:1.6;">Unable to reach the platform from your current internet connection.<br/><br/>Please check your <strong>Wi-Fi, mobile data, VPN, or college firewall</strong> and try <strong>Retry Connection</strong> (or switch networks). Your saved progress remains safe.</p>'
                  : '<p style="font-size:14px;line-height:1.6;">The server is currently experiencing high traffic or restarting.<br/><br/>Please wait <strong>2 to 5 minutes</strong> before refreshing the page. Your saved progress and attendance records remain safe.</p>';

              Swal.fire({
                icon: isNetworkCut ? 'info' : 'warning',
                title: popupTitle,
                html: popupHtml,
                confirmButtonText: isNetworkCut ? 'OK' : 'OK, I Will Wait',
                showDenyButton: true,
                denyButtonText: 'Retry Connection',
                confirmButtonColor: '#10b981',
                denyButtonColor: '#6366f1'
              }).then((result) => {
                activeOutageSwalOpen = false;
                if (result.isDenied) {
                  consecutiveGlobalFailures = 0;
                  lastOutagePopupAt = 0;
                  resetClientHealthRegistry();
                  refreshTrafficConfig();
                }
              });
            }
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [trafficConfig]);

  // Check if user is logged in on mount
  useEffect(() => {
    const fetchUser = async () => {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser); // Set immediately for fast UI
          setLoading(false); // Unblock UI immediately so app does not get stuck on 'Loading SSMS...'
          
          // Then fetch fresh data in background with timeout
          if (parsedUser && parsedUser._id) {
            try {
              const { data } = await axios.get('/auth/profile', {
                headers: { 'x-user-id': parsedUser._id },
                timeout: 6000
              });
              setUser(data);
              localStorage.setItem('user', JSON.stringify(data));
            } catch (err) {
              if (err.response && err.response.status === 401) {
                console.warn("Session expired, clearing stored user");
                setUser(null);
                localStorage.removeItem('user');
              }
            }
          }
          return;
        } catch (error) {
          console.error("Error parsing stored user:", error);
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/auth/login', { email, password });
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  };

  const register = async (name, email, password, role) => {
    const { data } = await axios.post('/auth/register', { name, email, password, role });
    setUser(data);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  };

  // Global Active Batch State
  const [batchesList, setBatchesList] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Initialize selected batch from localStorage
  const [selectedBatchId, setSelectedBatchIdState] = useState(() => {
    const saved = localStorage.getItem('selectedBatchId');
    return (saved && saved !== 'all') ? saved : '';
  });
  const [selectedBatchName, setSelectedBatchNameState] = useState(() => {
    return localStorage.getItem('selectedBatchName') || '';
  });
  const [selectedBatch, setSelectedBatch] = useState(null);

  const clearBatchSelection = useCallback(() => {
    setSelectedBatch(null);
    setSelectedBatchIdState('');
    setSelectedBatchNameState('');
    localStorage.removeItem('selectedBatchId');
    localStorage.removeItem('selectedBatchName');
    if (user?.role === 'admin' || user?.role === 'mentor') {
      setIsBatchModalOpen(true);
    }
  }, [user?.role]);

  const selectBatch = useCallback((batchInput) => {
    if (!batchInput) return;
    let batchObj = null;
    if (typeof batchInput === 'string') {
      batchObj = batchesList.find(b => b._id.toString() === batchInput.toString());
    } else if (batchInput && batchInput._id) {
      batchObj = batchInput;
    }

    if (!batchObj || !batchObj._id) return;

    setSelectedBatch(batchObj);
    setSelectedBatchIdState(batchObj._id);
    setSelectedBatchNameState(batchObj.batchName || '');
    localStorage.setItem('selectedBatchId', batchObj._id);
    localStorage.setItem('selectedBatchName', batchObj.batchName || '');
    setIsBatchModalOpen(false);
  }, [batchesList]);

  const setSelectedBatchId = useCallback((batchId) => {
    if (!batchId || batchId === 'all') {
      clearBatchSelection();
    } else {
      selectBatch(batchId);
    }
  }, [clearBatchSelection, selectBatch]);

  const openBatchModal = useCallback(() => {
    setIsBatchModalOpen(true);
  }, []);

  const closeBatchModal = useCallback(() => {
    // Cannot close modal if no valid batch is selected for admin
    if (selectedBatchId) {
      setIsBatchModalOpen(false);
    }
  }, [selectedBatchId]);

  const fetchGlobalBatches = useCallback(async () => {
    if (!user) return;
    setIsLoadingBatches(true);
    try {
      let sortedBatches = [];
      if (user?.role === 'student') {
        const { data } = await axios.get('/enrollments/my');
        if (Array.isArray(data)) {
          sortedBatches = data
            .filter(e => e.status === 'approved' && e.batchId)
            .map(e => e.batchId);
        }
      } else {
        const { data } = await axios.get('/batches');
        let rawBatches = Array.isArray(data) ? data : [];
        if (user?.role === 'mentor') {
          const uId = (user?._id || '').toString();
          rawBatches = rawBatches.filter(b => {
            const mId = (b.mentorId?._id || b.mentorId)?.toString();
            const inMentors = Array.isArray(b.mentors) && b.mentors.some(m => (m?._id || m)?.toString() === uId);
            return mId === uId || inMentors;
          });
        }
        sortedBatches = [...rawBatches].sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
      }
      setBatchesList(sortedBatches);

      if (user?.role === 'admin' || user?.role === 'mentor') {
        const savedBatchId = localStorage.getItem('selectedBatchId');
        if (savedBatchId && savedBatchId !== 'all') {
          const matchedBatch = sortedBatches.find(b => b._id.toString() === savedBatchId.toString());
          if (matchedBatch) {
            // Valid batch found and confirmed by backend!
            setSelectedBatch(matchedBatch);
            setSelectedBatchIdState(matchedBatch._id);
            setSelectedBatchNameState(matchedBatch.batchName || '');
            localStorage.setItem('selectedBatchId', matchedBatch._id);
            localStorage.setItem('selectedBatchName', matchedBatch.batchName || '');
            setIsBatchModalOpen(false);
          } else {
            // Selected batch was deleted or is invalid
            console.warn(`Saved batch ID ${savedBatchId} no longer exists in available batches.`);
            setSelectedBatch(null);
            setSelectedBatchIdState('');
            setSelectedBatchNameState('');
            localStorage.removeItem('selectedBatchId');
            localStorage.removeItem('selectedBatchName');
            setIsBatchModalOpen(true);
          }
        } else {
          // No batch selected yet! Mandatory selection for admin and mentor
          setSelectedBatch(null);
          setSelectedBatchIdState('');
          setSelectedBatchNameState('');
          localStorage.removeItem('selectedBatchId');
          localStorage.removeItem('selectedBatchName');
          setIsBatchModalOpen(true);
        }
      } else if (sortedBatches.length > 0) {
        const savedBatchId = localStorage.getItem('selectedBatchId');
        const matched = sortedBatches.find(b => b._id.toString() === savedBatchId);
        const active = matched || sortedBatches[0];
        setSelectedBatch(active);
        setSelectedBatchIdState(active._id);
        setSelectedBatchNameState(active.batchName || '');
      }
    } catch (err) {
      console.error('Error fetching global batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchGlobalBatches();
    }
  }, [user?._id, user?.role, fetchGlobalBatches]);

  const activeBatch = selectedBatch || batchesList.find(b => b._id.toString() === selectedBatchId?.toString()) || batchesList[0] || null;
  const isBatchClosed = activeBatch 
    ? (activeBatch.status === 'Completed' || (activeBatch.endDate && new Date(activeBatch.endDate) <= new Date()))
    : false;
  const customPanelName = user?.role === 'admin' 
    ? 'SRAC 2.0' 
    : user?.role === 'mentor'
    ? 'SSMS - Saran Students Management System'
    : (activeBatch?.panelName?.trim() || 'SSMS 2.0');
  const customPanelSubheading = user?.role === 'admin' 
    ? 'SR Admin Console & Maintenance System' 
    : user?.role === 'mentor'
    ? "Saran Student's Management System"
    : (activeBatch?.panelSubheading?.trim() || "Saran Student's Management System");

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (e) {}
    setUser(null);
    localStorage.removeItem('user');
    // Retain selectedBatchId and selectedBatchName in localStorage so that
    // upon reopening or logging back in, the administrator's preferred batch is restored.
    setSelectedBatch(null);
    setSelectedBatchIdState('');
    setSelectedBatchNameState('');
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout, 
      updateUser, 
      socket, 
      trafficConfig, 
      refreshTrafficConfig,
      selectedBatchId,
      setSelectedBatchId,
      selectedBatchName,
      selectedBatch,
      batchesList,
      isLoadingBatches,
      activeBatch,
      isBatchClosed,
      isBatchModalOpen,
      openBatchModal,
      closeBatchModal,
      selectBatch,
      clearBatchSelection,
      customPanelName,
      customPanelSubheading,
      fetchGlobalBatches
    }}>
      {children}
    </AuthContext.Provider>
  );
};

