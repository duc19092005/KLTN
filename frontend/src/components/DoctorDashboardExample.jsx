import { useState } from 'react';
import { useThemeLang } from '../contexts/ThemeLangContext';
import { useAuth } from '../contexts/AuthContext';
import PendingDiagnosesList from '../components/PendingDiagnosesList';
import DiagnosisWorkflow from '../components/DiagnosisWorkflow';

/**
 * Example Doctor Dashboard Component
 * Integrates PendingDiagnosesList with ability to create new diagnoses
 */
export default function DoctorDashboardExample() {
  const { theme } = useThemeLang();
  const { user } = useAuth();
  const dark = theme === 'dark';

  const [showNewDiagnosis, setShowNewDiagnosis] = useState(false);

  // Get doctorId from authenticated user
  const doctorId = user?.doctorProfile?.id;

  if (!doctorId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`text-center ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
          <p className="text-lg font-semibold mb-2">Không tìm thấy hồ sơ bác sĩ</p>
          <p className="text-sm">Vui lòng đăng nhập lại</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${dark ? 'bg-[#0a192f]' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className={`text-2xl font-bold ${dark ? 'text-[#d8e2ff]' : 'text-slate-800'}`}>
                Dashboard Bác Sĩ
              </h1>
              <p className={`text-sm mt-1 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Xin chào, <span className="font-semibold">{user?.doctorProfile?.doctorName || user?.username}</span>
              </p>
            </div>

            {/* New Diagnosis Button */}
            <button
              onClick={() => setShowNewDiagnosis(true)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shadow-lg shadow-teal-500/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Chẩn Đoán Mới
            </button>
          </div>
        </div>

        {/* Stats Cards (Optional) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            title="Tổng Chẩn Đoán"
            value="24"
            icon="📊"
            dark={dark}
          />
          <StatCard
            title="Đang Chờ Xử Lý"
            value="3"
            icon="⏳"
            highlight
            dark={dark}
          />
          <StatCard
            title="Đã Hoàn Thành"
            value="21"
            icon="✅"
            dark={dark}
          />
        </div>

        {/* Pending Diagnoses List */}
        <PendingDiagnosesList doctorId={doctorId} />

        {/* New Diagnosis Modal */}
        {showNewDiagnosis && (
          <DiagnosisWorkflow
            doctorId={doctorId}
            onClose={() => setShowNewDiagnosis(false)}
            onSuccess={() => {
              setShowNewDiagnosis(false);
              // List will auto-refresh
            }}
          />
        )}
      </div>
    </div>
  );
}

// Helper component for stats cards
function StatCard({ title, value, icon, highlight = false, dark }) {
  const cardBg = dark ? 'bg-[#0d2137] border-white/8' : 'bg-white border-slate-200';
  const highlightBg = highlight 
    ? (dark ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200')
    : cardBg;

  return (
    <div className={`rounded-xl border p-5 ${highlightBg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
            highlight 
              ? 'text-orange-500' 
              : (dark ? 'text-slate-400' : 'text-slate-500')
          }`}>
            {title}
          </p>
          <p className={`text-2xl font-bold ${
            highlight
              ? 'text-orange-500'
              : (dark ? 'text-[#d8e2ff]' : 'text-slate-800')
          }`}>
            {value}
          </p>
        </div>
        <div className="text-3xl opacity-50">{icon}</div>
      </div>
    </div>
  );
}
