import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import axios from 'axios';
import { Loader2, ShieldCheck, Search, CheckCircle2, XCircle, Users, RefreshCw, Clock, Calendar } from 'lucide-react';
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
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grantingAccess, setGrantingAccess] = useState(false);
  const [minHours, setMinHours] = useState(4);
  const [maxHours, setMaxHours] = useState(10);

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
      setAllStudents(studentsRes.data);
      setAccessGrants(grants);
      setTodayLeaves(leaves);
      setSelectedStudents([]);
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
    const effMin = Number(minHours) || 4;
    const effMax = Number(maxHours) || 10;
    try {
      await axios.post('/checkin-access/grant', {
        studentIds: selectedStudents,
        accessType,
        batchId: effectiveBatchId,
        workHours: effMin,
        minHours: effMin,
        maxHours: effMax
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
    const effMin = Number(minHours) || 4;
    const effMax = Number(maxHours) || 10;
    setGrantingAccess(true);
    try {
      await axios.post('/checkin-access/grant', {
        studentIds: [studentId],
        accessType: 'wfh',
        batchId: effectiveBatchId,
        workHours: effMin,
        minHours: effMin,
        maxHours: effMax
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
    const effMin = Number(minHours) || 4;
    const effMax = Number(maxHours) || 10;
    try {
      await axios.post('/checkin-access/grant', {
        studentIds: targetStudents,
        accessType,
        batchId: effectiveBatchId,
        workHours: effMin,
        minHours: effMin,
        maxHours: effMax
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
      setAccessGrants(grants);
      setTodayLeaves(leaves);
    } catch (err) {
      console.error('Error refreshing access grants:', err);
    }
  };

  const getStudentAccess = (studentId) => {
    return accessGrants.find(g => {
      const sId = typeof g.studentId === 'object' && g.studentId !== null ? g.studentId._id : g.studentId;
      return sId === studentId;
    });
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

  // Filter students based on search and access filter
  const filteredStudents = allStudents.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (student.rollNumber && student.rollNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const access = getStudentAccess(student._id);
    const leave = getStudentLeave(student._id);
    const type = access ? access.accessType : 'none'; // 'on-site', 'wfh', 'none'
    
    let matchesAccess = true;
    if (accessFilter === 'on-site') matchesAccess = type === 'on-site';
    else if (accessFilter === 'wfh') matchesAccess = type === 'wfh';
    else if (accessFilter === 'leave') matchesAccess = Boolean(leave);
    else if (accessFilter === 'none') matchesAccess = type === 'none';

    return matchesSearch && matchesAccess;
  }).sort((a, b) => {
    if (sortBy === 'name-asc') {
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
            Check-In Permissions Manager
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Configure, search, and authorize daily check-in access modes for students
          </p>
        </div>
      </div>

      {/* Permission Grid Pattern */}
      <div className="glass-panel p-6 border border-slate-100 dark:border-slate-700/50 shadow-sm space-y-6">
        
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full relative">
            <Search className="absolute left-4 top-3 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by student name or roll number..."
              className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl pl-12 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2 items-center w-full md:w-auto overflow-x-auto shrink-0 pb-1 md:pb-0">
            <select
              className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-750/30 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shrink-0"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="roll-asc">Roll Number (Asc)</option>
              <option value="roll-desc">Roll Number (Desc)</option>
            </select>

            {[
              { id: 'all', label: 'All Students' },
              { id: 'on-site', label: 'On-Site' },
              { id: 'wfh', label: 'WFH' },
              { id: 'leave', label: `On Leave (${todayLeaves.length})` },
              { id: 'none', label: 'No Access' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAccessFilter(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  accessFilter === tab.id
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selection Status & Bulk Action Options */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold text-slate-700 dark:text-slate-300">
              {selectedStudents.length} of {filteredStudents.length} selected
            </span>
            {selectedStudents.length > 0 && (
              <button 
                onClick={() => setSelectedStudents([])}
                className="text-xs text-slate-400 hover:text-rose-500 hover:underline font-bold"
              >
                Clear Selection
              </button>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2.5 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
              <Clock size={15} className="text-emerald-500 shrink-0" />
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Min:</span>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={minHours}
                  onChange={e => setMinHours(e.target.value)}
                  className="w-11 px-1 py-0.5 text-xs font-black text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-xs font-semibold text-slate-400">h</span>
              </div>
              <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Max:</span>
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={maxHours}
                  onChange={e => setMaxHours(e.target.value)}
                  className="w-11 px-1 py-0.5 text-xs font-black text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-xs font-semibold text-slate-400">h</span>
              </div>
            </div>

            {selectedStudents.length === 0 ? (
              <>
                <button
                  onClick={() => handleGrantAll('on-site')}
                  disabled={grantingAccess || filteredStudents.length === 0}
                  className="px-4 py-2 text-xs font-black bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  Grant All On-Site
                </button>
                <button
                  onClick={() => handleGrantAll('wfh')}
                  disabled={grantingAccess || filteredStudents.length === 0}
                  className="px-4 py-2 text-xs font-black bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  Grant All WFH
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
                  Grant On-Site ({selectedStudents.length})
                </button>
                <button
                  onClick={() => handleGrantAccess('wfh')}
                  disabled={grantingAccess}
                  className="px-4 py-2 text-xs font-black bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-md shadow-sky-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  Grant WFH ({selectedStudents.length})
                </button>
                <button
                  onClick={handleRevokeAccess}
                  disabled={grantingAccess}
                  className="px-4 py-2 text-xs font-black bg-rose-500 hover:bg-rose-600 text-white rounded-xl shadow-md shadow-rose-500/10 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {grantingAccess && <Loader2 size={12} className="animate-spin" />}
                  Revoke Access ({selectedStudents.length})
                </button>
              </>
            )}
          </div>
        </div>

        {/* Student Grid list mimicking manual check list */}
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
              <span>Access Status</span>
            </div>

            {/* Grid list of individual students */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStudents.map(student => {
                const access = getStudentAccess(student._id);
                const leave = getStudentLeave(student._id);
                const isSelected = selectedStudents.includes(student._id);
                
                return (
                  <div
                    key={student._id}
                    onClick={() => handleToggleSelectStudent(student._id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group select-none ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-sm shadow-emerald-500/5'
                        : leave
                        ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-300 dark:border-amber-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/20 shadow-sm'
                        : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Controlled by outer div click
                        className="rounded border-slate-300 dark:border-slate-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer h-4 w-4"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{student.name}</h4>
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

                    {/* Status Badge & Action */}
                    <div className="flex flex-col items-end gap-1.5">
                      {access ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full border ${
                            access.accessType === 'wfh'
                              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          }`}>
                            {access.accessType === 'wfh' ? 'WFH' : 'ON-SITE'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            Min: {access.minHours || access.workHours || 4}h • Max: {access.maxHours || 10}h
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
                          NO ACCESS
                        </span>
                      )}

                      {leave && (!access || access.accessType !== 'wfh') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAllocateLeaveWFH(student._id, student.name);
                          }}
                          disabled={grantingAccess}
                          className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-600 rounded-lg shadow-xs transition-all cursor-pointer whitespace-nowrap"
                          title="Allocate specific WFH work hours for student on leave"
                        >
                          Allocate WFH
                        </button>
                      )}
                    </div>
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
