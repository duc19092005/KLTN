import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import jsQR from 'jsqr';
import { API_URL } from '../../../utils/constants';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { LoginPage } from '../../auth';

function genderLabel(value) {
  if (value === 'MALE' || value === 'Nam') return 'Nam';
  if (value === 'FEMALE' || value === 'Nữ') return 'Nữ';
  if (value === 'OTHER' || value === 'Khác') return 'Khác';
  return value || 'Chưa rõ';
}

export default function PatientVerificationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expandedProof, setExpandedProof] = useState(null); // stores seq of expanded proof

  // QR scanner state: a single modal handles both image upload and camera scan.
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanRafRef = useRef(0);

  const showLogin = searchParams.get('login') === 'true';
  const initialMode = searchParams.get('tab') || 'staff';

  const handleVerify = async (e, overrideCode) => {
    if (e?.preventDefault) e.preventDefault();
    const code = (overrideCode ?? patientCode).trim();
    if (!code) return;
    setPatientCode(code.toUpperCase());

    setLoading(true);
    setError(null);
    setData(null);
    setExpandedProof(null);

    try {
      const response = await axios.get(`${API_URL}/patient-verify/${code.toUpperCase()}`);
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

  // Normalize whatever the QR encodes into a patient code we can look up.
  // Doctor-side QR encodes `KLTN-Visit-<visitCode>`; receptionist-side may encode `KLTN-Patient-<code>`.
  const normalizeQrToPatientCode = (raw) => {
    if (!raw) return '';
    const upper = String(raw).trim().toUpperCase();
    if (upper.startsWith('KLTN-PATIENT-')) return upper.slice('KLTN-PATIENT-'.length);
    if (upper.startsWith('KLTN-VISIT-')) return upper.slice('KLTN-VISIT-'.length);
    return upper;
  };

  const stopCamera = () => {
    if (scanRafRef.current) {
      cancelAnimationFrame(scanRafRef.current);
      scanRafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  const closeQrModal = () => {
    stopCamera();
    setQrError(null);
    setQrModalOpen(false);
  };

  // Decode a QR code from an uploaded image (JPG/PNG). PDFs are flagged with a hint
  // because rendering them client-side requires pdf.js, which is overkill for a demo.
  const handleQrFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setQrError(null);

    if (file.type === 'application/pdf') {
      setQrError('Đối với tệp PDF, vui lòng chụp ảnh trang chứa mã QR rồi tải ảnh lên.');
      event.target.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setQrError('Vui lòng chọn tệp ảnh (JPG, PNG) chứa mã QR.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Không đọc được ảnh.'));
        image.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (!code?.data) {
        setQrError('Không tìm thấy mã QR trong ảnh. Hãy chụp lại rõ nét hơn.');
        return;
      }
      const normalized = normalizeQrToPatientCode(code.data);
      setPatientCode(normalized);
      closeQrModal();
      setTimeout(() => handleVerify({ preventDefault: () => {} }, normalized), 0);
    } catch (err) {
      setQrError(err?.message || 'Không xử lý được tệp ảnh.');
    } finally {
      event.target.value = '';
    }
  };

  // Continuously scan video frames; stop as soon as a QR is decoded.
  const startCameraScan = async () => {
    setQrError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);

      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
          scanRafRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          const normalized = normalizeQrToPatientCode(code.data);
          setPatientCode(normalized);
          stopCamera();
          setQrModalOpen(false);
          setTimeout(() => handleVerify({ preventDefault: () => {} }, normalized), 0);
          return;
        }
        scanRafRef.current = requestAnimationFrame(tick);
      };
      scanRafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      setQrError(err?.name === 'NotAllowedError'
        ? 'Bạn đã từ chối quyền truy cập camera. Vui lòng cấp quyền và thử lại.'
        : (err?.message || 'Không mở được camera.'));
      setCameraActive(false);
    }
  };

  // Always release the camera when this page unmounts.
  useEffect(() => () => stopCamera(), []);

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
            Định danh Y tế
          </div>
          {/* Desktop Nav */}
          {/* Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSearchParams({ login: 'true', tab: 'staff' })}
              className="hidden md:flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg hover:translate-y-[-1px] shadow-[0px_4px_12px_rgba(70,86,162,0.2)] transition-all font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">login</span>
              Đăng nhập nhân sự
            </button>
            {/* Mobile Login Toggle */}
            <button 
              onClick={() => setSearchParams({ login: 'true', tab: 'staff' })}
              className="md:hidden text-primary flex items-center justify-center p-2 rounded-full hover:bg-slate-100"
              title="Đăng nhập nhân sự"
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
            <button
              type="button"
              onClick={() => { setQrError(null); setQrModalOpen(true); }}
              className="p-3 bg-surface-container-low text-primary rounded-lg hover:bg-primary-fixed transition-colors"
              title="Quét hoặc tải ảnh mã QR"
            >
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
                    <span>Giới tính: <strong>{genderLabel(data.patient.gender)}</strong></span>
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
                              Đã xác thực (khớp blockchain)
                            </span>
                          )}
                          {verification.status === 'tampered' && (
                            <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse shadow-sm shadow-rose-100">
                              <span className="material-symbols-outlined fill text-[14px]">gpp_maybe</span>
                              Bị sửa đổi (cảnh báo toàn vẹn)
                            </span>
                          )}
                          {verification.status === 'unanchored' && (
                            <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                              Chưa neo (đang chờ blockchain)
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
                                      alt="Ảnh quét da liễu"
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
                                  BẰNG CHỨNG MẬT MÃ TRÊN BLOCKCHAIN (BẰNG CHỨNG MERKLE)
                                </p>
                                <p>
                                  <span className="text-slate-500">Địa chỉ hợp đồng:</span> {API_URL.includes('localhost') ? '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' : 'AUDIT_ANCHOR'}
                                </p>
                                <p>
                                  <span className="text-slate-500">Mã lô:</span> {verification.proofDetails.batchId}
                                </p>
                                <p>
                                  <span className="text-slate-500">Số thứ tự (seq):</span> {verification.proofDetails.seq}
                                </p>
                                <p>
                                  <span className="text-slate-500">Hash bản ghi cục bộ:</span> {verification.proofDetails.entryHash}
                                </p>
                                <p>
                                  <span className="text-slate-500">Root Merkle trên chuỗi:</span> {verification.proofDetails.onChainRoot}
                                </p>
                                <div>
                                  <span className="text-slate-500">Đường dẫn Merkle:</span>
                                  <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-400">
                                    {verification.proofDetails.proof.map((pHash, idx) => (
                                      <li key={idx} className="break-all">{pHash}</li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="text-emerald-400 font-bold mt-3 pt-2.5 border-t border-slate-800 flex items-center gap-1.5">
                                  <span className="material-symbols-outlined text-[16px] text-emerald-400">verified</span>
                                  Trạng thái hợp đồng thông minh: đã xác thực và đã neo (toàn vẹn tuyệt đối)
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
            Định danh Y tế
          </div>
          <div className="flex flex-wrap justify-center gap-6 font-caption text-caption text-on-surface-variant dark:text-outline-variant font-semibold">
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Chính sách bảo mật</a>
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Điều khoản dịch vụ</a>
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Kiểm toán bảo mật</a>
            <a className="hover:text-primary dark:hover:text-primary-fixed underline transition-opacity duration-200" href="#" onClick={(e) => e.preventDefault()}>Hỗ trợ</a>
          </div>
          <div className="font-caption text-caption text-secondary dark:text-secondary-fixed font-semibold">
            © 2026 Hệ thống Blockchain Định danh Y tế. Tất cả các quyền được bảo lưu.
          </div>
        </div>
      </footer>

      {/* QR Scanner Modal: upload an image or scan via camera */}
      {qrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-4 animate-fade-in-up">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Cổng kiểm chứng</p>
                <h3 className="mt-0.5 text-lg font-black text-slate-900">Quét mã QR bệnh án</h3>
              </div>
              <button
                type="button"
                onClick={closeQrModal}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50"
                aria-label="Đóng"
              >
                Đóng
              </button>
            </div>

            <div className="p-6 space-y-5">
              <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                Bạn có thể tải ảnh QR (JPG/PNG) đã chụp từ tờ bệnh án in, hoặc dùng camera để quét trực tiếp. Sau khi giải mã thành công, hệ thống sẽ tự động kiểm chứng hồ sơ.
              </p>

              {/* Camera area */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="relative aspect-square w-full rounded-xl bg-slate-900 overflow-hidden">
                  <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                  <canvas ref={canvasRef} className="hidden" />
                  {!cameraActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 text-xs font-semibold gap-2">
                      <span className="material-symbols-outlined text-[40px]">photo_camera</span>
                      Camera chưa bật
                    </div>
                  )}
                  {cameraActive && (
                    <div className="absolute inset-6 border-2 border-emerald-400/80 rounded-xl pointer-events-none" />
                  )}
                </div>
                <div className="mt-3 flex gap-2">
                  {!cameraActive ? (
                    <button
                      type="button"
                      onClick={startCameraScan}
                      className="flex-1 rounded-xl bg-primary text-on-primary font-bold text-xs py-2.5 hover:translate-y-[-1px] transition-transform shadow-[0px_4px_10px_rgba(70,86,162,0.2)]"
                    >
                      Bật camera & quét
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="flex-1 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-700 py-2.5 hover:bg-slate-50"
                    >
                      Dừng camera
                    </button>
                  )}
                </div>
              </div>

              {/* Upload area */}
              <div className="rounded-2xl border-2 border-dashed border-primary-fixed/60 bg-surface-container-low/40 p-5 text-center">
                <span className="material-symbols-outlined text-primary text-[28px]">upload_file</span>
                <p className="mt-2 text-xs font-bold text-slate-700">Tải ảnh chứa mã QR</p>
                <p className="mt-0.5 text-[11px] font-semibold text-slate-500">JPG, PNG · Đối với PDF, hãy chụp ảnh trang QR</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleQrFile}
                  className="hidden"
                  id="qr-file-input"
                />
                <label
                  htmlFor="qr-file-input"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white border border-primary-fixed text-primary font-bold text-xs px-4 py-2 cursor-pointer hover:bg-surface-container-low transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">attach_file</span>
                  Chọn tệp ảnh
                </label>
              </div>

              {qrError && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                  <span>{qrError}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
