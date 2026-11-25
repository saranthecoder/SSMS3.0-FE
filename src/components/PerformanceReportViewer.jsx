import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import {
  X, Download, Award, Calendar, CheckCircle2, Clock, Code2,
  TrendingUp, Building2, Home, ShieldCheck, FileText, Sparkles, AlertTriangle
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { exportStudentReportPDF } from '../utils/reportExporter';

const PerformanceReportViewer = ({
  report,
  onClose,
  canEditFeedback = false,
  onFeedbackSaved,
  onReleaseReport
}) => {
  const [feedback, setFeedback] = useState({
    overallObservation: '',
    strengths: '',
    areasForImprovement: '',
    academicFeedback: '',
    codingFeedback: '',
    attendanceFeedback: '',
    workDisciplineFeedback: '',
    nextMonthGoals: '',
    recommendedPractice: '',
    suggestedRoadmap: ''
  });
  const [savingFeedback, setSavingFeedback] = useState(false);

  useEffect(() => {
    if (report?.mentorFeedback) {
      setFeedback({
        overallObservation: report.mentorFeedback.overallObservation || '',
        strengths: report.mentorFeedback.strengths || '',
        areasForImprovement: report.mentorFeedback.areasForImprovement || '',
        academicFeedback: report.mentorFeedback.academicFeedback || '',
        codingFeedback: report.mentorFeedback.codingFeedback || '',
        attendanceFeedback: report.mentorFeedback.attendanceFeedback || '',
        workDisciplineFeedback: report.mentorFeedback.workDisciplineFeedback || '',
        nextMonthGoals: report.mentorFeedback.nextMonthGoals || '',
        recommendedPractice: report.mentorFeedback.recommendedPractice || '',
        suggestedRoadmap: report.mentorFeedback.suggestedRoadmap || ''
      });
    }
  }, [report]);

  if (!report) return null;

  const snap = report.dataSnapshot || {};
  const student = snap.student || report.studentId || {};
  const batch = snap.batch || report.batchId || {};
  const period = snap.period || { reportType: report.reportType, startDate: report.startDate, endDate: report.endDate };
  const att = snap.attendance || {};
  const wh = snap.workingHours || {};
  const tasks = snap.tasks || {};
  const grades = snap.grades || {};
  const lc = snap.leetcode || {};
  const lb = snap.leaderboard || {};
  const cons = snap.consistency || {};

  const handleSaveFeedback = async () => {
    setSavingFeedback(true);
    try {
      const { data } = await axios.put(`/reports/${report._id}/feedback`, feedback);
      Swal.fire({ icon: 'success', title: 'Feedback Saved', timer: 1400, showConfirmButton: false });
      if (onFeedbackSaved) onFeedbackSaved(data.report);
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save mentor feedback', 'error');
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-left">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                {period.reportType} Report • v{report.version || 1}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                report.status === 'released'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : report.status === 'revoked'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
              }`}>
                {report.status}
              </span>
            </div>
            <h2 className="text-lg font-black mt-1">
              {student.name || 'Student'} <span className="text-slate-400 font-mono text-xs">({student.rollNumber || 'N/A'})</span>
            </h2>
            <p className="text-xs text-slate-400">
              {batch.batchName || 'Batch'} • Period: {period.startDate} to {period.endDate} • Joined: {student.joiningDate || report.joiningDate || 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportStudentReportPDF(report)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Download size={14} /> Export PDF
            </button>
            {canEditFeedback && report.status !== 'released' && onReleaseReport && (
              <button
                onClick={() => onReleaseReport(report._id)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck size={14} /> Release to Student
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Top KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/50">
              <p className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400">Consistency Score</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{cons.overallScore ?? 0}%</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Normalized ({cons.activeWeightSum ?? 100}% wt)</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
              <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Attendance</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{att.attendancePercentage ?? 0}%</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{att.presentDays ?? 0}/{att.eligibleTrainingDays ?? 0} days</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50">
              <p className="text-[10px] font-bold uppercase text-sky-600 dark:text-sky-400">Tasks Completed</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{tasks.completionPercentage ?? 0}%</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{tasks.completed ?? 0}/{tasks.assigned ?? 0} ({tasks.overdue ?? 0} overdue)</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50">
              <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Avg Grade</p>
              <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {grades.evaluatedAvailable ? `${grades.averagePercentage}%` : 'Not Eval'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{grades.trendLabel || 'N/A'}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-800/50">
              <p className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400">Working Hours</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{wh.total?.totalHours ?? 0}h</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">OS: {wh.onsite?.totalHours ?? 0}h • WFH: {wh.wfh?.totalHours ?? 0}h</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200/70 dark:border-cyan-800/50">
              <p className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400">LeetCode &amp; Rank</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{lc.totalSolved ?? 0}/{lc.totalAssigned ?? 0}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Rank #{lb.periodRank || lb.currentRank || 'N/A'} ({lb.rankLabel || 'Snapshot'})</p>
            </div>
          </div>

          {/* Transparent Score Calculation Breakdown */}
          {Array.isArray(cons.breakdown) && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-500" /> Transparent Score Methodology (Normalized Active Weights)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {cons.breakdown.map(b => (
                  <div key={b.key} className={`p-2.5 rounded-xl border text-xs ${
                    b.available
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                      : 'bg-slate-100/60 dark:bg-slate-900/40 border-dashed border-slate-300 dark:border-slate-700 opacity-60'
                  }`}>
                    <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                      <span className="truncate">{b.label}</span>
                      <span>{b.available ? `${b.normalizedWeight}%` : 'Excluded'}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {b.available ? `Score: ${b.score}% (+${b.weightedContribution})` : 'No data in period'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charts: Working Hours (On-Site vs WFH) + Grade Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <Clock size={14} className="text-emerald-500" /> On-Site vs WFH Hours Trend
              </h3>
              {Array.isArray(wh.dailyTrend) && wh.dailyTrend.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={wh.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="onsiteHours" name="On-Site (h)" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="wfhHours" name="WFH (h)" fill="#0ea5e9" stackId="a" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-10 text-center">No valid work session records in this period.</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-indigo-500" /> Assessment Grade Progression
              </h3>
              {Array.isArray(grades.trendSeries) && grades.trendSeries.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={grades.trendSeries}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="percentage" name="Score %" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-10 text-center">Not Evaluated — no graded assessments in this period.</p>
              )}
            </div>
          </div>

          {/* Strengths & Improvement Areas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
              <h4 className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Data-Driven Strengths
              </h4>
              {Array.isArray(snap.strengths) && snap.strengths.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                  {snap.strengths.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Insufficient data to highlight strengths in this period.</p>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
              <h4 className="text-xs font-black uppercase text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={14} /> Areas Requiring Attention
              </h4>
              {Array.isArray(snap.improvementAreas) && snap.improvementAreas.length > 0 ? (
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300 list-disc pl-4">
                  {snap.improvementAreas.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No critical gaps flagged in this reporting period.</p>
              )}
            </div>
          </div>

          {/* Task Performance Table */}
          {Array.isArray(tasks.details) && tasks.details.length > 0 && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-100 dark:bg-slate-800 font-black text-xs uppercase text-slate-700 dark:text-slate-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><FileText size={14} /> Task Breakdown ({tasks.details.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Task</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Deadline</th>
                      <th className="py-2.5 px-3">Submitted</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tasks.details.map(t => (
                      <tr key={t.taskId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-200">{t.title}</td>
                        <td className="py-2 px-3">{t.category}</td>
                        <td className="py-2 px-3">{t.deadline}</td>
                        <td className="py-2 px-3">{t.submissionDate || '—'}</td>
                        <td className="py-2 px-3 font-semibold">{t.completionStatus} ({t.onTimeStatus})</td>
                        <td className="py-2 px-3 font-bold">{t.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mentor Feedback Section */}
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white flex items-center gap-1.5">
                <Award size={15} className="text-indigo-500" /> Mentor Feedback &amp; Recommendations
              </h3>
              {canEditFeedback && (
                <button
                  onClick={handleSaveFeedback}
                  disabled={savingFeedback}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {savingFeedback ? 'Saving...' : 'Save Feedback'}
                </button>
              )}
            </div>

            {canEditFeedback ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { key: 'overallObservation', label: 'Overall Observation' },
                  { key: 'strengths', label: 'Key Strengths' },
                  { key: 'areasForImprovement', label: 'Areas for Improvement' },
                  { key: 'academicFeedback', label: 'Academic & Task Feedback' },
                  { key: 'codingFeedback', label: 'Coding & LeetCode Feedback' },
                  { key: 'nextMonthGoals', label: 'Next Period Goals & Roadmap' }
                ].map(f => (
                  <div key={f.key}>
                    <label className="block font-bold text-slate-600 dark:text-slate-300 mb-1">{f.label}</label>
                    <textarea
                      rows={2}
                      value={feedback[f.key]}
                      onChange={(e) => setFeedback(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={`Enter ${f.label.toLowerCase()}...`}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { key: 'overallObservation', label: 'Overall Observation' },
                  { key: 'strengths', label: 'Key Strengths' },
                  { key: 'areasForImprovement', label: 'Areas for Improvement' },
                  { key: 'academicFeedback', label: 'Academic & Task Feedback' },
                  { key: 'codingFeedback', label: 'Coding & LeetCode Feedback' },
                  { key: 'nextMonthGoals', label: 'Next Period Goals & Roadmap' }
                ].map(f => (
                  <div key={f.key} className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{f.label}</p>
                    <p className="text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{feedback[f.key] || 'No remarks added.'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerformanceReportViewer;
