import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuth } from '../../context/AuthContext';
import {
  Server, Network, Cpu, Zap, Activity, PlusCircle,
  Trash2, RefreshCw, AlertTriangle, Settings, Power,
  Copy, CheckCircle2, Clock, Sparkles, Edit2,
  ExternalLink, Calendar, Sliders
} from 'lucide-react';
import {
  ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine
} from 'recharts';

const POLICY_OPTIONS = [
  { id: 'round-robin', label: 'Equal Round-Robin', desc: 'Splits traffic equally across all healthy servers and skips crashed ones.' },
  { id: 'failover', label: 'Primary + Failover', desc: 'Routes to primary server; moves to backups if primary fails.' },
  { id: 'cpu-adaptive', label: 'CPU Auto-Scale', desc: 'Routes to the healthy node with the lowest CPU load.' },
  { id: 'latency', label: 'Lowest Latency', desc: 'Routes to the healthy node with fastest response time.' },
  { id: 'manual', label: 'Manual Pin', desc: 'Pins all traffic to one selected server node.' }
];

const formatUptime = (seconds) => {
  const sec = Number(seconds || 0);
  if (sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const computeTargetShare = (server, eligibleServers, policy, manualSelectedServerId) => {
  if (!eligibleServers.some(s => s._id === server._id)) return 0;
  if (policy === 'round-robin') return Math.round(100 / eligibleServers.length);
  if (policy === 'failover') {
    const chosen = eligibleServers.find(s => s.isPrimary) || eligibleServers[0];
    return chosen && chosen._id === server._id ? 100 : 0;
  }
  if (policy === 'latency') {
    const fastest = [...eligibleServers].sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999))[0];
    return fastest && fastest._id === server._id ? 100 : 0;
  }
  if (policy === 'cpu-adaptive') {
    const lowestCpu = [...eligibleServers].sort((a, b) => ((a.cpuUsage ?? 999) - (b.cpuUsage ?? 999)))[0];
    return lowestCpu && lowestCpu._id === server._id ? 100 : 0;
  }
  if (policy === 'manual') return server._id === manualSelectedServerId ? 100 : 0;
  return 0;
};

