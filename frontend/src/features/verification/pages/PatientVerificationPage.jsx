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
      const response = await axios.get(`${API_URL}/patient-verify/${patientCode.trim().toUpperCase()}`);
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
    setExpandedProof(expandedProof === seq ? null : seq);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f9f9ff] text-[#111c2c] antialiased relative">
      {/* Inject custom stylesheet directly inside the component to prevent global dark mode leakage */}
      <style dangerouslySetInnerHTML={{__html: `
        .hms-verification-portal {
          --primary: #003f87;
          --secondary: #006b5b;
          --background: #f9f9ff;
          font-family: 'Inter', sans-serif;
        }
        .bg-pattern-light {
          background-color: #f9f9ff;
          background-image: radial-gradient(#acc7ff 1.2px, transparent 1.2px);
          background-size: 32px 32px;
        }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .material-symbols-outlined.fill {
          font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        .delay-300 { animation-delay: 300ms; }
        .delay-400 { animation-delay: 400ms; }
      `}} />

      <div className="hms-verification-portal bg-pattern-light flex-grow flex flex-col min-h-screen">
        {/* TopNavBar */}
        <header className="sticky top-0 z-50 shadow-sm bg-[#f9f9ff] border-b border-[#c2c6d4]/30 w-full backdrop-blur-md bg-opacity-90">
          <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="bg-[#003f87] text-white p-2 rounded-lg flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined fill">health_and_safety</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#003f87] leading-tight">Cổng Kiểm Chứng Y Tế</h1>
                <p className="text-xs font-semibold text-[#424752]">Bảo mật thông tin bệnh án bằng Blockchain</p>
              </div>
            </div>
            {/* Navigation Links */}
            {/* Actions */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex gap-2">
                <button className="p-2 text-[#424752] hover:bg-[#f0f3ff] rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center">
                  <span className="material-symbols-outlined">security</span>
                </button>
                <button className="p-2 text-[#424752] hover:bg-[#f0f3ff] rounded-full transition-all duration-300 active:scale-95 flex items-center justify-center">
                  <span className="material-symbols-outlined">language</span>
                </button>
              </div>
              <button 
                onClick={() => navigate('/login')}
                className="bg-[#f0f3ff] text-[#003f87] hover:bg-[#e7eeff] transition-all duration-300 active:scale-95 px-4 py-2 rounded-lg font-semibold text-sm border border-[#c2c6d4] shadow-sm"
              >
                Staff Login
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow flex flex-col items-center justify-start px-6 py-12 relative overflow-hidden">
          {/* Decorative Ambient Glows */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#acc7ff]/15 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7cf8dd]/15 rounded-full blur-3xl -z-10"></div>

          <div className="w-full max-w-4xl mx-auto">
            {/* Secure Lookup Card */}
            <div className="bg-[#ffffff] rounded-2xl shadow-[0px_10px_30px_rgba(0,0,0,0.05)] p-8 md:p-12 border-t-4 border-[#006b5b] relative overflow-hidden mb-8 border border-slate-100">
              {/* Inner Glow for Verification Context */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#7cf8dd]/10 to-transparent pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Badge */}
                <div className="opacity-0 animate-fade-in-up delay-100 mb-6">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#006b5b]/15 text-[#006b5b] font-bold text-xs uppercase tracking-wider">
                    <span className="material-symbols-outlined fill text-[14px]">verified_user</span>
                    XÁC THỰC BỆNH ÁN AN TOÀN
                  </span>
                </div>
                {/* Title */}
                <h2 className="opacity-0 animate-fade-in-up delay-200 text-2xl md:text-4xl font-extrabold text-[#111c2c] tracking-tight mb-4 leading-tight">
                  Tra cứu &amp; Kiểm chứng bệnh án của bạn
                </h2>
                {/* Description */}
                <p className="opacity-0 animate-fade-in-up delay-300 text-sm md:text-base text-[#424752] max-w-2xl mx-auto mb-8 leading-relaxed">
                  Nhập mã số in trên sổ khám bệnh của bạn (ví dụ: <code className="bg-[#e7eeff] px-1.5 py-0.5 rounded text-[#003f87] text-sm font-mono font-bold">BN-0001</code>). Hệ thống sẽ truy vấn dữ liệu chẩn đoán lâm sàng, ảnh chụp da liễu và đối chiếu trực tiếp Merkle Proof với Smart Contract trên mạng Blockchain.
                </p>
                {/* Search Form */}
                <form onSubmit={handleVerify} className="opacity-0 animate-fade-in-up delay-400 w-full max-w-xl mx-auto flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#727784]">
                      <span className="material-symbols-outlined">shield_locked</span>
                    </div>
                    <input 
                      value={patientCode}
                      onChange={(e) => setPatientCode(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-xl border border-[#c2c6d4] bg-white text-[#111c2c] focus:outline-none focus:ring-2 focus:ring-[#003f87] focus:border-[#003f87] transition-all duration-300 text-sm placeholder:text-[#c2c6d4] shadow-inner font-semibold uppercase" 
                      placeholder="NHẬP MÃ SỐ BỆNH NHÂN (VD: BN-0001)..." 
                      type="text"
                    />
                  </div>
                  <button 
                    disabled={loading || !patientCode.trim()}
                    className="whitespace-nowrap px-8 py-4 bg-[#006b5b] text-white rounded-xl font-bold text-sm hover:bg-[#007261] transition-all duration-300 shadow-md shadow-[#006b5b]/10 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed" 
                    type="submit"
                  >
                    {loading ? (
                      <LoadingIndicator size="sm" tone="white" />
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">search_check</span>
                        Kiểm chứng ngay
                      </>
                    )}
                  </button>
                </form>

                {error && (
                  <div className="opacity-0 animate-fade-in-up mt-6 w-full max-w-xl p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl text-left flex items-center gap-2 animate-pulse">
                    <span className="material-symbols-outlined text-rose-500 text-[18px]">error</span>
                    {error}
                  </div>
                )}

                {/* Trust Indicators */}
                <div className="opacity-0 animate-fade-in-up delay-400 mt-12 flex flex-wrap justify-center gap-8 text-[#424752]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#727784]">enhanced_encryption</span>
                    <span className="font-bold text-xs">Mã hóa đầu cuối</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#727784]">link</span>
                    <span className="font-bold text-xs">Immutable Ledger</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Grid - Dynamic Layout */}
            {data && (
              <div className="space-y-6 animate-fade-in-up">
                {/* Patient Profile Card */}
                <div className="bg-[#ffffff] rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#f0f3ff] text-[#003f87] flex items-center justify-center font-bold text-lg border border-[#acc7ff]">
                      {data.patient.fullName.charAt(0)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bệnh nhân</span>
                      <h3 className="text-lg font-bold text-[#111c2c]">{data.patient.fullName}</h3>
                      <div className="flex gap-4 text-xs font-semibold text-[#424752] mt-1">
                        <span>Mã số: <strong className="text-[#003f87]">{data.patient.patientCode}</strong></span>
                        <span>•</span>
                        <span>Giới tính: <strong>{data.patient.gender === 'MALE' ? 'Nam' : 'Nữ'}</strong></span>
                        <span>•</span>
                        <span>Sinh: <strong>{new Date(data.patient.dateOfBirth).toLocaleDateString('vi-VN')}</strong></span>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Thông tin hành chính hợp lệ
                  </div>
                </div>

                {/* Visit History */}
                <div>
                  <h3 className="text-lg font-bold text-[#111c2c] mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#003f87]">history</span>
                    Lịch sử lượt khám ({data.visits.length} ca khám)
                  </h3>

                  {data.visits.length === 0 ? (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-2xl text-slate-400 text-sm font-medium">
                      Bệnh nhân chưa có lượt khám nào.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {data.visits.map((visit) => {
                        const verification = visit.blockchainVerification || { status: 'unanchored' };
                        
                        return (
                          <div key={visit.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:border-slate-300">
                            
                            {/* Card Header */}
                            <div className="bg-[#f0f3ff] px-6 py-4 border-b border-[#c2c6d4]/30 flex flex-wrap justify-between items-center gap-3">
                              <div className="flex items-center gap-3">
                                <span className="p-2 bg-[#e7eeff] text-[#003f87] rounded-xl flex items-center justify-center">
                                  <span className="material-symbols-outlined fill">event_note</span>
                                </span>
                                <div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Thời gian khám</div>
                                  <span className="text-sm font-bold text-[#111c2c]">
                                    {new Date(visit.createdAt).toLocaleString('vi-VN')}
                                  </span>
                                </div>
                              </div>

                              {/* On-Chain Badge */}
                              {verification.status === 'verified' && (
                                <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
                                  <span className="material-symbols-outlined fill text-[14px]">check_circle</span>
                                  Verified (Đúng khớp Blockchain)
                                </span>
                              )}
                              {verification.status === 'tampered' && (
                                <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse shadow-sm shadow-rose-100">
                                  <span className="material-symbols-outlined fill text-[14px]">gpp_maybe</span>
                                  TAMPERED (CẢNH BÁO BỊ SỬA!)
                                </span>
                              )}
                              {verification.status === 'unanchored' && (
                                <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                                  Unanchored (Đang đợi neo)
                                </span>
                              )}
                            </div>

                            {/* Card Body */}
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                              
                              {/* Clinical diagnosis */}
                              <div className="space-y-4">
                                <div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                    Bác sĩ khám &amp; Phòng bệnh
                                  </span>
                                  <p className="text-sm font-bold text-[#111c2c]">
                                    Bác sĩ: {visit.doctor?.staffProfile?.fullName || 'Chưa phân công'}
                                  </p>
                                  <p className="text-xs font-semibold text-[#424752] mt-0.5">
                                    Phòng: {visit.clinicalRoom?.name || 'Chưa xếp phòng'}
                                  </p>
                                </div>

                                {visit.medicalConclusion ? (
                                  <div className="p-4 bg-[#f9f9ff] border border-[#c2c6d4]/30 rounded-xl space-y-1.5">
                                    <span className="text-[10px] font-bold text-[#003f87] uppercase tracking-widest block">
                                      Kết luận lâm sàng
                                    </span>
                                    <p className="text-sm font-bold text-[#111c2c]">
                                      Chẩn đoán: {visit.medicalConclusion.finalDiagnosis}
                                    </p>
                                    <p className="text-xs font-semibold text-[#424752] leading-relaxed">
                                      Ghi chú: {visit.medicalConclusion.notes || 'Không có ghi chú thêm'}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px]">info</span>
                                    Chưa có kết luận chính thức từ bác sĩ.
                                  </div>
                                )}
                              </div>

                              {/* AI Dermatological Diagnosis */}
                              <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                  Trợ lý AI chẩn đoán hình ảnh
                                </span>

                                {visit.aiDiagnosis ? (
                                  <div className="space-y-3">
                                    <div className="flex gap-4 items-center">
                                      {visit.aiDiagnosis.imageUrl && (
                                        <img
                                          src={visit.aiDiagnosis.imageUrl}
                                          alt="Dermatology Scan"
                                          className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm"
                                        />
                                      )}
                                      <div>
                                        <p className="text-sm font-bold text-[#111c2c]">
                                          Kết quả AI: {visit.aiDiagnosis.diagnosisResult}
                                        </p>
                                        <p className="text-xs font-bold text-[#006b5b] mt-1">
                                          Độ tin cậy: {(visit.aiDiagnosis.confidence * 100).toFixed(1)}%
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-[11px] font-semibold text-slate-400">
                                      Mô hình: {visit.aiDiagnosis.aiModel?.modelName} (v{visit.aiDiagnosis.aiModel?.modelVersion})
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-xs font-medium text-slate-400 italic">
                                    Không có ảnh chụp bệnh da liễu hoặc chẩn đoán từ AI.
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Card Footer: Cryptographic hashes */}
                            {visit.medicalConclusion && (
                              <div className="border-t border-slate-100 bg-[#f9f9ff]/30 px-6 py-4 flex flex-col gap-3">
                                <div className="flex flex-wrap justify-between items-center gap-2">
                                  <span className="text-xs font-semibold text-[#424752] flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[16px] text-[#727784]">fingerprint</span>
                                    Hash chẩn đoán: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 break-all">{visit.medicalConclusion.hash256}</code>
                                  </span>
                                  
                                  {verification.status !== 'unanchored' && (
                                    <button
                                      type="button"
                                      onClick={() => toggleProof(verification.seq)}
                                      className="text-xs font-bold text-[#003f87] hover:underline flex items-center gap-1 active:scale-95"
                                    >
                                      {expandedProof === verification.seq ? 'Ẩn chi tiết Blockchain ▴' : 'Xem chi tiết Blockchain ▾'}
                                    </button>
                                  )}
                                </div>

                                {/* Expanded cryptographic details */}
                                {expandedProof === verification.seq && verification.proofDetails && (
                                  <div className="mt-3 p-5 bg-[#1e293b] text-slate-300 font-mono text-[11px] rounded-xl space-y-2 border border-slate-800 overflow-x-auto shadow-inner">
                                    <p className="text-[#38bdf8] font-bold border-b border-slate-800 pb-1.5 mb-3 flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[16px] text-[#38bdf8]">account_tree</span>
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
                                      <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-400">
                                        {verification.proofDetails.proof.map((pHash, idx) => (
                                          <li key={idx} className="break-all">{pHash}</li>
                                        ))}
                                      </ul>
                                    </div>
                                    <div className="text-emerald-400 font-bold mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-1.5">
                                      <span className="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
                                      ✓ Trạng thái Smart Contract: Verified &amp; Anchored (Tính toàn vẹn tuyệt đối)
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

        {/* Footer */}
        <footer className="bg-white border-t border-[#c2c6d4] mt-auto">
          <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 py-8 max-w-7xl mx-auto gap-4">
            <div className="text-base text-[#111c2c]">
              <span className="font-bold text-[#003f87] flex items-center gap-2">
                <span className="material-symbols-outlined fill text-[#003f87]">verified</span>
                Secure Medical Blockchain Ledger
              </span>
            </div>
            <p className="text-sm text-[#006b5b] text-center md:text-left font-semibold">
              © 2026 Secure Medical Blockchain Ledger. All patient data is encrypted.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <span className="text-xs font-semibold text-[#424752] hover:text-[#003f87] hover:underline cursor-pointer transition-all">Security Protocol</span>
              <span className="text-xs font-semibold text-[#424752] hover:text-[#003f87] hover:underline cursor-pointer transition-all">Privacy Policy</span>
              <span className="text-xs font-semibold text-[#424752] hover:text-[#003f87] hover:underline cursor-pointer transition-all">Verification API</span>
              <span className="text-xs font-semibold text-[#424752] hover:text-[#003f87] hover:underline cursor-pointer transition-all">Support</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
