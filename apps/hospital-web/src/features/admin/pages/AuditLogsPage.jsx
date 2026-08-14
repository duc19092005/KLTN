import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  Activity,
  Zap,
  Maximize2,
  Minimize2,
  Bot,
  Cpu,
  Check,
  ChevronRight,
  Filter,
  Info,
  Scan
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
  MISSING: 'Thiếu trong DB',
};

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
};

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

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  if (clean.length <= 18) return clean;
  return `${clean.slice(0, 8)}…${clean.slice(-6)}`;
}

function canRecoverBatch(batch, chain) {
  if (!batch) return false;
  if (!batch.artifactAvailable) return false;
  if (batch.status === 'MISSING') return true;
  if (batch.status !== 'ANCHORED') return false;
  const integrity = batch.integrity || {};
  const isTamperedLocally = integrity.status === 'TAMPERED' || integrity.status === 'PENDING' || Number(integrity.tampered) > 0 || Number(integrity.pending) > 0;
  if (isTamperedLocally) return true;
  if (chain && !chain.ok && chain.brokenAtSeq != null) {
    let targetSeq = chain.brokenAtSeq;
    if (chain.reason) {
      const match = chain.reason.match(/mong đợi (\d+)/i);
      if (match && match[1]) targetSeq = parseInt(match[1], 10);
    }
    if (batch.fromSeq != null && batch.toSeq != null) {
      if (batch.fromSeq <= targetSeq && batch.toSeq >= targetSeq) {
        return true;
      }
      if (batch.fromSeq <= chain.brokenAtSeq && batch.toSeq >= Math.max(1, targetSeq - 1)) {
        return true;
      }
    } else {
      return true;
    }
  }
  return false;
}

