import { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { Loader2, Upload, ExternalLink, Lock, Calendar, FileText as FileTextIcon, UploadCloud, Link as LinkIcon, AlignLeft, Download, CheckCircle, ChevronDown, ChevronUp, Clock, AlertTriangle, X, Award, Eye, Coins, Copy, Check } from 'lucide-react';
import SkeletonLoader from '../../components/SkeletonLoader';
import { soundManager } from '../../utils/soundManager';
import { sanitizeTaskHtml } from '../../utils/taskFormatter';

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; 
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  return `${dd}/${mm}/${yy} - ${timeStr}`;
};

const format12HourDateTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${dd}/${mm}/${yyyy}, ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
};

// Live real-time Countdown Timer with seconds for Task Deadlines
const TaskCountdownTimer = ({ dueDate, isSubmitted, submission }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dueDate) return null;

  const dueTime = new Date(dueDate).getTime();
  const diffMs = dueTime - now;

  // If student already submitted
  if (isSubmitted && submission) {
    const subTime = new Date(submission.submittedAt || submission.createdAt).getTime();
    const wasLate = subTime > dueTime;
    if (wasLate) {
      const delayMs = subTime - dueTime;
      const delayHours = Math.ceil(delayMs / (1000 * 60 * 60));
      const penalty = submission.latePenalty || delayHours;
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <Clock size={11} className="text-rose-500" />
          <span>Submitted {delayHours}h late (-{penalty} mark{penalty > 1 ? 's' : ''})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle size={11} className="text-emerald-500" />
        <span>Submitted on time</span>
      </span>
    );
  }

  // Not submitted yet - Active Countdown or Expired
  if (diffMs > 0) {
    const totalSec = Math.floor(diffMs / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const pad = (n) => String(n).padStart(2, '0');
    const isUrgent = diffMs < 3600000; // under 1 hour

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono font-black border transition-all ${
        isUrgent
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 animate-pulse'
          : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
      }`}>
        <Clock size={11} className={isUrgent ? 'text-amber-500 animate-spin' : 'text-indigo-500'} />
        <span>
          {d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`}
        </span>
      </span>
    );
  }

  // Deadline Expired (Overdue)
  const overdueMs = Math.abs(diffMs);
  const overdueHours = Math.ceil(overdueMs / (1000 * 60 * 60));
  const penalty = overdueHours;

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
      <AlertTriangle size={11} className="text-rose-500 shrink-0" />
      <span>Expired (-{penalty} mark{penalty > 1 ? 's' : ''} penalty)</span>
    </span>
  );
};

