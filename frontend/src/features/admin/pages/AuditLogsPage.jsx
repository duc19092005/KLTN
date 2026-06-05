import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { auditService } from '../apis/auditService';
import { FaceStepUpModal } from '../../auth';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

// ---- Display helpers --------------------------------------------------------

const ACTION_TONE = {
  CREATE: 'bg-blue-50 text-blue-700 border-blue-100',
  UPDATE: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  DELETE: 'bg-red-50 text-red-700 border-red-100',
  LOGIN_PASSWORD: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  LOGIN_INVITE: 'bg-teal-50 text-teal-700 border-teal-100',
  LOGIN_FAIL: 'bg-red-50 text-red-700 border-red-100',
  FACE_VERIFY_PASS: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  FACE_VERIFY_FAIL: 'bg-amber-50 text-amber-700 border-amber-100',
  FACE_INTEGRITY_FAIL: 'bg-red-50 text-red-700 border-red-100',
  FACE_ENROLL: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

const ACTION_LABEL = {
  LOGIN_PASSWORD: 'Đăng nhập (mật khẩu)',
  LOGIN_INVITE: 'Đăng nhập (lời mời)',
  LOGIN_FAIL: 'Đăng nhập thất bại',
  FACE_VERIFY_PASS: 'Xác thực khuôn mặt thành công',
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

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  if (clean.length <= 18) return clean;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'N/A';
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
  const [anchoring, setAnchoring] = useState(false);
  const [proof, setProof] = useState(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, batchesRes, chainRes] = await Promise.all([
        auditService.logs({ take: 200, ...(entity ? { entity } : {}) }),
        auditService.batches({ take: 50 }),
        auditService.verifyChain(),
      ]);
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : logsRes.data?.items || []);
      setBatches(Array.isArray(batchesRes.data) ? batchesRes.data : batchesRes.data?.items || []);
      setChain(chainRes.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được nhật ký');
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => {
    load();
  }, [load]);

  const entities = useMemo(() => {
    const set = new Set(logs.map((l) => l.entity).filter(Boolean));
    return Array.from(set).sort();
  }, [logs]);

  const stats = useMemo(() => {
    const anchored = logs.filter((l) => l.onChainStatus === 'ANCHORED').length;
    const pending = logs.filter((l) => l.onChainStatus !== 'ANCHORED').length;
    const logins = logs.filter((l) => String(l.action).startsWith('LOGIN')).length;
    return { total: logs.length, anchored, pending, logins };
  }, [logs]);

  // Step 1: open the face step-up modal. The anchor only commits after a valid ticket is minted.
  const handleAnchorNow = () => {
    setStepUpOpen(true);
  };

  // Step 2: a fresh face scan produced a single-use ticket -> commit the on-chain anchor with it.
  const handleStepUpSuccess = async (ticket) => {
    setStepUpOpen(false);
    setAnchoring(true);
    try {
      const res = await auditService.anchorNow(ticket);
      const d = res.data || {};
      if (d.committed) {
        toast.success(`Đã neo lô #${d.batchId} (${d.leafCount} bản ghi) lên blockchain.`);
      } else {
        toast.info(`Không có gì để neo: ${d.reason || 'hàng đợi trống'}.`);
      }
      await load();
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.24em] mb-3">Nhật ký & toàn vẹn</p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Nhật ký hệ thống</h2>
              <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">
                Toàn bộ hoạt động (đăng nhập, thay đổi dữ liệu) được ghi bằng chuỗi hash chống giả mạo và neo định kỳ lên blockchain.
              </p>
            </div>
            <button
              id="audit-anchor-now-button"
              onClick={handleAnchorNow}
              disabled={anchoring}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-50"
            >
              {anchoring ? 'Đang neo…' : 'Neo lên blockchain ngay'}
            </button>
          </div>
        </section>

        {/* Integrity banner */}
        <ChainBanner chain={chain} loading={loading} />

        {/* Stats */}
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Tổng bản ghi" value={stats.total} hint="Trong 200 bản ghi gần nhất" />
          <StatCard label="Đã neo trên chuỗi" value={stats.anchored} hint="Đã đóng băng bất biến" />
          <StatCard label="Chờ neo" value={stats.pending} hint="Sẽ vào lô kế tiếp" />
          <StatCard label="Sự kiện đăng nhập" value={stats.logins} hint="Lịch sử truy cập" />
        </section>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>Hoạt động ({logs.length})</TabButton>
          <TabButton active={tab === 'batches'} onClick={() => setTab('batches')}>Lô blockchain ({batches.length})</TabButton>
          <button onClick={load} disabled={loading} className="ml-auto rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>

        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải nhật ký..." />
        ) : tab === 'logs' ? (
          <LogsTable logs={logs} entities={entities} entity={entity} setEntity={setEntity} onProof={handleProof} />
        ) : (
          <BatchesTable batches={batches} />
        )}
      </div>

      {proof && <ProofModal proof={proof} onClose={() => setProof(null)} />}

      {stepUpOpen && (
        <FaceStepUpModal
          action="ANCHOR_BLOCKCHAIN"
          title="Xác nhận neo blockchain"
          description="Ghi dữ liệu lên blockchain là thao tác tốn phí và không thể hoàn tác. Vui lòng quét khuôn mặt để xác nhận."
          onSuccess={handleStepUpSuccess}
          onClose={() => setStepUpOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}

// ---- Integrity banner -------------------------------------------------------

function ChainBanner({ chain, loading }) {
  if (loading || !chain) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-slate-500">Đang kiểm tra tính toàn vẹn của chuỗi…</p>
      </section>
    );
  }
  const ok = chain.ok;
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${ok ? 'border-emerald-100 bg-emerald-50/70' : 'border-red-100 bg-red-50/70 animate-pulse'}`}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0">
          <p className={`text-sm font-black ${ok ? 'text-emerald-800' : 'text-red-800'}`}>
            {ok ? 'Chuỗi nhật ký toàn vẹn' : 'Phát hiện sửa đổi nhật ký!'}
          </p>
          <p className={`mt-0.5 text-xs font-semibold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
            {ok
              ? `Đã xác minh ${chain.total} bản ghi — không có dấu hiệu sửa/xóa/chèn.`
              : `Lỗi tại bản ghi seq=${chain.brokenAtSeq}: ${chain.reason}`}
          </p>
        </div>
      </div>
    </section>
  );
}

