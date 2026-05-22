import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthenticatePage from './pages/AuthenticatePage';
import DashboardPage from './pages/DashboardPage';
import RecoveryPage from './pages/RecoveryPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

function ProtectedRoute({ children, requiredRole, pageType = 'secure' }) {
  const { user, token } = useAuth();
  
  // Rule 1: Nếu chưa đăng nhập, bắt buộc về login
  if (!token) return <Navigate to="/login" replace />;
  
  // Rule 2: Nếu là lần đăng nhập đầu tiên, bắt buộc ở trang register để hoàn thành thiết lập
  // (Cả Admin lần đầu dùng invite token và Doctor lần đầu dùng temp password)
  if (user?.firstLogin) {
    if (pageType === 'register') return children;
    return <Navigate to="/register" replace />;
  }
  
  // Rule 3: Nếu chưa xác thực Layer 2, bắt buộc phải vào authenticate (hoặc trang recovery để khôi phục ví)
  if (!user?.verified) {
    if (pageType === 'authenticate' || pageType === 'recovery') return children;
    return <Navigate to="/authenticate" replace />;
  }

  // Rule 4: Nếu đã xác thực Layer 2 rồi, không cho phép truy cập lại register hay authenticate
  if (user?.verified) {
    if (pageType === 'authenticate' || pageType === 'register') {
      return <Navigate to="/dashboard" replace />;
    }
  }
  
  return children;
}

export default function App() {
  const { token } = useAuth();

  return (
    <div className="app">
      {token && <Navbar />}
      <main style={{ paddingTop: token ? '64px' : '0' }}>
        <Routes>
          <Route path="/" element={!token ? <HomePage /> : <Navigate to="/dashboard" />} />
          <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/dashboard" />} />
          
          <Route path="/register" element={
            <ProtectedRoute pageType="register"><RegisterPage /></ProtectedRoute>
          } />
          
          <Route path="/authenticate" element={
            <ProtectedRoute pageType="authenticate"><AuthenticatePage /></ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute pageType="secure"><DashboardPage /></ProtectedRoute>
          } />
          
          <Route path="/recovery" element={<RecoveryPage />} />
          
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          
          <Route path="*" element={<Navigate to={token ? "/dashboard" : "/"} />} />
        </Routes>
      </main>
    </div>
  );
}
