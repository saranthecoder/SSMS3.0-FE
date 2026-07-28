import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
  FileText, Plus, Edit, Trash2, Search, RefreshCw, X, ExternalLink, Link2, 
  Layers, User, Calendar, BookOpen, UploadCloud, File, Folder, Tag, CheckCircle2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const NotesManagement = () => {
  const { user, selectedBatchId, batchesList } = useAuth();
  const [notes, setNotes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'link'
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    batchId: '',
    category: 'General'
  });

  const fetchNotesAndBatches = async () => {
    try {
      setLoading(true);
      const [notesRes, batchesRes] = await Promise.all([
        axios.get('/notes'),
        axios.get('/batches')
      ]);
      setNotes(notesRes.data);
      setBatches(batchesRes.data || []);
    } catch (error) {
      console.error('Failed to load notes or batches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotesAndBatches();
  }, []);

  // Filter notes based on global selectedBatchId & search & category
  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (note.description && note.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (note.url && note.url.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesBatch = selectedBatchId === 'all' || 
      !note.batchId ||
      note.batchId?._id === selectedBatchId ||
      note.batchId === selectedBatchId;

    const matchesCategory = selectedCategory === 'all' || 
      (note.category && note.category.toLowerCase() === selectedCategory.toLowerCase());
    
    return matchesSearch && matchesBatch && matchesCategory;
  });

  const openAddModal = () => {
    setEditingNote(null);
    setSelectedFile(null);
    setUploadMode('file');
    const defaultBatch = (user?.role === 'mentor' && batches.length > 0)
      ? (selectedBatchId && selectedBatchId !== 'all' ? selectedBatchId : batches[0]._id)
      : '';
    setFormData({
      title: '',
      url: '',
      description: '',
      batchId: defaultBatch,
      category: 'General'
    });
    setModalOpen(true);
  };

  const openEditModal = (note) => {
    setEditingNote(note);
    setSelectedFile(null);
    setUploadMode('link');
    setFormData({
      title: note.title || '',
      url: note.url || '',
      description: note.description || '',
      batchId: note.batchId?._id || '',
      category: note.category || 'General'
    });
    setModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        return Swal.fire('File Too Large', 'Maximum file size allowed is 50MB.', 'warning');
      }
      setSelectedFile(file);
      if (!formData.title) {
        const titleWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setFormData(prev => ({ ...prev, title: titleWithoutExt }));
      }
    }
  };

  const handleDelete = async (note) => {
    const result = await Swal.fire({
      title: 'Delete Study Material?',
      text: `Are you sure you want to delete "${note.title}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/notes/${note._id}`);
        fetchNotesAndBatches();
        Swal.fire('Deleted!', 'Study material has been deleted.', 'success');
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete study material.', 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalUrl = formData.url;

    // Handle File Upload if in File Mode
    if (!editingNote && uploadMode === 'file') {
      if (!selectedFile) {
        return Swal.fire('Missing File', 'Please select a document file to upload.', 'warning');
      }
      
      try {
        setIsUploadingFile(true);
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);

        const { data } = await axios.post('/upload', uploadFormData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        });
        finalUrl = data.url;
      } catch (error) {
        setIsUploadingFile(false);
        return Swal.fire('Upload Failed', error.response?.data?.message || 'File upload failed.', 'error');
      } finally {
        setIsUploadingFile(false);
      }
    }

    if (!formData.title || !finalUrl) {
      return Swal.fire('Validation Error', 'Title and File/URL are required.', 'warning');
    }

    try {
      const payload = {
        title: formData.title,
        url: finalUrl,
        description: formData.description,
        batchId: formData.batchId || undefined,
        category: formData.category
      };

      if (editingNote) {
        await axios.put(`/notes/${editingNote._id}`, payload);
        Swal.fire({
          title: 'Updated!',
          text: 'Study material updated successfully.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        await axios.post('/notes', payload);
        Swal.fire({
          title: 'Uploaded!',
          text: 'Study material uploaded successfully.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
      setModalOpen(false);
      fetchNotesAndBatches();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to save study material.', 'error');
    }
  };

  const getResourceType = (url) => {
    if (!url) return { name: 'Document', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
    const lower = url.toLowerCase();
    if (lower.includes('drive.google.com')) return { name: 'Google Drive', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    if (lower.includes('notion.site') || lower.includes('notion.so')) return { name: 'Notion', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    if (lower.includes('github.com')) return { name: 'GitHub', color: 'bg-slate-500/10 text-slate-300 border-slate-500/20' };
    if (lower.endsWith('.pdf') || lower.includes('/uploads/') && lower.includes('.pdf')) return { name: 'PDF Document', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return { name: 'Word Doc', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    return { name: 'Resource Link', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BookOpen className="text-emerald-500" size={24} />
            <h1 className="text-2xl font-black text-slate-800 dark:text-white">Study Notes & Material Center</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Upload document PDFs, course reference sheets, and cloud study notes assigned to active batches.
          </p>
        </div>
        
        <button
          onClick={openAddModal}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02] active:scale-95 cursor-pointer shrink-0"
        >
          <Plus size={18} /> Upload Study Material
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search material by title, keywords or URL..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 whitespace-nowrap shadow-xs">
            <span>Scope:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{selectedBatchId === 'all' ? 'All Batches' : (batchesList.find(b => b._id === selectedBatchId)?.batchName || 'Active Batch')}</span>
          </div>

          <button
            onClick={fetchNotesAndBatches}
            disabled={loading}
            className="p-2.5 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-colors shrink-0 cursor-pointer shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-500' : ''} />
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
          <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin text-emerald-500" />
          <p className="font-bold text-slate-700 dark:text-slate-300">Loading study material library...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="p-16 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl space-y-3">
          <FileText className="w-16 h-16 mx-auto text-slate-400 dark:text-slate-600" />
          <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Study Material Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">Upload course PDF reference documents or Drive links for students in this batch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredNotes.map(note => {
            const resType = getResourceType(note.url);

            return (
              <div 
                key={note._id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl relative overflow-hidden flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-emerald-500/40 group"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1">
                      <Layers size={11} className="text-emerald-500" /> {note.batchId ? (note.batchId.batchName || note.batchId.name) : '🌐 Global Notes'}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg border ${resType.color}`}>
                      {resType.name}
                    </span>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                      <FileText size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-slate-800 dark:text-white text-base leading-snug group-hover:text-emerald-500 transition-colors truncate">
                        {note.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2 min-h-[2.5rem]">
                        {note.description || 'No description or details provided.'}
                      </p>
                    </div>
                  </div>

                  {/* Details Footer */}
                  <div className="space-y-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1"><User size={12} className="text-slate-400" /> By: <strong className="text-slate-700 dark:text-slate-300">{note.uploadedBy?.name || 'Admin'}</strong></span>
                      <span className="flex items-center gap-1"><Calendar size={12} className="text-slate-400" /> {formatDate(note.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                  <a 
                    href={note.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="px-3.5 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink size={13} /> View Material
                  </a>
                  <button 
                    onClick={() => openEditModal(note)}
                    className="flex-1 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white border border-indigo-500/20 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit size={13} /> Edit
                  </button>
                  <button 
                    onClick={() => handleDelete(note)}
                    className="p-2 bg-rose-500/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Delete Note"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Add Modal Overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <BookOpen className="text-emerald-500" size={20} />
                {editingNote ? 'Edit Study Material' : 'Upload Study Material'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 max-h-[85vh] overflow-y-auto space-y-4">
              {/* Tab Selector (File Upload vs Cloud Link) if creating new note */}
              {!editingNote && (
                <div className="flex rounded-xl bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setUploadMode('file')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      uploadMode === 'file' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <UploadCloud size={14} /> Document Upload (PDF/DOC)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadMode('link')}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      uploadMode === 'link' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <Link2 size={14} /> Cloud Link (Drive/Notion)
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chapter 4: Database Normalization"
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              {uploadMode === 'file' && !editingNote ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Document File (PDF, DOCX, PPTX - Max 50MB)</label>
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-6 text-center hover:border-emerald-500 transition-colors bg-slate-50 dark:bg-slate-950">
                    <input 
                      type="file" 
                      id="file-upload" 
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.zip"
                      onChange={handleFileChange}
                      className="hidden" 
                    />
                    <label htmlFor="file-upload" className="cursor-pointer space-y-2 block">
                      <UploadCloud className="w-10 h-10 mx-auto text-emerald-500 animate-bounce" />
                      {selectedFile ? (
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                          <CheckCircle2 size={14} /> {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Click to select document file</p>
                          <p className="text-xs text-slate-400 mt-1">Supports PDF, DOCX, PPTX, TXT</p>
                        </div>
                      )}
                    </label>
                  </div>
                  {isUploadingFile && (
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-xs font-bold text-emerald-500">
                        <span>Uploading File...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <Link2 size={12} className="text-emerald-500" /> Resource URL (Google Drive, Notion, GitHub, etc.)
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 font-mono text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Target Batch</label>
                <select
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  value={formData.batchId}
                  onChange={(e) => setFormData(prev => ({ ...prev, batchId: e.target.value }))}
                >
                  {user?.role === 'admin' && (
                    <option value="">🌐 Global (All Batches & Students)</option>
                  )}
                  {batches.map(batch => (
                    <option key={batch._id} value={batch._id}>
                      📦 {batch.batchName || batch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Description / Notes Details</label>
                <textarea
                  rows="3"
                  placeholder="Practice questions, syllabus worksheets, reference guidelines..."
                  className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-emerald-500"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploadingFile}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  {editingNote ? 'Save Changes' : 'Upload Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesManagement;
