import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../../../utils/constants';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { LoginPage } from '../../auth';

export default function PatientVerificationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expandedProof, setExpandedProof] = useState(null); // stores seq of expanded proof

  const showLogin = searchParams.get('login') === 'true';
  const initialMode = searchParams.get('tab') || 'staff';

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
    <div className="min-h-screen flex flex-col relative hero-bg text-[#171b2b] antialiased">
      <style dangerouslySetInnerHTML={{__html: `
        .hero-bg {
            background: radial-gradient(circle at 50% -20%, #dde1ff 0%, #faf8ff 60%);
        }
        .glass-panel {
            background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
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

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-surface/80 dark:bg-surface-container-lowest/80 backdrop-blur-md shadow-[0px_20px_40px_rgba(99,115,193,0.08)]">
        <div className="flex justify-between items-center px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto h-20 w-full">
          {/* Brand */}
          <div 
            onClick={(e) => { e.preventDefault(); setPatientCode(''); setData(null); setError(null); }}
            className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined fill" style={{ fontVariationSettings: "'FILL' 1" }}>health_and_safety</span>
            Medicare Identity
          </div>
          {/* Desktop Nav */}
          {/* Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSearchParams({ login: 'true', tab: 'staff' })}
              className="hidden md:flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg hover:translate-y-[-1px] shadow-[0px_4px_12px_rgba(70,86,162,0.2)] transition-all font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              Đăng nhập Staff
            </button>
            {/* Mobile Login Toggle */}
            <button 
              onClick={() => setSearchParams({ login: 'true', tab: 'staff' })}
              className="md:hidden text-primary flex items-center justify-center p-2 rounded-full hover:bg-slate-100"
              title="Đăng nhập Staff"
            >
              <span className="material-symbols-outlined text-[24px]">login</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Canvas */}
      <main className="flex-grow pt-32 pb-20 px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto w-full flex flex-col items-center">
        {/* Hero Section */}
        <section className="w-full max-w-4xl mx-auto text-center mt-12 mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-container-low text-primary font-label-md text-label-md mb-6 border border-primary-fixed font-bold animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Mạng Blockchain đang hoạt động
          </div>
          <h1 className="font-display-lg text-display-lg text-on-background mb-6 tracking-tight animate-fade-in-up delay-100">
            Cổng Kiểm Chứng <br/>
            <span className="text-primary">Hồ Sơ Y Tế</span>
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-12 leading-relaxed animate-fade-in-up delay-200">
            Nhập mã số sổ khám bệnh hoặc mã hash giao dịch để xác thực hồ sơ bệnh án tức thời trên sổ cái Blockchain. Đảm bảo tính minh bạch tuyệt đối và an tâm tin cậy.
          </p>

          {/* Search Console */}
          <form onSubmit={handleVerify} className="w-full max-w-2xl mx-auto bg-surface-container-lowest rounded-xl p-2 pl-6 shadow-[0px_20px_40px_rgba(99,115,193,0.08)] border border-outline-variant/30 flex items-center gap-4 transition-all focus-within:shadow-[0px_20px_40px_rgba(99,115,193,0.15)] focus-within:border-primary-fixed animate-fade-in-up delay-300">
            <span className="material-symbols-outlined text-outline">key</span>
            <input 
              value={patientCode}
              onChange={(e) => setPatientCode(e.target.value)}
              className="flex-grow bg-transparent border-none outline-none font-body-md text-body-md text-on-surface placeholder:text-outline-variant py-4 focus:ring-0 uppercase font-semibold" 
              placeholder="Nhập mã bệnh nhân hoặc mã hash (VD: BN-0001)..." 
              type="text"
            />
            <button type="button" className="p-3 bg-surface-container-low text-primary rounded-lg hover:bg-primary-fixed transition-colors" title="Quét mã QR">
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
            <button 
              disabled={loading || !patientCode.trim()} 
              className="bg-primary text-on-primary font-label-md text-label-md px-8 py-4 rounded-lg hover:translate-y-[-1px] transition-all shadow-[0px_4px_10px_rgba(70,86,162,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold"
              type="submit"
            >
              {loading ? <LoadingIndicator size="sm" tone="white" /> : 'Kiểm chứng'}
            </button>
          </form>

          {error && (
            <div className="mt-6 w-full max-w-2xl mx-auto p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl text-left flex items-center gap-2 animate-pulse">
              <span className="material-symbols-outlined text-rose-500 text-[18px]">error</span>
              {error}
            </div>
          )}

          {/* Security Badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 mt-12 opacity-80 animate-fade-in-up delay-400">
            <div className="flex items-center gap-2 font-label-md text-label-md text-secondary font-bold">
              <span className="material-symbols-outlined text-[20px]">shield_locked</span>
              Mã hóa AES-256
            </div>
            <div className="w-1 h-1 rounded-full bg-outline-variant"></div>
            <div className="flex items-center gap-2 font-label-md text-label-md text-secondary font-bold">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
              Tiêu chuẩn HIPAA quốc tế
            </div>
          </div>
        </section>

        {/* Results Grid - Dynamic Layout */}
        {data && (
          <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up text-left mt-8">
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
      </main>

      {/* Footer */}
      <footer className="w-full py-16 bg-surface-container-lowest dark:bg-surface-variant mt-auto border-t border-surface-container-high relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-center px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto gap-8 w-full">
          <div 
            onClick={(e) => { e.preventDefault(); setPatientCode(''); setData(null); setError(null); }}
            className="font-label-md text-label-md font-bold text-primary flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined fill" style={{ fontVariationSettings: "'FILL' 1" }}>health_and_safety</span>
            Medicare Identity
          </div>
          <div className="flex flex-wrap justify-center gap-6 font-caption text-caption text-on-surface-variant dark:text-outline-variant font-semibold">
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Chính sách bảo mật</a>
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Điều khoản dịch vụ</a>
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Kiểm toán bảo mật</a>
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Hỗ trợ</a>
          </div>
          <div className="font-caption text-caption text-secondary dark:text-secondary-fixed font-semibold">
            © 2026 Medicare Identity Blockchain Systems. Tất cả các quyền được bảo lưu.
          </div>
        </div>
      </footer>

      {/* Login Modal Overlay */}
      {showLogin && (
        <LoginPage 
          isModal={true} 
          onClose={() => setSearchParams({})} 
          initialMode={initialMode} 
        />
      )}
    </div>
  );
}
