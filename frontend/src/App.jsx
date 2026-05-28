import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthenticatePage from './pages/AuthenticatePage';
import AdminPage from './pages/AdminPage';
import LoadingIndicator from './components/LoadingIndicator';

function ProtectedRoute({ children, requireVerified = false }) {
  const { token, user, loading } = useAuth();
  if (loading) return <LoadingIndicator fullScreen size="lg" label="Đang tải phiên làm việc..." />;
  if (!token || !user) return <Navigate to="/login" replace />;
  if (requireVerified && (user.firstLogin || !user.verified)) return <Navigate to="/authenticate" replace />;
  return children;
}

export default function App() {
  const { token, loading } = useAuth();
  const isAuthenticated = Boolean(token);

  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={!isAuthenticated || loading ? <LoginPage /> : <Navigate to="/admin" replace />} />
        <Route path="/authenticate" element={<ProtectedRoute><AuthenticatePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute requireVerified><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/admin' : '/login'} replace />} />
      </Routes>
    </div>
  );
}
