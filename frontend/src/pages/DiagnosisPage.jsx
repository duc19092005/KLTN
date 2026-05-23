import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLang } from '../contexts/ThemeLangContext';
import DiagnosisWorkflow from '../components/DiagnosisWorkflow';
import api from '../services/api';

/**
 * DiagnosisPage - Trang quản lý chuẩn đoán cho bác sĩ
 * Hiển thị danh sách chuẩn đoán và cho phép tạo chuẩn đoán mới
 */
export default function DiagnosisPage() {
  const { user } = useAuth();
  const { theme, lang } = useThemeLang();
  const isDark = theme === 'dark';

  const [showWorkflow, setShowWorkflow] = useState(false);
  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load diagnoses
  const loadDiagnoses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hospital/diagnoses');
      setDiagnoses(res.data || []);
    } catch (err) {
      console.error('Failed to load diagnoses:', err);
    } finally {
      setLoading(false);
    }
  };

  useState(() => {
    loadDiagnoses();
  }, []);

  const handleWorkflowSuccess = () => {
    loadDiagnoses();
  };

  const getStatusBadge = (status) => {
    const colors = {
      PENDING: { bg: 'rgba(251, 191, 36, 0.1)', text: '#f59e0b', label: 'Chờ kết luận' },
      COMPLETED: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e', label: 'Hoàn thành' },
    };
    const config = colors[status] || colors.PENDING;
    return (
      <span
        className="px-3 py-1 rounded-full text-xs font-semibold"
        style={{ background: config.bg, color: config.text }}
      >
        {config.label}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('vi-VN');
  };

  const formatShortId = (id) => {
    return id.substring(0, 8);
  };

  return (
    <div
      className="min-h-screen p-8"
      style={{
        background: isDark ? '#0f172a' : '#f8fafc',
        color: isDark ? '#f8fafc' : '#0f172a',
      }}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {lang === 'vi' ? 'Quản Lý Chuẩn Đoán' : 'Diagnosis Management'}
            </h1>
            <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
              {lang === 'vi'
                ? 'Quy trình chuẩn đoán 2 bước: AI sơ bộ → Kết luận chuyên môn'
                : '2-step diagnosis workflow: AI preliminary → Professional conclusion'}
            </p>
          </div>
          <button
            onClick={() => setShowWorkflow(true)}
            className="px-6 py-3 rounded-xl font-semibold text-white bg-blue-500 hover:bg-blue-600 transition-all shadow-lg hover:shadow-xl"
          >
            + {lang === 'vi' ? 'Chuẩn Đoán Mới' : 'New Diagnosis'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div
          className="p-6 rounded-xl border"
          style={{
            background: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">{diagnoses.length}</p>
              <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'vi' ? 'Tổng chuẩn đoán' : 'Total Diagnoses'}
              </p>
            </div>
          </div>
        </div>

        <div
          className="p-6 rounded-xl border"
          style={{
            background: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#eab308"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {diagnoses.filter((d) => d.diagnoseStatus === 'PENDING').length}
              </p>
              <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'vi' ? 'Chờ kết luận' : 'Pending'}
              </p>
            </div>
          </div>
        </div>

        <div
          className="p-6 rounded-xl border"
          style={{
            background: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {diagnoses.filter((d) => d.diagnoseStatus === 'COMPLETED').length}
              </p>
              <p className="text-sm" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'vi' ? 'Hoàn thành' : 'Completed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnoses Table */}
      <div className="max-w-7xl mx-auto">
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            background: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          }}
        >
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-4" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'vi' ? 'Đang tải...' : 'Loading...'}
              </p>
            </div>
          ) : diagnoses.length === 0 ? (
            <div className="p-12 text-center">
              <svg
                className="mx-auto mb-4"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDark ? '#475569' : '#cbd5e1'}
                strokeWidth="2"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
              <p className="text-lg font-semibold mb-2">
                {lang === 'vi' ? 'Chưa có chuẩn đoán' : 'No diagnoses yet'}
              </p>
              <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {lang === 'vi'
                  ? 'Nhấn "Chuẩn Đoán Mới" để bắt đầu'
                  : 'Click "New Diagnosis" to get started'}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    background: isDark ? '#0f172a' : '#f8fafc',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase">
                    {lang === 'vi' ? 'Bác sĩ' : 'Doctor'}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase">
                    {lang === 'vi' ? 'Model AI' : 'AI Model'}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase">
                    {lang === 'vi' ? 'Trạng thái' : 'Status'}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase">
                    {lang === 'vi' ? 'Ngày tạo' : 'Created'}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase">
                    {lang === 'vi' ? 'Hành động' : 'Actions'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnoses.map((diagnosis) => (
                  <tr
                    key={diagnosis.id}
                    className="border-b hover:bg-black/5 transition-colors"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    }}
                  >
                    <td className="px-6 py-4 font-mono text-sm">#{formatShortId(diagnosis.id)}</td>
                    <td className="px-6 py-4">{diagnosis.doctor?.doctorName || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      {diagnosis.aiModel?.modelName || 'N/A'}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(diagnosis.diagnoseStatus)}</td>
                    <td className="px-6 py-4 text-sm">{formatDate(diagnosis.createdAt)}</td>
                    <td className="px-6 py-4">
                      <button
                        className="px-3 py-1 rounded-lg text-sm font-medium hover:bg-black/10 transition-colors"
                        style={{ color: '#3b82f6' }}
                      >
                        {lang === 'vi' ? 'Chi tiết' : 'Details'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Diagnosis Workflow Modal */}
      {showWorkflow && (
        <DiagnosisWorkflow
          onClose={() => setShowWorkflow(false)}
          onSuccess={handleWorkflowSuccess}
        />
      )}
    </div>
  );
}