// ---- Activity logs table ----------------------------------------------------

function LogsTable({ logs, entities, entity, setEntity, onProof }) {
  if (!logs.length) {
    return <Empty title="Chưa có nhật ký" desc="Các hoạt động đăng nhập và thay đổi dữ liệu sẽ xuất hiện ở đây." />;
  }
  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <span className="text-xs font-black uppercase tracking-wider text-slate-400">Lọc theo đối tượng:</span>
        <FilterChip active={!entity} onClick={() => setEntity('')}>Tất cả</FilterChip>
        {entities.map((e) => (
          <FilterChip key={e} active={entity === e} onClick={() => setEntity(e)}>{e}</FilterChip>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Seq</th>
              <th className="px-4 py-3">Hành động</th>
              <th className="px-4 py-3">Đối tượng</th>
              <th className="px-4 py-3">Người thực hiện</th>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Trên chuỗi</th>
              <th className="px-4 py-3 text-right">Bằng chứng</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono font-black text-slate-400">{log.seq ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-lg border px-2 py-1 text-[10px] font-black ${ACTION_TONE[log.action] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                    {ACTION_LABEL[log.action] || log.action}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-black text-slate-900">{log.entity}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{shortHash(log.entityId)}</span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{log.actorId ? shortHash(log.actorId) : 'Hệ thống'}</td>
                <td className="px-4 py-3 text-[12px] text-slate-500">{formatTime(log.createdAt)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${log.onChainStatus === 'ANCHORED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                    {log.onChainStatus === 'ANCHORED' ? `Lô #${log.batchId}` : 'Chờ neo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {log.onChainStatus === 'ANCHORED' ? (
                    <button onClick={() => onProof(log.seq)} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700 hover:bg-blue-100">
                      Xem bằng chứng
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- On-chain batches table -------------------------------------------------

function BatchesTable({ batches }) {
  if (!batches.length) {
    return <Empty title="Chưa có lô nào được neo" desc="Hệ thống gom bản ghi thành lô và neo Merkle root định kỳ. Bấm 'Neo ngay' để tạo lô đầu tiên." />;
  }
  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Lô</th>
              <th className="px-4 py-3">Root Merkle</th>
              <th className="px-4 py-3">Số bản ghi</th>
              <th className="px-4 py-3">Khoảng seq</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3">Hash giao dịch</th>
              <th className="px-4 py-3">Neo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {batches.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono font-black text-slate-900">#{b.batchId}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-indigo-600">{shortHash(b.merkleRoot)}</td>
                <td className="px-4 py-3 font-black text-slate-700">{b.leafCount}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{b.fromSeq}–{b.toSeq}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${
                    b.status === 'ANCHORED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                    : b.status === 'FAILED' ? 'border-red-100 bg-red-50 text-red-700'
                    : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                    {BATCH_STATUS_LABEL[b.status] || b.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{shortHash(b.txHash)}</td>
                <td className="px-4 py-3 text-[12px] text-slate-500">{formatTime(b.anchoredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---- Merkle proof modal -----------------------------------------------------

function ProofModal({ proof, onClose }) {
  const d = proof.data;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100 p-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-indigo-600">Bằng chứng bao hàm Merkle</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">Bằng chứng bản ghi #{proof.seq}</h3>
            <p className="mt-1 text-sm text-slate-500">Chứng minh bản ghi này nằm trong lô đã neo, đối chiếu trực tiếp với root trên chuỗi.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
        </div>
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5">
          {proof.loading ? (
            <LoadingIndicator size="md" label="Đang tạo bằng chứng..." />
          ) : proof.error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{proof.error}</div>
          ) : !d ? (
            <Empty title="Không có bằng chứng" desc="Bản ghi này chưa được neo vào lô nào." />
          ) : (
            <div className="space-y-4">
              <div className={`rounded-2xl border p-4 ${d.verified ? 'border-emerald-100 bg-emerald-50' : 'border-red-100 bg-red-50'}`}>
                <p className={`text-sm font-black ${d.verified ? 'text-emerald-800' : 'text-red-800'}`}>
                  {d.verified ? 'Bằng chứng hợp lệ - khớp với root trên blockchain' : 'Bằng chứng KHÔNG khớp root trên chuỗi'}
                </p>
              </div>
              <KV label="Lô (batchId)" value={`#${d.batchId}`} />
              <KV label="Hash bản ghi (lá Merkle)" value={d.entryHash} mono />
              <KV label="Merkle Root (tính lại)" value={d.merkleRoot} mono />
              <KV label="Root trên blockchain" value={d.onChainRoot} mono />
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">Đường dẫn bằng chứng ({d.proof?.length || 0} nút)</p>
                <div className="space-y-1.5">
                  {(d.proof || []).map((p, i) => (
                    <div key={i} className="rounded-lg border border-slate-100 bg-white px-3 py-2 font-mono text-[11px] text-slate-500">
                      [{i}] {shortHash(p)}
                    </div>
                  ))}
                  {!d.proof?.length && <p className="text-xs text-slate-400">Lô chỉ có 1 bản ghi - không cần nút trung gian.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Small presentational bits ----------------------------------------------

function StatCard({ label, value, hint }) {
  return (
    <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <div className="flex justify-between">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <strong className="block text-3xl font-black text-slate-950 mt-2">{String(value).padStart(2, '0')}</strong>
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold text-blue-600">{hint}</p>
    </article>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-xl border px-4 py-2 text-xs font-black transition-all ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} className={`rounded-lg border px-3 py-1 text-[11px] font-black transition-all ${active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

function KV({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 break-all text-sm text-slate-700 ${mono ? 'font-mono text-[12px]' : ''}`}>{value || '—'}</p>
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <strong className="text-slate-700">{title}</strong>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}
