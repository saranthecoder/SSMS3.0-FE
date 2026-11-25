import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  FileBarChart2, Play, Send, Download, Eye, RefreshCw, Sliders,
  Users, CheckCircle2, AlertTriangle, FileSpreadsheet, FileText, Ban, Award
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useGlobalBatch } from '../../context/GlobalBatchContext';
import Loader from '../../components/Loader';
import PerformanceReportViewer from '../../components/PerformanceReportViewer';
import {
  exportStudentReportPDF,
  exportBatchSummaryPDF,
  exportBatchReportsExcel
} from '../../utils/reportExporter';

const PerformanceReports = () => {
  const { user } = useAuth();
  const { selectedBatchId, batchesList } = useGlobalBatch();
  const isAdmin = user?.role === 'admin';

  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const currentMonth = todayStr.slice(0, 7);

  const [activeBatchId, setActiveBatchId] = useState(
    (selectedBatchId && selectedBatchId !== 'all') ? selectedBatchId : (batchesList[0]?._id || '')
  );
  const [reportType, setReportType] = useState('weekly'); // weekly | monthly | cumulative
  const [month, setMonth] = useState(currentMonth);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(todayStr);

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState([]);
  const [batchAnalytics, setBatchAnalytics] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeReport, setActiveReport] = useState(null);

  // Admin-only states
  const [viewMode, setViewMode] = useState('batch'); // batch | admin-overview | weights
  const [adminOverview, setAdminOverview] = useState(null);
  const [weights, setWeights] = useState({
    attendance: 20,
    taskCompletion: 25,
    grades: 25,
    leetcode: 15,
    workingConsistency: 15
  });

  useEffect(() => {
    if (selectedBatchId && selectedBatchId !== 'all') {
      setActiveBatchId(selectedBatchId);
    } else if (!activeBatchId && batchesList.length > 0) {
      setActiveBatchId(batchesList[0]._id);
    }
  }, [selectedBatchId, batchesList]);

  const fetchBatchReports = async () => {
    if (!activeBatchId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportType) params.set('reportType', reportType);
      const { data } = await axios.get(`/reports/batch/${activeBatchId}?${params.toString()}`);
      setReports(Array.isArray(data?.reports) ? data.reports : []);
      setBatchAnalytics(data?.batchAnalytics || null);
      setSelectedIds([]);
    } catch (err) {
      console.error('Failed to fetch batch reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminExtras = async () => {
    if (!isAdmin) return;
    try {
      const [ovRes, cfgRes] = await Promise.all([
        axios.get('/reports/admin/overview'),
        axios.get('/reports/config')
      ]);
      setAdminOverview(ovRes.data);
      if (cfgRes.data?.weights) setWeights(cfgRes.data.weights);
    } catch (err) {
      console.error('Failed to load admin overview:', err);
    }
  };

  useEffect(() => {
    if (activeBatchId && viewMode === 'batch') {
      fetchBatchReports();
    }
  }, [activeBatchId, reportType, viewMode]);

  useEffect(() => {
    if (isAdmin && (viewMode === 'admin-overview' || viewMode === 'weights')) {
      fetchAdminExtras();
    }
  }, [isAdmin, viewMode]);

  const handleGenerateReports = async (regenerate = false) => {
    if (!activeBatchId) {
      return Swal.fire('Select Batch', 'Please select a batch first.', 'warning');
    }

    const confirmRes = await Swal.fire({
      title: regenerate ? 'Regenerate New Report Version?' : `Generate ${reportType.toUpperCase()} Reports?`,
      text: regenerate
        ? 'This will create a new version snapshot for this period using the latest database records.'
        : `This will compute ${reportType} performance snapshots for all students in the selected batch.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      confirmButtonText: 'Yes, Generate'
    });
    if (!confirmRes.isConfirmed) return;

    setGenerating(true);
    try {
      const payload = {
        batchId: activeBatchId,
        reportType,
        regenerate
      };
      if (reportType === 'monthly') payload.month = month;
      if (reportType === 'weekly') {
        if (startDate) payload.startDate = startDate;
        if (endDate) payload.endDate = endDate;
      }
      if (reportType === 'cumulative') {
        if (endDate) payload.endDate = endDate;
      }

      const { data } = await axios.post('/reports/generate', payload);
      Swal.fire({
        icon: 'success',
        title: 'Reports Generated',
        text: `Generated ${data.count} student report(s) for ${data.period?.startDate} to ${data.period?.endDate}.`,
        timer: 2000,
        showConfirmButton: false
      });
      await fetchBatchReports();
    } catch (err) {
      Swal.fire('Generation Failed', err.response?.data?.message || 'Could not generate reports', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleReleaseReports = async (targetReportIds = null) => {
    const ids = targetReportIds || selectedIds;
    if ((!ids || ids.length === 0) && !activeBatchId) return;

    const confirmRes = await Swal.fire({
      title: ids && ids.length > 0 ? `Release ${ids.length} Selected Report(s)?` : 'Release All Generated Reports?',
      text: 'Students will immediately receive a notification and gain access in My Performance Reports.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      confirmButtonText: 'Yes, Release'
    });
    if (!confirmRes.isConfirmed) return;

    try {
      const payload = ids && ids.length > 0
        ? { reportIds: ids }
        : { batchId: activeBatchId, reportType };
      const { data } = await axios.post('/reports/release', payload);
      Swal.fire({ icon: 'success', title: 'Released!', text: data.message, timer: 1800, showConfirmButton: false });
      await fetchBatchReports();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to release reports', 'error');
    }
  };

  const handleRevokeReport = async (reportId) => {
    const { value: reason } = await Swal.fire({
      title: 'Revoke Released Report?',
      input: 'text',
      inputPlaceholder: 'Reason for revoking...',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Revoke'
    });
    if (reason === undefined) return;
    try {
      await axios.post(`/reports/${reportId}/revoke`, { reason });
      Swal.fire({ icon: 'success', title: 'Report Revoked', timer: 1500, showConfirmButton: false });
      fetchBatchReports();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to revoke report', 'error');
    }
  };

  const handleSaveWeights = async (e) => {
    e.preventDefault();
    const total = Number(weights.attendance) + Number(weights.taskCompletion) + Number(weights.grades) + Number(weights.leetcode) + Number(weights.workingConsistency);
    if (total !== 100) {
      return Swal.fire('Invalid Weights', `Weights must sum to 100% (currently ${total}%).`, 'warning');
    }
    try {
      await axios.put('/reports/config', { weights });
      Swal.fire({ icon: 'success', title: 'Scoring Weights Saved', timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update weights', 'error');
    }
  };

  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const q = searchTerm.trim().toLowerCase();
      const name = (r.studentId?.name || r.dataSnapshot?.student?.name || '').toLowerCase();
      const roll = (r.studentId?.rollNumber || r.dataSnapshot?.student?.rollNumber || '').toLowerCase();
      if (q && !name.includes(q) && !roll.includes(q)) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      return true;
    });
  }, [reports, searchTerm, statusFilter]);

  const currentBatchName = batchesList.find(b => b._id === activeBatchId)?.batchName || 'Selected Batch';

  const chartData = useMemo(() => {
    return filteredReports.slice(0, 15).map(r => ({
      name: (r.studentId?.name || 'Student').split(' ')[0],
      consistency: r.dataSnapshot?.consistency?.overallScore ?? 0,
      attendance: r.dataSnapshot?.attendance?.attendancePercentage ?? 0,
      tasks: r.dataSnapshot?.tasks?.completionPercentage ?? 0
    }));
  }, [filteredReports]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart2 className="text-indigo-500" size={26} />
            Student Performance Reports &amp; Batch Analytics
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate, review, add mentor feedback, export, and release Weekly, Monthly, and Cumulative student reports.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start">
            {[
              { id: 'batch', label: 'Batch Reports' },
              { id: 'admin-overview', label: 'Cross-Batch Audit' },
              { id: 'weights', label: 'Scoring Weights' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                  viewMode === tab.id
                    ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {viewMode === 'weights' && isAdmin ? (
        <form onSubmit={handleSaveWeights} className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-700 max-w-2xl space-y-4">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders size={18} className="text-indigo-500" /> Configurable Consistency Score Weights (Must sum to 100%)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {[
              { key: 'attendance', label: 'Attendance Weight (%)' },
              { key: 'taskCompletion', label: 'Task Completion Weight (%)' },
              { key: 'grades', label: 'Assessments & Grades Weight (%)' },
              { key: 'leetcode', label: 'LeetCode Activity Weight (%)' },
              { key: 'workingConsistency', label: 'Working Consistency Weight (%)' }
            ].map(item => (
              <div key={item.key}>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">{item.label}</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights[item.key]}
                  onChange={(e) => setWeights(prev => ({ ...prev, [item.key]: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-900 dark:text-white"
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Note: When a student has insufficient data for any component (e.g., 0 graded assessments), that component is excluded and remaining weights are normalized automatically.
          </p>
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
            Save Global Scoring Weights
          </button>
        </form>
      ) : viewMode === 'admin-overview' && isAdmin ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Stored Reports</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{adminOverview?.totalReports ?? 0}</p>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-emerald-500 uppercase">Released to Students</p>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{adminOverview?.releasedTotal ?? 0}</p>
            </div>
            <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-xs font-bold text-amber-500 uppercase">Pending Release</p>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{adminOverview?.unreleasedTotal ?? 0}</p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 font-black text-xs uppercase text-slate-700 dark:text-slate-200">
              Cross-Batch Comparison &amp; Mentor Release Audit
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Mentor</th>
                    <th className="py-3 px-4 text-center">Total Reports</th>
                    <th className="py-3 px-4 text-center">Released</th>
                    <th className="py-3 px-4 text-center">Unreleased</th>
                    <th className="py-3 px-4 text-center">Avg Attendance</th>
                    <th className="py-3 px-4 text-center">Avg Tasks</th>
                    <th className="py-3 px-4 text-center">Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(adminOverview?.batchComparison || []).map(b => (
                    <tr key={b.batchId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{b.batchName}</td>
                      <td className="py-3 px-4">{b.mentorName}</td>
                      <td className="py-3 px-4 text-center font-bold">{b.totalReports}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">{b.releasedCount}</td>
                      <td className="py-3 px-4 text-center font-bold text-amber-600">{b.unreleasedCount}</td>
                      <td className="py-3 px-4 text-center">{b.avgAttendancePct}%</td>
                      <td className="py-3 px-4 text-center">{b.avgTaskPct}%</td>
                      <td className="py-3 px-4 text-center font-black text-indigo-600">{b.avgConsistencyScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Generator Control Bar */}
          <div className="glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-700/70 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Target Batch</label>
                <select
                  value={activeBatchId}
                  onChange={(e) => setActiveBatchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white"
                >
                  {batchesList.map(b => (
                    <option key={b._id} value={b._id}>{b.batchName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Report Type</label>
                <select
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white"
                >
                  <option value="weekly">Weekly Report (Mon–Sun)</option>
                  <option value="monthly">Monthly Report</option>
                  <option value="cumulative">Overall Cumulative (Joining → End Date)</option>
                </select>
              </div>

              {reportType === 'monthly' ? (
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Select Month</label>
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white"
                  />
                </div>
              ) : reportType === 'weekly' ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Week Start (Optional)</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Week End (Optional)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">Cumulative End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    max={todayStr}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleGenerateReports(false)}
                  disabled={generating || !activeBatchId}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Play size={14} /> {generating ? 'Generating...' : 'Generate Reports'}
                </button>
                <button
                  onClick={() => handleGenerateReports(true)}
                  disabled={generating || !activeBatchId}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw size={14} /> Regenerate New Version
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => handleReleaseReports(selectedIds)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={14} /> Release Selected ({selectedIds.length})
                  </button>
                )}
                {reports.some(r => r.status !== 'released' && r.status !== 'revoked') && (
                  <button
                    onClick={() => handleReleaseReports(null)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={14} /> Release All Pending
                  </button>
                )}
                {filteredReports.length > 0 && (
                  <>
                    <button
                      onClick={() => exportBatchSummaryPDF(currentBatchName, reportType, filteredReports, batchAnalytics)}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={14} /> Batch PDF
                    </button>
                    <button
                      onClick={() => exportBatchReportsExcel(currentBatchName, reportType, filteredReports, 'xlsx')}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FileSpreadsheet size={14} /> Excel
                    </button>
                    <button
                      onClick={() => exportBatchReportsExcel(currentBatchName, reportType, filteredReports, 'csv')}
                      className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Download size={14} /> CSV
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Batch Analytics Summary */}
          {batchAnalytics && reports.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                {[
                  { label: 'Reports', val: batchAnalytics.totalReports },
                  { label: 'Released', val: `${batchAnalytics.releasedCount}/${batchAnalytics.totalReports}` },
                  { label: 'Viewed', val: batchAnalytics.viewedCount },
                  { label: 'Avg Attendance', val: `${batchAnalytics.avgAttendancePct}%` },
                  { label: 'Avg Tasks', val: `${batchAnalytics.avgTaskCompletionPct}%` },
                  { label: 'Avg Grade', val: batchAnalytics.avgGradePct !== null ? `${batchAnalytics.avgGradePct}%` : 'N/A' },
                  { label: 'Avg OS / WFH', val: `${batchAnalytics.avgOnsiteHours}h / ${batchAnalytics.avgWfhHours}h` },
                  { label: 'Avg Score', val: `${batchAnalytics.avgConsistencyScore}%` }
                ].map((k, idx) => (
                  <div key={idx} className="glass-panel p-3 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <p className="text-[10px] font-bold uppercase text-slate-400">{k.label}</p>
                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{k.val}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                  <h3 className="text-xs font-black uppercase text-slate-700 dark:text-slate-200 mb-3">
                    Batch Performance Comparison (Consistency, Attendance, Tasks)
                  </h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="consistency" name="Score %" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="attendance" name="Attendance %" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="tasks" name="Tasks %" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 overflow-y-auto max-h-72">
                  <h3 className="text-xs font-black uppercase text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> Students Needing Attention ({batchAnalytics.studentsNeedingAttention?.length || 0})
                  </h3>
                  {batchAnalytics.studentsNeedingAttention?.length > 0 ? (
                    <div className="space-y-2 text-xs">
                      {batchAnalytics.studentsNeedingAttention.map(s => (
                        <div key={s.reportId} className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                          <p className="font-bold text-slate-900 dark:text-white">{s.name} ({s.rollNumber})</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            Att: {s.attendancePct}% • Overdue: {s.overdueTasks} • Grade Trend: {s.gradeTrend}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No students flagged in this period.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Filter & Reports Table */}
          <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <input
                type="text"
                placeholder="Search student name or roll number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs w-64"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
              >
                <option value="all">All Statuses</option>
                <option value="generated">Generated</option>
                <option value="in_review">In Review</option>
                <option value="released">Released</option>
                <option value="revoked">Revoked</option>
              </select>
            </div>

            {loading ? (
              <div className="p-12"><Loader /></div>
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500">
                No {reportType} reports generated yet for this batch. Click <b>Generate Reports</b> above to build snapshots.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredReports.length && filteredReports.length > 0}
                          onChange={(e) => setSelectedIds(e.target.checked ? filteredReports.map(r => r._id) : [])}
                        />
                      </th>
                      <th className="py-3 px-3">Student</th>
                      <th className="py-3 px-3">Period</th>
                      <th className="py-3 px-3 text-center">Attendance</th>
                      <th className="py-3 px-3 text-center">Tasks</th>
                      <th className="py-3 px-3 text-center">Grade</th>
                      <th className="py-3 px-3 text-center">OS / WFH</th>
                      <th className="py-3 px-3 text-center">LeetCode</th>
                      <th className="py-3 px-3 text-center">Score</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredReports.map(r => {
                      const s = r.dataSnapshot || {};
                      return (
                        <tr key={r._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(r._id)}
                              onChange={(e) => setSelectedIds(prev => e.target.checked ? [...prev, r._id] : prev.filter(id => id !== r._id))}
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <p className="font-bold text-slate-900 dark:text-white">{r.studentId?.name || s.student?.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{r.studentId?.rollNumber || s.student?.rollNumber}</p>
                          </td>
                          <td className="py-2.5 px-3 text-[11px]">
                            {r.startDate} → {r.endDate} <span className="text-slate-400">(v{r.version})</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">{s.attendance?.attendancePercentage ?? 0}%</td>
                          <td className="py-2.5 px-3 text-center">{s.tasks?.completed ?? 0}/{s.tasks?.assigned ?? 0}</td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {s.grades?.evaluatedAvailable ? `${s.grades.averagePercentage}%` : 'Not Eval'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {s.workingHours?.onsite?.totalHours ?? 0}h / {s.workingHours?.wfh?.totalHours ?? 0}h
                          </td>
                          <td className="py-2.5 px-3 text-center">{s.leetcode?.totalSolved ?? 0}/{s.leetcode?.totalAssigned ?? 0}</td>
                          <td className="py-2.5 px-3 text-center font-black text-indigo-600 dark:text-indigo-400">
                            {s.consistency?.overallScore ?? 0}%
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              r.status === 'released'
                                ? 'bg-emerald-500/15 text-emerald-600'
                                : r.status === 'revoked'
                                  ? 'bg-rose-500/15 text-rose-600'
                                  : 'bg-amber-500/15 text-amber-600'
                            }`}>
                              {r.status}
                            </span>
                            {r.viewedByStudentAt && (
                              <span className="block text-[9px] text-emerald-500 mt-0.5">Viewed</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => setActiveReport(r)}
                                className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 font-bold hover:bg-indigo-100 cursor-pointer flex items-center gap-1"
                              >
                                <Eye size={12} /> Review
                              </button>
                              {r.status !== 'released' && r.status !== 'revoked' && (
                                <button
                                  onClick={() => handleReleaseReports([r._id])}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 font-bold hover:bg-emerald-100 cursor-pointer"
                                >
                                  Release
                                </button>
                              )}
                              {isAdmin && r.status === 'released' && (
                                <button
                                  onClick={() => handleRevokeReport(r._id)}
                                  className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                                  title="Revoke Report"
                                >
                                  <Ban size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => exportStudentReportPDF(r)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                                title="Export PDF"
                              >
                                <Download size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeReport && (
        <PerformanceReportViewer
          report={activeReport}
          onClose={() => setActiveReport(null)}
          canEditFeedback={true}
          onFeedbackSaved={(updated) => {
            setActiveReport(updated);
            fetchBatchReports();
          }}
          onReleaseReport={(id) => {
            setActiveReport(null);
            handleReleaseReports([id]);
          }}
        />
      )}
    </div>
  );
};

export default PerformanceReports;
