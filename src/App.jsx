import { Component, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { GlobalBatchProvider } from './context/GlobalBatchContext';
import ProtectedRoute from './components/ProtectedRoute';
import Loader from './components/Loader';

const CHUNK_RELOAD_KEY = 'ssms_chunk_reload_at';
const isChunkLoadError = (err) => {
  const msg = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|Unable to preload CSS|Loading chunk .* failed|ChunkLoadError/i.test(msg);
};

const tryAutoReloadForChunk = () => {
  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    if (Date.now() - lastReload > 15000) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
      window.location.reload();
      return true;
    }
  } catch {}
  return false;
};

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    tryAutoReloadForChunk();
  });
}

// Resilient lazy loader: automatically recovers from stale deployment chunks or transient network errors
const lazyWithRetry = (importFn) =>
  lazy(() =>
    importFn().catch((err) => {
      if (isChunkLoadError(err) && tryAutoReloadForChunk()) {
        // Keep promise pending while browser reloads
        return new Promise(() => {});
      }
      // Retry once after brief delay before surfacing to ErrorBoundary
      return new Promise((resolve) => setTimeout(resolve, 500)).then(() => importFn());
    })
  );

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error) {
    if (isChunkLoadError(error)) {
      tryAutoReloadForChunk();
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
          <div className="max-w-md w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 text-center space-y-4">
            <h2 className="text-lg font-black text-slate-900 dark:text-white">Page Update Available</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              A new version or network hiccup interrupted loading this page. Refresh to continue seamlessly.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Pages
const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const Verification = lazyWithRetry(() => import('./pages/Verification'));
const PublicResources = lazyWithRetry(() => import('./pages/PublicResources'));
const Layout = lazyWithRetry(() => import('./components/Layout'));

// Admin Pages
const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard'));
const BatchManagement = lazyWithRetry(() => import('./pages/admin/BatchManagement'));
const TaskManagement = lazyWithRetry(() => import('./pages/admin/TaskManagement'));
const TaskCreateEdit = lazyWithRetry(() => import('./pages/admin/TaskCreateEdit'));
const BatchTracker = lazyWithRetry(() => import('./pages/admin/BatchTracker'));
const AttendanceTracker = lazyWithRetry(() => import('./pages/admin/AttendanceTracker'));
const SubmissionReviews = lazyWithRetry(() => import('./pages/admin/SubmissionReviews'));
const EnrollmentRequests = lazyWithRetry(() => import('./pages/admin/EnrollmentRequests'));
const AttendanceLogs = lazyWithRetry(() => import('./pages/admin/AttendanceLogs'));
const AdminProfile = lazyWithRetry(() => import('./pages/admin/AdminProfile'));
const StudentList = lazyWithRetry(() => import('./pages/admin/StudentList'));
const AdminLeetcode = lazyWithRetry(() => import('./pages/admin/AdminLeetcode'));
const BatchChat = lazyWithRetry(() => import('./pages/BatchChat'));
const LeaveRequests = lazyWithRetry(() => import('./pages/admin/LeaveRequests'));
const MockDriveManagement = lazyWithRetry(() => import('./pages/admin/MockDriveManagement'));
const TrafficManagement = lazyWithRetry(() => import('./pages/admin/TrafficManagement'));
const CheckInPermissions = lazyWithRetry(() => import('./pages/admin/CheckInPermissions'));
const FacultyAttendance = lazyWithRetry(() => import('./pages/admin/FacultyAttendance'));
const ActivityLogs = lazyWithRetry(() => import('./pages/admin/ActivityLogs'));
const GamificationManagement = lazyWithRetry(() => import('./pages/admin/GamificationManagement'));
const NotesManagement = lazyWithRetry(() => import('./pages/admin/NotesManagement'));
const MentorManagement = lazyWithRetry(() => import('./pages/admin/MentorManagement'));
const PortalDirectory = lazyWithRetry(() => import('./pages/admin/PortalDirectory'));
const AccessDisciplinaryRecords = lazyWithRetry(() => import('./pages/admin/AccessDisciplinaryRecords'));
const SyllabusTracker = lazyWithRetry(() => import('./pages/SyllabusTracker'));
const PerformanceReports = lazyWithRetry(() => import('./pages/admin/PerformanceReports'));
const BulkTaskAllocator = lazyWithRetry(() => import('./pages/admin/BulkTaskAllocator'));

// Student Pages
const StudentDashboard = lazyWithRetry(() => import('./pages/student/StudentDashboard'));
const MyReports = lazyWithRetry(() => import('./pages/student/MyReports'));
const AvailableBatches = lazyWithRetry(() => import('./pages/student/AvailableBatches'));
const MyBatches = lazyWithRetry(() => import('./pages/student/MyBatches'));
const MyTasks = lazyWithRetry(() => import('./pages/student/MyTasks'));
const MyGrades = lazyWithRetry(() => import('./pages/student/MyGrades'));
const MyAttendance = lazyWithRetry(() => import('./pages/student/MyAttendance'));
const UserProfile = lazyWithRetry(() => import('./pages/student/UserProfile'));
const StudentSetup = lazyWithRetry(() => import('./pages/student/StudentSetup'));
const StudentLeaderboard = lazyWithRetry(() => import('./pages/student/StudentLeaderboard'));
const StudentLeetcode = lazyWithRetry(() => import('./pages/student/StudentLeetcode'));
const LeaveApplication = lazyWithRetry(() => import('./pages/student/LeaveApplication'));
const GamificationShop = lazyWithRetry(() => import('./pages/student/GamificationShop'));
const StudentNotes = lazyWithRetry(() => import('./pages/student/StudentNotes'));
const StudentConnections = lazyWithRetry(() => import('./pages/student/StudentConnections'));

function App() {
  return (
    <Router>
      <AuthProvider>
        <GlobalBatchProvider>
          <RouteErrorBoundary>
          <Suspense fallback={<Loader />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Login />} />
          <Route path="/verify" element={<Verification />} />
          <Route path="/public" element={<PublicResources />} />
          
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            {/* Admin & Mentor Routes */}
            <Route index element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="portals" element={
              <ProtectedRoute allowedRoles={['admin']}><PortalDirectory /></ProtectedRoute>
            } />
            <Route path="mentors" element={
              <ProtectedRoute allowedRoles={['admin']}><MentorManagement /></ProtectedRoute>
            } />
            <Route path="batches" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><BatchManagement /></ProtectedRoute>
            } />
            <Route path="tasks" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><TaskManagement /></ProtectedRoute>
            } />
            <Route path="tasks/create" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><TaskCreateEdit /></ProtectedRoute>
            } />
            <Route path="tasks/edit/:id" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><TaskCreateEdit /></ProtectedRoute>
            } />
            <Route path="batch-tracker" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor', 'student']}><BatchTracker /></ProtectedRoute>
            } />
            <Route path="attendance-tracker" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor', 'student']}><AttendanceTracker /></ProtectedRoute>
            } />
            <Route path="reviews" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><SubmissionReviews /></ProtectedRoute>
            } />
            <Route path="enrollments" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><BatchManagement /></ProtectedRoute>
            } />
            <Route path="attendance-logs" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><AttendanceLogs /></ProtectedRoute>
            } />
            <Route path="students" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><StudentList /></ProtectedRoute>
            } />
            <Route path="chat" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor', 'student']}><BatchChat /></ProtectedRoute>
            } />

            <Route path="leetcode" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><AdminLeetcode /></ProtectedRoute>
            } />
            <Route path="leaves" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><LeaveRequests /></ProtectedRoute>
            } />
            <Route path="mock-drives" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><MockDriveManagement /></ProtectedRoute>
            } />
            <Route path="profile" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><AdminProfile /></ProtectedRoute>
            } />
            <Route path="traffic" element={
              <ProtectedRoute allowedRoles={['admin']}><TrafficManagement /></ProtectedRoute>
            } />
            <Route path="checkin-permissions" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><CheckInPermissions /></ProtectedRoute>
            } />
            <Route path="activity-logs" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><ActivityLogs /></ProtectedRoute>
            } />
            <Route path="access-logs" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><AccessDisciplinaryRecords /></ProtectedRoute>
            } />
            <Route path="syllabus-tracker" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><SyllabusTracker /></ProtectedRoute>
            } />
            <Route path="admin/gamification" element={
              <ProtectedRoute allowedRoles={['admin']}><GamificationManagement /></ProtectedRoute>
            } />
            <Route path="admin/notes" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><NotesManagement /></ProtectedRoute>
            } />

            {/* Student Routes */}
            <Route path="student/setup" element={
              <ProtectedRoute allowedRoles={['student']}><StudentSetup /></ProtectedRoute>
            } />
            <Route path="student" element={
              <ProtectedRoute allowedRoles={['student']}><StudentDashboard /></ProtectedRoute>
            } />
            <Route path="student/available-batches" element={
              <ProtectedRoute allowedRoles={['student']}><MyBatches /></ProtectedRoute>
            } />
            <Route path="student/my-batches" element={
              <ProtectedRoute allowedRoles={['student']}><MyBatches /></ProtectedRoute>
            } />
            <Route path="student/tasks" element={
              <ProtectedRoute allowedRoles={['student']}><MyTasks /></ProtectedRoute>
            } />
            <Route path="student/chat" element={
              <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}><BatchChat /></ProtectedRoute>
            } />
            <Route path="student/connections" element={
              <ProtectedRoute allowedRoles={['student']}><StudentConnections /></ProtectedRoute>
            } />
            <Route path="student/grades" element={
              <ProtectedRoute allowedRoles={['student']}><MyGrades /></ProtectedRoute>
            } />
            <Route path="student/attendance" element={
              <ProtectedRoute allowedRoles={['student']}><MyAttendance /></ProtectedRoute>
            } />

            <Route path="student/profile" element={
              <ProtectedRoute allowedRoles={['student']}><UserProfile /></ProtectedRoute>
            } />
            <Route path="student/leetcode" element={
              <ProtectedRoute allowedRoles={['student']}><StudentLeetcode /></ProtectedRoute>
            } />
            <Route path="student/leaves" element={
              <ProtectedRoute allowedRoles={['student']}><LeaveApplication /></ProtectedRoute>
            } />
            <Route path="student/leaderboard" element={
              <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}><StudentLeaderboard /></ProtectedRoute>
            } />
            <Route path="student/wardrobe" element={
              <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}><GamificationShop /></ProtectedRoute>
            } />
            <Route path="student/notes" element={
              <ProtectedRoute allowedRoles={['student']}><StudentNotes /></ProtectedRoute>
            } />
            <Route path="student/syllabus" element={
              <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}><SyllabusTracker /></ProtectedRoute>
            } />
            <Route path="student/disciplinary" element={
              <ProtectedRoute allowedRoles={['student', 'admin', 'mentor']}><AccessDisciplinaryRecords /></ProtectedRoute>
            } />
            <Route path="classroom-attendance" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><FacultyAttendance /></ProtectedRoute>
            } />
            <Route path="performance-reports" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><PerformanceReports /></ProtectedRoute>
            } />
            <Route path="tasks/bulk" element={
              <ProtectedRoute allowedRoles={['admin', 'mentor']}><BulkTaskAllocator /></ProtectedRoute>
            } />
            <Route path="student/reports" element={
              <ProtectedRoute allowedRoles={['student']}><MyReports /></ProtectedRoute>
            } />
            <Route path="*" element={<div className="p-8"><h1 className="text-2xl">Page Under Construction</h1></div>} />
          </Route>
          
          <Route path="/student/attenence" element={<FacultyAttendance />} />
        </Routes>
        </Suspense>
        </RouteErrorBoundary>
        </GlobalBatchProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
