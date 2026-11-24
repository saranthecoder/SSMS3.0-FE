import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
  FileText, Search, RefreshCw, ExternalLink, Calendar, User, 
  Layers, BookOpen, Copy, Check, Globe, FileCode, Presentation, Sparkles, Filter, X
} from 'lucide-react';

const getDocType = (url = '', title = '') => {
  const lowerUrl = (url || '').toLowerCase();
  const lowerTitle = (title || '').toLowerCase();

  if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) {
    if (lowerUrl.includes('spreadsheets') || lowerTitle.includes('sheet') || lowerTitle.includes('excel')) {
      return { 
        label: 'Google Sheet', 
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
        iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
      };
    }
    if (lowerUrl.includes('presentation') || lowerTitle.includes('slide') || lowerTitle.includes('ppt')) {
      return { 
        label: 'Presentation', 
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
        iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
      };
    }
    return { 
      label: 'Google Drive Doc', 
      badgeColor: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
      iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
    };
  }
  if (lowerUrl.endsWith('.pdf') || lowerTitle.includes('pdf')) {
    return { 
      label: 'PDF Document', 
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
      iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
    };
  }
  if (lowerUrl.includes('github.com') || lowerTitle.includes('code') || lowerTitle.includes('repo')) {
    return { 
      label: 'Source Code', 
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' 
    };
  }
  return { 
    label: 'Reference Material', 
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
  };
};

const StudentNotes = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  
  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/notes');
      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load notes:', error);
      Swal.fire('Error', 'Could not load your study notes library.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleCopy = (note) => {
    if (!note.url) return;
    navigator.clipboard.writeText(note.url);
    setCopiedId(note._id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q || 
        (note.title || '').toLowerCase().includes(q) || 
        (note.description || '').toLowerCase().includes(q);

      if (!matchSearch) return false;

      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'drive') return (note.url || '').includes('google.com');
      if (selectedCategory === 'pdf') return (note.url || '').toLowerCase().endsWith('.pdf') || (note.title || '').toLowerCase().includes('pdf');
      if (selectedCategory === 'batch') return Boolean(note.batchId);
      if (selectedCategory === 'global') return !note.batchId;
      return true;
    });
  }, [notes, searchTerm, selectedCategory]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto pb-16">
      
      {/* Modern Hero Header Banner */}
      <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 rounded-3xl text-white shadow-xl shadow-emerald-500/15 overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-amber-400/15 rounded-full blur-2xl -ml-16 -mb-16 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-emerald-100 text-xs font-bold mb-3 border border-white/20">
              <Sparkles size={13} className="text-amber-300" />
              <span>Curriculum & Knowledge Base</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-3">
              Study Notes Library
            </h1>
            <p className="text-emerald-50 mt-2 font-medium text-sm sm:text-base max-w-2xl leading-relaxed">
              Access your batch-specific and global reference guidelines, worksheets, and lecture notes curated by instructors.
            </p>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/15 backdrop-blur-md border border-white/20 px-6 py-3.5 rounded-2xl text-center shadow-lg">
              <span className="text-3xl font-black text-white">{notes.length}</span>
              <p className="text-[10px] text-emerald-100 mt-0.5 font-black uppercase tracking-wider">Total Documents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 rounded-3xl shadow-sm space-y-3">
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Search notes by document title, keywords or details..."
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
              >
                <X size={15} />
              </button>
            )}
          </div>

          <button
            onClick={fetchNotes}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all shrink-0 cursor-pointer shadow-xs"
            title="Refresh Notes"
          >
            <RefreshCw size={17} className={loading ? 'animate-spin text-emerald-500' : ''} />
          </button>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pt-1">
          {[
            { id: 'all', label: `All Notes (${notes.length})` },
            { id: 'drive', label: 'Google Drive / Docs' },
            { id: 'pdf', label: 'PDF Documents' },
            { id: 'batch', label: 'My Batch Material' },
            { id: 'global', label: 'Global Resources' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === tab.id
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="py-24 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin text-emerald-500 opacity-80" />
          <p className="font-extrabold text-slate-800 dark:text-slate-200">Loading your study documents...</p>
          <p className="text-xs text-slate-400 mt-1">Retrieving official learning resources</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-16 text-center text-slate-500 dark:text-slate-400 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FileText size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">No notes found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            {searchTerm ? 'No material matching your search filter.' : 'No study notes have been shared in this category yet.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}
              className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredNotes.map(note => {
            const docType = getDocType(note.url, note.title);
            const isCopied = copiedId === note._id;

            return (
              <div 
                key={note._id} 
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden text-left"
              >
                {/* Subtle Hover Ambient Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors pointer-events-none" />

                <div>
                  {/* Top Badges */}
                  <div className="flex justify-between items-center gap-2 mb-4">
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center gap-1.5 shrink-0">
                      <Layers size={11} className="text-emerald-500" /> 
                      {note.batchId ? (note.batchId.batchName || note.batchId.name || 'Batch Scoped') : '🌐 Global Notes'}
                    </span>

                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${docType.badgeColor} shrink-0`}>
                      {docType.label}
                    </span>
                  </div>

                  {/* Main Header with Document Icon */}
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${docType.iconBg}`}>
                      <FileText size={24} className="stroke-[2.2]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-slate-900 dark:text-white text-base leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                        {note.title}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2 min-h-[2.4rem] font-medium">
                        {note.description || 'Reference document provided for your learning milestones.'}
                      </p>
                    </div>
                  </div>

                  {/* Document Meta Information */}
                  <div className="space-y-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User size={13} className="text-slate-400" />
                        <span>Uploaded by: <strong className="text-slate-800 dark:text-slate-200">{note.uploadedBy?.name || 'Instructor'}</strong></span>
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Calendar size={12} /> {formatDate(note.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Action Buttons */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 mt-5 flex items-center gap-2">
                  <a
                    href={note.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 flex items-center justify-center gap-2 font-black text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl transition-all shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/30 cursor-pointer active:scale-95"
                  >
                    <ExternalLink size={14} /> Open Notes Document
                  </a>

                  <button
                    onClick={() => handleCopy(note)}
                    className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer shrink-0 border border-slate-200 dark:border-slate-700"
                    title={isCopied ? "Copied!" : "Copy URL"}
                  >
                    {isCopied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentNotes;