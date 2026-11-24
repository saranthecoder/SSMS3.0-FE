import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
  Mail, Phone, GitBranch, Briefcase, Globe, Code, Terminal, Search, 
  User as UserIcon, RefreshCw, Key, Edit, ShieldAlert, Ban, Clock, 
  CheckCircle2, AlertTriangle, ShieldCheck, UserX, Unlock
} from 'lucide-react';
import Loader from '../../components/Loader';
import AccessHistoryModal from '../../components/AccessHistoryModal';

import { useAuth } from '../../context/AuthContext';
import { useGlobalBatch } from '../../context/GlobalBatchContext';

const StudentList = () => {
  const { user } = useAuth();
  const { selectedBatchId, selectedBatchName, batchesList } = useGlobalBatch();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'suspended' | 'blocked'
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const queryBatch = selectedBatchId && selectedBatchId !== 'all' ? selectedBatchId : '';
      const { data } = await axios.get(`/auth/students${queryBatch ? `?batchId=${queryBatch}` : ''}`);
      setStudents(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBatchId]);

  // Access status evaluation helpers
  const isStudentSuspended = (student) => {
    return Boolean(student.isSuspended && student.suspendedUntil && new Date(student.suspendedUntil) > new Date());
  };

  const isStudentBlocked = (student) => {
    return Boolean(student.isBlocked);
  };

  const formatRemainingSuspension = (until) => {
    if (!until) return '';
    const diffMs = new Date(until) - new Date();
    if (diffMs <= 0) return 'Expired';
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      return `${days}d ${remHours}h`;
    }
    return `${hours}h ${mins}m`;
  };

  // Counts for status chips
  const totalCount = students.length;
  const blockedCount = students.filter(s => isStudentBlocked(s)).length;
  const suspendedCount = students.filter(s => isStudentSuspended(s)).length;
  const activeCount = students.filter(s => !isStudentBlocked(s) && !isStudentSuspended(s)).length;

  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.rollNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'active') return !isStudentBlocked(student) && !isStudentSuspended(student);
    if (statusFilter === 'suspended') return isStudentSuspended(student);
    if (statusFilter === 'blocked') return isStudentBlocked(student);
    return true;
  });

  const handleChangePassword = async (student) => {
    const { value: newPassword } = await Swal.fire({
      title: 'Change Password',
      text: `Enter new password for ${student.name}`,
      html: `
        <div style="position: relative; max-width: 100%; margin-top: 1rem;">
          <input type="password" id="swal-password-input" class="swal2-input" placeholder="New Password (min 6 chars)" style="width: 100%; max-width: 100%; margin: 0; box-sizing: border-box; padding-right: 40px;" autocapitalize="off" autocorrect="off">
          <button type="button" id="swal-toggle-password" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b; padding: 4px; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" id="swal-eye-icon"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Update Password',
      confirmButtonColor: '#0ea5e9',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
      didOpen: () => {
        const input = document.getElementById('swal-password-input');
        const toggleBtn = document.getElementById('swal-toggle-password');
        const eyeIcon = document.getElementById('swal-eye-icon');
        
        toggleBtn.addEventListener('click', () => {
          if (input.type === 'password') {
            input.type = 'text';
            eyeIcon.innerHTML = '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>';
            eyeIcon.style.color = '#0ea5e9';
          } else {
            input.type = 'password';
            eyeIcon.innerHTML = '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>';
            eyeIcon.style.color = '#64748b';
          }
        });
      },
      preConfirm: () => {
        const val = document.getElementById('swal-password-input').value;
        if (!val || val.length < 6) {
          Swal.showValidationMessage('Password must be at least 6 characters long!');
          return false;
        }
        return val;
      }
    });

    if (newPassword) {
      try {
        await axios.put(`/auth/students/${student._id}/password`, { password: newPassword });
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Password updated successfully.',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
          confirmButtonColor: '#10b981'
        });
      } catch (error) {
        console.error('Error updating password:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'Failed to update password',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
        });
      }
    }
  };

  const handleEditStudent = async (student) => {
    const { value: formValues } = await Swal.fire({
      title: `Edit Details: ${student.name}`,
      html: `
        <div class="flex flex-col gap-4 text-left">
          <div>
            <label class="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Name</label>
            <input id="swal-student-name" type="text" class="swal2-input !m-0 !w-full" value="${student.name || ''}">
          </div>
          <div>
            <label class="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Roll Number</label>
            <input id="swal-student-roll" type="text" class="swal2-input !m-0 !w-full" value="${student.rollNumber || ''}">
          </div>
          <div>
            <label class="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">LeetCode Coding Streak</label>
            <input id="swal-student-streak" type="number" class="swal2-input !m-0 !w-full" value="${student.leetcodeStreak || student.codingStreak || 0}">
          </div>
          <div>
            <label class="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">Coins</label>
            <input id="swal-student-coins" type="number" class="swal2-input !m-0 !w-full" value="${student.coins || 0}">
          </div>
          <div>
            <label class="block text-sm font-bold mb-1 text-slate-700 dark:text-slate-300">XP Points</label>
            <input id="swal-student-points" type="number" class="swal2-input !m-0 !w-full" value="${student.points || 0}">
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Save Changes',
      confirmButtonColor: '#10b981',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
      preConfirm: () => {
        return {
          name: document.getElementById('swal-student-name').value,
          rollNumber: document.getElementById('swal-student-roll').value,
          leetcodeStreak: document.getElementById('swal-student-streak').value,
          coins: document.getElementById('swal-student-coins').value,
          points: document.getElementById('swal-student-points').value,
        };
      }
    });

    if (formValues) {
      try {
        setLoading(true);
        await axios.put(`/auth/students/${student._id}`, {
          name: formValues.name,
          rollNumber: formValues.rollNumber,
          leetcodeStreak: Number(formValues.leetcodeStreak),
          coins: Number(formValues.coins),
          points: Number(formValues.points),
        });
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Student profile details updated successfully.',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
          confirmButtonColor: '#10b981'
        });
        fetchData();
      } catch (error) {
        console.error('Error updating student profile:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.response?.data?.message || 'Failed to update student details',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
        });
        setLoading(false);
      }
    }
  };

  // ─── Mentor Access Control: Block, Suspend (Hours/Days) & Restore ───
  const handleManageAccess = async (student) => {
    const isSuspended = isStudentSuspended(student);
    const isBlocked = isStudentBlocked(student);
    const isRestricted = isSuspended || isBlocked;

    const remainingStr = isSuspended ? formatRemainingSuspension(student.suspendedUntil) : '';
    const untilDateStr = isSuspended ? new Date(student.suspendedUntil).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

    const { value: result } = await Swal.fire({
      title: `<span style="font-size: 1.15rem; font-weight: 800;">Panel Access Control</span>`,
      html: `
        <div class="text-left space-y-3.5 text-xs">
          <!-- Student Summary Header -->
          <div class="p-3 bg-slate-100 dark:bg-slate-800/90 rounded-2xl flex items-center justify-between border border-slate-200 dark:border-slate-700/60">
            <div>
              <p class="font-extrabold text-sm text-slate-900 dark:text-white">${student.name}</p>
              <p class="text-[11px] font-mono text-slate-500 dark:text-slate-400">${student.rollNumber || student.email}</p>
            </div>
            <div>
              ${isBlocked ? `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                  ⛔ BLOCKED
                </span>
              ` : isSuspended ? `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  ⏳ SUSPENDED (${remainingStr})
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  ● ACTIVE
                </span>
              `}
            </div>
          </div>

          ${isRestricted ? `
            <!-- Current Restriction Details -->
            <div class="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 rounded-2xl space-y-1.5">
              <p class="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <span>Current Restriction:</span>
                <span class="uppercase">${isBlocked ? 'Permanent Block' : 'Temporary Suspension'}</span>
              </p>
              ${isSuspended ? `
                <p class="text-[11px] text-amber-800 dark:text-amber-300">
                  <strong>Ends:</strong> ${untilDateStr} (${remainingStr} remaining)
                </p>
              ` : ''}
              ${(student.blockReason || student.suspensionReason) ? `
                <p class="text-[11px] text-slate-600 dark:text-slate-300">
                  <strong>Reason:</strong> ${student.blockReason || student.suspensionReason}
                </p>
              ` : ''}
            </div>
          ` : ''}

          <!-- Restriction Form -->
          <div class="space-y-3 pt-1">
            <div>
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Select Access Action</label>
              <select id="swal-access-action" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500">
                <option value="suspend" selected>⏳ Suspend for Hours / Days (Temporary)</option>
                <option value="block">⛔ Block Access Indefinitely</option>
                ${isRestricted ? `<option value="restore">✅ Restore Access (Unblock / Lift Suspension)</option>` : ''}
              </select>
            </div>

            <div id="swal-duration-wrapper" class="space-y-1">
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Suspension Duration</label>
              <select id="swal-access-duration" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500">
                <option value="1">1 Hour</option>
                <option value="3">3 Hours</option>
                <option value="6">6 Hours</option>
                <option value="12">12 Hours</option>
                <option value="24" selected>24 Hours (1 Day)</option>
                <option value="48">48 Hours (2 Days)</option>
                <option value="72">72 Hours (3 Days)</option>
                <option value="168">7 Days (1 Week)</option>
                <option value="336">14 Days (2 Weeks)</option>
                <option value="custom">Custom Date & Time...</option>
              </select>
            </div>

            <div id="swal-custom-wrapper" class="hidden space-y-1">
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Custom End Date & Time</label>
              <input id="swal-custom-until" type="datetime-local" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" />
            </div>

            <div id="swal-reason-wrapper" class="space-y-1">
              <label class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Reason / Note</label>
              <input id="swal-access-reason" type="text" placeholder="e.g., Task delinquency, misconduct in chat, disciplinary hold" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500" value="${student.suspensionReason || student.blockReason || ''}" />
            </div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Apply Access Change',
      confirmButtonColor: '#f59e0b',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
      didOpen: () => {
        const actionSelect = document.getElementById('swal-access-action');
        const durationWrapper = document.getElementById('swal-duration-wrapper');
        const customWrapper = document.getElementById('swal-custom-wrapper');
        const durationSelect = document.getElementById('swal-access-duration');
        const reasonWrapper = document.getElementById('swal-reason-wrapper');

        const updateVisibility = () => {
          const action = actionSelect.value;
          if (action === 'suspend') {
            durationWrapper.classList.remove('hidden');
            reasonWrapper.classList.remove('hidden');
            if (durationSelect.value === 'custom') {
              customWrapper.classList.remove('hidden');
            } else {
              customWrapper.classList.add('hidden');
            }
          } else if (action === 'block') {
            durationWrapper.classList.add('hidden');
            customWrapper.classList.add('hidden');
            reasonWrapper.classList.remove('hidden');
          } else {
            // restore
            durationWrapper.classList.add('hidden');
            customWrapper.classList.add('hidden');
            reasonWrapper.classList.add('hidden');
          }
        };

        actionSelect.addEventListener('change', updateVisibility);
        durationSelect.addEventListener('change', updateVisibility);
      },
      preConfirm: () => {
        const action = document.getElementById('swal-access-action').value;
        const reason = document.getElementById('swal-access-reason').value;
        const durationHours = document.getElementById('swal-access-duration').value;
        const customUntil = document.getElementById('swal-custom-until').value;

        if (action === 'suspend' && durationHours === 'custom' && !customUntil) {
          Swal.showValidationMessage('Please select a valid future date and time for custom suspension');
          return false;
        }

        return {
          action,
          reason,
          durationHours: durationHours === 'custom' ? null : Number(durationHours),
          customUntil: durationHours === 'custom' ? customUntil : null
        };
      }
    });

    if (result) {
      try {
        setLoading(true);
        const { data } = await axios.put(`/auth/students/${student._id}/access-status`, result);
        
        // Update local state directly for instant feedback
        setStudents(prev => prev.map(s => {
          if (s._id === student._id) {
            return {
              ...s,
              isBlocked: data.student.isBlocked,
              blockReason: data.student.blockReason,
              isSuspended: data.student.isSuspended,
              suspendedUntil: data.student.suspendedUntil,
              suspensionReason: data.student.suspensionReason
            };
          }
          return s;
        }));

        Swal.fire({
          icon: 'success',
          title: 'Access Status Updated!',
          text: data.message,
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a',
          confirmButtonColor: '#10b981'
        });
      } catch (err) {
        console.error('Error updating access status:', err);
        Swal.fire({
          icon: 'error',
          title: 'Action Failed',
          text: err.response?.data?.message || 'Could not update student access status',
          background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
          color: document.documentElement.classList.contains('dark') ? '#f1f5f9' : '#0f172a'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Student Directory & Access Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Manage profiles, passwords, and panel access suspensions & blocks
          </p>
        </div>

        {/* Global Batch Scope Pill */}
        <div className="px-3.5 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-2 self-start sm:self-auto shadow-2xs">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Batch Scope:</span>
          <span className="text-slate-900 dark:text-white font-extrabold">{selectedBatchName || (batchesList.find(b => b._id === selectedBatchId)?.batchName || 'All Batches')}</span>
        </div>
      </div>

      {/* Filter and Status Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Status Filter Segmented Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 md:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-black'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Students</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-500/20">{totalCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
            }`}
          >
            <CheckCircle2 size={13} />
            <span>Active</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20">{activeCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('suspended')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'suspended'
                ? 'bg-amber-600 text-white shadow-sm font-black'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40'
            }`}
          >
            <Clock size={13} />
            <span>Suspended</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20">{suspendedCount}</span>
          </button>

          <button
            onClick={() => setStatusFilter('blocked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              statusFilter === 'blocked'
                ? 'bg-red-600 text-white shadow-sm font-black'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
            }`}
          >
            <Ban size={13} />
            <span>Blocked</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500/20">{blockedCount}</span>
          </button>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input 
              type="text" 
              placeholder="Search name, roll, email..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white pl-8.5 pr-3 py-2 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Suspension & Access History Records */}
          <button
            onClick={() => {
              setHistoryStudent(null);
              setHistoryModalOpen(true);
            }}
            className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/25 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
            title="View Disciplinary & Suspension Records Log"
          >
            <ShieldAlert size={14} />
            <span className="hidden sm:inline">Suspension Records</span>
          </button>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredStudents.length > 0 ? (
          filteredStudents.map((student) => {
            const suspended = isStudentSuspended(student);
            const blocked = isStudentBlocked(student);

            return (
              <div 
                key={student._id} 
                className={`glass-panel p-6 flex flex-col hover:-translate-y-1 hover:shadow-xl transition-all duration-300 rounded-3xl border ${
                  blocked 
                    ? 'border-red-300 dark:border-red-800/60 bg-red-50/20 dark:bg-red-950/10' 
                    : suspended 
                    ? 'border-amber-300 dark:border-amber-800/60 bg-amber-50/20 dark:bg-amber-950/10' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 overflow-hidden relative">
                    {student.profileImage && student.profileImage !== 'default.jpg' ? (
                      <img src={student.profileImage} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-black">{student.name?.charAt(0) || 'S'}</span>
                    )}

                    {blocked && (
                      <div className="absolute inset-0 bg-red-950/80 backdrop-blur-[1px] flex items-center justify-center text-red-400">
                        <Ban size={22} strokeWidth={2.5} />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className="font-extrabold text-slate-800 dark:text-white text-base truncate" title={student.name}>
                        {student.name}
                      </h3>
                      
                      {/* Action Buttons (Access Control, Edit, Password) */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Manage Panel Access (Block / Suspend / Restore) */}
                        <button
                          onClick={() => handleManageAccess(student)}
                          className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                            blocked
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25'
                              : suspended
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25'
                              : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                          }`}
                          title="Manage Panel Access (Block or Suspend)"
                        >
                          <ShieldAlert size={16} />
                        </button>

                        {/* View Access History */}
                        <button
                          onClick={() => {
                            setHistoryStudent(student);
                            setHistoryModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors cursor-pointer"
                          title="View Disciplinary & Access History"
                        >
                          <Clock size={16} />
                        </button>

                        {/* Edit Details */}
                        <button
                          onClick={() => handleEditStudent(student)}
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-colors cursor-pointer"
                          title="Edit Student Streak & Details"
                        >
                          <Edit size={16} />
                        </button>

                        {/* Change Password */}
                        <button
                          onClick={() => handleChangePassword(student)}
                          className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors cursor-pointer"
                          title="Change Password"
                        >
                          <Key size={16} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5 tracking-wide">
                      {student.rollNumber || 'NO ROLL NUMBER'}
                    </p>

                    {/* Access Status Pill Badge */}
                    <div className="mt-2">
                      {blocked ? (
                        <span 
                          onClick={() => handleManageAccess(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/80 cursor-pointer hover:underline"
                          title={student.blockReason || 'Access Blocked'}
                        >
                          <Ban size={11} /> Blocked
                        </span>
                      ) : suspended ? (
                        <span 
                          onClick={() => handleManageAccess(student)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/80 cursor-pointer hover:underline"
                          title={`Suspended until ${new Date(student.suspendedUntil).toLocaleString()}`}
                        >
                          <Clock size={11} /> Suspended ({formatRemainingSuspension(student.suspendedUntil)})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                          <CheckCircle2 size={11} /> Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Suspension / Block Reason Callout Banner if restricted */}
                {(blocked || suspended) && (student.blockReason || student.suspensionReason) && (
                  <div className={`mb-3 p-2.5 rounded-xl text-xs font-medium ${
                    blocked 
                      ? 'bg-red-100/60 dark:bg-red-950/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50' 
                      : 'bg-amber-100/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                  }`}>
                    <p className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                      {blocked ? 'Block Reason:' : 'Suspension Reason:'}
                    </p>
                    <p className="truncate mt-0.5">{student.blockReason || student.suspensionReason}</p>
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-2 mb-4 flex-1">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-xl text-xs">
                    <Mail size={14} className="text-indigo-500 shrink-0" />
                    <a href={`mailto:${student.email}`} className="hover:text-indigo-600 truncate">{student.email}</a>
                  </div>
                  {student.phone && (
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-xl text-xs">
                      <Phone size={14} className="text-emerald-500 shrink-0" />
                      <a href={`tel:${student.phone}`} className="hover:text-emerald-600">{student.phone}</a>
                    </div>
                  )}
                </div>

                {/* Social Profiles Grid */}
                <div className="grid grid-cols-5 gap-1.5 pt-3 border-t border-slate-100 dark:border-white/10">
                  {student.github ? (
                    <a href={student.github} target="_blank" rel="noreferrer" title="GitHub" className="p-2 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 bg-slate-100 dark:bg-white/5 rounded-xl transition-colors">
                      <GitBranch size={16} />
                    </a>
                  ) : <span className="p-2 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-xl"><GitBranch size={16} /></span>}
                  
                  {student.linkedin ? (
                    <a href={student.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="p-2 flex items-center justify-center text-slate-500 hover:text-white hover:bg-[#0a66c2] bg-slate-100 dark:bg-white/5 rounded-xl transition-colors">
                      <Briefcase size={16} />
                    </a>
                  ) : <span className="p-2 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-xl"><Briefcase size={16} /></span>}

                  {student.portfolio ? (
                    <a href={student.portfolio} target="_blank" rel="noreferrer" title="Portfolio" className="p-2 flex items-center justify-center text-slate-500 hover:text-white hover:bg-emerald-500 bg-slate-100 dark:bg-white/5 rounded-xl transition-colors">
                      <Globe size={16} />
                    </a>
                  ) : <span className="p-2 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-xl"><Globe size={16} /></span>}

                  {student.leetcode ? (
                    <a href={student.leetcode} target="_blank" rel="noreferrer" title="LeetCode" className="p-2 flex items-center justify-center text-slate-500 hover:text-white hover:bg-[#ffa116] bg-slate-100 dark:bg-white/5 rounded-xl transition-colors">
                      <Code size={16} />
                    </a>
                  ) : <span className="p-2 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-xl"><Code size={16} /></span>}
                  
                  {student.hackerrank ? (
                    <a href={student.hackerrank} target="_blank" rel="noreferrer" title="HackerRank" className="p-2 flex items-center justify-center text-slate-500 hover:text-white hover:bg-[#2ec866] bg-slate-100 dark:bg-white/5 rounded-xl transition-colors">
                      <Terminal size={16} />
                    </a>
                  ) : <span className="p-2 flex items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50 dark:bg-white/5 rounded-xl"><Terminal size={16} /></span>}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full glass-panel p-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
            <UserIcon size={48} className="mb-4 opacity-50" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">No Students Found</h3>
            <p className="text-sm">We couldn't find any students matching the selected filter criteria.</p>
          </div>
        )}
      </div>

      {/* Disciplinary & Suspension Records Modal */}
      <AccessHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        targetStudent={historyStudent}
      />
    </div>
  );
};

export default StudentList;
