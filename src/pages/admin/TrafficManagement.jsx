import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import { 
  Server, Network, Cpu, Zap, Activity, Shield, PlusCircle, 
  Trash2, RefreshCw, Check, AlertTriangle, Settings, Power, 
  Copy, CheckCircle2, Globe, Clock, Sparkles, Edit2, BookOpen, ShieldCheck,
  Cloud, ExternalLink, Calendar, Gauge, ArrowUpRight, Sliders, Info, BarChart2
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, ReferenceLine } from 'recharts';

const SERVER_PALETTE = [
  { stroke: '#10b981', fill: '#10b981' }, // Emerald
  { stroke: '#0ea5e9', fill: '#0ea5e9' }, // Sky
  { stroke: '#8b5cf6', fill: '#8b5cf6' }, // Purple
  { stroke: '#f59e0b', fill: '#f59e0b' }, // Amber
  { stroke: '#ec4899', fill: '#ec4899' }, // Pink
  { stroke: '#14b8a6', fill: '#14b8a6' }, // Teal
];

const TrafficManagement = () => {
  const { trafficConfig, refreshTrafficConfig } = useAuth();
  const [servers, setServers] = useState([]);
  const [policy, setPolicy] = useState('failover');
  const [cpuThreshold, setCpuThreshold] = useState(80);
  const [manualSelectedServerId, setManualSelectedServerId] = useState('');
  const [pingIntervalSeconds, setPingIntervalSeconds] = useState(60);
  const [requestsPerPing, setRequestsPerPing] = useState(1);
  
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTestingBrowserPing, setIsTestingBrowserPing] = useState(false);

  // Lifecycle refs to prevent leaks and duplicate polling after unmount
  const isMountedRef = useRef(true);
  const initialScanDoneRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // New server modal/form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerActive, setNewServerActive] = useState(true);
  const [isAddingServer, setIsAddingServer] = useState(false);

  // Edit server modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [editServerName, setEditServerName] = useState('');
  const [editServerUrl, setEditServerUrl] = useState('');
  const [isUpdatingServer, setIsUpdatingServer] = useState(false);

  // Hosting Usage & Free Limits state
  const [renderUsage, setRenderUsage] = useState(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(false);
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false);
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [isSavingUsage, setIsSavingUsage] = useState(false);

  // Manual form values for hosting usage
  const [editAllowanceHours, setEditAllowanceHours] = useState(750);
  const [editConsumedHours, setEditConsumedHours] = useState(615);
  const [editBandwidthLimit, setEditBandwidthLimit] = useState(100);
  const [editBandwidthConsumed, setEditBandwidthConsumed] = useState(14.2);
  const [editBuildLimit, setEditBuildLimit] = useState(500);
  const [editBuildConsumed, setEditBuildConsumed] = useState(68);
  const [editThreshold70, setEditThreshold70] = useState(70);
  const [editThreshold85, setEditThreshold85] = useState(85);
  const [editThreshold95, setEditThreshold95] = useState(95);

  // Browser latency stats
  const [browserLatencies, setBrowserLatencies] = useState({});

  // Live time-series telemetry data buffer (last 20 time snapshots)
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  const recordTelemetrySnapshot = (currentServers, latOverrides = {}) => {
    if (!currentServers || currentServers.length === 0) return;
    const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const newPoint = { time: timeLabel };

    currentServers.forEach(s => {
      const bLat = latOverrides[s._id] !== undefined ? latOverrides[s._id] : browserLatencies[s._id];
      const isOnline = s.isActive && (s.status === 'online' || typeof bLat === 'number') && !s.isStale;
      const effectiveLat = (s.status === 'online' && s.responseTime > 0)
        ? s.responseTime
        : (typeof bLat === 'number' ? bLat : (s.responseTime || 0));

      newPoint[`${s.name}_cpu`] = isOnline && typeof s.cpuUsage === 'number' ? s.cpuUsage : null;
      newPoint[`${s.name}_mem`] = isOnline && typeof s.memoryUsage === 'number' ? s.memoryUsage : null;
      newPoint[`${s.name}_lat`] = isOnline ? effectiveLat : 0;
      newPoint[`${s.name}_speed`] = isOnline ? (s.reqPerMin || 0) : 0;
    });

    setTelemetryHistory(prev => {
      const updated = [...prev, newPoint];
      return updated.length > 20 ? updated.slice(-20) : updated;
    });
  };

  const fetchConfigAndServers = async () => {
    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    try {
      const [serversRes, configRes] = await Promise.all([
        axios.get('/traffic/servers'),
        axios.get('/traffic/config')
      ]);
      if (!isMountedRef.current) return;
      setServers(serversRes.data);
      setPolicy(configRes.data.policy);
      setCpuThreshold(configRes.data.cpuThreshold || 80);
      setManualSelectedServerId(configRes.data.manualSelectedServerId || '');
      setPingIntervalSeconds(configRes.data.pingIntervalSeconds || (configRes.data.pingIntervalMinutes ? configRes.data.pingIntervalMinutes * 60 : 60));
      setRequestsPerPing(configRes.data.requestsPerPing || 1);
      recordTelemetrySnapshot(serversRes.data);
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to load traffic config', err);
        Swal.fire({
          icon: 'error',
          title: 'Fetch Failed',
          text: err.response?.data?.message || 'Could not fetch traffic configurations.'
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  const fetchRenderUsage = async () => {
    if (!isMountedRef.current) return;
    setIsLoadingUsage(true);
    try {
      const { data } = await axios.get('/traffic/render-usage');
      if (isMountedRef.current) {
        setRenderUsage(data);
        if (data.metrics) {
          setEditAllowanceHours(data.metrics.allowanceHours);
          setEditConsumedHours(data.metrics.consumedHours);
          setEditBandwidthLimit(data.metrics.bandwidth.limitGB);
          setEditBandwidthConsumed(data.metrics.bandwidth.consumedGB);
          setEditBuildLimit(data.metrics.buildMinutes.limitMin);
          setEditBuildConsumed(data.metrics.buildMinutes.consumedMin);
          if (data.metrics.warnings?.reports?.length >= 3) {
            setEditThreshold70(data.metrics.warnings.reports[0].percent);
            setEditThreshold85(data.metrics.warnings.reports[1].percent);
            setEditThreshold95(data.metrics.warnings.reports[2].percent);
          }
        }
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('Failed to load hosting usage data', err);
      }
    } finally {
      if (isMountedRef.current) setIsLoadingUsage(false);
    }
  };

  const handleRefreshUsage = async () => {
    if (!isMountedRef.current || isRefreshingUsage) return;
    setIsRefreshingUsage(true);
    try {
      const { data } = await axios.post('/traffic/render-usage/refresh');
      if (isMountedRef.current) {
        setRenderUsage(data);
        Swal.fire({
          icon: 'success',
          title: 'Hosting Usage Refreshed',
          text: 'Usage metrics and services have been updated.',
          timer: 1500,
          showConfirmButton: false
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Refresh Failed',
        text: err.response?.data?.message || 'Could not refresh Render usage.'
      });
    } finally {
      if (isMountedRef.current) setIsRefreshingUsage(false);
    }
  };

  const handleSaveUsage = async (e) => {
    e.preventDefault();
    setIsSavingUsage(true);
    try {
      const payload = {
        workspaceAllowanceHours: Number(editAllowanceHours),
        consumedHours: Number(editConsumedHours),
        bandwidthLimitGB: Number(editBandwidthLimit),
        bandwidthConsumedGB: Number(editBandwidthConsumed),
        buildMinutesLimit: Number(editBuildLimit),
        buildMinutesConsumed: Number(editBuildConsumed),
        warningThresholds: [Number(editThreshold70), Number(editThreshold85), Number(editThreshold95)]
      };
      const { data } = await axios.post('/traffic/render-usage', payload);
      setRenderUsage(data);
      setShowUsageModal(false);
      Swal.fire({
        icon: 'success',
        title: 'Usage Updated',
        text: 'Render hosting usage and free limits updated successfully.',
        timer: 1600,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err.response?.data?.message || 'Failed to update usage metrics.'
      });
    } finally {
      setIsSavingUsage(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchConfigAndServers(),
        fetchRenderUsage()
      ]);
    };
    init();

    const intervalMs = Math.max(5000, (pingIntervalSeconds || 60) * 1000);
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      axios.get('/traffic/servers').then(res => {
        if (isMountedRef.current) {
          setServers(res.data);
          recordTelemetrySnapshot(res.data);
        }
      }).catch(err => {
        if (isMountedRef.current) console.error('Traffic poll error', err);
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [pingIntervalSeconds]);

  // Initial scan for nodes on mount
  useEffect(() => {
    if (servers.length > 0 && !initialScanDoneRef.current) {
      initialScanDoneRef.current = true;
      handleBackendPing(true);
      handleBrowserPing();
    }
  }, [servers]);

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await axios.post('/traffic/config', {
        policy,
        cpuThreshold,
        manualSelectedServerId: policy === 'manual' ? manualSelectedServerId : null,
        pingIntervalSeconds: Number(pingIntervalSeconds),
        requestsPerPing: Number(requestsPerPing)
      });
      await refreshTrafficConfig();
      await fetchConfigAndServers();
      Swal.fire({
        icon: 'success',
        title: 'Configuration Saved',
        text: `Traffic policy updated. Health pings set to every ${pingIntervalSeconds} seconds (${requestsPerPing} req/cycle).`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err.response?.data?.message || 'Failed to update traffic configuration.'
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleServer = async (server) => {
    if (server.isPrimary && server.isActive) {
      Swal.fire({
        icon: 'warning',
        title: 'Action Denied',
        text: 'The primary backend server node cannot be deactivated.'
      });
      return;
    }
    
    try {
      const updatedIsActive = !server.isActive;
      await axios.put(`/traffic/servers/${server._id}`, {
        isActive: updatedIsActive
      });
      setServers(prev => {
        const next = prev.map(s => s._id === server._id ? { 
          ...s, 
          isActive: updatedIsActive, 
          status: updatedIsActive ? s.status : 'offline',
          responseTime: updatedIsActive ? s.responseTime : 0,
          cpuUsage: updatedIsActive ? s.cpuUsage : 0,
          memoryUsage: updatedIsActive ? s.memoryUsage : 0,
          reqPerMin: updatedIsActive ? s.reqPerMin : 0,
          requestCount: updatedIsActive ? s.requestCount : 0
        } : s);
        recordTelemetrySnapshot(next);
        return next;
      });
      await refreshTrafficConfig();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Toggle Failed',
        text: err.response?.data?.message || 'Failed to update server status.'
      });
    }
  };

  const handleSetPrimaryServer = async (server) => {
    if (server.isPrimary) return;
    try {
      const { data } = await axios.put(`/traffic/servers/${server._id}/set-primary`);
      setServers(data);
      await refreshTrafficConfig();
      Swal.fire({
        icon: 'success',
        title: 'Primary Node Updated',
        text: `"${server.name}" is now designated as the primary backend server node.`,
        timer: 1800,
        showConfirmButton: false
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err.response?.data?.message || 'Failed to designate primary server node.'
      });
    }
  };

  const handleDeleteServer = async (server) => {
    if (server.isPrimary) {
      Swal.fire({
        icon: 'warning',
        title: 'Action Denied',
        text: 'The primary backend server node cannot be deleted.'
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Are you sure?',
      text: `This will remove the backend server link "${server.name}" from rotation.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#3b82f6'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/traffic/servers/${server._id}`);
        setServers(prev => prev.filter(s => s._id !== server._id));
        await refreshTrafficConfig();
        Swal.fire('Deleted!', 'Server link has been removed.', 'success');
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to delete server.', 'error');
      }
    }
  };

  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerUrl.trim()) {
      Swal.fire('Validation Error', 'Please fill in all fields.', 'warning');
      return;
    }

    setIsAddingServer(true);
    try {
      const { data } = await axios.post('/traffic/servers', {
        name: newServerName,
        url: newServerUrl,
        isActive: newServerActive
      });
      setServers(prev => [...prev, data]);
      setShowAddModal(false);
      setNewServerName('');
      setNewServerUrl('');
      await refreshTrafficConfig();
      Swal.fire('Success', 'Backend server node added to traffic manager.', 'success');
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to register server.', 'error');
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleOpenEditModal = (server) => {
    setEditingServer(server);
    setEditServerName(server.name || '');
    setEditServerUrl(server.url || '');
    setShowEditModal(true);
  };

  const handleUpdateServer = async (e) => {
    e.preventDefault();
    if (!editServerName.trim() || !editServerUrl.trim()) {
      Swal.fire('Validation Error', 'Please fill in all required fields.', 'warning');
      return;
    }

    setIsUpdatingServer(true);
    try {
      const { data } = await axios.put(`/traffic/servers/${editingServer._id}`, {
        name: editServerName,
        url: editServerUrl
      });

      setServers(prev => prev.map(s => s._id === data._id ? data : s));
      setShowEditModal(false);
      setEditingServer(null);
      await refreshTrafficConfig();
      Swal.fire('Updated', 'Backend server URL details updated successfully.', 'success');
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update server details.', 'error');
    } finally {
      setIsUpdatingServer(false);
    }
  };

  // Run backend-based ping check
  const handleBackendPing = async (silent = false) => {
    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    try {
      const { data } = await axios.post('/traffic/ping');
      if (!isMountedRef.current) return;
      setServers(prev => {
        const next = prev.map(s => {
          const pingResult = data.find(p => p.id === s._id || p._id === s._id || p.url === s.url);
          if (pingResult) {
            return { 
              ...s, 
              status: pingResult.status, 
              responseTime: pingResult.responseTime,
              avgProcessingLatencyMs: pingResult.avgProcessingLatencyMs,
              cpuUsage: pingResult.cpuUsage,
              memoryUsage: pingResult.memoryUsage,
              lastHealthCheck: pingResult.lastHealthCheck,
              isStale: false
            };
          }
          return s;
        });
        recordTelemetrySnapshot(next);
        return next;
      });
      await refreshTrafficConfig();
      if (!silent && isMountedRef.current) {
        const resultsHtml = data.map(p => 
          `<div class="flex justify-between items-center py-1.5 border-b border-slate-200 dark:border-slate-700/50">
            <span class="font-bold text-slate-800 dark:text-slate-200">${p.name}</span>
            <span class="${p.status === 'online' ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' : 'text-rose-500 font-extrabold'}">${p.status.toUpperCase()} (${p.responseTime}ms)</span>
          </div>`
        ).join('');

        Swal.fire({
          icon: 'success',
          title: 'Node Health Scan Complete',
          html: `<div class="mt-2 text-left text-xs font-mono space-y-1">${resultsHtml}</div>`,
          confirmButtonColor: '#10b981'
        });
      }
    } catch (err) {
      console.error('Backend ping failed:', err);
      if (!silent && isMountedRef.current) {
        Swal.fire({
          icon: 'error',
          title: 'Scan Failed',
          text: err.response?.data?.message || 'Could not complete backend health scan.'
        });
      }
    } finally {
      if (isMountedRef.current) {
        setIsRefreshing(false);
      }
    }
  };

  // Run browser-based ping check
  const handleBrowserPing = async () => {
    if (isTestingBrowserPing || !isMountedRef.current) return;
    setIsTestingBrowserPing(true);
    const activeServers = servers.filter(s => s.isActive);
    const results = { ...browserLatencies };

    for (const server of activeServers) {
      if (!isMountedRef.current) break;
      results[server._id] = 'checking';
      setBrowserLatencies({ ...results });
      
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout
        
        // Probe verified public endpoint directly for clean 200 response
        const cleanUrl = server.url.trim().replace(/\/+$/, '');
        const res = await fetch(`${cleanUrl}/api/traffic/public-config`, { 
          method: 'GET',
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-store'
        }).catch(() => null);
        clearTimeout(timeoutId);
        
        if (res && res.ok) {
          const latency = Date.now() - start;
          results[server._id] = latency;
        } else {
          results[server._id] = 'offline';
        }
      } catch (err) {
        results[server._id] = 'offline';
      }
      if (isMountedRef.current) {
        setBrowserLatencies({ ...results });
      }
    }
    if (isMountedRef.current) {
      setIsTestingBrowserPing(false);
      recordTelemetrySnapshot(servers, results);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      icon: 'success',
      title: 'Copied',
      text: 'Server URL copied to clipboard',
      timer: 1000,
      showConfirmButton: false
    });
  };

  // Helper stats calculation (Ignore deactivated/off servers turned off to save resources)
  const activeServers = servers.filter(s => s.isActive);
  const activeCount = activeServers.length;
  const onlineCount = activeServers.filter(s => s.status === 'online').length;
  const offlineCount = activeServers.filter(s => s.status === 'offline').length;
  const standbyCount = servers.filter(s => !s.isActive).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
              <Network size={24} />
            </span>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white">Traffic Control Panel</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm max-w-2xl">
            Register multiple backend nodes to implement high-availability clusters. Manage request distribution policies and test latency metrics directly.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleBrowserPing} 
            disabled={isTestingBrowserPing || activeCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white border border-sky-500/20 rounded-xl transition-all font-semibold disabled:opacity-50 text-sm cursor-pointer"
          >
            <Clock size={16} className={isTestingBrowserPing ? 'animate-spin' : ''} />
            Browser Latency Check
          </button>
          <button 
            onClick={handleBackendPing} 
            disabled={isRefreshing || activeCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl transition-all font-semibold disabled:opacity-50 text-sm cursor-pointer"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Scan Node Health
          </button>
          <button 
            onClick={() => setShowAddModal(true)} 
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 transition-all font-semibold text-sm cursor-pointer"
          >
            <PlusCircle size={16} />
            Add Server URL
          </button>
        </div>
      </div>

      {/* Grid of status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all text-emerald-500">
            <Server size={64} />
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Total Nodes</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-slate-800 dark:text-white">{servers.length}</span>
            <span className="text-slate-500 text-xs">{activeCount} active in rotation {standbyCount > 0 ? `(${standbyCount} standby)` : ''}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all text-emerald-400">
            <Activity size={64} />
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Online Nodes</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-500">{onlineCount}</span>
            <span className="text-slate-500 text-xs">responding successfully</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all text-rose-500">
            <AlertTriangle size={64} />
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Offline Nodes</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-rose-600 dark:text-rose-500">{offlineCount}</span>
            <span className="text-slate-500 text-xs">{offlineCount > 0 ? 'failed status scan' : 'all active nodes healthy'}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-all text-violet-500">
            <Shield size={64} />
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Cluster Health</h3>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-black ${onlineCount === activeCount && activeCount > 0 ? 'text-emerald-600 dark:text-emerald-500' : onlineCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-rose-600 dark:text-rose-500'}`}>
              {onlineCount === activeCount && activeCount > 0 ? 'Optimal' : onlineCount > 0 ? 'Degraded' : 'Critical'}
            </span>
          </div>
        </div>
      </div>

      {/* Live Node Traffic Monitor */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/50 pb-4">
          <div className="flex items-center gap-2">
            <Zap className="text-amber-500 animate-bounce" size={20} />
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">Live Node Traffic Distribution</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Current API request load allocation across backend cluster nodes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Active Policy:</span>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-black uppercase">
              {policy === 'failover' ? 'Active-Backup Failover' : policy === 'round-robin' ? 'Round-Robin Rotation' : policy === 'latency' ? 'Latency-Optimized' : 'Static Node Assign'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {servers.map((s) => {
            let loadPercent = 0;
            if (s.isActive && s.status !== 'offline') {
              if (policy === 'failover') {
                const primaryOnline = servers.find(srv => srv.isPrimary && srv.isActive && srv.status !== 'offline');
                if (primaryOnline) {
                  loadPercent = s._id === primaryOnline._id ? 100 : 0;
                } else {
                  const firstOnline = servers.find(srv => srv.isActive && srv.status !== 'offline');
                  loadPercent = (firstOnline && s._id === firstOnline._id) ? 100 : 0;
                }
              } else if (policy === 'round-robin') {
                const activeCount = servers.filter(srv => srv.isActive && srv.status !== 'offline').length;
                loadPercent = activeCount > 0 ? Math.round(100 / activeCount) : 0;
              } else if (policy === 'latency') {
                const activeOnline = servers.filter(srv => srv.isActive && srv.status !== 'offline');
                const lowest = [...activeOnline].sort((a, b) => (a.responseTime || 999) - (b.responseTime || 999))[0];
                loadPercent = (lowest && s._id === lowest._id) ? 100 : 0;
              } else if (policy === 'manual') {
                loadPercent = s._id === manualSelectedServerId ? 100 : 0;
              } else if (policy === 'cpu-adaptive') {
                const activeOnline = servers.filter(srv => srv.isActive && srv.status !== 'offline');
                const lowestCpu = [...activeOnline].sort((a, b) => ((a.cpuUsage != null ? a.cpuUsage : 999) - (b.cpuUsage != null ? b.cpuUsage : 999)))[0];
                loadPercent = (lowestCpu && s._id === lowestCpu._id) ? 100 : 0;
              }
            }

            return (
              <div key={s._id} className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{s.name}</span>
                  <div className="flex items-center gap-1.5">
                    {s.status === 'online' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    )}
                    <span className="font-black text-amber-500">{loadPercent}% Target Share</span>
                  </div>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${loadPercent}%` }} 
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  <span>Student Speed: <strong className="text-amber-600 dark:text-amber-400 font-bold">{s.reqPerMin || 0} req/min</strong></span>
                  <span>App Requests: <strong className="text-sky-600 dark:text-sky-400 font-bold">{s.requestCount || 0} reqs</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Graphical Telemetry Charts Dashboard */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <Activity className="text-emerald-500 animate-pulse" size={22} />
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">Graphical Cluster Load & Speed Telemetry</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">1-minute interval time-series graphing: CPU, latency (ms), and student request speed (req/min)</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 bg-sky-500/10 text-sky-500 border border-sky-500/20 rounded-lg font-bold flex items-center gap-1.5">
              <Clock size={13} />
              1 Min Request Frequency
            </span>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg font-bold">
              Auto-Scale: {cpuThreshold}% CPU
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Live CPU Load % Over Time */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-inner">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><Cpu size={14} className="text-emerald-500" /> Live CPU Load (%) (1-Min Axis)</span>
              <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Real-time Sampling</span>
            </div>
            <div className="h-60 w-full flex items-center justify-center">
              {telemetryHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Cpu size={28} className="opacity-40 animate-pulse text-emerald-500" />
                  <span className="text-xs font-medium">Collecting live node telemetry snapshots...</span>
                </div>
              ) : !telemetryHistory.some(pt => servers.some(s => typeof pt[`${s.name}_cpu`] === 'number' && pt[`${s.name}_cpu`] > 0)) ? (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-2 p-6 text-center">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
                    <Cpu size={24} />
                  </div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Cluster Nodes Active & Healthy</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                    All {activeCount} nodes are online and routing requests. CPU load graphs display dynamically when host nodes export system metrics.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={telemetryHistory}>
                    <defs>
                      {servers.map((s, idx) => {
                        const color = SERVER_PALETTE[idx % SERVER_PALETTE.length].stroke;
                        return (
                          <linearGradient key={`grad_${s._id}`} id={`cpuGrad_${s._id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={color} stopOpacity={0}/>
                          </linearGradient>
                        );
                      })}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} unit="%" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#f8fafc' }}
                      formatter={(value, name) => [value != null ? `${value}%` : 'N/A', name]}
                    />
                    <ReferenceLine y={cpuThreshold} label={{ value: `Threshold ${cpuThreshold}%`, fill: '#f59e0b', fontSize: 10, position: 'top' }} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} />
                    {servers.map((s, idx) => {
                      const color = SERVER_PALETTE[idx % SERVER_PALETTE.length].stroke;
                      return (
                        <Area 
                          key={s._id} 
                          type="monotone" 
                          dataKey={`${s.name}_cpu`} 
                          name={`${s.name} CPU %`} 
                          stroke={color} 
                          strokeWidth={2} 
                          connectNulls
                          fillOpacity={1} 
                          fill={`url(#cpuGrad_${s._id})`} 
                        />
                      );
                    })}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Chart 2: Latency (ms) & Request Speed (req/min) Over Time */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-inner">
            <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-300">
              <span className="flex items-center gap-1.5"><Network size={14} className="text-sky-500" /> Probe Latency (ms) & Student Speed (req/min)</span>
              <span className="text-[10px] text-sky-400 font-mono flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-ping" /> Dual-Axis Graph</span>
            </div>
            <div className="h-60 w-full flex items-center justify-center">
              {telemetryHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Network size={28} className="opacity-40 animate-pulse text-sky-500" />
                  <span className="text-xs font-medium">Collecting live latency and speed data...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={telemetryHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                    {/* Left YAxis: Probe Latency in ms */}
                    <YAxis yAxisId="left" stroke="#38bdf8" fontSize={10} unit="ms" />
                    {/* Right YAxis: Request Speed in req/min */}
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} unit=" rpm" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    {servers.map((s, idx) => {
                      const color = SERVER_PALETTE[idx % SERVER_PALETTE.length].stroke;
                      return (
                        <Line 
                          key={`${s._id}_lat`} 
                          yAxisId="left"
                          type="monotone" 
                          dataKey={`${s.name}_lat`} 
                          name={`${s.name} Latency (ms)`} 
                          stroke={color} 
                          strokeWidth={2.5} 
                          dot={{ r: 3, fill: color }} 
                          connectNulls
                        />
                      );
                    })}
                    {servers.map((s, idx) => {
                      const color = SERVER_PALETTE[idx % SERVER_PALETTE.length].stroke;
                      return (
                        <Line 
                          key={`${s._id}_speed`} 
                          yAxisId="right"
                          type="monotone" 
                          dataKey={`${s.name}_speed`} 
                          name={`${s.name} Speed (req/min)`} 
                          stroke={color} 
                          strokeWidth={1.5} 
                          strokeDasharray="4 4"
                          dot={{ r: 2, fill: color }} 
                          connectNulls
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Hosting Usage & Free Limits Monitor */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 to-sky-500/20 border border-indigo-500/30 rounded-2xl text-indigo-400">
              <Cloud size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Hosting Usage & Free Limits</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  renderUsage?.metrics?.warnings?.alertLevel === 'critical' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                  renderUsage?.metrics?.warnings?.alertLevel === 'high' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                  renderUsage?.metrics?.warnings?.alertLevel === 'warning' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {renderUsage?.metrics?.warnings?.alertStatusText || 'Free Plan Allowance'}
                </span>
                {renderUsage?.metrics?.audit?.isStale && (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md text-[10px] font-bold">
                    Stale (&gt;48h)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Workspace pooled free instance hours, outbound bandwidth, build minutes & reset calendar cycle
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href={renderUsage?.billingDashboardUrl || 'https://dashboard.render.com/billing'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="Open Render Billing Dashboard in new tab"
            >
              <ExternalLink size={14} className="text-indigo-400" />
              Render Billing Dashboard
            </a>

            <button
              onClick={() => setShowUsageModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Edit2 size={14} />
              Update Usage Data
            </button>

            <button
              onClick={handleRefreshUsage}
              disabled={isRefreshingUsage}
              className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
              title="Refresh Hosting Usage"
            >
              <RefreshCw size={15} className={isRefreshingUsage ? 'animate-spin text-indigo-400' : ''} />
            </button>
          </div>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Free Instance Hours */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 relative overflow-hidden shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge size={14} className="text-indigo-500" />
                Free Instance Hours
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Workspace Pool
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {renderUsage?.metrics?.consumedHours ?? 615} <span className="text-xs font-normal text-slate-400">/ {renderUsage?.metrics?.allowanceHours ?? 750} hrs</span>
                </div>
                <div className="text-xs font-extrabold text-emerald-500 dark:text-emerald-400 mt-0.5">
                  {renderUsage?.metrics?.remainingHours ?? 135} hrs remaining
                </div>
              </div>
              <div className="text-right">
                <span className={`text-lg font-black ${
                  (renderUsage?.metrics?.usagePercent ?? 82) >= 95 ? 'text-rose-500' :
                  (renderUsage?.metrics?.usagePercent ?? 82) >= 85 ? 'text-amber-500' :
                  (renderUsage?.metrics?.usagePercent ?? 82) >= 70 ? 'text-sky-400' :
                  'text-emerald-500'
                }`}>
                  {renderUsage?.metrics?.usagePercent ?? 82.0}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (renderUsage?.metrics?.usagePercent ?? 82) >= 95 ? 'bg-gradient-to-r from-amber-500 to-rose-500' :
                  (renderUsage?.metrics?.usagePercent ?? 82) >= 85 ? 'bg-gradient-to-r from-sky-500 to-amber-500' :
                  'bg-gradient-to-r from-emerald-500 to-sky-500'
                }`}
                style={{ width: `${Math.min(100, renderUsage?.metrics?.usagePercent ?? 82)}%` }}
              />
            </div>

            <p className="text-[10px] text-slate-400 leading-tight">
              Shared across all concurrent active web services & background workers.
            </p>
          </div>

          {/* Card 2: Period & Reset Cycle */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-sky-500" />
                Cycle & Reset Date
              </span>
              <span className="text-[10px] font-bold text-sky-400 font-mono">
                {renderUsage?.metrics?.period?.daysRemaining ?? 2} days left
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-400">Next Reset:</div>
              <div className="text-sm font-black text-slate-800 dark:text-white">
                {renderUsage?.metrics?.period?.nextReset 
                  ? new Date(renderUsage.metrics.period.nextReset).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' (00:00 UTC)'
                  : '1st of Next Month (00:00 UTC)'}
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Cycle: {renderUsage?.metrics?.period?.currentDayOfMonth ?? 29} of {renderUsage?.metrics?.period?.totalDaysInMonth ?? 31} days elapsed
              </div>
            </div>

            <div className="pt-1 border-t border-slate-200 dark:border-slate-800/80 flex justify-between items-center text-[10px]">
              <span className="text-slate-400">Burn Rate:</span>
              <span className="font-bold font-mono text-slate-300">~{renderUsage?.metrics?.hourlyBurnRate ? Number(renderUsage.metrics.hourlyBurnRate * 24).toFixed(1) : '20.5'} hrs/day</span>
            </div>
          </div>

          {/* Card 3: Bandwidth & Build Pipeline */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              Bandwidth & Builds
            </span>

            {/* Bandwidth bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-400">Outbound Bandwidth:</span>
                <span className="text-slate-200 font-mono">
                  {renderUsage?.metrics?.bandwidth?.consumedGB ?? 14.2} / {renderUsage?.metrics?.bandwidth?.limitGB ?? 100} GB
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, renderUsage?.metrics?.bandwidth?.percent ?? 14.2)}%` }} 
                />
              </div>
            </div>

            {/* Build pipeline bar */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-400">Build Minutes:</span>
                <span className="text-slate-200 font-mono">
                  {renderUsage?.metrics?.buildMinutes?.consumedMin ?? 68} / {renderUsage?.metrics?.buildMinutes?.limitMin ?? 500} min
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-sky-500 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, renderUsage?.metrics?.buildMinutes?.percent ?? 13.6)}%` }} 
                />
              </div>
            </div>

            <div className="text-[9px] text-slate-500 font-mono pt-1">
              Quota resets monthly on 1st of each calendar month.
            </div>
          </div>

          {/* Card 4: Configurable Warning Thresholds */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 shadow-sm">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-rose-500" />
              Threshold Alerts
            </span>

            <div className="space-y-1.5">
              {(renderUsage?.metrics?.warnings?.reports || [
                { percent: 70, triggerHours: 525, isTriggered: true, status: 'TRIGGERED' },
                { percent: 85, triggerHours: 638, isTriggered: false, hoursRemainingAtThreshold: 23, status: 'OK' },
                { percent: 95, triggerHours: 713, isTriggered: false, hoursRemainingAtThreshold: 98, status: 'OK' }
              ]).map((rep) => (
                <div key={rep.percent} className="flex justify-between items-center text-xs py-1 px-2 rounded-lg bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/60">
                  <span className="font-bold text-slate-300">{rep.percent}% ({rep.triggerHours}h)</span>
                  <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded ${
                    rep.isTriggered ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {rep.isTriggered ? 'Triggered' : `${rep.hoursRemainingAtThreshold}h left`}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[9px] text-slate-400">
              Last updated: {renderUsage?.metrics?.audit?.lastManualUpdate ? new Date(renderUsage.metrics.audit.lastManualUpdate).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Initial Seed'}
            </div>
          </div>
        </div>

        {/* Per-Service Render Directory */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Server size={15} className="text-indigo-400" />
                Render Services in Workspace
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Individual services share the workspace pool of 750 free instance hours. Activity from each active service consumes from the common allocation.
              </p>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Mode: <span className="text-indigo-400 font-bold">{renderUsage?.hasApiKey ? 'Live Render API Sync' : 'Manual Billing Sync'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Show real Render services if API key present, or fallback to registered SSMS cluster services */}
            {(renderUsage?.renderServices && renderUsage.renderServices.length > 0 ? renderUsage.renderServices : servers).map((srv, idx) => (
              <div key={srv.id || srv._id || idx} className="bg-slate-50 dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 shadow-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                    {srv.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {srv.plan || 'Free'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                  <span>Type: {srv.type || 'Web Service'}</span>
                  <span className="text-emerald-400 capitalize">{srv.status || 'Active'}</span>
                </div>
                <div className="text-[9px] text-slate-500 truncate font-mono">
                  {srv.url || srv.repo || 'Deployed on Render'}
                </div>
              </div>
            ))}
          </div>

          {/* Disclaimer & Explanation banner */}
          <div className="p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
            <Info size={16} className="text-indigo-400 mt-0.5 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-slate-800 dark:text-slate-200">How Render Free Tier Works:</strong> Render provides a shared pool of 750 free instance hours per calendar month across all free web services in your workspace. Free instance hours do not subtract per-service; running 2 free web services simultaneously consumes 2 instance hours per clock hour. When hours are depleted, all free web services spin down until the 1st of next month.
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Config Panel */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
            <Settings className="text-emerald-500" size={20} />
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Routing Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Load Balancing Policy</label>
              <div className="grid grid-cols-1 gap-2 mt-2">
                {[
                  { id: 'failover', title: 'Active-Backup Failover', desc: 'Directs all traffic to the primary server; fallbacks to secondary backup servers if offline.' },
                  { id: 'cpu-adaptive', title: 'Dynamic CPU Load Balancer (Auto-Scale)', desc: 'Automatically shifts API traffic to lower-loaded nodes when a server CPU exceeds configured threshold %.' },
                  { id: 'round-robin', title: 'Round-Robin Rotation', desc: 'Distributes incoming API requests uniformly across all active nodes.' },
                  { id: 'latency', title: 'Latency-Optimized', desc: 'Routes requests to the node with the lowest connection response time.' },
                  { id: 'manual', title: 'Static Node Assign', desc: 'Manually pin all requests to a selected server node.' }
                ].map(opt => (
                  <div 
                    key={opt.id}
                    onClick={() => setPolicy(opt.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${policy === opt.id ? 'bg-emerald-500/10 border-emerald-500/40 shadow-md shadow-emerald-500/5' : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200/5 hover:border-slate-200/10 dark:border-slate-800 dark:hover:border-slate-700'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 dark:text-white text-sm">{opt.title}</span>
                      {policy === opt.id && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{opt.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {policy === 'cpu-adaptive' && (
              <div className="pt-2 animate-fadeIn space-y-2 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5"><Cpu size={14} className="text-amber-500" /> Max CPU Threshold %</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 rounded font-black text-xs">{cpuThreshold}%</span>
                </div>
                <input 
                  type="range" 
                  min="40" 
                  max="95" 
                  step="5" 
                  value={cpuThreshold} 
                  onChange={e => setCpuThreshold(Number(e.target.value))} 
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  If a node CPU exceeds <strong>{cpuThreshold}%</strong>, API traffic automatically shifts to the lowest-CPU node in the cluster.
                </p>
              </div>
            )}

            {policy === 'manual' && (
              <div className="pt-2 animate-fadeIn">
                <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider block">Assign Active Server</label>
                <select 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 transition-all mt-2"
                  value={manualSelectedServerId}
                  onChange={e => setManualSelectedServerId(e.target.value)}
                >
                  <option value="">Select a server node...</option>
                  {servers.filter(s => s.isActive).map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.url})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Server Keep-Alive & Ping Frequency Settings */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <label className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider block">
                Server Keep-Alive & Latency Ping
              </label>
              
              <div className="space-y-3.5 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-sky-500" /> Ping Frequency (Seconds)</span>
                    <span className="text-[10px] text-sky-400 font-mono font-extrabold">{pingIntervalSeconds} sec ({Math.round(pingIntervalSeconds / 60 * 10) / 10} min)</span>
                  </span>

                  {/* Input number box for seconds */}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="5"
                      max="3600"
                      value={pingIntervalSeconds}
                      onChange={e => setPingIntervalSeconds(Math.max(5, Number(e.target.value) || 5))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-extrabold text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 shadow-sm"
                      placeholder="Enter seconds (e.g. 30, 60, 300)"
                    />
                    <span className="px-3 py-2 bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl flex items-center">
                      Sec
                    </span>
                  </div>

                  {/* Preset Quick Seconds Buttons */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { sec: 10, label: '10s' },
                      { sec: 30, label: '30s' },
                      { sec: 60, label: '60s (1m)' },
                      { sec: 300, label: '300s (5m ★ Best)' },
                      { sec: 600, label: '600s (10m)' }
                    ].map(item => (
                      <button
                        key={item.sec}
                        type="button"
                        onClick={() => setPingIntervalSeconds(item.sec)}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                          pingIntervalSeconds === item.sec
                            ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500" /> Requests per Cycle (Keep Server Awake)
                  </span>
                  <select
                    value={requestsPerPing}
                    onChange={e => setRequestsPerPing(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500"
                  >
                    <option value={1}>1 Request per cycle</option>
                    <option value={2}>2 Requests per cycle</option>
                    <option value={3}>3 Requests per cycle</option>
                    <option value={5}>5 Requests per cycle</option>
                    <option value={10}>10 Requests per cycle</option>
                  </select>
                </div>

                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Sends health check HTTP requests every <strong>{pingIntervalSeconds} sec</strong> ({requestsPerPing} req/cycle) to measure latency and keep free cloud backend nodes awake.
                </p>
              </div>
            </div>

            <button 
              onClick={handleSaveConfig}
              disabled={isSavingConfig || (policy === 'manual' && !manualSelectedServerId)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/10 cursor-pointer"
            >
              {isSavingConfig ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} />}
              Apply Routing Rules
            </button>
          </div>
        </div>

        {/* Right Column: Servers List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <Server className="text-emerald-500" size={20} />
                <h2 className="text-xl font-bold text-slate-800 dark:text-white">Backend Cluster Nodes</h2>
              </div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                {servers.length} Registered
              </span>
            </div>

            {servers.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <div className="flex justify-center text-slate-600">
                  <Server size={48} />
                </div>
                <h4 className="text-slate-500 dark:text-slate-400 font-bold">No Backend Nodes Registered</h4>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">Add secondary backend server links to construct a load balanced network.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {servers.map(server => {
                  const browserLatency = browserLatencies[server._id];
                  
                  return (
                    <div 
                      key={server._id} 
                      className={`p-5 rounded-2xl border transition-all relative overflow-hidden ${
                        !server.isActive 
                          ? 'bg-slate-100 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60' 
                          : server.status === 'online' 
                            ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 shadow-sm' 
                            : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 dark:text-white text-base">{server.name}</h4>
                            
                            {server.isPrimary && (
                              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-md flex items-center gap-1">
                                <Sparkles size={8} /> Primary Node
                              </span>
                            )}
                            
                            {!server.isActive && (
                              <span className="text-[10px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-md">
                                Offline (Bypassed)
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs">
                            <code className="bg-slate-200/60 dark:bg-slate-900 px-2.5 py-1 rounded-lg text-slate-800 dark:text-slate-200 border border-slate-300/40 dark:border-slate-800 font-mono select-all text-xs font-semibold">
                              {server.url}
                            </code>
                            <button 
                              onClick={() => copyToClipboard(server.url)} 
                              className="p-1 hover:text-emerald-500 rounded transition-all cursor-pointer" 
                              title="Copy URL"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Status & Telemetry elements */}
                        <div className="flex items-center gap-3 flex-wrap">
                          {server.isActive && (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full sm:w-auto">
                              {/* Backend health status */}
                              <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-500 uppercase font-extrabold">Node Status</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`w-2 h-2 rounded-full ${server.isStale ? 'bg-amber-500' : server.status === 'online' ? 'bg-emerald-500 animate-pulse' : server.status === 'offline' ? 'bg-rose-500' : 'bg-slate-500'}`} />
                                  <span className={`text-xs font-black capitalize ${server.isStale ? 'text-amber-500' : server.status === 'online' ? 'text-emerald-600 dark:text-emerald-400' : server.status === 'offline' ? 'text-rose-500' : 'text-slate-400'}`}>
                                    {server.isStale ? 'Stale' : server.status}
                                  </span>
                                </div>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                                  {server.lastHealthCheck ? new Date(server.lastHealthCheck).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Never'}
                                </span>
                              </div>

                              {/* Backend probe latency status */}
                              <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-500 uppercase font-extrabold">Probe Latency</span>
                                <span className={`text-xs font-black mt-0.5 ${server.responseTime < 120 && server.responseTime > 0 ? 'text-emerald-600 dark:text-emerald-400' : server.responseTime < 300 && server.responseTime > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  {server.status === 'online' ? `${server.responseTime}ms` : '---'}
                                </span>
                                {server.avgProcessingLatencyMs > 0 && (
                                  <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                                    Proc: {server.avgProcessingLatencyMs}ms
                                  </span>
                                )}
                              </div>

                              {/* Browser ping status */}
                              <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-500 uppercase font-extrabold">Browser Latency</span>
                                <span className="text-xs font-black text-sky-600 dark:text-sky-400 mt-0.5">
                                  {browserLatency === 'checking' ? (
                                    <Clock size={11} className="animate-spin text-sky-500" />
                                  ) : browserLatency === 'offline' ? (
                                    <span className="text-rose-500">Offline</span>
                                  ) : browserLatency !== undefined ? (
                                    `${browserLatency}ms`
                                  ) : (
                                    'Not Checked'
                                  )}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">Direct /ping</span>
                              </div>

                              {/* CPU Load Telemetry */}
                              <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-500 uppercase font-extrabold flex items-center gap-1"><Cpu size={10} className="text-amber-500" /> CPU Load</span>
                                <span className={`text-xs font-black mt-0.5 ${server.cpuUsage != null && server.cpuUsage >= cpuThreshold ? 'text-rose-500 animate-pulse' : server.cpuUsage != null && server.cpuUsage > 60 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                  {server.status === 'online' ? (server.cpuUsage != null ? `${server.cpuUsage}%` : 'N/A') : '---'}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                                  {server.cpuUsage != null ? 'Reported' : 'Not reported'}
                                </span>
                              </div>

                              {/* RAM Memory Telemetry */}
                              <div className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl shadow-xs">
                                <span className="text-[9px] text-slate-500 uppercase font-extrabold flex items-center gap-1"><Zap size={10} className="text-purple-500" /> RAM Memory</span>
                                <span className="text-xs font-black text-purple-600 dark:text-purple-400 mt-0.5">
                                  {server.status === 'online' ? (server.memoryUsage != null ? `${server.memoryUsage}%` : 'N/A') : '---'}
                                </span>
                                <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                                  {server.memoryUsage != null ? 'Reported' : 'Not reported'}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Action tools */}
                          <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-3">
                            <button 
                              onClick={() => handleSetPrimaryServer(server)}
                              disabled={server.isPrimary}
                              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                                server.isPrimary 
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 opacity-50 cursor-not-allowed' 
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white border-amber-500/20'
                              }`}
                              title={server.isPrimary ? 'Current Primary Node' : 'Designate as Primary Server'}
                            >
                              <Sparkles size={14} />
                            </button>
                            <button 
                              onClick={() => handleOpenEditModal(server)}
                              className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/20 rounded-xl transition-all cursor-pointer"
                              title="Edit Server Name/URL"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => handleToggleServer(server)}
                              disabled={server.isPrimary}
                              className={`p-2 rounded-xl transition-all border cursor-pointer ${
                                server.isActive 
                                  ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white border-emerald-500/20' 
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-300'
                              } disabled:opacity-40`}
                              title={server.isActive ? 'Bypass / Deactivate Server' : 'Include / Activate Server'}
                            >
                              <Power size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteServer(server)}
                              disabled={server.isPrimary}
                              className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 rounded-xl transition-all disabled:opacity-40"
                              title="Delete Server Link"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Traffic Controller Operational Guide & Documentation */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <BookOpen className="text-sky-500" size={22} />
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Traffic Controller Operational Guide & FAQ</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Complete documentation on load balancing, health probes, and offline bypass rules</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          {/* Card 1: High Availability & Offline Bypass */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
              <ShieldCheck size={18} />
              <span>Offline Node Bypass & Zero-Crash Protection</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              To guarantee zero API downtime, the SSMS Traffic Controller automatically monitors node health. If a server node goes <strong className="text-rose-500">OFFLINE</strong> (e.g. Render server sleeping or disconnected), the load balancer automatically assigns <strong className="text-amber-500">0% Traffic</strong> to it and routes 100% of requests to remaining healthy <strong className="text-emerald-500">ONLINE</strong> nodes.
            </p>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              💡 <strong>Note:</strong> To test multi-node Round-Robin or Latency split (e.g. 50%/50%), ensure both backend server nodes are online and responding to health scans!
            </div>
          </div>

          {/* Card 2: Routing Algorithms Quick Reference */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-extrabold text-sm">
              <Zap size={18} />
              <span>Routing Algorithm Modes</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <li><strong className="text-slate-800 dark:text-white">Active-Backup Failover:</strong> 100% traffic goes to Primary Node. Instant failover if Primary drops offline.</li>
              <li><strong className="text-slate-800 dark:text-white">Round-Robin Rotation:</strong> Alternates requests uniformly (50%/50%) among all online active servers.</li>
              <li><strong className="text-slate-800 dark:text-white">Latency-Optimized:</strong> Automatically routes API calls to the server with lowest latency.</li>
              <li><strong className="text-slate-800 dark:text-white">Static Node Assign:</strong> Manually pins all traffic to a specific selected server node.</li>
            </ul>
          </div>
        </div>

        {/* Step-by-Step Setup Walkthrough */}
        <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
            <Sparkles size={16} /> How to Test & Verify Multi-Node Traffic Balancing
          </h3>
          <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-medium">
            <li>Register or activate at least two healthy backend server URLs in <strong>Backend Cluster Nodes</strong>.</li>
            <li>Click <strong>Scan Node Health</strong> to verify both nodes report status as <span className="text-emerald-500 font-bold">ONLINE</span>.</li>
            <li>Under <strong>Routing Configuration</strong>, select <strong>Round-Robin Rotation</strong> or <strong>Latency-Optimized</strong>.</li>
            <li>Click <strong>Apply Routing Rules</strong>. The <strong>Live Node Traffic Distribution</strong> monitor will immediately reflect active request allocation across all online nodes.</li>
          </ol>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <PlusCircle className="text-emerald-500" size={22} />
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Register Backend Server</h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddServer} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">Server Friendly Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Render Production Server"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition-all font-medium text-sm"
                  value={newServerName}
                  onChange={e => setNewServerName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">Base HTTP URL</label>
                <input 
                  type="url" 
                  required
                  placeholder="e.g. https://ssms-be-m9us.onrender.com"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition-all font-mono text-sm"
                  value={newServerUrl}
                  onChange={e => setNewServerUrl(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">Include protocol (http/https) and port/domain. Ensure no trailing slash.</p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="active_check" 
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                  checked={newServerActive}
                  onChange={e => setNewServerActive(e.target.checked)}
                />
                <label htmlFor="active_check" className="text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer">
                  Activate server immediately (include in traffic rotation)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all font-medium text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isAddingServer}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/10 transition-all font-semibold text-sm disabled:opacity-50 cursor-pointer"
                >
                  {isAddingServer ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Edit2 className="text-indigo-400" size={22} />
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Edit Backend Node Details</h3>
              </div>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUpdateServer} className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">Server Friendly Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Primary Production Node"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-medium text-sm"
                  value={editServerName}
                  onChange={e => setEditServerName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">Base Backend HTTP URL *</label>
                <input 
                  type="url" 
                  required
                  placeholder="e.g. https://ssms-be-m9us.onrender.com"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 transition-all font-mono text-sm"
                  value={editServerUrl}
                  onChange={e => setEditServerUrl(e.target.value)}
                />
                <p className="text-[10px] text-slate-500 mt-1">Include protocol (http/https). Ensure no trailing slash.</p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all font-medium text-sm cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isUpdatingServer}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all font-semibold text-sm disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingServer ? <RefreshCw className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                  Save Node Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Update Hosting Usage & Free Limits Modal */}
      {/* ───────────────────────────────────────────────────────────── */}
      {showUsageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Cloud size={20} className="text-indigo-500" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Update Render Hosting Usage</h3>
              </div>
              <button 
                onClick={() => setShowUsageModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter the latest numbers from your{' '}
              <a 
                href={renderUsage?.billingDashboardUrl || 'https://dashboard.render.com/billing'} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-indigo-400 underline font-bold inline-flex items-center gap-0.5"
              >
                Render Billing Dashboard <ExternalLink size={11} />
              </a>
              . Metrics and remaining free hours will be recalculated instantly.
            </p>

            <form onSubmit={handleSaveUsage} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Free Allowance (hrs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editAllowanceHours}
                    onChange={(e) => setEditAllowanceHours(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400">Render standard: 750 hrs</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Consumed Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editConsumedHours}
                    onChange={(e) => setEditConsumedHours(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400">Current month consumption</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bandwidth Consumed (GB)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={editBandwidthConsumed}
                    onChange={(e) => setEditBandwidthConsumed(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Bandwidth Limit (GB)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editBandwidthLimit}
                    onChange={(e) => setEditBandwidthLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Build Minutes Consumed
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editBuildConsumed}
                    onChange={(e) => setEditBuildConsumed(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Build Minutes Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editBuildLimit}
                    onChange={(e) => setEditBuildLimit(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUsageModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUsage}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingUsage ? 'Saving...' : 'Save & Calculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficManagement;
