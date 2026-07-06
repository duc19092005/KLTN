import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import jsQR from 'jsqr';
import {
  AlertCircle,
  CalendarCheck,
  Camera,
  CheckCircle2,
  Clock3,
  Fingerprint,
  GitBranch,
  HeartPulse,
  History,
  Info,
  KeyRound,
  LockKeyhole,
  LogIn,
  Paperclip,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { API_URL } from '../../../utils/constants';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { LoginPage } from '../../auth';

function genderLabel(value) {
  if (value === 'MALE' || value === 'Nam') return 'Nam';
  if (value === 'FEMALE' || value === 'Nữ') return 'Nữ';
  return value || 'Chưa rõ';
}
function getVisitDepartmentName(visit) { return visit.department?.name || visit.department?.departmentCode || 'Chưa xếp phòng'; }
function getVisitStaffName(visit) {
  return visit.doctor?.fullName || visit.staff?.fullName || visit.staff?.user?.username || 'Chưa phân công';
}
function getPatientBirthDate(patient) {
  return patient?.birthDate || patient?.dateOfBirth || patient?.dob || null;
}
function getVisitDisplayDate(visit) {
  return visit?.completedAt || visit?.checkInAt || visit?.createdAt || null;
}
function getVisitConclusion(visit) {
  return visit?.conclusion || visit?.medicalConclusion || visit?.finalConclusion || null;
}
function parseAiDiagnosisResult(aiDiagnosis) {
  const raw = aiDiagnosis?.result || aiDiagnosis?.diagnosisResult || '';
  if (!raw) return { summary: 'Chưa có nội dung gợi ý.', probabilities: [], nextSteps: [], limitations: [] };
  try {
    const parsed = JSON.parse(raw);
    const analysis = parsed.analysis && typeof parsed.analysis === 'object' ? parsed.analysis : parsed;
    return {
      summary: analysis.summary || parsed.summary || analysis.diagnosis || parsed.diagnosis || 'AI đã phân tích nhưng chưa có tóm tắt.',
      probabilities: Array.isArray(analysis.diagnosticProbabilities)
        ? analysis.diagnosticProbabilities.slice(0, 3)
        : [],
      nextSteps: Array.isArray(analysis.recommendedNextSteps)
        ? analysis.recommendedNextSteps.slice(0, 3)
        : [],
      limitations: Array.isArray(analysis.limitations)
        ? analysis.limitations.slice(0, 3)
        : (analysis.limitations ? [analysis.limitations] : []),
      disclaimer: analysis.disclaimer || parsed.disclaimer || '',
    };
  } catch {
    return { summary: raw, probabilities: [], nextSteps: [], limitations: [] };
  }
}
function formatConfidenceValue(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  const percent = raw <= 1 ? raw * 100 : raw;
  return `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
}
function conclusionField(conclusion, ...keys) {
  for (const key of keys) {
    const value = conclusion?.[key];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return null;
}

export default function PatientVerificationPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patientCode, setPatientCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expandedProof, setExpandedProof] = useState(null); // stores seq of expanded proof
  const [verifyingVisits, setVerifyingVisits] = useState({});

  const handleVerifyConclusion = async (conclusionId, visitId) => {
    if (verifyingVisits[conclusionId]) return;
    setVerifyingVisits((prev) => ({ ...prev, [conclusionId]: true }));
    try {
      const response = await axios.get(`${API_URL}/patient-verify/conclusion/${conclusionId}/verify`);
      const verificationResult = response.data.success !== undefined ? response.data.data : response.data;
      
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          visits: prev.visits.map((v) => {
            if (v.conclusion?.id === conclusionId || v.id === visitId || v.visitCode === visitId) {
              return {
                ...v,
                blockchainVerification: verificationResult,
              };
            }
            return v;
          }),
        };
      });
    } catch (err) {
      console.error(err);
      alert('Không thể xác thực bản ghi này trên blockchain: ' + (err.response?.data?.message || err.message));
    } finally {
      setVerifyingVisits((prev) => ({ ...prev, [conclusionId]: false }));
    }
  };

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
    <div className="min-h-screen flex flex-col relative hero-bg text-[#020617] antialiased">
      <style dangerouslySetInnerHTML={{__html: `
        .hero-bg {
            background: radial-gradient(circle at 50% -20%, #cffafe 0%, #f8fafc 60%);
        }
        .glass-panel {
            background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.4) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
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
      <header className="fixed top-0 w-full z-40 bg-surface/80 dark:bg-surface-container-lowest/80 backdrop-blur-md shadow-sm">
        <div className="flex justify-between items-center px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto h-20 w-full">
          {/* Brand */}
          <div 
            onClick={(e) => { e.preventDefault(); setPatientCode(''); setData(null); setError(null); }}
            className="font-headline-md text-headline-md font-bold text-primary dark:text-inverse-primary flex items-center gap-2 cursor-pointer"
          >
            <HeartPulse className="h-6 w-6" strokeWidth={2.25} />
            Định danh Y tế
          </div>
          {/* Desktop Nav */}
          {/* Actions */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSearchParams({ login: 'true', tab: 'staff' })}
              className="hidden md:flex items-center gap-2 bg-primary text-on-primary font-label-md text-label-md px-6 py-2.5 rounded-lg  shadow-sm transition-colors font-bold"
            >
              <LogIn className="h-[18px] w-[18px]" />
              Đăng nhập nhân sự
            </button>
            {/* Mobile Login Toggle */}
            <button 
              onClick={() => setSearchParams({ login: 'true', tab: 'staff' })}
              className="md:hidden text-primary flex items-center justify-center p-2 rounded-full hover:bg-slate-100"
              title="Đăng nhập nhân sự"
            >
              <LogIn className="h-6 w-6" />
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
          <form onSubmit={handleVerify} className="w-full max-w-2xl mx-auto bg-surface-container-lowest rounded-xl p-2 pl-6 shadow-sm border border-outline-variant/30 flex items-center gap-4 transition-colors  focus-within:border-primary-fixed animate-fade-in-up delay-300">
            <KeyRound className="h-5 w-5 text-outline" />
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
              <QrCode className="h-5 w-5" />
            </button>
            <button 
              disabled={loading || !patientCode.trim()} 
              className="bg-primary text-on-primary font-label-md text-label-md px-8 py-4 rounded-lg  transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold"
              type="submit"
            >
              {loading ? <LoadingIndicator size="sm" tone="white" /> : 'Kiểm chứng'}
            </button>
          </form>

          {error && (
            <div className="mt-6 w-full max-w-2xl mx-auto p-4 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl text-left flex items-center gap-2 animate-pulse">
              <AlertCircle className="h-[18px] w-[18px] text-rose-500" />
              {error}
            </div>
          )}

          {/* Security Badges */}
          <div className="flex flex-wrap justify-center items-center gap-6 mt-12 opacity-80 animate-fade-in-up delay-400">
            <div className="flex items-center gap-2 font-label-md text-label-md text-secondary font-bold">
              <LockKeyhole className="h-5 w-5" />
              Mã hóa AES-256
            </div>
            <div className="w-1 h-1 rounded-full bg-outline-variant"></div>
            <div className="flex items-center gap-2 font-label-md text-label-md text-secondary font-bold">
              <ShieldCheck className="h-5 w-5" />
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
                <div className="w-12 h-12 rounded-full bg-[#f0f3ff] text-[#0891b2] flex items-center justify-center font-bold text-lg border border-[#acc7ff]">
                  {data.patient.fullName.charAt(0)}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Bệnh nhân</span>
                  <h3 className="text-lg font-bold text-[#020617]">{data.patient.fullName}</h3>
                  <div className="flex gap-4 text-xs font-semibold text-[#475569] mt-1">
                    <span>Mã số: <strong className="text-[#0891b2]">{data.patient.patientCode}</strong></span>
                    <span>•</span>
                    <span>Giới tính: <strong>{genderLabel(data.patient.gender)}</strong></span>
                    <span>•</span>
                    <span>Sinh: <strong>{getPatientBirthDate(data.patient) ? new Date(getPatientBirthDate(data.patient)).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}</strong></span>
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
              <h3 className="text-lg font-bold text-[#020617] mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-[#0891b2]" />
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
                    const aiDiagnoses = (visit.aiDiagnoses?.length ? visit.aiDiagnoses : (visit.aiDiagnosis ? [visit.aiDiagnosis] : []));
                    
                    return (
                      <div key={visit.id || visit.visitCode} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-colors hover:border-slate-300">
                        
                        {/* Card Header */}
                        <div className="bg-[#f0f3ff] px-6 py-4 border-b border-[#c2c6d4]/30 flex flex-wrap justify-between items-center gap-3">
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-[#e7eeff] text-[#0891b2] rounded-xl flex items-center justify-center">
                              <CalendarCheck className="h-5 w-5" />
                            </span>
                            <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Thời gian khám</div>
                              <span className="text-sm font-bold text-[#020617]">
                                {getVisitDisplayDate(visit) ? new Date(getVisitDisplayDate(visit)).toLocaleString('vi-VN') : 'Chưa cập nhật'}
                              </span>
                            </div>
                          </div>

                          {/* On-Chain Badge */}
                          {verification.status === 'verified' && (
                            <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold rounded-full flex items-center gap-1.5 shadow-sm">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Đã xác thực (khớp blockchain)
                            </span>
                          )}
                          {verification.status === 'tampered' && (
                            <span className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse shadow-sm">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Bị sửa đổi (cảnh báo toàn vẹn)
                            </span>
                          )}
                          {verification.status === 'unverified' && (
                            <button
                              type="button"
                              disabled={verifyingVisits[visit.conclusion?.id]}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVerifyConclusion(visit.conclusion?.id, visit.id || visit.visitCode);
                              }}
                              className="px-3 py-1.5 bg-[#e7eeff] border border-[#acc7ff] text-[#0891b2] text-xs font-bold rounded-full flex items-center gap-1.5 hover:bg-[#acc7ff]/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {verifyingVisits[visit.conclusion?.id] ? (
                                <span className="flex items-center gap-1">
                                  Đang xác thực...
                                </span>
                              ) : (
                                'Chưa xác thực - Nhấn để xác thực'
                              )}
                            </button>
                          )}
                          {verification.status === 'unanchored' && (
                            <span className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 text-xs font-bold rounded-full flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5" />
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
                              <p className="text-sm font-bold text-[#020617]">
                                Bác sĩ: {getVisitStaffName(visit)}
                              </p>
                              <p className="text-xs font-semibold text-[#475569] mt-0.5">
                                Phòng: {getVisitDepartmentName(visit)}
                              </p>
                            </div>

                            {getVisitConclusion(visit) ? (
                              <div className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 to-white p-4 shadow-sm">
                                <span className="text-[10px] font-black text-cyan-700 uppercase tracking-widest block">
                                  Hồ sơ chẩn đoán chính thức
                                </span>
                                <div className="mt-3 space-y-3">
                                  <DiagnosisInfo label="Chẩn đoán xác định" value={conclusionField(getVisitConclusion(visit), 'finalDiagnosis', 'diagnosis', 'summary')} highlight />
                                  <DiagnosisInfo label="Hướng điều trị" value={conclusionField(getVisitConclusion(visit), 'treatmentPlan', 'plan')} />
                                  <DiagnosisInfo label="Đơn thuốc / chỉ định" value={conclusionField(getVisitConclusion(visit), 'prescription')} />
                                  <DiagnosisInfo label="Dặn dò tái khám" value={conclusionField(getVisitConclusion(visit), 'followUpNote', 'followUp')} />
                                  <DiagnosisInfo label="Ghi chú bác sĩ" value={conclusionField(getVisitConclusion(visit), 'doctorNote', 'notes')} fallback="Không có ghi chú thêm" />
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl text-amber-700 text-xs font-bold flex items-center gap-1.5">
                                <Info className="h-4 w-4" />
                                Chưa có kết luận chính thức từ bác sĩ.
                              </div>
                            )}
                          </div>

                          {/* AI Dermatological Diagnosis */}
                          <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                              Gợi ý AI hỗ trợ bác sĩ
                            </span>

                            {aiDiagnoses.length ? (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-[11px] font-black text-cyan-700">{aiDiagnoses.length} bản phân tích</span>
                                  <span className="rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-black text-cyan-700">Mới nhất trước</span>
                                </div>
                                <div className="space-y-2">
                                  {aiDiagnoses.map((aiDiagnosis, index) => (
                                    <AiDiagnosisSummary key={aiDiagnosis.id || index} aiDiagnosis={aiDiagnosis} index={index} />
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs font-medium text-slate-400 italic">
                                Không có bản phân tích AI được công bố cho lượt khám này.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Footer: Cryptographic hashes */}
                        {getVisitConclusion(visit)?.hash256 && (
                          <div className="border-t border-slate-100 bg-[#f9f9ff]/30 px-6 py-4 flex flex-col gap-3">
                            <div className="flex flex-wrap justify-between items-center gap-2">
                              <span className="text-xs font-semibold text-[#475569] flex items-center gap-1">
                                <Fingerprint className="h-4 w-4 text-[#727784]" />
                                Hash chẩn đoán: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono text-slate-800 break-all">{getVisitConclusion(visit).hash256}</code>
                              </span>
                              
                              {verification.status !== 'unanchored' && (
                                <button
                                  type="button"
                                  onClick={() => toggleProof(verification.seq)}
                                  className="text-xs font-bold text-[#0891b2] hover:underline flex items-center gap-1 active:scale-95"
                                >
                                  {expandedProof === verification.seq ? 'Ẩn chi tiết Blockchain ▴' : 'Xem chi tiết Blockchain ▾'}
                                </button>
                              )}
                            </div>

                            {/* Expanded cryptographic details */}
                            {expandedProof === verification.seq && verification.proofDetails && (
                              <div className="mt-3 p-5 bg-[#1e293b] text-slate-300 font-mono text-[11px] rounded-xl space-y-2 border border-slate-800 overflow-x-auto shadow-inner">
                                <p className="text-[#38bdf8] font-bold border-b border-slate-800 pb-1.5 mb-3 flex items-center gap-1.5">
                                  <GitBranch className="h-4 w-4 text-[#38bdf8]" />
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
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
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
            <HeartPulse className="h-5 w-5" strokeWidth={2.25} />
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
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
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
                      <Camera className="h-10 w-10" />
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
                      className="flex-1 rounded-xl bg-primary text-on-primary font-bold text-xs py-2.5  transition-transform shadow-sm"
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
                <Upload className="mx-auto h-7 w-7 text-primary" />
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
                  <Paperclip className="h-4 w-4" />
                  Chọn tệp ảnh
                </label>
              </div>

              {qrError && (
                <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0" />
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
function DiagnosisInfo({ label, value, fallback = 'Chưa ghi nhận', highlight = false }) {
  return (
    <div>
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <p className={`mt-0.5 whitespace-pre-wrap text-xs leading-relaxed ${highlight ? 'font-black text-slate-950' : 'font-semibold text-slate-600'}`}>
        {value || fallback}
      </p>
    </div>
  );
}

function AiDiagnosisSummary({ aiDiagnosis, index = 0 }) {
  const [expanded, setExpanded] = useState(index === 0);
  const parsed = parseAiDiagnosisResult(aiDiagnosis);
  const primaryProbability = parsed.probabilities[0];
  const confidence = formatConfidenceValue(aiDiagnosis.confidence);

  return (
    <div className="min-w-0 flex-1 rounded-xl border border-cyan-100 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start justify-between gap-3 p-3 text-left hover:bg-cyan-50/40 transition-colors"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-600">Phân tích AI #{index + 1}</p>
            <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[10px] font-black text-slate-500">{aiDiagnosis.aiModel?.modelName || 'AI'}</span>
            {confidence && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">{confidence}</span>}
          </div>
          <p className="mt-1 line-clamp-3 text-xs font-semibold leading-relaxed text-slate-700">
            {parsed.summary}
          </p>
          {primaryProbability && (
            <p className="mt-2 text-[11px] font-bold text-cyan-700">
              Gợi ý chính: {primaryProbability.condition} {primaryProbability.probability != null ? `(${primaryProbability.probability}%)` : ''}
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black text-cyan-700">
          {expanded ? 'Thu gọn ▲' : 'Chi tiết ▼'}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-cyan-50 bg-slate-50/60 p-3 animate-fade-in-up">
          {parsed.probabilities.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Khả năng gợi ý</p>
              {parsed.probabilities.map((item, index) => (
                <div key={`${item.condition || index}`} className="rounded-lg border border-slate-100 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800">{item.condition || 'Chẩn đoán gợi ý'}</span>
                    {item.probability != null && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-700">{item.probability}%</span>}
                  </div>
                  {item.reason && <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{item.reason}</p>}
                </div>
              ))}
            </div>
          )}

          {parsed.nextSteps.length > 0 && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Khuyến nghị tiếp theo</p>
              <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] font-medium leading-relaxed text-slate-600">
                {parsed.nextSteps.map((step, index) => <li key={index}>{step}</li>)}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Thông tin mô hình</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-600">
              {aiDiagnosis.aiModel?.modelName || 'AI'} {aiDiagnosis.aiModel?.modelVersion ? `(v${aiDiagnosis.aiModel.modelVersion})` : ''}
              {aiDiagnosis.createdAt ? ` · ${new Date(aiDiagnosis.createdAt).toLocaleString('vi-VN')}` : ''}
            </p>
            <p className="mt-1 text-xs font-bold text-[#006b5b]">
              Độ tin cậy: {confidence || 'Theo từng gợi ý bên trên'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
