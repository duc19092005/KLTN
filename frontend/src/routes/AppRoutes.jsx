import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { LoginPage, AuthenticatePage, ChangePasswordPage } from '../features/auth';
import { AdminPage, DepartmentsPage, StaffPage, DoctorsPage, ClinicalRoomsPage } from '../features/admin';
import { ReceptionistDashboard, DoctorDashboard, LabManagerDashboard } from '../features/role-dashboard';
import DoctorQueuePage from '../features/doctor/pages/DoctorQueuePage';
import LoadingIndicator from '../shared/components/LoadingIndicator';
import { getDashboardRoute } from '../shared/constants/roleRoutes';

function ProtectedRoute({ children, requireVerified = false, roles = [], allowFirstLogin = false }) {
  const { token, user, loading } = useAuth();
  if (loading) return <LoadingIndicator fullScreen size="lg" label="Đang tải phiên làm việc..." />;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (!allowFirstLogin && user.firstLogin) return <Navigate to="/change-password" replace />;
  if (requireVerified && !user.verified) return <Navigate to="/authenticate" replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to={getDashboardRoute(user.role)} replace />;
  return children;
}

export default function App() {
  const { token, user, loading } = useAuth();
  const isAuthenticated = Boolean(token);
  const dashboardRoute = user ? getDashboardRoute(user.role) : '/admin';

  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={!isAuthenticated || loading ? <LoginPage /> : <Navigate to={user?.firstLogin ? '/change-password' : dashboardRoute} replace />} />
        <Route path="/change-password" element={<ProtectedRoute allowFirstLogin><ChangePasswordPage /></ProtectedRoute>} />
        <Route path="/authenticate" element={<ProtectedRoute allowFirstLogin><AuthenticatePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireVerified roles={['ADMIN']}><AdminPage /></ProtectedRoute>} />
        <Route path="/admin/departments" element={<ProtectedRoute requireVerified roles={['ADMIN']}><DepartmentsPage /></ProtectedRoute>} />
        <Route path="/admin/staff" element={<ProtectedRoute requireVerified roles={['ADMIN']}><StaffPage /></ProtectedRoute>} />
        <Route path="/admin/doctors" element={<ProtectedRoute requireVerified roles={['ADMIN']}><DoctorsPage /></ProtectedRoute>} />
        <Route path="/admin/clinical-rooms" element={<ProtectedRoute requireVerified roles={['ADMIN']}><ClinicalRoomsPage /></ProtectedRoute>} />
        <Route path="/receptionist" element={<ProtectedRoute requireVerified roles={['RECEPTIONIST']}><ReceptionistDashboard /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute requireVerified roles={['DOCTOR']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/doctor/queue" element={<ProtectedRoute requireVerified roles={['DOCTOR']}><DoctorQueuePage /></ProtectedRoute>} />
        <Route path="/lab-manager" element={<ProtectedRoute requireVerified roles={['LAB_MANAGER']}><LabManagerDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? (user?.firstLogin ? '/change-password' : dashboardRoute) : '/login'} replace />} />
      </Routes>
    </div>
  );
}
