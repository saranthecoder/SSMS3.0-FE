import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

// Set global axios defaults
const apiUrl = import.meta.env.VITE_API_URL;
axios.defaults.baseURL = `${apiUrl}/api`;
axios.defaults.withCredentials = true;

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

let rrIndex = 0; // Round-robin index counter

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  
  // Primary server defined in .env
  const getPrimaryEnvServer = () => {
    const rawUrl = (import.meta.env.VITE_API_URL || 'https://ssms3-0-be.onrender.com').trim();
    const cleanUrl = rawUrl.endsWith('/') ? rawUrl.slice(0, -1) : rawUrl;
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

  // Helper to collect all env backup servers
  const getEnvServers = () => {
    const primary = getPrimaryEnvServer();
    const backupUrls = [
      import.meta.env.VITE_API_URL1,
      import.meta.env.VITE_API_URL2,
      import.meta.env.VITE_API_URL3
    ].filter(Boolean);
    
    const uniqueBackupUrls = [...new Set(backupUrls.map(url => url.trim().endsWith('/') ? url.trim().slice(0, -1) : url.trim()))]
      .filter(u => u !== primary.url);
    
    const backups = uniqueBackupUrls.map((url, idx) => ({
      id: `env_backup_${idx}`,
      name: `Backup Node ${idx + 1}`,
      url: url,
      isPrimary: false,
      status: 'unknown',
      responseTime: 0,
      isActive: true
    }));

    return [primary, ...backups];
  };

  // State for traffic manager
  const [trafficConfig, setTrafficConfig] = useState(() => {
    const primaryServer = getPrimaryEnvServer();
    // Clean legacy storage pointing to deprecated server nodes
    try {
      const saved = localStorage.getItem('trafficConfig');
      if (saved && saved.includes('ssms-be-elp4.onrender.com')) {
        localStorage.removeItem('trafficConfig');
      }
    } catch (e) {}

    try {
      const saved = localStorage.getItem('trafficConfig');
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && Array.isArray(parsed.servers)) {
        const secondaryServers = parsed.servers
          .filter(s => s.url !== primaryServer.url && !s.url.includes('ssms-be-elp4.onrender.com'))
          .map(s => ({ ...s, isPrimary: false }));
        return {
          policy: 'failover',
          manualSelectedServerId: null,
          servers: [primaryServer, ...secondaryServers]
        };
      }
      return { policy: 'failover', manualSelectedServerId: null, servers: [primaryServer] };
    } catch (e) {
      return { policy: 'failover', manualSelectedServerId: null, servers: [primaryServer] };
    }
  });

  const trafficConfigRef = useRef(trafficConfig);
  useEffect(() => {
    trafficConfigRef.current = trafficConfig;
  }, [trafficConfig]);

  // Fetch public config (active servers list + policy)
  const refreshTrafficConfig = async () => {
    try {
      const candidates = [
        import.meta.env.VITE_API_URL,
        import.meta.env.VITE_API_URL1,
        import.meta.env.VITE_API_URL2,
        import.meta.env.VITE_API_URL3,
        ...(trafficConfigRef.current.servers?.map(s => s.url) || [])
      ].filter(Boolean);

      const uniqueCandidates = [...new Set(candidates.map(u => u.trim().endsWith('/') ? u.trim().slice(0, -1) : u.trim()))];

      let data = null;
      for (const baseUrl of uniqueCandidates) {
        try {
          const res = await axios.get(`${baseUrl}/api/traffic/public-config`, { timeout: 4000 });
          if (res.data && res.data.servers) {
            data = res.data;
            break;
          }
        } catch (e) {
          // ignore & try next candidate
        }
      }

      if (!data) return;

      setTrafficConfig(prev => {
        const primaryServer = getPrimaryEnvServer();
        const dbServers = (data.servers || []).map(dbS => {
          const cleanUrl = dbS.url.trim().endsWith('/') ? dbS.url.trim().slice(0, -1) : dbS.url.trim();
          const isPrimary = cleanUrl === primaryServer.url;
          return {
            id: dbS.id || dbS._id,
            name: isPrimary ? 'Primary Server (.env)' : dbS.name,
            url: cleanUrl,
            isPrimary: isPrimary,
            status: dbS.status || 'unknown',
            responseTime: dbS.responseTime || 0,
            isActive: dbS.isActive !== undefined ? dbS.isActive : true
          };
        });

        const secondaryServers = dbServers.filter(s => s.url !== primaryServer.url && !s.url.includes('ssms-be-elp4.onrender.com'));
        const merged = [primaryServer, ...secondaryServers];

        const nextConfig = {
          policy: 'failover',
          manualSelectedServerId: null,
          servers: merged
        };
        
        localStorage.setItem('trafficConfig', JSON.stringify(nextConfig));
        return nextConfig;
      });
    } catch (err) {
      console.error('Failed to fetch public traffic config, using local cache:', err);
    }
  };

  // Background config sync for traffic routing
  useEffect(() => {
    const syncConfig = async () => {
      await refreshTrafficConfig();
    };

    const delayId = setTimeout(syncConfig, 1000);
    const intervalId = setInterval(syncConfig, 60000);

    return () => {
      clearTimeout(delayId);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    refreshTrafficConfig();
  }, []);

  const isOnWebDomain = typeof window !== 'undefined' && 
    window.location.hostname !== 'localhost' && 
    window.location.hostname !== '127.0.0.1';

  // Calculate active socket URL
  const getSocketUrl = () => {
    const { servers, policy, manualSelectedServerId } = trafficConfig;
    let activeServers = servers && servers.length > 0 
      ? servers.filter(s => s.status !== 'offline' && s.isActive !== false) 
      : [];
    
    if (isOnWebDomain) {
      activeServers = activeServers.filter(s => !s.url.includes('localhost') && !s.url.includes('127.0.0.1'));
    }

    if (activeServers.length > 0) {
      let chosenServer = activeServers[0];
      if (policy === 'manual') {
        const selected = servers.find(s => s.id === manualSelectedServerId || s._id === manualSelectedServerId);
        if (selected && selected.status !== 'offline' && (!isOnWebDomain || !selected.url.includes('localhost'))) {
          chosenServer = selected;
        }
      } else if (policy === 'latency') {
        const sorted = [...activeServers].sort((a, b) => a.responseTime - b.responseTime);
        chosenServer = sorted[0];
      }
      return chosenServer.url;
    }
    return import.meta.env.VITE_API_URL;
  };

  const socketUrl = getSocketUrl();
  const userIdStr = user?._id || '';

  // Set up socket connection based on current active backend server
  useEffect(() => {
    if (userIdStr) {
      console.log(`Connecting socket to: ${socketUrl}`);
      const newSocket = io(socketUrl, {
        withCredentials: true,
        query: { userId: userIdStr, role: user.role },
        reconnectionDelay: 5000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.5
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
      // Add custom header
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && parsed._id) {
          config.headers['x-user-id'] = parsed._id;
        }
      }

      // Skip load balancing if URL is already absolute (e.g. pointing to external links, uploads, or a direct ping)
      if (config.url && (config.url.startsWith('http://') || config.url.startsWith('https://'))) {
        return config;
      }

      // Calculate the base URL based on traffic policy
      const currentConfig = trafficConfigRef.current;
      const { policy, servers, manualSelectedServerId } = currentConfig;
      let activeServers = servers && servers.length > 0 
        ? servers.filter(s => s.status !== 'offline' && s.isActive !== false) 
        : [];

      if (isOnWebDomain) {
        activeServers = activeServers.filter(s => !s.url.includes('localhost') && !s.url.includes('127.0.0.1'));
      }

      if (activeServers.length > 0) {
        let selectedUrl = `${activeServers[0].url}/api`;

        switch (policy) {
          case 'manual': {
            const selected = servers.find(s => s.id === manualSelectedServerId || s._id === manualSelectedServerId);
            if (selected && selected.status !== 'offline' && (!isOnWebDomain || !selected.url.includes('localhost'))) {
              selectedUrl = `${selected.url}/api`;
            } else {
              selectedUrl = `${activeServers[0].url}/api`;
            }
            break;
          }
          case 'latency': {
            const sorted = [...activeServers].sort((a, b) => (a.responseTime || 999) - (b.responseTime || 999));
            selectedUrl = `${sorted[0].url}/api`;
            break;
          }
          case 'cpu-adaptive': {
            const threshold = currentConfig.cpuThreshold || 80;
            const underLoaded = activeServers.filter(s => (s.cpuUsage || 0) < threshold);
            if (underLoaded.length > 0) {
              const sortedByCpu = [...underLoaded].sort((a, b) => (a.cpuUsage || 0) - (b.cpuUsage || 0));
              selectedUrl = `${sortedByCpu[0].url}/api`;
            } else {
              const sortedAll = [...activeServers].sort((a, b) => (a.cpuUsage || 0) - (b.cpuUsage || 0));
              selectedUrl = `${sortedAll[0].url}/api`;
            }
            break;
          }
          case 'round-robin': {
            const selected = activeServers[rrIndex % activeServers.length];
            rrIndex = (rrIndex + 1) % activeServers.length;
            selectedUrl = `${selected.url}/api`;
            break;
          }
          case 'failover':
          default: {
            const primaryServer = getPrimaryEnvServer();
            const primaryOnline = activeServers.find(s => s.url === primaryServer.url && s.status !== 'offline');
            if (primaryOnline) {
              selectedUrl = `${primaryOnline.url}/api`;
            } else {
              selectedUrl = `${activeServers[0].url}/api`;
            }
            break;
          }
        }
        config.baseURL = selectedUrl;
      }

      return config;
    });

    // 2. Response Interceptor for Automatic Failover & Retry
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // If request failed due to server crash/network loss and hasn't been retried yet
        if (originalRequest && !originalRequest._retryCount) {
          originalRequest._retryCount = 1;
          
          const isNetworkOr5xxError = !error.response || (error.response.status >= 502 && error.response.status <= 504);
          
          if (isNetworkOr5xxError) {
            const currentConfig = trafficConfigRef.current;
            const currentBaseURL = originalRequest.baseURL;
            
            // Filter other healthy backup servers
            const backupServers = currentConfig.servers.filter(s => 
              s.status !== 'offline' && `${s.url}/api` !== currentBaseURL
            );
            
            if (backupServers.length > 0) {
              const fallbackServer = backupServers[0];
              originalRequest.baseURL = `${fallbackServer.url}/api`;
              console.warn(`Request failed on ${currentBaseURL}. Retrying on fallback: ${fallbackServer.name} (${fallbackServer.url})`);
              
              // Re-execute axios request with the new baseURL
              return axios(originalRequest);
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
          
          // Then fetch fresh data in background
          if (parsedUser && parsedUser._id) {
            const { data } = await axios.get('/auth/profile', {
              headers: { 'x-user-id': parsedUser._id }
            });
            setUser(data);
            localStorage.setItem('user', JSON.stringify(data));
          }
        } catch (error) {
          console.error("Error fetching fresh profile:", error);
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
  const [selectedBatchId, setSelectedBatchIdState] = useState(() => {
    return localStorage.getItem('selectedBatchId') || 'all';
  });

  const setSelectedBatchId = (batchId) => {
    setSelectedBatchIdState(batchId);
    if (batchId) {
      localStorage.setItem('selectedBatchId', batchId);
    } else {
      localStorage.removeItem('selectedBatchId');
    }
  };

  const fetchGlobalBatches = async () => {
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
        sortedBatches = Array.isArray(data) ? [...data].sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate)) : [];
      }
      setBatchesList(sortedBatches);

      const savedBatchId = localStorage.getItem('selectedBatchId');
      if (savedBatchId && (savedBatchId === 'all' || sortedBatches.some(b => b._id === savedBatchId))) {
        // Retain user's saved batch selection
      } else if (sortedBatches.length > 0) {
        // Default to the latest batch
        const latestId = sortedBatches[0]._id;
        setSelectedBatchIdState(latestId);
        localStorage.setItem('selectedBatchId', latestId);
      }
    } catch (err) {
      console.error('Error fetching global batches:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGlobalBatches();
    }
  }, [user?._id, user?.role]);

  const activeBatch = batchesList.find(b => b._id === selectedBatchId) || batchesList[0];
  const customPanelName = user?.role === 'admin' 
    ? 'SACS 3.0' 
    : (activeBatch?.panelName?.trim() || '');
  const customPanelSubheading = user?.role === 'admin' 
    ? 'Super Admin Controlling System' 
    : (activeBatch?.panelSubheading?.trim() || '');

  const logout = async () => {
    try {
      await axios.post('/auth/logout');
    } catch (e) {}
    setUser(null);
    localStorage.removeItem('user');
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
      batchesList,
      activeBatch,
      customPanelName,
      customPanelSubheading,
      fetchGlobalBatches
    }}>
      {children}
    </AuthContext.Provider>
  );
};

