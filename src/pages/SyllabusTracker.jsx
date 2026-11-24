import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  BookOpen, Plus, Calendar, Clock, CheckCircle2, Search, Filter, 
  ExternalLink, Edit, Trash2, X, Download, RefreshCw, AlertCircle, 
  FileText, GraduationCap, ChevronRight, Sparkles, BookMarked, User
} from 'lucide-react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useGlobalBatch } from '../context/GlobalBatchContext';
import SkeletonLoader from '../components/SkeletonLoader';

const SyllabusTracker = () => {
  const { user } = useAuth();
  const { selectedBatchId, selectedBatchName, batchesList, selectBatch } = useGlobalBatch();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [batchFilter, setBatchFilter] = useState(() => (selectedBatchId && selectedBatchId !== 'all') ? selectedBatchId : '');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal State for Create / Edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    batchId: '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    subtopics: '',
    description: '',
    resources: [{ title: '', url: '' }],
    assignmentsAssigned: '',
    hoursSpent: 1.5,
    completionPercentage: 100,
    status: 'completed'
  });

  const isStudent = user?.role === 'student';
  const isMentor = user?.role === 'mentor';
  const isAdmin = user?.role === 'admin';
  const canManage = isMentor || isAdmin;

  // Sync batchFilter with global batch when selectedBatchId or batchesList updates
  useEffect(() => {
    if (selectedBatchId && selectedBatchId !== 'all') {
      setBatchFilter(selectedBatchId);
    } else if (!batchFilter && batchesList.length > 0) {
      setBatchFilter(batchesList[0]._id);
    }
  }, [selectedBatchId, batchesList]);

  const effectiveBatchId = batchFilter || (selectedBatchId && selectedBatchId !== 'all' ? selectedBatchId : (batchesList[0]?._id || ''));
  const activeBatchObj = batchesList.find(b => b._id === effectiveBatchId) || null;

  const fetchSyllabus = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {};
      if (effectiveBatchId && !isStudent) params.batchId = effectiveBatchId;
      const { data } = await axios.get('/syllabus', { params });
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching syllabus entries:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSyllabus();
  }, [effectiveBatchId]);

  const handleBatchChange = (newBatchId) => {
    setBatchFilter(newBatchId);
    const matched = batchesList.find(b => b._id === newBatchId);
    if (matched && selectBatch) {
      selectBatch(matched._id, matched.batchName);
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingEntry(null);
    setFormData({
      batchId: effectiveBatchId || batchesList[0]?._id || '',
      date: new Date().toISOString().split('T')[0],
      title: '',
      subtopics: '',
      description: '',
      resources: [{ title: '', url: '' }],
      assignmentsAssigned: '',
      hoursSpent: 1.5,
      completionPercentage: 100,
      status: 'completed'
    });
    setModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (entry) => {
    setEditingEntry(entry);
    setFormData({
      batchId: entry.batchId?._id || entry.batchId || '',
      date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      title: entry.title || '',
      subtopics: Array.isArray(entry.subtopics) ? entry.subtopics.join(', ') : (entry.subtopics || ''),
      description: entry.description || '',
      resources: (entry.resources && entry.resources.length > 0) ? entry.resources : [{ title: '', url: '' }],
      assignmentsAssigned: entry.assignmentsAssigned || '',
      hoursSpent: entry.hoursSpent || 1,
      completionPercentage: entry.completionPercentage !== undefined ? entry.completionPercentage : 100,
      status: entry.status || 'completed'
    });
    setModalOpen(true);
  };

  // Handle resource row change
  const handleResourceChange = (index, field, value) => {
    const updated = [...formData.resources];
    updated[index][field] = value;
    setFormData({ ...formData, resources: updated });
  };

  const handleAddResource = () => {
    setFormData({ ...formData, resources: [...formData.resources, { title: '', url: '' }] });
  };

  const handleRemoveResource = (index) => {
    const updated = formData.resources.filter((_, i) => i !== index);
    setFormData({ ...formData, resources: updated.length ? updated : [{ title: '', url: '' }] });
  };

  // Submit Create or Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      Swal.fire('Required', 'Please enter the syllabus topic title.', 'warning');
      return;
    }
    if (!formData.batchId && canManage) {
      Swal.fire('Required', 'Please select a batch.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        resources: formData.resources.filter(r => r.url && r.url.trim())
      };

      if (editingEntry) {
        await axios.put(`/syllabus/${editingEntry._id}`, payload);
        Swal.fire({
          icon: 'success',
          title: 'Syllabus Updated',
          text: 'The syllabus progress entry was updated successfully.',
          timer: 1600,
          showConfirmButton: false
        });
      } else {
        await axios.post('/syllabus', payload);
        Swal.fire({
          icon: 'success',
          title: 'Syllabus Logged',
          text: 'Daily syllabus completed was recorded and published to student and monitoring panels!',
          timer: 2000,
          showConfirmButton: false
        });
      }

      setModalOpen(false);
      fetchSyllabus(true);
    } catch (err) {
      console.error('Error saving syllabus entry:', err);
      Swal.fire('Error', err.response?.data?.message || 'Failed to save syllabus entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Entry
  const handleDelete = async (entryId) => {
    const confirm = await Swal.fire({
      title: 'Delete Syllabus Entry?',
      text: 'Are you sure you want to remove this syllabus progress record?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete'
    });

    if (confirm.isConfirmed) {
      try {
        await axios.delete(`/syllabus/${entryId}`);
        Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Entry removed successfully.',
          timer: 1500,
          showConfirmButton: false
        });
        fetchSyllabus(true);
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Could not delete entry.', 'error');
      }
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    if (!filteredEntries.length) return;
    const exportData = filteredEntries.map(e => ({
      'Date': new Date(e.date).toLocaleDateString(),
      'Batch': e.batchName || e.batchId?.batchName || 'General',
      'Topic / Chapter': e.title,
      'Subtopics Covered': Array.isArray(e.subtopics) ? e.subtopics.join(', ') : e.subtopics,
      'Lecture Overview': e.description,
      'Teaching Hours': e.hoursSpent,
      'Status': (e.status || 'completed').toUpperCase(),
      'Assignments': e.assignmentsAssigned || 'None',
      'Mentor': e.mentorName || e.mentorId?.name || 'Mentor'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Syllabus_Tracker");
    XLSX.writeFile(workbook, `SSMS_Syllabus_Tracker_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Entries strictly scoped to the active batch
  const currentBatchEntries = useMemo(() => {
    if (!effectiveBatchId || isStudent) return entries;
    return entries.filter(e => {
      const bId = (e.batchId?._id || e.batchId)?.toString();
      return bId === effectiveBatchId;
    });
  }, [entries, effectiveBatchId, isStudent]);

  // Filtered entries for search & status filter
  const filteredEntries = useMemo(() => {
    return currentBatchEntries.filter(e => {
      const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || 
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (Array.isArray(e.subtopics) && e.subtopics.some(s => s.toLowerCase().includes(q))) ||
        (e.mentorName && e.mentorName.toLowerCase().includes(q)) ||
        (e.batchName && e.batchName.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [currentBatchEntries, statusFilter, searchTerm]);

  // Aggregate Metrics - CALCULATED STRICTLY ON CURRENT BATCH ENTRIES
  const totalTopics = currentBatchEntries.length;
  const totalHours = Math.round(currentBatchEntries.reduce((acc, curr) => acc + (Number(curr.hoursSpent) || 0), 0) * 10) / 10;
  const completedTopics = currentBatchEntries.filter(e => e.status === 'completed').length;
  const latestEntry = currentBatchEntries[0];

  if (loading && !refreshing) {
    return <SkeletonLoader type="tasks" />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-xs">
              <BookOpen size={22} />
            </div>
            <span>
              {isStudent ? 'Batch Syllabus Progress Tracker' : isMentor ? 'Mentor Syllabus Tracker' : 'Institutional Syllabus Tracker'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            {isStudent 
              ? 'Stay updated on daily lessons, chapters completed, subtopics taught, and course reference materials.'
              : 'Log daily syllabus coverage, chapters taught, subtopics, and assignments published across student and monitoring portals.'}
          </p>
          {!isStudent && activeBatchObj && (
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/50">
                <BookOpen size={13} />
                <span>Scope: {activeBatchObj.batchName}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={() => fetchSyllabus(true)}
            disabled={refreshing}
            className="p-2.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-xs cursor-pointer"
            title="Refresh Syllabus"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>

          {canManage && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-600/25 hover:-translate-y-0.5 cursor-pointer"
            >
              <Plus size={16} />
              <span>Log Daily Syllabus</span>
            </button>
          )}

          {filteredEntries.length > 0 && (
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Download size={15} />
              <span className="hidden sm:inline">Export Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-indigo-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Lessons</span>
            <BookMarked size={16} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{totalTopics}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Recorded chapters</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed</span>
            <CheckCircle2 size={16} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">{completedTopics}</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Fully covered modules</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-amber-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Hours Taught</span>
            <Clock size={16} />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">{totalHours}h</p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Cumulative instruction</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between text-violet-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Latest Lesson</span>
            <Calendar size={16} />
          </div>
          <p className="text-sm font-black text-slate-800 dark:text-white truncate">
            {latestEntry ? latestEntry.title : 'None logged'}
          </p>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">
            {latestEntry ? new Date(latestEntry.date).toLocaleDateString() : 'No entries yet'}
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search syllabus topic, subtopics, concepts covered..."
            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isStudent && (
            <select
              value={effectiveBatchId}
              onChange={(e) => handleBatchChange(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {batchesList.map(b => (
                <option key={b._id} value={b._id}>{b.batchName}</option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl py-2.5 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="revised">Revision / Lab</option>
          </select>
        </div>
      </div>

      {/* Syllabus Entries Feed */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-4">
            <BookOpen size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">No Syllabus Entries Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            {canManage 
              ? 'Click the "+ Log Daily Syllabus" button above to record your first completed chapter and subtopics!'
              : 'Your mentor will post syllabus lessons and lecture summaries here daily as they are completed.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEntries.map((entry, index) => {
            const isCompleted = entry.status === 'completed';
            const isInProgress = entry.status === 'in-progress';
            const isRevised = entry.status === 'revised';

            return (
              <div
                key={entry._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs hover:border-indigo-500/30 transition-all group"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Column: Date & Title */}
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-xl text-xs font-black bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40 flex items-center gap-1.5 font-mono">
                        <Calendar size={13} />
                        {new Date(entry.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>

                      <span className="px-2.5 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {entry.batchName || entry.batchId?.batchName || 'Batch'}
                      </span>

                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                        isCompleted 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : isInProgress
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20'
                      }`}>
                        {entry.status || 'completed'}
                      </span>

                      {entry.hoursSpent ? (
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                          <Clock size={12} /> {entry.hoursSpent}h
                        </span>
                      ) : null}
                    </div>

                    {/* Topic Title */}
                    <h3 className="text-lg font-black text-slate-900 dark:text-white pt-1">
                      {entry.title}
                    </h3>

                    {/* Subtopics Pills */}
                    {Array.isArray(entry.subtopics) && entry.subtopics.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">Concepts:</span>
                        {entry.subtopics.map((sub, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Description / Summary */}
                    {entry.description && (
                      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed pt-1">
                        {entry.description}
                      </p>
                    )}

                    {/* Homework / Assignment Note */}
                    {entry.assignmentsAssigned && (
                      <div className="p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 mt-2">
                        <FileText size={15} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold">Follow-up Task / Assignment:</strong> {entry.assignmentsAssigned}
                        </div>
                      </div>
                    )}

                    {/* Resource URLs */}
                    {Array.isArray(entry.resources) && entry.resources.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">References:</span>
                        {entry.resources.map((res, i) => (
                          <a
                            key={i}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold border border-indigo-200/60 dark:border-indigo-900/50 transition-colors"
                          >
                            <span>{res.title || 'Documentation / Repo'}</span>
                            <ExternalLink size={11} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Instructor & Actions */}
                  <div className="flex lg:flex-col items-center lg:items-end justify-between border-t lg:border-t-0 border-slate-100 dark:border-slate-800 pt-3 lg:pt-0 gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-right">
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs uppercase">
                        {(entry.mentorName || 'M').charAt(0)}
                      </div>
                      <div className="text-left lg:text-right">
                        <p className="text-xs font-extrabold text-slate-800 dark:text-white">
                          {entry.mentorName || entry.mentorId?.name || 'Mentor'}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">Instructor</p>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(entry)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="Edit Entry"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry._id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="Delete Entry"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ CREATE / EDIT MODAL ═══ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    {editingEntry ? 'Edit Syllabus Progress' : 'Log Daily Completed Syllabus'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Broadcast what was taught today across Mentor, Admin, Student, and Monitoring panels.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Batch Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                    <span>Select Batch *</span>
                    {activeBatchObj && (
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">Scope: {activeBatchObj.batchName}</span>
                    )}
                  </label>
                  <select
                    value={formData.batchId}
                    onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Select a batch...</option>
                    {batchesList.map(b => (
                      <option key={b._id} value={b._id}>{b.batchName}</option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Class Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Topic Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Topic / Chapter Completed *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Django REST Framework: ViewSets, Routers, & Token Authentication"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Subtopics / Concepts */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Key Concepts / Subtopics (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ModelViewSet, SimpleRouter, JWT Bearer tokens, Permission classes"
                  value={formData.subtopics}
                  onChange={(e) => setFormData({ ...formData, subtopics: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Description / Summary */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Lecture Summary & In-Depth Notes
                </label>
                <textarea
                  rows={4}
                  placeholder="Summarize the core concepts explained, live coding examples executed, and practical implementation tips..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              {/* Status and Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Lesson Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="completed">Completed</option>
                    <option value="in-progress">In Progress</option>
                    <option value="revised">Revision / Lab Session</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Instruction Hours Spent
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={formData.hoursSpent}
                    onChange={(e) => setFormData({ ...formData, hoursSpent: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Assignments / Homework Given */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Homework / Practice Task Given (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Implement CRUD views using ModelViewSet for Library Management"
                  value={formData.assignmentsAssigned}
                  onChange={(e) => setFormData({ ...formData, assignmentsAssigned: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-xs font-medium text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Reference Documentation & Repo Links */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Reference URLs / Documentation / GitHub (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddResource}
                    className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Link
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.resources.map((res, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Link Label (e.g. DRF Docs)"
                        value={res.title}
                        onChange={(e) => handleResourceChange(i, 'title', e.target.value)}
                        className="w-1/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={res.url}
                        onChange={(e) => handleResourceChange(i, 'url', e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveResource(i)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                        title="Remove link"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : editingEntry ? 'Save Changes' : 'Publish to Panels'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyllabusTracker;
