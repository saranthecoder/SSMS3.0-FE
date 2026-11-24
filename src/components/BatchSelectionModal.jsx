import React, { useState, useMemo, useEffect } from 'react';
import { useGlobalBatch } from '../context/GlobalBatchContext';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  CheckCircle2, 
  Search, 
  X, 
  Calendar, 
  UserCheck, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  Layers, 
  GraduationCap,
  RefreshCw,
  Clock,
  AlertCircle,
  Lock
} from 'lucide-react';

const BatchSelectionModal = () => {
  const { user } = useAuth();
  const { 
    selectedBatchId, 
    selectedBatchName, 
    batchesList, 
    isLoadingBatches, 
    isBatchModalOpen, 
    closeBatchModal, 
    selectBatch, 
    refreshBatches 
  } = useGlobalBatch();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'Active', 'Completed'

  // The modal is mandatory/blocking if no valid batch is currently selected
  const isMandatory = !selectedBatchId;
  const isVisible = (user?.role === 'admin' || user?.role === 'mentor') && (isBatchModalOpen || isMandatory);

  // Prevent background scroll when modal is active
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isVisible]);

  // Filter batches by search term and status
  const filteredBatches = useMemo(() => {
    if (!isVisible || !Array.isArray(batchesList)) return [];
    return batchesList.filter((b) => {
      // For mentors, show ONLY the batches assigned to them
      if (user?.role === 'mentor') {
        const uId = (user?._id || '').toString();
        const mId = (b.mentorId?._id || b.mentorId)?.toString();
        const inMentors = Array.isArray(b.mentors) && b.mentors.some(m => (m?._id || m)?.toString() === uId);
        if (mId !== uId && !inMentors) return false;
      }

      const name = (b.batchName || '').toLowerCase();
      const mentor = (b.mentorId?.name || '').toLowerCase();
      const desc = (b.description || '').toLowerCase();
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = !term || name.includes(term) || mentor.includes(term) || desc.includes(term);
      const matchesStatus = filterStatus === 'all' || (b.status || 'Active').toLowerCase() === filterStatus.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }, [isVisible, batchesList, searchTerm, filterStatus, user]);

  // Do not render anything if modal is not active or user is not admin
  if (!isVisible) {
    return null;
  }

  const handleSelect = (batch) => {
    selectBatch(batch);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-selection-title"
      >
        {/* Top Gradient Accent Banner */}
        <div className="h-2 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-teal-400"></div>

        {/* Modal Header */}
        <div className="p-5 sm:p-7 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                  <ShieldCheck size={13} className="shrink-0" />
                  {user?.role === 'admin' ? 'SRAC 2.0 Admin Console' : 'SSMS Mentor Console'}
                </span>
                {isMandatory && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 animate-pulse">
                    <AlertCircle size={12} />
                    Selection Required
                  </span>
                )}
              </div>
              <h2 id="batch-selection-title" className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Global Academic Batch Selection
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
                {isMandatory 
                  ? (user?.role === 'admin'
                      ? "To access the SRAC 2.0 Admin Console and ensure scoped analytics, student records, assignments, and attendance, please select your active batch below."
                      : "To access the SSMS Mentor Portal and ensure scoped analytics, student records, assignments, and evaluations, please select your active batch below.")
                  : "Switch the active academic batch to scope dashboard metrics, student records, assignments, and evaluations."}
              </p>
            </div>

            {/* Close Button (only if not mandatory) */}
            {!isMandatory && (
              <button
                onClick={closeBatchModal}
                className="p-2 rounded-2xl text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                title="Close without changing batch"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by batch name, mentor, or keyword..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 p-1 rounded-2xl shadow-xs">
                {['all', 'Active', 'Completed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      filterStatus === st
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {st === 'all' ? 'All' : st}
                  </button>
                ))}
              </div>

              <button
                onClick={() => refreshBatches()}
                disabled={isLoadingBatches}
                className="p-2.5 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-2xl transition-colors shrink-0 shadow-xs cursor-pointer"
                title="Refresh Batches from Backend"
              >
                <RefreshCw size={15} className={isLoadingBatches ? 'animate-spin text-indigo-500' : ''} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body - Batches Grid */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-4">
          {isLoadingBatches && batchesList.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 animate-pulse">
                <RefreshCw size={24} className="animate-spin" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Loading available batches...</p>
              <p className="text-xs text-slate-400">Fetching live records from SRAC 2.0 backend</p>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700/60 p-8">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <BookOpen size={24} />
              </div>
              <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">No Batches Found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                {searchTerm 
                  ? `No batches matching "${searchTerm}". Try a different search query or reset filters.`
                  : user?.role === 'mentor'
                  ? "No batches are currently assigned to your mentor account. Please contact an administrator to be assigned to an active batch."
                  : "No batches are registered in the system yet. Please create a batch in Batch Management."}
              </p>
              {searchTerm && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                  className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBatches.map((batch) => {
                const isSelected = selectedBatchId && batch._id.toString() === selectedBatchId.toString();
                const isClosed = (batch.status || '').toLowerCase() === 'completed' || (batch.endDate && new Date(batch.endDate) <= new Date());
                const isActiveStatus = !isClosed && (batch.status || 'Active').toLowerCase() === 'active';

                return (
                  <div
                    key={batch._id}
                    onClick={() => handleSelect(batch)}
                    className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-lg'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-slate-700/70 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-md'
                    }`}
                  >
                    {/* Top Row: Batch Name & Badges */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/50 group-hover:text-indigo-600 dark:group-hover:text-indigo-400'
                          } transition-colors`}>
                            <BookOpen size={20} />
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {batch.batchName}
                            </h3>
                            <p className="text-[11px] font-mono font-medium text-slate-400 dark:text-slate-500">
                              ID: {batch._id.slice(-8)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-indigo-600 text-white shadow-xs">
                              <CheckCircle2 size={12} />
                              Active Scope
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            isClosed
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200/80 dark:border-red-800/60'
                              : isActiveStatus
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                          }`}>
                            {isClosed ? <Lock size={10} /> : null}
                            {isClosed ? 'Closed' : (batch.status || 'Active')}
                          </span>
                        </div>
                      </div>

                      {/* Description or Panel info if exists */}
                      {(batch.description || (user?.role !== 'mentor' && batch.panelName)) && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {user?.role !== 'mentor' && batch.panelName ? `${batch.panelName} • ` : ''}
                          {batch.description || (user?.role !== 'mentor' ? batch.panelSubheading : '') || 'Standard academic curriculum batch.'}
                        </p>
                      )}

                      {/* Metadata Chips: Mentor & Timeline */}
                      <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
                        {batch.mentorId && (
                          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-semibold bg-slate-50 dark:bg-slate-900/60 px-2.5 py-1 rounded-lg">
                            <UserCheck size={13} className="text-indigo-500 shrink-0" />
                            <span className="truncate max-w-[140px]">{batch.mentorId?.name || 'Assigned Mentor'}</span>
                          </div>
                        )}

                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                          isClosed 
                            ? 'text-red-700 dark:text-red-400 bg-red-50/70 dark:bg-red-950/40 border border-red-200/60 dark:border-red-900/40' 
                            : 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60'
                        }`}>
                          <Calendar size={13} className={isClosed ? 'text-red-500 shrink-0' : 'text-teal-500 shrink-0'} />
                          <span>{isClosed ? `Closed on ${formatDate(batch.endDate)}` : `Ends ${formatDate(batch.endDate)}`}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-4 pt-3 flex items-center justify-between gap-3">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                        {isSelected ? 'Currently in this batch' : 'Click to select batch'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(batch);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-500 dark:hover:text-white'
                        }`}
                      >
                        <span>{isSelected ? 'Continue' : 'Select Batch'}</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Sparkles size={14} className="text-amber-500 shrink-0" />
            <span>
              {selectedBatchName 
                ? <>Active Batch: <strong className="text-slate-800 dark:text-white">{selectedBatchName}</strong></> 
                : "No active batch selected. Please choose a batch above."}
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {!isMandatory && (
              <button
                type="button"
                onClick={closeBatchModal}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Keep Current Batch
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchSelectionModal;