function recoverBatchDisabledReason(batch, chain) {
  if (!batch) return 'Không có lô.';
  if (!batch.artifactAvailable) return 'Lô không có artifact IPFS để khôi phục.';
  if (batch.status === 'MISSING') return '';
  if (batch.status !== 'ANCHORED') return 'Chỉ khôi phục lô đã neo on-chain.';
  if (canRecoverBatch(batch, chain)) return '';
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

function fieldDisplayName(item) {
  const raw = item?.fieldPath || item?.field || '';
  if (FIELD_LABELS[raw]) return FIELD_LABELS[raw];
  const lastSegment = raw.split('.').pop();
  return FIELD_FALLBACK_LABELS[lastSegment] || item?.label || raw || 'Trường dữ liệu';
}

function fieldTechnicalName(item) {
  return item?.fieldPath || item?.field || '';
}

export default function AuditLogsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('batches'); // 'batches' | 'integrity' | 'pending'
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [chain, setChain] = useState(null);
  const [searchQ, setSearchQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [anchoring, setAnchoring] = useState(false);
  const [anchorStage, setAnchorStage] = useState(0); // 0 = idle, 1 = Chuẩn bị, 2 = IPFS, 3 = Artifact Ready, 4 = Neo Blockchain, 5 = Hoàn tất
  const [anchoringBatchInfo, setAnchoringBatchInfo] = useState(null); // { batchId, leafCount }
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
  const [entityRecoveryFaceOpen, setEntityRecoveryFaceOpen] = useState(false);
  const [entityRecoveryAlert, setEntityRecoveryAlert] = useState(null);
  const [entityRecoveryProgress, setEntityRecoveryProgress] = useState(null);
  const [entityRecoveryCollapsed, setEntityRecoveryCollapsed] = useState(false);

  const [batchesPage, setBatchesPage] = useState(1);
  const [batchesTotalPages, setBatchesTotalPages] = useState(1);
  const [batchesTotal, setBatchesTotal] = useState(0);
  const [batchSortBy, setBatchSortBy] = useState('batchId');
  const [batchSortOrder, setBatchSortOrder] = useState('desc');
  const [deepScanFaceOpen, setDeepScanFaceOpen] = useState(false);
  const [deepScanProgress, setDeepScanProgress] = useState(null);
  const [deepScanPolling, setDeepScanPolling] = useState(false);
  const [deepScanCollapsed, setDeepScanCollapsed] = useState(false);

  const [filterOnlyFaulty, setFilterOnlyFaulty] = useState(false);
  const [quickRecovering, setQuickRecovering] = useState(false);
  const [multiRecoveryProgress, setMultiRecoveryProgress] = useState(null);

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

  const handleDeepScanTicket = async (ticket) => {
    setDeepScanFaceOpen(false);
    try {
      const res = await auditService.startDeepScan(ticket);
      toast.success(res.data?.message || 'Đã kích hoạt đối soát chuyên sâu!');
      setDeepScanProgress({
        active: true,
        progressPercent: 0,
        statusMessage: 'Đang khởi chạy tiến trình đối soát ngầm...',
        logs: ['[INFO] Đã xác thực khuôn mặt Admin. Đang bắt đầu kiểm tra Merkle Tree & Blockchain...']
      });
      setDeepScanCollapsed(false);
      setDeepScanPolling(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không thể kích hoạt đối soát.');
    }
  };

  useEffect(() => {
    let timer = null;
    if (deepScanPolling) {
      const poll = async () => {
        try {
          const res = await auditService.getDeepScanStatus();
          const state = res.data || {};
          setDeepScanProgress(state);
          if (!state.active) {
            setDeepScanPolling(false);
            refreshAll();
            setTimeout(() => {
              setDeepScanProgress(null);
            }, 5000);
          }
        } catch (err) {
          console.error('Deep scan polling error:', err);
        }
      };
      poll();
      timer = setInterval(poll, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [deepScanPolling, refreshAll]);

  useEffect(() => {
    loadPendingQueue();
    loadChain();
    loadEntityWarnings();
    auditService.getDeepScanStatus().then((res) => {
      if (res.data && res.data.active) {
        setDeepScanProgress(res.data);
        setDeepScanPolling(true);
      }
    }).catch(() => {});
  }, [loadPendingQueue, loadChain, loadEntityWarnings]);

  const stats = useMemo(() => {
    return {
      batches: batchesTotal,
      isChainOk: chain?.ok ?? true,
      chainLength: chain?.total ?? 0,
      pending: pendingQueue.total,
      warningsCount: entityWarnings.length,
    };
  }, [batchesTotal, chain, pendingQueue.total, entityWarnings.length]);

  const filteredBatches = useMemo(() => {
    let result = batches;
    if (filterOnlyFaulty) {
      result = result.filter((b) => canRecoverBatch(b, chain));
    }
    if (!appliedQ) return result;
    const q = appliedQ.toLowerCase();
    return result.filter((b) => {
      const summaryText = (b.contentSummary || [])
        .flatMap((item) => [item.entity, ...(item.samples || [])])
        .join(' ')
        .toLowerCase();
      return String(b.batchId).includes(q)
        || summaryText.includes(q)
        || (b.merkleRoot || '').toLowerCase().includes(q);
    });
  }, [batches, appliedQ, filterOnlyFaulty, chain]);

  const handleQuickRecoverBatch = async (brokenSeq) => {
    if (!brokenSeq) {
      toast.info('Không có thông tin Sequence bị đứt gãy.');
      return;
    }
    setQuickRecovering(true);
    try {
      let startSeq = brokenSeq;
      let endSeq = brokenSeq;
      if (chain?.reason) {
        const match = chain.reason.match(/mong đợi (\d+)/i);
        if (match && match[1]) {
          startSeq = parseInt(match[1], 10);
          endSeq = Math.max(startSeq, brokenSeq - 1);
        }
      }

      const res = await auditService.batches({ limit: 200 });
      const allBatches = res.data?.items || batches || [];

      const affectedBatches = allBatches.filter(
        (b) => b.fromSeq <= endSeq && b.toSeq >= startSeq
      ).sort((a, b) => a.batchId - b.batchId);

      if (affectedBatches.length > 0) {
        const targetIds = affectedBatches.map((b) => b.batchId);
        const firstBatch = affectedBatches[0];
        setRecoveryTarget({
          ...firstBatch,
          batchIds: targetIds,
        });
        setRecoveryReason(
          `[QUICK MULTI-RECOVER] Tự động khôi phục ${targetIds.length} lô (${targetIds.map((id) => `#${id}`).join(', ')}) do đứt gãy chuỗi Audit tại SEQ ${startSeq} -> ${endSeq}`
        );
        toast.info(
          `Đã phát hiện ${targetIds.length} lô bị ảnh hưởng (${targetIds.map((id) => `#${id}`).join(', ')}). Vui lòng quét khuôn mặt để khôi phục toàn bộ.`
        );
      } else {
        let fallback = allBatches.find((b) => b.fromSeq <= startSeq && b.toSeq >= startSeq)
          || allBatches.find((b) => b.fromSeq <= brokenSeq && b.toSeq >= brokenSeq);
        if (fallback) {
          setRecoveryTarget(fallback);
          setRecoveryReason(`[QUICK RECOVER] Khôi phục tự động lô #${fallback.batchId} do đứt gãy SEQ ${startSeq}`);
          toast.info(`Đã xác định lô #${fallback.batchId}. Vui lòng quét khuôn mặt để khôi phục.`);
        } else {
          toast.error(`Không thể tự động tìm thấy các lô chứa SEQ ${startSeq} - ${endSeq}.`);
        }
      }
    } catch (err) {
      toast.error('Lỗi khi tìm kiếm các lô cần khôi phục: ' + (err.message || 'Lỗi hệ thống'));
    } finally {
      setQuickRecovering(false);
    }
  };

  const handleAnchorNow = async () => {
    setAnchoring(true);
    setAnchorStage(1); // Giai đoạn 1: Chuẩn bị (Gom SEQ log & dựng Merkle Tree)
    const upcomingBatchId = (batches && batches[0]?.batchId) ? batches[0].batchId + 1 : 1;
    setAnchoringBatchInfo({
      batchId: upcomingBatchId,
      leafCount: pendingQueue.total || 1,
    });

    const timer1 = setTimeout(() => setAnchorStage(2), 700);  // Giai đoạn 2: Đang đưa lên IPFS
    const timer2 = setTimeout(() => setAnchorStage(3), 1600); // Giai đoạn 3: Artifact Ready
    const timer3 = setTimeout(() => setAnchorStage(4), 2400); // Giai đoạn 4: Neo Blockchain

    try {
      const res = await auditService.anchorNow();
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const d = res.data || {};
      if (d.committed) {
        setAnchorStage(5); // Hoàn tất!
        if (d.batchId) {
          setAnchoringBatchInfo({ batchId: d.batchId, leafCount: d.leafCount || pendingQueue.total });
        }
        toast.success(`Đã neo lô #${d.batchId || upcomingBatchId} (${d.leafCount} bản ghi) lên blockchain thành công!`);
        setTimeout(() => {
          setAnchorStage(0);
          setAnchoringBatchInfo(null);
        }, 4000);
      } else {
        setAnchorStage(0);
        toast.info(`Không có gì để neo: ${d.reason || 'hàng đợi trống'}.`);
      }
      await refreshAll();
    } catch (err) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setAnchorStage(0);
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

    const targetIds = Array.isArray(recoveryTarget.batchIds) && recoveryTarget.batchIds.length > 0
      ? recoveryTarget.batchIds
      : [recoveryTarget.batchId];

    setMultiRecoveryProgress({
      total: targetIds.length,
      completed: 0,
      percent: 0,
      currentBatchId: targetIds[0],
      batchIds: targetIds,
      statusMap: targetIds.reduce((acc, id) => ({ ...acc, [id]: 'PENDING' }), {}),
      done: false,
      successCount: 0,
    });

    try {
      let successCount = 0;
      for (let i = 0; i < targetIds.length; i++) {
        const bId = targetIds[i];
        setRecoveringBatchId(bId);

        setMultiRecoveryProgress((prev) => ({
          ...prev,
          currentBatchId: bId,
          statusMap: { ...prev.statusMap, [bId]: 'RUNNING' },
          percent: Math.round((i / targetIds.length) * 100),
        }));

        try {
          await auditService.recoverBatch(bId, recoveryReason.trim(), ticket);
          successCount++;
          setMultiRecoveryProgress((prev) => ({
            ...prev,
            completed: i + 1,
            percent: Math.round(((i + 1) / targetIds.length) * 100),
            statusMap: { ...prev.statusMap, [bId]: 'SUCCESS' },
            successCount,
          }));
        } catch (err) {
          console.error(`Lỗi khôi phục lô #${bId}:`, err);
          setMultiRecoveryProgress((prev) => ({
            ...prev,
            completed: i + 1,
            percent: Math.round(((i + 1) / targetIds.length) * 100),
            statusMap: { ...prev.statusMap, [bId]: 'FAILED' },
          }));
        }
      }

      setMultiRecoveryProgress((prev) => ({
        ...prev,
        percent: 100,
        done: true,
      }));

      setRecoveryTarget(null);
      setRecoveryReason('');
      await refreshAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Khôi phục audit batch thất bại.');
    } finally {
      setRecoveringBatchId(null);
    }
  };

  const handleEntityRecovery = () => {
    const selected = entityWarnings.filter((item) => selectedEntityWarnings.includes(`${item.entity}:${item.entityId}`) && item.recoverable);
    if (!selected.length || entityRecoveryReason.trim().length < 10) return;
    setEntityRecoveryFaceOpen(true);
  };

  const handleEntityRecoveryTicket = async (ticket) => {
    setEntityRecoveryFaceOpen(false);
    const selected = entityWarnings.filter((item) => selectedEntityWarnings.includes(`${item.entity}:${item.entityId}`) && item.recoverable);
    if (!selected.length || entityRecoveryReason.trim().length < 10) return;
    setRecoveringEntities(true);
    setEntityRecoveryCollapsed(false);
    const now = () => new Date().toLocaleTimeString();

    setEntityRecoveryProgress({
      active: true,
      progressPercent: 20,
      statusMessage: `Đã xác thực Face Step-Up. Bắt đầu đối soát Blockchain cho ${selected.length} thực thể...`,
      total: selected.length,
      completed: 0,
      logs: [
        `[${now()}] 👤 Xác thực Face Step-Up Admin thành công.`,
        `[${now()}] 🚀 Bắt đầu khôi phục ${selected.length} thực thể có cảnh báo sai lệch...`,
        `[${now()}] 🔍 Đang kết nối On-Chain Smart Contract & kiểm tra Merkle Inclusion Proof...`,
      ],
      tamperedCount: 0,
      recoveredCount: 0,
      failedCount: 0,
      results: [],
    });

    try {
      setEntityRecoveryProgress((prev) => prev ? {
        ...prev,
        progressPercent: 45,
        statusMessage: `Đang đối soát ${selected.length} bản ghi với Blockchain Merkle Root...`,
      } : null);

      const res = await auditService.recoverEntities(
        selected.map(({ entity, entityId }) => ({ entity, entityId })),
        entityRecoveryReason.trim(),
        ticket,
      );
      const data = res.data || {};
      const tamperedResults = (data.results || []).filter((r) => r.tamperDetected === true);

      const newLogs = [];
      (data.results || []).forEach((item) => {
        const entLabel = ENTITY_LABELS[item.entity] || item.entity;
        const idShort = item.entityId ? item.entityId.slice(0, 8) + '…' : 'N/A';
        if (item.tamperDetected) {
          newLogs.push(`[${now()}] ⚠️ [CẢNH BÁO CAN THIỆP] ${entLabel} (${idShort}): Audit local bị sửa! Đã tự động tải IPFS Artifact (Lô #${item.batchId}) & khôi phục thành công.`);
        } else if (item.status === 'RECOVERED' || item.status === 'RECREATED') {
          newLogs.push(`[${now()}] 🟢 [KHỚP ON-CHAIN] ${entLabel} (${idShort}): Merkle proof hợp lệ 100%. Đã khôi phục từ snapshot chuẩn.`);
        } else if (item.status === 'SKIPPED') {
          newLogs.push(`[${now()}] ℹ️ [BỎ QUA] ${entLabel} (${idShort}): Dữ liệu đã khớp audit tin cậy.`);
        } else if (item.status === 'FAILED') {
          newLogs.push(`[${now()}] ❌ [THẤT BẠI] ${entLabel} (${idShort}): ${item.message || 'Lỗi không xác định'}`);
        }
      });

      newLogs.push(`[${now()}] 🎉 Hoàn tất quy trình: Đã khôi phục ${data.recovered || 0}/${selected.length} thực thể.${tamperedResults.length > 0 ? ` Phát hiện ${tamperedResults.length} bản ghi bị can thiệp trái phép đã cứu qua IPFS.` : ''}`);

      setEntityRecoveryProgress((prev) => ({
        active: false,
        progressPercent: 100,
        statusMessage: tamperedResults.length > 0
          ? `Hoàn tất! Đã khôi phục ${data.recovered || 0} thực thể (${tamperedResults.length} bản ghi cứu qua IPFS do bị sửa trái phép).`
          : `Hoàn tất! Đã khôi phục thành công ${data.recovered || 0} thực thể toàn vẹn.`,
        total: selected.length,
        completed: selected.length,
        logs: prev ? [...prev.logs, ...newLogs] : newLogs,
        tamperedCount: tamperedResults.length,
        recoveredCount: data.recovered || 0,
        failedCount: data.failed || 0,
        results: data.results || [],
      }));

      if (tamperedResults.length > 0) {
        setEntityRecoveryAlert({
          type: 'TAMPER_DETECTED',
          tamperedCount: tamperedResults.length,
          recoveredCount: data.recovered || 0,
          items: tamperedResults,
        });
        toast.warning(`Phát hiện ${tamperedResults.length} bản ghi có dấu hiệu bị can thiệp trái phép trong CSDL. Đã tự động đối soát Blockchain và khôi phục an toàn từ IPFS!`);
      } else if (data.failed > 0) {
        setEntityRecoveryAlert(null);
        const details = (data.results || [])
          .filter((item) => item.status === 'FAILED' && item.message)
          .slice(0, 3)
          .map((item) => `${ENTITY_LABELS[item.entity] || item.entity}: ${item.message}`)
          .join(' ');
        toast.error(`Khôi phục ${data.recovered || 0}/${data.requested || selected.length} bản ghi; ${data.failed} bản ghi thất bại.${details ? ` ${details}` : ''}`);
      } else if (data.recovered > 0) {
        setEntityRecoveryAlert(null);
        toast.success(`Đã khôi phục ${data.recovered} bản ghi từ audit đã xác minh blockchain.`);
      } else {
        setEntityRecoveryAlert(null);
        toast.success('Dữ liệu đã khớp audit tin cậy, không cần ghi đè.');
      }
      setSelectedEntityWarnings([]);
      setEntityRecoveryReason('');
      await refreshAll();
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || 'Khôi phục dữ liệu thất bại.';
      setEntityRecoveryProgress((prev) => ({
        active: false,
        progressPercent: 100,
        statusMessage: `Lỗi khôi phục: ${errMsg}`,
        total: selected.length,
        completed: 0,
        logs: prev ? [...prev.logs, `[${now()}] ❌ LỖI: ${errMsg}`] : [`[${now()}] ❌ LỖI: ${errMsg}`],
        tamperedCount: 0,
        recoveredCount: 0,
        failedCount: selected.length,
        results: [],
      }));
      toast.error(errMsg);
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
      <div className="mx-auto max-w-7xl space-y-6 pb-12">
        {/* Executive Header & Action Bar */}
        <ExecutiveHeader
          onRefresh={refreshAll}
          onAnchor={handleAnchorNow}
          onOpenDeepScan={() => setDeepScanFaceOpen(true)}
          onQuickRecoverBatch={handleQuickRecoverBatch}
          quickRecovering={quickRecovering}
          loading={loading}
          anchoring={anchoring}
          deepScanActive={deepScanPolling || (deepScanProgress && deepScanProgress.active)}
          stats={stats}
          chain={chain}
        />

        {/* Top Metric Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Lô đã chốt Blockchain"
            value={stats.batches}
            hint="Dữ liệu gốc được bảo chứng bất biến"
            icon={Layers}
            accentColor="emerald"
          />
          <StatCard
            label="Trạng thái chuỗi nhật ký"
            value={stats.isChainOk ? 'An toàn 100%' : 'Phát hiện bất thường!'}
            hint={`${stats.chainLength} bản ghi đã liên kết an toàn`}
            icon={stats.isChainOk ? ShieldCheck : ShieldAlert}
            color={stats.isChainOk ? 'text-emerald-600' : 'text-rose-600'}
            accentColor={stats.isChainOk ? 'emerald' : 'rose'}
          />
          <StatCard
            label="Nhật ký mới chờ chốt"
            value={stats.pending}
            hint="Sẽ tự động gom thành lô tiếp theo"
            icon={History}
            color={stats.pending > 0 ? 'text-amber-600' : 'text-slate-700'}
            accentColor={stats.pending > 0 ? 'amber' : 'slate'}
          />
        </div>

        {/* Live Active Anchoring Stepper Banner */}
        {anchorStage > 0 && activeTab !== 'pending' && (
          <AnchoringStepper stage={anchorStage} anchoring={anchoring} batchInfo={anchoringBatchInfo} />
        )}

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-1 dark:border-slate-800">
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <TabButton
              id="batches"
              label="Lô đã chốt Blockchain"
              icon={Layers}
              count={stats.batches}
              active={activeTab === 'batches'}
              onClick={setActiveTab}
            />
            <TabButton
              id="integrity"
              label="Kiểm tra & Khôi phục dữ liệu"
              icon={ShieldAlert}
              count={stats.warningsCount > 0 ? stats.warningsCount : (!stats.isChainOk ? '!' : null)}
              badgeColor={stats.warningsCount > 0 || !stats.isChainOk ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'}
              active={activeTab === 'integrity'}
              onClick={setActiveTab}
            />
            <TabButton
              id="pending"
              label="Nhật ký chờ chốt lô"
              icon={History}
              count={stats.pending}
              badgeColor="bg-amber-500 text-white"
              active={activeTab === 'pending'}
              onClick={setActiveTab}
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Bot className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            <span>Tự động kiểm tra: <b>20 phút / lần</b> (Chạy ngầm đối soát)</span>
          </div>
        </div>

        {/* TAB 1: BATCHES LIST */}
        {activeTab === 'batches' && (
          <div className="space-y-4 animate-fadeIn">
            {chain && !chain.ok && (
              <ChainBanner
                chain={chain}
                loading={false}
                onQuickRecoverBatch={handleQuickRecoverBatch}
                quickRecovering={quickRecovering}
              />
            )}

            {/* Search & Filter Bar */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={(e) => {
                      setSearchQ(e.target.value);
                      setAppliedQ(e.target.value.trim());
                    }}
                    placeholder="Tìm lô theo số lô (#), mã Merkle Root, tên thực thể..."
                    className="w-full rounded-xl border border-slate-200/80 bg-slate-50/80 py-2.5 pl-10 pr-10 text-xs font-semibold text-slate-700 outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  />
                  {searchQ && (
                    <button
                      type="button"
                      onClick={() => { setSearchQ(''); setAppliedQ(''); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDeepScanFaceOpen(true)}
                    disabled={deepScanPolling || (deepScanProgress && deepScanProgress.active)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-sky-700 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Scan className="h-3.5 w-3.5 text-amber-300" />
                    <span>Scan toàn bộ Batch</span>
                  </button>

                  <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-1 dark:border-slate-800 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() => setBatchSortBy('batchId')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${batchSortBy === 'batchId' ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Số lô
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchSortBy('time')}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${batchSortBy === 'time' ? 'bg-white text-sky-700 shadow-xs dark:bg-slate-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-400'}`}
                    >
                      Thời gian
                    </button>
                    <button
                      type="button"
                      onClick={() => setBatchSortOrder((v) => (v === 'desc' ? 'asc' : 'desc'))}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200/60 dark:text-slate-400"
                      title={batchSortOrder === 'desc' ? 'Giảm dần' : 'Tăng dần'}
                    >
                      {batchSortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFilterOnlyFaulty((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                      filterOnlyFaulty
                        ? 'border-rose-300 bg-rose-50 text-rose-700 ring-2 ring-rose-200/60 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <AlertTriangle className={`h-3.5 w-3.5 ${filterOnlyFaulty ? 'text-rose-600' : 'text-slate-400'}`} />
                    {filterOnlyFaulty ? 'Chỉ hiện lô cần khôi phục' : 'Lọc lô bị lệch'}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="py-16 bg-white rounded-3xl border border-slate-200/80 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <LoadingIndicator size="lg" label="Đang đối soát danh sách lô Blockchain..." />
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
                chain={chain}
                onOpenDetail={openBatchDetail}
                onRecover={(batch) => { setRecoveryTarget(batch); setRecoveryReason(''); }}
                onPrev={() => setBatchesPage((v) => Math.max(1, v - 1))}
                onNext={() => setBatchesPage((v) => Math.min(batchesTotalPages, v + 1))}
              />
            )}
          </div>
        )}

        {/* TAB 2: INTEGRITY VERIFICATION & ENTITY RECOVERY */}
        {activeTab === 'integrity' && (
          <div className="space-y-6 animate-fadeIn">
            <ChainBanner
              chain={chain}
              loading={false}
              onQuickRecoverBatch={handleQuickRecoverBatch}
              quickRecovering={quickRecovering}
            />

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
              alert={entityRecoveryAlert}
              onDismissAlert={() => setEntityRecoveryAlert(null)}
            />
          </div>
        )}

        {/* TAB 3: PENDING QUEUE */}
        {activeTab === 'pending' && (
          <div className="space-y-6 animate-fadeIn">
            {/* Live 4-Stage Anchoring Stepper */}
            <AnchoringStepper stage={anchorStage} anchoring={anchoring} batchInfo={anchoringBatchInfo} />

            <div className="rounded-3xl border border-amber-200/90 bg-amber-50/60 p-6 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/30">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <h3 className="text-base font-bold text-amber-950 dark:text-amber-100">
                      Hàng đợi chưa seal lô ({pendingQueue.total} bản ghi)
                    </h3>
                  </div>
                  <p className="text-xs font-semibold text-amber-800/90 dark:text-amber-300/90">
                    Các Sequence này đã ghi vào cơ sở dữ liệu PostgreSQL nhưng chưa tạo Merkle Root để neo on-chain.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAnchorNow}
                  disabled={anchoring || pendingQueue.total === 0}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-amber-700 disabled:opacity-50 transition-all cursor-pointer"
                >
                  <LockKeyhole className="h-4 w-4" />
                  <span>{anchoring ? 'Đang đóng lô & neo...' : 'Đóng lô & Neo ngay'}</span>
                </button>
              </div>

              {pendingQueue.items.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {pendingQueue.items.map((log) => (
                    <div key={log.id} className="rounded-2xl border border-amber-200 bg-white p-4 shadow-xs dark:border-amber-900 dark:bg-slate-900">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-amber-900 dark:text-amber-300">SEQ #{log.seq}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ACTION_TONE[log.action] || 'bg-slate-100 text-slate-700'}`}>
                          {ACTION_LABEL[log.action] || log.action}
                        </span>
                      </div>
                      <p className="mt-2 text-xs font-bold text-slate-800 dark:text-slate-200">{ENTITY_LABELS[log.entity] || log.entity}</p>
                      <p className="text-[10px] font-semibold text-slate-400">{formatTime(log.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-200/50 bg-white/80 p-8 text-center dark:bg-slate-900/50">
                  <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                  <p className="mt-2 text-xs font-bold text-slate-700 dark:text-slate-300">Hàng đợi đang trống!</p>
                  <p className="text-[11px] font-medium text-slate-400">Tất cả audit log đã được đóng lô và neo đầy đủ lên Blockchain.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODALS & DRAWERS */}
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
          title={
            Array.isArray(recoveryTarget.batchIds) && recoveryTarget.batchIds.length > 1
              ? `Quét khuôn mặt để khôi phục toàn bộ ${recoveryTarget.batchIds.length} lô audit (${recoveryTarget.batchIds.map((id) => `#${id}`).join(', ')})`
              : `Quét khuôn mặt để khôi phục batch #${recoveryTarget.batchId}`
          }
          description="Backend sẽ kiểm chứng blockchain và IPFS trước khi thay audit logs. Nội dung bệnh án không được hiển thị."
          onSuccess={handleRecoveryTicket}
          onClose={() => setRecoveryFaceOpen(false)}
        />
      )}

      {multiRecoveryProgress && (
        <MultiBatchRecoveryProgressModal
          progress={multiRecoveryProgress}
          onClose={() => setMultiRecoveryProgress(null)}
        />
      )}

      {/* Floating Deep Scan Progress Widget */}
      {deepScanProgress && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          {deepScanCollapsed ? (
            <div
              className="flex items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 shadow-xl backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 transition-all hover:scale-105 cursor-pointer select-none"
              onClick={() => setDeepScanCollapsed(false)}
              title="Click để xem chi tiết tiến trình đối soát"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  deepScanProgress.active
                    ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 animate-pulse'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">Đối soát:</span>
                <span className="text-sky-600 dark:text-sky-400">{deepScanProgress.progressPercent}%</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeepScanCollapsed(false);
                }}
                className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                title="Thu gọn"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeepScanProgress(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                title="Tắt"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      deepScanProgress.active
                        ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 animate-pulse'
                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}
                  >
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Đối soát Blockchain & Tự sửa chữa
                    </h5>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {deepScanProgress.active ? 'Đang chạy ngầm...' : 'Đã hoàn thành đối soát'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDeepScanCollapsed(true)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    title="Thu gọn"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeepScanProgress(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    title="Tắt"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="truncate">{deepScanProgress.statusMessage}</span>
                  <span className="shrink-0 font-bold ml-2">{deepScanProgress.progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${deepScanProgress.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="h-36 overflow-y-auto rounded-xl bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300 space-y-1 scrollbar-thin">
                {(deepScanProgress.logs || []).map((log, idx) => (
                  <div key={idx} className="leading-relaxed break-words">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Entity Recovery Progress Widget (Right Sidebar / Bottom-Right) */}
      {entityRecoveryProgress && (
        <div className="fixed bottom-6 right-6 z-50 transition-all duration-300">
          {entityRecoveryCollapsed ? (
            <div
              className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 shadow-xl backdrop-blur-md transition-all hover:scale-105 cursor-pointer select-none ${
                entityRecoveryProgress.tamperedCount > 0
                  ? 'border-amber-300/90 bg-amber-50/95 dark:border-amber-800 dark:bg-amber-950/95 text-amber-900 dark:text-amber-100'
                  : 'border-slate-200/90 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95'
              }`}
              onClick={() => setEntityRecoveryCollapsed(false)}
              title="Click để xem chi tiết tiến trình khôi phục thực thể"
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  entityRecoveryProgress.active
                    ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 animate-pulse'
                    : entityRecoveryProgress.tamperedCount > 0
                    ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                }`}
              >
                {entityRecoveryProgress.tamperedCount > 0 ? (
                  <ShieldAlert className="h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                <span className="text-slate-500 dark:text-slate-400">Khôi phục:</span>
                <span className={entityRecoveryProgress.tamperedCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400'}>
                  {entityRecoveryProgress.progressPercent}%
                </span>
              </div>
              {entityRecoveryProgress.tamperedCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 dark:bg-rose-950/60 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" />
                  {entityRecoveryProgress.tamperedCount} IPFS
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEntityRecoveryCollapsed(false);
                }}
                className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                title="Mở rộng"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEntityRecoveryProgress(null);
                }}
                className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950 dark:hover:text-rose-400"
                title="Tắt"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="w-[430px] max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 transition-all duration-300">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      entityRecoveryProgress.active
                        ? 'bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400 animate-pulse'
                        : entityRecoveryProgress.tamperedCount > 0
                        ? 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    }`}
                  >
                    {entityRecoveryProgress.tamperedCount > 0 ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      Khôi phục Thực thể & Đối soát Blockchain
                      {entityRecoveryProgress.tamperedCount > 0 && (
                        <span className="rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                          IPFS Fallback
                        </span>
                      )}
                    </h5>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {entityRecoveryProgress.active ? 'Đang chạy ngầm đối soát...' : 'Đã hoàn tất quá trình'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEntityRecoveryCollapsed(true)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
                    title="Thu gọn"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntityRecoveryProgress(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer"
                    title="Tắt"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Progress status & percentage bar */}
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="truncate">{entityRecoveryProgress.statusMessage}</span>
                  <span className="shrink-0 font-bold ml-2">{entityRecoveryProgress.progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      entityRecoveryProgress.tamperedCount > 0
                        ? 'bg-gradient-to-r from-sky-500 via-amber-500 to-emerald-500'
                        : 'bg-gradient-to-r from-sky-500 to-emerald-500'
                    }`}
                    style={{ width: `${entityRecoveryProgress.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Real-time Terminal Logger */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                  <span className="flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Nhật ký xử lý (Live Logger)
                  </span>
                  <span>{entityRecoveryProgress.logs?.length || 0} dòng</span>
                </div>
                <div className="h-40 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300 space-y-1.5 scrollbar-thin border border-slate-800">
                  {(entityRecoveryProgress.logs || []).map((log, idx) => (
                    <div
                      key={idx}
                      className={`leading-relaxed break-words ${
                        log.includes('⚠️') || log.includes('CẢNH BÁO')
                          ? 'text-amber-400 font-semibold'
                          : log.includes('❌') || log.includes('LỖI')
                          ? 'text-rose-400 font-semibold'
                          : log.includes('🟢') || log.includes('🎉')
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {deepScanFaceOpen && (
        <FaceStepUpModal
          action="DEEP_SCAN_SELF_HEAL"
          resourceId={null}
          title="Quét khuôn mặt Admin để cấp quyền đối soát Blockchain"
          description="Quét khuôn mặt Admin để cấp quyền thực thi cơ chế tự động đối soát Blockchain & tự sửa chữa Audit Batch bị lệch."
          onSuccess={handleDeepScanTicket}
          onClose={() => setDeepScanFaceOpen(false)}
        />
      )}

      {entityRecoveryFaceOpen && (
        <FaceStepUpModal
          action="RECOVER_AUDIT_ENTITIES"
          resourceId={null}
          title="Quét khuôn mặt Admin để xác nhận khôi phục bản ghi"
          description="Hệ thống sẽ đối soát snapshot đã xác minh trên Blockchain trước khi ghi đè dữ liệu nghiệp vụ."
          onSuccess={handleEntityRecoveryTicket}
          onClose={() => setEntityRecoveryFaceOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}

/* =========================================================================
   SUB-COMPONENTS (Executive Header, Cards, Tables, Drawers, Stepper)
   ========================================================================= */

function ExecutiveHeader({ onRefresh, onAnchor, onOpenDeepScan, onQuickRecoverBatch, quickRecovering, loading, anchoring, deepScanActive, stats, chain }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-white via-sky-50/30 to-indigo-50/20 p-6 sm:p-8 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100/90 px-3 py-1 text-xs font-bold text-sky-800 border border-sky-200/80 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
              <LockKeyhole className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
              Audit Integrity & Blockchain Sepolia
            </span>
            {stats.isChainOk ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> 100% Toàn vẹn
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-600" /> Phát hiện đứt băm!
              </span>
            )}
          </div>

          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Nhật ký Audit & Neo Blockchain
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 max-w-2xl">
            Giám sát toàn vẹn dữ liệu bệnh viện, kiểm chứng mã băm Merkle Tree và tự động phục hồi bản ghi khi phát hiện sai lệch.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-sky-700 transition-all shadow-xs disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Đồng bộ</span>
          </button>

          <button
            type="button"
            onClick={onOpenDeepScan}
            disabled={deepScanActive}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-700 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Quét khuôn mặt để đối soát & kiểm tra toàn bộ batch ngầm với Blockchain & IPFS"
          >
            <Scan className="h-4 w-4 text-amber-300" />
            <span>Scan & Đối soát toàn bộ Batch</span>
          </button>

          {!stats.isChainOk && chain?.brokenAtSeq != null && (
            <button
              type="button"
              onClick={() => onQuickRecoverBatch?.(chain.brokenAtSeq)}
              disabled={quickRecovering}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer animate-pulse"
            >
              <Zap className="h-4 w-4" />
              <span>Khôi phục tất cả lô bị đứt SEQ</span>
            </button>
          )}

          <button
            id="audit-anchor-now-button"
            type="button"
            onClick={onAnchor}
            disabled={anchoring}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 dark:text-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all disabled:opacity-60 cursor-pointer active:scale-95"
          >
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>{anchoring ? 'Đang neo...' : 'Neo blockchain ngay'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, icon: Icon, color = 'text-slate-900', accentColor = 'sky' }) {
  const accentBgs = {
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
    rose: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950 dark:text-rose-400 dark:border-rose-900',
    slate: 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    sky: 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-950 dark:text-sky-400 dark:border-sky-900',
  };

  return (
    <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-start justify-between transition-all hover:border-slate-300">
      <div className="space-y-1">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</p>
        <p className={`text-2xl font-extrabold tracking-tight dark:text-white ${color}`}>{value}</p>
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">{hint}</p>
      </div>
      {Icon && (
        <div className={`p-3 rounded-2xl border ${accentBgs[accentColor] || accentBgs.sky}`}>
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </div>
      )}
    </div>
  );
}

function TabButton({ id, label, icon: Icon, count, badgeColor = 'bg-sky-100 text-sky-700', active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-sky-600 text-white shadow-md'
          : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
      }`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      <span>{label}</span>
      {count != null && (
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
            active ? 'bg-white/20 text-white' : badgeColor
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BatchesHomeTable({ batches, page, totalPages, total, sortBy, sortOrder, onPrev, onNext, onRecover, onOpenDetail, recoveringBatchId, chain }) {
  const sortHint = sortBy === 'time'
    ? (sortOrder === 'desc' ? 'Mới → cũ' : 'Cũ → mới')
    : (sortOrder === 'desc' ? 'Lô lớn → nhỏ' : 'Lô nhỏ → lớn');

  return (
    <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="p-4 sm:p-5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
        <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <Layers className="h-4 w-4 text-sky-600" />
          <span>Danh sách Lô Blockchain (Checkpoints)</span>
        </div>
        <div className="text-xs font-semibold text-slate-400">
          Sắp xếp: <span className="text-slate-700 dark:text-slate-300 font-bold">{sortHint}</span> · Tổng: <span className="font-bold text-slate-900 dark:text-white">{total}</span> lô
        </div>
      </div>

      {!batches.length ? (
        <Empty
          title="Không tìm thấy lô nào"
          desc="Không có lô blockchain khớp với từ khóa hoặc bộ lọc của bạn."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 uppercase font-extrabold text-[10px] tracking-wider">
                  <th className="px-6 py-3.5">Mã Lô</th>
                  <th className="px-4 py-3.5">Tóm tắt Thực thể (Entities)</th>
                  <th className="px-4 py-3.5">Mốc thời gian & Root</th>
                  <th className="px-4 py-3.5">Toàn vẹn (Integrity)</th>
                  <th className="px-4 py-3.5">Trạng thái</th>
                  <th className="px-6 py-3.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {batches.map((b) => {
                  const integrity = b.integrity || {};
                  const isRecoverable = canRecoverBatch(b, chain);
                  const isBrokenSeqBatch = chain && !chain.ok && chain.brokenAtSeq != null && (b.fromSeq <= chain.brokenAtSeq + 1 && b.toSeq >= Math.max(1, chain.brokenAtSeq - 1));

                  return (
                    <tr
                      key={b.id}
                      className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/50 ${
                        isBrokenSeqBatch
                          ? 'bg-rose-50/60 dark:bg-rose-950/20'
                          : isRecoverable
                          ? 'bg-amber-50/30 dark:bg-amber-950/20'
                          : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-bold">
                        <div className="flex items-center gap-2">
                          <span className="text-base text-slate-900 dark:text-white font-extrabold">#{b.batchId}</span>
                          <span className="rounded-md bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800">
                            {b.leafCount ?? 0} SEQ
                          </span>
                        </div>
                        {isBrokenSeqBatch && (
                          <span className="mt-1 inline-block rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase tracking-wider">
                            Phát hiện đứt SEQ
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <BatchContentSummary summary={b.contentSummary} fromSeq={b.fromSeq} toSeq={b.toSeq} />
                      </td>
                      <td className="px-4 py-4 text-slate-600 dark:text-slate-400 space-y-0.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{formatTime(b.anchoredAt || b.createdAt)}</p>
                        <p className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]" title={b.merkleRoot}>
                          root {shortHash(b.merkleRoot)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <BatchIntegrityBadge integrity={integrity} isBrokenSeqBatch={isBrokenSeqBatch} />
                      </td>
                      <td className="px-4 py-4 space-y-1">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold ${b.status === 'ANCHORED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'}`}>
                          {BATCH_STATUS_LABEL[b.status] || b.status}
                        </span>
                        <div className="flex items-center gap-1 text-[9px] font-extrabold text-slate-400">
                          <span className="text-emerald-600 dark:text-emerald-400" title="Bước 1: Gom SEQ log & Merkle Tree">1.Gom</span>
                          <span>›</span>
                          <span className="text-emerald-600 dark:text-emerald-400" title="Bước 2: Upload Encrypted IPFS">2.IPFS</span>
                          <span>›</span>
                          <span className="text-emerald-600 dark:text-emerald-400" title="Bước 3: Artifact Ready & Hash match">3.Ready</span>
                          <span>›</span>
                          <span className={b.status === 'ANCHORED' ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-400'} title="Bước 4: Commit Merkle Root lên Sepolia">4.Neo</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(b.batchId)}
                            className="rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-sky-300 hover:text-sky-700 shadow-xs dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            onClick={() => onRecover(b)}
                            disabled={!isRecoverable || recoveringBatchId === b.batchId}
                            title={recoverBatchDisabledReason(b, chain) || 'Khôi phục lô khi kiểm tra toàn vẹn không ổn'}
                            className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-all ${
                              isBrokenSeqBatch || isRecoverable
                                ? 'border-rose-300 bg-rose-600 text-white hover:bg-rose-700 shadow-xs animate-pulse'
                                : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 disabled:cursor-not-allowed opacity-50'
                            }`}
                          >
                            {recoveringBatchId === b.batchId ? 'Đang xử lý...' : 'Khôi phục'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} total={total} label="lô" onPrev={onPrev} onNext={onNext} />
        </>
      )}
    </section>
  );
}

function BatchIntegrityBadge({ integrity, isBrokenSeqBatch }) {
  const status = integrity?.status || 'PENDING';
  let label = status === 'VERIFIED' ? 'Toàn vẹn' : status === 'TAMPERED' ? 'Nghi sửa đổi' : 'Thiếu field hash';
  let tone = status === 'VERIFIED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
    : status === 'TAMPERED'
      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800';

  if (isBrokenSeqBatch && status === 'VERIFIED') {
    label = 'Đứt SEQ chuỗi';
    tone = 'border-rose-300 bg-rose-100 text-rose-800 font-extrabold dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800';
  }

  return (
    <div className={`inline-block rounded-xl border px-2.5 py-1 ${tone}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="text-[10px] font-semibold opacity-90">
        OK {integrity?.verified ?? 0} · Lệch {integrity?.tampered ?? 0}
      </p>
    </div>
  );
}

function EntityRecoveryPanel({ warnings, loading, selected, setSelected, reason, setReason, recovering, onRecover, onRefresh, alert, onDismissAlert }) {
  const [viewMode, setViewMode] = useState('clustered'); // 'clustered' | 'flat'
  const recoverable = warnings.filter((item) => item.recoverable);
  const allSelected = recoverable.length > 0 && recoverable.every((item) => selected.includes(`${item.entity}:${item.entityId}`));
  const selectedCount = recoverable.filter((item) => selected.includes(`${item.entity}:${item.entityId}`)).length;
  const toggleAll = () => setSelected(allSelected ? [] : recoverable.map((item) => `${item.entity}:${item.entityId}`));
  const toggleOne = (key) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);

  // Group warnings into clinical case clusters
  const CLINICAL_ENTITY_ORDER = {
    Patient: 1,
    Appointment: 2,
    Visit: 3,
    MedicalOrder: 4,
    MedicalResult: 5,
    AiDiagnosis: 6,
    MedicalConclusion: 7,
    AiQuality: 8,
    AiModelRegistry: 9,
    Department: 10,
    DoctorProfile: 11,
    StaffProfile: 12,
  };

  const clusters = useMemo(() => {
    const map = new Map();
    for (const item of warnings) {
      const key = item.clusterKey || item.entityId;
      if (!map.has(key)) {
        map.set(key, {
          clusterKey: key,
          clusterLabel: item.clusterLabel || `Ca bệnh / Cụm thực thể #${key.slice(0, 8)}`,
          items: [],
          hasRecoverable: false,
        });
      }
      const entry = map.get(key);
      entry.items.push(item);
      if (item.recoverable) entry.hasRecoverable = true;
    }

    for (const cluster of map.values()) {
      cluster.items.sort((a, b) => {
        const orderA = CLINICAL_ENTITY_ORDER[a.entity] || 99;
        const orderB = CLINICAL_ENTITY_ORDER[b.entity] || 99;
        return orderA - orderB;
      });
    }

    return Array.from(map.values());
  }, [warnings]);

  const selectCluster = (clusterItems) => {
    const keys = clusterItems.filter((i) => i.recoverable).map((i) => `${i.entity}:${i.entityId}`);
    setSelected((current) => {
      const allSelected = keys.every((k) => current.includes(k));
      if (allSelected) {
        return current.filter((k) => !keys.includes(k));
      }
      const set = new Set(current);
      keys.forEach((k) => set.add(k));
      return Array.from(set);
    });
  };

  if (!loading && warnings.length === 0) {
    return (
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-800 dark:text-emerald-200">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          <span>Tất cả dữ liệu bệnh viện hiện tại hoàn toàn khớp và an toàn với nhật ký hệ thống</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-xl p-2 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900"
          title="Kiểm tra lại dữ liệu"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Tamper Warning Banner if IPFS Recovery occurred */}
      {alert && alert.type === 'TAMPER_DETECTED' && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4.5 dark:border-rose-800 dark:bg-rose-950/60 shadow-xs animate-fadeIn">
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-rose-900 dark:text-rose-200 text-xs sm:text-sm flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  Cảnh báo: Phát hiện {alert.tamperedCount} bản ghi audit có dấu hiệu bị can thiệp/sửa đổi bất hợp pháp trong CSDL!
                </h4>
                {onDismissAlert && (
                  <button
                    type="button"
                    onClick={onDismissAlert}
                    className="text-rose-600 hover:text-rose-800 dark:text-rose-400 p-1 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="text-rose-800 dark:text-rose-300 leading-relaxed text-[11px] sm:text-xs">
                Khi thực hiện khôi phục, hệ thống đã đối soát trực tiếp với <b>Blockchain Smart Contract</b>, phát hiện audit log trong CSDL bị sai lệch so với On-chain Merkle Root và đã <b>tự động tải bản sao lưu IPFS artifact để phục hồi an toàn 100%</b>.
              </p>
              <div className="mt-2 space-y-1 rounded-xl bg-white/70 dark:bg-slate-900/60 p-2.5 border border-rose-200/60 dark:border-rose-900/40">
                {(alert.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-[11px] font-medium text-rose-900 dark:text-rose-200">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500" />
                    <span>
                      <b>{ENTITY_LABELS[item.entity] || item.entity}</b> (Mã ID: <code className="font-mono text-[10px] bg-rose-100 dark:bg-rose-900/50 px-1 py-0.5 rounded">{item.entityId}</code>): Đã tự động cứu qua IPFS (Lô audit #{item.batchId})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Friendly Guidance Box */}
      <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-r from-sky-50/90 via-indigo-50/40 to-white p-4.5 text-xs text-slate-700 dark:border-sky-900/60 dark:bg-slate-800/80 dark:text-slate-200 shadow-xs">
        <div className="flex items-start gap-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white shadow-xs">
            <Info className="h-4 w-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
              💡 Lưu ý về cơ chế kiểm tra & khôi phục
            </h4>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px] sm:text-xs">
              Mục này thực hiện <b>đối chiếu nhanh</b> giữa dữ liệu bệnh viện thực tế và bản ghi nhật ký trong cơ sở dữ liệu để tìm ra các ca khám bị chỉnh sửa hoặc vô tình bị xóa.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                <b>Kiểm tra nhanh tại đây:</b> So sánh trực tiếp trong Database để hiển thị ngay tức thì.
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                <b>Đối soát với Blockchain:</b> Mở tab <i>"Lô đã neo Blockchain"</i> ➔ bấm <i>"Scan toàn bộ Batch"</i> để xác thực toàn diện với Smart Contract.
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-rose-200 bg-white shadow-sm dark:border-rose-900 dark:bg-slate-900">
        {/* Header with View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50 px-6 py-4 dark:border-rose-900 dark:bg-rose-950/40">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <h2 className="text-sm font-bold text-rose-950 dark:text-rose-100">
                Dữ liệu cần kiểm tra & khôi phục ({warnings.length} bản ghi · {clusters.length} ca khám)
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                Hệ thống tự động liên kết và khôi phục trọn gói theo đúng trình tự (từ Lượt khám, Chỉ định đến Kết quả & Chẩn đoán).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="inline-flex rounded-xl bg-white p-1 shadow-xs border border-rose-200/80 dark:bg-slate-800 dark:border-slate-700 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('clustered')}
                className={`rounded-lg px-3 py-1.5 transition-all ${viewMode === 'clustered' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'}`}
              >
                Gom theo Ca khám ({clusters.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`rounded-lg px-3 py-1.5 transition-all ${viewMode === 'flat' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'}`}
              >
                Danh sách chi tiết ({warnings.length})
              </button>
            </div>

            <button type="button" onClick={onRefresh} disabled={loading || recovering} className="rounded-xl p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="Kiểm tra lại dữ liệu">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* CLUSTERED CASE VIEW */}
        {viewMode === 'clustered' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span>Hiển thị gom gọn theo từng ca khám. Bấm "Chọn trọn gói ca này" để khôi phục toàn bộ thông tin của ca bệnh.</span>
              <button
                type="button"
                onClick={toggleAll}
                disabled={!recoverable.length || recovering}
                className="text-sky-600 hover:text-sky-700 font-bold text-xs"
              >
                {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả ca khám'}
              </button>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            {clusters.map((cluster) => {
              const clusterKeys = cluster.items.map((i) => `${i.entity}:${i.entityId}`);
              const isClusterSelected = cluster.items.some((i) => i.recoverable && selected.includes(`${i.entity}:${i.entityId}`));
              const allClusterSelected = cluster.items.filter((i) => i.recoverable).every((i) => selected.includes(`${i.entity}:${i.entityId}`));

              return (
                <div
                  key={cluster.clusterKey}
                  className={`rounded-2xl border p-4.5 transition-all ${
                    isClusterSelected
                      ? 'border-sky-300 bg-sky-50/40 shadow-xs dark:border-sky-800 dark:bg-sky-950/20'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-black text-xs">
                        {cluster.items.length}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                          {cluster.clusterLabel}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400 truncate">
                          ID: {cluster.clusterKey}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => selectCluster(cluster.items)}
                      disabled={!cluster.hasRecoverable || recovering}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-bold transition-all shadow-2xs ${
                        allClusterSelected
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {allClusterSelected ? '✓ Đã chọn cả ca' : 'Chọn trọn gói ca này'}
                    </button>
                  </div>

                  {/* Entities in cluster */}
                  <div className="mt-3.5 space-y-2">
                    {cluster.items.map((item, idx) => {
                      const key = `${item.entity}:${item.entityId}`;
                      const isItemChecked = selected.includes(key);
                      const isChild = item.entity !== 'Visit' && item.entity !== 'Patient' && cluster.items.length > 1;

                      return (
                        <div
                          key={key}
                          onClick={() => item.recoverable && toggleOne(key)}
                          className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-xs transition-all cursor-pointer ${
                            isChild ? 'ml-3 border-l-2 border-l-sky-400' : ''
                          } ${
                            isItemChecked
                              ? 'border-sky-200 bg-white dark:border-sky-800 dark:bg-slate-900 shadow-2xs'
                              : 'border-slate-100 bg-slate-50/70 hover:bg-slate-100/80 dark:border-slate-800 dark:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isItemChecked}
                              onChange={() => toggleOne(key)}
                              disabled={!item.recoverable || recovering}
                              className="h-3.5 w-3.5 accent-sky-600"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                {isChild && <span className="text-slate-400 text-xs font-mono select-none">↳</span>}
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {ENTITY_LABELS[item.entity] || item.entity}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400">
                                  {shortHash(item.entityId)}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 truncate max-w-xs mt-0.5">
                                {item.message}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-1.5">
                            {item.recoveryMode === 'DEPENDENCY_CHAIN' && (
                              <span className="rounded-md bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-300" title="Tự động khôi phục các thực thể cha trước khi tạo thực thể này">
                                Chuỗi phụ thuộc
                              </span>
                            )}
                            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                              item.status === 'TAMPERED'
                                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            }`}>
                              {item.status === 'MISSING' ? 'Bị mất dữ liệu' : item.status === 'TAMPERED' ? 'Bị sửa đổi' : item.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FLAT TABLE VIEW */}
      {viewMode === 'flat' && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="w-12 px-6 py-3.5">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!recoverable.length || recovering} aria-label="Chọn tất cả bản ghi có thể khôi phục" className="h-4 w-4 accent-sky-600" />
                </th>
                <th className="px-4 py-3.5 font-bold">Đối tượng & Cụm ca</th>
                <th className="px-4 py-3.5 font-bold">Mốc tin cậy</th>
                <th className="px-4 py-3.5 font-bold">Phát hiện & Phụ thuộc</th>
                <th className="px-4 py-3.5 font-bold">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {warnings.map((item) => {
                const key = `${item.entity}:${item.entityId}`;
                const fields = (item.fieldsChanged || []).map((field) => field === 'SENSITIVE_FIELD_CHANGED'
                  ? 'Trường nhạy cảm đã thay đổi'
                  : fieldDisplayName({ fieldPath: `${item.entity}.${field}`, field }));
                return (
                  <tr key={key} className="align-top hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={selected.includes(key)} onChange={() => toggleOne(key)} disabled={!item.recoverable || recovering} aria-label={`Chọn ${item.entity}`} className="h-4 w-4 accent-sky-600 disabled:opacity-30" />
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-bold text-slate-900 dark:text-slate-100">{ENTITY_LABELS[item.entity] || item.entity}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">{shortHash(item.entityId)}</p>
                      {item.clusterLabel && (
                        <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {item.clusterLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-600 dark:text-slate-400">
                      <p className="font-bold">SEQ {item.latestTrustedSeq ?? '—'} · Batch #{item.batchId ?? '—'}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{formatTime(item.anchoredAt)}</p>
                    </td>
                    <td className="max-w-sm px-4 py-4 text-slate-600 dark:text-slate-400">
                      <p className="font-semibold">{fields.length ? fields.join(', ') : 'Không công khai chi tiết dữ liệu'}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{item.message}</p>
                      {(item.blockers || []).length > 0 && (
                        <p className="mt-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          Trở ngại: {item.blockers.join(', ')}
                        </p>
                      )}
                      {(item.dependencies || []).length > 0 && (
                        <p className="mt-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">
                          Phụ thuộc cha: {item.dependencies.map((d) => ENTITY_LABELS[d.entity] || d.entity).join(', ')} (tự động vá)
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold ${item.recoverable ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>
                        {item.recoveryMode === 'DEPENDENCY_CHAIN'
                          ? 'Khôi phục chuỗi phụ thuộc'
                          : item.recoveryMode === 'AUDIT_BATCH_FIRST'
                            ? 'Khôi phục audit batch trước'
                            : item.recoveryMode === 'PITR_REQUIRED'
                              ? 'Cần backup/PITR thủ công'
                              : item.recoverable ? 'Có thể khôi phục' : 'Không thể khôi phục tự động'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Footer */}
      {recoverable.length > 0 && (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end dark:border-slate-800 dark:bg-slate-800/40">
          <label className="block space-y-1.5">
            <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Lý do khôi phục</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={2} placeholder="Nhập lý do sự cố khôi phục..." className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" />
          </label>
          <button type="button" onClick={onRecover} disabled={recovering || selectedCount === 0 || reason.trim().length < 10} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40 shadow-xs">
            <RefreshCw className={`h-4 w-4 ${recovering ? 'animate-spin' : ''}`} />
            {recovering ? 'Đang tự động khôi phục...' : `Khôi phục ${selectedCount} bản ghi đã chọn`}
          </button>
        </div>
      )}
      </div>
    </section>
  );
}

function ChainBanner({ chain, loading, onQuickRecoverBatch, quickRecovering }) {
  if (loading || !chain) {
    return (
      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
        <p className="text-xs font-semibold text-slate-500">Đang quét chuỗi khối để kiểm tra tính toàn vẹn cơ sở dữ liệu…</p>
      </section>
    );
  }
  const ok = chain.ok;
  return (
    <section
      className={`rounded-3xl border p-5 shadow-sm transition-all ${
        ok
          ? 'border-emerald-200 bg-emerald-50/50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200'
          : 'border-rose-300 bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 text-rose-950 shadow-md ring-2 ring-rose-200/60 dark:border-rose-900 dark:from-rose-950 dark:to-slate-900 dark:text-rose-100'
      }`}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          {ok ? (
            <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0 mt-0.5 animate-bounce" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-extrabold tracking-tight">
                {ok ? 'Cơ sở dữ liệu Audit hoàn toàn mật thiết & toàn vẹn' : 'CẢNH BÁO: Phát hiện bất thường / đứt gãy cấu trúc dữ liệu!'}
              </p>
              {!ok && (
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white tracking-wider animate-pulse">
                  Cần xử lý ngay
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-semibold opacity-90 leading-relaxed">
              {ok
                ? `Hệ thống đã đối chiếu thành công ${chain.total} bản ghi. Không tìm thấy bất kỳ dấu hiệu sửa đổi, chèn hoặc xóa lén dữ liệu.`
                : `Lỗi bất đối xứng mã băm được phát hiện tại bản ghi Sequence = ${chain.brokenAtSeq}. Lý do từ hệ thống: ${chain.reason}`}
            </p>
          </div>
        </div>

        {!ok && chain.brokenAtSeq != null && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onQuickRecoverBatch?.(chain.brokenAtSeq)}
              disabled={quickRecovering}
              className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-md hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <Zap className={`h-4 w-4 ${quickRecovering ? 'animate-spin' : ''}`} />
              {quickRecovering
                ? 'Đang tìm tập hợp lô bị ảnh hưởng...'
                : chain.reason && chain.reason.includes('mong đợi')
                ? 'Tự động khôi phục tất cả lô bị lệch'
                : `Tự động khôi phục lô bị lệch (SEQ ${chain.brokenAtSeq})`}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function BatchContentSummary({ summary, fromSeq, toSeq, activeEntity = '', onSelectEntity }) {
  if (!summary?.length) {
    return (
      <div className="text-xs text-slate-400">
        <p>Chưa có tóm tắt đối tượng.</p>
        <p className="mt-0.5 font-mono text-[10px]">seq {fromSeq ?? '—'} → {toSeq ?? '—'}</p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5 max-w-xs">
      <div className="flex flex-wrap gap-1">
        {summary.map((item) => {
          const active = activeEntity === item.entity;
          const clickable = typeof onSelectEntity === 'function';
          return (
            <button
              key={item.entity}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? () => onSelectEntity(item.entity) : undefined}
              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
                active
                  ? 'border-sky-400 bg-sky-100 text-sky-800 font-bold dark:bg-sky-950 dark:text-sky-200'
                  : 'border-slate-200/80 bg-slate-50 text-slate-700 hover:border-sky-300 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
              } ${clickable ? 'cursor-pointer' : ''}`}
            >
              <span>{ENTITY_LABELS[item.entity] || item.entity}</span>
              <span className="rounded-full bg-sky-200/70 dark:bg-sky-900 px-1.5 text-[10px] font-black text-sky-800 dark:text-sky-300">
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, total, label = 'bản ghi', onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-4">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Trang {page}/{totalPages} · {total} {label}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-sky-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">Trang trước</button>
        <button type="button" onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-sky-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">Trang sau</button>
      </div>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="p-12 text-center max-w-md mx-auto space-y-2">
      <div className="inline-flex p-3 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 mb-2 dark:bg-slate-800 dark:border-slate-700">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{title}</h3>
      <p className="text-xs text-slate-400 font-medium">{desc}</p>
    </div>
  );
}

function BatchDetailDrawer({ loading, detail, recoveringBatchId, onClose, onRecover, onProof, onOpenSeq }) {
  const [entityFilter, setEntityFilter] = useState('');
  const [integrityFilter, setIntegrityFilter] = useState('');
  const [seqQuery, setSeqQuery] = useState('');

  const integrityCounts = useMemo(() => {
    const logs = detail?.logs || [];
    return logs.reduce((acc, log) => {
      const status = log.blockchainStatus || log.verification?.status;
      if (status === 'VERIFIED') acc.verified++;
      if (status === 'TAMPERED') acc.tampered++;
      return acc;
    }, { verified: 0, tampered: 0 });
  }, [detail?.logs]);

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
      if (integrityFilter === 'OK' && integrity !== 'VERIFIED') return false;
      if (integrityFilter === 'TAMPERED' && integrity !== 'TAMPERED') return false;
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

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end outline-none border-none animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl border-none outline-none dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-600">Chi tiết lô Blockchain</p>
            <h2 className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              {detail ? `Lô #${detail.batchId}` : loading ? 'Đang tải…' : 'Lô'}
            </h2>
            {detail && (
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {detail.leafCount ?? detail.logs?.length ?? 0} SEQ · sequence {detail.fromSeq} → {detail.toSeq}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && <LoadingIndicator size="lg" label="Đang tải danh sách SEQ trong lô..." />}
          {!loading && detail && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <BatchIntegrityBadge integrity={detail.integrity} />
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                  <p className="text-[10px] font-extrabold uppercase text-slate-400">On-chain Status</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{BATCH_STATUS_LABEL[detail.status] || detail.status}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500 break-all">{detail.merkleRoot || '—'}</p>
                  <p className="mt-1 text-xs font-medium text-slate-400">Neo: {formatTime(detail.anchoredAt || detail.createdAt)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="mb-2 text-[10px] font-extrabold uppercase text-slate-400">Đối tượng có trong lô</p>
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
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition-all dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300"
                >
                  {recoveringBatchId === detail.batchId ? 'Đang khôi phục...' : `Khôi phục lô #${detail.batchId}`}
                </button>
                {!canRecoverBatch(detail) && (
                  <span className="text-xs font-semibold text-slate-400">
                    {recoverBatchDisabledReason(detail)}
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200/80 overflow-hidden dark:border-slate-800">
                <div className="border-b border-slate-100 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Các SEQ thuộc lô #{detail.batchId}</h3>
                    <p className="text-xs font-medium text-slate-400">Lọc theo thực thể trong lô này.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={!entityFilter} onClick={() => setEntityFilter('')}>
                      Tất cả ({detail.logs?.length || 0})
                    </FilterChip>
                    {entityOptions.map(({ entity, count }) => (
                      <FilterChip
                        key={entity}
                        active={entityFilter === entity}
                        onClick={() => setEntityFilter((current) => (current === entity ? '' : entity))}
                      >
                        {ENTITY_LABELS[entity] || entity} ({count})
                      </FilterChip>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={seqQuery}
                      onChange={(e) => setSeqQuery(e.target.value)}
                      placeholder="Tìm SEQ, mã, tên đối tượng..."
                      className="w-full rounded-xl border border-slate-200/80 bg-white py-2 pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                </div>

                <div className="max-h-[380px] sm:max-h-[440px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map((log) => (
                    <article key={log.id} className="p-4 space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-all">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-900 dark:text-white">SEQ {log.seq}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ACTION_TONE[log.action] || 'border-slate-200 text-slate-600'}`}>
                            {ACTION_LABEL[log.action] || log.action}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {ENTITY_LABELS[log.entity] || log.entity}
                          </span>
                        </div>
                        <VerificationBadge status={log.blockchainStatus} />
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{subjectTitle(log)}</p>
                        <p className="text-[11px] font-semibold text-slate-400">{subjectSubtitle(log)}</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-[10px] font-medium text-slate-400">{formatTime(log.createdAt)}</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => onOpenSeq(log)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-sky-400">
                            Chi tiết SEQ
                          </button>
                          {log.onChainStatus === 'ANCHORED' && (
                            <button type="button" onClick={() => onProof(log.seq)} className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              Bằng chứng
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
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

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 outline-none animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden text-slate-800 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Bản ghi #{log.seq ?? '—'}</h2>
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${ACTION_TONE[log.action] || 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {ACTION_LABEL[log.action] || log.action}
              </span>
              <VerificationBadge status={log.blockchainStatus} />
              {log.onChainStatus === 'ANCHORED' && log.batchId != null && (
                <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
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
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                Xem lô #{log.batchId}
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
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
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
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

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 space-y-3 dark:border-slate-800 dark:bg-slate-800/50">
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

          <div className="p-5 border border-slate-200/80 rounded-2xl space-y-2 bg-slate-50/50 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-800/30">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Mã kiểm tra toàn vẹn</div>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <div className="flex justify-between border-b border-slate-100 pb-1.5 dark:border-slate-800">
                <span className="text-slate-400">Current Entry Hash:</span>
                <span className="text-slate-700 font-bold break-all text-right max-w-md dark:text-slate-300">{log.hashes?.entryHash || log.entryHash || '—'}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span className="text-slate-400">Previous Record Hash:</span>
                <span className="text-slate-700 font-bold break-all text-right max-w-md dark:text-slate-300">{log.hashes?.prevHash || log.prevHash || '—'}</span>
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
              <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-100 dark:bg-slate-800 dark:border-slate-800">
                      <th className="px-4 py-3">Trường thuộc tính</th>
                      <th className="px-4 py-3 bg-rose-50/30 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300">Dữ liệu trước (Before)</th>
                      <th className="px-4 py-3 bg-emerald-50/30 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">Dữ liệu sau (After)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {log.diff.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-medium">
                          <div className="text-slate-900 font-bold dark:text-slate-100">{fieldDisplayName(item)}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{fieldTechnicalName(item)}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 bg-rose-50/10 max-w-xs break-all dark:bg-rose-950/10">
                          {renderDiffValue(item.before, item.redacted)}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-900 font-bold bg-emerald-50/10 max-w-xs break-all dark:bg-emerald-950/10 dark:text-slate-100">
                          {renderDiffValue(item.after, item.redacted)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400 font-medium italic dark:border-slate-800">
                Bản ghi này không ghi nhận biến động dữ liệu dạng bảng (Chỉ lưu vết sự kiện).
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-5 flex items-center justify-between dark:border-slate-800 dark:bg-slate-800/50">
          <div className="text-xs text-slate-400 font-medium">
            ID CSDL: <span className="font-mono text-slate-600 font-bold dark:text-slate-300">{log.id}</span>
          </div>
          <div className="flex gap-2">
            {log.onChainStatus === 'ANCHORED' && (
              <button
                type="button"
                onClick={() => { onClose(); onProof(log.seq); }}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:border-slate-300 rounded-xl text-xs font-bold transition-all shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Xem bằng chứng blockchain
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-sky-700 shadow-xs"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
    <div className="flex items-center justify-between gap-4 text-xs border-b border-slate-100/60 pb-1.5 last:border-0 last:pb-0 dark:border-slate-800">
      <span className="text-slate-400 font-semibold">{label}:</span>
      <span className={`text-right truncate max-w-[200px] sm:max-w-xs ${mono ? 'font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 text-[11px] dark:bg-slate-700 dark:text-slate-300' : ''
        } ${highlight ? 'font-bold text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-300'}`}>
        {value}
      </span>
    </div>
  );
}

function RecoveryReasonModal({ batch, reason, setReason, onClose, onContinue }) {
  const valid = reason.trim().length >= 10;
  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 outline-none animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200/80 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 p-6 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Khôi phục audit batch #{batch.batchId}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">Thao tác sẽ tải artifact IPFS, đối chiếu blockchain và phục hồi khi mọi hash khớp.</p>
        </div>
        <div className="p-6 space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300" htmlFor="audit-recovery-reason">Lý do khôi phục</label>
          <textarea
            id="audit-recovery-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={4}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Mô tả sự cố hoặc dấu hiệu sai lệch của batch..."
          />
          <p className="text-[11px] font-semibold text-slate-400">Tối thiểu 10 ký tự.</p>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-slate-100 p-5 dark:border-slate-800">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300">Hủy</button>
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
    </div>,
    document.body
  );
}

function MultiBatchRecoveryProgressModal({ progress, onClose }) {
  if (!progress) return null;
  const { total, completed, percent, batchIds, statusMap, done, successCount } = progress;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl space-y-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl ${done ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400'}`}>
              {done ? <CheckCircle2 className="h-6 w-6" /> : <RefreshCw className="h-6 w-6 animate-spin" />}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                {done ? 'Đã khôi phục hoàn tất 100%!' : 'Đang khôi phục tự động chuỗi Audit Logs'}
              </h3>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {done
                  ? `Đã khôi phục thành công ${successCount}/${total} lô từ IPFS & Sepolia.`
                  : `Đang đối chiếu và nạp lại dữ liệu (${completed}/${total} lô)...`}
              </p>
            </div>
          </div>
          {done && (
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500 dark:text-slate-400">Tiến trình khôi phục</span>
            <span className="text-sky-600 text-sm font-extrabold">{percent}%</span>
          </div>
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 transition-all duration-500 shadow-sm"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/70 p-3 space-y-2 divide-y divide-slate-100/60 dark:border-slate-800 dark:bg-slate-800/50 dark:divide-slate-800">
          {batchIds.map((bId) => {
            const st = statusMap[bId] || 'PENDING';
            return (
              <div key={bId} className="flex items-center justify-between pt-2 first:pt-0 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                  <span>Lô #{bId}</span>
                </div>
                <div>
                  {st === 'SUCCESS' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="h-3 w-3" /> Đã khôi phục
                    </span>
                  )}
                  {st === 'RUNNING' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200 animate-pulse dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Đang tải từ IPFS...
                    </span>
                  )}
                  {st === 'FAILED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                      <AlertTriangle className="h-3 w-3" /> Thất bại
                    </span>
                  )}
                  {st === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-slate-800">
                      Chờ khôi phục
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {done && (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl bg-sky-600 py-3 text-xs font-extrabold text-white shadow-md hover:bg-sky-700 transition-all"
          >
            Hoàn tất & Đóng
          </button>
        )}
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-1 text-xs font-bold transition-all shrink-0 cursor-pointer ${
        active
          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:text-sky-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

function ProofModal({ proof, onClose }) {
  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white text-slate-800 shadow-2xl outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-6 dark:border-slate-800">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Bằng chứng blockchain
            </span>
            <h3 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Chứng chỉ bản ghi #{proof.seq}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">Dùng để đối chiếu bản ghi trong cây Merkle đã neo.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-xs">
          {proof.loading ? (
            <LoadingIndicator size="sm" label="Đang tải chứng chỉ Merkle Proof..." />
          ) : proof.error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">{proof.error}</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Merkle Root</p>
                <p className="mt-2 break-all font-mono text-xs font-bold text-slate-700 dark:text-slate-300">{proof.data?.merkleRoot || proof.data?.root || '—'}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Node băm liên quan (Siblings)</p>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Array.isArray(proof.data?.proof) && proof.data.proof.length > 0 ? (
                    proof.data.proof.map((p, i) => (
                      <div key={i} className="grid gap-2 px-4 py-3 md:grid-cols-[56px_1fr]">
                        <span className="text-xs font-bold text-sky-600 dark:text-sky-400">#{i + 1}</span>
                        <span className="break-all font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">{typeof p === 'object' ? JSON.stringify(p) : p}</span>
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

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
          <button type="button" onClick={onClose} className="rounded-xl bg-sky-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-700 shadow-xs">
            Xác nhận
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function AnchoringStepper({ stage, anchoring, batchInfo }) {
  const steps = [
    { id: 1, label: '1. Chuẩn bị', desc: 'Gom SEQ log & dựng Merkle Tree', icon: Layers },
    { id: 2, label: '2. Đang đưa lên IPFS', desc: 'Mã hóa snapshot & upload Artifact', icon: FileDiff },
    { id: 3, label: '3. Artifact Ready', desc: 'Tạo IPFS URI & đối chiếu mã băm', icon: ShieldCheck },
    { id: 4, label: '4. Neo Blockchain', desc: 'Commit Merkle Root lên Sepolia', icon: LockKeyhole },
  ];

  const batchTitle = batchInfo?.batchId ? `Lô #${batchInfo.batchId}` : 'Lô Mới';
  const countText = batchInfo?.leafCount ? ` (${batchInfo.leafCount} bản ghi SEQ logs)` : '';

  return (
    <div className={`rounded-3xl border transition-all duration-500 p-5 ${
      anchoring || stage > 0
        ? 'border-sky-300 bg-gradient-to-r from-sky-50 via-indigo-50/60 to-emerald-50/80 shadow-md dark:border-sky-800 dark:from-slate-900 dark:via-sky-950 dark:to-slate-900'
        : 'border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100/80 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-2xl transition-all ${
            stage === 5
              ? 'bg-emerald-600 text-white'
              : anchoring
              ? 'bg-sky-600 text-white animate-spin'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {stage === 5 ? <CheckCircle2 className="h-5 w-5" /> : <RefreshCw className="h-5 w-5" />}
          </div>
          <div>
            <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Tiến trình niêm phong {batchTitle}{countText}</span>
              {anchoring && (
                <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-black uppercase text-white animate-pulse">
                  Đang xử lý
                </span>
              )}
            </h4>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {stage === 0 && 'Quy trình đóng từng lô tự động trải qua 4 bước: Chuẩn bị ➔ Đưa lên IPFS ➔ Artifact Ready ➔ Neo Blockchain.'}
              {stage === 1 && `🔹 [Giai đoạn 1/4] Đang gom các bản ghi Sequence chưa neo của ${batchTitle} và tính toán Merkle Tree...`}
              {stage === 2 && `🔹 [Giai đoạn 2/4] Đang mã hóa AES-256 snapshot và tải Artifact lên IPFS cho ${batchTitle}...`}
              {stage === 3 && `🔹 [Giai đoạn 3/4] Artifact Ready! Đã nhận IPFS URI & kiểm tra mã băm cho ${batchTitle}.`}
              {stage === 4 && `🔹 [Giai đoạn 4/4] Đang gửi giao dịch Commit Merkle Root của ${batchTitle} lên Sepolia Smart Contract...`}
              {stage === 5 && `✅ Hoàn tất 100%! ${batchTitle} đã được niêm phong và neo thành công lên Blockchain.`}
            </p>
          </div>
        </div>

        {stage > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-1.5 text-xs font-black text-sky-700 shadow-xs border border-sky-200 dark:bg-slate-800 dark:text-sky-300 dark:border-slate-700 shrink-0">
            <span>Tiến trình lô:</span>
            <span className="text-sm font-black text-emerald-600">{stage === 5 ? '4/4 (Hoàn tất)' : `${stage}/4`}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        {steps.map((step) => {
          const Icon = step.icon;
          const isDone = stage > step.id || stage === 5;
          const isActive = stage === step.id && stage !== 5;

          return (
            <div
              key={step.id}
              className={`relative flex items-center gap-3 rounded-2xl border p-3.5 transition-all duration-500 ${
                isDone
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                  : isActive
                  ? 'border-sky-500 bg-white text-sky-950 shadow-md ring-2 ring-sky-400 dark:border-sky-500 dark:bg-sky-950 dark:text-white scale-102 font-extrabold'
                  : 'border-slate-200/80 bg-slate-50/60 text-slate-400 opacity-70 dark:border-slate-800 dark:bg-slate-900/60'
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-extrabold text-xs transition-all duration-300 ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isActive
                    ? 'bg-sky-600 text-white shadow-md animate-bounce'
                    : 'bg-slate-200/80 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {isDone ? <Check className="h-5 w-5 stroke-[3]" /> : isActive ? <Icon className="h-4 w-4" /> : step.id}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-extrabold truncate ${isActive ? 'text-sky-700 dark:text-sky-300' : ''}`}>
                  {step.label}
                </p>
                <p className="text-[10px] font-semibold opacity-80 truncate">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
