import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorVisitService } from '../apis/doctorVisitService';
import { DOCTOR_NAV_ITEMS, navigateDoctor } from '../constants/navigation';
import { departmentService } from '../../admin/apis/departmentService';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { clinicalDecisionService } from '../../medical-order/apis/clinicalDecisionService';
import { aiModelService } from '../../admin/apis/aiModelService';
import { useToast } from '../../../providers/ToastProvider';

const STATUS = {
  WAITING: { label: 'Chờ khám', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400' },
  IN_PROGRESS: { label: 'Đang khám', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  WAITING_TEST_RESULT: { label: 'Chờ kết quả cận lâm sàng', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  WAITING_CONCLUSION: { label: 'Chờ kết luận', color: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  COMPLETED: { label: 'Hoàn tất', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  CANCELLED: { label: 'Đã hủy', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};

const FILTERS = [
  { id: '', label: 'Tất cả' },
  { id: 'WAITING', label: 'Chờ khám' },
  { id: 'IN_PROGRESS', label: 'Đang khám' },
  { id: 'WAITING_TEST_RESULT', label: 'Chờ XN/Cận lâm sàng' },
  { id: 'WAITING_CONCLUSION', label: 'Chờ kết luận' },
  { id: 'COMPLETED', label: 'Hoàn tất' },
];

const emptyOrder = { targetDepartmentId: '', orderType: '', priority: 'NORMAL', clinicalNote: '' };
const emptyConclusion = { finalDiagnosis: '', treatmentPlan: '', prescription: '', followUpNote: '', doctorNote: '' };

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function formatDate(value) { return value ? new Date(value).toLocaleDateString('vi-VN') : 'N/A'; }
function formatTime(value) { return value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'; }
function parseAiResult(value) { try { return JSON.parse(value || '{}'); } catch { return { summary: value }; } }
function getVisitDepartmentName(visit) { return visit?.department?.name || visit?.department?.departmentCode || 'N/A'; }
function getVisitStaffName(visit) { return visit?.staff?.fullName || visit?.staff?.user?.username || 'N/A'; }

// Function to print doctor's conclusion with QR code
function printConclusionWithQR(visit, conclusion, qrData) {
  const printWindow = window.open('', '_blank');
  // Use a free QR code service to generate the QR from the text data.
  // This avoids needing extra npm packages and works offline-free in the browser.
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
  const qrCodeHtml = `<div style="text-align: center; margin-top: 20px; padding: 15px; border: 2px solid #10b981; border-radius: 10px; background: #f0fdf4;">
    <h3 style="color: #065f46; font-family: Arial, sans-serif; margin-bottom: 15px;">Mã xác minh bệnh án</h3>
    <img src="${qrUrl}" alt="QR Code" style="width: 150px; height: 150px;" />
    <p style="color: #065f46; font-size: 11px; margin-top: 10px; font-family: monospace;">${qrData}</p>
    <p style="color: #065f46; font-size: 12px; margin-top: 10px;">Quét để xác minh tính xác thực của hồ sơ</p>
  </div>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bệnh án - ${visit?.visitCode}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
        .header h1 { color: #065f46; margin: 0; }
        .header h2 { color: #065f46; font-size: 14px; margin-top: 5px; }
        .section { margin-bottom: 20px; }
        .section h3 { color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-top: 0; }
        .label { font-weight: bold; color: #64748b; margin-top: 10px; display: block; font-size: 12px; }
        .value { color: #1e293b; margin-top: 5px; white-space: pre-wrap; font-size: 13px; }
        .meta { color: #64748b; font-size: 11px; margin-top: 5px; }
        @media print {
          .no-print { display: none; }
          .print-area { margin: 0; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="print-area">
        <div class="header">
          <h1>PHÒNG KHÁM BỆNH VIỆN KLTN</h1>
          <h2>Hệ thống quản lý bệnh án điện tử</h2>
        </div>
        
        <div class="section">
          <h3>THÔNG TIN BỆNH NHÂN</h3>
          <span class="label">Họ tên:</span>
          <span class="value">${visit?.patient?.fullName || 'N/A'}</span>
          <span class="label">Mã bệnh nhân:</span>
          <span class="value">${visit?.patient?.patientCode || 'N/A'}</span>
          <span class="label">Ngày sinh:</span>
          <span class="value">${visit?.patient?.birthDate ? new Date(visit.patient.birthDate).toLocaleDateString('vi-VN') : 'N/A'}</span>
          <span class="label">Giới tính:</span>
          <span class="value">${visit?.patient?.gender || 'N/A'}</span>
          <span class="label">Số điện thoại:</span>
          <span class="value">${visit?.patient?.phone || 'N/A'}</span>
          <span class="label">CCCD:</span>
          <span class="value">${visit?.patient?.citizenId || 'N/A'}</span>
        </div>
        
        <div class="section">
          <h3>THÔNG TIN LƯỢT KHÁM</h3>
          <span class="label">Mã lượt khám:</span>
          <span class="value">${visit?.visitCode || 'N/A'}</span>
          <span class="label">Ngày khám:</span>
          <span class="value">${visit?.checkInAt ? new Date(visit.checkInAt).toLocaleDateString('vi-VN') + ' ' + new Date(visit.checkInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
          <span class="label">Phòng khám:</span>
          <span class="value">${getVisitDepartmentName(visit)}</span>
          <span class="label">Bác sĩ:</span>
          <span class="value">${getVisitStaffName(visit)}</span>
        </div>
        
        <div class="section">
          <h3>KẾT LUẬN BÁC SĨ</h3>
          <span class="label">Chẩn đoán xác định:</span>
          <span class="value">${conclusion?.finalDiagnosis || 'Chưa có chẩn đoán'}</span>
          <span class="label">Hướng điều trị:</span>
          <span class="value">${conclusion?.treatmentPlan || 'Chưa có hướng điều trị'}</span>
          <span class="label">Toa thuốc:</span>
          <span class="value">${conclusion?.prescription || 'Chưa có toa thuốc'}</span>
          <span class="label">Lời dặn:</span>
          <span class="value">${conclusion?.followUpNote || 'Chưa có lời dặn'}</span>
        </div>
        
        ${qrCodeHtml}
        
        <div class="section no-print" style="text-align: center; margin-top: 30px; padding: 20px;">
          <button onclick="window.print()" style="background: #10b981; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin: 0 5px;">
            🖨️ In hồ sơ
          </button>
          <button onclick="window.close()" style="background: #64748b; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin: 0 5px;">
            Đóng
          </button>
        </div>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export default function DoctorQueuePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(null);
  const [decision, setDecision] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('WAITING');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [orderForms, setOrderForms] = useState([{ ...emptyOrder }]);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [conclusionForm, setConclusionForm] = useState(emptyConclusion);
  const [selectedAiId, setSelectedAiId] = useState('');
  const [selectedAiModelId, setSelectedAiModelId] = useState('');

  // States for AI Model Rating Optional Countdown Popup
  const [showRatingPopup, setShowRatingPopup] = useState(false);
  const [ratingModelId, setRatingModelId] = useState('');
  const [ratingModelName, setRatingModelName] = useState('');
  const [countdown, setCountdown] = useState(10);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [ratingSelected, setRatingSelected] = useState(null);
  const [pauseCountdown, setPauseCountdown] = useState(false);

  const loadVisits = async () => {
    setLoading(true);
    try {
      const res = await doctorVisitService.list(filter ? { status: filter, limit: 50 } : { limit: 50 });
      const items = getItems(res.data);
      setVisits(items);
      setActiveVisit((current) => current ? (items.find((v) => v.id === current.id) || items[0] || null) : (items[0] || null));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được hàng đợi khám');
    } finally { setLoading(false); }
  };

  const loadDecision = async (visitId) => {
    if (!visitId) return;
    setDetailLoading(true);
    try {
      const res = await clinicalDecisionService.getVisitResults(visitId);
      setDecision(res.data);
      const latestAi = res.data?.aiDiagnoses?.[0];
      setSelectedAiId(latestAi?.id || '');

      // Tự động định tuyến bước thông minh dựa trên trạng thái bệnh án
      const currentStatus = res.data?.status;
      if (currentStatus === 'IN_PROGRESS') setActiveStep(1);
      else if (currentStatus === 'WAITING_TEST_RESULT' || currentStatus === 'WAITING_CONCLUSION') setActiveStep(2);
      else if (currentStatus === 'COMPLETED') setActiveStep(3);

      if (res.data?.finalConclusion) {
        setConclusionForm({
          finalDiagnosis: res.data.finalConclusion.finalDiagnosis || '',
          treatmentPlan: res.data.finalConclusion.treatmentPlan || '',
          prescription: res.data.finalConclusion.prescription || '',
          followUpNote: res.data.finalConclusion.followUpNote || '',
          doctorNote: res.data.finalConclusion.doctorNote || '',
        });
      } else setConclusionForm(emptyConclusion);
    } catch (err) {
      setDecision(null);
    } finally { setDetailLoading(false); }
  };

  useEffect(() => { loadVisits(); }, [filter]);
  useEffect(() => { if (activeVisit?.id) { loadDecision(activeVisit.id); setShowWorkflowModal(false); } }, [activeVisit?.id]);
  useEffect(() => {
    (async () => {
      try {
        // Chỉ load các phòng cận lâm sàng có thể nhận chỉ định.
        const res = await departmentService.list({ canReceiveOrders: true, status: 'ACTIVE', limit: 100 });
        const items = getItems(res.data).filter((department) => ['LABORATORY', 'IMAGING'].includes(department.type));
        console.log('[DoctorQueue] paraclinical departments loaded:', items.length, items.map(d => d.name));

        if (!items.length) {
          toast.info('Chưa có phòng xét nghiệm/chẩn đoán hình ảnh nào được bật "Nhận phiếu chỉ định".', 8000);
        }
        setDepartments(items);
      } catch (err) {
        console.error('[DoctorQueue] Lỗi tải danh sách khoa/phòng:', err?.response?.status, err?.response?.data || err.message);
        toast.error('Không thể tải danh sách khoa/phòng. Vui lòng thử lại.');
      }
    })();
  }, []);
  useEffect(() => { aiModelService.list({ type: 'API' }).then((res) => { const items = getItems(res.data); setAiModels(items); setSelectedAiModelId((current) => current || items[0]?.id || ''); }).catch(() => { }); }, []);

  const filteredVisits = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return visits;
    return visits.filter((visit) => [visit.visitCode, visit.patient?.patientCode, visit.patient?.fullName, visit.patient?.phone, visit.patient?.citizenId, getVisitDepartmentName(visit), getVisitStaffName(visit)].filter(Boolean).some((field) => field.toLowerCase().includes(text)));
  }, [query, visits]);

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredVisits.length / pageSize));
  const pagedVisits = useMemo(() => filteredVisits.slice((page - 1) * pageSize, page * pageSize), [filteredVisits, page]);
  useEffect(() => { setPage(1); }, [filter, query]);

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true);
    try {
      const validOrders = orderForms.filter((item) => item.orderType.trim() && item.targetDepartmentId);
      if (!validOrders.length) {
        toast.error('Vui lòng nhập ít nhất 1 phiếu chỉ định hợp lệ.');
        return;
      }
      const duplicateDepartmentId = validOrders.find((item, index) => validOrders.findIndex((other) => other.targetDepartmentId === item.targetDepartmentId) !== index)?.targetDepartmentId;
      if (duplicateDepartmentId) {
        const duplicatedDepartment = departments.find((department) => department.id === duplicateDepartmentId);
        toast.error(`Bạn đã chọn khoa/phòng "${duplicatedDepartment?.name || duplicateDepartmentId}" rồi. Vui lòng chọn khoa/phòng khác để tránh trùng phiếu chỉ định.`);
        return;
      }
      await Promise.all(validOrders.map((item) => medicalOrderService.create({ ...item, visitId: activeVisit.id, targetDepartmentId: item.targetDepartmentId || undefined })));
      toast.success('Đã tạo và gửi chỉ định cận lâm sàng thành công.');
      setOrderForms([{ ...emptyOrder }]);
      await Promise.all([loadVisits(), loadDecision(activeVisit.id)]);
    } catch (err) { toast.error(err.response?.data?.message || 'Không tạo được chỉ định'); }
    finally { setBusy(false); }
  };

  const startVisit = async (targetVisit = activeVisit) => {
    if (!targetVisit) return;
    setActiveVisit(targetVisit);
    setBusy(true);
    try {
      await doctorVisitService.updateStatus(targetVisit.id, 'IN_PROGRESS');
      toast.success('Đã tiếp nhận bệnh nhân. Hệ thống chuyển sang Bước 1: Chỉ định cận lâm sàng.');
      await Promise.all([loadVisits(), loadDecision(targetVisit.id)]);
      setActiveStep(1);
      setShowWorkflowModal(true);
    } catch (err) { toast.error(err.response?.data?.message || 'Không thể bắt đầu khám'); }
    finally { setBusy(false); }
  };

  const generateAi = async () => {
    if (!activeVisit) return;
    setBusy(true);
    try {
      const res = await clinicalDecisionService.generateAiAnalysis({ visitId: activeVisit.id, aiModelId: selectedAiModelId || undefined });
      setSelectedAiId(res.data.id);
      toast.success('AI đã phân tích dữ liệu lâm sàng thành công.');
      await loadDecision(activeVisit.id);
    } catch (err) { toast.error(err.response?.data?.message || 'Không tạo được phân tích AI'); }
    finally { setBusy(false); }
  };

  // Finalizing a conclusion anchors it on-chain. The endpoint requires a step-up SESSION; if none
  // is active the axios interceptor transparently prompts one face scan and replays this request,
  // so the doctor scans once per session rather than once per conclusion.
  const submitConclusion = async (event) => {
    event.preventDefault();
    if (!activeVisit) return;
    setBusy(true);
    try {
      await clinicalDecisionService.createConclusion({ ...conclusionForm, visitId: activeVisit.id, aiDiagnosisId: selectedAiId || undefined });
      toast.success('Đã đóng hồ sơ bệnh án và hoàn tất lượt khám của bệnh nhân.');
      setShowWorkflowModal(false);

      // Check if AI Model was used and can be rated
      const activeDiag = decision?.aiDiagnoses?.find((d) => d.id === selectedAiId);
      if (activeDiag?.aiModel) {
        setRatingModelId(activeDiag.aiModel.id);
        setRatingModelName(activeDiag.aiModel.modelName);
        setShowRatingPopup(true);
        setCountdown(10);
        setRatingSelected(null);
        setRatingFeedback('');
        setPauseCountdown(false);
      } else {
        await loadVisits();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không lưu được kết luận cuối');
      await loadVisits();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!showRatingPopup || pauseCountdown) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setShowRatingPopup(false);
          loadVisits();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showRatingPopup, pauseCountdown]);

  const handleRateModel = async (satisfied) => {
    try {
      setBusy(true);
      await aiModelService.rate(ratingModelId, {
        satisfied,
        feedback: satisfied ? undefined : ratingFeedback,
      });
      toast.success('Cảm ơn bác sĩ đã đánh giá mô hình AI!');
    } catch (err) {
      toast.error('Không gửi được đánh giá.');
    } finally {
      setBusy(false);
      setShowRatingPopup(false);
      setRatingSelected(null);
      setRatingFeedback('');
      setPauseCountdown(false);
      await loadVisits();
    }
  };

  return (
    <DashboardLayout user={user} navItems={DOCTOR_NAV_ITEMS} activeItem="queue" onNavigate={(id) => navigateDoctor(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6 pb-12">
        {/* Banner tiêu đề */}
        <section className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-white via-slate-50 to-cyan-50/30 p-6 shadow-sm">
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-md">Doctor Workspace</span>
              <h1 className="mt-2 text-2xl font-black text-slate-900 tracking-tight">Hàng đợi khám & Quản lý điều trị</h1>
              <p className="mt-1 text-xs text-slate-500">Tiếp nhận, chỉ định, xem kết quả và hoàn tất điều trị.</p>
            </div>
            <button onClick={loadVisits} className="self-start md:self-auto h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-2 transition-colors">
              {loading ? <LoadingIndicator size="sm" /> : <span>Làm mới danh sách</span>}
            </button>
          </div>
        </section>



        {/* Danh sách hàng đợi */}
        <QueueList query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} loading={loading} visits={pagedVisits} activeVisit={activeVisit} setActiveVisit={setActiveVisit} page={page} setPage={setPage} totalPages={totalPages} totalItems={filteredVisits.length} busy={busy} onStart={startVisit} onOpenWorkflow={(visit) => { setActiveVisit(visit); setShowWorkflowModal(true); }} />

        {/* Modal Quy trình khám Step-by-Step Chuẩn hóa */}
        {showWorkflowModal && activeVisit && (
          <WorkflowModal
            visit={decision || activeVisit}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onClose={() => setShowWorkflowModal(false)}
            orderProps={{ forms: orderForms, setForms: setOrderForms, departments, existingOrders: decision?.medicalOrders || [], onSubmit: submitOrder, busy }}
            resultProps={{ orders: decision?.medicalOrders || [] }}
            aiProps={{ diagnoses: decision?.aiDiagnoses || [], aiModels, selectedAiModelId, setSelectedAiModelId, selectedAiId, setSelectedAiId, onGenerate: generateAi, busy }}
            conclusionProps={{ form: conclusionForm, setForm: setConclusionForm, onSubmit: submitConclusion, busy, completed: Boolean(decision?.finalConclusion), activeVisit, activeConclusion: conclusionForm }}
          />
        )}

        {/* Optional Countdown Rating Popup */}
        {showRatingPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md animate-fadeIn p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-md">Đánh giá Mô hình AI</span>
                {!pauseCountdown && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                    Tự động đóng trong {countdown}s
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-950">Bác sĩ có hài lòng với kết quả của mô hình?</h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Mô hình: <span className="text-slate-800 font-bold">{ratingModelName}</span>
                </p>
              </div>

              {ratingSelected === null ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleRateModel(true)}
                    className="flex flex-col items-center justify-center py-4 px-3 rounded-2xl border border-cyan-100 bg-cyan-50/70 hover:bg-cyan-50 text-cyan-800 font-bold transition-colors text-xs gap-1.5 active:scale-95"
                  >
                    Hài lòng (Có)
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRatingSelected('NO');
                      setPauseCountdown(true);
                    }}
                    className="flex flex-col items-center justify-center py-4 px-3 rounded-2xl border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-800 font-bold transition-colors text-xs gap-1.5 active:scale-95"
                  >
                    Không chính xác
                  </button>
                </div>
              ) : (
                <div className="space-y-4 animate-slideUp">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Lý do mô hình đánh giá chưa chuẩn xác <span className="text-rose-500">*</span></label>
                    <textarea
                      value={ratingFeedback}
                      onChange={(e) => setRatingFeedback(e.target.value)}
                      placeholder="VD: Mô hình bỏ sót bóng mờ ở đáy phổi trái..."
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-colors font-medium"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRatingSelected(null);
                        setPauseCountdown(false);
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={busy || !ratingFeedback.trim()}
                      onClick={() => handleRateModel(false)}
                      className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700 disabled:opacity-50"
                    >
                      Gửi phản hồi
                    </button>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowRatingPopup(false);
                    setRatingSelected(null);
                    setRatingFeedback('');
                    setPauseCountdown(false);
                    loadVisits();
                  }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Bỏ qua đánh giá (Đóng)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ==========================================
   SUB-COMPONENTS CHUẨN HÓA UI/UX
   ========================================== */

function QueueList({ query, setQuery, filter, setFilter, loading, visits, activeVisit, setActiveVisit, page, setPage, totalPages, totalItems, busy, onStart, onOpenWorkflow }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">Danh sách hàng đợi lâm sàng</h2>

          </div>
          <div className="px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-100 text-xs font-bold text-cyan-700 w-fit">
            Tổng số: {totalItems} ca bệnh
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base"></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nhập tên bệnh nhân, mã BN, CCCD hoặc số điện thoại..." className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-11 pr-4 text-xs font-medium outline-none focus:bg-white focus:border-cyan-500 focus:ring-4 focus:ring-cyan-50/50 transition-colors" />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin lg:max-w-[620px]">
            {FILTERS.map((item) => (
              <button key={item.id || 'ALL'} onClick={() => setFilter(item.id)} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${filter === item.id ? 'bg-cyan-600 text-white border-cyan-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="ui-table min-w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-[10px] uppercase tracking-wider text-slate-400 font-black">
              <th className="px-5 py-3">Bệnh nhân</th>
              <th className="px-5 py-3">Mã lượt</th>
              <th className="px-5 py-3">Phòng khám</th>
              <th className="px-5 py-3">Tiếp nhận</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-10"><LoadingIndicator size="md" label="Đang cập nhật danh sách..." /></td></tr>
            ) : visits.map((visit) => (
              <VisitRow key={visit.id} visit={visit} active={activeVisit?.id === visit.id} busy={busy} onSelect={() => setActiveVisit(visit)} onStart={() => onStart(visit)} onOpenWorkflow={() => onOpenWorkflow(visit)} />
            ))}
            {!loading && !visits.length && (
              <tr><td colSpan={6} className="p-6"><Empty title="Không tìm thấy lượt khám" desc="Không có hồ sơ nào trùng khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại." /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 p-4 text-xs bg-white">
        <span className="font-medium text-slate-500">Trang <strong className="text-slate-800">{page}</strong> / {totalPages}</span>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors"> Trước</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors">Sau </button>
        </div>
      </div>
    </section>
  );
}

function VisitRow({ visit, active, busy, onSelect, onStart, onOpenWorkflow }) {
  const st = STATUS[visit.status] || STATUS.WAITING;
  const canStart = visit.status === 'WAITING';
  const canOpenWorkflow = !['WAITING', 'COMPLETED', 'CANCELLED'].includes(visit.status);

  return (
    <tr onClick={onSelect} className={`cursor-pointer transition-colors ${active ? 'bg-cyan-50/70' : 'bg-white hover:bg-slate-50'}`}>
      <td className="px-5 py-4 min-w-[260px]">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-100 to-cyan-100 text-xs font-black text-cyan-700">
            {(visit.patient?.fullName || 'BN').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-slate-900">{visit.patient?.fullName || 'Chưa có tên'}</h3>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{visit.patient?.patientCode || 'N/A'} - {visit.patient?.phone || 'Không có SĐT'}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-mono font-bold text-slate-600">{visit.visitCode}</span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-slate-700">{getVisitDepartmentName(visit)}</td>
      <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-slate-500">{formatTime(visit.checkInAt)}</td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}>
          <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
        </span>
      </td>
      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-2">
          {canStart && (
            <button type="button" disabled={busy} onClick={onStart} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
              Bắt đầu khám
            </button>
          )}
          {canOpenWorkflow && (
            <button type="button" disabled={busy} onClick={onOpenWorkflow} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
              Quy trình điều trị
            </button>
          )}
          {!canStart && !canOpenWorkflow && (
            <button type="button" disabled className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-400">
              Đã hoàn tất
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function VisitHeader({ visit, detailLoading, onStart, onContinue, busy }) {
  const st = STATUS[visit.status] || STATUS.WAITING;
  const canStart = visit.status === 'WAITING';
  const canContinue = !canStart && visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED';

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="bg-slate-50/80 border-b border-slate-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-slate-500">MÃ LƯỢT KHÁM: {visit.visitCode}</span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${st.color}`}>
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} /> {st.label}
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-black text-slate-900">{visit.patient?.fullName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Mã bệnh nhân: {visit.patient?.patientCode} | CCCD: {visit.patient?.citizenId || 'Chưa cập nhật'}</p>
        </div>

        <div className="flex items-center gap-2">
          {detailLoading && <span className="text-xs text-slate-400 animate-pulse mr-2">Đang đồng bộ dữ liệu...</span>}
          {canStart && (
            <button type="button" disabled={busy} onClick={onStart} className="w-full sm:w-auto rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition-colors disabled:opacity-50">Tiếp nhận & Khám</button>
          )}
          {canContinue && (
            <button type="button" disabled={busy} onClick={onContinue} className="w-full sm:w-auto rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-cyan-700 transition-colors disabled:opacity-50">Mở Quy trình điều trị</button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
        <Info label="Ngày sinh / Tuổi" value={formatDate(visit.patient?.birthDate)} />
        <Info label="Phòng chức năng" value={getVisitDepartmentName(visit)} />
        <Info label="Thời gian tiếp nhận" value={formatTime(visit.checkInAt)} />
      </div>
    </section>
  );
}

/* ==========================================
   MODAL WIZARD STEP-BY-STEP CHUẨN HÓA KHÁM BỆNH
   ========================================== */
function WorkflowModal({ visit, activeStep, setActiveStep, onClose, orderProps, resultProps, aiProps, conclusionProps }) {
  const orders = orderProps?.existingOrders || [];
  const readyOrders = orders.filter((order) => order.status === 'RESULT_READY');
  const pendingOrders = orders.filter((order) => ['ORDERED', 'IN_PROGRESS'].includes(order.status));
  const hasConclusion = Boolean(conclusionProps?.completed || visit.finalConclusion);
  const canCreateOrders = ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(visit?.status);
  const canReviewResults = orders.length > 0 || ['WAITING_TEST_RESULT', 'WAITING_CONCLUSION', 'COMPLETED'].includes(visit?.status);
  const canConclude = pendingOrders.length === 0 && (readyOrders.length > 0 || visit?.status === 'WAITING_CONCLUSION' || hasConclusion);

  const steps = [
    {
      step: 1,
      eyebrow: 'Bước 01',
      title: 'Khám lâm sàng & chỉ định cận lâm sàng',
      desc: 'Tạo phiếu xét nghiệm, X-Quang, siêu âm hoặc chẩn đoán hình ảnh.',
      status: pendingOrders.length ? `Có thể bổ sung (${pendingOrders.length} phiếu chờ)` : orders.length ? `${orders.length} phiếu đã gửi` : canCreateOrders ? 'Sẵn sàng tạo phiếu' : 'Chưa tiếp nhận khám',
      tone: 'cyan',
      enabled: true,
    },
    {
      step: 2,
      eyebrow: 'Bước 02',
      title: 'Đọc kết quả & tham vấn AI',
      desc: 'Kiểm tra tệp kết quả trả về, sau đó chạy AI nếu cần hỗ trợ phân tích.',
      status: pendingOrders.length ? `Còn ${pendingOrders.length} phiếu đang xử lý` : readyOrders.length ? `${readyOrders.length} phiếu có kết quả` : 'Chưa có kết quả',
      tone: 'cyan',
      enabled: canReviewResults,
    },
    {
      step: 3,
      eyebrow: 'Bước 03',
      title: 'Kết luận, toa thuốc & đóng bệnh án',
      desc: 'Nhập chẩn đoán cuối, hướng điều trị, toa thuốc và hẹn tái khám.',
      status: hasConclusion ? 'Hồ sơ đã đóng' : canConclude ? 'Có thể kết luận' : 'Cần kết quả cận lâm sàng trước',
      tone: 'emerald',
      enabled: canConclude,
    },
  ];

  const goStep = (step) => {
    const target = steps.find((item) => item.step === step);
    if (target?.enabled) setActiveStep(step);
  };

  const currentStep = steps.find((item) => item.step === activeStep) || steps[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Bệnh án điện tử</p>
              <h2 className="mt-1 truncate text-lg font-black text-slate-950">
                {visit.patient?.fullName} <span className="text-slate-400">({visit.visitCode})</span>
              </h2>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
              Đóng
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-5">
            {steps.map((step, index) => {
              const isCurrent = activeStep === step.step;
              const isDone = step.step < activeStep || (step.step === 3 && hasConclusion);
              const circleClass = isCurrent
                ? 'bg-cyan-600 text-white border-cyan-600 ring-4 ring-cyan-100'
                : isDone
                  ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                  : step.enabled
                    ? 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                    : 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed';
              return (
                <React.Fragment key={step.step}>
                  <button
                    type="button"
                    onClick={() => goStep(step.step)}
                    disabled={!step.enabled}
                    aria-label={`Bước ${step.step}`}
                    className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-black transition-colors ${circleClass}`}
                  >
                    {step.step}
                  </button>
                  {index < steps.length - 1 && <span className="h-px w-16 bg-slate-200" />}
                </React.Fragment>
              );
            })}
          </div>

          <h3 className="mt-4 text-center text-base font-black text-slate-900">{currentStep.title}</h3>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/70 p-5">
          {activeStep === 1 && (
            <div className="space-y-4 animate-slideUp">
              <OrderPanel visit={visit} {...orderProps} />
              <WorkflowActions
                primaryLabel="Sang bước 2"
                onPrimary={() => goStep(2)}
                primaryDisabled={!canReviewResults}
                primaryHint={!canReviewResults ? 'Cần tạo ít nhất một phiếu chỉ định trước.' : ''}
              />
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-4 animate-slideUp">
              <ResultsPanel {...resultProps} />
              <AiPanel {...aiProps} />
              <WorkflowActions
                secondaryLabel="Quay lại bước 1"
                onSecondary={() => goStep(1)}
                extraLabel="Yêu cầu bổ sung"
                onExtra={() => goStep(1)}
                primaryLabel="Sang bước 3"
                onPrimary={() => goStep(3)}
                primaryDisabled={!canConclude}
                primaryHint={!canConclude ? (pendingOrders.length ? `Còn ${pendingOrders.length} phiếu đang chờ kết quả.` : 'Cần có kết quả cận lâm sàng trước.') : ''}
              />
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-4 animate-slideUp">
              <ConclusionPanel {...conclusionProps} />
              <WorkflowActions secondaryLabel="Xem lại bước 2" onSecondary={() => goStep(2)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowActions({ secondaryLabel, onSecondary, extraLabel, onExtra, primaryLabel, onPrimary, primaryDisabled = false, primaryHint = '' }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-slate-200/70 pt-4">
      <div>{primaryHint && <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">{primaryHint}</p>}</div>
      <div className="flex flex-wrap justify-end gap-2">
        {secondaryLabel && <button type="button" onClick={onSecondary} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">{secondaryLabel}</button>}
        {extraLabel && <button type="button" onClick={onExtra} className="rounded-xl border border-cyan-100 bg-cyan-50 px-4 py-2.5 text-xs font-black text-cyan-700 hover:bg-cyan-100">{extraLabel}</button>}
        {primaryLabel && <button type="button" onClick={onPrimary} disabled={primaryDisabled} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none">{primaryLabel}</button>}
      </div>
    </div>
  );
}

function OrderPanel({ visit, forms, setForms, departments, existingOrders = [], onSubmit, busy }) {
  const canOrder = ['IN_PROGRESS', 'WAITING_TEST_RESULT', 'WAITING_CONCLUSION'].includes(visit?.status);
  const updateForm = (index, patch) => setForms(forms.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const addForm = () => setForms([...forms, { ...emptyOrder }]);
  const removeForm = (index) => setForms(forms.length > 1 ? forms.filter((_, i) => i !== index) : [{ ...emptyOrder }]);
  const hasDuplicateDepartments = forms.some((form, index) => form.targetDepartmentId && forms.some((other, otherIndex) => otherIndex !== index && other.targetDepartmentId === form.targetDepartmentId));
  const handleDepartmentChange = (index, departmentId) => {
    const department = departments.find((item) => item.id === departmentId);
    updateForm(index, {
      targetDepartmentId: departmentId,
      orderType: forms[index].orderType || department?.name || '',
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">Danh sách phiếu chỉ định</h3>

          <p className="mt-2 text-[11px] font-bold text-slate-500">Đã gửi: <span className="text-cyan-700">{existingOrders.length}</span> phiếu - Đang soạn: <span className="text-cyan-700">{forms.length}</span> phiếu</p>
          <p className="mt-1 text-[11px] font-semibold text-cyan-700">Chỉ hiển thị phòng xét nghiệm/chẩn đoán hình ảnh đang bật nhận chỉ định.</p>
        </div>
        {canOrder && (
          <button type="button" onClick={addForm} className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100 transition-colors">
            Tạo thêm phiếu chỉ định
          </button>
        )}
      </div>

      {!canOrder ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-xs font-semibold text-amber-800">
          <strong>Thông báo:</strong> Bác sĩ cần bấm nút tiếp nhận trạng thái "Bắt đầu khám" ngoài danh sách để kích hoạt quyền tạo chỉ định cận lâm sàng.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {existingOrders.length > 0 && (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-black text-cyan-900">Phiếu chỉ định đã gửi</h4>

                </div>
                <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-cyan-700 border border-cyan-100">{existingOrders.length} phiếu</span>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {existingOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-cyan-100 bg-white px-3 py-2 text-xs">
                    <strong className="block text-slate-900">{order.orderType}</strong>
                    <span className="mt-0.5 block text-[10px] font-bold text-slate-400">{order.orderCode} - {order.targetDepartment?.name || 'N/A'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {forms.map((form, index) => (
            <div key={index} className="rounded-2xl border border-cyan-100 bg-cyan-50/30 p-5 shadow-sm relative transition-colors">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-black text-cyan-900 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-200 text-[10px] font-black text-cyan-800">{index + 1}</span>
                  Soạn phiếu mới
                </h4>
                {forms.length > 1 && (
                  <button type="button" onClick={() => removeForm(index)} className="rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors">
                    Xóa phiếu
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Nơi thực hiện <span className="text-rose-500">*</span></label>
                  <select
                    value={form.targetDepartmentId}
                    onChange={(e) => handleDepartmentChange(index, e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-colors"
                  >
                    <option value="">-- Chọn khoa/phòng xét nghiệm hoặc chẩn đoán hình ảnh --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} · {d.type === 'IMAGING' ? 'Chẩn đoán hình ảnh' : 'Xét nghiệm'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Tên/Loại chỉ định <span className="text-rose-500">*</span></label>
                  <input
                    value={form.orderType}
                    onChange={(e) => updateForm(index, { orderType: e.target.value })}
                    required
                    placeholder="VD: Siêu âm ổ bụng, Chụp X-Quang phổi..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Ghi chú lâm sàng cho KTV</label>
                  <input
                    value={form.clinicalNote}
                    onChange={(e) => updateForm(index, { clinicalNote: e.target.value })}
                    placeholder="VD: Nghi ngờ viêm ruột thừa, tập trung kiểm tra hố chậu phải..."
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-colors"
                  />
                </div>
              </div>
            </div>
          ))}

          {hasDuplicateDepartments && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[11px] font-bold text-rose-700">
              Cảnh báo: Đang có sự trùng lặp khoa/phòng thực hiện giữa các phiếu. Vui lòng gộp chung chỉ định vào 1 phiếu hoặc chọn bộ phận khác để tránh lỗi.
            </div>
          )}

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              disabled={busy || hasDuplicateDepartments}
              className="rounded-xl bg-cyan-600 px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:shadow-none transition-colors"
            >
              {busy ? 'Đang gửi...' : 'Xác nhận & Gửi tất cả phiếu'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ResultsPanel({ orders }) {
  const completedOrders = orders.filter(o => o.status === 'RESULT_READY' || o.status === 'COMPLETED');
  const pendingOrders = orders.filter(o => !['RESULT_READY', 'COMPLETED', 'CANCELLED'].includes(o.status));
  const toast = useToast();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-black text-slate-900">Chi tiết kết quả trả về</h3>

        </div>
        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600 border border-slate-200">
          Tổng: {orders.length} phiếu
        </span>
      </div>

      {orders.length === 0 ? (
        <Empty title="Chưa có phiếu chỉ định" desc="Bác sĩ chưa tạo bất kỳ phiếu yêu cầu cận lâm sàng nào cho bệnh án này." />
      ) : (
        <div className="space-y-4 mt-4">
          {pendingOrders.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">Đang thực hiện {pendingOrders.length} phiếu...</span>
              <LoadingIndicator size="sm" />
            </div>
          )}

          {completedOrders.length > 0 && (
            <div className="space-y-3">
              {completedOrders.map(order => (
                <div key={order.id} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-4">
                  <div className="flex justify-between items-start mb-3">
                    <strong className="text-xs font-black text-emerald-900">{order.orderType}</strong>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-1 rounded-md">Đã trả KQ</span>
                  </div>
                  {order.results?.length > 0 ? order.results.map(res => (
                    <div key={res.id} className="mt-2 bg-white rounded-lg border border-emerald-100 p-3 text-xs shadow-sm">
                      {res.note && (
                        <p className="mb-2 text-slate-700"><span className="font-bold text-slate-900">KTV Ghi chú:</span> {res.note}</p>
                      )}
                      {res.files?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {res.files.map(f => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={async () => {
                                try {
                                  const dl = await medicalOrderService.getResultFileDownloadUrl(f.id);
                                  if (dl.data?.url) window.open(dl.data.url, '_blank', 'noopener,noreferrer');
                                } catch {
                                  toast.error('Không tải được tệp kết quả hoặc bạn không có quyền truy cập.');
                                }
                              }}
                              className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-700 bg-cyan-50 px-3 py-2 rounded-lg border border-cyan-100 hover:bg-cyan-100 transition-colors"
                            >
                              <Download className="w-4 h-4" strokeWidth={2.5} />
                              Xem {f.originalName?.slice(-12) || 'Tệp đính kèm'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div className="text-xs text-slate-500 italic mt-2">Chưa cập nhật nội dung chi tiết.</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AiPanel({ diagnoses, aiModels, selectedAiModelId, setSelectedAiModelId, selectedAiId, setSelectedAiId, onGenerate, busy }) {
  const rankedDiagnoses = useMemo(() => [...diagnoses].sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0)), [diagnoses]);
  const currentDiagnosis = rankedDiagnoses.find((diagnosis) => diagnosis.id === selectedAiId) || rankedDiagnoses[0];
  const parsedResult = normalizeAiAnalysis(currentDiagnosis?.result);
  const selectedModel = aiModels.find((model) => model.id === selectedAiModelId);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-black text-slate-900">So sánh kết quả phân tích AI</h3>

        </div>
        <div className="flex flex-col sm:flex-row gap-2 xl:min-w-[520px]">
          <select value={selectedAiModelId} onChange={(e) => setSelectedAiModelId(e.target.value)} disabled={busy} className="flex-1 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:opacity-50 transition-colors">
            <option value="">-- Chọn mô hình AI --</option>
            {aiModels.map((model) => <option key={model.id} value={model.id}>{model.modelName || model.name || 'Mô hình AI'} {model.modelVersion ? `(${model.modelVersion})` : ''} - {model.provider || 'khác'}</option>)}
          </select>
          <button type="button" onClick={onGenerate} disabled={busy || !selectedAiModelId} className="rounded-xl bg-cyan-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50 disabled:shadow-none whitespace-nowrap transition-colors flex items-center justify-center gap-2">
            {busy ? (<><LoadingIndicator size="sm" /><span>Đang phân tích...</span></>) : (`Chạy ${selectedModel?.provider || 'AI'}`)}
          </button>
        </div>
      </div>

      {diagnoses.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 items-start">
          <aside className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Lịch sử phân tích</span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-cyan-700 border border-cyan-100">{diagnoses.length} bản</span>
            </div>
            <div className="grid grid-cols-1 gap-2 max-h-[520px] overflow-y-auto pr-1">
              {rankedDiagnoses.map((diagnosis, index) => {
                const parsed = normalizeAiAnalysis(diagnosis.result);
                const isSelected = diagnosis.id === currentDiagnosis?.id;
                return (
                  <button key={diagnosis.id} type="button" onClick={() => setSelectedAiId(diagnosis.id)} className={`w-full rounded-2xl border p-3 text-left transition-colors ${isSelected ? 'border-cyan-400 bg-white shadow-sm ring-2 ring-cyan-100' : 'border-slate-100 bg-white/70 hover:bg-white hover:border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-cyan-50 px-2 py-1 text-[10px] font-black uppercase text-cyan-700 border border-cyan-100">#{index + 1} · {parsed.provider || diagnosis.aiModel?.provider || 'AI'}</span>
                      <span className="text-[10px] font-bold text-slate-400">{formatTime(diagnosis.createdAt)}</span>
                    </div>
                    <strong className="mt-2 block text-xs font-black text-slate-900">{parsed.modelName || diagnosis.aiModel?.modelName || 'Mô hình AI'}</strong>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-400">Confidence</span>
                      <span className="text-[10px] font-black text-cyan-700">{formatConfidence(diagnosis.confidence)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400" style={{ width: `${confidencePercent(diagnosis.confidence)}%` }} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-[11px] font-semibold leading-relaxed text-slate-500">{parsed.summary || 'Bản phân tích AI đã được lưu.'}</p>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50/70 to-white p-5 text-xs text-slate-800 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-cyan-100 pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-cyan-100 bg-white px-3 py-1 text-[10px] font-black text-cyan-700">Chỉ gợi ý · Bác sĩ quyết định cuối cùng</span>
                  <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[10px] font-black text-emerald-700">Confidence {formatConfidence(currentDiagnosis?.confidence)}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-600">{currentDiagnosis?.status === 'DOCTOR_REVIEWED' ? 'Bác sĩ đã review' : 'AI gợi ý'}</span>
                </div>
                <h4 className="mt-3 text-lg font-black text-slate-950">{parsedResult.modelName || currentDiagnosis?.aiModel?.modelName || 'Mô hình AI'}</h4>
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Nền tảng: {parsedResult.provider || currentDiagnosis?.aiModel?.provider || 'khác'} · {currentDiagnosis?.createdAt ? new Date(currentDiagnosis.createdAt).toLocaleString('vi-VN') : 'N/A'}</p>
              </div>
              <span className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-[10px] font-black text-emerald-700">Đã lưu DB</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><AiSection title="Tổng quan lâm sàng" value={parsedResult.summary} /></div>
              <div className="lg:col-span-2 rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><ImageFindingsSection value={parsedResult.imageFindings} /></div>
              <div className="lg:col-span-2 rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><DiagnosticProbabilitySection value={parsedResult.diagnosticProbabilities} /></div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><AiSection title="Cân nhắc lâm sàng" value={parsedResult.clinicalConsiderations || parsedResult.possibleConditions} list /></div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><AiSection title="Cảnh báo rủi ro" value={parsedResult.riskFlags} list /></div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><AiSection title="Đề xuất bước tiếp theo" value={parsedResult.recommendedNextSteps || parsedResult.recommendations} list /></div>
              <div className="rounded-2xl border border-white bg-white/80 p-4 shadow-sm"><AiSection title="Giới hạn phân tích" value={parsedResult.limitations} list /></div>
            </div>

            {!parsedResult.summary && currentDiagnosis?.result && <div className="whitespace-pre-wrap rounded-xl border border-white bg-white/80 p-4 text-xs font-medium leading-relaxed text-slate-700">{currentDiagnosis.result}</div>}
          </section>
        </div>
      ) : (<Empty title="Chưa có phân tích AI" desc="Chọn Gemini, ChatGPT/OpenAI hoặc mô hình khác rồi bấm chạy để lưu bản phân tích đầu tiên." />)}
    </div>
  );
}

function normalizeAiAnalysis(value) {
  const parsed = parseAiResult(value);
  const analysis = parsed?.analysis && typeof parsed.analysis === 'object' && !Array.isArray(parsed.analysis) ? parsed.analysis : {};
  return { ...parsed, ...analysis, summary: analysis.summary || parsed.summary, imageFindings: analysis.imageFindings || parsed.imageFindings, diagnosticProbabilities: analysis.diagnosticProbabilities || analysis.differentialDiagnoses || analysis.possibleDiagnoses || parsed.diagnosticProbabilities, clinicalConsiderations: analysis.clinicalConsiderations || parsed.clinicalConsiderations, riskFlags: analysis.riskFlags || parsed.riskFlags, recommendedNextSteps: analysis.recommendedNextSteps || parsed.recommendedNextSteps, limitations: analysis.limitations || parsed.limitations };
}

function confidencePercent(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return 0;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(Math.max(0, Math.min(100, raw)));
}

function formatConfidence(value) {
  const percent = confidencePercent(value);
  return percent ? `${percent}%` : 'N/A';
}

const SEVERITY_TONE = {
  'nặng': 'bg-rose-50 text-rose-700 border-rose-100',
  'trung bình': 'bg-amber-50 text-amber-700 border-amber-100',
  'nhẹ': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'không rõ': 'bg-slate-50 text-slate-600 border-slate-200',
};

function ImageFindingsSection({ value }) {
  const items = Array.isArray(value) ? value : [];
  if (!items.length) return null;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <strong className="text-[11px] uppercase tracking-wider font-black text-cyan-900">Phát hiện trên ảnh y khoa</strong>
        <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-black text-cyan-700 border border-cyan-100">{items.length} ảnh</span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => {
          const modality = item.modality || item.type || `Ảnh ${index + 1}`;
          const finding = item.finding || item.observation || item.description || (typeof item === 'string' ? item : JSON.stringify(item));
          const severity = String(item.severity || '').toLowerCase();
          const tone = SEVERITY_TONE[severity] || 'bg-slate-50 text-slate-600 border-slate-200';
          return (
            <div key={`img-${index}`} className="rounded-xl border border-slate-100 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-900">{modality}</span>
                {severity && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${tone}`}>{item.severity}</span>}
              </div>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600">{finding}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosticProbabilitySection({ value }) {
  if (!value) return null;
  const items = Array.isArray(value) ? value : [];
  if (!items.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <strong className="text-[11px] uppercase tracking-wider font-black text-cyan-900">Khả năng chẩn đoán</strong>
        <span className="text-[10px] font-bold text-slate-400">Tham khảo</span>
      </div>
      <div className="space-y-3">
        {items.map((item, index) => {
          const condition = item.condition || item.name || item.diagnosis || `Khả năng ${index + 1}`;
          const probability = Math.max(0, Math.min(100, Number(item.probability ?? item.percent ?? item.score ?? 0)));
          const reason = item.reason || item.rationale || item.explanation;
          return (
            <div key={`${condition}-${index}`}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-black text-slate-800">{condition}</span>
                <span className="font-black text-cyan-700">{probability}%</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${probability}%` }} />
              </div>
              {reason && <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500">{reason}</p>}
            </div>
          );
        })}
      </div>
      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700 border border-amber-100">
        Tỷ lệ chỉ là ước lượng hỗ trợ, không thay thế chẩn đoán của bác sĩ.
      </p>
    </div>
  );
}

function AiSection({ title, value, list = false }) {
  if (!value) return null;
  const items = Array.isArray(value) ? value : [value];
  return <div><strong className="text-[11px] uppercase tracking-wider font-black text-cyan-900 block mb-1.5">{title}</strong>{list ? <ul className="list-disc pl-5 space-y-1 font-medium text-slate-700 marker:text-cyan-400">{items.map((item, index) => <li key={`${title}-${index}`}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>)}</ul> : <p className="leading-relaxed font-medium text-slate-700">{String(value)}</p>}</div>;
}

function ConclusionPanel({ form, setForm, onSubmit, busy, completed, activeVisit, activeConclusion }) {
  const updateForm = (patch) => setForm({ ...form, ...patch });

  return (
    <div className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-xs">
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-[11px] font-black text-cyan-800 mb-1.5 uppercase tracking-wider">Chẩn đoán xác định (Bắt buộc) <span className="text-rose-500">*</span></label>
          <textarea
            required
            rows={2}
            value={form.finalDiagnosis}
            onChange={(e) => updateForm({ finalDiagnosis: e.target.value })}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-colors"
            placeholder="VD: Viêm loét dạ dày tá tràng K27..."
            disabled={completed}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-black text-cyan-800 mb-1.5 uppercase tracking-wider">Hướng điều trị</label>
            <textarea
              rows={3}
              value={form.treatmentPlan}
              onChange={(e) => updateForm({ treatmentPlan: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-colors"
              placeholder="VD: Điều trị nội khoa ngoại trú, ăn uống kiêng cữ..."
              disabled={completed}
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-cyan-800 mb-1.5 uppercase tracking-wider">Toa thuốc (Kê đơn)</label>
            <textarea
              rows={3}
              value={form.prescription}
              onChange={(e) => updateForm({ prescription: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-colors"
              placeholder="VD: 1. Omeprazol 20mg x 14 viên (Ngày 1 viên sáng)..."
              disabled={completed}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-[11px] font-black text-cyan-800 mb-1.5 uppercase tracking-wider">Lời dặn / Hẹn tái khám</label>
            <input
              value={form.followUpNote}
              onChange={(e) => updateForm({ followUpNote: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-colors"
              placeholder="VD: Tái khám sau 7 ngày hoặc khi đau bụng dữ dội."
              disabled={completed}
            />
          </div>
          <div>
            <label className="block text-[11px] font-black text-cyan-800 mb-1.5 uppercase tracking-wider">Ghi chú ẩn (Lưu hành nội bộ BS)</label>
            <input
              value={form.doctorNote}
              onChange={(e) => updateForm({ doctorNote: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs font-semibold outline-none focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 transition-colors"
              placeholder="Ghi chú thêm về cơ địa, đặc điểm tâm lý bệnh nhân..."
              disabled={completed}
            />
          </div>
        </div>

        <div className="flex justify-end pt-5 mt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={busy || completed}
            className={`rounded-xl px-8 py-3.5 text-xs font-black uppercase tracking-wider text-white shadow-sm transition-colors ${completed
              ? 'bg-slate-300 shadow-none text-slate-500 cursor-not-allowed'
              : 'bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 disabled:shadow-none'
              }`}
          >
            {busy ? 'Đang lưu dữ liệu...' : completed ? 'Hồ sơ đã đóng' : 'Hoàn Tất & Đóng Bệnh Án'}
          </button>
        </div>

        {completed && (
          <div className="flex justify-center mt-4">
            <button
              type="button"
              onClick={() => {
                // Encode the patient code so the public Patient Verification page can
                // resolve it directly. Fall back to visitCode if patient is missing.
                const qrData = `KLTN-PATIENT-${activeVisit?.patient?.patientCode || activeVisit?.visitCode || ''}`;
                printConclusionWithQR(activeVisit, activeConclusion, qrData);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-xl border border-cyan-600 text-cyan-700 font-bold text-xs hover:bg-cyan-50 transition-colors"
            >
              <Printer size={16} />
              In PDF kèm Mã QR
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function Info({ label, value, large }) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/50 p-4 ${large ? 'col-span-full' : ''}`}>
      <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`block mt-1 font-bold text-slate-900 ${large ? 'text-sm' : 'text-xs'}`}>{value}</span>
    </div>
  );
}



function Empty({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/30 rounded-2xl">
      <div className="h-14 w-14 rounded-full bg-white border border-slate-100 shadow-sm flex items-center justify-center mb-4 text-slate-300">
        <FileText className="w-6 h-6" strokeWidth={2.5} />
      </div>
      <h3 className="text-sm font-black text-slate-900">{title}</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}
