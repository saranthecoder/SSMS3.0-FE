import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { BookOpen, Plus, FileText as FileTextIcon, Edit, Trash2, Link as LinkIcon, RefreshCw, Search, RotateCcw, CheckCircle, Clock, Calendar, Award, Tag } from 'lucide-react';
import SkeletonLoader from '../../components/SkeletonLoader';
import { useAuth } from '../../context/AuthContext';
import { useGlobalBatch } from '../../context/GlobalBatchContext';

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
  const { selectedBatchId, selectedBatchName, batchesList } = useGlobalBatch();
  const [tasks, setTasks] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  
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
    const newWin = window.open('', '_blank');
    if (newWin) {
      const typeLabel = task.category === 'Project' ? 'Project' : 'Task';
      const formattedDate = formatDateTime(task.dueDate);

      newWin.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${task.title}</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              line-height: 1.6;
              color: #334155;
              background-color: #fafafa;
              margin: 0;
              padding: 2rem;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              min-height: 100vh;
            }
            .container {
              background-color: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 1rem;
              padding: 2.5rem;
              width: 100%;
              max-width: 800px;
              box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02);
            }
            h1 {
              font-size: 2.25rem;
              font-weight: 800;
              color: #0f172a;
              margin-top: 0;
              margin-bottom: 1.5rem;
              border-bottom: 2px solid #f1f5f9;
              padding-bottom: 1rem;
            }
            .meta-info {
              display: flex;
              flex-wrap: wrap;
              gap: 1.5rem;
              margin-bottom: 2rem;
              background-color: #f8fafc;
              padding: 1rem 1.5rem;
              border-radius: 0.75rem;
              border: 1px dashed #e2e8f0;
            }
            .meta-item {
              font-size: 0.875rem;
              color: #64748b;
            }
            .meta-item strong {
              color: #334155;
            }
            .content {
              font-size: 1.05rem;
              color: #334155;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              margin: 1.5rem 0;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
            }
            pre {
              background-color: #f8fafc;
              padding: 1.25rem;
              border-radius: 0.5rem;
              overflow-x: auto;
              border: 1px solid #e2e8f0;
              max-width: 100%;
            }
            code {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
              color: #ea580c;
              background-color: #f1f5f9;
              padding: 0.2rem 0.4rem;
              border-radius: 0.25rem;
              font-size: 0.875rem;
            }
            pre code {
              color: inherit;
              background-color: transparent;
              padding: 0;
              border-radius: 0;
              font-size: 0.875rem;
            }
            a {
              color: #ea580c;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            p {
              margin-top: 0;
              margin-bottom: 1rem;
            }
            ul, ol {
              margin-top: 0;
              margin-bottom: 1rem;
              padding-left: 1.5rem;
            }
            li {
              margin-bottom: 0.25rem;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${task.title}</h1>
            <div class="meta-info">
              <div class="meta-item">Type: <strong>${typeLabel}</strong></div>
              <div class="meta-item">Batch: <strong>${task.batchId?.batchName || 'N/A'}</strong></div>
              ${task.dueDate ? `<div class="meta-item">Deadline: <strong>${formattedDate}</strong></div>` : ''}
              ${task.maxMarks !== undefined ? `<div class="meta-item">Marks: <strong>${task.maxMarks}</strong></div>` : ''}
            </div>
            <div class="content">
              ${task.description || '<p>No instructions provided.</p>'}
            </div>
          </div>
        </body>
        </html>
      `);
      newWin.document.close();
    }
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
        <div className="flex flex-col sm:flex-row items-center gap-4">
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
    </div>
  );
};

export default TaskManagement;
