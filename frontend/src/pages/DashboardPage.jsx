import { useAuth } from '../contexts/AuthContext';
import { useThemeLang } from '../contexts/ThemeLangContext';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeLang();

  return (
    <div className={`min-h-screen flex flex-col ${theme === 'dark' ? 'bg-[#001233] text-white' : 'bg-slate-50 text-slate-800'}`}>
      <header className="flex justify-between items-center p-6 border-b">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <button onClick={toggleTheme}>
            <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <button onClick={logout} className="font-semibold text-rose-500">Đăng xuất</button>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-4xl font-bold mb-4">Xin chào, {user?.username || 'Admin'}</h2>
          <p className="opacity-70">Chào mừng bạn đến với hệ thống quản trị.</p>
        </div>
      </main>
    </div>
  );
}

function formatShortId(id) {
  return id ? `${id.substring(0, 8)}…` : '--';
}

function getDoctorName(doctor) {
  return doctor.doctorName || doctor.name || doctor.user?.username || 'Chưa cập nhật';
}

function getDoctorStatus(doctor) {
  return doctor.doctorStatus || doctor.user?.status || doctor.status || 'UNKNOWN';
}

function getTransactionStatus(tx) {
  return tx.status || tx.blockchainStatus || 'UNKNOWN';
}

function getAiModelStatus(model) {
  return model.isActiveOnChain ? 'ON_CHAIN' : 'PENDING';
}

function formatHash(hash) {
  if (!hash) return 'Chưa cập nhật';
  if (hash.length <= 24) return hash;
  return `${hash.substring(0, 12)}…${hash.substring(hash.length - 10)}`;
}

function formatDateTime(value) {
  if (!value) return 'Chưa cập nhật';
  return new Date(value).toLocaleString('vi-VN');
}