const MyTasks = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEnrolled, setIsEnrolled] = useState(true); // default to true until checked
  const [activeTask, setActiveTask] = useState(null);
  const [selectedTaskForDetails, setSelectedTaskForDetails] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [studentSubmittedLinks, setStudentSubmittedLinks] = useState([]);
  const handledDeepLinkRef = useRef(null);
  const { themeColor, activeTheme, fetchCounts } = useOutletContext() || {};
  
  const [subData, setSubData] = useState({ 
    submissionType: 'text', 
    textContent: '', 
    linkUrl: '', 
    remarks: '' 
  });

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link', 'clean']
    ]
  };

  const fetchTasks = async () => {
    try {
      // First check if enrolled
      const enrollRes = await axios.get('/enrollments/my');
      const approvedEnrollments = enrollRes.data.filter(e => e.status === 'approved');
      
      if (approvedEnrollments.length === 0) {
        setIsEnrolled(false);
        setLoading(false);
        return; // Don't fetch tasks if not enrolled
      }

      setIsEnrolled(true);
      const [tasksRes, subsRes] = await Promise.all([
        axios.get('/tasks'),
        axios.get('/submissions') // Returns student's submissions
      ]);
      
      // Sort tasks by allocation date (newest first)
      const sortedTasks = tasksRes.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      setTasks(sortedTasks);
      setSubmissions(subsRes.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  // Auto-open task details modal ONCE if navigating from a notification referencing a task
  useEffect(() => {
    const targetTaskId = searchParams.get('taskId') || location.state?.taskId;
    const targetTaskTitle = (searchParams.get('taskTitle') || location.state?.taskTitle || '').trim().toLowerCase();
    const deepLinkKey = `${targetTaskId || ''}::${targetTaskTitle}`;

    if ((targetTaskId || targetTaskTitle) && tasks.length > 0 && handledDeepLinkRef.current !== deepLinkKey) {
      const match = tasks.find(t => 
        (targetTaskId && t._id === targetTaskId) || 
        (targetTaskTitle && t.title?.toLowerCase() === targetTaskTitle) ||
        (targetTaskTitle && t.title?.toLowerCase().includes(targetTaskTitle))
      );
      if (match) {
        handledDeepLinkRef.current = deepLinkKey;
        setSelectedTaskForDetails(match);
      }
    }
  }, [tasks, searchParams, location.state]);

  const handleOpenSubmitModal = (task) => {
    setActiveTask(task);
    const existingSub = submissions.find(s => s.taskId?._id === task._id || s.taskId === task._id);
    if (existingSub) {
      setSubData({
        submissionType: existingSub.submissionType || 'text',
        textContent: existingSub.textContent || '',
        linkUrl: existingSub.linkUrl || '',
        remarks: existingSub.remarks || ''
      });
      setStudentSubmittedLinks(existingSub.submittedLinks || []);
    } else {
      setSubData({ submissionType: 'text', textContent: '', linkUrl: '', remarks: '' });
      const initialLinks = (task.requiredLinks || []).map(rl => ({ label: rl.label, url: '' }));
      setStudentSubmittedLinks(initialLinks);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (uploading || !activeTask) return;
    setUploading(true);
    try {
      let fileUrl = null;
      const submittedTaskMarks = activeTask.maxMarks || 0;

      const { data: resData } = await axios.post('/submissions', {
        taskId: activeTask._id,
        submissionType: subData.submissionType,
        textContent: subData.textContent,
        linkUrl: subData.linkUrl,
        fileUrl,
        remarks: subData.remarks,
        submittedLinks: studentSubmittedLinks
      });

      const coinsAwarded = resData?.coinsAwarded;
      const allocatedMarks = resData?.taskMarks || submittedTaskMarks;

      setActiveTask(null);
      setSelectedTaskForDetails(null);
      setSubData({ submissionType: 'text', textContent: '', linkUrl: '', remarks: '' });
      setStudentSubmittedLinks([]);
      await fetchTasks();
      if (typeof fetchCounts === 'function') {
        fetchCounts();
      }

      if (coinsAwarded > 0) {
        try {
          soundManager.playSuccess();
        } catch (_) {}

        Swal.fire({
          title: '🎉 Task Submitted!',
          html: `
            <div class="space-y-3 py-2 text-center">
              <div class="text-4xl animate-bounce">🪙</div>
              <p class="text-base font-bold text-slate-800 dark:text-slate-100">
                You earned <span class="text-amber-500 font-extrabold text-xl">+${coinsAwarded} Coins</span>!
              </p>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                10x multiplier awarded into your gamification balance based on ${allocatedMarks} allocated task marks.
              </p>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Awesome!',
          confirmButtonColor: '#6366f1'
        });
      } else {
        Swal.fire({ title: 'Success', text: 'Task submitted successfully!', icon: 'success' });
      }
    } catch (error) {
      Swal.fire({ title: 'Error', text: error.response?.data?.message || 'Error submitting task', icon: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleViewSubmission = async (sub) => {
    if (sub.submittedLinks && sub.submittedLinks.length > 0 || sub.submissionType === 'text') {
      try {
        Swal.fire({
          title: 'Loading Submission...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        const { data: fullSub } = await axios.get(`/submissions/${sub._id}`);
        Swal.close();
        
        const newWin = window.open('', '_blank');
        if (newWin) {
          const linksHtml = fullSub.submittedLinks && fullSub.submittedLinks.length > 0
            ? `<div style="margin: 20px 0; background: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #16a34a; font-size: 18px; font-family: inherit;">Submitted Links</h3>
                <ul style="padding-left: 20px; margin: 0;">
                  ${fullSub.submittedLinks.map(link => `
                    <li style="margin-bottom: 10px; font-size: 15px;">
                      <strong style="color: #1e293b;">${link.label}:</strong> 
                      <a href="${link.url}" target="_blank" style="color: #2563eb; text-decoration: underline; word-break: break-all; font-weight: 500;">
                        ${link.url}
                      </a>
                    </li>
                  `).join('')}
                </ul>
              </div>`
            : '';

          newWin.document.write(`
            <html>
              <head>
                <title>Submitted Work</title>
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; color: #333; }
                  .ql-editor { font-size: 16px; }
                  .remarks { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 20px; }
                </style>
                <link rel="stylesheet" href="https://cdn.quilljs.com/1.3.6/quill.snow.css" />
              </head>
              <body>
                <h2 style="margin-bottom: 5px;">My Submitted Work</h2>
                <p style="color: #666; margin-top: 0; font-size: 14px;">Submitted on: ${formatDateTime(fullSub.submittedAt || fullSub.createdAt)}</p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;" />
                ${linksHtml}
                ${fullSub.textContent && fullSub.textContent !== '<p><br></p>' && fullSub.textContent !== '' ? `<div class="ql-editor" style="padding: 0;">${fullSub.textContent}</div>` : ''}
                ${fullSub.remarks ? `<div class="remarks"><h4 style="margin-top: 0;">Remarks</h4><p style="margin-bottom: 0;">${fullSub.remarks}</p></div>` : ''}
              </body>
            </html>
          `);
          newWin.document.close();
        }
      } catch (error) {
        Swal.close();
        console.error('Error fetching submission details:', error);
        Swal.fire('Error', 'Could not fetch submission details.', 'error');
      }
    } else if (sub.submissionType === 'link' && sub.linkUrl) {
      window.open(sub.linkUrl, '_blank');
    } else if (sub.submissionType === 'file' && sub.fileUrl) {
      const url = sub.fileUrl.startsWith('http') ? sub.fileUrl : `${import.meta.env.VITE_API_URL}${sub.fileUrl}`;
      window.open(url, '_blank');
    }
  };

  const handleViewTaskText = (task) => {
    setSelectedTaskForDetails(task);
  };

  if (loading) return <SkeletonLoader type="table" />;

  if (!isEnrolled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-24 h-24 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6">
          <FileTextIcon size={40} className="text-rose-500" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">No Batch Assigned</h2>
        <p className="text-slate-600 dark:text-slate-400 max-w-md text-base">
          You are not currently assigned to a batch. Please contact your Administrator or Mentor to be assigned to a batch.
        </p>
      </div>
    );
  }

  const lockedTasks = tasks.filter(task => task.isLocked);
  const activeTasks = tasks.filter(task => !task.isLocked);

  // Find next single locked task (unlocking earliest in the future)
  const nextLockedTask = [...lockedTasks].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Tasks</h1>

      {/* Next Scheduled Task Section */}
      {nextLockedTask && (
        <div className="glass-panel overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 p-5 bg-indigo-50/10 dark:bg-indigo-950/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-500">
                <Lock size={20} />
              </div>
              <div>
                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-900/50 uppercase tracking-wide">Next Scheduled Work</span>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white leading-tight mt-0.5">Scheduled Task ({nextLockedTask.batchId?.batchName})</h3>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Calendar size={13} className="text-slate-400" /> Due: {formatDateTime(nextLockedTask.dueDate)}</span>
              {nextLockedTask.maxMarks !== undefined && <span>Marks: {nextLockedTask.maxMarks}</span>}
              <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Lock size={12} /> Unlocks: {format12HourDateTime(nextLockedTask.scheduledAt)}
              </span>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {activeTasks.map(task => {
          const submission = submissions.find(s => s.taskId?._id === task._id || s.taskId === task._id);
          const isSubmitted = submission && submission.status !== 'resubmit';
          
          // Check if the task is new (created within the last 24 hours)
          const isNew = new Date(task.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000);
          
          // Check if the task is overdue
          const isOverdue = new Date() > new Date(task.dueDate) && !isSubmitted;

          return (
            <div key={task._id} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-black/50 p-6 sm:p-8 flex flex-col group hover:scale-[1.02] transition-transform duration-300 ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/5 rounded-full blur-2xl group-hover:bg-primary-500/10 transition-colors"></div>
              
              <div className="relative z-10 flex justify-between items-start mb-4">
                <div className="flex flex-col items-start gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-bold text-base text-slate-800 dark:text-white leading-tight">{task.title}</h3>
                    {isNew && (
                      <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest animate-pulse shadow-md shadow-rose-500/30">New</span>
                    )}
                    {isOverdue && (
                      <span className="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest border border-red-200 dark:border-red-800/50">Overdue</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">{task.batchId?.batchName}</span>
                    <TaskCountdownTimer dueDate={task.dueDate} isSubmitted={isSubmitted} submission={submission} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                      🎯 {task.maxMarks} Marks
                    </span>
                    <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1 shadow-2xs">
                      🪙 +{(Number(task.maxMarks) || 0) * 10} Coins on Submit
                    </span>
                  </div>
                </div>
              </div>
              
              {task.taskType === 'file' && task.fileUrl ? (
                <div className="mb-6 flex flex-col gap-2 flex-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Please download the instructions file below:</p>
                  <a 
                    href={task.fileUrl.startsWith('http') ? task.fileUrl : `${import.meta.env.VITE_API_URL}${task.fileUrl}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-2 text-theme-primary bg-primary-500/10 px-3 py-2 text-sm rounded-lg w-max hover:bg-primary-500/25 transition-colors font-bold shadow-sm cursor-pointer"
                  >
                    <FileTextIcon size={16} />
                    Download Instructions
                  </a>
                </div>
              ) : task.taskType === 'link' ? (
                <div className="mb-6 flex flex-col gap-2 flex-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Please visit the following link to view the task:</p>
                  <a 
                    href={task.linkUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 text-sm rounded-lg w-max hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors font-bold shadow-sm cursor-pointer"
                  >
                    <LinkIcon size={16} /> Open Task Link
                  </a>
                </div>
              ) : (
                <div className="mb-6 flex flex-col gap-2 flex-1">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Click below to view the full text instructions:</p>
                  <button 
                    onClick={() => handleViewTaskText(task)}
                    className="flex items-center gap-2 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 px-3 py-2 text-sm rounded-lg w-max hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors font-bold shadow-sm cursor-pointer"
                  >
                    <FileTextIcon size={16} /> View Task Details
                  </button>
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-700/50 pt-5 mt-auto">
                <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border whitespace-nowrap ${isOverdue ? 'text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900/30 dark:text-red-400' : 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900/30 dark:text-amber-400'}`}>
                  <Calendar size={14} /> Due: {formatDateTime(task.dueDate)}
                </div>
                {isSubmitted ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button 
                      onClick={() => handleViewSubmission(submission)}
                      className="text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                    >
                      <ExternalLink size={14} /> View Work
                    </button>
                    <span className={`px-4 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 shadow-sm whitespace-nowrap ${submission.status === 'graded' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50'}`}>
                      {submission.status === 'graded' ? 'Graded' : 'Submitted'}
                    </span>
                  </div>
                ) : (
                  <button onClick={() => handleOpenSubmitModal(task)} className="bg-gradient-to-r from-primary-500 to-theme-accent hover:from-primary-600 hover:to-theme-accent text-white font-bold py-2 px-5 text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-theme-primary/30 transition-all hover:-translate-y-0.5 whitespace-nowrap cursor-pointer">
                    <Upload size={18} /> {submission?.status === 'resubmit' ? 'Resubmit Task' : 'View & Submit'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="col-span-full p-8 text-center text-slate-500 dark:text-slate-400">No active tasks found for your batches.</div>
        )}
      </div>

      {activeTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50 dark:bg-white/5">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Submit Task</h2>
              <button onClick={() => setActiveTask(null)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300">&times;</button>
            </div>
            
            <div className="p-4 bg-primary-50/50 dark:bg-primary-900/10 border-b border-primary-100 dark:border-primary-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-primary-900 dark:text-primary-300">{activeTask.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Marks: {activeTask.maxMarks}</span>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1">
                    🪙 Earn +{(Number(activeTask.maxMarks) || 0) * 10} Gamification Coins
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deadline: {formatDateTime(activeTask.dueDate)}</span>
                <TaskCountdownTimer dueDate={activeTask.dueDate} isSubmitted={false} />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[85vh]">
              
              {activeTask.requiredLinks && activeTask.requiredLinks.length > 0 ? (
                /* Multiple Custom Links Submission Form */
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    Requested Submission Links
                  </h3>
                  {activeTask.requiredLinks.map((reqLink, idx) => {
                    const currentVal = studentSubmittedLinks.find(sl => sl.label === reqLink.label)?.url || '';
                    return (
                      <div key={idx} className="space-y-1.5">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>{reqLink.label}</span>
                          <span className={reqLink.isMandatory ? 'text-rose-500 font-bold text-xs' : 'text-slate-400 text-xs'}>
                            {reqLink.isMandatory ? 'Mandatory' : 'Optional'}
                          </span>
                        </label>
                        <input
                          required={reqLink.isMandatory}
                          type="url"
                          className="input-field"
                          placeholder="https://..."
                          value={currentVal}
                          onChange={(e) => {
                            const updated = [...studentSubmittedLinks];
                            const existingIdx = updated.findIndex(sl => sl.label === reqLink.label);
                            if (existingIdx > -1) {
                              updated[existingIdx].url = e.target.value;
                            } else {
                              updated.push({ label: reqLink.label, url: e.target.value });
                            }
                            setStudentSubmittedLinks(updated);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Standard Single Field Submission Form */
                <>
                  {/* Submission Type Toggle */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">How would you like to submit?</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                      <button 
                        type="button"
                        className={`flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${subData.submissionType === 'text' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        onClick={() => setSubData({...subData, submissionType: 'text'})}
                      >
                        <AlignLeft size={16} /> Text
                      </button>
                      <button 
                        type="button"
                        className={`flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${subData.submissionType === 'link' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                        onClick={() => setSubData({...subData, submissionType: 'link'})}
                      >
                        <LinkIcon size={16} /> Link
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Submission Input */}
                  {subData.submissionType === 'text' && (
                    <div className="flex flex-col">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Text / Code Submission</label>
                      <div className="bg-white dark:bg-slate-900 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <ReactQuill 
                          theme="snow" 
                          value={subData.textContent} 
                          onChange={(val) => setSubData({...subData, textContent: val})} 
                          modules={quillModules}
                          className="h-64 mb-12 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  {subData.submissionType === 'link' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Project Link / GitHub URL</label>
                      <input required type="url" className="input-field" placeholder="https://..." value={subData.linkUrl} onChange={e => setSubData({...subData, linkUrl: e.target.value})} />
                    </div>
                  )}
                </>
              )}

              {/* Remarks Box */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Remarks / Comments (Optional)</label>
                <textarea className="input-field" rows="2" placeholder="Any additional comments for the reviewer?" value={subData.remarks} onChange={e => setSubData({...subData, remarks: e.target.value})}></textarea>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setActiveTask(null)} className="flex-1 py-2 px-4 rounded-lg font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 transition-colors">Cancel</button>
                <button type="submit" disabled={uploading} className="flex-1 btn-primary flex justify-center items-center gap-2">
                  {uploading ? <Loader2 size={18} className="animate-spin" /> : null}
                  {uploading ? 'Submitting...' : 'Submit Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Details Modal (In-App Rich View) */}
      {selectedTaskForDetails && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {selectedTaskForDetails.batchId?.batchName || 'Active Batch'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {selectedTaskForDetails.category || 'General'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {selectedTaskForDetails.title}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedTaskForDetails(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Meta Highlights Banner */}
            <div className="px-6 py-3.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Calendar size={14} className="text-indigo-500" />
                  <span>Deadline: <strong className="text-slate-900 dark:text-white font-mono">{formatDateTime(selectedTaskForDetails.dueDate)}</strong></span>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Award size={14} className="text-amber-500" />
                  <span>Marks: <strong className="text-emerald-600 dark:text-emerald-400">{selectedTaskForDetails.maxMarks}</strong></span>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg border border-amber-500/20 dark:border-amber-500/30">
                  <Coins size={14} className="text-amber-500" />
                  <span>Reward: <strong className="font-mono text-amber-500 dark:text-amber-300">+{(Number(selectedTaskForDetails.maxMarks) || 0) * 10} Coins</strong></span>
                </div>
              </div>
              <TaskCountdownTimer 
                dueDate={selectedTaskForDetails.dueDate} 
                isSubmitted={!!submissions.find(s => (s.taskId?._id === selectedTaskForDetails._id || s.taskId === selectedTaskForDetails._id))}
                submission={submissions.find(s => (s.taskId?._id === selectedTaskForDetails._id || s.taskId === selectedTaskForDetails._id))}
              />
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-900">
              
              {/* Attached External Links / Files if any */}
              {selectedTaskForDetails.taskType === 'file' && selectedTaskForDetails.fileUrl && (
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <FileTextIcon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Attached Task File</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Download the reference or assignment file</p>
                    </div>
                  </div>
                  <a
                    href={selectedTaskForDetails.fileUrl.startsWith('http') ? selectedTaskForDetails.fileUrl : `${import.meta.env.VITE_API_URL}${selectedTaskForDetails.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={14} /> Download File
                  </a>
                </div>
              )}

              {selectedTaskForDetails.taskType === 'link' && selectedTaskForDetails.linkUrl && (
                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <LinkIcon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Task Reference Link</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">{selectedTaskForDetails.linkUrl}</p>
                    </div>
                  </div>
                  <a
                    href={selectedTaskForDetails.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <ExternalLink size={14} /> Open Link
                  </a>
                </div>
              )}

              {/* Task Instructions */}
              <div className="space-y-3 min-w-0 w-full">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <FileTextIcon size={14} /> Task Instructions & Details
                  </h4>
                  {selectedTaskForDetails.description && (
                    <button
                      type="button"
                      onClick={() => {
                        const tmp = document.createElement('div');
                        tmp.innerHTML = sanitizeTaskHtml(selectedTaskForDetails.description);
                        const plainText = (tmp.textContent || tmp.innerText || '').trim();
                        navigator.clipboard.writeText(plainText);
                        setCopiedInstructions(true);
                        setTimeout(() => setCopiedInstructions(false), 1800);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedInstructions ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy Text</>}
                    </button>
                  )}
                </div>
                <div className="bg-slate-50/90 dark:bg-slate-950/80 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner min-w-0 w-full overflow-hidden">
                  <div 
                    className="prose dark:prose-invert max-w-none text-slate-900 dark:text-slate-100 font-medium text-sm sm:text-base leading-relaxed !p-0 task-content-viewer min-w-0 w-full select-text"
                    dangerouslySetInnerHTML={{ __html: sanitizeTaskHtml(selectedTaskForDetails.description) || '<p class="text-slate-400 italic">No instructions provided.</p>' }}
                  />
                </div>
              </div>

              {/* Requested Student Submission Fields / Links */}
              {selectedTaskForDetails.requiredLinks && selectedTaskForDetails.requiredLinks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Required Submission Links
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTaskForDetails.requiredLinks.map((reqLink, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{reqLink.label}</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${reqLink.isMandatory ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                          {reqLink.isMandatory ? 'Mandatory' : 'Optional'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <button
                onClick={() => setSelectedTaskForDetails(null)}
                className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              {(() => {
                const detailSub = submissions.find(s => (s.taskId?._id === selectedTaskForDetails._id || s.taskId === selectedTaskForDetails._id));
                if (detailSub && detailSub.status !== 'resubmit') {
                  return (
                    <span className="px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle size={14} /> Already Submitted
                    </span>
                  );
                }
                return (
                  <button
                    onClick={() => {
                      const taskToSubmit = selectedTaskForDetails;
                      setSelectedTaskForDetails(null);
                      handleOpenSubmitModal(taskToSubmit);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-theme-accent hover:from-primary-600 hover:to-theme-accent text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload size={14} /> {detailSub?.status === 'resubmit' ? 'Resubmit Task' : 'Proceed to Submit'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyTasks;
