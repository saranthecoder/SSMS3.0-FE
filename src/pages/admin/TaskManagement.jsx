import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { BookOpen, Plus, FileText as FileTextIcon, Edit, Trash2, Link as LinkIcon, RefreshCw, Search, RotateCcw, CheckCircle, Clock, Calendar, Award, Tag, X, ExternalLink, Download, Eye, Coins, FileSpreadsheet } from 'lucide-react';
import SkeletonLoader from '../../components/SkeletonLoader';
import { useAuth } from '../../context/AuthContext';
import { useGlobalBatch } from '../../context/GlobalBatchContext';
import { sanitizeTaskHtml } from '../../utils/taskFormatter';

// Live real-time Countdown Timer for Modal & Cards
const TaskCountdownTimer = ({ dueDate }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!dueDate) return null;
  const dueTime = new Date(dueDate).getTime();
  const diffMs = dueTime - now;

  if (diffMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
        <Clock size={12} className="text-rose-500" />
        <span>Deadline Expired</span>
      </span>
    );
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs font-mono">
      <Clock size={12} className="text-emerald-500 animate-pulse" />
      <span>
        {days > 0 ? `${days}d ` : ''}
        {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')} left
      </span>
    </span>
  );
};

const formatDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'N/A';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  return `${dd}/${mm}/${yyyy}, ${timeStr}`;
};

const TaskManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { selectedBatchId, selectedBatchName, batchesList } = useGlobalBatch();
  const [tasks, setTasks] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskForView, setSelectedTaskForView] = useState(null);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryParam = (selectedBatchId && selectedBatchId !== 'all') ? `?batchId=${selectedBatchId}` : '';
      const [tasksRes, batchesRes] = await Promise.all([
        axios.get(`/tasks${queryParam}`),
        axios.get('/batches')
      ]);
      setTasks(tasksRes.data);
      setBatches(batchesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchData(); 
  }, [selectedBatchId]);

  // Auto-open preview modal if navigating from a notification referencing a task
  useEffect(() => {
    const targetTaskId = searchParams.get('taskId') || location.state?.taskId;
    const targetTaskTitle = (searchParams.get('taskTitle') || location.state?.taskTitle || '').trim().toLowerCase();
    
    if ((targetTaskId || targetTaskTitle) && tasks.length > 0) {
      const match = tasks.find(t => 
        (targetTaskId && t._id === targetTaskId) || 
        (targetTaskTitle && t.title?.toLowerCase() === targetTaskTitle) ||
        (targetTaskTitle && t.title?.toLowerCase().includes(targetTaskTitle))
      );
      if (match) {
        setSelectedTaskForView(match);
      }
    }
  }, [tasks, searchParams, location.state]);

  // Tab synchronization: Auto-refresh when localStorage change notification triggers
  useEffect(() => {
    const handleSyncRefresh = (e) => {
      if (e.key === 'task_management_refresh') {
        fetchData();
      }
    };
    window.addEventListener('storage', handleSyncRefresh);
    return () => window.removeEventListener('storage', handleSyncRefresh);
  }, []);

  const openCreateModal = () => {
    navigate('/tasks/create');
  };

  const handleEdit = (task) => {
    navigate(`/tasks/edit/${task._id}`);
  };

  const handleDelete = async (taskId) => {
    const result = await Swal.fire({
      title: 'Delete Task?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/tasks/${taskId}`);
        fetchData();
        Swal.fire('Deleted!', 'Task has been deleted.', 'success');
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete task.', 'error');
      }
    }
  };

  const handleAssignNow = async (task) => {
    const result = await Swal.fire({
      title: 'Assign Task Now?',
      text: 'This will publish the task immediately, making it visible to all students of the batch.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, assign now!'
    });

    if (result.isConfirmed) {
      try {
        await axios.put(`/tasks/${task._id}`, {
          scheduledAt: null
        });
        fetchData();
        
        // Trigger cross-tab local storage update notification
        localStorage.setItem('task_management_refresh', Date.now().toString());

        Swal.fire({
          title: 'Assigned!',
          text: 'Task has been assigned immediately.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not assign task.', 'error');
      }
    }
  };

  const handleViewTaskText = (task) => {
    setSelectedTaskForView(task);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterCategory('All');
  };

  const filteredTasks = tasks.filter(task => {
    const titleText = task.title || '';
    const descText = task.description || '';
    const matchesSearch = 
      titleText.toLowerCase().includes(searchTerm.toLowerCase()) || 
      descText.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = 
      filterCategory === 'All' || 
      task.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  if (loading) return <SkeletonLoader type="card-grid" />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Task Management</h1>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => navigate('/tasks/bulk')}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-5 text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 whitespace-nowrap w-full sm:w-auto cursor-pointer"
          >
            <FileSpreadsheet size={18} /> Bulk Task Allocator
          </button>
          <button 
            onClick={openCreateModal} 
            className="bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-bold py-2.5 px-6 text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-0.5 whitespace-nowrap w-full sm:w-auto cursor-pointer font-medium"
          >
            <Plus size={18} /> Assign Task
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div className="relative w-full sm:w-auto sm:flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search task title or description..."
            className="input-field pl-9 py-1.5 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="p-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        <div className="px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1.5 whitespace-nowrap">
          <span>Scope:</span>
          <span className="text-slate-800 dark:text-white font-extrabold">{selectedBatchName || (batchesList.find(b => b._id === selectedBatchId)?.batchName || 'Active Batch')}</span>
        </div>

        <select 
          className="input-field py-1.5 text-sm w-full sm:w-auto min-w-[140px]"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          <option value="General">General</option>
          <option value="HW">HW</option>
          <option value="CW">CW</option>
          <option value="Project">Project</option>
        </select>

        <button 
          onClick={handleResetFilters}
          className="px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg hover:bg-rose-100 transition-colors border border-rose-100 dark:border-rose-800/50 whitespace-nowrap cursor-pointer w-full sm:w-auto sm:ml-auto"
          title="Reset Filters"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-slate-500 dark:text-slate-400">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">No tasks found</p>
            <p className="text-sm mt-1 font-medium">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const isOverdue = task.dueDate && new Date() > new Date(task.dueDate);
            const isScheduled = task.scheduledAt && new Date(task.scheduledAt) > new Date();
            return (
              <div 
                key={task._id} 
                className={`rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 p-5 sm:p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between border-l-4 ${
                  isScheduled ? 'border-l-amber-500' : isOverdue ? 'border-l-rose-500' : 'border-l-indigo-500'
                }`}
              >
                <div>
                  {/* Top Meta & Action Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {task.batchId?.batchName && (
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 truncate max-w-[220px]" 
                          title={task.batchId.batchName}
                        >
                          {task.batchId.batchName}
                        </span>
                      )}
                      {isOverdue && (
                        <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-rose-200 dark:border-rose-800/50">
                          Overdue
                        </span>
                      )}
                      {isScheduled && (
                        <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border border-amber-200 dark:border-amber-800/50">
                          Scheduled
                        </span>
                      )}
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        onClick={() => handleEdit(task)} 
                        className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-lg transition-colors hover:bg-indigo-50 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 cursor-pointer" 
                        title="Edit Task"
                      >
                        <Edit size={14} />
                      </button>
                      <button 
                        onClick={() => handleDelete(task._id)} 
                        className="p-1.5 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg transition-colors hover:bg-rose-50 dark:hover:bg-slate-700 border border-slate-200/60 dark:border-slate-700 cursor-pointer" 
                        title="Delete Task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Task Title (Full Width) */}
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white leading-snug mb-3.5 break-words">
                    {task.title}
                  </h3>

                  {/* Instructions / Resource Access */}
                  {task.taskType === 'file' && task.fileUrl ? (
                    <div className="mb-4 p-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Attached instructions file:</p>
                      <a 
                        href={task.fileUrl.startsWith('http') ? task.fileUrl : `${import.meta.env.VITE_API_URL}${task.fileUrl}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 text-xs rounded-lg font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors border border-emerald-200 dark:border-emerald-800/50 cursor-pointer shadow-2xs"
                      >
                        <FileTextIcon size={14} /> Download Instructions
                      </a>
                    </div>
                  ) : task.taskType === 'link' ? (
                    <div className="mb-4 p-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Task external reference:</p>
                      <a 
                        href={task.linkUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 text-xs rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-800/50 cursor-pointer shadow-2xs"
                      >
                        <LinkIcon size={14} /> Open Task Link
                      </a>
                    </div>
                  ) : (
                    <div className="mb-4 p-3 bg-slate-50/80 dark:bg-slate-900/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 space-y-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                        {task.description ? task.description.replace(/<[^>]*>/g, '') : 'Text instructions provided for this task.'}
                      </p>
                      <button 
                        onClick={() => handleViewTaskText(task)}
                        className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 text-xs rounded-lg font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors border border-indigo-200 dark:border-indigo-800/50 cursor-pointer shadow-2xs"
                      >
                        <FileTextIcon size={14} /> View Task Details
                      </button>
                    </div>
                  )}

                  {/* Scheduled Release Box */}
                  {isScheduled && (
                    <div className="mb-4 p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 rounded-xl space-y-2.5">
                      <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300">
                        <Clock size={15} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div className="flex-1 text-xs">
                          <span className="font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-500 block">Scheduled Release</span>
                          <span className="font-semibold block mt-0.5">
                            {new Date(task.scheduledAt).toLocaleString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleAssignNow(task)}
                          className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle size={13} />
                          Assign Now
                        </button>
                        <button
                          onClick={() => handleEdit(task)}
                          className="flex-1 py-1.5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit size={13} />
                          Edit Schedule
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Metadata Badges */}
                <div className="pt-3.5 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
                      <Award size={12} /> {task.maxMarks} Marks
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200/60 dark:border-indigo-800/40">
                      <Tag size={12} /> {task.category || 'General'}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg border ${
                    isOverdue 
                      ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-800/40' 
                      : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-200/60 dark:border-amber-800/40'
                  }`}>
                    <Clock size={12} /> Due: {formatDateTime(task.dueDate)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Student View Mode - Task Details Modal */}
      {selectedTaskForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-slate-800 my-auto flex flex-col max-h-[90vh]">
            
            {/* Header with Student View Mode Badge */}
            <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-4 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40">
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                    <Eye size={12} /> Student View Mode
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {selectedTaskForView.batchId?.batchName || 'Active Batch'}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {selectedTaskForView.category || 'General'}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {selectedTaskForView.title}
                </h2>
              </div>
              <button 
                onClick={() => setSelectedTaskForView(null)} 
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Meta Highlights Banner (matching student layout) */}
            <div className="px-6 py-3.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200/60 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Calendar size={14} className="text-indigo-500" />
                  <span>Deadline: <strong className="text-slate-900 dark:text-white font-mono">{formatDateTime(selectedTaskForView.dueDate)}</strong></span>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300">
                  <Award size={14} className="text-amber-500" />
                  <span>Marks: <strong className="text-emerald-600 dark:text-emerald-400">{selectedTaskForView.maxMarks}</strong></span>
                </div>
                <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />
                <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 dark:bg-amber-950/40 px-2.5 py-0.5 rounded-lg border border-amber-500/20 dark:border-amber-500/30">
                  <Coins size={14} className="text-amber-500" />
                  <span>Student Reward: <strong className="font-mono text-amber-500 dark:text-amber-300">+{(Number(selectedTaskForView.maxMarks) || 0) * 10} Coins</strong></span>
                </div>
              </div>
              <TaskCountdownTimer dueDate={selectedTaskForView.dueDate} />
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 p-6 sm:p-8 space-y-6 bg-white dark:bg-slate-900">
              
              {/* Attached External Links / Files if any */}
              {selectedTaskForView.taskType === 'file' && selectedTaskForView.fileUrl && (
                <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <FileTextIcon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Attached Task Instructions File</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Students download this file to complete the assignment</p>
                    </div>
                  </div>
                  <a
                    href={selectedTaskForView.fileUrl.startsWith('http') ? selectedTaskForView.fileUrl : `${import.meta.env.VITE_API_URL}${selectedTaskForView.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    <Download size={14} /> Download File
                  </a>
                </div>
              )}

              {selectedTaskForView.taskType === 'link' && selectedTaskForView.linkUrl && (
                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/50 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <LinkIcon size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">External Resource / Task Link</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-md">{selectedTaskForView.linkUrl}</p>
                    </div>
                  </div>
                  <a
                    href={selectedTaskForView.linkUrl}
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
                <h4 className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                  <FileTextIcon size={14} /> Task Instructions & Details
                </h4>
                <div className="bg-slate-50/90 dark:bg-slate-950/80 p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner min-w-0 w-full overflow-hidden">
                  <div 
                    className="prose dark:prose-invert max-w-none text-slate-900 dark:text-slate-100 font-medium text-sm sm:text-base leading-relaxed ql-editor !p-0 task-content-viewer min-w-0 w-full break-words"
                    dangerouslySetInnerHTML={{ __html: sanitizeTaskHtml(selectedTaskForView.description) || '<p class="text-slate-400 italic">No instructions provided.</p>' }}
                  />
                </div>
              </div>

              {/* Requested Student Submission Fields / Links */}
              {selectedTaskForView.requiredLinks && selectedTaskForView.requiredLinks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Requested Student Submission Inputs
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedTaskForView.requiredLinks.map((reqLink, idx) => (
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
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
                Previewing exactly what students see when opening this task
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => {
                    const taskToEdit = selectedTaskForView;
                    setSelectedTaskForView(null);
                    handleEdit(taskToEdit);
                  }}
                  className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit size={14} /> Edit Task
                </button>
                <button
                  onClick={() => setSelectedTaskForView(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskManagement;
