import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Users, Plus, Edit, Trash2, Loader2, Calendar, UserMinus, X, Download, Clock, RefreshCw, Search, RotateCcw, CheckCircle, Upload, FileSpreadsheet, UserCheck, AlertTriangle, ShieldCheck, BookOpen, Layers, UserPlus, Link2 } from 'lucide-react';
import SkeletonLoader from '../../components/SkeletonLoader';
import Loader from '../../components/Loader';
import * as XLSX from 'xlsx';

import { useAuth } from '../../context/AuthContext';

const BatchManagement = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    batchName: '', description: '', startDate: '', endDate: '', status: 'Upcoming', checkInTime: '', checkOutTime: '', mentorId: '',
    requiredPresentHours: 8, maxValidHours: 10
  });
  const [editingId, setEditingId] = useState(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Student Modal State
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchStudents, setBatchStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);

  // Import / Add Student Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [importMode, setImportMode] = useState('single'); // 'single' or 'bulk'
  const [singleStudent, setSingleStudent] = useState({ name: '', rollNumber: '', email: '', password: '' });
  const [singleSaving, setSingleSaving] = useState(false);
  const [parsedStudents, setParsedStudents] = useState([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [fetchingSheet, setFetchingSheet] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFilter, setPreviewFilter] = useState('all'); // all, valid, invalid

  const fetchBatches = async () => {
    try {
      const { data } = await axios.get('/batches');
      setBatches(data);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMentors = async () => {
    try {
      const { data } = await axios.get('/mentors');
      setMentors(data);
    } catch (error) {
      console.error('Error fetching mentors:', error);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchMentors();
  }, []);

  const handleEdit = (batch) => {
    let formattedStartDate = '';
    let formattedEndDate = '';
    
    try {
      if (batch.startDate) formattedStartDate = new Date(batch.startDate).toISOString().split('T')[0];
    } catch (e) {
      console.warn("Invalid start date", batch.startDate);
    }
    
    try {
      if (batch.endDate) formattedEndDate = new Date(batch.endDate).toISOString().split('T')[0];
    } catch (e) {
      console.warn("Invalid end date", batch.endDate);
    }

    setFormData({
      batchName: batch.batchName || '',
      panelName: batch.panelName || '',
      panelSubheading: batch.panelSubheading || '',
      description: batch.description || '',
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      status: batch.status || 'Upcoming',
      checkInTime: batch.checkInTime || '',
      checkOutTime: batch.checkOutTime || '',
      autoCheckOutTime: batch.autoCheckOutTime || '21:00',
      autoCheckOutEnabled: batch.autoCheckOutEnabled !== undefined ? batch.autoCheckOutEnabled : true,
      mentorId: batch.mentorId?._id || batch.mentorId || '',
      requiredPresentHours: batch.requiredPresentHours !== undefined ? batch.requiredPresentHours : 8,
      maxValidHours: batch.maxValidHours !== undefined ? batch.maxValidHours : 10
    });
    setEditingId(batch._id);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        mentorId: formData.mentorId || null
      };

      if (editingId) {
        await axios.put(`/batches/${editingId}`, payload);
      } else {
        await axios.post('/batches', payload);
      }
      setShowModal(false);
      setFormData({ batchName: '', panelName: '', panelSubheading: '', description: '', startDate: '', endDate: '', status: 'Upcoming', checkInTime: '', checkOutTime: '', autoCheckOutTime: '21:00', autoCheckOutEnabled: true, mentorId: '' });
      setEditingId(null);
      fetchBatches();
    } catch (error) {
      console.error('Error saving batch:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/batches/${id}`);
        fetchBatches();
        Swal.fire('Deleted!', 'The batch has been deleted.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Could not delete batch.', 'error');
      }
    }
  };

  const handleDownloadReport = async (batchId, batchName) => {
    try {
      const { data } = await axios.get(`/batches/${batchId}/report`);
      
      if (!data || data.length === 0) {
        Swal.fire('No Data', 'There are no students joined in this batch yet.', 'info');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Batch Report");
      XLSX.writeFile(workbook, `${batchName.replace(/\s+/g, '_')}_Report.xlsx`);

    } catch (error) {
      console.error('Error downloading report:', error);
      Swal.fire('Error', 'Could not download the report.', 'error');
    }
  };

  const openStudentsModal = async (batch) => {
    setSelectedBatch(batch);
    setShowStudentsModal(true);
    setStudentsLoading(true);
    try {
      const { data } = await axios.get(`/enrollments/batch/${batch._id}`);
      setBatchStudents(data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleRemoveStudent = async (enrollmentId) => {
    const result = await Swal.fire({
      title: 'Remove student?',
      text: "This student will be removed from the batch.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove them!'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/enrollments/${enrollmentId}`);
        setBatchStudents(prev => prev.filter(enr => enr._id !== enrollmentId));
        Swal.fire('Removed!', 'The student has been removed from the batch.', 'success');
      } catch (error) {
        Swal.fire('Error', 'Could not remove student.', 'error');
      }
    }
  };

  // Excel Bulk Upload Logic
  const handleDownloadTemplate = () => {
    const sampleData = [
      { 'Name': 'John Doe', 'Register Number': 'REG2026001', 'Password': 'Password@123', 'Email': 'reg2026001@student.ssms' },
      { 'Name': 'Jane Smith', 'Register Number': 'REG2026002', 'Password': 'Password@123', 'Email': 'reg2026002@student.ssms' }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sampleData);
    XLSX.utils.book_append_sheet(wb, ws, 'Student Template');
    XLSX.writeFile(wb, 'students_import_template.xlsx');
  };

  const handleOpenUploadModal = (batch, defaultMode = 'single') => {
    setSelectedBatch(batch);
    setParsedStudents([]);
    setUploadFileName('');
    setImportMode(defaultMode);
    setSingleStudent({ name: '', rollNumber: '', email: '', password: '' });
    setShowUploadModal(true);
  };

  const handleSingleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!singleStudent.name.trim() || !singleStudent.rollNumber.trim()) {
      return Swal.fire('Error', 'Please provide both Student Name and Register / Roll Number.', 'error');
    }

    setSingleSaving(true);
    try {
      const studentData = {
        name: singleStudent.name.trim(),
        rollNumber: singleStudent.rollNumber.trim(),
        email: singleStudent.email.trim() || `${singleStudent.rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.ssms`,
        password: singleStudent.password.trim() || `${singleStudent.rollNumber.trim()}@123`
      };

      const { data } = await axios.post(`/batches/${selectedBatch._id}/bulk-upload-students`, {
        students: [studentData]
      });

      if (data.errors && data.errors.length > 0) {
        Swal.fire('Warning', data.errors.join('<br/>'), 'warning');
      } else {
        Swal.fire({
          title: 'Student Added!',
          text: `Successfully added ${singleStudent.name} (${singleStudent.rollNumber}) to ${selectedBatch.batchName}.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        setSingleStudent({ name: '', rollNumber: '', email: '', password: '' });
        fetchBatches();
        if (showStudentsModal && selectedBatch) {
          openStudentsModal(selectedBatch);
        }
      }
    } catch (error) {
      console.error('Single student add error:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to add student to batch', 'error');
    } finally {
      setSingleSaving(false);
    }
  };

  const processRawData = (rawData) => {
    const seenRegs = new Set();
    return rawData.map((row, idx) => {
      const name = (row['Name'] || row['name'] || '').toString().trim();
      const rollNumber = (row['Register Number'] || row['registerNumber'] || row['Roll Number'] || row['rollNumber'] || '').toString().trim();
      const password = (row['Password'] || row['password'] || '').toString().trim();

      let status = 'Valid';
      let message = 'Ready to import';

      if (!name || !rollNumber) {
        status = 'Invalid';
        message = 'Missing Name or Register Number';
      } else if (seenRegs.has(rollNumber)) {
        status = 'Warning';
        message = 'Duplicate Register Number in data';
      } else {
        seenRegs.add(rollNumber);
      }

      return {
        rowId: idx + 1,
        name,
        rollNumber,
        password: password || `${rollNumber}@123`,
        status,
        message
      };
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const processed = processRawData(rawData);
        setParsedStudents(processed);
      } catch (error) {
        console.error('File parse error:', error);
        Swal.fire('Error', 'Failed to parse Excel file. Please use the downloaded template.', 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleFetchGoogleSheet = async (e) => {
    e.preventDefault();
    if (!googleSheetUrl || !googleSheetUrl.trim()) {
      return Swal.fire('Error', 'Please enter a valid Google Sheet URL', 'error');
    }

    setFetchingSheet(true);
    try {
      const { data } = await axios.post('/batches/fetch-google-sheet', { url: googleSheetUrl.trim() });
      if (data.data && data.data.length > 0) {
        const processed = processRawData(data.data);
        setParsedStudents(processed);
        setUploadFileName(`Google Sheet (${data.count} rows)`);
        Swal.fire({
          title: 'Google Sheet Loaded!',
          text: `Successfully extracted ${data.count} student records from Google Sheet. Review the preview below.`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      } else {
        Swal.fire('Warning', 'No student records found in the Google Sheet.', 'warning');
      }
    } catch (error) {
      console.error('Google sheet fetch error:', error);
      Swal.fire({
        title: 'Publish Sheet Required',
        html: `
          <div className="text-left space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <p>Google Sheets requires public web publishing permission to extract data via link.</p>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-indigo-800 dark:text-indigo-300">Easy Fix (Takes 5 seconds):</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>In Google Sheets, click <strong>File → Share → Publish to web</strong></li>
                <li>Select <strong>Comma-separated values (.csv)</strong> and click <strong>Publish</strong></li>
                <li>Copy and paste that published link here!</li>
              </ol>
            </div>
            <p className="text-xs text-slate-500">Or click <strong>File → Download → Microsoft Excel (.xlsx)</strong> in Google Sheets and use <strong>Choose Excel File</strong> above.</p>
          </div>
        `,
        icon: 'info',
        confirmButtonText: 'Got it'
      });
    } finally {
      setFetchingSheet(false);
    }
  };

  const handleConfirmBulkUpload = async () => {
    const validRows = parsedStudents.filter(s => s.status !== 'Invalid');

    if (validRows.length === 0) {
      return Swal.fire('Warning', 'No valid student records found to import.', 'warning');
    }

    setIsUploading(true);
    try {
      const { data } = await axios.post(`/batches/${selectedBatch._id}/bulk-upload-students`, {
        students: validRows
      });

      Swal.fire({
        title: 'Bulk Upload Complete',
        html: `
          <div className="text-left space-y-2 text-sm">
            <p><strong>Total Processed:</strong> ${data.total}</p>
            <p className="text-emerald-400"><strong>New Student Accounts:</strong> ${data.createdCount}</p>
            <p className="text-indigo-400"><strong>Enrolled in Batch:</strong> ${data.enrolledCount}</p>
            ${data.errors?.length > 0 ? `<p className="text-rose-400"><strong>Errors:</strong> ${data.errors.length}</p>` : ''}
          </div>
        `,
        icon: 'success'
      });

      setShowUploadModal(false);
      setParsedStudents([]);
      fetchBatches();
      if (showStudentsModal && selectedBatch) {
        openStudentsModal(selectedBatch);
      }
    } catch (error) {
      console.error('Bulk upload error:', error);
      Swal.fire('Upload Failed', error.response?.data?.message || 'Failed to upload students', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      (batch.batchName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (batch.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'All' || 
      batch.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const validPreviewCount = parsedStudents.filter(s => s.status === 'Valid').length;
  const warningPreviewCount = parsedStudents.filter(s => s.status === 'Warning').length;
  const invalidPreviewCount = parsedStudents.filter(s => s.status === 'Invalid').length;

  const filteredPreviewStudents = parsedStudents.filter(s => {
    if (previewFilter === 'valid') return s.status === 'Valid' || s.status === 'Warning';
    if (previewFilter === 'invalid') return s.status === 'Invalid';
    return true;
  });

  if (loading) return <SkeletonLoader type="card-grid" />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="text-indigo-500" size={28} />
            Batch & Student Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Assign mentors to batches and bulk import students using Excel</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleDownloadTemplate} className="px-4 py-2.5 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-xl text-sm font-medium flex items-center gap-2 border border-slate-700/60 shadow-sm transition-all cursor-pointer">
            <FileSpreadsheet size={18} className="text-emerald-400" /> Excel Template
          </button>
          {user?.role === 'admin' && (
            <button onClick={() => { setFormData({ batchName: '', description: '', startDate: '', endDate: '', status: 'Upcoming', checkInTime: '', checkOutTime: '', mentorId: '', requiredPresentHours: 8, maxValidHours: 10 }); setEditingId(null); setShowModal(true); }} className="btn-primary flex items-center gap-2 cursor-pointer">
              <Plus size={20} /> Create Batch
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50 shadow-sm">
        <div className="relative w-full sm:w-auto sm:flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search batch name or description..."
            className="input-field pl-9 py-1.5 text-sm w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button
          onClick={fetchBatches}
          disabled={loading}
          className="p-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
          title="Refresh Data"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>

        <select 
          className="input-field py-1.5 text-sm w-full sm:w-auto min-w-[140px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Upcoming">Upcoming</option>
          <option value="Completed">Completed</option>
        </select>

        <button 
          onClick={handleResetFilters}
          className="px-3 py-1.5 flex items-center justify-center gap-1.5 font-medium text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/20 rounded-lg hover:bg-rose-100 transition-colors border border-rose-100 dark:border-rose-800/50 whitespace-nowrap cursor-pointer w-full sm:w-auto sm:ml-auto"
          title="Reset Filters"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBatches.length === 0 ? (
          <div className="col-span-full glass-panel p-12 text-center text-slate-500 dark:text-slate-400">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-emerald-400 opacity-50" />
            <p className="text-xl font-bold text-slate-800 dark:text-slate-200">No batches found</p>
            <p className="text-sm mt-1 font-medium">Try adjusting your filters or search term.</p>
          </div>
        ) : (
          filteredBatches.map((batch) => (
          <div key={batch._id} className="glass-panel p-6 card-hover flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{batch.batchName}</h3>
                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                  batch.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                  batch.status === 'Completed' ? 'bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  {batch.status}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 line-clamp-2">{batch.description}</p>
              
              {/* Assigned Mentor Badge */}
              <div className="mb-3 p-2.5 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck size={16} className="text-indigo-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Assigned Mentor:</span>
                </div>
                <span className="font-bold text-indigo-700 dark:text-indigo-300">
                  {batch.mentorId?.name || 'Unassigned'}
                </span>
              </div>

              {/* Attendance Hours Limits Badge */}
              <div className="mb-4 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 p-2 px-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                <span>Present: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">≥ {batch.requiredPresentHours !== undefined ? batch.requiredPresentHours : 8}h</strong></span>
                <span>Max Valid: <strong className="text-amber-600 dark:text-amber-400 font-bold">≤ {batch.maxValidHours !== undefined ? batch.maxValidHours : 10}h</strong></span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1"><Calendar size={16}/> {new Date(batch.startDate).toLocaleDateString()}</div>
                  <span>to</span>
                  <div className="flex items-center gap-1"><Calendar size={16}/> {new Date(batch.endDate).toLocaleDateString()}</div>
                </div>
                {(batch.checkInTime || batch.checkOutTime) && (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Clock size={16}/> {batch.checkInTime || '--:--'} - {batch.checkOutTime || '--:--'}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex gap-2 w-full mb-3">
                <button 
                  onClick={() => openStudentsModal(batch)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Users size={16} /> Students
                </button>
                {user?.role === 'admin' && (
                  <button 
                    onClick={() => handleOpenUploadModal(batch)}
                    className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                  >
                    <Upload size={16} /> Bulk Excel
                  </button>
                )}
                <button 
                  onClick={() => handleDownloadReport(batch._id, batch.batchName)}
                  className="py-2 px-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors border border-emerald-100 dark:border-emerald-800 cursor-pointer"
                  title="Download Report"
                >
                  <Download size={16} />
                </button>
              </div>

              {user?.role === 'admin' && (
                <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button onClick={() => handleEdit(batch)} className="text-indigo-600 hover:text-indigo-700 p-2 rounded-md hover:bg-indigo-50 transition-colors flex items-center gap-1 text-xs font-semibold cursor-pointer">
                    <Edit size={16} /> Edit Batch
                  </button>
                  <button onClick={() => handleDelete(batch._id)} className="text-red-500 hover:text-red-600 p-2 rounded-md hover:bg-red-50 transition-colors ml-auto cursor-pointer">
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )))}
      </div>

      {/* Create / Edit Batch Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 font-bold">
                  <Layers size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">
                    {editingId ? 'Edit Batch Configuration' : 'Create New Training Batch'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Set up custom portal branding, schedules, and attendance rules.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Scroll Container */}
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-left custom-scrollbar">
              {/* Section 1: Basic & Branding */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <BookOpen size={14} /> 1. Batch & Portal Branding
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Batch Name *</label>
                    <input 
                      required 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white text-sm font-semibold" 
                      value={formData.batchName} 
                      onChange={e => setFormData({...formData, batchName: e.target.value})} 
                      placeholder="e.g. FullStack Java 2026 Batch A" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Assign Mentor</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white text-sm cursor-pointer"
                      value={formData.mentorId}
                      onChange={e => setFormData({...formData, mentorId: e.target.value})}
                    >
                      <option value="">-- No Mentor Assigned --</option>
                      {mentors.map(m => (
                        <option key={m._id} value={m._id}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Panel Main Heading (Acronym)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white text-sm placeholder:text-slate-500 font-extrabold" 
                      value={formData.panelName || ''} 
                      onChange={e => setFormData({...formData, panelName: e.target.value})} 
                      placeholder="e.g. PSMS (Default: SSMS 3.0)" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Panel Subheading (Full System Name)</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white text-sm placeholder:text-slate-500" 
                      value={formData.panelSubheading || ''} 
                      onChange={e => setFormData({...formData, panelSubheading: e.target.value})} 
                      placeholder="e.g. Prathik Students Management System" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description *</label>
                  <textarea 
                    required 
                    rows="2" 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none transition-all dark:text-white text-sm" 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    placeholder="Short description of batch curriculum and timing"
                  />
                </div>
              </div>

              {/* Section 2: Dates & Attendance Times */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <Calendar size={14} /> 2. Schedule & Daily Attendance Timings
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
                    <input required type="date" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-xs text-slate-800 dark:text-white" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">End Date *</label>
                    <input required type="date" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-xs text-slate-800 dark:text-white" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Check-in Time</label>
                    <input type="time" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-xs text-slate-800 dark:text-white" value={formData.checkInTime} onChange={e => setFormData({...formData, checkInTime: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Check-out Time</label>
                    <input type="time" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-xs text-slate-800 dark:text-white" value={formData.checkOutTime} onChange={e => setFormData({...formData, checkOutTime: e.target.value})} />
                  </div>
                </div>

                {/* Automated Daily Auto Check-Out Setup */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 cursor-pointer" htmlFor="autoCheckOutEnabled">
                      <Clock size={15} /> Automated Daily Auto Check-Out Rule
                    </label>
                    <input
                      type="checkbox"
                      id="autoCheckOutEnabled"
                      checked={formData.autoCheckOutEnabled !== false}
                      onChange={e => setFormData({ ...formData, autoCheckOutEnabled: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 cursor-pointer"
                    />
                  </div>
                  {formData.autoCheckOutEnabled !== false && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="sm:w-48">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 mb-1">
                          Auto Check-Out Cutoff Time
                        </label>
                        <input 
                          type="time" 
                          className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-white outline-none focus:border-amber-500 font-bold" 
                          value={formData.autoCheckOutTime || '21:00'} 
                          onChange={e => setFormData({ ...formData, autoCheckOutTime: e.target.value })} 
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex-1 leading-relaxed">
                        Students who forget to check out at the end of the day will be automatically checked out by the system at this cutoff time daily.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 3: Attendance Thresholds & Status */}
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-500 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                  <CheckCircle size={14} /> 3. Attendance Rules & Batch Status
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Present Hours Limit *</label>
                    <input 
                      required 
                      type="number" 
                      min="1" 
                      max="24" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-sm text-slate-800 dark:text-white font-bold" 
                      value={formData.requiredPresentHours} 
                      onChange={e => setFormData({...formData, requiredPresentHours: e.target.value})} 
                      placeholder="8"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Min hours for Present (default: 8)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Valid Hours Limit *</label>
                    <input 
                      required 
                      type="number" 
                      min="1" 
                      max="24" 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-sm text-slate-800 dark:text-white font-bold" 
                      value={formData.maxValidHours} 
                      onChange={e => setFormData({...formData, maxValidHours: e.target.value})} 
                      placeholder="10"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Hours above this set Invalid (default: 10)</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Batch Status</label>
                    <select 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:border-indigo-500 outline-none text-sm text-slate-800 dark:text-white cursor-pointer font-bold" 
                      value={formData.status} 
                      onChange={e => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3 justify-end shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-5 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving} 
                  className="px-6 py-2.5 rounded-xl font-extrabold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 text-xs transition-all hover:scale-[1.02] cursor-pointer"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving ? 'Saving Batch...' : (editingId ? 'Update Batch' : 'Create Batch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Students in Batch Modal */}
      {showStudentsModal && selectedBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="glass-panel w-full max-w-2xl flex flex-col max-h-[80vh] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <div className="p-6 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-800/80">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Users className="text-indigo-400" size={22} />
                  Students in {selectedBatch.batchName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Enrolled Students: {batchStudents.length}</p>
              </div>
              <div className="flex items-center gap-2">
                {user?.role === 'admin' && (
                  <>
                    <button 
                      onClick={() => handleOpenUploadModal(selectedBatch, 'single')}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <UserPlus size={14} /> Add Single Student
                    </button>
                    <button 
                      onClick={() => handleOpenUploadModal(selectedBatch, 'bulk')}
                      className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Upload size={14} /> Bulk Add Excel
                    </button>
                  </>
                )}
                <button onClick={() => setShowStudentsModal(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-300 p-1.5 rounded-full hover:bg-slate-700/50 cursor-pointer">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {studentsLoading ? (
                <Loader />
              ) : batchStudents.length === 0 ? (
                <div className="text-center text-slate-500 dark:text-slate-400 p-8 border-2 border-dashed border-slate-700/50 rounded-xl bg-slate-800/30">
                  <Users className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                  <p className="font-semibold text-slate-300">No students enrolled yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {user?.role === 'admin' ? "Click 'Bulk Add Excel' to quickly import students into this batch." : "Contact system administrator to assign students into this batch."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {batchStudents.map(enr => (
                    <div key={enr._id} className="flex items-center justify-between p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl shadow-sm hover:border-indigo-500/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex flex-shrink-0 items-center justify-center font-bold text-sm">
                          {enr.studentId?.name?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{enr.studentId?.name}</p>
                          <p className="text-xs text-slate-400">Reg: <span className="text-indigo-400 font-mono">{enr.studentId?.rollNumber || 'N/A'}</span> • {enr.studentId?.email}</p>
                        </div>
                      </div>
                      {user?.role === 'admin' && (
                        <button 
                          onClick={() => handleRemoveStudent(enr._id)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-rose-500/20 cursor-pointer"
                        >
                          <UserMinus size={14} /> Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Student Add & Excel Bulk Upload Preview Modal */}
      {showUploadModal && selectedBatch && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  {importMode === 'single' ? <UserPlus size={24} /> : <FileSpreadsheet size={24} />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {importMode === 'single' ? 'Add Single Student' : 'Bulk Student Import'} — {selectedBatch.batchName}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {importMode === 'single' 
                      ? 'Add an individual student directly into this batch database' 
                      : 'Upload Excel sheet (.xlsx / .csv) to preview and import students into database'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="px-6 pt-3 bg-slate-900/90 border-b border-slate-800 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setImportMode('single')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  importMode === 'single'
                    ? 'border-emerald-400 text-emerald-400 bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <UserPlus size={15} /> Single Student Add
              </button>
              <button
                type="button"
                onClick={() => setImportMode('bulk')}
                className={`px-4 py-2.5 text-xs font-bold rounded-t-xl border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                  importMode === 'bulk'
                    ? 'border-emerald-400 text-emerald-400 bg-slate-800/80'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet size={15} /> Bulk Excel Import
              </button>
            </div>

            {/* Content Area */}
            {importMode === 'single' ? (
              <form onSubmit={handleSingleStudentSubmit} className="p-6 overflow-y-auto space-y-5 flex-1 max-w-2xl mx-auto w-full">
                <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/60 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Student Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                      value={singleStudent.name}
                      onChange={e => setSingleStudent({ ...singleStudent, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Register / Roll Number (Primary Key) <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 4MT20CS045"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono"
                      value={singleStudent.rollNumber}
                      onChange={e => setSingleStudent({ ...singleStudent, rollNumber: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Initial Password <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Defaults to RegisterNumber@123 if left blank"
                      className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 outline-none font-mono"
                      value={singleStudent.password}
                      onChange={e => setSingleStudent({ ...singleStudent, password: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-5 py-2.5 rounded-xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={singleSaving}
                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-xs transition-all cursor-pointer"
                  >
                    {singleSaving ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    {singleSaving ? 'Adding Student...' : 'Add Student to Batch'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                  {/* File Select & Template & Google Sheet Link Controls */}
                  <div className="space-y-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/50">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-700/50">
                      <div className="flex items-center gap-3 w-full sm:w-auto">
                        <label className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-sm cursor-pointer flex items-center gap-2 shadow-md transition-all">
                          <Upload size={16} /> Choose Excel File
                          <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-xs text-slate-300 truncate max-w-[200px]">
                          {uploadFileName || 'No file chosen'}
                        </span>
                      </div>

                      <button
                        onClick={handleDownloadTemplate}
                        className="px-3.5 py-2 bg-slate-800 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 hover:bg-slate-700 transition-colors"
                      >
                        <Download size={14} className="text-emerald-400" /> Download Standard Template
                      </button>
                    </div>

                    {/* Google Sheet URL Import */}
                    <form onSubmit={handleFetchGoogleSheet} className="space-y-2">
                      <label className="block text-xs font-bold text-slate-300">
                        Or Import via Google Sheet Link
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Link2 size={16} />
                          </div>
                          <input
                            type="url"
                            placeholder="Paste Google Sheet URL (e.g. https://docs.google.com/spreadsheets/d/...)"
                            value={googleSheetUrl}
                            onChange={(e) => setGoogleSheetUrl(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:border-emerald-500 outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={fetchingSheet || !googleSheetUrl.trim()}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
                        >
                          {fetchingSheet ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          {fetchingSheet ? 'Fetching...' : 'Fetch & Load Sheet'}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        💡 <strong>Pro-tip:</strong> Click <strong>File → Share → Publish to web</strong> in Google Sheets, select <strong>CSV</strong>, click Publish, and paste that link here for instant import!
                      </p>
                    </form>
                  </div>

                  {/* Parsed Preview Stats Badges */}
                  {parsedStudents.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-slate-400">Total Rows Found</p>
                          <p className="text-xl font-bold text-white mt-0.5">{parsedStudents.length}</p>
                        </div>
                        <FileSpreadsheet className="text-indigo-400" size={24} />
                      </div>
                      <div className="p-4 bg-emerald-950/30 rounded-xl border border-emerald-800/40 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-emerald-400">Valid Records</p>
                          <p className="text-xl font-bold text-emerald-300 mt-0.5">{validPreviewCount + warningPreviewCount}</p>
                        </div>
                        <CheckCircle className="text-emerald-400" size={24} />
                      </div>
                      <div className="p-4 bg-rose-950/30 rounded-xl border border-rose-800/40 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-rose-400">Errors / Missing Data</p>
                          <p className="text-xl font-bold text-rose-300 mt-0.5">{invalidPreviewCount}</p>
                        </div>
                        <AlertTriangle className="text-rose-400" size={24} />
                      </div>
                    </div>
                  )}

                  {/* Data Grid Preview Table */}
                  {parsedStudents.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">Live Data Preview</h3>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewFilter('all')}
                            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          >
                            All ({parsedStudents.length})
                          </button>
                          <button
                            onClick={() => setPreviewFilter('valid')}
                            className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'valid' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                          >
                            Valid ({validPreviewCount + warningPreviewCount})
                          </button>
                          {invalidPreviewCount > 0 && (
                            <button
                              onClick={() => setPreviewFilter('invalid')}
                              className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${previewFilter === 'invalid' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                            >
                              Errors ({invalidPreviewCount})
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="border border-slate-700/60 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-slate-800 text-slate-400 uppercase font-semibold sticky top-0 border-b border-slate-700">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">Status</th>
                              <th className="p-3">Name</th>
                              <th className="p-3">Register Number (PK)</th>
                              <th className="p-3">Password</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                            {filteredPreviewStudents.map((row) => (
                              <tr key={row.rowId} className="hover:bg-slate-800/40">
                                <td className="p-3 font-mono text-slate-400">{row.rowId}</td>
                                <td className="p-3">
                                  {row.status === 'Valid' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 font-medium">
                                      <CheckCircle size={12} /> Valid
                                    </span>
                                  )}
                                  {row.status === 'Warning' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-md border border-amber-500/20 font-medium">
                                      <AlertTriangle size={12} /> Duplicate
                                    </span>
                                  )}
                                  {row.status === 'Invalid' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-rose-500/10 text-rose-400 rounded-md border border-rose-500/20 font-medium">
                                      <AlertTriangle size={12} /> Missing Data
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 font-medium text-white">{row.name || <span className="text-rose-400 italic">Empty</span>}</td>
                                <td className="p-3 font-mono text-indigo-400">{row.rollNumber || <span className="text-rose-400 italic">Empty</span>}</td>
                                <td className="p-3 text-slate-400 font-mono">{row.password}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                      <Upload className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                      <p className="text-sm font-semibold text-slate-300">Select an Excel file or paste a Google Sheet link</p>
                      <p className="text-xs text-slate-500 mt-1">Columns supported: Name, Register Number (PK), Password</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-slate-800 bg-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={parsedStudents.length === 0 || isUploading || (validPreviewCount + warningPreviewCount === 0)}
                    onClick={handleConfirmBulkUpload}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 rounded-xl shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
                  >
                    {isUploading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {isUploading ? 'Importing Students...' : `Confirm & Save ${validPreviewCount + warningPreviewCount} Students into Database`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchManagement;

