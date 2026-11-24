import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  X, ShieldAlert, ShieldCheck, Clock, Ban, CheckCircle2, Search, RefreshCw, AlertTriangle, User, Calendar
} from 'lucide-react';

const AccessHistoryModal = ({ isOpen, onClose, targetStudent = null }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const url = targetStudent 
        ? `/auth/student-access-logs?studentId=${targetStudent._id}` 
        : '/auth/student-access-logs';
      const { data } = await axios.get(url);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching access logs:', err);
      setError('Failed to load access history logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, targetStudent]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || 
      (log.studentName && log.studentName.toLowerCase().includes(query)) ||
      (log.studentRollNumber && log.studentRollNumber.toLowerCase().includes(query)) ||
      (log.reason && log.reason.toLowerCase().includes(query)) ||
      (log.performedByName && log.performedByName.toLowerCase().includes(query)) ||
      (log.batchName && log.batchName.toLowerCase().includes(query));
    return matchesAction && matchesSearch;
  });

  const totalCount = logs.length;
  const blockCount = logs.filter(l => l.action === 'block').length;
  const suspendCount = logs.filter(l => l.action === 'suspend').length;
  const restoreCount = logs.filter(l => l.action === 'restore').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Access & Suspension History</span>
                {targetStudent && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-mono">
                    {targetStudent.name} ({targetStudent.rollNumber || 'Student'})
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional record of student panel blocks, disciplinary suspensions, and access restorations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh Records"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Bar & Counters */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-slate-50/30 dark:bg-slate-900/50 flex flex-wrap items-center justify-between gap-3">
          {/* Action Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setActionFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              All Records <span className="ml-1 opacity-75">({totalCount})</span>
            </button>
            <button
              onClick={() => setActionFilter('suspend')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'suspend'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              }`}
            >
              Suspensions <span className="ml-1 opacity-75">({suspendCount})</span>
            </button>
            <button
              onClick={() => setActionFilter('block')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'block'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100'
              }`}
            >
              Blocked <span className="ml-1 opacity-75">({blockCount})</span>
            </button>
            <button
              onClick={() => setActionFilter('restore')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                actionFilter === 'restore'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              Restored <span className="ml-1 opacity-75">({restoreCount})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search student, roll, reason..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white pl-8 pr-3 py-1.5 rounded-xl focus:outline-none focus:border-indigo-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-indigo-500" />
              <p className="text-xs font-medium">Loading access history records...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-red-500 flex flex-col items-center justify-center space-y-2">
              <AlertTriangle size={28} />
              <p className="text-sm font-bold">{error}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
              <CheckCircle2 size={36} className="text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No records found</p>
              <p className="text-xs text-slate-400 max-w-sm">
                No matching block, suspension, or restoration records for the selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 dark:bg-white/5 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3 rounded-l-xl">Timestamp</th>
                    <th className="py-3 px-3">Student</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Reason / Details</th>
                    <th className="py-3 px-3">Duration / Expiry</th>
                    <th className="py-3 px-3">Action By</th>
                    <th className="py-3 px-3 rounded-r-xl">Batch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredLogs.map((log) => {
                    const isBlock = log.action === 'block';
                    const isSuspend = log.action === 'suspend';
                    const isRestore = log.action === 'restore';

                    return (
                      <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900 dark:text-white leading-tight">{log.studentName}</p>
                          <p className="font-mono text-[10px] text-slate-400">{log.studentRollNumber || log.studentEmail}</p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isBlock && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                              <Ban size={10} /> BLOCKED
                            </span>
                          )}
                          {isSuspend && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Clock size={10} /> SUSPENDED
                            </span>
                          )}
                          {isRestore && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={10} /> RESTORED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-xs text-slate-700 dark:text-slate-300 truncate" title={log.reason}>
                          {log.reason || '—'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {isSuspend ? (
                            log.suspendedUntil ? (
                              <span>Until {new Date(log.suspendedUntil).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} ({log.durationHours || '?'}h)</span>
                            ) : (
                              <span>{log.durationHours ? `${log.durationHours}h` : 'Temporary'}</span>
                            )
                          ) : isBlock ? (
                            <span className="text-red-500 font-semibold">Permanent Hold</span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Access Restored</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          <span className="font-semibold">{log.performedByName}</span>{' '}
                          <span className="text-[10px] uppercase text-slate-400">({log.performedByRole})</span>
                        </td>
                        <td className="py-3 px-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {log.batchName || 'General'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessHistoryModal;
