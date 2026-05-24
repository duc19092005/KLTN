import { useState, useEffect } from 'react';
import { useThemeLang } from '../contexts/ThemeLangContext';
import api from '../services/api';
import DiagnosisWorkflow from './DiagnosisWorkflow';

export default function PendingDiagnosesList({ doctorId }) {
  const { theme } = useThemeLang();
  const dark = theme === 'dark';

  const [diagnoses, setDiagnoses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Fetch pending diagnoses
  const fetchDiagnoses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/hospital/diagnoses', {
        params: { status: 'PENDING', doctorId }
      });
      const list = Array.isArray(res.data) ? res.data : (res.data?.diagnoses || res.data?.data || []);
      setDiagnoses(list);
    } catch (err) {
      console.error('Error fetching diagnoses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (doctorId) fetchDiagnoses();
  }, [doctorId]);

  const handleRowClick = (diagnosis) => {
    setSelectedDiagnosis(diagnosis);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    setSelectedDiagnosis(null);
    fetchDiagnoses(); // Refresh list
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return d.toLocaleString('vi-VN', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const cardBg = dark ? 'bg-[#0d2137] border-white/8' : 'bg-white border-slate-200';
  const headerBg = dark ? 'bg-[#071526]' : 'bg-slate-50';
  const rowHover = dark ? 'hover:bg-white/5' : 'hover:bg-slate-50';

  if (loading) {
    return (
      <div className={`rounded-2xl border shadow-lg overflow-hidden ${cardBg}`}>
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`rounded-2xl border shadow-lg overflow-hidden ${cardBg}`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${headerBg} ${dark ? 'border-white/8' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-base font-bold ${dark ? 'text-[#d8e2ff]' : 'text-slate-800'}`}>
                Hồ Sơ Bệnh Án
              </h2>
              <p className={`text-xs mt-0.5 ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                Danh sách bệnh án của bác sĩ ({diagnoses.length} hồ sơ)
              </p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"/>
              <span className="text-xs font-semibold text-orange-500">
                {diagnoses.length} PENDING
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        {diagnoses.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="mx-auto mb-3 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={dark ? '#475569' : '#94a3b8'} strokeWidth="1.5">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p className={`text-sm ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
              Chưa có hồ sơ bệnh án nào
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${dark ? 'border-white/8' : 'border-slate-200'}`}>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Mã Bệnh Án
                  </th>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Bệnh Nhân
                  </th>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Bệnh Lý Lâm Sàng
                  </th>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Phác Đồ Đề Xuất
                  </th>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Trợ Lý AI
                  </th>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Thời Gian
                  </th>
                  <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Trạng Thái
                  </th>
                  <th className={`px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {diagnoses.map((diag, idx) => (
                  <tr
                    key={diag.id || idx}
                    className={`border-b ${dark ? 'border-white/5' : 'border-slate-100'} transition-colors ${rowHover}`}
                  >
                    <td className={`px-4 py-3 text-xs font-mono ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      #{String(diag.id || '').slice(0, 8)}...
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${dark ? 'text-[#d8e2ff]' : 'text-slate-800'}`}>
                      {diag.patientName || 'N/A'}
                    </td>
                    <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {diag.clinicalSymptoms || diag.aiResults?.clinicalSymptoms || 'N/A'}
                    </td>
                    <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-600'}`}>
                      {diag.preliminaryTreatment || diag.aiResults?.preliminaryTreatment || 'Chờ kết luận'}
                    </td>
                    <td className={`px-4 py-3`}>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-semibold ${dark ? 'bg-teal-500/10 text-teal-400' : 'bg-teal-50 text-teal-600'}`}>
                        {diag.aiModel?.modelName || 'deepseek'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {formatDate(diag.createdAt || diag.aiResults?.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500"/>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-orange-500">
                          PENDING
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(diag);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
                          ${dark 
                            ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 hover:border-teal-500/30' 
                            : 'bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 hover:border-teal-300'
                          }`}
                        title="Xem kết quả AI và đưa ra kết luận chuyên môn"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 11l3 3L22 4"/>
                          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
                        </svg>
                        Kết Luận
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showModal && selectedDiagnosis && (
        <DiagnosisWorkflow
          doctorId={doctorId}
          existingDiagnosis={selectedDiagnosis}
          onClose={() => {
            setShowModal(false);
            setSelectedDiagnosis(null);
          }}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
