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
  CREATE: 'bg-slate-50 text-slate-600 border-slate-200',
  UPDATE: 'bg-slate-50 text-slate-600 border-slate-200',
  DELETE: 'bg-slate-50 text-slate-600 border-slate-200',
  LOGIN_PASSWORD: 'bg-slate-50 text-slate-600 border-slate-200',
  LOGIN_INVITE: 'bg-slate-50 text-slate-600 border-slate-200',
  LOGIN_FAIL: 'bg-slate-50 text-slate-600 border-slate-200',
  FACE_VERIFY_PASS: 'bg-slate-50 text-slate-600 border-slate-200',
  FACE_VERIFY_FAIL: 'bg-slate-50 text-slate-600 border-slate-200',
  FACE_INTEGRITY_FAIL: 'bg-slate-50 text-slate-600 border-slate-200',
  FACE_ENROLL: 'bg-slate-50 text-slate-600 border-slate-200',
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
  ADMIN: 'bg-slate-50 text-slate-600 border-slate-200',
  RECEPTIONIST: 'bg-slate-50 text-slate-600 border-slate-200',
  DOCTOR: 'bg-slate-50 text-slate-600 border-slate-200',
  LAB_MANAGER: 'bg-slate-50 text-slate-600 border-slate-200',
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
  VERIFIED: 'border-slate-200 bg-slate-50 text-slate-600',
  PENDING: 'border-slate-200 bg-slate-50 text-slate-600',
  TAMPERED: 'border-rose-100 bg-rose-50 text-rose-600',
};

const VERIFICATION_LABEL = {
  VERIFIED: 'Toàn vẹn',
  PENDING: 'Chờ kiểm tra',
  TAMPERED: 'Nghi sửa đổi',
};

