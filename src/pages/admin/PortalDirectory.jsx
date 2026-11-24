import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { 
  Share2, GraduationCap, UserCheck, Activity, Globe, Copy, Check, ExternalLink, 
  Lock, Key, ShieldCheck, Search, Users, ArrowUpRight, Sparkles, CheckCircle2,
  Plus, Trash2, Edit3, Building2, Layers, RefreshCw, X, Shield, Eye
} from 'lucide-react';
import Swal from 'sweetalert2';
import Loader from '../../components/Loader';

const PortalDirectory = () => {
  const { user } = useAuth();
  const [mentors, setMentors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [monitorPins, setMonitorPins] = useState([]);
  const [studentCount, setStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState(null);
  const [mentorSearch, setMentorSearch] = useState('');
  const [pinSearch, setPinSearch] = useState('');
  const [selectedPublicBatch, setSelectedPublicBatch] = useState('');

  // PIN Create / Edit Modal State
  const [showPinModal, setShowPinModal] = useState(false);
  const [editingPin, setEditingPin] = useState(null);
  const [pinFormData, setPinFormData] = useState({
    panelName: '',
    pin: '',
    isGlobal: false,
    allowedBatches: [],
    description: ''
  });
  const [savingPin, setSavingPin] = useState(false);

  // Core production domain for SSMS portal directory
  const CORE_DOMAIN = 'https://ssms.saranv.in';
  const origin = CORE_DOMAIN;

  const fetchMonitorPins = async () => {
    try {
      const { data } = await axios.get('/monitor-access');
      setMonitorPins(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load monitor access pins:', err);
    }
  };

  const fetchBatches = async () => {
    try {
      const { data } = await axios.get('/batches');
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load batches:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mentorsRes, statsRes, batchesRes, pinsRes] = await Promise.all([
          axios.get('/mentors').catch(() => ({ data: [] })),
          axios.get('/dashboard/admin-stats').catch(() => ({ data: {} })),
          axios.get('/batches').catch(() => ({ data: [] })),
          axios.get('/monitor-access').catch(() => ({ data: [] }))
        ]);
        setMentors(Array.isArray(mentorsRes.data) ? mentorsRes.data : []);
        setStudentCount(statsRes.data?.totalStudents || 0);
        setBatches(Array.isArray(batchesRes.data) ? batchesRes.data : []);
        setMonitorPins(Array.isArray(pinsRes.data) ? pinsRes.data : []);
      } catch (err) {
        console.error('Failed to load portal directory data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generatePin = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPinFormData(prev => ({ ...prev, pin: result }));
  };

  const handleOpenCreatePin = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let randomPin = '';
    for (let i = 0; i < 6; i++) {
      randomPin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPinFormData({
      panelName: '',
      pin: randomPin,
      isGlobal: false,
      allowedBatches: batches.length > 0 ? [(batches[0]._id).toString()] : [],
      description: ''
    });
    setEditingPin(null);
    setShowPinModal(true);
  };

  const handleOpenEditPin = (p) => {
    setPinFormData({
      panelName: p.panelName || '',
      pin: p.pin || '',
      isGlobal: Boolean(p.isGlobal),
      allowedBatches: (p.allowedBatches || []).map(b => (b._id || b).toString()),
      description: p.description || ''
    });
    setEditingPin(p);
    setShowPinModal(true);
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    if (!pinFormData.panelName.trim()) {
      Swal.fire('Required Field', 'Please enter a Monitor Panel Name.', 'warning');
      return;
    }
    if (!pinFormData.pin.trim()) {
      Swal.fire('Required Field', 'Please provide a unique PIN.', 'warning');
      return;
    }
    if (!pinFormData.isGlobal && pinFormData.allowedBatches.length === 0) {
      Swal.fire('Batch Selection Required', 'Please select at least one batch for this PIN, or toggle All Batches.', 'warning');
      return;
    }

    setSavingPin(true);
    try {
      if (editingPin) {
        await axios.put(`/monitor-access/${editingPin._id}`, pinFormData);
        Swal.fire('Updated', 'Monitoring PIN and batch permissions updated successfully.', 'success');
      } else {
        await axios.post('/monitor-access', pinFormData);
        Swal.fire('Created', 'New monitoring access PIN generated successfully.', 'success');
      }
      setShowPinModal(false);
      fetchMonitorPins();
    } catch (err) {
      console.error('Save monitor PIN failed:', err);
      Swal.fire('Error', err.response?.data?.message || 'Failed to save monitoring PIN.', 'error');
    } finally {
      setSavingPin(false);
    }
  };

  const handleDeletePin = async (p) => {
    const result = await Swal.fire({
      title: 'Delete Monitoring PIN?',
      text: `Are you sure you want to revoke and delete PIN "${p.pin}" (${p.panelName})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/monitor-access/${p._id}`);
        Swal.fire('Deleted', 'Monitoring PIN has been removed.', 'success');
        fetchMonitorPins();
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to delete PIN.', 'error');
      }
    }
  };

  const toggleBatchSelection = (batchId) => {
    const bId = batchId.toString();
    setPinFormData(prev => {
      const exists = prev.allowedBatches.includes(bId);
      return {
        ...prev,
        allowedBatches: exists 
          ? prev.allowedBatches.filter(id => id !== bId)
          : [...prev.allowedBatches, bId]
      };
    });
  };

  const selectAllBatches = () => {
    setPinFormData(prev => ({
      ...prev,
      allowedBatches: batches.map(b => b._id.toString())
    }));
  };

  const clearAllBatches = () => {
    setPinFormData(prev => ({
      ...prev,
      allowedBatches: []
    }));
  };

  const filteredMentors = mentors.filter(m => 
    !mentorSearch || 
    m.name?.toLowerCase().includes(mentorSearch.toLowerCase()) || 
    m.email?.toLowerCase().includes(mentorSearch.toLowerCase())
  );

  const filteredPins = monitorPins.filter(p => {
    if (!pinSearch) return true;
    const q = pinSearch.toLowerCase();
    return (
      (p.panelName || '').toLowerCase().includes(q) ||
      (p.pin || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.allowedBatches || []).some(b => (b.batchName || '').toLowerCase().includes(q))
    );
  });

  if (loading) return <Loader />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-left animate-fadeIn">
      
      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
              <Share2 size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  System Access & Live Portals Directory
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60">
                  SR Admin Controls
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Centralized management hub for all student, faculty mentor, live inspection, and public portal direct links.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              Base Origin: <strong className="text-slate-800 dark:text-slate-200">{origin}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* 4 Primary Portal Direct Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* 1. Student Login Link Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-emerald-500/50 hover:shadow-lg transition-all group">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Student Login</h3>
                  <span className="text-[10px] text-slate-400 font-medium">Student Authentication</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                STUDENT
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5 leading-relaxed">
              Primary login link for students to access daily tasks, attendances, LeetCode challenges & gamification hub.
            </p>

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 mb-3.5 font-mono text-xs text-slate-800 dark:text-slate-200 break-all flex items-center justify-between gap-2">
              <span className="truncate">{origin}/login</span>
              <button
                type="button"
                onClick={() => copyToClipboard(`${origin}/login`, 'student_login')}
                className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors shrink-0 cursor-pointer"
                title="Copy Student Login Link"
              >
                {copiedKey === 'student_login' ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <Link 
              to="/students" 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Directory ({studentCount}) →
            </Link>
            <a
              href={`${origin}/login`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
            >
              Open Portal <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* 2. All Mentor Links & Directory Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-indigo-500/50 hover:shadow-lg transition-all group">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">All Mentor Links</h3>
                  <span className="text-[10px] text-slate-400 font-medium">Faculty & Trainers</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                {mentors.length} MENTORS
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
              Mentor portal login link and active faculty directory with assigned batch access.
            </p>

            {/* Mentor Search / Filter */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input
                type="text"
                placeholder="Search mentors..."
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] rounded-xl pl-7 pr-2.5 py-1 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Mentor Directory List */}
            <div className="space-y-1.5 mb-3.5 max-h-[110px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredMentors.length > 0 ? (
                filteredMentors.map((m) => (
                  <div key={m._id} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px]">{m.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">{m.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(m.email, `mentor_email_${m._id}`)}
                      className="p-1 text-slate-400 hover:text-indigo-500 transition-colors shrink-0 cursor-pointer"
                      title="Copy Mentor Email"
                    >
                      {copiedKey === `mentor_email_${m._id}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-center text-[10px] text-slate-400">
                  {mentorSearch ? 'No mentors match search' : 'No mentors registered yet'}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <Link 
              to="/mentors" 
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              Manage Mentors →
            </Link>
            <button
              type="button"
              onClick={() => copyToClipboard(`${origin}/login`, 'mentor_login')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs cursor-pointer"
            >
              {copiedKey === 'mentor_login' ? 'Copied Link!' : 'Copy Portal Link'}
            </button>
          </div>
        </div>

        {/* 3. Monitoring Link (with Passwords) Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-amber-500/50 hover:shadow-lg transition-all group">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Live Monitoring</h3>
                  <span className="text-[10px] text-slate-400 font-medium">With Passwords</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                <Lock size={9} /> PASSCODE
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
              Live student activity, physical check-ins, attendance logs and submission review matrix.
            </p>

            {/* Passwords Box */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 mb-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Master Key:</span>
                <div className="flex items-center gap-1.5">
                  <code className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                    SA123
                  </code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('SA123', 'passcode_sa')}
                    className="p-1 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                    title="Copy SA123"
                  >
                    {copiedKey === 'passcode_sa' ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Custom College PINs:</span>
                <a href="#college-pins-section" className="text-amber-600 dark:text-amber-400 font-bold hover:underline">
                  {monitorPins.filter(p => p.pin !== 'SA123').length} Configured ↓
                </a>
              </div>
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => copyToClipboard(`${origin}/verify`, 'monitor_link')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            >
              {copiedKey === 'monitor_link' ? 'Copied Link!' : 'Copy Link'}
            </button>
            <a
              href={`${origin}/verify`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-xs"
            >
              Open Monitor <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* 4. Public Tasks Link Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-sky-500/50 hover:shadow-lg transition-all group">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Public Tasks</h3>
                  <span className="text-[10px] text-slate-400 font-medium">Task Checking Link</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                PUBLIC
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2.5 leading-relaxed">
              Public link for inspecting published tasks, problem instructions & deadlines without login.
            </p>

            {/* Batch Scope Selector */}
            <div className="mb-2">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Select Target Batch:</span>
                {selectedPublicBatch && (
                  <button
                    type="button"
                    onClick={() => setSelectedPublicBatch('')}
                    className="text-[10px] text-sky-600 hover:underline font-bold"
                  >
                    Reset (All)
                  </button>
                )}
              </label>
              <select
                value={selectedPublicBatch}
                onChange={(e) => setSelectedPublicBatch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none focus:border-sky-500 cursor-pointer"
              >
                <option value="">All Batches (Global Tasks)</option>
                {batches.map(b => (
                  <option key={b._id} value={b._id}>
                    {b.batchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Generated Link Box */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 mb-3.5 font-mono text-xs text-slate-800 dark:text-slate-200 break-all flex items-center justify-between gap-2">
              <span className="truncate">
                {selectedPublicBatch ? `${origin}/public?batchId=${selectedPublicBatch}` : `${origin}/public`}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(
                  selectedPublicBatch ? `${origin}/public?batchId=${selectedPublicBatch}` : `${origin}/public`,
                  'public_tasks'
                )}
                className="p-1.5 text-slate-400 hover:text-sky-500 transition-colors shrink-0 cursor-pointer"
                title="Copy Public Task Link"
              >
                {copiedKey === 'public_tasks' ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              </button>
            </div>
          </div>

          <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-slate-400">
              {selectedPublicBatch ? 'Scoped to batch' : 'Global cohort scope'}
            </span>
            <a
              href={selectedPublicBatch ? `${origin}/public?batchId=${selectedPublicBatch}` : `${origin}/public`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-xs"
            >
              Check Tasks <ExternalLink size={12} />
            </a>
          </div>
        </div>

      </div>

      {/* ─── College Management & Monitoring Access (PIN Configuration) ─── */}
      <div id="college-pins-section" className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 shrink-0">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  College Management & Monitoring Access Setup
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60">
                  Unique PINs & Scoped Batches
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                Generate unique monitoring PINs for college management with their college name displayed on the monitor panel, restricted strictly to their assigned batches.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Search PIN, college, batch..."
                value={pinSearch}
                onChange={e => setPinSearch(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 outline-none focus:border-amber-500 w-48 sm:w-60 font-medium"
              />
            </div>

            <button
              type="button"
              onClick={handleOpenCreatePin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-sm cursor-pointer shrink-0"
            >
              <Plus size={16} /> Create Monitoring PIN
            </button>
          </div>
        </div>

        {/* PIN Cards Grid */}
        {filteredPins.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
            <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {pinSearch ? 'No monitoring PINs match your query' : 'No College Monitoring PINs Configured'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Create unique access PINs for College Principals, Directors, or HODs so they can monitor their specific batches with their institution name.
            </p>
            {!pinSearch && (
              <button
                type="button"
                onClick={handleOpenCreatePin}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-500 transition-colors cursor-pointer"
              >
                <Plus size={14} /> Create First College PIN
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPins.map(p => {
              const isDefaultKey = p.pin === 'SA123';
              const directLink = `${origin}/verify?pin=${p.pin}`;
              const batchList = p.allowedBatches || [];

              return (
                <div
                  key={p._id || p.pin}
                  className="bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all group"
                >
                  <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                            p.isGlobal
                              ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                          }`}>
                            {p.isGlobal ? 'Global All Batches' : `${batchList.length} Batches Assigned`}
                          </span>
                          {isDefaultKey && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                              System Default
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-black text-slate-900 dark:text-white truncate" title={p.panelName}>
                          {p.panelName}
                        </h3>
                        {p.description && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      {!isDefaultKey && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditPin(p)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit Monitor Access"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePin(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                            title="Delete Monitor Access"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* PIN credentials box */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Access PIN:</span>
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 text-xs">
                            {p.pin}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(p.pin, `pin_${p._id || p.pin}`)}
                            className="p-1 text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                            title="Copy PIN"
                          >
                            {copiedKey === `pin_${p._id || p.pin}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Portal Link:</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(directLink, `link_${p._id || p.pin}`)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-500 cursor-pointer"
                          title="Copy Direct Link with PIN"
                        >
                          {copiedKey === `link_${p._id || p.pin}` ? (
                            <>
                              <Check size={12} className="text-emerald-500" /> Copied Link!
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copy Direct URL
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Allowed Batches badges */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Layers size={11} /> Accessible Batches ({p.isGlobal ? 'All' : batchList.length}):
                      </p>
                      {p.isGlobal ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          Full Institution Scope (All Batches Visible)
                        </span>
                      ) : batchList.length === 0 ? (
                        <span className="text-[10px] text-amber-600 font-semibold italic">No batches assigned yet</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                          {batchList.map(b => {
                            const bId = b._id || b;
                            const bName = b.batchName || b.panelName || 'Batch';
                            const bPublicLink = `${origin}/public?batchId=${bId}`;
                            const isCopied = copiedKey === `pub_b_${bId}`;
                            return (
                              <div
                                key={bId}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                              >
                                <span className="truncate max-w-[130px]" title={bName}>{bName}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(bPublicLink, `pub_b_${bId}`)}
                                  className="text-indigo-400 hover:text-sky-600 transition-colors p-0.5 cursor-pointer"
                                  title={`Copy Public Task checking link for ${bName}`}
                                >
                                  {isCopied ? <Check size={10} className="text-emerald-500" /> : <ExternalLink size={10} />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-3.5 mt-3.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">
                      Display: <strong className="text-slate-700 dark:text-slate-300">{p.panelName}</strong>
                    </span>
                    <a
                      href={directLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-xs"
                    >
                      Open Monitor <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Create / Edit Monitoring PIN Modal ─── */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-scaleUp text-left max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {editingPin ? 'Edit College Monitoring Access' : 'Create College Monitoring Access PIN'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Assign institution name and specify which batches this PIN can monitor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPinModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePin} className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              
              {/* College Management / Panel Name */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5 tracking-wider">
                  College Management / Monitor Panel Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MIT Mysore College Management, Principal & HOD Portal"
                  value={pinFormData.panelName}
                  onChange={e => setPinFormData({ ...pinFormData, panelName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This custom title will be prominently displayed at the top of their monitoring command center.
                </p>
              </div>

              {/* Unique PIN */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5 tracking-wider">
                  Unique Monitoring PIN *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. MIT101, RV2026, SA99"
                    value={pinFormData.pin}
                    onChange={e => setPinFormData({ ...pinFormData, pin: e.target.value.toUpperCase() })}
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-black text-amber-600 dark:text-amber-400 outline-none focus:border-amber-500 uppercase tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={generatePin}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                  >
                    <RefreshCw size={13} /> Auto PIN
                  </button>
                </div>
              </div>

              {/* Access Scope (Global vs Specific Batches) */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-2 tracking-wider">
                  Batch Visibility Scope *
                </label>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div
                    onClick={() => setPinFormData({ ...pinFormData, isGlobal: false })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      !pinFormData.isGlobal
                        ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20 text-slate-900 dark:bg-amber-950/40 dark:text-white'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        checked={!pinFormData.isGlobal}
                        onChange={() => setPinFormData({ ...pinFormData, isGlobal: false })}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-bold">Specific Batches Only</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                      Restrict monitoring strictly to chosen college batches
                    </p>
                  </div>

                  <div
                    onClick={() => setPinFormData({ ...pinFormData, isGlobal: true })}
                    className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                      pinFormData.isGlobal
                        ? 'bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20 text-slate-900 dark:bg-purple-950/40 dark:text-white'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="radio"
                        checked={pinFormData.isGlobal}
                        onChange={() => setPinFormData({ ...pinFormData, isGlobal: true })}
                        className="text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-xs font-bold">All Batches (Global)</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-5">
                      Full view across all existing & future batches
                    </p>
                  </div>
                </div>

                {/* Specific Batches Checklist */}
                {!pinFormData.isGlobal && (
                  <div className="bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60 dark:border-slate-800">
                      <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                        Select Authorized Batches ({pinFormData.allowedBatches.length} selected):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={selectAllBatches}
                          className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={clearAllBatches}
                          className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                      {batches.map(b => {
                        const bId = b._id.toString();
                        const isChecked = pinFormData.allowedBatches.includes(bId);

                        return (
                          <div
                            key={b._id}
                            onClick={() => toggleBatchSelection(b._id)}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-amber-50/80 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}} // handled by parent div click
                                className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer h-4 w-4"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                  {b.batchName}
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  Trainer: {b.mentorId?.name || 'Saran Velmurugan'} · {b.panelName || 'SSMS'}
                                </p>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 border ${
                              b.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {b.status}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Description / Notes */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 dark:text-slate-300 mb-1.5 tracking-wider">
                  Description / Management Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shared with Principal Dr. Ramesh and Dean for Placement Monitoring"
                  value={pinFormData.description}
                  onChange={e => setPinFormData({ ...pinFormData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPin}
                  className="px-5 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                >
                  {savingPin ? 'Saving...' : editingPin ? 'Update PIN & Scopes' : 'Save & Issue Monitoring PIN'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Security & Access Guidelines Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <h2 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
          <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />
          Access & Credentials Reference
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Student Access
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Requires approved email & password. Students can only view their enrolled batch and personal submissions.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 mb-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500" /> Mentor & Faculty Access
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Requires mentor account credentials. Mentors manage assigned batches, review tasks, and grade submissions.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 mb-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Live Monitoring Passcodes
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
              Master Key (<code className="font-mono text-amber-600 font-bold">SA123</code>) unlocks executive command center monitoring across all batches. Custom College PINs grant scoped access to assigned batches.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default PortalDirectory;