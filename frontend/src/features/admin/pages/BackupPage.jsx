import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { backupService } from '../apis/backupService';
import { FaceStepUpModal } from '../../auth';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

// ---- Display helpers --------------------------------------------------------

const ENTITY_LABELS = {
  Patient: 'Bệnh nhân',
  Department: 'Phòng ban',
  StaffProfile: 'Nhân sự',
  MedicalConclusion: 'Kết luận y khoa',
};

const STATUS_TONE = {
  ANCHORED: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  VERIFIED: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  CREATED: 'border-amber-100 bg-amber-50 text-amber-700',
  CORRUPT: 'border-red-100 bg-red-50 text-red-700',
  FAILED: 'border-red-100 bg-red-50 text-red-700',
};

const STATUS_LABEL = {
  ANCHORED: 'Đã neo on-chain',
  VERIFIED: 'Đã xác minh',
  CREATED: 'Chờ neo',
  CORRUPT: 'Hỏng',
  FAILED: 'Thất bại',
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

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

// ---- Page -------------------------------------------------------------------

export default function BackupPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [creating, setCreating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [scan, setScan] = useState(null);

  // Step-up flow: 'CREATE_BACKUP' | { type: 'SURGICAL_RESTORE', items }
  const [stepUp, setStepUp] = useState(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await backupService.list({ page, limit: 10 });
      const data = res.data || {};
      setBackups(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được danh sách backup');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const stats = useMemo(() => {
    const anchored = backups.filter((b) => b.status === 'ANCHORED' || b.status === 'VERIFIED').length;
    const latest = backups[0];
    return {
      total,
      anchored,
      tampered: scan?.tampered?.length ?? null,
      latestAt: latest ? formatTime(latest.createdAt) : '—',
    };
  }, [backups, total, scan]);

  // --- Create backup (needs face step-up) ---
  const handleCreate = () => setStepUp('CREATE_BACKUP');

  // --- Scan integrity (read-only, no step-up) ---
  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await backupService.scan();
      setScan(res.data);
      const n = res.data?.tampered?.length ?? 0;
      if (n === 0) toast.success('Quét hoàn tất: không phát hiện bản ghi nào bị sửa lệch.');
      else toast.error(`Phát hiện ${n} bản ghi bị sửa lệch khỏi trạng thái đã neo on-chain!`);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Quét toàn vẹn thất bại');
    } finally {
      setScanning(false);
    }
  };

  // --- Surgical restore: confirm then step-up ---
  const handleRestoreAll = () => {
    if (!scan?.tampered?.length) return;
    const items = scan.tampered.map((t) => ({ entity: t.entity, entityId: t.entityId }));
    setStepUp({ type: 'SURGICAL_RESTORE', items });
  };

  const handleStepUpSuccess = async (ticket) => {
    const current = stepUp;
    setStepUp(null);
    if (current === 'CREATE_BACKUP') {
      setCreating(true);
      try {
        const res = await backupService.create(ticket);
        const d = res.data || {};
        toast.success(`Đã tạo backup ${d.backupCode} (${d.anchored ? 'đã neo on-chain' : 'chờ neo'}).`);
        await loadBackups();
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || 'Tạo backup thất bại');
      } finally {
        setCreating(false);
      }
    } else if (current?.type === 'SURGICAL_RESTORE') {
      setRestoring(true);
      try {
        const res = await backupService.restore(current.items, ticket);
        const d = res.data || {};
        toast.success(`Đã khôi phục ${d.restored?.length || 0} bản ghi từ snapshot đã neo on-chain.`);
        setScan(null);
        await handleScan();
      } catch (err) {
        toast.error(err?.response?.data?.message || err.message || 'Khôi phục thất bại');
      } finally {
        setRestoring(false);
      }
    }
  };

  return (
    <DashboardLayout
      user={user}
      navItems={ADMIN_NAV_ITEMS}
      activeItem="backup"
      onNavigate={(id) => navigateAdmin(navigate, id)}
      onLogout={logout}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[28px] border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-blue-50 p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div>
              <p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.24em] mb-3">Sao lưu & khôi phục</p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Backup tự xác thực</h2>
              <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">
                Mỗi bản backup được băm (SHA256) và neo manifest lên blockchain ngay khi tạo, nên có thể chứng minh tệp
                không bị sửa và biết được nó "sạch" tới mốc nào. Khi phát hiện giả mạo, có thể khôi phục phẫu thuật chỉ
                những bản ghi bị sửa — giữ nguyên dữ liệu hợp lệ khác.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                id="backup-scan-button"
                onClick={handleScan}
                disabled={scanning}
                className="rounded-2xl border border-cyan-200 bg-white px-5 py-3 text-sm font-black text-cyan-700 shadow-sm hover:bg-cyan-50 disabled:opacity-50"
              >
                {scanning ? 'Đang quét…' : 'Quét toàn vẹn'}
              </button>
              <button
                id="backup-create-button"
                onClick={handleCreate}
                disabled={creating}
                className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 hover:bg-cyan-700 disabled:opacity-50"
              >
                {creating ? 'Đang tạo…' : 'Tạo backup ngay'}
              </button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard label="Tổng số backup" value={stats.total} hint="Các bản đã tạo" />
          <StatCard label="Đã neo on-chain" value={stats.anchored} hint="Manifest đã công chứng" />
          <StatCard
            label="Bản ghi bị sửa"
            value={stats.tampered === null ? '—' : stats.tampered}
            hint={stats.tampered === null ? 'Chưa quét' : stats.tampered === 0 ? 'Toàn vẹn' : 'Cần khôi phục!'}
          />
          <StatCard label="Backup gần nhất" value={stats.latestAt} hint="Thời điểm tạo" small />
        </section>

        {/* Scan result / surgical restore */}
        {scan && <ScanPanel scan={scan} onRestoreAll={handleRestoreAll} restoring={restoring} />}

        {/* Backups table */}
        {loading ? (
          <LoadingIndicator size="lg" label="Đang tải danh sách backup..." />
        ) : (
          <BackupsTable
            backups={backups}
            page={page}
            totalPages={totalPages}
            total={total}
            onPrev={() => setPage((v) => Math.max(1, v - 1))}
            onNext={() => setPage((v) => Math.min(totalPages, v + 1))}
          />
        )}
      </div>

      {stepUp === 'CREATE_BACKUP' && (
        <FaceStepUpModal
          action="CREATE_BACKUP"
          title="Xác nhận tạo backup"
          description="Tạo backup sẽ neo dấu vân tay (hash) của bản sao lưu lên blockchain. Vui lòng quét khuôn mặt để xác nhận."
          onSuccess={handleStepUpSuccess}
          onClose={() => setStepUp(null)}
        />
      )}

      {stepUp?.type === 'SURGICAL_RESTORE' && (
        <FaceStepUpModal
          action="SURGICAL_RESTORE"
          title="Xác nhận khôi phục phẫu thuật"
          description={`Khôi phục ${stepUp.items.length} bản ghi về trạng thái đã neo on-chain. Thao tác này ghi đè dữ liệu hiện tại. Vui lòng quét khuôn mặt để xác nhận.`}
          onSuccess={handleStepUpSuccess}
          onClose={() => setStepUp(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ---- Scan result panel ------------------------------------------------------

function ScanPanel({ scan, onRestoreAll, restoring }) {
  const tampered = scan.tampered || [];
  const ok = tampered.length === 0;
  return (
    <section className={`rounded-3xl border p-6 shadow-sm ${ok ? 'border-emerald-100 bg-emerald-50/70' : 'border-red-100 bg-red-50/70'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className={`text-sm font-black ${ok ? 'text-emerald-800' : 'text-red-800'}`}>
            {ok ? 'Dữ liệu toàn vẹn' : `Phát hiện ${tampered.length} bản ghi bị sửa lệch khỏi on-chain`}
          </p>
          <p className={`mt-0.5 text-xs font-semibold ${ok ? 'text-emerald-700' : 'text-red-700'}`}>
            Đã đối chiếu {scan.totalChecked} bản ghi với snapshot đã neo · {scan.cleanCount} sạch ·{' '}
            quét lúc {formatTime(scan.scannedAt)}
          </p>
        </div>
        {!ok && (
          <button
            onClick={onRestoreAll}
            disabled={restoring}
            className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-100 hover:bg-red-700 disabled:opacity-50"
          >
            {restoring ? 'Đang khôi phục…' : `Khôi phục phẫu thuật (${tampered.length})`}
          </button>
        )}
      </div>

      {!ok && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-red-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-red-50/60 text-[11px] font-black uppercase tracking-wider text-red-500">
              <tr>
                <th className="px-4 py-3">Đối tượng</th>
                <th className="px-4 py-3">ID bản ghi</th>
                <th className="px-4 py-3">Trường bị sửa</th>
                <th className="px-4 py-3">Seq đã neo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-50">
              {tampered.map((t) => (
                <tr key={`${t.entity}-${t.entityId}`} className="hover:bg-red-50/40">
                  <td className="px-4 py-3 font-black text-slate-900">{ENTITY_LABELS[t.entity] || t.entity}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{shortHash(t.entityId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {t.driftedFields.map((f) => (
                        <span key={f} className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono font-black text-slate-400">{t.anchoredSeq}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---- Backups table ----------------------------------------------------------

function BackupsTable({ backups, page, totalPages, total, onPrev, onNext }) {
  if (!backups.length) {
    return <Empty title="Chưa có bản backup nào" desc="Bấm 'Tạo backup ngay' để tạo bản sao lưu đầu tiên và neo lên blockchain." />;
  }
  return (
    <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Mã backup</th>
              <th className="px-4 py-3">SHA256 tệp</th>
              <th className="px-4 py-3">Kích thước</th>
              <th className="px-4 py-3">Tới seq</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-5 py-3">Hash giao dịch</th>
              <th className="px-4 py-3">Tạo lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {backups.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono font-black text-slate-900">{b.backupCode}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-cyan-600">{shortHash(b.sha256)}</td>
                <td className="px-4 py-3 font-black text-slate-700">{formatSize(b.sizeBytes)}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{b.maxSeq ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${STATUS_TONE[b.status] || 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                    {STATUS_LABEL[b.status] || b.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{shortHash(b.anchorTxHash)}</td>
                <td className="px-4 py-3 text-[12px] text-slate-500">{formatTime(b.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} label="bản backup" onPrev={onPrev} onNext={onNext} />
    </section>
  );
}

// ---- Small presentational bits ----------------------------------------------

function StatCard({ label, value, hint, small }) {
  return (
    <article className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <strong className={`block font-black text-slate-950 mt-2 ${small ? 'text-base' : 'text-3xl'}`}>{value}</strong>
      <p className="mt-3 text-xs font-semibold text-cyan-600">{hint}</p>
    </article>
  );
}

function Pagination({ page, totalPages, total, label, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-bold text-slate-500">Trang {page}/{totalPages} · {total} {label}</p>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={page <= 1} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Trước</button>
        <button onClick={onNext} disabled={page >= totalPages} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-40">Sau</button>
      </div>
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