function renderDiffValue(value, _redacted) {
  if (value === null || value === undefined || value === '') return '—';
  if (value === '[REDACTED]') return 'Đã ẩn trong bản ghi cũ';
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
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex justify-end">
          <button
            id="audit-anchor-now-button"
            type="button"
            onClick={handleAnchorNow}
            disabled={anchoring}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-60"
          >
            <LockKeyhole className="h-4 w-4" />
            {anchoring ? 'Đang neo dữ liệu...' : 'Neo blockchain ngay'}
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
              Hoạt động ({logsTotal})
            </TabButton>
            <TabButton active={tab === 'batches'} onClick={() => setTab('batches')}>
              Lô blockchain ({batchesTotal})
            </TabButton>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Đồng bộ
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
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <FilterChip active={!entity} onClick={() => setEntity('')}>Tất cả dữ liệu</FilterChip>
            {Object.entries(ENTITY_LABELS).map(([key, value]) => (
              <FilterChip key={key} active={entity === key} onClick={() => setEntity(key)}>
                {value}
              </FilterChip>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px_96px]">
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-black text-slate-600 transition-colors hover:bg-cyan-50 hover:text-cyan-700"
            >
              {sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              {sortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}
            </button>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">#</span>
              <input
                type="text"
                value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyBatch(); }}
                placeholder="Số lô"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-7 pr-2 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <button type="button" onClick={applyBatch} className="rounded-xl bg-cyan-600 px-3 py-2.5 text-xs font-black text-white hover:bg-cyan-700">Tìm</button>
          </div>
          {batchFilter !== '' && (
            <button type="button" onClick={() => { setBatchInput(''); setBatchFilter(''); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50">Xóa lọc lô #{batchFilter}</button>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Danh sách nhật ký</h2>
            <p className="text-sm font-semibold text-slate-400">Theo dõi thay đổi dữ liệu và trạng thái toàn vẹn.</p>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-black text-slate-500">{total} bản ghi</span>
        </div>

        {!logs.length ? (
          <Empty
            title="Không tìm thấy nhật ký"
            desc={entity || batchFilter !== '' ? 'Không có bản ghi nào khớp với bộ lọc hiện tại.' : 'Hệ thống chưa ghi nhận hoạt động thay đổi dữ liệu.'}
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <article key={log.id} className="grid gap-5 px-6 py-4 transition-colors hover:bg-slate-50 xl:grid-cols-[1.35fr_1.25fr_1fr_0.95fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">SEQ {log.seq ?? '—'}</span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black ${ACTION_TONE[log.action] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {ACTION_LABEL[log.action] || log.action}
                      </span>
                    </div>
                    <h3 className="mt-1 truncate text-sm font-black text-slate-950">{subjectTitle(log)}</h3>
                    <p className="mt-1 truncate text-xs font-semibold text-slate-400">{ENTITY_LABELS[log.entity] || log.subject?.label || log.entity} · {subjectSubtitle(log)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Nội dung thay đổi</p>
                    <DiffPreview log={log} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Người thao tác</p>
                    <ActorCell log={log} />
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Thời điểm</p>
                      <p className="text-xs font-bold text-slate-600">{formatTime(log.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${log.onChainStatus === 'ANCHORED' ? 'bg-slate-50 text-slate-600 border-slate-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {log.onChainStatus === 'ANCHORED' ? `Lô #${log.batchId}` : 'Hàng đợi'}
                      </span>
                      <VerificationBadge status={log.blockchainStatus} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <button type="button" onClick={() => setDetail(log)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-cyan-600 hover:bg-cyan-50">Chi tiết</button>
                    {log.onChainStatus === 'ANCHORED' && <button type="button" onClick={() => onProof(log.seq)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600">Chứng chỉ</button>}
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} label="bản ghi" onPrev={onPrev} onNext={onNext} />
          </>
        )}

        {detail && <LogDetailModal summaryLog={detail} onClose={() => setDetail(null)} onProof={onProof} />}
      </section>
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
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-black tracking-tight text-slate-950">Bản ghi #{log.seq ?? '—'}</h2>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${ACTION_TONE[log.action] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {ACTION_LABEL[log.action] || log.action}
              </span>
              <VerificationBadge status={log.blockchainStatus} />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500 transition-colors hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {detailError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              {detailError}
            </div>
          )}

          {/* Quick Stats Summary Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Subject Data Meta */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
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
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" /> Người thao tác
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
            <div className="text-xs font-black text-slate-400 uppercase font-sans tracking-wide">Mã kiểm tra toàn vẹn</div>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span className="text-slate-400">Current Entry Hash:</span>
                <span className="text-slate-700 font-medium break-all text-right max-w-md">{log.hashes?.entryHash || log.entryHash || '—'}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-slate-400">Previous Record Hash:</span>
                <span className="text-slate-700 font-medium break-all text-right max-w-md">{log.hashes?.prevHash || log.prevHash || '—'}</span>
              </div>
            </div>
          </div>

          {/* Diff Changes Field Level Section */}
          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <FileDiff className="h-3.5 w-3.5 text-cyan-600" /> Thay đổi dữ liệu
              </h3>
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
        <div className="border-t border-slate-100 bg-slate-50 p-4 flex items-center justify-between">
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
                Xem bằng chứng blockchain
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-cyan-700"
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
    <div className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex items-start justify-between ${bg}`}>
      <div className="space-y-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-black tracking-tight ${color}`}>{value}</p>
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
      className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${active
        ? 'bg-cyan-50 text-cyan-700 border border-cyan-100'
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
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
      className={`rounded-xl border px-2.5 py-1 text-xs font-black transition-colors shrink-0 ${active
        ? 'bg-cyan-600 text-white border-cyan-600'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-cyan-50 hover:text-cyan-700'
        }`}
    >
      {children}
    </button>
  );
}

function Pagination({ page, totalPages, total, label = 'bản ghi', onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4">
      <p className="text-sm font-semibold text-slate-500">Trang {page}/{totalPages} · {total} {label}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50">Trước</button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50">Sau</button>
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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-slate-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-100 bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700">
              <ShieldCheck className="h-3 w-3" /> Bằng chứng blockchain
            </span>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Chứng chỉ bản ghi #{proof.seq}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-400">Dùng để đối chiếu bản ghi trong cây Merkle đã neo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500 transition-colors hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
          {proof.loading ? (
            <LoadingIndicator size="sm" label="Đang tải chứng chỉ..." />
          ) : proof.error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 font-bold text-rose-700">{proof.error}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Merkle Root</p>
                <p className="mt-2 break-all font-mono text-xs font-bold text-slate-700">{proof.data?.merkleRoot || proof.data?.root || '—'}</p>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Node băm liên quan</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.isArray(proof.data?.proof) && proof.data.proof.length > 0 ? (
                    proof.data.proof.map((p, i) => (
                      <div key={i} className="grid gap-2 px-4 py-3 md:grid-cols-[56px_1fr]">
                        <span className="text-xs font-black text-cyan-600">#{i + 1}</span>
                        <span className="break-all font-mono text-xs font-semibold text-slate-600">{typeof p === 'object' ? JSON.stringify(p) : p}</span>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-5 text-center text-sm font-semibold text-slate-400">Bản ghi độc lập, không có node lân cận.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4">
          <button type="button" onClick={onClose} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-cyan-700">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}