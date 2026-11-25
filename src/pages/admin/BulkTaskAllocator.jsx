import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import {
  FileSpreadsheet, Upload, Link2, Download, CalendarClock, Play,
  Trash2, CheckCircle2, AlertTriangle, ArrowLeft, Plus, Sparkles,
  Edit3, UploadCloud, X, FileText
} from 'lucide-react';
import { useGlobalBatch } from '../../context/GlobalBatchContext';

const formatDatetimeLocalIST = (input) => {
  if (!input) return '';
  if (input instanceof Date && !isNaN(input.getTime())) {
    const ist = new Date(input.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 16);
  }
  const str = String(input).trim();
  if (!str) return '';
  // Already YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    return str.slice(0, 16);
  }
  // YYYY-MM-DD HH:mm
  if (/^\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/.test(str)) {
    const [d, t] = str.split(/\s+/);
    const [hh, mm] = t.split(':');
    return `${d}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return `${str}T09:00`;
  }
  // DD/MM/YYYY or DD-MM-YYYY with optional HH:mm
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    const yyyy = dmy[3];
    const hh = (dmy[4] || '09').padStart(2, '0');
    const min = (dmy[5] || '00').padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const ist = new Date(parsed.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 16);
  }
  return '';
};

const pickCol = (row, candidates) => {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const found = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === cand.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (found && row[found] !== undefined && row[found] !== '') {
      return row[found];
    }
  }
  return '';
};

const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    ['blockquote', 'code-block'],
    ['link', 'image', 'video'],
    ['clean']
  ]
};

const stripHtml = (html) => {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const mapRawRowsToTasks = (rows) => {
  return rows.map((row, idx) => {
    const title = String(pickCol(row, ['Title', 'Task Title', 'Task Name', 'Name', 'Task']) || '').trim();
    const description = String(pickCol(row, ['Description', 'Task Instructions', 'Instructions', 'Details', 'Desc', 'Rich Text', 'Content']) || '').trim();
    const rawCat = String(pickCol(row, ['Category', 'Task Category', 'Tag']) || 'General').trim();
    const category = ['CW', 'HW', 'General', 'Project'].find(c => c.toLowerCase() === rawCat.toLowerCase()) || 'General';
    const rawType = String(pickCol(row, ['Task Type', 'Submission Type', 'Instructions Format', 'Type', 'Mode']) || '').trim().toLowerCase();
    const linkUrl = String(pickCol(row, ['Link URL', 'Task Link', 'Problem Link', 'URL', 'Link']) || '').trim();
    const fileUrl = String(pickCol(row, ['File URL', 'File', 'Attachment', 'Task File']) || '').trim();
    const taskType = ['text', 'file', 'link'].includes(rawType)
      ? rawType
      : (linkUrl ? 'link' : (fileUrl ? 'file' : 'text'));
    const maxMarks = Number(pickCol(row, ['Max Marks', 'Marks', 'Points', 'Score'])) || 10;
    const scheduledAt = formatDatetimeLocalIST(pickCol(row, ['Schedule Date', 'Schedule Release', 'Scheduled At', 'Unlock Date', 'Unlock Time', 'Schedule', 'Start Date']));
    const dueDate = formatDatetimeLocalIST(pickCol(row, ['Deadline', 'Due Date', 'Due', 'End Date', 'Submission Deadline']));
    const requiredLinks = String(pickCol(row, ['Required Links', 'Submission Links', 'Multiple Links Submissions', 'Submissions', 'Required Submissions']) || '').trim();

    return {
      _localId: `row_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      description,
      category,
      taskType,
      linkUrl,
      fileUrl,
      maxMarks,
      scheduledAt,
      dueDate,
      requiredLinks
    };
  });
};

