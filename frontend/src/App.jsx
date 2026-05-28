import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthenticatePage from './pages/AuthenticatePage';
import AdminPage from './pages/AdminPage';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token } = useAuth();

  return (
    <div className="app">
      <Routes>
        <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/admin" replace />} />
        <Route path="/authenticate" element={<ProtectedRoute><AuthenticatePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={token ? '/admin' : '/login'} replace />} />
      </Routes>
    </div>
  );
}
