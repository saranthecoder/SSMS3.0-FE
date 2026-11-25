import { useState, useEffect } from 'react';
import axios from 'axios';
import { FileBarChart2, Download, Eye, Calendar, Award, CheckCircle2, Clock } from 'lucide-react';
import Loader from '../../components/Loader';
import PerformanceReportViewer from '../../components/PerformanceReportViewer';
import { exportStudentReportPDF } from '../../utils/reportExporter';

const MyReports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all'); // all, weekly, monthly, cumulative
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchMyReports = async () => {
    setLoading(true);
    try {
      const params = filterType !== 'all' ? `?reportType=${filterType}` : '';
      const { data } = await axios.get(`/reports/my${params}`);
      setReports(Array.isArray(data?.reports) ? data.reports : []);
    } catch (err) {
      console.error('Failed to fetch my reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReports();
  }, [filterType]);

  const handleOpenReport = async (rep) => {
    try {
      const { data } = await axios.get(`/reports/${rep._id}`);
      setSelectedReport(data);
    } catch (err) {
      setSelectedReport(rep);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileBarChart2 className="text-indigo-500" size={26} />
            My Performance Reports
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Official Weekly, Monthly, and Cumulative performance reports released by your mentor.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          {[
            { id: 'all', label: 'All' },
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'cumulative', label: 'Overall Progress' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="p-12"><Loader /></div>
      ) : reports.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-700">
          <FileBarChart2 size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-white">No Released Reports Yet</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Your Weekly, Monthly, and Overall Progress reports will appear here once reviewed and released by your mentor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reports.map(rep => {
            const snap = rep.dataSnapshot || {};
            const cons = snap.consistency || {};
            const att = snap.attendance || {};
            const tasks = snap.tasks || {};
            const grades = snap.grades || {};

            return (
              <div
                key={rep._id}
                className="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between gap-4 hover:shadow-lg transition-all"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                      {rep.reportType === 'cumulative' ? 'Overall Cumulative' : rep.reportType}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <Calendar size={11} /> {rep.startDate} → {rep.endDate}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {rep.batchId?.batchName || snap.batch?.batchName || 'Batch Report'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Released on {rep.releasedAt ? new Date(rep.releasedAt).toLocaleDateString('en-GB') : '—'} • v{rep.version || 1}
                  </p>

                  <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Consistency</span>
                      <span className="text-base font-black text-indigo-600 dark:text-indigo-400">{cons.overallScore ?? 0}%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Attendance</span>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400">{att.attendancePercentage ?? 0}%</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Tasks Done</span>
                      <span className="text-base font-black text-sky-600 dark:text-sky-400">{tasks.completed ?? 0}/{tasks.assigned ?? 0}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Avg Grade</span>
                      <span className="text-base font-black text-amber-600 dark:text-amber-400">
                        {grades.evaluatedAvailable ? `${grades.averagePercentage}%` : 'Not Eval'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => handleOpenReport(rep)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={14} /> View Full Report
                  </button>
                  <button
                    onClick={() => exportStudentReportPDF(rep)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                    title="Download PDF"
                  >
                    <Download size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedReport && (
        <PerformanceReportViewer
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          canEditFeedback={false}
        />
      )}
    </div>
  );
};

export default MyReports;
