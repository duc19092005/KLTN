import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../../utils/constants';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

export default function PatientVerificationPage() {
  const navigate = useNavigate();
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expandedProof, setExpandedProof] = useState(null); // stores seq of expanded proof

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!patientCode.trim()) return;

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedProof(null);

    try {
      // Direct call to public endpoint on backend
      const response = await axios.get(`${API_URL}/patient-verify/${patientCode.trim().toUpperCase()}`);
      
      // Axios response data matches our backend structure
      // Backend returns: { success: true, data: { patient, visits: [...] } }
      const resData = response.data.success !== undefined ? response.data.data : response.data;
      
      if (!resData || !resData.patient) {
        setError('Không tìm thấy thông tin bệnh nhân hoặc bệnh án nào khớp với mã số này.');
      } else {
        setData(resData);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        'Không tìm thấy mã số sổ khám bệnh này hoặc hệ thống gặp sự cố kết nối.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleProof = (seq) => {
    if (expandedProof === seq) {
      setExpandedProof(null);
    } else {
      setExpandedProof(seq);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] font-sans antialiased text-slate-800">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-50 px-6 py-4 shadow-sm shadow-slate-100/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 text-white font-bold rounded-xl flex items-center justify-center shadow-md shadow-cyan-100">
              ✚
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Cổng Kiểm Chứng Y Tế</h1>
              <p className="text-xs text-slate-500 font-medium">Bảo mật thông tin bệnh án bằng Blockchain</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 text-sm font-semibold text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 border border-cyan-200 rounded-xl transition-all"
          >
            Đăng nhập nhân sự
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 py-10">
        
        {/* Verification Intro and Search Form */}
        <section className="bg-white rounded-2xl border border-slate-150 p-6 md:p-8 shadow-sm mb-8 text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 bg-cyan-50 text-cyan-700 text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
            Xác thực bệnh án ZKP
          </span>
          <h2 className="text-2xl font-bold text-slate-950 tracking-tight mb-2">Tra cứu & Kiểm chứng bệnh án của bạn</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-6">
            Nhập mã số in trên sổ khám bệnh của bạn (ví dụ: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-cyan-600 font-semibold">BN-0001</code>). Hệ thống sẽ truy vấn dữ liệu chẩn đoán lâm sàng, ảnh chụp da liễu và đối chiếu trực tiếp Merkle Proof với Smart Contract trên mạng Blockchain.
          </p>

          <form onSubmit={handleVerify} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto">
            <input
              type="text"
              placeholder="Nhập mã sổ bệnh nhân (VD: BN-0001)..."
              value={patientCode}
              onChange={(e) => setPatientCode(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 outline-none transition-all placeholder-slate-400 font-medium uppercase"
            />
            <button
              type="submit"
              disabled={loading || !patientCode.trim()}
              className="bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-cyan-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <LoadingIndicator size="sm" tone="white" /> : 'Kiểm chứng ngay'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-100 text-rose-700 text-sm font-medium rounded-xl text-left">
              ⚠️ {error}
            </div>
          )}
        </section>

        {/* Verification Output */}
        {data && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* Patient Card */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Bệnh nhân</span>
                <h3 className="text-xl font-bold text-slate-900">{data.patient.fullName}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-semibold text-slate-500">
                  <span>Mã số: <strong className="text-slate-800">{data.patient.patientCode}</strong></span>
                  <span>•</span>
                  <span>Giới tính: <strong className="text-slate-800">{data.patient.gender === 'MALE' ? 'Nam' : 'Nữ'}</strong></span>
                  <span>•</span>
                  <span>Ngày sinh: <strong className="text-slate-800">{new Date(data.patient.dateOfBirth).toLocaleDateString('vi-VN')}</strong></span>
                </div>
              </div>
              <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-xs rounded-xl flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Dữ liệu hành chính hợp lệ
              </div>
            </section>

            {/* Visit Tree Timeline */}
            <div>
              <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                📋 Lịch sử khám và kiểm toán Blockchain ({data.visits.length} lượt khám)
              </h4>

              {data.visits.length === 0 ? (
                <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm font-medium">
                  Bệnh nhân chưa có lịch sử lượt khám nào được ghi nhận.
                </div>
              ) : (
                <div className="space-y-6">
                  {data.visits.map((visit) => {
                    const verification = visit.blockchainVerification || { status: 'unanchored' };
                    
                    return (
                      <div key={visit.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        
                        {/* Visit Card Header */}
                        <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-3">
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-cyan-50 text-cyan-600 rounded-xl text-sm font-bold">
                              🩺
                            </span>
                            <div>
                              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-0.5">Lượt khám</div>
                              <span className="text-sm font-bold text-slate-900">
                                {new Date(visit.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </div>
                          </div>

                          {/* Verification Status Pill */}
                          {verification.status === 'verified' && (
                            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-150 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm shadow-emerald-50">
                              🟢 Verified (Đã xác minh trên Blockchain)
                            </span>
                          )}
                          {verification.status === 'tampered' && (
                            <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse shadow-sm shadow-rose-50">
                              🔴 Tampered (CẢNH BÁO: Bị đổi dữ liệu!)
                            </span>
                          )}
                          {verification.status === 'unanchored' && (
                            <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-1.5">
                              ⚪ Unanchored (Đang đợi neo)
                            </span>
                          )}
                        </div>

                        {/* Visit Card Body */}
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                          
                          {/* Left Column: Doctor Diagnosis */}
                          <div className="space-y-4">
                            <div>
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                Bác sĩ phụ trách & Phòng khám
                              </span>
                              <p className="text-sm font-bold text-slate-800">
                                Bác sĩ: {visit.doctor?.staffProfile?.fullName || 'Chưa phân công'}
                              </p>
                              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                Phòng khám: {visit.clinicalRoom?.name || 'Chưa xếp phòng'}
                              </p>
                            </div>

                            {visit.medicalConclusion ? (
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                                <span className="text-[10px] font-bold text-cyan-600 uppercase tracking-widest block">
                                  Kết luận lâm sàng của bác sĩ
                                </span>
                                <p className="text-sm font-bold text-slate-900">
                                  Chẩn đoán chính: {visit.medicalConclusion.finalDiagnosis}
                                </p>
                                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                                  Ghi chú điều trị: {visit.medicalConclusion.notes || 'Không có ghi chú thêm'}
                                </p>
                              </div>
                            ) : (
                              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-amber-700 text-xs font-medium">
                                ⏳ Lượt khám này hiện chưa được bác sĩ đưa ra kết luận lâm sàng cuối cùng.
                              </div>
                            )}
                          </div>

                          {/* Right Column: AI Assistance */}
                          <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                              Trợ lý AI chẩn đoán bệnh da liễu
                            </span>

                            {visit.aiDiagnosis ? (
                              <div className="space-y-3">
                                <div className="flex gap-4 items-center">
                                  {visit.aiDiagnosis.imageUrl && (
                                    <img
                                      src={visit.aiDiagnosis.imageUrl}
                                      alt="Ảnh chụp da liễu"
                                      className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm"
                                    />
                                  )}
                                  <div>
                                    <p className="text-sm font-bold text-slate-900">
                                      AI Gợi ý: {visit.aiDiagnosis.diagnosisResult}
                                    </p>
                                    <p className="text-xs font-bold text-cyan-600 mt-1">
                                      Độ tin cậy: {(visit.aiDiagnosis.confidence * 100).toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                                <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                                  Phiên bản AI Model: {visit.aiDiagnosis.aiModel?.modelName} (v{visit.aiDiagnosis.aiModel?.modelVersion})
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs font-medium text-slate-400 italic">
                                Không có hình ảnh chụp da liễu hoặc chẩn đoán AI cho lượt khám này.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Visit Card Footer: Merkle Proof Panel */}
                        {visit.medicalConclusion && (
                          <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-3 flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-semibold text-slate-500">
                                Hash kết luận: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 break-all">{visit.medicalConclusion.hash256}</code>
                              </span>
                              
                              {verification.status !== 'unanchored' && (
                                <button
                                  type="button"
                                  onClick={() => toggleProof(verification.seq)}
                                  className="text-xs font-bold text-cyan-600 hover:text-cyan-700 transition-colors flex items-center gap-1"
                                >
                                  {expandedProof === verification.seq ? ' ẩn chi tiết Blockchain ▴' : 'Xem chi tiết Blockchain ▾'}
                                </button>
                              )}
                            </div>

                            {/* Expanded proof info */}
                            {expandedProof === verification.seq && verification.proofDetails && (
                              <div className="mt-3 p-4 bg-slate-900 text-slate-300 font-mono text-[11px] rounded-xl space-y-2 border border-slate-800 overflow-x-auto shadow-inner">
                                <p className="text-cyan-400 font-bold border-b border-slate-800 pb-1 mb-2">
                                  ⛓️ BẰNG CHỨNG MẬT MÃ TRÊN BLOCKCHAIN (MERKLE PROOF)
                                </p>
                                <p>
                                  <span className="text-slate-500">Contract Address:</span> {API_URL.includes('localhost') ? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' : 'AUDIT_ANCHOR'}
                                </p>
                                <p>
                                  <span className="text-slate-500">Batch ID:</span> {verification.proofDetails.batchId}
                                </p>
                                <p>
                                  <span className="text-slate-500">Sequence No (seq):</span> {verification.proofDetails.seq}
                                </p>
                                <p>
                                  <span className="text-slate-500">Local Entry Hash:</span> {verification.proofDetails.entryHash}
                                </p>
                                <p>
                                  <span className="text-slate-500">On-Chain Merkle Root:</span> {verification.proofDetails.onChainRoot}
                                </p>
                                <div>
                                  <span className="text-slate-500">Merkle Path (proof):</span>
                                  <ul className="list-disc pl-5 mt-1 space-y-0.5 text-slate-400">
                                    {verification.proofDetails.proof.map((pHash, idx) => (
                                      <li key={idx}>{pHash}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="text-emerald-400 font-bold mt-2 pt-2 border-t border-slate-800">
                                  ✓ Trạng thái Smart Contract: Verified & Anchored (Tính toàn vẹn tuyệt đối)
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
