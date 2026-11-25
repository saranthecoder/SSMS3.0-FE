import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { 
  Loader2, ShieldCheck, Search, CheckCircle2, XCircle, Users, 
  RefreshCw, Clock, Calendar, Building2, Home, Layers, Save,
  Sliders, AlertCircle, Lock, Unlock
} from 'lucide-react';
import Swal from 'sweetalert2';
import Loader from '../../components/Loader';
import { useAuth } from '../../context/AuthContext';

const CheckInPermissions = () => {
  const { user, selectedBatchId } = useAuth();
  const { themeColor, activeTheme } = useOutletContext();
  const [batches, setBatches] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [accessGrants, setAccessGrants] = useState([]);
  const [todayLeaves, setTodayLeaves] = useState([]);
  const [todayAttendances, setTodayAttendances] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [savingWorkload, setSavingWorkload] = useState(false);
  const [isWorkloadLocked, setIsWorkloadLocked] = useState(true);

  // Daily Workload Record State
  const [dailyWorkload, setDailyWorkload] = useState({
    onsiteAllocated: true,
    onsiteMinHours: 4,
    onsiteMaxHours: 10,
    wfhAllocated: true,
    wfhMinHours: 4,
    wfhMaxHours: 10,
    autoWfhEnabled: true,
    autoWfhTime: '19:00',
    autoOnsiteCheckoutEnabled: true,
    autoOnsiteCheckoutTime: '17:00',
    notes: ''
  });

  const format12Hour = (time24 = '19:00') => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${String(hour).padStart(2, '0')}:${m || '00'} ${ampm}`;
  };

  // Filters and Sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [accessFilter, setAccessFilter] = useState('all'); // all, on-site, wfh, leave, none
  const [sortBy, setSortBy] = useState('name-asc'); // name-asc, name-desc, roll-asc, roll-desc

  const fetchData = async () => {
    try {
      setLoading(true);
      const [batchesRes] = await Promise.all([
        axios.get('/batches')
      ]);
      setBatches(batchesRes.data);
    } catch (error) {
      console.error('Error fetching batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const effectiveBatchId = (selectedBatchId && selectedBatchId !== 'all')
    ? selectedBatchId
    : (batches.length > 0 ? batches[0]._id : '');

  const fetchBatchStudentsAndAccess = async (targetBatchId) => {
    const bId = targetBatchId || effectiveBatchId;
    if (!bId) return;
    try {
      setLoading(true);
      const [studentsRes, accessRes] = await Promise.all([
        axios.get(`/auth/students?batchId=${bId}`),
        axios.get(`/checkin-access/today?batchId=${bId}`).catch(() => ({ data: [] }))
      ]);
      const grants = Array.isArray(accessRes.data) ? accessRes.data : (accessRes.data?.grants || []);
      const leaves = Array.isArray(accessRes.data?.leaves) ? accessRes.data.leaves : [];
      const dw = accessRes.data?.dailyWorkload;
      const atts = accessRes.data?.attendances || [];

      setAllStudents(studentsRes.data);
      setAccessGrants(grants);
      setTodayLeaves(leaves);
      setTodayAttendances(atts);
      setSelectedStudents([]);

      if (dw) {
        setDailyWorkload({
          onsiteAllocated: dw.onsiteAllocated ?? true,
          onsiteMinHours: dw.onsiteMinHours ?? 4,
          onsiteMaxHours: dw.onsiteMaxHours ?? 10,
          wfhAllocated: dw.wfhAllocated ?? true,
          wfhMinHours: dw.wfhMinHours ?? 4,
          wfhMaxHours: dw.wfhMaxHours ?? 10,
          autoWfhEnabled: dw.autoWfhEnabled ?? true,
          autoWfhTime: dw.autoWfhTime || '19:00',
          autoOnsiteCheckoutEnabled: dw.autoOnsiteCheckoutEnabled ?? true,
          autoOnsiteCheckoutTime: dw.autoOnsiteCheckoutTime || '17:00',
          notes: dw.notes || ''
        });
      }
    } catch (error) {
      console.error('Error fetching students and access grants:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (effectiveBatchId) {
      fetchBatchStudentsAndAccess(effectiveBatchId);
    }
  }, [effectiveBatchId]);

  const getStudentLeave = (studentId) => {
    return todayLeaves.find(l => {
      const sId = typeof l.studentId === 'object' && l.studentId !== null ? l.studentId._id : l.studentId;
      return sId === studentId;
    });
  };

  const getStudentAccess = (studentId) => {
    return accessGrants.find(g => {
      const sId = typeof g.studentId === 'object' && g.studentId !== null ? g.studentId._id : g.studentId;
      return sId === studentId;
    });
  };

  const getStudentAttendance = (studentId) => {
    return todayAttendances.find(a => {
      const sId = typeof a.studentId === 'object' && a.studentId !== null ? a.studentId._id : a.studentId;
      return sId === studentId;
    });
  };

  const formatDuration = (seconds = 0) => {
    const totalMins = Math.floor(seconds / 60);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}hr ${mins}min`;
  };

  const handleSaveAndApplyWorkload = async () => {
    if (isWorkloadLocked) return;
    if (!effectiveBatchId) {
      Swal.fire('No Batch', 'Please select a batch first.', 'warning');
      return;
    }

    const confirmResult = await Swal.fire({
      title: 'Save & Apply Workload?',
      html: `
        <div class="text-left text-xs space-y-1.5 mt-2">
          <p><b>Batch Students:</b> ${allStudents.length} students</p>
          <p><b>On-Site:</b> ${dailyWorkload.onsiteAllocated ? `Min ${dailyWorkload.onsiteMinHours}h / Max ${dailyWorkload.onsiteMaxHours}h` : 'Not Allocated'}${dailyWorkload.autoOnsiteCheckoutEnabled ? ` (Auto-Checkout @ ${format12Hour(dailyWorkload.autoOnsiteCheckoutTime || '17:00')})` : ''}</p>
          <p><b>WFH:</b> ${dailyWorkload.wfhAllocated ? `Min ${dailyWorkload.wfhMinHours}h / Max ${dailyWorkload.wfhMaxHours}h` : 'Not Allocated'}${dailyWorkload.autoWfhEnabled ? ` (Auto-Unlock @ ${format12Hour(dailyWorkload.autoWfhTime || '19:00')})` : ''}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Save & Apply',
      cancelButtonText: 'Cancel'
    });

    if (!confirmResult.isConfirmed) return;

    setSavingWorkload(true);
    setGrantingAccess(true);
    try {
      // 1. Save workload benchmark
      await axios.post('/checkin-access/workload', {
        batchId: effectiveBatchId,
        onsiteAllocated: dailyWorkload.onsiteAllocated,
        onsiteMinHours: Number(dailyWorkload.onsiteMinHours) || 4,
        onsiteMaxHours: Number(dailyWorkload.onsiteMaxHours) || 10,
        wfhAllocated: dailyWorkload.wfhAllocated,
        wfhMinHours: Number(dailyWorkload.wfhMinHours) || 4,
        wfhMaxHours: Number(dailyWorkload.wfhMaxHours) || 10,
        autoWfhEnabled: Boolean(dailyWorkload.autoWfhEnabled),
        autoWfhTime: dailyWorkload.autoWfhTime || '19:00',
        autoOnsiteCheckoutEnabled: Boolean(dailyWorkload.autoOnsiteCheckoutEnabled),
        autoOnsiteCheckoutTime: dailyWorkload.autoOnsiteCheckoutTime || '17:00',
        notes: dailyWorkload.notes
      });

      // 2. Apply access grant to all students in batch
      if (allStudents.length > 0) {
        const allStudentIds = allStudents.map(s => s._id);
        const primaryMode = dailyWorkload.wfhAllocated ? 'wfh' : 'on-site';
        const primaryMin = primaryMode === 'wfh' ? dailyWorkload.wfhMinHours : dailyWorkload.onsiteMinHours;
        const primaryMax = primaryMode === 'wfh' ? dailyWorkload.wfhMaxHours : dailyWorkload.onsiteMaxHours;

        await axios.post('/checkin-access/grant', {
          studentIds: allStudentIds,
          accessType: primaryMode,
          batchId: effectiveBatchId,
          workHours: primaryMin,
          minHours: primaryMin,
          maxHours: primaryMax,
          onsiteMinHours: dailyWorkload.onsiteMinHours,
          onsiteMaxHours: dailyWorkload.onsiteMaxHours,
          wfhMinHours: dailyWorkload.wfhMinHours,
          wfhMaxHours: dailyWorkload.wfhMaxHours,
          onsiteAllocated: dailyWorkload.onsiteAllocated,
          wfhAllocated: dailyWorkload.wfhAllocated
        });
      }

      const summaryText = [
        dailyWorkload.onsiteAllocated ? `On-Site: ${dailyWorkload.onsiteMinHours}h` : null,
        dailyWorkload.wfhAllocated ? `WFH: ${dailyWorkload.wfhMinHours}h` : null,
        dailyWorkload.autoWfhEnabled ? `Auto WFH: ${format12Hour(dailyWorkload.autoWfhTime)}` : null
      ].filter(Boolean).join(' • ');

      Swal.fire({
        title: 'Workload Saved & Applied',
        text: `Workload (${summaryText || 'Configured'}) saved and applied to all ${allStudents.length} students.`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
      setIsWorkloadLocked(true);
      refreshAccessGrants();
    } catch (err) {
      console.error('Failed to save and apply workload:', err);
      Swal.fire('Error', err.response?.data?.message || 'Failed to save and apply daily workload.', 'error');
    } finally {
      setSavingWorkload(false);
      setGrantingAccess(false);
    }
  };

  const handleGrantAccess = async (accessType) => {
    if (selectedStudents.length === 0) {
      Swal.fire('No Selection', 'Please select at least one student first.', 'warning');
      return;
    }

    const leaveStudents = selectedStudents.filter(id => Boolean(getStudentLeave(id)));
    if (accessType === 'on-site' && leaveStudents.length > 0) {
      Swal.fire({
        title: 'On-Site Restricted',
        text: `${leaveStudents.length} selected student(s) are on approved leave today. On-site access is not permitted for students on leave; please allocate WFH access instead.`,
        icon: 'warning'
      });
      return;
    }

    setGrantingAccess(true);
    const effMin = accessType === 'wfh' ? Number(dailyWorkload.wfhMinHours) : Number(dailyWorkload.onsiteMinHours);
    const effMax = accessType === 'wfh' ? Number(dailyWorkload.wfhMaxHours) : Number(dailyWorkload.onsiteMaxHours);
    try {
      await axios.post('/checkin-access/grant', {
        studentIds: selectedStudents,
        accessType,
        batchId: effectiveBatchId,
        workHours: effMin,
        minHours: effMin,
        maxHours: effMax,
        onsiteMinHours: dailyWorkload.onsiteMinHours,
        onsiteMaxHours: dailyWorkload.onsiteMaxHours,
        wfhMinHours: dailyWorkload.wfhMinHours,
        wfhMaxHours: dailyWorkload.wfhMaxHours,
        onsiteAllocated: dailyWorkload.onsiteAllocated,
        wfhAllocated: dailyWorkload.wfhAllocated
      });
      Swal.fire({
        title: 'Access Granted',
        text: `Granted ${accessType === 'wfh' ? 'Work From Home' : 'On-Site'} access (${effMin}h min - ${effMax}h max) for selected students.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      setSelectedStudents([]);
      refreshAccessGrants();
    } catch (error) {
      console.error('Failed to grant access:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to grant check-in access.', 'error');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleAllocateLeaveWFH = async (studentId, studentName) => {
    const effMin = Number(dailyWorkload.wfhMinHours) || 3;
    const effMax = Number(dailyWorkload.wfhMaxHours) || 10;
    setGrantingAccess(true);
    try {
      await axios.post('/checkin-access/grant', {
        studentIds: [studentId],
        accessType: 'wfh',
        batchId: effectiveBatchId,
        workHours: effMin,
        minHours: effMin,
        maxHours: effMax,
        onsiteMinHours: dailyWorkload.onsiteMinHours,
        onsiteMaxHours: dailyWorkload.onsiteMaxHours,
        wfhMinHours: dailyWorkload.wfhMinHours,
        wfhMaxHours: dailyWorkload.wfhMaxHours,
        onsiteAllocated: false,
        wfhAllocated: true
      });
      Swal.fire({
        title: 'WFH Access Allocated',
        text: `Allocated ${effMin}h - ${effMax}h WFH workload for ${studentName} (On Leave). They will be marked Present upon fulfilling this workload.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      refreshAccessGrants();
    } catch (error) {
      console.error('Failed to allocate leave WFH:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to allocate WFH access.', 'error');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (selectedStudents.length === 0) {
      Swal.fire('No Selection', 'Please select at least one student first.', 'warning');
      return;
    }
    setGrantingAccess(true);
    try {
      await axios.post('/checkin-access/revoke', {
        studentIds: selectedStudents,
        batchId: effectiveBatchId
      });
      Swal.fire({
        title: 'Access Revoked',
        text: 'Revoked check-in access for selected students.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      setSelectedStudents([]);
      refreshAccessGrants();
    } catch (error) {
      console.error('Failed to revoke access:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to revoke check-in access.', 'error');
    } finally {
      setGrantingAccess(false);
    }
  };

  const handleGrantAll = async (accessType) => {
    let targetList = filteredStudents;
    if (accessType === 'on-site') {
      targetList = targetList.filter(s => !getStudentLeave(s._id));
      if (targetList.length === 0) {
        Swal.fire('On-Site Restricted', 'All filtered students are on approved leave today. Allocate WFH access for students on leave.', 'warning');
        return;
      }
    }

    const targetStudents = targetList.map(s => s._id);
    if (targetStudents.length === 0) {
      Swal.fire('No Students', 'No students match the current filters.', 'warning');
      return;
    }
    
    setGrantingAccess(true);
    const effMin = accessType === 'wfh' ? Number(dailyWorkload.wfhMinHours) : Number(dailyWorkload.onsiteMinHours);
    const effMax = accessType === 'wfh' ? Number(dailyWorkload.wfhMaxHours) : Number(dailyWorkload.onsiteMaxHours);
    try {
      await axios.post('/checkin-access/grant', {
        studentIds: targetStudents,
        accessType,
        batchId: effectiveBatchId,
        workHours: effMin,
        minHours: effMin,
        maxHours: effMax,
        onsiteMinHours: dailyWorkload.onsiteMinHours,
        onsiteMaxHours: dailyWorkload.onsiteMaxHours,
        wfhMinHours: dailyWorkload.wfhMinHours,
        wfhMaxHours: dailyWorkload.wfhMaxHours,
        onsiteAllocated: dailyWorkload.onsiteAllocated,
        wfhAllocated: dailyWorkload.wfhAllocated
      });
      Swal.fire({
        title: 'Bulk Access Granted',
        text: `Granted ${accessType === 'wfh' ? 'WFH' : 'On-Site'} access (${effMin}h min - ${effMax}h max) to all ${targetStudents.length} eligible students.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      setSelectedStudents([]);
      refreshAccessGrants();
    } catch (error) {
      console.error('Failed to grant bulk access:', error);
      Swal.fire('Error', error.response?.data?.message || 'Failed to grant check-in access.', 'error');
    } finally {
      setGrantingAccess(false);
    }
  };

  const refreshAccessGrants = async () => {
    if (!effectiveBatchId) return;
    try {
      const accessRes = await axios.get(`/checkin-access/today?batchId=${effectiveBatchId}`).catch(() => ({ data: [] }));
      const grants = Array.isArray(accessRes.data) ? accessRes.data : (accessRes.data?.grants || []);
      const leaves = Array.isArray(accessRes.data?.leaves) ? accessRes.data.leaves : [];
      const dw = accessRes.data?.dailyWorkload;
      const atts = accessRes.data?.attendances || [];
      setAccessGrants(grants);
      setTodayLeaves(leaves);
      setTodayAttendances(atts);
      if (dw) {
        setDailyWorkload({
          onsiteAllocated: dw.onsiteAllocated ?? true,
          onsiteMinHours: dw.onsiteMinHours ?? 4,
          onsiteMaxHours: dw.onsiteMaxHours ?? 10,
          wfhAllocated: dw.wfhAllocated ?? true,
          wfhMinHours: dw.wfhMinHours ?? 4,
          wfhMaxHours: dw.wfhMaxHours ?? 10,
          autoWfhEnabled: dw.autoWfhEnabled ?? true,
          autoWfhTime: dw.autoWfhTime || '19:00',
          autoOnsiteCheckoutEnabled: dw.autoOnsiteCheckoutEnabled ?? true,
          autoOnsiteCheckoutTime: dw.autoOnsiteCheckoutTime || '17:00',
          notes: dw.notes || ''
        });
      }
    } catch (err) {
      console.error('Error refreshing access grants:', err);
    }
  };

  const handleToggleSelectStudent = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = filteredStudents.map(s => s._id);
    const allSelected = filteredIds.every(id => selectedStudents.includes(id));
    if (allSelected) {
      setSelectedStudents(selectedStudents.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedStudents([...new Set([...selectedStudents, ...filteredIds])]);
    }
  };

  const isStudentAbsent = (studentId) => {
    const att = getStudentAttendance(studentId);
    const leave = getStudentLeave(studentId);
    if (leave) return false;
    if (att) {
      return !att.isActive && att.status !== 'Present';
    }
    return true;
  };

  const statusCounts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let inProgress = 0;
    let onSite = 0;
    let wfh = 0;
    let none = 0;

    allStudents.forEach(student => {
      const att = getStudentAttendance(student._id);
      const leave = getStudentLeave(student._id);
      const access = getStudentAccess(student._id);
      const type = access ? access.accessType : 'none';

      if (type === 'on-site') onSite++;
      else if (type === 'wfh') wfh++;
      else none++;

      if (leave) {
        // on leave
      } else if (att) {
        if (att.status === 'Present') present++;
        else if (att.isActive || att.status === 'In Progress') inProgress++;
        else absent++;
      } else {
        absent++;
      }
    });

    return { present, absent, inProgress, onSite, wfh, none, leave: todayLeaves.length };
  }, [allStudents, accessGrants, todayLeaves, todayAttendances]);

  // Filter students based on search and access filter
  const filteredStudents = allStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (student.rollNumber && student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const access = getStudentAccess(student._id);
    const leave = getStudentLeave(student._id);
    const att = getStudentAttendance(student._id);
    const type = access ? access.accessType : 'none';

    let matchesAccess = true;
    if (accessFilter === 'absent') matchesAccess = isStudentAbsent(student._id);
    else if (accessFilter === 'present') matchesAccess = att?.status === 'Present';
    else if (accessFilter === 'in-progress') matchesAccess = Boolean(att?.isActive || att?.status === 'In Progress');
    else if (accessFilter === 'on-site') matchesAccess = type === 'on-site';
    else if (accessFilter === 'wfh') matchesAccess = type === 'wfh';
    else if (accessFilter === 'leave') matchesAccess = Boolean(leave);
    else if (accessFilter === 'none') matchesAccess = type === 'none';

    return matchesSearch && matchesAccess;
  }).sort((a, b) => {
    if (sortBy === 'absent-first') {
      const isAbsentA = isStudentAbsent(a._id) ? 1 : 0;
      const isAbsentB = isStudentAbsent(b._id) ? 1 : 0;
      if (isAbsentA !== isAbsentB) return isAbsentB - isAbsentA;
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'present-first') {
      const isPresentA = getStudentAttendance(a._id)?.status === 'Present' ? 1 : 0;
      const isPresentB = getStudentAttendance(b._id)?.status === 'Present' ? 1 : 0;
      if (isPresentA !== isPresentB) return isPresentB - isPresentA;
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'time-asc') {
      const attA = getStudentAttendance(a._id);
      const attB = getStudentAttendance(b._id);
      const timeA = (attA?.onsiteDurationSeconds || 0) + (attA?.wfhDurationSeconds || 0);
      const timeB = (attB?.onsiteDurationSeconds || 0) + (attB?.wfhDurationSeconds || 0);
      return timeA - timeB;
    } else if (sortBy === 'time-desc') {
      const attA = getStudentAttendance(a._id);
      const attB = getStudentAttendance(b._id);
      const timeA = (attA?.onsiteDurationSeconds || 0) + (attA?.wfhDurationSeconds || 0);
      const timeB = (attB?.onsiteDurationSeconds || 0) + (attB?.wfhDurationSeconds || 0);
      return timeB - timeA;
    } else if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    } else if (sortBy === 'roll-asc') {
      const rA = a.rollNumber || '';
      const rB = b.rollNumber || '';
      return rA.localeCompare(rB);
    } else if (sortBy === 'roll-desc') {
      const rA = a.rollNumber || '';
      const rB = b.rollNumber || '';
      return rB.localeCompare(rA);
    }
    return 0;
  });

  if (loading && batches.length === 0) return <Loader />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" size={28} />
            Check-In Permissions & Daily Workload Manager
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Maintain daily workload targets (On-Site & WFH) and cross-verify with student attendance hours
          </p>
        </div>
        <button
          onClick={refreshAccessGrants}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all self-start md:self-auto cursor-pointer"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* DAILY WORKLOAD RECORD CONTROL PANEL */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/70 shadow-xl text-white space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Layers size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-white">Daily Workload Record</h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Today's Benchmark
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Set minimum and maximum hours allocated today. Stored in student dashboard for exact workload cross-verification.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsWorkloadLocked(prev => !prev)}
              className={`px-3.5 py-2.5 text-xs font-black rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                isWorkloadLocked
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-white border-white/20'
              }`}
              title={isWorkloadLocked ? 'Click to unlock and edit workload settings' : 'Click to lock workload settings'}
            >
              {isWorkloadLocked ? <Lock size={14} /> : <Unlock size={14} />}
              <span>{isWorkloadLocked ? 'Locked' : 'Unlocked'}</span>
            </button>

            <button
              onClick={handleSaveAndApplyWorkload}
              disabled={isWorkloadLocked || savingWorkload || grantingAccess}
              className="px-5 py-2.5 text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:hover:translate-y-0"
              title={isWorkloadLocked ? 'Unlock workload settings first to save changes' : 'Save & Apply Workload'}
            >
              {(savingWorkload || grantingAccess) ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={15} />
              )}
              Save & Apply Workload
            </button>
          </div>
        </div>

        {/* Workload Inputs: On-Site and WFH Cards */}
        <fieldset disabled={isWorkloadLocked} className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${isWorkloadLocked ? 'opacity-80' : ''}`}>
          {/* On-Site Workload Card */}
          <div className={`p-4 rounded-2xl border transition-all ${
            dailyWorkload.onsiteAllocated
              ? 'bg-emerald-500/10 border-emerald-500/30 shadow-inner'
              : 'bg-white/5 border-white/10 opacity-70'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-emerald-400" />
                <h3 className="font-extrabold text-sm text-white">On-Site Workload</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-300">
                <input
                  type="checkbox"
                  checked={dailyWorkload.onsiteAllocated}
                  onChange={(e) => setDailyWorkload({ ...dailyWorkload, onsiteAllocated: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                />
                Allocated Today
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Minimum Required</span>
                  <span className="text-[9px] font-bold uppercase text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">Min Target</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={dailyWorkload.onsiteMinHours}
                    onChange={(e) => setDailyWorkload({ ...dailyWorkload, onsiteMinHours: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm font-black text-center bg-white/10 border border-white/15 rounded-lg text-emerald-400 outline-none focus:border-emerald-500"
                  />
                  <span className="font-bold text-white/80 shrink-0">Hours</span>
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col justify-between gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Maximum Allowed</span>
                  <span className="text-[9px] font-bold uppercase text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">Daily Cap</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={dailyWorkload.onsiteMaxHours}
                    onChange={(e) => setDailyWorkload({ ...dailyWorkload, onsiteMaxHours: Number(e.target.value) })}
                    className="w-full px-2.5 py-1.5 text-sm font-black text-center bg-white/10 border border-white/15 rounded-lg text-emerald-400 outline-none focus:border-emerald-500"
                  />
                  <span className="font-bold text-white/80 shrink-0">Hours</span>
                </div>
              </div>
            </div>

            {/* Automatic On-Site Checkout & Access Removal Schedule */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-emerald-200">
                  <input
                    type="checkbox"
                    checked={dailyWorkload.autoOnsiteCheckoutEnabled}
                    onChange={(e) => setDailyWorkload({ ...dailyWorkload, autoOnsiteCheckoutEnabled: e.target.checked })}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                  />
                  <Clock size={13} className="text-emerald-400" /> Auto-Checkout & Remove On-Site Access
                </label>
                {dailyWorkload.autoOnsiteCheckoutEnabled && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Ends @ {format12Hour(dailyWorkload.autoOnsiteCheckoutTime || '17:00')}
                  </span>
                )}
              </div>

              {dailyWorkload.autoOnsiteCheckoutEnabled && (
                <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-300">End Time:</span>
                      <input
                        type="time"
                        value={dailyWorkload.autoOnsiteCheckoutTime || '17:00'}
                        onChange={(e) => setDailyWorkload({ ...dailyWorkload, autoOnsiteCheckoutTime: e.target.value })}
                        className="px-2.5 py-1 text-xs font-bold bg-white/10 border border-white/15 rounded-lg text-white outline-none focus:border-emerald-500 cursor-pointer"
                      />
                    </div>
                    <span className="font-mono text-emerald-300 font-bold text-xs bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                      {format12Hour(dailyWorkload.autoOnsiteCheckoutTime || '17:00')} IST
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 w-full">
                    {['13:00', '13:30', '14:00', '16:00', '16:30', '17:00', '17:30', '18:00'].map((timePreset) => (
                      <button
                        key={timePreset}
                        type="button"
                        onClick={() => setDailyWorkload({ ...dailyWorkload, autoOnsiteCheckoutTime: timePreset })}
                        className={`w-full py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer text-center ${
                          (dailyWorkload.autoOnsiteCheckoutTime || '17:00') === timePreset
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {format12Hour(timePreset)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* WFH Workload Card */}
          <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
            dailyWorkload.wfhAllocated
              ? 'bg-sky-500/10 border-sky-500/30 shadow-inner'
              : 'bg-white/5 border-white/10 opacity-70'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Home size={18} className="text-sky-400" />
                  <h3 className="font-extrabold text-sm text-white">Work From Home (WFH) Workload</h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-300">
                  <input
                    type="checkbox"
                    checked={dailyWorkload.wfhAllocated}
                    onChange={(e) => setDailyWorkload({ ...dailyWorkload, wfhAllocated: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 cursor-pointer h-4 w-4"
                  />
                  Allocated Today
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Minimum Required</span>
                    <span className="text-[9px] font-bold uppercase text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded">Min Target</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={dailyWorkload.wfhMinHours}
                      onChange={(e) => setDailyWorkload({ ...dailyWorkload, wfhMinHours: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-sm font-black text-center bg-white/10 border border-white/15 rounded-lg text-sky-400 outline-none focus:border-sky-500"
                    />
                    <span className="font-bold text-white/80 shrink-0">Hours</span>
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col justify-between gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Maximum Allowed</span>
                    <span className="text-[9px] font-bold uppercase text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded">Daily Cap</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={dailyWorkload.wfhMaxHours}
                      onChange={(e) => setDailyWorkload({ ...dailyWorkload, wfhMaxHours: Number(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-sm font-black text-center bg-white/10 border border-white/15 rounded-lg text-sky-400 outline-none focus:border-sky-500"
                    />
                    <span className="font-bold text-white/80 shrink-0">Hours</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Automatic WFH Access Scheduled Time Option */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-sky-200">
                  <input
                    type="checkbox"
                    checked={dailyWorkload.autoWfhEnabled}
                    onChange={(e) => setDailyWorkload({ ...dailyWorkload, autoWfhEnabled: e.target.checked })}
                    className="rounded border-slate-700 text-sky-500 focus:ring-sky-500 cursor-pointer h-4 w-4"
                  />
                  <Clock size={13} className="text-sky-400" /> Auto-Schedule WFH Access
                </label>
                {dailyWorkload.autoWfhEnabled && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                    Unlocks @ {format12Hour(dailyWorkload.autoWfhTime || '19:00')}
                  </span>
                )}
              </div>

              {dailyWorkload.autoWfhEnabled && (
                <div className="bg-black/30 rounded-xl p-3 border border-white/10 flex flex-col gap-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-300">Unlock Time:</span>
                      <input
                        type="time"
                        value={dailyWorkload.autoWfhTime || '19:00'}
                        onChange={(e) => setDailyWorkload({ ...dailyWorkload, autoWfhTime: e.target.value })}
                        className="px-2.5 py-1 text-xs font-bold bg-white/10 border border-white/15 rounded-lg text-white outline-none focus:border-sky-500 cursor-pointer"
                      />
                    </div>
                    <span className="font-mono text-sky-300 font-bold text-xs bg-sky-500/10 px-2.5 py-1 rounded-lg border border-sky-500/20">
                      {format12Hour(dailyWorkload.autoWfhTime || '19:00')} IST
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 w-full">
                    {['18:00', '18:30', '19:00', '19:30', '20:00'].map((timePreset) => (
                      <button
                        key={timePreset}
                        type="button"
                        onClick={() => setDailyWorkload({ ...dailyWorkload, autoWfhTime: timePreset })}
                        className={`w-full py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer text-center ${
                          (dailyWorkload.autoWfhTime || '19:00') === timePreset
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-white/10 text-slate-300 hover:bg-white/20'
                        }`}
                      >
                        {format12Hour(timePreset)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </fieldset>
      </div>

      {/* Permission Grid Panel */}
      <div className="glass-panel p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
        
        {/* Search & Filter Toolbar */}
        <div className="space-y-4">
          {/* Row 1: Search Box & Sort Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-3 text-slate-400" size={17} />
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                className="w-full bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Sort:</span>
              <select
                className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="absent-first">Sort: Absent First</option>
                <option value="present-first">Sort: Present First</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="roll-asc">Roll Number (Asc)</option>
                <option value="roll-desc">Roll Number (Desc)</option>
                <option value="time-asc">Logged Hours (Low to High)</option>
                <option value="time-desc">Logged Hours (High to Low)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Filter Tabs Segmented Groups */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 custom-scrollbar text-xs">
            {/* Attendance Status Group */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/80 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 select-none">Status:</span>
              {[
                { id: 'all', label: `All (${allStudents.length})` },
                { id: 'absent', label: `Absent (${statusCounts.absent})`, isAbsent: true },
                { id: 'present', label: `Present (${statusCounts.present})`, isPresent: true },
                { id: 'in-progress', label: `In Progress (${statusCounts.inProgress})`, isInProgress: true },
              ].map(tab => {
                const isActive = accessFilter === tab.id;
                let activeClass = 'bg-slate-800 text-white dark:bg-emerald-500 dark:text-white shadow-xs font-extrabold';
                let inactiveClass = 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800 font-bold';

                if (tab.isAbsent) {
                  activeClass = 'bg-rose-500 text-white shadow-sm shadow-rose-500/25 font-black';
                  inactiveClass = 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold';
                } else if (tab.isPresent) {
                  activeClass = 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/25 font-black';
                  inactiveClass = 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold';
                } else if (tab.isInProgress) {
                  activeClass = 'bg-amber-500 text-white shadow-sm shadow-amber-500/25 font-black';
                  inactiveClass = 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-bold';
                }

                return (
                  <button
                    key={tab.id}
                    onClick={() => setAccessFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive ? activeClass : inactiveClass
                    }`}
                  >
                    {tab.isAbsent && <XCircle size={13} className="shrink-0" />}
                    {tab.isPresent && <CheckCircle2 size={13} className="shrink-0" />}
                    {tab.isInProgress && <Clock size={13} className="shrink-0" />}
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 shrink-0 hidden md:block"></div>

            {/* Access / Permission Group */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/60 dark:border-slate-700/80 shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-2 select-none">Access:</span>
              {[
                { id: 'on-site', label: `On-Site (${statusCounts.onSite})`, icon: Building2 },
                { id: 'wfh', label: `WFH (${statusCounts.wfh})`, icon: Home },
                { id: 'leave', label: `On Leave (${todayLeaves.length})`, icon: Calendar },
                { id: 'none', label: `No Access (${statusCounts.none})`, icon: ShieldCheck }
              ].map(tab => {
                const isActive = accessFilter === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAccessFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isActive 
                        ? 'bg-slate-800 text-white dark:bg-slate-700 dark:text-white shadow-xs font-extrabold' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <Icon size={13} className="shrink-0 opacity-80" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selection Status & Bulk Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
              {selectedStudents.length} of {filteredStudents.length} selected
            </span>
            {selectedStudents.length > 0 && (
              <button 
                onClick={() => setSelectedStudents([])}
                className="text-xs text-slate-400 hover:text-rose-500 hover:underline font-bold cursor-pointer"
              >
                Clear Selection
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {selectedStudents.length === 0 ? (
              <>
                <button
                  onClick={() => handleGrantAll('on-site')}
                  disabled={grantingAccess || filteredStudents.length === 0}
                  className="px-4 py-2 text-xs font-black bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  <Building2 size={13} /> Grant All On-Site ({dailyWorkload.onsiteMinHours}h)
                </button>
                <button
                  onClick={() => handleGrantAll('wfh')}
                  disabled={grantingAccess || filteredStudents.length === 0}
                  className="px-4 py-2 text-xs font-black bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  <Home size={13} /> Grant All WFH ({dailyWorkload.wfhMinHours}h)
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleGrantAccess('on-site')}
                  disabled={grantingAccess}
                  className="px-4 py-2 text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  <Building2 size={13} /> Grant On-Site ({selectedStudents.length})
                </button>
                <button
                  onClick={() => handleGrantAccess('wfh')}
                  disabled={grantingAccess}
                  className="px-4 py-2 text-xs font-black bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-md shadow-sky-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  <Home size={13} /> Grant WFH ({selectedStudents.length})
                </button>
                <button
                  onClick={handleRevokeAccess}
                  disabled={grantingAccess}
                  className="px-4 py-2 text-xs font-black bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  <XCircle size={13} /> Revoke Access ({selectedStudents.length})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Student Grid list with Workload Verification */}
        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
            <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="font-bold text-slate-800 dark:text-slate-200">No Students Found</p>
            <p className="text-xs text-slate-500 mt-1">Select a different filter or check your query</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Select All Checkbox bar */}
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-3 select-none">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedStudents.includes(s._id))}
                  onChange={handleSelectAllFiltered}
                  className="rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                  id="select_all_list"
                />
                <label htmlFor="select_all_list" className="cursor-pointer">
                  Select All Filtered ({filteredStudents.length})
                </label>
              </div>
              <span>Assigned Workload & Logged Time</span>
            </div>

            {/* Grid list of individual students */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map(student => {
                const access = getStudentAccess(student._id);
                const leave = getStudentLeave(student._id);
                const att = getStudentAttendance(student._id);
                const isSelected = selectedStudents.includes(student._id);

                const onsiteSec = att?.onsiteDurationSeconds || 0;
                const wfhSec = att?.wfhDurationSeconds || 0;
                const totalSec = att?.sessionDurationSeconds || (onsiteSec + wfhSec);

                return (
                  <div
                    key={student._id}
                    onClick={() => handleToggleSelectStudent(student._id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group select-none ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-sm shadow-emerald-500/5'
                        : leave
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-300 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm'
                    }`}
                  >
                    {/* Top Row: Checkbox, Name, Roll, and Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="mt-1 rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{student.name}</h4>
                            {leave && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                title={leave.reason || 'On approved leave today'}
                              >
                                <Calendar size={10} className="shrink-0" /> Leave
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{student.rollNumber || 'N/A'}</p>
                        </div>
                      </div>

                      {/* Attendance Status Badge */}
                      {att ? (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {att.status === 'Present' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 size={11} /> Present
                            </span>
                          ) : att.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <Clock size={11} className="animate-spin" /> In Progress
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              <XCircle size={11} /> {att.status || 'Absent'}
                            </span>
                          )}
                        </div>
                      ) : access ? (
                        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                          Pending
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                          No Access
                        </span>
                      )}
                    </div>

                    {/* Middle Section: Assigned Workload vs Logged Time Cross-Verification */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] space-y-1.5">
                      {/* Mentor Assigned Workload Row */}
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span className="font-semibold flex items-center gap-1">
                          <Sliders size={11} /> Assigned:
                        </span>
                        <div className="flex items-center gap-2 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {dailyWorkload.onsiteAllocated && (
                            <span className="text-emerald-600 dark:text-emerald-400">On-Site: {dailyWorkload.onsiteMinHours}h</span>
                          )}
                          {dailyWorkload.onsiteAllocated && dailyWorkload.wfhAllocated && <span>•</span>}
                          {dailyWorkload.wfhAllocated && (
                            <span className="text-sky-600 dark:text-sky-400">WFH: {dailyWorkload.wfhMinHours}h</span>
                          )}
                        </div>
                      </div>

                      {/* Actual Logged Time Row */}
                      <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                        <span className="font-semibold flex items-center gap-1">
                          <Clock size={11} /> Logged:
                        </span>
                        <div className="flex items-center gap-2 font-mono font-bold">
                          <span className={onsiteSec >= (dailyWorkload.onsiteMinHours * 3600) ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}>
                            On-Site: {formatDuration(onsiteSec)}
                          </span>
                          <span>•</span>
                          <span className={wfhSec >= (dailyWorkload.wfhMinHours * 3600) ? 'text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300'}>
                            WFH: {formatDuration(wfhSec)}
                          </span>
                        </div>
                      </div>

                      {/* Total Time & Evaluation Badge */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 dark:border-slate-800 text-[10px]">
                        <span className="text-slate-400 font-medium">Total: {formatDuration(totalSec)}</span>
                        {dailyWorkload.onsiteAllocated && dailyWorkload.wfhAllocated && (
                          <span className="font-bold text-slate-500">
                            Dual Mode Target: {dailyWorkload.onsiteMinHours + dailyWorkload.wfhMinHours}h total
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Row (for Leave student or quick actions) */}
                    {leave && (!access || access.accessType !== 'wfh') && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAllocateLeaveWFH(student._id, student.name);
                          }}
                          disabled={grantingAccess}
                          className="px-2.5 py-1 text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-600 rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1"
                        >
                          <Home size={11} /> Allocate WFH for Leave
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckInPermissions;