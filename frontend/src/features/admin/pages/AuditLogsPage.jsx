import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { auditService } from '../apis/auditService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import {
  ArrowUp,
  ArrowDown,
  Eye,
  X,
  Layers,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  LockKeyhole,
  FileDiff,
  Fingerprint,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History
} from 'lucide-react';

// ---- Display helpers --------------------------------------------------------

const ACTION_TONE = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UPDATE: 'bg-amber-50 text-amber-700 border-amber-200',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200',
  LOGIN_PASSWORD: 'bg-slate-50 text-slate-700 border-slate-200',
  LOGIN_INVITE: 'bg-slate-50 text-slate-700 border-slate-200',
  LOGIN_FAIL: 'bg-rose-50 text-rose-700 border-rose-200',
  FACE_VERIFY_PASS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  FACE_VERIFY_FAIL: 'bg-orange-50 text-orange-700 border-orange-200',
  FACE_INTEGRITY_FAIL: 'bg-red-50 text-red-700 border-red-200',
  FACE_ENROLL: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const ACTION_LABEL = {
  LOGIN_PASSWORD: 'Đăng nhập (Mật khẩu)',
  LOGIN_INVITE: 'Đăng nhập (Lời mời)',
  LOGIN_FAIL: 'Đăng nhập thất bại',
  FACE_VERIFY_PASS: 'Xác thực khuôn mặt OK',
  FACE_VERIFY_FAIL: 'Xác thực khuôn mặt lỗi',
  FACE_INTEGRITY_FAIL: 'Khuôn mặt bị sửa đổi',
  FACE_ENROLL: 'Đăng ký khuôn mặt',
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

const BATCH_STATUS_LABEL = {
  ANCHORED: 'Đã neo',
  FAILED: 'Thất bại',
  PENDING: 'Chờ neo',
};

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
};

const ROLE_TONE = {
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  RECEPTIONIST: 'bg-blue-50 text-blue-700 border-blue-200',
  DOCTOR: 'bg-teal-50 text-teal-700 border-teal-200',
  LAB_MANAGER: 'bg-orange-50 text-orange-700 border-orange-200',
};

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  if (clean.length <= 18) return clean;
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour12: false }) : 'N/A';
}

function formatHashVersion(version) {
  if (version === 'KLTN_AUDIT_ENTRY_V2') return 'V2 · Mã hóa';
  return version ? `V1 · ${version}` : 'V1';
}

const VERIFICATION_TONE = {
  VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  TAMPERED: 'border-rose-200 bg-rose-50 text-rose-700',
};

const VERIFICATION_LABEL = {
  VERIFIED: 'Toàn vẹn',
  PENDING: 'Chờ kiểm tra',
  TAMPERED: 'Nghi sửa đổi',
};

function renderDiffValue(value, redacted) {
  if (redacted) return 'Đã ẩn theo chính sách bảo mật';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Đúng' : 'Sai';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderFieldList(fields) {
  if (!fields.length) return 'Không có thay đổi dữ liệu';
  const labels = fields.map((field) => fieldDisplayName({ fieldPath: field, field }));
  return labels.slice(0, 2).join(', ') + (labels.length > 2 ? ` +${labels.length - 2}` : '');
}

function getPrimaryDiff(log) {
  return Array.isArray(log.diff) && log.diff.length ? log.diff.slice(0, 2) : [];
}

function summarizeDiff(log) {
  const fields = log.fieldsChanged || log.diff?.map((item) => item.fieldPath || item.field) || [];
  return renderFieldList(fields);
}

function subjectTitle(log) {
  const subject = log.subject;
  if (!subject) return ENTITY_LABELS[log.entity] || log.entity || 'Đối tượng';
  return subject.displayName || subject.code || subject.label || subject.entity || 'Đối tượng';
}

function subjectSubtitle(log) {
  const subject = log.subject;
  if (!subject) return shortHash(log.entityId);
  const parts = [subject.label || subject.table, subject.code, subject.departmentName].filter(Boolean);
  return parts.join(' · ') || shortHash(subject.entityId);
}

// ---- Page -------------------------------------------------------------------

export default function AuditLogsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState('logs');
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [batches, setBatches] = useState([]);
  const [chain, setChain] = useState(null);
  const [entity, setEntity] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [batchFilter, setBatchFilter] = useState('');
  const [anchoring, setAnchoring] = useState(false);
  const [proof, setProof] = useState(null);

  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);

  const [batchesPage, setBatchesPage] = useState(1);
  const [batchesTotalPages, setBatchesTotalPages] = useState(1);
  const [batchesTotal, setBatchesTotal] = useState(0);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditService.logs({
        page: logsPage,
        limit: 10,
        sort: sortOrder,
        ...(entity ? { entity } : {}),
        ...(batchFilter !== '' ? { batch: batchFilter } : {}),
      });
      const data = res.data || {};
      setLogs(data.items || []);
      setLogsTotal(data.total || 0);
      setLogsTotalPages(data.totalPages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được nhật ký');
    } finally {
      setLoading(false);
    }
  }, [logsPage, entity, sortOrder, batchFilter, toast]);

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditService.batches({
        page: batchesPage,
        limit: 10,
      });
      const data = res.data || {};
      setBatches(data.items || []);
      setBatchesTotal(data.total || 0);
      setBatchesTotalPages(data.totalPages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được lô blockchain');
    } finally {
      setLoading(false);
    }
  }, [batchesPage, toast]);

  const loadChain = useCallback(async () => {
    try {
      const res = await auditService.verifyChain();
      setChain(res.data);
    } catch (err) {
      console.error('Không tải được trạng thái chuỗi', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    if (tab === 'logs') {
      await loadLogs();
    } else {
      await loadBatches();
    }
    await loadChain();
  }, [tab, loadLogs, loadBatches, loadChain]);

  useEffect(() => {
    if (tab === 'logs') {
      loadLogs();
    } else {
      loadBatches();
    }
  }, [tab, logsPage, batchesPage, entity, sortOrder, batchFilter, loadLogs, loadBatches]);

  useEffect(() => {
    loadChain();
  }, [loadChain]);

  useEffect(() => {
    setLogsPage(1);
  }, [entity, sortOrder, batchFilter]);

  const stats = useMemo(() => {
    return {
      total: logsTotal,
      batches: batchesTotal,
      isChainOk: chain?.ok ?? true,
      chainLength: chain?.total ?? 0,
    };
  }, [logsTotal, batchesTotal, chain]);

  const handleAnchorNow = async () => {
    setAnchoring(true);
    try {
      const res = await auditService.anchorNow();
      const d = res.data || {};
      if (d.committed) {
        toast.success(`Đã neo lô #${d.batchId} (${d.leafCount} bản ghi) lên blockchain.`);
      } else {
        toast.info(`Không có gì để neo: ${d.reason || 'hàng đợi trống'}.`);
      }
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Neo thất bại');
    } finally {
      setAnchoring(false);
    }
  };

  const handleProof = async (seq) => {
    setProof({ seq, loading: true });
    try {
      const res = await auditService.proof(seq);
      setProof({ seq, loading: false, data: res.data });
    } catch (err) {
      setProof({ seq, loading: false, error: err?.response?.data?.message || err.message });
    }
  };

  return (
    <DashboardLayout
      user={user}
      navItems={ADMIN_NAV_ITEMS}
      activeItem="audit"
      onNavigate={(id) => navigateAdmin(navigate, id)}
      onLogout={logout}
    >
      <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6 text-slate-800">
        {/* Header Action */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nhật ký hệ thống tối cao</h1>
            <p className="text-sm text-slate-500 mt-0.5">Giám sát tính toàn vẹn, nhật ký kiểm toán và lịch sử biến động dữ liệu.</p>
          </div>
          <button
            id="audit-anchor-now-button"
            onClick={handleAnchorNow}
            disabled={anchoring}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-cyan-700 active:scale-98 disabled:opacity-50"
          >
            <LockKeyhole className="h-4 w-4" />
            {anchoring ? 'Đang kiểm chứng & neo…' : 'Neo Blockchain Ngay'}
          </button>
        </div>

        {/* Integrity banner */}
        <ChainBanner chain={chain} loading={loading} />

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Tổng số bản ghi" value={stats.total} hint="Lịch sử toàn hệ thống" icon={History} color="text-slate-700" />
          <StatCard label="Lô Blockchain" value={stats.batches} hint="Khối Merkle đã đóng" icon={Layers} color="text-cyan-600" />
          <StatCard
            label="Tính toàn vẹn"
            value={stats.isChainOk ? 'Đạt' : 'Lỗi'}
            hint={stats.isChainOk ? 'Chuỗi mã hóa an toàn' : 'Phát hiện sửa đổi trái phép!'}
            icon={stats.isChainOk ? CheckCircle2 : AlertTriangle}
            color={stats.isChainOk ? 'text-emerald-600' : 'text-rose-600'}
            bg={stats.isChainOk ? 'bg-emerald-50/50' : 'bg-rose-50'}
          />
          <StatCard label="Sức mạnh chuỗi" value={stats.chainLength} hint="Bản ghi kiểm toán sâu" icon={Fingerprint} color="text-indigo-600" />
        </section>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-100/80 p-1.5 rounded-xl">
          <div className="flex gap-1">
            <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
              Hoạt động hệ thống ({logsTotal})
            </TabButton>
            <TabButton active={tab === 'batches'} onClick={() => setTab('batches')}>
              Khối lưu trữ ({batchesTotal})
            </TabButton>
          </div>
          <button
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Đồng bộ dữ liệu
          </button>
        </div>

        {loading ? (
          <div className="py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <LoadingIndicator size="lg" label="Đang cấu trúc dữ liệu audit..." />
          </div>
        ) : tab === 'logs' ? (
          <LogsTable
            logs={logs}
            entity={entity}
            setEntity={setEntity}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            batchFilter={batchFilter}
            setBatchFilter={setBatchFilter}
            onProof={handleProof}
            page={logsPage}
            totalPages={logsTotalPages}
            total={logsTotal}
            onPrev={() => setLogsPage((v) => Math.max(1, v - 1))}
            onNext={() => setLogsPage((v) => Math.min(logsTotalPages, v + 1))}
          />
        ) : (
          <BatchesTable
            batches={batches}
            page={batchesPage}
            totalPages={batchesTotalPages}
            total={batchesTotal}
            onPrev={() => setBatchesPage((v) => Math.max(1, v - 1))}
            onNext={() => setBatchesPage((v) => Math.min(batchesTotalPages, v + 1))}
          />
        )}
      </div>

      {proof && <ProofModal proof={proof} onClose={() => setProof(null)} />}

    </DashboardLayout>
  );
}

// ---- Integrity banner -------------------------------------------------------

function ChainBanner({ chain, loading }) {
  if (loading || !chain) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
        <p className="text-sm font-medium text-slate-500">Hệ thống mã hóa đang quét chuỗi khối để kiểm tra tính toàn vẹn cơ sở dữ liệu…</p>
      </section>
    );
  }
  const ok = chain.ok;
  return (
    <section
      className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${ok ? 'border-emerald-200 bg-emerald-50/40 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900 animate-pulse'
        }`}
    >
      <div className="flex items-start gap-3">
        {ok ? <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {ok ? 'Cơ sở dữ liệu audit hoàn toàn mật thiết & toàn vẹn' : 'CẢNH BÁO: Phát hiện bất thường cấu trúc dữ liệu!'}
          </p>
          <p className="mt-0.5 text-xs font-normal opacity-85">
            {ok
              ? `Hệ thống đã đối chiếu thành công ${chain.total} bản ghi. Không tìm thấy bất kỳ dấu hiệu sửa đổi, chèn hoặc xóa lén dữ liệu.`
              : `Lỗi bất đối xứng mã băm được phát hiện tại bản ghi Sequence = ${chain.brokenAtSeq}. Lý do từ hệ thống: ${chain.reason}`}
          </p>
        </div>
      </div>
    </section>
  );
}

// ---- Activity logs table ----------------------------------------------------

const ENTITY_LABELS = {
  Department: 'Phòng ban',
  StaffProfile: 'Nhân sự',
  DoctorProfile: 'Bác sĩ',
  Patient: 'Bệnh nhân',
  AiModelRegistry: 'Mô hình AI',
  MedicalConclusion: 'Kết luận y khoa',
  AiQuality: 'Chất lượng AI',
  ParaclinicalShift: 'Ca cận lâm sàng',
  HandoverLog: 'Bàn giao ca',
  Visit: 'Lượt khám',
  MedicalOrder: 'Chỉ định cận lâm sàng',
  MedicalResult: 'Kết quả cận lâm sàng',
  User: 'Tài khoản',
};

const FIELD_LABELS = {
  'Department.canReceiveOrders': 'Có nhận chỉ định',
  'Department.departmentCode': 'Mã phòng ban',
  'Department.floor': 'Tầng',
  'Department.name': 'Tên phòng ban',
  'Department.specialty': 'Chuyên khoa',
  'Department.type': 'Loại phòng',
  'Department.status': 'Trạng thái phòng',
  'Department.description': 'Mô tả phòng',
  'Department.managerId': 'Người quản lý',
  'StaffProfile.fullName': 'Họ tên nhân sự',
  'StaffProfile.phone': 'SĐT nhân sự',
  'StaffProfile.departmentId': 'Phòng ban làm việc',
  'DoctorProfile.licenseNo': 'Số CCHN',
  'DoctorProfile.specialty': 'Chuyên khoa BS',
  'Patient.fullName': 'Họ tên bệnh nhân',
  'Patient.phone': 'SĐT bệnh nhân',
  'Patient.identityNumber': 'Số CCCD/CMND',
  'Patient.address': 'Địa chỉ bệnh nhân',
  'Visit.status': 'Trạng thái khám',
  'MedicalOrder.status': 'Trạng thái chỉ định',
  'MedicalResult.note': 'Ghi chú kết quả',
  'MedicalConclusion.diagnosis': 'Chẩn đoán lâm sàng',
  'MedicalConclusion.treatmentPlan': 'Phác đồ điều trị',
};

const FIELD_FALLBACK_LABELS = {
  canReceiveOrders: 'Nhận chỉ định',
  departmentCode: 'Mã phòng',
  floor: 'Tầng',
  name: 'Tên',
  specialty: 'Chuyên khoa',
  type: 'Loại',
  status: 'Trạng thái',
  description: 'Mô tả',
  managerId: 'Người quản lý',
  fullName: 'Họ và tên',
  phone: 'Số điện thoại',
  identityNumber: 'Số định danh',
  address: 'Địa chỉ',
  licenseNo: 'Số chứng chỉ',
  diagnosis: 'Chẩn đoán',
  treatmentPlan: 'Phác đồ',
  note: 'Ghi chú',
};

function fieldDisplayName(item) {
  const raw = item?.fieldPath || item?.field || '';
  if (FIELD_LABELS[raw]) return FIELD_LABELS[raw];
  const lastSegment = raw.split('.').pop();
  return FIELD_FALLBACK_LABELS[lastSegment] || item?.label || raw || 'Trường dữ liệu';
}

function fieldTechnicalName(item) {
  return item?.fieldPath || item?.field || '';
}

function LogsTable({
  logs,
  entity,
  setEntity,
  sortOrder,
  setSortOrder,
  batchFilter,
  setBatchFilter,
  onProof,
  page,
  totalPages,
  total,
  onPrev,
  onNext,
}) {
  const [detail, setDetail] = useState(null);
  const [batchInput, setBatchInput] = useState(batchFilter ?? '');

  useEffect(() => { setBatchInput(batchFilter ?? ''); }, [batchFilter]);

  const applyBatch = () => {
    const trimmed = String(batchInput).trim();
    setBatchFilter(trimmed === '' ? '' : trimmed.replace(/[^0-9]/g, ''));
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all">
      {/* Filters Blueprint Panel */}
      <div className="p-4 bg-slate-50/60 border-b border-slate-100 space-y-4">
        {/* Chips */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3" /> Phân loại cấu trúc đối tượng
          </label>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
            <FilterChip active={!entity} onClick={() => setEntity('')}>Tất cả dữ liệu</FilterChip>
            {Object.entries(ENTITY_LABELS).map(([key, value]) => (
              <FilterChip key={key} active={entity === key} onClick={() => setEntity(key)}>
                {value}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Meta filters bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          <div className="flex flex-wrap items-center gap-4">
            {/* Sort order toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Thứ tự Sequence:</span>
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-cyan-300 hover:bg-cyan-50/50 transition-all shadow-sm"
              >
                {sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5 text-cyan-600" /> : <ArrowUp className="h-3.5 w-3.5 text-cyan-600" />}
                {sortOrder === 'desc' ? 'Giảm dần (Mới nhất)' : 'Tăng dần (Cũ nhất)'}
              </button>
            </div>

            {/* Batch code search */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 flex items-center gap-0.5">
                <Layers className="h-3 w-3" /> Lọc theo số lô:
              </span>
              <div className="flex items-center gap-1.5">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">#</span>
                  <input
                    type="text"
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyBatch(); }}
                    placeholder="Tất cả lô"
                    className="w-24 rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500 transition-all shadow-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={applyBatch}
                  className="rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors shadow-sm"
                >
                  Tìm
                </button>
                {batchFilter !== '' && (
                  <button
                    type="button"
                    onClick={() => { setBatchInput(''); setBatchFilter(''); }}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-400 font-medium bg-slate-100 px-2.5 py-1 rounded-md">
            Tìm thấy <span className="font-bold text-slate-700">{total}</span> kết quả phù hợp
          </div>
        </div>
      </div>

      {!logs.length ? (
        <Empty
          title="Không tìm thấy bản ghi tương thích"
          desc={entity || batchFilter !== '' ? 'Không có dữ liệu audit nào khớp với tiêu chí bộ lọc của bạn hiện tại. Hãy thử đặt lại cấu hình lọc bộ gõ.' : 'Hệ thống chưa ghi nhận các hoạt động thay đổi cấu trúc dữ liệu.'}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5 text-center w-14">Seq</th>
                  <th className="px-4 py-3.5 w-40">Hành động</th>
                  <th className="px-4 py-3.5 w-60">Đối tượng tác động</th>
                  <th className="px-4 py-3.5">Nội dung tóm lược</th>
                  <th className="px-4 py-3.5 w-48">Tác nhân ký lệnh</th>
                  <th className="px-4 py-3.5 w-44">Thời điểm (Hệ thống)</th>
                  <th className="px-4 py-3.5 w-24 text-center">Trạng thái</th>
                  <th className="px-4 py-3.5 w-28 text-center">Xác minh</th>
                  <th className="px-4 py-3.5 w-32 text-right pr-6">Sổ cái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setDetail(log)}
                    className="group cursor-pointer hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="px-4 py-4 text-center font-mono font-bold text-slate-400 group-hover:text-cyan-600 transition-colors">
                      {log.seq ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide shadow-sm ${ACTION_TONE[log.action] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {ACTION_LABEL[log.action] || log.action}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900 truncate max-w-[220px]">{subjectTitle(log)}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-flex rounded bg-slate-100 text-slate-500 px-1 py-0.2 text-[10px] font-medium font-mono">
                          {ENTITY_LABELS[log.entity] || log.subject?.label || log.entity}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {formatHashVersion(log.hashVersion)}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate max-w-[220px]">
                        ID: {subjectSubtitle(log)}
                      </div>
                    </td>
                    <td className="px-4 py-4 max-w-xs md:max-w-sm">
                      <DiffPreview log={log} />
                    </td>
                    <td className="px-4 py-4">
                      <ActorCell log={log} />
                    </td>
                    <td className="px-4 py-4 text-slate-500 font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-300" />
                        {formatTime(log.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${log.onChainStatus === 'ANCHORED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                        {log.onChainStatus === 'ANCHORED' ? `Lô #${log.batchId}` : 'Hàng đợi'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <VerificationBadge status={log.blockchainStatus} />
                    </td>
                    <td className="px-4 py-4 text-right pr-6" onClick={(e) => e.stopPropagation()}>
                      {log.onChainStatus === 'ANCHORED' ? (
                        <button
                          onClick={() => onProof(log.seq)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-cyan-300 hover:text-cyan-600 shadow-sm transition-all active:scale-95"
                        >
                          <Eye className="h-3 w-3" /> Chứng chỉ
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300 italic">Chưa kết khối</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            label="bản ghi dữ liệu"
            onPrev={onPrev}
            onNext={onNext}
          />
        </>
      )}

      {detail && <LogDetailModal summaryLog={detail} onClose={() => setDetail(null)} onProof={onProof} />}
    </section>
  );
}

function DiffPreview({ log }) {
  const preview = getPrimaryDiff(log);
  if (!preview.length) {
    return <span className="text-xs font-medium text-slate-400 italic">{summarizeDiff(log)}</span>;
  }
  return (
    <div className="space-y-1 max-w-[280px]">
      {preview.map((item) => (
        <div key={item.field} className="text-[11px] text-slate-600 truncate flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded">
          <span className="font-semibold text-slate-700 shrink-0">{fieldDisplayName(item)}:</span>
          <span className="text-slate-400 line-through shrink-0 max-w-[50px] truncate">{renderDiffValue(item.before, item.redacted)}</span>
          <span className="text-slate-400 shrink-0">→</span>
          <span className="text-cyan-700 font-medium truncate">{renderDiffValue(item.after, item.redacted)}</span>
        </div>
      ))}
      {(log.diff?.length || 0) > preview.length && (
        <p className="text-[10px] text-cyan-600 font-semibold pl-1">
          + Phát hiện {log.diff.length - preview.length} thay đổi cấu trúc khác...
        </p>
      )}
    </div>
  );
}

function VerificationBadge({ status }) {
  const Icon = status === 'VERIFIED' ? ShieldCheck : ShieldAlert;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold shadow-sm ${VERIFICATION_TONE[status] || VERIFICATION_TONE.TAMPERED}`}>
      <Icon className="h-3 w-3 shrink-0" />
      {VERIFICATION_LABEL[status] || status || 'Không rõ'}
    </span>
  );
}

function ActorCell({ log }) {
  if (!log.actorId) return <span className="text-xs font-medium text-slate-400 italic">Hệ thống kích hoạt</span>;
  const actor = log.actor;
  if (!actor) {
    return <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1 rounded">{shortHash(log.actorId)}</span>;
  }
  return (
    <div className="min-w-0">
      <div className="font-semibold text-slate-800 truncate flex items-center gap-1">
        <UserIcon className="h-3 w-3 text-slate-400 shrink-0" />
        {actor.displayName}
      </div>
      <div className="mt-0.5">
        <span className={`inline-flex rounded text-[9px] font-bold px-1 uppercase tracking-wide border ${ROLE_TONE[actor.role] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
          {ROLE_LABELS[actor.role] || actor.role}
        </span>
      </div>
    </div>
  );
}

// ---- LogDetailModal Component -----------------------------------------------

function LogDetailModal({ summaryLog, onClose, onProof }) {
  const [log, setLog] = useState(summaryLog);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const actor = log.actor;

  const loadDetail = async () => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await auditService.detail(summaryLog.seq);
      setLog(res.data || summaryLog);
    } catch (err) {
      setDetailError(err?.response?.data?.message || err.message || 'Không tải được chi tiết audit đã giải mã.');
    } finally {
      setDetailLoading(false);
    }
  };

  const sensitiveDetailUnlocked = Boolean(log.sensitiveDetailUnlocked);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex flex-col w-full max-w-4xl max-h-[85vh] bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Block */}
        <div className="p-6 bg-slate-900 text-white flex items-start justify-between border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-bold tracking-widest uppercase text-cyan-400">
                <Fingerprint className="h-3 w-3" /> Audit Trace Ledger
              </span>
              <span className="text-xs text-slate-400 font-mono">Hash Version: {formatHashVersion(log.hashVersion)}</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <h2 className="text-xl font-bold font-mono tracking-tight text-white">Sequence ID #{log.seq ?? '—'}</h2>
              <span className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${ACTION_TONE[log.action] || 'bg-slate-800 border-slate-700 text-white'}`}>
                {ACTION_LABEL[log.action] || log.action}
              </span>
              <VerificationBadge status={log.blockchainStatus} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-800 bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {detailError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              {detailError}
            </div>
          )}

          {/* Quick Stats Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Data Meta */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Layers className="h-3.5 w-3.5" /> Đối tượng chịu tác động
              </h4>
              <div className="space-y-2">
                <DetailField label="Danh mục thực thể" value={ENTITY_LABELS[log.entity] || log.entity} />
                <DetailField label="Tiêu đề đối tượng" value={subjectTitle(log)} highlight />
                <DetailField label="Mã định danh Entity ID" value={log.entityId} mono />
                <DetailField label="Chi tiết bổ sung" value={subjectSubtitle(log)} />
              </div>
            </div>

            {/* Actor Identity Profile */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" /> Biên bản kiểm toán mật mã
              </h4>
              <div className="space-y-2">
                <DetailField label="Người thực thi" value={actor?.displayName || 'Hệ thống tự động'} highlight={Boolean(actor)} />
                <DetailField label="Vai trò nghiệp vụ" value={actor ? (ROLE_LABELS[actor.role] || actor.role) : '—'} />
                <DetailField label="Mã định danh Actor ID" value={log.actorId || '—'} mono />
                <DetailField label="Thời gian hệ thống" value={formatTime(log.createdAt)} />
              </div>
            </div>
          </div>

          {/* Security Hash Segment */}
          <div className="p-4 border border-slate-100 rounded-xl space-y-2 bg-slate-50/50 font-mono text-[11px]">
            <div className="text-xs font-bold text-slate-400 uppercase font-sans tracking-wide">Chữ ký số kiểm định (Hashes)</div>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400">Current Entry Hash:</span>
                <span className="text-slate-700 font-medium break-all text-right max-w-md">{log.entryHash || '—'}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-slate-400">Previous Record Hash:</span>
                <span className="text-slate-700 font-medium break-all text-right max-w-md">{log.prevHash || '—'}</span>
              </div>
            </div>
          </div>

          {/* Diff Changes Field Level Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <FileDiff className="h-3.5 w-3.5 text-cyan-600" /> Bảng phân rã biến động thuộc tính (Field-level Diff)
              </h3>
              {!sensitiveDetailUnlocked && (
                <button
                  type="button"
                  onClick={loadDetail}
                  disabled={detailLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-600 hover:text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-md border border-cyan-100 transition-all"
                >
                  <LockKeyhole className="h-3 w-3" /> {detailLoading ? 'Đang giải mã...' : 'Mở khóa dữ liệu nhạy cảm'}
                </button>
              )}
            </div>

            {Array.isArray(log.diff) && log.diff.length > 0 ? (
              <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                      <th className="px-4 py-2.5">Trường thuộc tính</th>
                      <th className="px-4 py-2.5 bg-rose-50/30 text-rose-800">Dữ liệu trước (Before)</th>
                      <th className="px-4 py-2.5 bg-emerald-50/30 text-emerald-800">Dữ liệu sau (After)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {log.diff.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div className="text-slate-800 font-semibold">{fieldDisplayName(item)}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{fieldTechnicalName(item)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 bg-rose-50/10 max-w-xs break-all">
                          {renderDiffValue(item.before, item.redacted)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-800 font-medium bg-emerald-50/10 max-w-xs break-all">
                          {renderDiffValue(item.after, item.redacted)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400 font-medium italic">
                Bản ghi này không ghi nhận biến động dữ liệu dạng bảng (Chỉ lưu vết sự kiện).
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">
            Mã định danh bản ghi cơ sở dữ liệu nội bộ: <span className="font-mono text-slate-600 font-bold">{log.id}</span>
          </div>
          <div className="flex gap-2">
            {log.onChainStatus === 'ANCHORED' && (
              <button
                type="button"
                onClick={() => { onClose(); onProof(log.seq); }}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl text-xs font-semibold transition-all shadow-sm"
              >
                Trích xuất Merkle Proof
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

function DetailField({ label, value, mono = false, highlight = false }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs border-b border-slate-100/60 pb-1.5 last:border-0 last:pb-0">
      <span className="text-slate-400 font-medium">{label}:</span>
      <span className={`text-right truncate max-w-[200px] sm:max-w-xs ${mono ? 'font-mono bg-slate-100 px-1 rounded text-slate-600 text-[11px]' : ''
        } ${highlight ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}

// ---- Batches Ledger Table ---------------------------------------------------

function BatchesTable({ batches, page, totalPages, total, onPrev, onNext }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-cyan-600" /> Sổ cái phân phối khối mã hóa Merkle
        </div>
        <div className="text-xs font-medium text-slate-400">
          Tổng số lô định danh: <span className="font-bold text-slate-700">{total}</span> lô
        </div>
      </div>

      {!batches.length ? (
        <Empty
          title="Chưa tìm thấy lô đóng gói nào"
          desc="Khi hệ thống thực hiện thao tác đóng chuỗi và neo lên mạng lưới, danh sách lịch sử đóng khối khối sẽ xuất hiện tại đây."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3.5 text-center w-20">Mã lô</th>
                  <th className="px-6 py-3.5">Merkle Root Hash</th>
                  <th className="px-6 py-3.5 text-center w-36">Số lá cây (Records)</th>
                  <th className="px-6 py-3.5 w-44">Thời điểm đóng cấu trúc</th>
                  <th className="px-6 py-3.5 w-40">Mã giao dịch sổ cái (TxHash)</th>
                  <th className="px-6 py-3.5 text-center w-32">Cơ chế xác thực</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-center font-mono font-bold text-slate-400">#{b.id}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-800 break-all max-w-sm">{b.merkleRoot || '—'}</td>
                    <td className="px-6 py-4 text-center font-bold text-cyan-700">{b.leafCount ?? 0} bản ghi</td>
                    <td className="px-6 py-4 text-slate-500">{formatTime(b.createdAt)}</td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-400" title={b.txHash}>
                      {b.txHash ? (
                        <span className="text-slate-600 font-semibold bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                          {shortHash(b.txHash)}
                        </span>
                      ) : (
                        <span className="italic text-slate-300">N/A (Cục bộ)</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${b.status === 'ANCHORED' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                        {BATCH_STATUS_LABEL[b.status] || b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} label="lô kết khối" onPrev={onPrev} onNext={onNext} />
        </>
      )}
    </section>
  );
}

// ---- Reusable Structural UI Elements ----------------------------------------

function StatCard({ label, value, hint, icon: Icon, color = 'text-slate-900', bg = 'bg-white' }) {
  return (
    <div className={`p-5 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between transition-all hover:shadow-md ${bg}`}>
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold font-mono tracking-tight ${color}`}>{value}</p>
        <p className="text-[11px] text-slate-500 font-medium opacity-80">{hint}</p>
      </div>
      {Icon && (
        <div className={`p-2.5 rounded-xl bg-slate-50 text-slate-400`}>
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${active
        ? 'bg-white text-slate-900 shadow-sm font-bold'
        : 'text-slate-500 hover:text-slate-800'
        }`}
    >
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all shadow-sm shrink-0 border ${active
        ? 'bg-cyan-600 text-white border-cyan-600 font-semibold'
        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
    >
      {children}
    </button>
  );
}

function Pagination({ page, totalPages, total, label = 'bản ghi', onPrev, onNext }) {
  return (
    <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
      <div>
        Hiển thị trang <span className="text-slate-800 font-bold">{page}</span> / <span className="text-slate-800 font-bold">{totalPages}</span> trang tổng (Tổng cộng {total} {label})
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 1}
          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold transition-all shadow-sm"
        >
          Trang trước
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page >= totalPages}
          className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-xs font-semibold transition-all shadow-sm"
        >
          Trang sau
        </button>
      </div>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="p-12 text-center max-w-md mx-auto space-y-2">
      <div className="inline-flex p-3 rounded-full bg-slate-50 border border-slate-100 text-slate-400 mb-2">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed font-medium">{desc}</p>
    </div>
  );
}