const TrafficManagement = () => {
  const { refreshTrafficConfig } = useAuth();
  const [servers, setServers] = useState([]);
  const [policy, setPolicy] = useState('round-robin');
  const [cpuThreshold, setCpuThreshold] = useState(80);
  const [manualSelectedServerId, setManualSelectedServerId] = useState('');
  const [pingIntervalSeconds, setPingIntervalSeconds] = useState(60);
  const [requestsPerPing, setRequestsPerPing] = useState(1);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCharts, setShowCharts] = useState(true);
  const [selectedTelemetryServerId, setSelectedTelemetryServerId] = useState('all');
  const [serverChartMode, setServerChartMode] = useState('resources');

  const isMountedRef = useRef(true);
  const initialScanDoneRef = useRef(false);

  // Add / Edit server modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [isAddingServer, setIsAddingServer] = useState(false);

  const [editingServer, setEditingServer] = useState(null);
  const [editServerName, setEditServerName] = useState('');
  const [editServerUrl, setEditServerUrl] = useState('');
  const [isUpdatingServer, setIsUpdatingServer] = useState(false);

  // Per-server Render usage sync modal
  const [usageTargetServer, setUsageTargetServer] = useState(null);
  const [serverConsumedHrs, setServerConsumedHrs] = useState(0);
  const [serverLimitHrs, setServerLimitHrs] = useState(750);
  const [isSavingServerUsage, setIsSavingServerUsage] = useState(false);

  // Live telemetry chart buffer (last 20 snapshots)
  const [telemetryHistory, setTelemetryHistory] = useState([]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const recordTelemetrySnapshot = (currentServers) => {
    if (!currentServers || currentServers.length === 0) return;
    const timeLabel = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const onlineList = currentServers.filter(s => s.isActive && s.status === 'online' && !s.isStale);
    const clusterSpeed = onlineList.reduce((sum, s) => sum + (s.reqPerMin || 0), 0);
    const clusterLatency = onlineList.length > 0
      ? Math.round(onlineList.reduce((sum, s) => sum + (s.responseTime || 0), 0) / onlineList.length)
      : 0;
    const byId = {};
    currentServers.forEach(s => {
      const online = s.isActive && s.status === 'online' && !s.isStale;
      byId[s._id] = {
        speed: online ? (s.reqPerMin || 0) : 0,
        lat: online ? (s.responseTime || 0) : 0
      };
    });
    const point = { time: timeLabel, clusterSpeed, clusterLatency, byId };
    setTelemetryHistory(prev => {
      // Update same-second snapshot in place so X-axis never shows duplicate timestamps
      if (prev.length > 0 && prev[prev.length - 1].time === timeLabel) {
        return [...prev.slice(0, -1), point];
      }
      const next = [...prev, point];
      return next.length > 20 ? next.slice(-20) : next;
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
      setPolicy(configRes.data.policy || 'round-robin');
      setCpuThreshold(configRes.data.cpuThreshold || 80);
      setManualSelectedServerId(configRes.data.manualSelectedServerId || '');
      setPingIntervalSeconds(configRes.data.pingIntervalSeconds || (configRes.data.pingIntervalMinutes ? configRes.data.pingIntervalMinutes * 60 : 60));
      setRequestsPerPing(configRes.data.requestsPerPing || 1);
      recordTelemetrySnapshot(serversRes.data);
    } catch (err) {
      if (isMountedRef.current) {
        Swal.fire({ icon: 'error', title: 'Fetch Failed', text: err.response?.data?.message || 'Could not load server cluster data.' });
      }
    } finally {
      if (isMountedRef.current) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConfigAndServers();
    const intervalMs = Math.min(Math.max(10000, (pingIntervalSeconds || 60) * 1000), 20000);
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      axios.get('/traffic/servers').then(res => {
        if (isMountedRef.current) {
          setServers(res.data);
          recordTelemetrySnapshot(res.data);
        }
      }).catch(() => {});
    }, intervalMs);
    return () => clearInterval(interval);
  }, [pingIntervalSeconds]);

  useEffect(() => {
    if (servers.length > 0 && !initialScanDoneRef.current) {
      initialScanDoneRef.current = true;
      handleBackendPing(true);
    }
  }, [servers]);

  const handleBackendPing = async (silent = false) => {
    if (!isMountedRef.current) return;
    setIsRefreshing(true);
    try {
      await axios.post('/traffic/ping');
      const { data: freshServers } = await axios.get('/traffic/servers');
      if (!isMountedRef.current) return;
      setServers(freshServers);
      recordTelemetrySnapshot(freshServers);
      await refreshTrafficConfig();
      if (!silent) {
        const rows = freshServers.map(s =>
          `<div class="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700/50">
            <span class="font-bold">${s.name}</span>
            <span class="${s.status === 'online' ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}">${(s.status || 'unknown').toUpperCase()} (${s.responseTime || 0}ms)</span>
          </div>`
        ).join('');
        Swal.fire({ icon: 'success', title: 'Health Scan Complete', html: `<div class="text-left text-xs font-mono space-y-1">${rows}</div>`, confirmButtonColor: '#10b981' });
      }
    } catch (err) {
      if (!silent && isMountedRef.current) {
        Swal.fire({ icon: 'error', title: 'Scan Failed', text: err.response?.data?.message || 'Health scan failed.' });
      }
    } finally {
      if (isMountedRef.current) setIsRefreshing(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await axios.post('/traffic/config', {
        policy,
        cpuThreshold: Number(cpuThreshold),
        manualSelectedServerId: policy === 'manual' ? manualSelectedServerId : null,
        pingIntervalSeconds: Number(pingIntervalSeconds),
        requestsPerPing: Number(requestsPerPing)
      });
      await refreshTrafficConfig();
      await fetchConfigAndServers();
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Routing rules updated.', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Save Failed', text: err.response?.data?.message || 'Could not save config.' });
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleToggleServer = async (server) => {
    if (server.isPrimary && server.isActive) {
      Swal.fire({ icon: 'warning', title: 'Action Denied', text: 'The primary server cannot be paused.' });
      return;
    }
    try {
      await axios.put(`/traffic/servers/${server._id}`, { isActive: !server.isActive });
      await fetchConfigAndServers();
      await refreshTrafficConfig();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Toggle Failed', text: err.response?.data?.message || 'Could not update server.' });
    }
  };

  const handleSetPrimaryServer = async (server) => {
    if (server.isPrimary) return;
    try {
      await axios.put(`/traffic/servers/${server._id}/set-primary`);
      await fetchConfigAndServers();
      await refreshTrafficConfig();
      Swal.fire({ icon: 'success', title: 'Primary Updated', text: `${server.name} is now Primary.`, timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed', text: err.response?.data?.message || 'Could not set primary.' });
    }
  };

  const handleDeleteServer = async (server) => {
    if (server.isPrimary) {
      Swal.fire({ icon: 'warning', title: 'Action Denied', text: 'The primary server cannot be deleted.' });
      return;
    }
    const confirm = await Swal.fire({
      title: `Remove ${server.name}?`,
      text: 'This removes the server from load balancing.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Remove',
      confirmButtonColor: '#ef4444'
    });
    if (!confirm.isConfirmed) return;
    try {
      await axios.delete(`/traffic/servers/${server._id}`);
      await fetchConfigAndServers();
      await refreshTrafficConfig();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to delete server.', 'error');
    }
  };

  const handleAddServer = async (e) => {
    e.preventDefault();
    if (!newServerName.trim() || !newServerUrl.trim()) return;
    setIsAddingServer(true);
    try {
      await axios.post('/traffic/servers', { name: newServerName, url: newServerUrl, isActive: true });
      setShowAddModal(false);
      setNewServerName('');
      setNewServerUrl('');
      await fetchConfigAndServers();
      await refreshTrafficConfig();
      Swal.fire({ icon: 'success', title: 'Server Added', timer: 1400, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to register server.', 'error');
    } finally {
      setIsAddingServer(false);
    }
  };

  const handleUpdateServer = async (e) => {
    e.preventDefault();
    if (!editingServer || !editServerName.trim() || !editServerUrl.trim()) return;
    setIsUpdatingServer(true);
    try {
      await axios.put(`/traffic/servers/${editingServer._id}`, { name: editServerName, url: editServerUrl });
      setEditingServer(null);
      await fetchConfigAndServers();
      await refreshTrafficConfig();
      Swal.fire({ icon: 'success', title: 'Updated', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update server.', 'error');
    } finally {
      setIsUpdatingServer(false);
    }
  };

  const openUsageSyncModal = (server) => {
    setUsageTargetServer(server);
    setServerConsumedHrs(server.renderUsage?.consumedHours ?? 0);
    setServerLimitHrs(server.renderUsage?.limitHours ?? 750);
  };

  const handleSaveServerUsage = async (e) => {
    e.preventDefault();
    if (!usageTargetServer) return;
    setIsSavingServerUsage(true);
    try {
      await axios.put(`/traffic/servers/${usageTargetServer._id}/render-usage`, {
        consumedHours: Number(serverConsumedHrs),
        monthlyLimitHours: Number(serverLimitHrs)
      });
      setUsageTargetServer(null);
      await fetchConfigAndServers();
      Swal.fire({ icon: 'success', title: 'Server Usage Synced', timer: 1300, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save server usage.', 'error');
    } finally {
      setIsSavingServerUsage(false);
    }
  };

  const handleInternalRefresh = async () => {
    await Promise.all([fetchConfigAndServers(), refreshTrafficConfig()]);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    Swal.fire({ icon: 'success', title: 'Copied', timer: 900, showConfirmButton: false });
  };

  const healthyServers = servers.filter(s => s.isActive && s.status !== 'offline' && s.status !== 'unknown');
  const eligibleServers = healthyServers.length > 0 ? healthyServers : servers.filter(s => s.isActive && s.status !== 'offline');
  const onlineCount = servers.filter(s => s.isActive && s.status === 'online').length;
  const totalRpm = servers.reduce((acc, s) => acc + (s.isActive && s.status === 'online' ? (s.reqPerMin || 0) : 0), 0);
  const totalReqs = servers.reduce((acc, s) => acc + (s.requestCount || 0), 0);
  const sampleUsage = servers[0]?.renderUsage;
  const resetDateText = sampleUsage?.nextReset
    ? new Date(sampleUsage.nextReset).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '1st UTC';

  const selectedServerObj = selectedTelemetryServerId === 'all'
    ? null
    : servers.find(s => s._id === selectedTelemetryServerId) || null;
  const effectiveScopeId = selectedServerObj ? selectedServerObj._id : 'all';

  const trendChartData = telemetryHistory.map(pt => ({
    time: pt.time,
    speed: effectiveScopeId === 'all' ? pt.clusterSpeed : (pt.byId?.[effectiveScopeId]?.speed ?? 0),
    latency: effectiveScopeId === 'all' ? pt.clusterLatency : (pt.byId?.[effectiveScopeId]?.lat ?? 0)
  }));

  const onlineHealthyNodes = servers.filter(s => s.isActive && s.status === 'online' && !s.isStale);
  const currentScopeSpeed = selectedServerObj
    ? (selectedServerObj.isActive && selectedServerObj.status === 'online' ? (selectedServerObj.reqPerMin || 0) : 0)
    : totalRpm;
  const currentScopeLatency = selectedServerObj
    ? (selectedServerObj.isActive && selectedServerObj.status === 'online' ? (selectedServerObj.responseTime || 0) : 0)
    : (onlineHealthyNodes.length > 0
      ? Math.round(onlineHealthyNodes.reduce((sum, s) => sum + (s.responseTime || 0), 0) / onlineHealthyNodes.length)
      : 0);

  const serverComparisonData = servers.map(s => {
    const online = s.isActive && s.status === 'online' && !s.isStale;
    return {
      name: s.name,
      ram: online && typeof s.memoryUsage === 'number' ? s.memoryUsage : 0,
      cpu: online && typeof s.cpuUsage === 'number' ? s.cpuUsage : 0,
      speed: online ? (s.reqPerMin || 0) : 0,
      latency: online ? (s.responseTime || 0) : 0
    };
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fadeIn">
      {/* Compact Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20">
            <Network size={22} />
          </span>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">Traffic Control</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Equal load distribution, automatic crash failover & individual server free-tier tracking
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleInternalRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
            title="Refresh live traffic stats, load share & server usage"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
            Refresh
          </button>
          <a
            href="https://dashboard.render.com/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700"
          >
            <ExternalLink size={14} className="text-indigo-400" />
            Render Billing
          </a>
          <button
            onClick={() => handleBackendPing(false)}
            disabled={isRefreshing || servers.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500 hover:text-white border border-sky-500/20 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <Activity size={14} className={isRefreshing ? 'animate-pulse' : ''} />
            Scan Health
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            <PlusCircle size={15} />
            Add Server
          </button>
        </div>
      </div>

      {/* 4 Clean Summary Pills */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Servers Online</div>
          <div className="text-2xl font-black text-emerald-500 mt-1">
            {onlineCount} <span className="text-xs font-medium text-slate-400">/ {servers.length}</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Load Distribution</div>
          <div className="text-lg font-black text-slate-800 dark:text-white mt-1 truncate">
            {policy === 'round-robin'
              ? `${eligibleServers.length > 0 ? Math.round(100 / eligibleServers.length) : 0}% each (Equal)`
              : (POLICY_OPTIONS.find(p => p.id === policy)?.label || policy)}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400">Live Cluster Speed</div>
          <div className="text-2xl font-black text-amber-500 mt-1">
            {totalRpm} <span className="text-xs font-medium text-slate-400">req/min ({totalReqs} reqs)</span>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1">
            <Calendar size={12} className="text-indigo-400" /> Render Monthly Reset
          </div>
          <div className="text-lg font-black text-slate-800 dark:text-white mt-1">
            {resetDateText} <span className="text-xs font-medium text-sky-400">({sampleUsage?.daysRemainingInMonth ?? '—'}d left)</span>
          </div>
        </div>
      </div>

      {/* Unified Per-Server Cards (Traffic + Health + Individual 750h Free Tier) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {servers.map((server) => {
          const share = computeTargetShare(server, eligibleServers, policy, manualSelectedServerId);
          const usage = server.renderUsage || { consumedHours: 0, limitHours: 750, remainingHours: 750, percent: 0, daysLeftAt24h: 31.3, alertLevel: 'normal' };
          const isOnline = server.isActive && server.status === 'online' && !server.isStale;
          const isOffline = !server.isActive || server.status === 'offline';

          return (
            <div
              key={server._id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-lg flex flex-col justify-between space-y-4 ${
                isOffline
                  ? 'border-rose-500/40 opacity-90'
                  : server.isPrimary
                    ? 'border-emerald-500/40'
                    : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500 animate-pulse' : isOffline ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    <h3 className="font-extrabold text-base text-slate-800 dark:text-white truncate">{server.name}</h3>
                    {server.isPrimary && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md text-[10px] font-bold">
                        Primary
                      </span>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    !server.isActive ? 'bg-slate-500/10 text-slate-400' :
                    isOnline ? 'bg-emerald-500/10 text-emerald-500' :
                    isOffline ? 'bg-rose-500/10 text-rose-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {!server.isActive ? 'Paused' : server.isStale ? 'Stale' : server.status}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  <span className="truncate">{server.url}</span>
                  <button onClick={() => copyToClipboard(server.url)} className="p-1 hover:text-emerald-500 cursor-pointer shrink-0" title="Copy URL">
                    <Copy size={12} />
                  </button>
                </div>
              </div>

              {/* Traffic Share */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-500">Traffic Share</span>
                  <span className={`font-black ${share > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                    {share}% {isOffline && '(Redirected)'}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-gradient-to-r from-emerald-500 to-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${share}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>{server.reqPerMin || 0} req/min</span>
                  <span>{server.requestCount || 0} total reqs</span>
                </div>
              </div>

              {/* 4 Health Metrics */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Latency</div>
                  <div className="text-xs font-black text-sky-500 mt-0.5">{isOnline ? `${server.responseTime || 0}ms` : '---'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[9px] font-bold uppercase text-slate-400">CPU</div>
                  <div className="text-xs font-black text-amber-500 mt-0.5">{isOnline && server.cpuUsage != null ? `${server.cpuUsage}%` : '---'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[9px] font-bold uppercase text-slate-400">RAM</div>
                  <div className="text-xs font-black text-purple-500 mt-0.5">{isOnline && server.memoryUsage != null ? `${server.memoryUsage}%` : '---'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <div className="text-[9px] font-bold uppercase text-slate-400">Uptime</div>
                  <div className="text-xs font-black text-emerald-500 mt-0.5">{isOnline ? formatUptime(server.uptimeSeconds) : '---'}</div>
                </div>
              </div>

              {/* Per-Server Render Free Quota */}
              <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Free Server Usage</span>
                  <button
                    onClick={() => openUsageSyncModal(server)}
                    className="text-[10px] font-bold text-indigo-500 hover:underline cursor-pointer"
                  >
                    Sync Hrs
                  </button>
                </div>
                <div className="flex justify-between items-baseline text-xs font-mono">
                  <span className="font-black text-slate-800 dark:text-white">
                    {usage.consumedHours} <span className="font-normal text-slate-400">/ {usage.limitHours} hrs</span>
                  </span>
                  <span className={`font-black ${
                    usage.alertLevel === 'critical' ? 'text-rose-500' :
                    usage.alertLevel === 'warning' ? 'text-amber-500' : 'text-emerald-500'
                  }`}>
                    {usage.remainingHours}h left
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      usage.alertLevel === 'critical' ? 'bg-rose-500' :
                      usage.alertLevel === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, usage.percent || 0)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>{usage.isManualSync ? 'Synced + live' : 'Auto uptime'}</span>
                  <span>~{usage.daysLeftAt24h}d runway @ 24h/d</span>
                </div>
              </div>

              {server.status === 'offline' && server.failureReason && (
                <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[11px] font-medium text-rose-500">
                  {server.failureReason}
                </div>
              )}

              {/* Actions Row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleSetPrimaryServer(server)}
                  disabled={server.isPrimary}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  title="Set Primary"
                >
                  <Sparkles size={13} /> Primary
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setEditingServer(server); setEditServerName(server.name); setEditServerUrl(server.url); }}
                    className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-600 hover:text-white cursor-pointer"
                    title="Edit Server"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleServer(server)}
                    disabled={server.isPrimary}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-emerald-500 disabled:opacity-40 cursor-pointer"
                    title={server.isActive ? 'Pause Server' : 'Activate Server'}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteServer(server)}
                    disabled={server.isPrimary}
                    className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white disabled:opacity-40 cursor-pointer"
                    title="Delete Server"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom 2-Column Row: Simple Routing Settings + Live Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Routing Settings */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Settings className="text-emerald-500" size={18} />
            <h2 className="text-base font-bold text-slate-800 dark:text-white">Routing & Failover Policy</h2>
          </div>

          <div className="space-y-2">
            {POLICY_OPTIONS.map(opt => (
              <div
                key={opt.id}
                onClick={() => setPolicy(opt.id)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  policy === opt.id
                    ? 'bg-emerald-500/10 border-emerald-500/40'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:border-slate-400'
                }`}
              >
                <div className="flex justify-between items-center text-xs font-bold text-slate-800 dark:text-white">
                  <span>{opt.label}</span>
                  {policy === opt.id && <CheckCircle2 size={14} className="text-emerald-500" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</p>
              </div>
            ))}
          </div>

          {policy === 'manual' && (
            <select
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white"
              value={manualSelectedServerId}
              onChange={(e) => setManualSelectedServerId(e.target.value)}
            >
              <option value="">Select Pinned Server</option>
              {servers.filter(s => s.isActive).map(s => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          )}

          {policy === 'cpu-adaptive' && (
            <div className="text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-600 dark:text-slate-300">
                <span>CPU Auto-Scale Limit</span>
                <span className="text-amber-500">{cpuThreshold}%</span>
              </div>
              <input type="range" min="30" max="95" value={cpuThreshold} onChange={(e) => setCpuThreshold(Number(e.target.value))} className="w-full accent-amber-500" />
            </div>
          )}

          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-600 dark:text-slate-300">Auto-Ping Interval</span>
            <select
              value={pingIntervalSeconds}
              onChange={(e) => setPingIntervalSeconds(Number(e.target.value))}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 font-mono text-xs text-slate-800 dark:text-white"
            >
              <option value={30}>30s</option>
              <option value={60}>60s (1m)</option>
              <option value={180}>180s (3m)</option>
              <option value={300}>300s (5m)</option>
            </select>
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
          >
            {isSavingConfig ? 'Saving...' : 'Save Routing Settings'}
          </button>
        </div>

        {/* Live Telemetry Charts */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="text-emerald-500" size={18} />
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white">Live Speed & Health Telemetry</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only 2 simple lines (Traffic Speed + Response Time) and per-server RAM & CPU comparison
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showCharts && (
                <select
                  value={effectiveScopeId}
                  onChange={(e) => setSelectedTelemetryServerId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  <option value="all">All Servers (Cluster)</option>
                  {servers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => setShowCharts(!showCharts)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer flex items-center gap-1 px-2 py-1"
              >
                <Sliders size={13} /> {showCharts ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {showCharts && (
            <div className="grid grid-cols-1 gap-4">
              {/* Chart 1: Simple 2-Line Speed & Latency */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {selectedServerObj ? `${selectedServerObj.name} — Traffic Speed & Response Delay` : 'All Servers — Total Speed & Avg Response Delay'}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-bold">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Speed: {currentScopeSpeed} req/min
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                      {selectedServerObj ? 'Response' : 'Avg Response'}: {currentScopeLatency} ms
                    </span>
                  </div>
                </div>

                <div className="h-52">
                  {trendChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">Collecting live telemetry...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trendChartData}>
                        <defs>
                          <linearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                        <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
                        <YAxis yAxisId="speed" stroke="#10b981" fontSize={10} allowDecimals={false} unit=" rpm" />
                        <YAxis yAxisId="lat" orientation="right" stroke="#0ea5e9" fontSize={10} allowDecimals={false} unit="ms" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '12px', color: '#f8fafc' }}
                          itemStyle={{ fontWeight: 700 }}
                        />
                        <Area
                          yAxisId="speed"
                          type="monotone"
                          dataKey="speed"
                          name="Traffic Speed (req/min)"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#speedFill)"
                          dot={{ r: 3, fill: '#10b981' }}
                          activeDot={{ r: 5 }}
                        />
                        <Line
                          yAxisId="lat"
                          type="monotone"
                          dataKey="latency"
                          name={selectedServerObj ? 'Response Delay (ms)' : 'Avg Response Delay (ms)'}
                          stroke="#0ea5e9"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: '#0ea5e9' }}
                          activeDot={{ r: 5 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Chart 2: Clear Per-Server Comparison Bars (RAM/CPU or Speed/Latency) */}
              <div className="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {serverChartMode === 'resources' ? 'Current Server Load (RAM & CPU)' : 'Current Load by Server (Speed & Latency)'}
                    </span>
                    <div className="flex items-center gap-3 text-[11px] font-bold">
                      {serverChartMode === 'resources' ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> RAM %
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> CPU %
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Speed (req/min)
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> Latency (ms)
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="inline-flex rounded-lg bg-slate-200/70 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setServerChartMode('resources')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                        serverChartMode === 'resources'
                          ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      RAM & CPU
                    </button>
                    <button
                      type="button"
                      onClick={() => setServerChartMode('traffic')}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer ${
                        serverChartMode === 'traffic'
                          ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      Speed & Delay
                    </button>
                  </div>
                </div>

                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    {serverChartMode === 'resources' ? (
                      <BarChart data={serverComparisonData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} unit="%" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '12px', color: '#f8fafc' }}
                        />
                        <ReferenceLine y={cpuThreshold} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `Alert ${cpuThreshold}%`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                        <Bar dataKey="ram" name="RAM Usage (%)" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="cpu" name="CPU Load (%)" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    ) : (
                      <BarChart data={serverComparisonData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                        <YAxis yAxisId="spd" stroke="#10b981" fontSize={10} allowDecimals={false} unit=" rpm" />
                        <YAxis yAxisId="lat" orientation="right" stroke="#0ea5e9" fontSize={10} allowDecimals={false} unit="ms" />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '10px', fontSize: '12px', color: '#f8fafc' }}
                        />
                        <Bar yAxisId="spd" dataKey="speed" name="Speed (req/min)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar yAxisId="lat" dataKey="latency" name="Latency (ms)" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Server size={18} className="text-emerald-500" /> Add Backend Server
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleAddServer} className="space-y-3">
              <input
                type="text"
                required
                placeholder="Server Name (e.g. Server 6)"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-white"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
              />
              <input
                type="url"
                required
                placeholder="https://ssms3-0-be-xxxx.onrender.com"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 dark:text-white"
                value={newServerUrl}
                onChange={(e) => setNewServerUrl(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isAddingServer} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">
                  {isAddingServer ? 'Adding...' : 'Add Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Server Modal */}
      {editingServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Edit2 size={18} className="text-indigo-400" /> Edit {editingServer.name}
              </h3>
              <button onClick={() => setEditingServer(null)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>
            <form onSubmit={handleUpdateServer} className="space-y-3">
              <input
                type="text"
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-white"
                value={editServerName}
                onChange={(e) => setEditServerName(e.target.value)}
              />
              <input
                type="url"
                required
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-800 dark:text-white"
                value={editServerUrl}
                onChange={(e) => setEditServerUrl(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingServer(null)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isUpdatingServer} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                  {isUpdatingServer ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Per-Server Free Quota Sync Modal */}
      {usageTargetServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Zap size={17} className="text-indigo-500" /> Sync Render Hours — {usageTargetServer.name}
              </h3>
              <button onClick={() => setUsageTargetServer(null)} className="text-slate-400 hover:text-white cursor-pointer">&times;</button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Update this server&apos;s own Render account hours for the current month. Live hours will keep accruing automatically from this value.
            </p>
            <form onSubmit={handleSaveServerUsage} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Used Hours (this month)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={serverConsumedHrs}
                    onChange={(e) => setServerConsumedHrs(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">Monthly Limit (hrs)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={serverLimitHrs}
                    onChange={(e) => setServerLimitHrs(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setUsageTargetServer(null)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSavingServerUsage} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer">
                  {isSavingServerUsage ? 'Saving...' : 'Save Server Hours'}
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
