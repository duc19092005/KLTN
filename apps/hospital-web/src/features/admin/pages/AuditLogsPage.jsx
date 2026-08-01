import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { auditService } from '../apis/auditService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { FaceStepUpModal } from '../../auth';
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
  History,
  Activity
} from 'lucide-react';

const ACTION_TONE = {
  CREATE: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  UPDATE: 'bg-sky-50 text-sky-700 border-sky-200/80',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-200/80',
  LOGIN_PASSWORD: 'bg-sky-50 text-sky-700 border-sky-200/80',
  LOGIN_INVITE: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  LOGIN_FAIL: 'bg-rose-50 text-rose-700 border-rose-200/80',
  FACE_VERIFY_PASS: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  FACE_VERIFY_FAIL: 'bg-rose-50 text-rose-700 border-rose-200/80',
  FACE_INTEGRITY_FAIL: 'bg-rose-50 text-rose-700 border-rose-200/80',
  FACE_ENROLL: 'bg-sky-50 text-sky-700 border-sky-200/80',
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
  ADMIN: 'bg-slate-100 text-slate-700 border-slate-200',
  RECEPTIONIST: 'bg-sky-50 text-sky-700 border-sky-200/80',
  DOCTOR: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  LAB_MANAGER: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
};

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  if (clean.length <= 18) return clean;
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`;
}

function canRecoverBatch(batch) {
  if (!batch) return false;
  if (batch.status !== 'ANCHORED' || !batch.artifactAvailable) return false;
  const integrity = batch.integrity || {};
  return integrity.status === 'TAMPERED' || Number(integrity.tampered) > 0;
}

function recoverBatchDisabledReason(batch) {
  if (!batch) return 'Không có lô.';
  if (batch.status !== 'ANCHORED') return 'Chỉ khôi phục lô đã neo on-chain.';
  if (!batch.artifactAvailable) return 'Lô không có artifact IPFS để khôi phục.';
  const integrity = batch.integrity || {};
  if (integrity.status === 'TAMPERED' || Number(integrity.tampered) > 0) return '';
  if (integrity.status === 'PENDING') return 'Lô thiếu field hash — không mở khôi phục (chưa kết luận bị sửa).';
  return 'Lô đang toàn vẹn — không cần khôi phục.';
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour12: false }) : 'N/A';
}

const VERIFICATION_TONE = {
  VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  TAMPERED: 'border-rose-200 bg-rose-50 text-rose-600',
};

const VERIFICATION_LABEL = {
  VERIFIED: 'Toàn vẹn',
  PENDING: 'Thiếu field hash',
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

export default function AuditLogsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [chain, setChain] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [anchoring, setAnchoring] = useState(false);
  const [proof, setProof] = useState(null);
  const [recoveryTarget, setRecoveryTarget] = useState(null);
  const [recoveryReason, setRecoveryReason] = useState('');
  const [recoveryFaceOpen, setRecoveryFaceOpen] = useState(false);
  const [recoveringBatchId, setRecoveringBatchId] = useState(null);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [batchDetail, setBatchDetail] = useState(null);
  const [batchDetailLoading, setBatchDetailLoading] = useState(false);
  const [seqDetail, setSeqDetail] = useState(null);
  const [pendingQueue, setPendingQueue] = useState({ total: 0, items: [] });
  const [entityWarnings, setEntityWarnings] = useState([]);
  const [entityWarningsLoading, setEntityWarningsLoading] = useState(false);
  const [selectedEntityWarnings, setSelectedEntityWarnings] = useState([]);
  const [entityRecoveryReason, setEntityRecoveryReason] = useState('');
  const [recoveringEntities, setRecoveringEntities] = useState(false);

  const [batchesPage, setBatchesPage] = useState(1);
  const [batchesTotalPages, setBatchesTotalPages] = useState(1);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [batchSortBy, setBatchSortBy] = useState('batchId');
  const [batchSortOrder, setBatchSortOrder] = useState('desc');

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditService.batches({
        page: batchesPage,
        limit: 10,
        sortBy: batchSortBy,
        sort: batchSortOrder,
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
  }, [batchesPage, batchSortBy, batchSortOrder, toast]);

  useEffect(() => {
    setBatchesPage(1);
  }, [batchSortBy, batchSortOrder]);

  const loadPendingQueue = useCallback(async () => {
    try {
      const res = await auditService.logs({ page: 1, limit: 20, sort: 'desc', verificationStatus: 'PENDING' });
      const items = (res.data?.items || []).filter((item) => item.batchId == null);
      setPendingQueue({ total: items.length, items: items.slice(0, 5) });
    } catch {
      setPendingQueue({ total: 0, items: [] });
    }
  }, []);

  const loadChain = useCallback(async () => {
    try {
      const res = await auditService.verifyChain();
      setChain(res.data);
    } catch (err) {
      console.error('Không tải được trạng thái chuỗi', err);
    }
  }, []);

  const loadEntityWarnings = useCallback(async () => {
    setEntityWarningsLoading(true);
    try {
      const res = await auditService.entityWarnings({ limit: 100 });
      const items = res.data?.items || [];
      setEntityWarnings(items);
      setSelectedEntityWarnings((selected) => selected.filter((key) => items.some((item) => `${item.entity}:${item.entityId}` === key && item.recoverable)));
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được cảnh báo toàn vẹn dữ liệu.');
    } finally {
      setEntityWarningsLoading(false);
    }
  }, [toast]);

  const openBatchDetail = useCallback(async (batchId) => {
    setSelectedBatchId(batchId);
    setBatchDetailLoading(true);
    setBatchDetail(null);
    try {
      const res = await auditService.batchDetail(batchId);
      setBatchDetail(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được chi tiết lô');
      setSelectedBatchId(null);
    } finally {
      setBatchDetailLoading(false);
    }
  }, [toast]);

  const refreshAll = useCallback(async () => {
    await loadBatches();
    await loadPendingQueue();
    await loadChain();
    await loadEntityWarnings();
    if (selectedBatchId) await openBatchDetail(selectedBatchId);
  }, [loadBatches, loadPendingQueue, loadChain, loadEntityWarnings, selectedBatchId, openBatchDetail]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadPendingQueue();
    loadChain();
    loadEntityWarnings();
  }, [loadPendingQueue, loadChain, loadEntityWarnings]);

  const stats = useMemo(() => {
    return {
      batches: batchesTotal,
      isChainOk: chain?.ok ?? true,
      chainLength: chain?.total ?? 0,
      pending: pendingQueue.total,
    };
  }, [batchesTotal, chain, pendingQueue.total]);

  const filteredBatches = useMemo(() => {
    if (!appliedQ) return batches;
    const q = appliedQ.toLowerCase();
    return batches.filter((b) => {
      const summaryText = (b.contentSummary || [])
        .flatMap((item) => [item.entity, ...(item.samples || [])])
        .join(' ')
        .toLowerCase();
      return String(b.batchId).includes(q)
        || summaryText.includes(q)
        || (b.merkleRoot || '').toLowerCase().includes(q);
    });
  }, [batches, appliedQ]);

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

  const handleRecoveryTicket = async (ticket) => {
    if (!recoveryTarget) return;
    setRecoveryFaceOpen(false);
    setRecoveringBatchId(recoveryTarget.batchId);
    try {
      const res = await auditService.recoverBatch(recoveryTarget.batchId, recoveryReason.trim(), ticket);
      const data = res.data || {};
      toast.success(`Đã khôi phục batch #${data.batchId} (${data.restoredCount} audit logs).`);
      setRecoveryTarget(null);
      setRecoveryReason('');
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Khôi phục audit batch thất bại.');
    } finally {
      setRecoveringBatchId(null);
    }
  };

  const handleEntityRecovery = async () => {
    const selected = entityWarnings.filter((item) => selectedEntityWarnings.includes(`${item.entity}:${item.entityId}`) && item.recoverable);
    if (!selected.length || entityRecoveryReason.trim().length < 10) return;
    setRecoveringEntities(true);
    try {
      const res = await auditService.recoverEntities(
        selected.map(({ entity, entityId }) => ({ entity, entityId })),
        entityRecoveryReason.trim(),
      );
      const data = res.data || {};
      if (data.failed > 0) {
        const details = (data.results || [])
          .filter((item) => item.status === 'FAILED' && item.message)
          .slice(0, 3)
          .map((item) => `${ENTITY_LABELS[item.entity] || item.entity}: ${item.message}`)
          .join(' ');
        toast.error(`Khôi phục ${data.recovered || 0}/${data.requested || selected.length} bản ghi; ${data.failed} bản ghi thất bại.${details ? ` ${details}` : ''}`);
      } else if (data.recovered > 0) {
        toast.success(`Đã khôi phục ${data.recovered} bản ghi từ audit đã xác minh blockchain.`);
      } else {
        toast.success('Dữ liệu đã khớp audit tin cậy, không cần ghi đè.');
      }
      setSelectedEntityWarnings([]);
      setEntityRecoveryReason('');
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Khôi phục dữ liệu thất bại.');
    } finally {
      setRecoveringEntities(false);
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
      <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
        <Hero onRefresh={refreshAll} onAnchor={handleAnchorNow} loading={loading} anchoring={anchoring} totalBatches={stats.batches} />

        <ChainBanner chain={chain} loading={false} />

        <EntityRecoveryPanel
          warnings={entityWarnings}
          loading={entityWarningsLoading}
          selected={selectedEntityWarnings}
          setSelected={setSelectedEntityWarnings}
          reason={entityRecoveryReason}
          setReason={setEntityRecoveryReason}
          recovering={recoveringEntities}
          onRecover={handleEntityRecovery}
          onRefresh={loadEntityWarnings}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Lô đã neo" value={stats.batches} hint="Mỗi lô = 1 Merkle root on-chain" icon={Layers} />
          <StatCard label="Chuỗi hash DB" value={stats.isChainOk ? 'OK' : 'Lệch'} hint={`${stats.chainLength} seq`} icon={stats.isChainOk ? ShieldCheck : ShieldAlert} color={stats.isChainOk ? 'text-emerald-700' : 'text-rose-700'} />
          <StatCard label="Hàng đợi chưa neo" value={stats.pending} hint="Log đã ghi DB, chưa vào lô" icon={History} color="text-amber-700" />
        </div>

        {pendingQueue.total > 0 && (
          <section className="rounded-3xl border border-amber-200/80 bg-amber-50/70 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-amber-900">Hàng đợi chưa neo ({pendingQueue.total}+)</p>
                <p className="text-xs font-semibold text-amber-800/80">Các SEQ này chưa có batchId — tự động neo hoặc bấm “Neo blockchain ngay”.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {pendingQueue.items.map((log) => (
                <span key={log.id} className="rounded-xl border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-900 shadow-xs">
                  SEQ {log.seq} · {ENTITY_LABELS[log.entity] || log.entity} · {ACTION_LABEL[log.action] || log.action}
                </span>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_140px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setAppliedQ(searchQ.trim()); }}
                placeholder="Lọc lô theo số lô, mã PB, tên phòng ban, NV, AI..."
                className="w-full rounded-xl border border-slate-200/80 bg-slate-50 py-2.5 pl-10 pr-4 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setAppliedQ(searchQ.trim())}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700"
            >
              Lọc
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Sắp xếp</span>
            <button
              type="button"
              onClick={() => setBatchSortBy('batchId')}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${batchSortBy === 'batchId' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              Theo số lô
            </button>
            <button
              type="button"
              onClick={() => setBatchSortBy('time')}
              className={`rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${batchSortBy === 'time' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              Theo thời gian
            </button>
            <button
              type="button"
              onClick={() => setBatchSortOrder((v) => (v === 'desc' ? 'asc' : 'desc'))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition-all"
            >
              {batchSortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
              {batchSortBy === 'batchId'
                ? (batchSortOrder === 'desc' ? 'Số lô giảm dần' : 'Số lô tăng dần')
                : (batchSortOrder === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước')}
            </button>
          </div>
          {appliedQ && (
            <button type="button" onClick={() => { setSearchQ(''); setAppliedQ(''); }} className="text-xs font-bold text-sky-700">
              Xóa lọc “{appliedQ}”
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
            <LoadingIndicator size="lg" label="Đang tải danh sách lô..." />
          </div>
        ) : (
          <BatchesHomeTable
            batches={filteredBatches}
            page={batchesPage}
            totalPages={batchesTotalPages}
            total={batchesTotal}
            sortBy={batchSortBy}
            sortOrder={batchSortOrder}
            recoveringBatchId={recoveringBatchId}
            onOpenDetail={openBatchDetail}
            onRecover={(batch) => { setRecoveryTarget(batch); setRecoveryReason(''); }}
            onPrev={() => setBatchesPage((v) => Math.max(1, v - 1))}
            onNext={() => setBatchesPage((v) => Math.min(batchesTotalPages, v + 1))}
          />
        )}
      </div>

      {(selectedBatchId || batchDetailLoading) && (
        <BatchDetailDrawer
          loading={batchDetailLoading}
          detail={batchDetail}
          recoveringBatchId={recoveringBatchId}
          onClose={() => { setSelectedBatchId(null); setBatchDetail(null); }}
          onRecover={(batch) => { setRecoveryTarget(batch); setRecoveryReason(''); }}
          onProof={handleProof}
          onOpenSeq={setSeqDetail}
        />
      )}

      {seqDetail && (
        <LogDetailModal
          summaryLog={seqDetail}
          onClose={() => setSeqDetail(null)}
          onProof={handleProof}
          onRecoverBatch={(batchId) => {
            setRecoveryTarget({ batchId, status: 'ANCHORED', artifactAvailable: true });
            setRecoveryReason('');
            setSeqDetail(null);
          }}
          onOpenBatch={(batchId) => {
            setSeqDetail(null);
            openBatchDetail(batchId);
          }}
        />
      )}

      {proof && <ProofModal proof={proof} onClose={() => setProof(null)} />}
      {recoveryTarget && !recoveryFaceOpen && (
        <RecoveryReasonModal
          batch={recoveryTarget}
          reason={recoveryReason}
          setReason={setRecoveryReason}
          onClose={() => { setRecoveryTarget(null); setRecoveryReason(''); }}
          onContinue={() => setRecoveryFaceOpen(true)}
        />
      )}
      {recoveryTarget && recoveryFaceOpen && (
        <FaceStepUpModal
          action="RECOVER_AUDIT_BATCH"
          resourceId={String(recoveryTarget.batchId)}
          title={`Quét khuôn mặt để khôi phục batch #${recoveryTarget.batchId}`}
          description="Backend sẽ kiểm chứng blockchain và IPFS trước khi thay audit logs. Nội dung bệnh án không được hiển thị."
          onSuccess={handleRecoveryTicket}
          onClose={() => setRecoveryFaceOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}

function Hero({ onRefresh, onAnchor, loading, anchoring, totalBatches }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 border border-sky-200/60">
              Audit & Blockchain ({totalBatches} lô neo)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Nhật ký Audit & Neo Blockchain
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Giám sát toàn vẹn dữ liệu, kiểm tra cây Merkle và khôi phục khi phát hiện bất thường.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-sky-50 hover:text-sky-700 transition-all shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Đồng bộ
          </button>
          <button
            id="audit-anchor-now-button"
            type="button"
            onClick={onAnchor}
            disabled={anchoring}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 transition-all disabled:opacity-60"
          >
            <LockKeyhole className="h-4 w-4" />
            {anchoring ? 'Đang neo dữ liệu...' : 'Neo blockchain ngay'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntityRecoveryPanel({ warnings, loading, selected, setSelected, reason, setReason, recovering, onRecover, onRefresh }) {
  const recoverable = warnings.filter((item) => item.recoverable);
  const allSelected = recoverable.length > 0 && recoverable.every((item) => selected.includes(`${item.entity}:${item.entityId}`));
  const selectedCount = recoverable.filter((item) => selected.includes(`${item.entity}:${item.entityId}`)).length;
  const toggleAll = () => setSelected(allSelected ? [] : recoverable.map((item) => `${item.entity}:${item.entityId}`));
  const toggleOne = (key) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  if (!loading && warnings.length === 0) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          Không phát hiện entity lệch với audit đã neo
        </div>
        <button type="button" onClick={onRefresh} className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-100" title="Quét lại dữ liệu">
          <RefreshCw className="h-4 w-4" />
        </button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-6 py-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-rose-950">Dữ liệu cần kiểm tra ({warnings.length})</h2>
            <p className="mt-0.5 text-xs font-semibold text-rose-700">Thao tác sửa và xóa trên các bản ghi này đang bị chặn.</p>
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading || recovering} className="rounded-xl p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="Quét lại dữ liệu">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="w-12 px-6 py-3.5">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!recoverable.length || recovering} aria-label="Chọn tất cả bản ghi có thể khôi phục" className="h-4 w-4 accent-sky-600" />
              </th>
              <th className="px-4 py-3.5 font-bold">Đối tượng</th>
              <th className="px-4 py-3.5 font-bold">Mốc tin cậy</th>
              <th className="px-4 py-3.5 font-bold">Phát hiện</th>
              <th className="px-4 py-3.5 font-bold">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {warnings.map((item) => {
              const key = `${item.entity}:${item.entityId}`;
              const fields = (item.fieldsChanged || []).map((field) => field === 'SENSITIVE_FIELD_CHANGED'
                ? 'Trường nhạy cảm đã thay đổi'
                : fieldDisplayName({ fieldPath: `${item.entity}.${field}`, field }));
              return (
                <tr key={key} className="align-top hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <input type="checkbox" checked={selected.includes(key)} onChange={() => toggleOne(key)} disabled={!item.recoverable || recovering} aria-label={`Chọn ${item.entity}`} className="h-4 w-4 accent-sky-600 disabled:opacity-30" />
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-bold text-slate-900">{ENTITY_LABELS[item.entity] || item.entity}</p>
                    <p className="mt-1 font-mono text-[10px] text-slate-400">{shortHash(item.entityId)}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p className="font-bold">SEQ {item.latestTrustedSeq ?? '—'} · Batch #{item.batchId ?? '—'}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{formatTime(item.anchoredAt)}</p>
                  </td>
                  <td className="max-w-sm px-4 py-4 text-slate-600">
                    <p className="font-semibold">{fields.length ? fields.join(', ') : 'Không công khai chi tiết dữ liệu'}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{item.message}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${item.recoverable ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {item.recoverable ? 'Có thể khôi phục' : 'Cần xử lý audit/PITR'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {recoverable.length > 0 && (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block space-y-1.5">
            <span className="block text-xs font-bold text-slate-700">Lý do khôi phục</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Nhập lý do hoặc mã sự cố..." className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100" />
          </label>
          <button type="button" onClick={onRecover} disabled={recovering || selectedCount === 0 || reason.trim().length < 10} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40 shadow-xs">
            <RefreshCw className={`h-4 w-4 ${recovering ? 'animate-spin' : ''}`} />
            {recovering ? 'Đang khôi phục...' : `Khôi phục ${selectedCount} bản ghi`}
          </button>
        </div>
      )}
    </section>
  );
}

function ChainBanner({ chain, loading }) {
  if (loading || !chain) {
    return (
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
        <p className="text-xs font-semibold text-slate-500">Đang quét chuỗi khối để kiểm tra tính toàn vẹn cơ sở dữ liệu…</p>
      </section>
    );
  }
  const ok = chain.ok;
  return (
    <section
      className={`rounded-3xl border p-5 shadow-sm transition-all ${ok ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900 animate-pulse'}`}
    >
      <div className="flex items-start gap-3">
        {ok ? <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm font-bold">
            {ok ? 'Cơ sở dữ liệu audit hoàn toàn mật thiết & toàn vẹn' : 'CẢNH BÁO: Phát hiện bất thường cấu trúc dữ liệu!'}
          </p>
          <p className="mt-1 text-xs font-medium opacity-90">
            {ok
              ? `Hệ thống đã đối chiếu thành công ${chain.total} bản ghi. Không tìm thấy bất kỳ dấu hiệu sửa đổi, chèn hoặc xóa lén dữ liệu.`
              : `Lỗi bất đối xứng mã băm được phát hiện tại bản ghi Sequence = ${chain.brokenAtSeq}. Lý do từ hệ thống: ${chain.reason}`}
          </p>
        </div>
      </div>
    </section>
  );
}

const ENTITY_LABELS = {
  Department: 'Phòng ban',
  StaffProfile: 'Nhân sự',
  DoctorProfile: 'Bác sĩ',
  Patient: 'Bệnh nhân',
  AiModelRegistry: 'Mô hình AI',
  MedicalConclusion: 'Kết luận y khoa',
  AiDiagnosis: 'Chẩn đoán AI',
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

function LogDetailModal({ summaryLog, onClose, onProof, onRecoverBatch, onOpenBatch }) {
  const [log, setLog] = useState(summaryLog);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const actor = log.actor;

  const loadDetail = async () => {
    if (summaryLog?.seq == null) return;
    setDetailLoading(true);
    setDetailError('');
    try {
      const res = await auditService.detail(summaryLog.seq);
      setLog(res.data || summaryLog);
    } catch (err) {
      setDetailError(err?.response?.data?.message || err.message || 'Không tải được chi tiết audit.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    setLog(summaryLog);
    loadDetail();
  }, [summaryLog?.seq]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex flex-col w-full max-w-[1120px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Bản ghi #{log.seq ?? '—'}</h2>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${ACTION_TONE[log.action] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {ACTION_LABEL[log.action] || log.action}
              </span>
              <VerificationBadge status={log.blockchainStatus} />
              {log.onChainStatus === 'ANCHORED' && log.batchId != null && (
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                  Thuộc lô #{log.batchId}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">{subjectTitle(log)} · {ENTITY_LABELS[log.entity] || log.entity}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {log.onChainStatus === 'ANCHORED' && log.batchId != null && (
              <button
                type="button"
                onClick={() => { onOpenBatch?.(log.batchId); onClose(); }}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Xem lô #{log.batchId}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {detailError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              {detailError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Đối tượng chịu tác động
              </h4>
              <div className="space-y-2">
                <DetailField label="Danh mục thực thể" value={ENTITY_LABELS[log.entity] || log.entity} />
                <DetailField label="Tiêu đề đối tượng" value={subjectTitle(log)} highlight />
                <DetailField label="Mã định danh Entity ID" value={log.entityId} mono />
                <DetailField label="Chi tiết bổ sung" value={subjectSubtitle(log)} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <UserIcon className="h-4 w-4" /> Người thao tác
              </h4>
              <div className="space-y-2">
                <DetailField label="Người thực thi" value={actor?.displayName || 'Hệ thống tự động'} highlight={Boolean(actor)} />
                <DetailField label="Vai trò nghiệp vụ" value={actor ? (ROLE_LABELS[actor.role] || actor.role) : '—'} />
                <DetailField label="Mã định danh Actor ID" value={log.actorId || '—'} mono />
                <DetailField label="Thời gian hệ thống" value={formatTime(log.createdAt)} />
              </div>
            </div>
          </div>

          <div className="p-5 border border-slate-200/80 rounded-2xl space-y-2 bg-slate-50/50 font-mono text-[11px]">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Mã kiểm tra toàn vẹn</div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-400">Current Entry Hash:</span>
                <span className="text-slate-700 font-bold break-all text-right max-w-md">{log.hashes?.entryHash || log.entryHash || '—'}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Previous Record Hash:</span>
                <span className="text-slate-700 font-bold break-all text-right max-w-md">{log.hashes?.prevHash || log.prevHash || '—'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <FileDiff className="h-4 w-4 text-sky-600" /> Thay đổi dữ liệu
              </h3>
            </div>

            {Array.isArray(log.diff) && log.diff.length > 0 ? (
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100">
                      <th className="px-4 py-3">Trường thuộc tính</th>
                      <th className="px-4 py-3 bg-rose-50/30 text-rose-800">Dữ liệu trước (Before)</th>
                      <th className="px-4 py-3 bg-emerald-50/30 text-emerald-800">Dữ liệu sau (After)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {log.diff.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div className="text-slate-900 font-bold">{fieldDisplayName(item)}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{fieldTechnicalName(item)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 bg-rose-50/10 max-w-xs break-all">
                          {renderDiffValue(item.before, item.redacted)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-900 font-bold bg-emerald-50/10 max-w-xs break-all">
                          {renderDiffValue(item.after, item.redacted)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium italic">
                Bản ghi này không ghi nhận biến động dữ liệu dạng bảng (Chỉ lưu vết sự kiện).
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-5 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-medium">
            Mã định danh CSDL: <span className="font-mono text-slate-600 font-bold">{log.id}</span>
          </div>
          <div className="flex gap-2">
            {log.onChainStatus === 'ANCHORED' && (
              <button
                type="button"
                onClick={() => { onClose(); onProof(log.seq); }}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Xem bằng chứng blockchain
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-sky-700 shadow-xs"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function VerificationBadge({ status, title }) {
  const Icon = status === 'VERIFIED' ? ShieldCheck : ShieldAlert;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${VERIFICATION_TONE[status] || VERIFICATION_TONE.PENDING}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {VERIFICATION_LABEL[status] || status || 'Không rõ'}
    </span>
  );
}

function DetailField({ label, value, mono = false, highlight = false }) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs border-b border-slate-100/60 pb-1.5 last:border-0 last:pb-0">
      <span className="text-slate-400 font-semibold">{label}:</span>
      <span className={`text-right truncate max-w-[200px] sm:max-w-xs ${mono ? 'font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-[11px]' : ''
        } ${highlight ? 'font-bold text-slate-900' : 'font-bold text-slate-700'}`}>
        {value}
      </span>
    </div>
  );
}

function RecoveryReasonModal({ batch, reason, setReason, onClose, onContinue }) {
  const valid = reason.trim().length >= 10;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200/80" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 p-6">
          <h3 className="text-xl font-bold text-slate-900">Khôi phục audit batch #{batch.batchId}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">Thao tác sẽ tải artifact IPFS, đối chiếu blockchain và phục hồi khi mọi hash khớp.</p>
        </div>
        <div className="p-6 space-y-2">
          <label className="text-xs font-bold text-slate-700" htmlFor="audit-recovery-reason">Lý do khôi phục</label>
          <textarea
            id="audit-recovery-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={4}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
            placeholder="Mô tả sự cố hoặc dấu hiệu sai lệch của batch..."
          />
          <p className="text-[11px] font-semibold text-slate-400">Tối thiểu 10 ký tự.</p>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-slate-100 p-5">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!valid}
            className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-40 shadow-xs"
          >
            Tiếp tục quét mặt
          </button>
        </div>
      </div>
    </div>
  );
}

function BatchesHomeTable({ batches, page, totalPages, total, sortBy, sortOrder, onPrev, onNext, onRecover, onOpenDetail, recoveringBatchId }) {
  const sortHint = sortBy === 'time'
    ? (sortOrder === 'desc' ? 'Thời gian: mới → cũ' : 'Thời gian: cũ → mới')
    : (sortOrder === 'desc' ? 'Số lô: lớn → nhỏ' : 'Số lô: nhỏ → lớn');
  return (
    <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
      <div className="p-6 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between gap-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-sky-600" /> Danh sách lô (mỗi lô gồm nhiều SEQ)
        </div>
        <div className="text-xs font-semibold text-slate-400">
          {sortHint} · Tổng: <span className="font-bold text-slate-800">{total}</span> lô
        </div>
      </div>

      {!batches.length ? (
        <Empty
          title="Chưa có lô nào"
          desc="Khi hệ thống neo Merkle root lên chain, các lô sẽ hiện tại đây. Bấm Neo blockchain ngay nếu hàng đợi còn log."
        />
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {batches.map((b) => {
              const integrity = b.integrity || {};
              return (
                <article key={b.id} className="grid gap-4 px-6 py-5 transition-all hover:bg-slate-50/80 lg:grid-cols-[96px_1.2fr_0.9fr_120px_auto] lg:items-center">
                  <div className="text-center">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Lô</p>
                    <p className="text-2xl font-extrabold text-slate-900">#{b.batchId}</p>
                    <p className="text-xs font-bold text-sky-600">{b.leafCount ?? 0} SEQ</p>
                  </div>
                  <div className="min-w-0">
                    <BatchContentSummary summary={b.contentSummary} fromSeq={b.fromSeq} toSeq={b.toSeq} />
                  </div>
                  <div className="space-y-2">
                    <BatchIntegrityBadge integrity={integrity} />
                    <p className="text-xs font-semibold text-slate-500">
                      Neo: {formatTime(b.anchoredAt || b.createdAt)}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400 break-all" title={b.merkleRoot}>
                      root {shortHash(b.merkleRoot)}
                    </p>
                  </div>
                  <div className="text-center">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${b.status === 'ANCHORED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80' : 'bg-rose-50 text-rose-700 border-rose-200/80'}`}>
                      {BATCH_STATUS_LABEL[b.status] || b.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                    <button
                      type="button"
                      onClick={() => onOpenDetail(b.batchId)}
                      className="rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 transition-all shadow-xs"
                    >
                      Xem chi tiết
                    </button>
                    <button
                      type="button"
                      onClick={() => onRecover(b)}
                      disabled={!canRecoverBatch(b) || recoveringBatchId === b.batchId}
                      title={recoverBatchDisabledReason(b) || 'Khôi phục lô khi kiểm tra toàn vẹn không ổn'}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                    >
                      {recoveringBatchId === b.batchId ? 'Đang khôi phục...' : 'Khôi phục lô'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} label="lô" onPrev={onPrev} onNext={onNext} />
        </>
      )}
    </section>
  );
}

function BatchIntegrityBadge({ integrity }) {
  const status = integrity?.status || 'PENDING';
  const label = status === 'VERIFIED' ? 'Lô toàn vẹn' : status === 'TAMPERED' ? 'Lô nghi sửa đổi' : 'Lô thiếu field hash';
  const tone = status === 'VERIFIED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'TAMPERED'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  return (
    <div className={`rounded-xl border px-3 py-2 ${tone}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="mt-0.5 text-[10px] font-semibold opacity-90">
        OK {integrity?.verified ?? 0} · Lệch {integrity?.tampered ?? 0} · Thiếu {integrity?.pending ?? 0}
        {integrity?.total != null ? ` / ${integrity.total}` : ''}
      </p>
    </div>
  );
}

function BatchDetailDrawer({ loading, detail, recoveringBatchId, onClose, onRecover, onProof, onOpenSeq }) {
  const [entityFilter, setEntityFilter] = useState('');
  const [integrityFilter, setIntegrityFilter] = useState('');
  const [seqQuery, setSeqQuery] = useState('');

  useEffect(() => {
    setEntityFilter('');
    setIntegrityFilter('');
    setSeqQuery('');
  }, [detail?.batchId]);

  const entityOptions = useMemo(() => {
    const logs = detail?.logs || [];
    const counts = new Map();
    for (const log of logs) {
      counts.set(log.entity, (counts.get(log.entity) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([entity, count]) => ({ entity, count }));
  }, [detail?.logs]);

  const filteredLogs = useMemo(() => {
    const logs = detail?.logs || [];
    const q = seqQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (entityFilter && log.entity !== entityFilter) return false;
      const integrity = log.blockchainStatus || log.verification?.status || 'PENDING';
      if (integrityFilter && integrity !== integrityFilter) return false;
      if (q) {
        const hay = [
          String(log.seq ?? ''),
          log.entity,
          log.action,
          subjectTitle(log),
          subjectSubtitle(log),
          ENTITY_LABELS[log.entity] || '',
          ACTION_LABEL[log.action] || '',
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [detail?.logs, entityFilter, integrityFilter, seqQuery]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-600">Chi tiết lô</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900">
              {detail ? `Lô #${detail.batchId}` : loading ? 'Đang tải…' : 'Lô'}
            </h2>
            {detail && (
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {detail.leafCount ?? detail.logs?.length ?? 0} SEQ · seq {detail.fromSeq} → {detail.toSeq}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && <LoadingIndicator size="lg" label="Đang tải SEQ trong lô..." />}
          {!loading && detail && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <BatchIntegrityBadge integrity={detail.integrity} />
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">On-chain</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">{BATCH_STATUS_LABEL[detail.status] || detail.status}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500 break-all">{detail.merkleRoot || '—'}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">Neo: {formatTime(detail.anchoredAt || detail.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <p className="mb-2 text-[10px] font-extrabold uppercase text-slate-400">Đối tượng trong lô</p>
                <BatchContentSummary
                  summary={detail.contentSummary}
                  fromSeq={detail.fromSeq}
                  toSeq={detail.toSeq}
                  activeEntity={entityFilter}
                  onSelectEntity={(entity) => setEntityFilter((current) => (current === entity ? '' : entity))}
                />
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <button
                  type="button"
                  onClick={() => onRecover(detail)}
                  disabled={!canRecoverBatch(detail) || recoveringBatchId === detail.batchId}
                  title={recoverBatchDisabledReason(detail) || 'Khôi phục lô khi kiểm tra toàn vẹn không ổn'}
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition-all"
                >
                  {recoveringBatchId === detail.batchId ? 'Đang khôi phục...' : `Khôi phục lô #${detail.batchId}`}
                </button>
                {!canRecoverBatch(detail) && (
                  <span className="text-xs font-semibold text-slate-400">
                    {recoverBatchDisabledReason(detail)}
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Các SEQ thuộc lô #{detail.batchId}</h3>
                    <p className="text-xs font-medium text-slate-400">Lọc theo entity có trong lô này.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={!entityFilter} onClick={() => setEntityFilter('')}>
                      Tất cả ({detail.logs?.length || 0})
                    </FilterChip>
                    {entityOptions.map(({ entity, count }) => (
                      <FilterChip
                        key={entity}
                        active={entityFilter === entity}
                        onClick={() => setEntityFilter(entity)}
                      >
                        {ENTITY_LABELS[entity] || entity} ({count})
                      </FilterChip>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={!integrityFilter} onClick={() => setIntegrityFilter('')}>Mọi trạng thái</FilterChip>
                    <FilterChip active={integrityFilter === 'VERIFIED'} onClick={() => setIntegrityFilter('VERIFIED')}>Toàn vẹn</FilterChip>
                    <FilterChip active={integrityFilter === 'TAMPERED'} onClick={() => setIntegrityFilter('TAMPERED')}>Nghi sửa</FilterChip>
                    <FilterChip active={integrityFilter === 'PENDING'} onClick={() => setIntegrityFilter('PENDING')}>Thiếu field</FilterChip>
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={seqQuery}
                      onChange={(e) => setSeqQuery(e.target.value)}
                      placeholder="Lọc SEQ / action / tên đối tượng trong lô..."
                      className="w-full rounded-xl border border-slate-200/80 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                    />
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="grid gap-3 p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center hover:bg-slate-50/80 transition-all">
                      <div>
                        <p className="text-[10px] font-extrabold uppercase text-slate-400">SEQ</p>
                        <p className="text-lg font-bold text-slate-900">{log.seq}</p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ACTION_TONE[log.action] || 'border-slate-200 text-slate-600'}`}>
                            {ACTION_LABEL[log.action] || log.action}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {ENTITY_LABELS[log.entity] || log.entity}
                          </span>
                          <VerificationBadge status={log.blockchainStatus || log.verification?.status} title={log.verification?.reason} />
                        </div>
                        <p className="mt-1 truncate text-sm font-bold text-slate-900">{subjectTitle(log)}</p>
                        <p className="truncate text-xs font-medium text-slate-400">
                          {subjectSubtitle(log)} · {formatTime(log.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => onOpenSeq(log)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-sky-600 hover:bg-sky-50">
                          Chi tiết SEQ
                        </button>
                        {log.onChainStatus === 'ANCHORED' && (
                          <button type="button" onClick={() => onProof(log.seq)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                            Chứng chỉ
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!detail.logs?.length && (
                    <p className="p-6 text-xs font-bold text-slate-400">Lô không có SEQ (dữ liệu lệch).</p>
                  )}
                  {!!detail.logs?.length && !filteredLogs.length && (
                    <p className="p-6 text-xs font-bold text-slate-400">Không có SEQ khớp bộ lọc hiện tại.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BatchContentSummary({ summary, fromSeq, toSeq, activeEntity = '', onSelectEntity }) {
  if (!summary?.length) {
    return (
      <div className="text-xs text-slate-400">
        <p>Chưa có tóm tắt đối tượng.</p>
        <p className="mt-1 font-mono text-[10px]">seq {fromSeq ?? '—'} → {toSeq ?? '—'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 max-w-sm">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">seq {fromSeq ?? '—'} → {toSeq ?? '—'}</p>
      {summary.map((item) => {
        const active = activeEntity === item.entity;
        const clickable = typeof onSelectEntity === 'function';
        const Wrapper = clickable ? 'button' : 'div';
        return (
          <Wrapper
            key={item.entity}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? () => onSelectEntity(item.entity) : undefined}
            className={`w-full rounded-xl border px-3 py-2 text-left transition-all ${
              active
                ? 'border-sky-300 bg-sky-50 ring-2 ring-sky-100'
                : 'border-slate-100 bg-slate-50 hover:border-sky-200 hover:bg-sky-50/50'
            } ${clickable ? 'cursor-pointer' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">{ENTITY_LABELS[item.entity] || item.entity}</span>
              <span className="text-[10px] font-bold text-sky-700">{item.count} bản ghi</span>
            </div>
            {item.samples?.length > 0 && (
              <p className="mt-0.5 text-[10px] font-semibold text-slate-400 truncate" title={item.samples.join(', ')}>
                {item.samples.join(' · ')}
              </p>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, hint, icon: Icon, color = 'text-slate-900', bg = 'bg-white' }) {
  return (
    <div className={`rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-start justify-between ${bg}`}>
      <div className="space-y-1">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={`text-2xl font-extrabold tracking-tight ${color}`}>{value}</p>
        <p className="text-xs font-semibold text-slate-400">{hint}</p>
      </div>
      {Icon && (
        <div className="p-2.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${active
        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
        : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-600'
        }`}
    >
      {children}
    </button>
  );
}

function Pagination({ page, totalPages, total, label = 'bản ghi', onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
      <p className="text-xs font-bold text-slate-500">Trang {page}/{totalPages} · {total} {label}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50">Trang trước</button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-50">Trang sau</button>
      </div>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="p-12 text-center max-w-md mx-auto space-y-2">
      <div className="inline-flex p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mb-2">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-400 font-medium">{desc}</p>
    </div>
  );
}

function ProofModal({ proof, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Bằng chứng blockchain
            </span>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">Chứng chỉ bản ghi #{proof.seq}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">Dùng để đối chiếu bản ghi trong cây Merkle đã neo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
          {proof.loading ? (
            <LoadingIndicator size="sm" label="Đang tải chứng chỉ..." />
          ) : proof.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700">{proof.error}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Merkle Root</p>
                <p className="mt-2 break-all font-mono text-xs font-bold text-slate-700">{proof.data?.merkleRoot || proof.data?.root || '—'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white">
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Node băm liên quan</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {Array.isArray(proof.data?.proof) && proof.data.proof.length > 0 ? (
                    proof.data.proof.map((p, i) => (
                      <div key={i} className="grid gap-2 px-4 py-3 md:grid-cols-[56px_1fr]">
                        <span className="text-xs font-bold text-sky-600">#{i + 1}</span>
                        <span className="break-all font-mono text-xs font-semibold text-slate-600">{typeof p === 'object' ? JSON.stringify(p) : p}</span>
                      </div>
                    ))
                  ) : (
                    <p className="px-4 py-5 text-center text-xs font-semibold text-slate-400">Bản ghi độc lập, không có node lân cận.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-5">
          <button type="button" onClick={onClose} className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-700 shadow-xs">
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