function ProofModal({ proof, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex flex-col max-h-[80vh] text-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Bằng chứng mật mã Merkle Proof (Seq #{proof.seq})
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-y-auto text-xs space-y-4">
          {proof.loading ? (
            <LoadingIndicator size="sm" label="Đang truy xuất cấu trúc cây kiểm toán..." />
          ) : proof.error ? (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-lg font-semibold">{proof.error}</div>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-500 leading-relaxed font-medium">
                Chuỗi bằng chứng băm (Sibling Hashes) chứng minh bản ghi này nằm trong cây Merkle Root đã được neo lên chuỗi khối mà không thể giả mạo:
              </p>
              <div className="p-3 bg-slate-900 text-cyan-400 font-mono text-[11px] rounded-xl overflow-x-auto space-y-1 shadow-inner">
                <div><span className="text-slate-500">// Merkle Root định danh</span></div>
                <div className="text-white font-bold pb-2 break-all">Root: {proof.data?.root || '—'}</div>
                <div className="text-slate-500 pt-1">// Danh sách các node băm lân cận</div>
                {Array.isArray(proof.data?.proof) && proof.data.proof.length > 0 ? (
                  proof.data.proof.map((p, i) => (
                    <div key={i} className="break-all py-0.5"><span className="text-slate-500">[{i}]:</span> {typeof p === 'object' ? JSON.stringify(p) : p}</div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">Bản ghi độc lập (Single Leaf Node)</div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}