const BulkTaskAllocator = () => {
  const navigate = useNavigate();
  const { selectedBatchId, selectedBatchName, batchesList } = useGlobalBatch();

  const effectiveBatchId = (selectedBatchId && selectedBatchId !== 'all')
    ? selectedBatchId
    : (batchesList[0]?._id || '');
  const effectiveBatchName = (selectedBatchId && selectedBatchId !== 'all')
    ? (selectedBatchName || batchesList.find(b => b._id === effectiveBatchId)?.batchName || 'Selected Batch')
    : (batchesList.find(b => b._id === effectiveBatchId)?.batchName || 'No Batch Selected');

  const [sheetUrl, setSheetUrl] = useState('');
  const [parsingSheet, setParsingSheet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [editingDescRow, setEditingDescRow] = useState(null);
  const [uploadingRowId, setUploadingRowId] = useState(null);

  // Auto-stagger controls
  const [staggerStart, setStaggerStart] = useState(() => {
    const d = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [staggerIntervalMinutes, setStaggerIntervalMinutes] = useState(5);
  const [deadlineOffsetMinutes, setDeadlineOffsetMinutes] = useState(20);

  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        Title: 'Day 1: Array Basics & Two Pointers',
        Description: 'Solve the linked problem, write clean code with comments, and submit your GitHub repo link.',
        Category: 'CW',
        'Task Type': 'link',
        'Link URL': 'https://leetcode.com/problems/two-sum/',
        'File URL': '',
        'Max Marks': 10,
        'Schedule Date': '2026-11-26 09:00',
        Deadline: '2026-11-26 23:59',
        'Required Links': 'GitHub Repo, Live Demo'
      },
      {
        Title: 'Day 2: Sliding Window Assignment',
        Description: '1. Implement fixed & variable sliding window.\n2. Document time & space complexity.\n3. Submit GitHub repository.',
        Category: 'HW',
        'Task Type': 'text',
        'Link URL': '',
        'File URL': '',
        'Max Marks': 10,
        'Schedule Date': '2026-11-27 09:00',
        Deadline: '2026-11-27 23:59',
        'Required Links': 'GitHub Repo'
      },
      {
        Title: 'Day 3: System Design Reference Sheet',
        Description: 'Review the attached specification document and build the module.',
        Category: 'Project',
        'Task Type': 'file',
        'Link URL': '',
        'File URL': 'https://example.com/assignment-spec.pdf',
        'Max Marks': 10,
        'Schedule Date': '2026-11-28 09:00',
        Deadline: '2026-11-28 23:59',
        'Required Links': 'GitHub Repo, Loom Video'
      }
    ];
    const ws = XLSX.utils.json_to_sheet(sampleRows);
    ws['!cols'] = [
      { wch: 32 },
      { wch: 48 },
      { wch: 10 },
      { wch: 10 },
      { wch: 36 },
      { wch: 32 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'SSMS_Bulk_Tasks_Template.xlsx');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const firstSheet = wb.SheetNames[0];
        const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[firstSheet], { defval: '' });
        if (!rawRows || rawRows.length === 0) {
          return Swal.fire('Empty File', 'No task rows found in the uploaded file.', 'warning');
        }
        const mapped = mapRawRowsToTasks(rawRows);
        setTasks(mapped);
        Swal.fire({ icon: 'success', title: `Parsed ${mapped.length} Tasks`, text: 'Review or adjust schedules below before allocating.', timer: 1800, showConfirmButton: false });
      } catch (err) {
        console.error(err);
        Swal.fire('Parse Error', 'Could not read Excel/CSV file. Please verify the file format.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleParseGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      return Swal.fire('Missing URL', 'Please paste a Google Sheet link.', 'warning');
    }
    setParsingSheet(true);
    try {
      const { data } = await axios.post('/tasks/parse-gsheet', { sheetUrl: sheetUrl.trim() });
      const mapped = mapRawRowsToTasks(data.rows || []);
      setTasks(mapped);
      Swal.fire({ icon: 'success', title: `Imported ${mapped.length} Tasks`, text: 'Review schedules & deadlines below before allocating.', timer: 1800, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Google Sheet Error', err.response?.data?.message || 'Could not import Google Sheet.', 'error');
    } finally {
      setParsingSheet(false);
    }
  };

  const handleAutoStagger = () => {
    if (tasks.length === 0) return;
    if (!staggerStart) {
      return Swal.fire('Select Start Time', 'Please pick a starting date & time.', 'warning');
    }

    const baseMs = new Date(`${staggerStart}:00+05:30`).getTime();
    const intervalMs = Number(staggerIntervalMinutes) * 60000;
    const deadlineMs = Number(deadlineOffsetMinutes) * 60000;

    setTasks(prev => prev.map((t, idx) => {
      const unlockMs = baseMs + idx * intervalMs;
      const dueMs = unlockMs + deadlineMs;
      return {
        ...t,
        scheduledAt: formatDatetimeLocalIST(new Date(unlockMs)),
        dueDate: formatDatetimeLocalIST(new Date(dueMs))
      };
    }));

    Swal.fire({
      icon: 'success',
      title: 'Schedules Staggered!',
      text: `${tasks.length} tasks scheduled sequentially every ${staggerIntervalMinutes} min.`,
      timer: 1500,
      showConfirmButton: false
    });
  };

  const updateTaskRow = (localId, field, value) => {
    setTasks(prev => prev.map(t => t._localId === localId ? { ...t, [field]: value } : t));
  };

  const removeTaskRow = (localId) => {
    setTasks(prev => prev.filter(t => t._localId !== localId));
  };

  const handleRowFileUpload = async (localId, file) => {
    if (!file) return;
    setUploadingRowId(localId);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      const res = await axios.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateTaskRow(localId, 'fileUrl', res.data.url || '');
      Swal.fire({ icon: 'success', title: 'File Uploaded', text: file.name, timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire('Upload Failed', err.response?.data?.message || 'Could not upload file.', 'error');
    } finally {
      setUploadingRowId(null);
    }
  };

  const addEmptyRow = () => {
    setTasks(prev => [
      {
        _localId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: '',
        description: '',
        category: 'General',
        taskType: 'text',
        linkUrl: '',
        fileUrl: '',
        maxMarks: 10,
        scheduledAt: staggerStart,
        dueDate: '',
        requiredLinks: ''
      },
      ...prev
    ]);
  };

  const validationStats = useMemo(() => {
    let valid = 0;
    let invalid = 0;
    tasks.forEach(t => {
      if (t.title.trim() && t.dueDate) valid++;
      else invalid++;
    });
    return { valid, invalid };
  }, [tasks]);

  const handleBulkScheduleSubmit = async () => {
    if (!effectiveBatchId) {
      return Swal.fire('No Batch Selected', 'Please select a batch from the top global batch switcher.', 'warning');
    }
    if (tasks.length === 0) {
      return Swal.fire('No Tasks', 'Upload an Excel/CSV file or import a Google Sheet first.', 'warning');
    }
    if (validationStats.invalid > 0) {
      return Swal.fire('Incomplete Rows', `${validationStats.invalid} row(s) are missing a Title or Deadline. Please fill or remove them.`, 'warning');
    }

    const confirmRes = await Swal.fire({
      title: `Schedule ${tasks.length} Tasks?`,
      text: `All ${tasks.length} tasks will be allocated to "${effectiveBatchName}" and automatically unlock one-by-one at their scheduled times.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      confirmButtonText: `Yes, Schedule ${tasks.length} Tasks`
    });
    if (!confirmRes.isConfirmed) return;

    setSubmitting(true);
    try {
      const { data } = await axios.post('/tasks/bulk', { batchId: effectiveBatchId, tasks });
      await Swal.fire({
        icon: 'success',
        title: 'Bulk Tasks Scheduled!',
        text: `${data.createdCount} task(s) scheduled successfully for "${effectiveBatchName}".`,
        confirmButtonColor: '#10b981'
      });
      navigate('/tasks');
    } catch (err) {
      Swal.fire('Scheduling Failed', err.response?.data?.message || 'Could not schedule tasks.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/tasks')}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mb-1 cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to Task Management
          </button>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <FileSpreadsheet className="text-indigo-500" size={26} />
            Bulk Task Allocator &amp; Scheduler
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Import tasks from Excel/CSV or Google Sheets, configure staggered unlock times &amp; deadlines, and schedule them all at once.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 self-start"
        >
          <Download size={15} /> Download Excel Template
        </button>
      </div>

      {/* Step 1: Import Sources & Active Batch */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Excel Upload + Active Global Batch Pill */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-700/70 space-y-4">
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Allocating To</span>
            <span className="text-xs font-extrabold text-indigo-700 dark:text-indigo-300 truncate">{effectiveBatchName}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">1A. Upload Excel or CSV File</label>
            <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-indigo-300 dark:border-indigo-700/70 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer transition-colors">
              <Upload size={24} className="text-indigo-500 mb-1.5" />
              <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">Click to select .xlsx, .xls, or .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>

        {/* Google Sheet Import */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-700/70 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300">2B. Or Import from Google Sheets</label>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Paste a Google Sheet link shared with <b>&ldquo;Anyone with the link can view&rdquo;</b>.
            </p>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="url"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-white"
              />
            </div>
          </div>
          <button
            onClick={handleParseGoogleSheet}
            disabled={parsingSheet}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {parsingSheet ? 'Importing Google Sheet...' : 'Fetch & Parse Google Sheet'}
          </button>
        </div>

        {/* Auto-Stagger One-by-One Scheduler */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-700/70 space-y-3 flex flex-col justify-between">
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <CalendarClock size={14} className="text-indigo-500" /> 3. Auto-Stagger Unlock Schedule (Optional)
            </label>
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">First Task Unlocks At (IST)</span>
                <input
                  type="datetime-local"
                  value={staggerStart}
                  onChange={(e) => setStaggerStart(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Unlock Every (mins)</span>
                  <input
                    type="number"
                    min="1"
                    value={staggerIntervalMinutes}
                    onChange={(e) => setStaggerIntervalMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Due After (mins)</span>
                  <input
                    type="number"
                    min="1"
                    value={deadlineOffsetMinutes}
                    onChange={(e) => setDeadlineOffsetMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={handleAutoStagger}
            disabled={tasks.length === 0}
            className="w-full py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Sparkles size={14} /> Apply Sequential Schedule
          </button>
        </div>
      </div>

      {/* Step 2: Editable Preview Table */}
      <div className="glass-panel rounded-3xl border border-slate-200 dark:border-slate-700/70 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">
              Extracted Tasks Preview ({tasks.length})
            </h2>
            {tasks.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {validationStats.valid} Valid
                </span>
                {validationStats.invalid > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 font-bold flex items-center gap-1">
                    <AlertTriangle size={12} /> {validationStats.invalid} Incomplete
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={addEmptyRow}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Row
            </button>
            <button
              onClick={handleBulkScheduleSubmit}
              disabled={submitting || tasks.length === 0 || validationStats.invalid > 0}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-md"
            >
              <Play size={14} /> {submitting ? 'Scheduling...' : `Schedule All ${tasks.length} Tasks`}
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            Upload an Excel/CSV file, import a Google Sheet, or click <b>Add Row</b> to start building your bulk schedule.
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {tasks.map((t, i) => (
              <div
                key={t._localId}
                className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/60 p-4 space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700/70 transition-colors"
              >
                {/* Row 1: Index, Title, Category, Type, Marks, Remove */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-6">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      #{i + 1} Task Title *
                    </label>
                    <input
                      type="text"
                      value={t.title}
                      onChange={(e) => updateTaskRow(t._localId, 'title', e.target.value)}
                      placeholder="Enter a descriptive task title..."
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold bg-white dark:bg-slate-900 ${
                        !t.title.trim() ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Category</label>
                    <select
                      value={t.category}
                      onChange={(e) => updateTaskRow(t._localId, 'category', e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      <option value="General">General</option>
                      <option value="CW">CW</option>
                      <option value="HW">HW</option>
                      <option value="Project">Project</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Format</label>
                    <select
                      value={t.taskType}
                      onChange={(e) => updateTaskRow(t._localId, 'taskType', e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                    >
                      <option value="text">Text</option>
                      <option value="link">Link</option>
                      <option value="file">File</option>
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={t.maxMarks}
                      onChange={(e) => updateTaskRow(t._localId, 'maxMarks', Number(e.target.value))}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center"
                    />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <button
                      onClick={() => removeTaskRow(t._localId)}
                      className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50 cursor-pointer"
                      title="Remove task"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Row 2: Instructions/Link/File, Unlock Schedule, Deadline, Submission Links */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-5">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      {t.taskType === 'link' ? 'Link URL & Note' : t.taskType === 'file' ? 'Instruction File' : 'Task Instructions / Description'}
                    </label>
                    {t.taskType === 'text' && (
                      <div className="flex items-start gap-2">
                        <textarea
                          rows={2}
                          value={stripHtml(t.description)}
                          onChange={(e) => updateTaskRow(t._localId, 'description', e.target.value)}
                          placeholder="Enter task instructions / description..."
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs resize-y min-h-[54px]"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingDescRow({ _localId: t._localId, title: t.title || `Task #${i + 1}`, description: t.description || '' })}
                          className="shrink-0 px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          title="Open Rich Text Editor"
                        >
                          <Edit3 size={13} /> Rich
                        </button>
                      </div>
                    )}
                    {t.taskType === 'link' && (
                      <div className="space-y-1.5">
                        <input
                          type="url"
                          value={t.linkUrl || ''}
                          onChange={(e) => updateTaskRow(t._localId, 'linkUrl', e.target.value)}
                          placeholder="https://example.com/assignment"
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                        <input
                          type="text"
                          value={stripHtml(t.description)}
                          onChange={(e) => updateTaskRow(t._localId, 'description', e.target.value)}
                          placeholder="Optional short instructions..."
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900 text-[11px] text-slate-500"
                        />
                      </div>
                    )}
                    {t.taskType === 'file' && (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={t.fileUrl || ''}
                          onChange={(e) => updateTaskRow(t._localId, 'fileUrl', e.target.value)}
                          placeholder="File URL or upload ->"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                        />
                        <label className="shrink-0 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
                          <UploadCloud size={13} />
                          {uploadingRowId === t._localId ? '...' : 'Upload'}
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleRowFileUpload(t._localId, f);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Unlock (IST)</label>
                    <input
                      type="datetime-local"
                      value={t.scheduledAt}
                      onChange={(e) => updateTaskRow(t._localId, 'scheduledAt', e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Deadline (IST) *</label>
                    <input
                      type="datetime-local"
                      value={t.dueDate}
                      onChange={(e) => updateTaskRow(t._localId, 'dueDate', e.target.value)}
                      className={`w-full px-2.5 py-2 rounded-xl border text-xs bg-white dark:bg-slate-900 ${
                        !t.dueDate ? 'border-rose-400' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Submission Links</label>
                    <input
                      type="text"
                      value={t.requiredLinks}
                      onChange={(e) => updateTaskRow(t._localId, 'requiredLinks', e.target.value)}
                      placeholder="GitHub Repo, Live Link..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rich Text Instructions Modal */}
      {editingDescRow && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-500" />
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Task Instructions (Rich Text)</h3>
                  <p className="text-[11px] text-slate-500 truncate max-w-md">{editingDescRow.title}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingDescRow(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div className="bg-white dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <ReactQuill
                  theme="snow"
                  value={editingDescRow.description}
                  onChange={(val) => setEditingDescRow(prev => ({ ...prev, description: val }))}
                  modules={quillModules}
                  className="h-[340px] mb-14"
                />
              </div>
            </div>
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setEditingDescRow(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateTaskRow(editingDescRow._localId, 'description', editingDescRow.description);
                  setEditingDescRow(null);
                }}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer"
              >
                Save Instructions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkTaskAllocator;
