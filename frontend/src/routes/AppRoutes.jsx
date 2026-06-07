import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { LoginPage, AuthenticatePage, ChangePasswordPage, ForgotPasswordPage } from '../features/auth';
import { AdminPage, DepartmentsPage, StaffPage, DoctorsPage, ClinicalRoomsPage, AiModelsPage, AuditLogsPage, BackupPage } from '../features/admin';
import { ReceptionistDashboard, DoctorDashboard, LabManagerDashboard } from '../features/role-dashboard';
import ReceptionistIntakePage from '../features/receptionist/pages/ReceptionistIntakePage';
import ReceptionistQueuePage from '../features/receptionist/pages/ReceptionistQueuePage';
import ReceptionistRecordsPage from '../features/receptionist/pages/ReceptionistRecordsPage';
import AdminShiftsPage from '../features/admin/pages/AdminReceptionShiftsPage';
import LabOrdersPage from '../features/lab-manager/pages/LabOrdersPage';
import LabResultsPage from '../features/lab-manager/pages/LabResultsPage';
import DoctorQueuePage from '../features/doctor/pages/DoctorQueuePage';
import ParaclinicalLoginPage from '../features/paraclinical/pages/ParaclinicalLoginPage';
import ParaclinicalDashboardPage from '../features/paraclinical/pages/ParaclinicalDashboardPage';
import ShiftManagementPage from '../features/paraclinical/pages/ShiftManagementPage';
import LoadingIndicator from '../shared/components/LoadingIndicator';
import { getDashboardRoute } from '../shared/constants/roleRoutes';
import { PatientVerificationPage } from '../features/verification';
import { ProfilePage } from '../features/profile';

// Where a first-login user belongs: face FIRST so the user is biometrically known before being
// trusted to set a permanent password. Once the face is on file, fall back to /change-password.
function firstLoginRoute(user) {
  return user?.hasFace ? '/change-password' : '/authenticate';
}

function ProtectedRoute({ children, requireVerified = false, roles = [], allowFirstLogin = false, requireManager = false }) {
  const { token, user, loading } = useAuth();
  if (loading) return <LoadingIndicator fullScreen size="lg" label="Đang tải phiên làm việc..." />;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!allowFirstLogin && user.firstLogin) return <Navigate to={firstLoginRoute(user)} replace />;
  if (requireVerified && !user.verified) return <Navigate to="/authenticate" replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to={getDashboardRoute(user.role)} replace />;
  if (requireManager && user.role !== 'ADMIN' && !user.isManager) return <Navigate to={getDashboardRoute(user.role)} replace />;
  return children;
}

export default function App() {
  const { token, user, loading } = useAuth();
  const isAuthenticated = Boolean(token);
  const dashboardRoute = user ? getDashboardRoute(user.role) : '/admin';

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<PatientVerificationPage />} />
        <Route path="/login" element={!isAuthenticated || loading ? <Navigate to="/?login=true" replace /> : <Navigate to={user?.firstLogin ? firstLoginRoute(user) : dashboardRoute} replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/change-password" element={<ProtectedRoute allowFirstLogin><ChangePasswordPage /></ProtectedRoute>} />
        <Route path="/authenticate" element={<ProtectedRoute allowFirstLogin><AuthenticatePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireVerified roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute requireVerified roles={['ADMIN']}><DepartmentsPage /></ProtectedRoute>} />
        <Route path="/admin/staff" element={<ProtectedRoute requireVerified roles={['ADMIN']}><StaffPage /></ProtectedRoute>} />
        <Route path="/admin/doctors" element={<ProtectedRoute requireVerified roles={['ADMIN']}><DoctorsPage /></ProtectedRoute>} />
        <Route path="/admin/clinical-rooms" element={<ProtectedRoute requireVerified roles={['ADMIN']}><ClinicalRoomsPage /></ProtectedRoute>} />
        <Route path="/admin/shifts" element={<ProtectedRoute requireVerified roles={['ADMIN', 'RECEPTIONIST', 'LAB_MANAGER']} requireManager><AdminShiftsPage /></ProtectedRoute>} />
        <Route path="/admin/ai-models" element={<ProtectedRoute requireVerified roles={['ADMIN']}><AiModelsPage /></ProtectedRoute>} />
        <Route path="/admin/audit" element={<ProtectedRoute requireVerified roles={['ADMIN']}><AuditLogsPage /></ProtectedRoute>} />
        <Route path="/admin/backup" element={<ProtectedRoute requireVerified roles={['ADMIN']}><BackupPage /></ProtectedRoute>} />
        <Route path="/receptionist" element={<ProtectedRoute requireVerified roles={['RECEPTIONIST', 'DEPT_SHARED']}><Navigate to="/receptionist/intake" replace /></ProtectedRoute>} />
        <Route path="/receptionist/intake" element={<ProtectedRoute requireVerified roles={['RECEPTIONIST', 'DEPT_SHARED']}><ReceptionistIntakePage /></ProtectedRoute>} />
        <Route path="/receptionist/queue" element={<ProtectedRoute requireVerified roles={['RECEPTIONIST', 'DEPT_SHARED']}><ReceptionistQueuePage /></ProtectedRoute>} />
        <Route path="/receptionist/records" element={<ProtectedRoute requireVerified roles={['RECEPTIONIST', 'DEPT_SHARED']}><ReceptionistRecordsPage /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute requireVerified roles={['DOCTOR']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/doctor/queue" element={<ProtectedRoute requireVerified roles={['DOCTOR']}><DoctorQueuePage /></ProtectedRoute>} />
        <Route path="/paraclinical-login" element={<ParaclinicalLoginPage />} />
        <Route path="/lab-manager" element={<ProtectedRoute requireVerified roles={['LAB_MANAGER', 'DEPT_SHARED']}><ParaclinicalDashboardPage /></ProtectedRoute>} />
        <Route path="/lab-manager/shifts" element={<ProtectedRoute requireVerified roles={['LAB_MANAGER', 'DEPT_SHARED']}><ShiftManagementPage /></ProtectedRoute>} />
        <Route path="/lab-manager/orders" element={<ProtectedRoute requireVerified roles={['LAB_MANAGER', 'DEPT_SHARED']}><LabOrdersPage /></ProtectedRoute>} />
        <Route path="/lab-manager/results" element={<ProtectedRoute requireVerified roles={['LAB_MANAGER', 'DEPT_SHARED']}><LabResultsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute requireVerified roles={['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'LAB_MANAGER', 'DEPT_SHARED']}><ProfilePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? (user?.firstLogin ? firstLoginRoute(user) : dashboardRoute) : '/'} replace />} />
      </Routes>
    </div>
  );
}
