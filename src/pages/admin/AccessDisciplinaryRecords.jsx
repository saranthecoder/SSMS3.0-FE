import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  ShieldAlert, ShieldCheck, Clock, Ban, CheckCircle2, Search, RefreshCw, 
  User, Calendar, Download, AlertTriangle, Filter, Users, ChevronRight, Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { useGlobalBatch } from '../../context/GlobalBatchContext';
import SkeletonLoader from '../../components/SkeletonLoader';
import AccessHistoryModal from '../../components/AccessHistoryModal';

const AccessDisciplinaryRecords = () => {
  const { user } = useAuth();
  const { batchesList, selectedBatchId, setSelectedBatchId } = useGlobalBatch();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  
  // Filters - initialized to globally switched batch
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState(() => selectedBatchId || '');
  const [actionFilter, setActionFilter] = useState('all');
  
  // Single student history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);

  const isStudent = user?.role === 'student';
  const isMentor = user?.role === 'mentor';
  const isAdmin = user?.role === 'admin';

  // Synchronize when global batch is switched
  useEffect(() => {
    if (selectedBatchId && selectedBatchId !== 'all') {
      setBatchFilter(selectedBatchId);
    }
  }, [selectedBatchId]);

  const fetchLogs = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const activeBatchId = batchFilter || (selectedBatchId !== 'all' ? selectedBatchId : '');
      const queryParam = activeBatchId ? `?batchId=${activeBatchId}` : '';
      const { data } = await axios.get(`/auth/student-access-logs${queryParam}`);
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching disciplinary logs:', err);
      setError('Failed to load disciplinary records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [batchFilter, selectedBatchId]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    const effectiveBatch = batchFilter || (selectedBatchId !== 'all' ? selectedBatchId : '');
    const activeBatchObj = batchesList.find(b => b._id === effectiveBatch);
    const activeBatchName = activeBatchObj?.batchName?.toLowerCase() || '';

    return logs.filter(log => {
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      
      const logBatchId = (log.batchId?._id || log.batchId)?.toString();
      const matchesBatch = !effectiveBatch || effectiveBatch === 'all' || 
        (logBatchId && logBatchId === effectiveBatch) ||
        (activeBatchName && (log.batchName || '').toLowerCase() === activeBatchName);

      const query = searchTerm.trim().toLowerCase();
      const matchesSearch = !query || 
        (log.studentName && log.studentName.toLowerCase().includes(query)) ||
        (log.studentRollNumber && log.studentRollNumber.toLowerCase().includes(query)) ||
        (log.reason && log.reason.toLowerCase().includes(query)) ||
        (log.performedByName && log.performedByName.toLowerCase().includes(query)) ||
        (log.batchName && log.batchName.toLowerCase().includes(query));

      return matchesAction && matchesBatch && matchesSearch;
    });
  }, [logs, actionFilter, batchFilter, selectedBatchId, batchesList, searchTerm]);

  // Aggregate stats based on active/filtered batch scope
  const totalCount = filteredLogs.length;
  const suspendCount = filteredLogs.filter(l => l.action === 'suspend').length;
  const blockCount = filteredLogs.filter(l => l.action === 'block').length;
  const restoreCount = filteredLogs.filter(l => l.action === 'restore').length;

  const exportToExcel = () => {
    if (!filteredLogs.length) return;
    const exportData = filteredLogs.map(log => ({
      'Date & Time': new Date(log.createdAt).toLocaleString(),
      'Student Name': log.studentName || 'N/A',
      'Roll Number': log.studentRollNumber || 'N/A',
      'Batch': log.batchName || 'N/A',
      'Action': (log.action || '').toUpperCase(),
      'Reason / Note': log.reason || 'N/A',
      'Duration (Hours)': log.durationHours || (log.action === 'block' ? 'Permanent' : 'N/A'),
      'Suspended Until': log.suspendedUntil ? new Date(log.suspendedUntil).toLocaleString() : 'N/A',
      'Issued By': log.performedByName || 'Admin',
      'Issuer Role': (log.performedByRole || '').toUpperCase()
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Disciplinary_Records");
    XLSX.writeFile(workbook, `SSMS_Disciplinary_Records_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading && !refreshing) {
    return <SkeletonLoader type="logs" />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
              <ShieldAlert size={22} />
            </div>
            <span>{isStudent ? 'My Disciplinary Records & Standing' : 'Student Access & Disciplinary Records'}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            {isStudent 
              ? 'Official institutional log of your account standing, disciplinary holds, suspensions, and restorations.'
              : 'Institutional record of student panel blocks, temporary suspensions, and restorations.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => fetchLogs(true)}
            disabled={refreshing}
            className="p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Refresh Records"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
          {!isStudent && filteredLogs.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Download size={15} />
              <span>Export Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Student Active Standing Status Banner (Only for Student Role) */}
      {isStudent && (
        <div className={`p-5 rounded-3xl border shadow-sm flex items-start sm:items-center gap-4 ${
          user?.isBlocked 
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-200'
            : user?.isSuspended
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            user?.isBlocked 
              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' 
              : user?.isSuspended 
              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {user?.isBlocked ? <Ban size={24} /> : user?.isSuspended ? <Clock size={24} /> : <ShieldCheck size={24} />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <span>{user?.isBlocked ? 'Account Access Restricted (Blocked)' : user?.isSuspended ? 'Account Temporarily Suspended' : 'Clear Academic Standing'}</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                user?.isBlocked 
                  ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                  : user?.isSuspended
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              }`}>
                {user?.isBlocked ? 'Blocked' : user?.isSuspended ? 'Suspended' : 'Good Standing'}
              </span>
            </h3>
            <p className="text-xs opacity-90 mt-0.5">
              {user?.isBlocked 
                ? (user.blockReason ? `Reason: ${user.blockReason}` : 'Your panel access has been indefinitely blocked by faculty.')
                : user?.isSuspended
                ? `Suspension active until ${user.suspendedUntil ? new Date(user.suspendedUntil).toLocaleString() : 'prescribed duration'}. ${user.suspensionReason ? `Reason: ${user.suspensionReason}` : ''}`
                : 'You have zero active suspensions or holds. All assigned courses, chats, and modules are fully accessible.'}
            </p>
          </div>
        </div>
      )}

      {/* 4 Overview Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Records</span>
            <ShieldAlert size={16} className="text-indigo-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Historical audit actions</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Suspensions</span>
            <Clock size={16} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{suspendCount}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Temporary disciplinary holds</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-rose-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Blocked</span>
            <Ban size={16} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">{blockCount}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Access revoked</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Restored</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{restoreCount}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Access privileges reinstated</p>
        </div>
      </div>

      {/* Filter Toolbar (For Admin & Mentor) */}
      {!isStudent && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search student name, roll number, reason, issuer..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Batch Filter */}
            <select
              value={batchFilter}
              onChange={(e) => {
                const val = e.target.value;
                setBatchFilter(val);
                if (setSelectedBatchId) {
                  setSelectedBatchId(val);
                }
              }}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">{isMentor ? 'All Assigned Batches' : 'All Batches'}</option>
              {batchesList.map(b => (
                <option key={b._id} value={b._id}>{b.batchName}</option>
              ))}
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Actions</option>
              <option value="suspend">⏳ Suspensions</option>
              <option value="block">⛔ Permanent Blocks</option>
              <option value="restore">✅ Restored</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Records Table Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Date & Time</th>
                {!isStudent && <th className="py-3.5 px-4">Student</th>}
                <th className="py-3.5 px-4">Batch</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Reason / Notes</th>
                <th className="py-3.5 px-4">Duration / Expiry</th>
                <th className="py-3.5 px-4">Issued By</th>
                {!isStudent && <th className="py-3.5 px-4 text-center">History</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={isStudent ? 6 : 8} className="py-16 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck size={26} />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No disciplinary records found</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      {isStudent 
                        ? 'Your student account has clean standing with no suspensions or blocks logged.'
                        : 'No suspension or block actions match your current search or batch filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const isBlock = log.action === 'block';
                  const isSuspend = log.action === 'suspend';
                  const isRestore = log.action === 'restore';

                  return (
                    <tr key={log._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </td>

                      {/* Student Info (Admins & Mentors) */}
                      {!isStudent && (
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-800 dark:text-white">{log.studentName || 'Student'}</div>
                          <div className="text-[10px] font-mono text-slate-400">{log.studentRollNumber || '—'}</div>
                        </td>
                      )}

                      {/* Batch */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {log.batchName || 'General'}
                        </span>
                      </td>

                      {/* Action Pill */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isBlock && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                            <Ban size={12} /> Blocked
                          </span>
                        )}
                        {isSuspend && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Clock size={12} /> Suspended
                          </span>
                        )}
                        {isRestore && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 size={12} /> Restored
                          </span>
                        )}
                      </td>

                      {/* Reason / Notes */}
                      <td className="py-3.5 px-4 max-w-xs text-slate-700 dark:text-slate-300">
                        <p className="line-clamp-2">{log.reason || 'No specific reason stated'}</p>
                      </td>

                      {/* Duration / Expiry */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {isSuspend ? (
                          log.suspendedUntil ? (
                            <div>
                              <p className="font-bold text-amber-600 dark:text-amber-400">
                                Until {new Date(log.suspendedUntil).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">{log.durationHours || '?'}h duration</p>
                            </div>
                          ) : (
                            <span className="font-semibold">{log.durationHours ? `${log.durationHours} hours` : 'Temporary'}</span>
                          )
                        ) : isBlock ? (
                          <span className="font-bold text-red-500">Indefinite</span>
                        ) : (
                          <span className="text-emerald-500 font-bold">Access Restored</span>
                        )}
                      </td>

                      {/* Issued By */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-white">{log.performedByName || 'Faculty'}</div>
                        <span className={`inline-block px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider ${
                          log.performedByRole === 'admin'
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}>
                          {log.performedByRole || 'Admin'}
                        </span>
                      </td>

                      {/* History Modal Trigger for Admin / Mentor */}
                      {!isStudent && (
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryStudent({
                                _id: log.studentId,
                                name: log.studentName,
                                rollNumber: log.studentRollNumber
                              });
                              setHistoryModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors cursor-pointer"
                            title="View Student Full Access History"
                          >
                            <Eye size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Access History Modal for single student */}
      <AccessHistoryModal
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setHistoryStudent(null);
        }}
        targetStudent={historyStudent}
      />
    </div>
  );
};

export default AccessDisciplinaryRecords;
