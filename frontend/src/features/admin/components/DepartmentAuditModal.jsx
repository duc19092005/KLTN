import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { departmentService } from '../apis/departmentService';
import { useToast } from '../../../providers/ToastProvider';

const STATUS_TONE = {
  VERIFIED: { label: 'Khớp blockchain', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  TAMPERED: { label: 'Đã bị sửa đổi', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  UNANCHORED: { label: 'Chưa neo trên chuỗi', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

const ACTION_TONE = {
  CREATE: 'bg-blue-50 text-blue-700 border-blue-100',
  UPDATE: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  DELETE: 'bg-red-50 text-red-700 border-red-100',
};

const ACTION_LABEL = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'N/A';
}

/**
 * Admin modal that verifies department data integrity against the blockchain and shows
 * the full change history recorded in the BlockchainLogger. Verification recomputes each
 * department's hash from the live DB row and compares it to the immutable on-chain value;
 * a mismatch (TAMPERED) means the database row was altered outside the application.
 */
export default function DepartmentAuditModal({ onClose }) {
  const [tab, setTab] = useState('verify');
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [verifyResult, setVerifyResult] = useState(null);
  const [history, setHistory] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const [verifyRes, historyRes] = await Promise.all([
        departmentService.verifyAll(),
        departmentService.history(),
      ]);
      setVerifyResult(verifyRes.data);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.items || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được dữ liệu xác thực');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = verifyResult?.summary || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-100 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Kiểm toán blockchain</p>
              <h3 className="mt-1 text-2xl font-black text-slate-950">Xác thực & Lịch sử thay đổi</h3>
              <p className="mt-1 text-sm text-slate-500">Đối chiếu hash trong CSDL với blockchain để phát hiện dữ liệu bị sửa đổi.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
          </div>

          {/* Summary chips */}
          <div className="mt-4 flex flex-wrap gap-2">
            <SummaryChip tone="total" value={verifyResult?.total ?? '—'} label="Tổng phòng ban" />
            <SummaryChip tone="VERIFIED" value={summary.VERIFIED || 0} label="Khớp" />
            <SummaryChip tone="TAMPERED" value={summary.TAMPERED || 0} label="Bị sửa" />
            <SummaryChip tone="UNANCHORED" value={summary.UNANCHORED || 0} label="Chưa neo" />
            <button type="button" onClick={load} disabled={loading} className="ml-auto rounded-xl border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50">
              {loading ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            <TabButton active={tab === 'verify'} onClick={() => setTab('verify')}>Trạng thái xác thực</TabButton>
            <TabButton active={tab === 'history'} onClick={() => setTab('history')}>Lịch sử thay đổi ({history.length})</TabButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-5">
          {loading ? (
            <LoadingIndicator size="lg" label="Đang đối chiếu với blockchain..." />
          ) : tab === 'verify' ? (
            <VerifyList items={verifyResult?.items || []} />
          ) : (
            <HistoryList items={history} />
          )}
        </div>
      </div>
    </div>
  );
}

function VerifyList({ items }) {
  if (!items.length) return <Empty title="Chưa có phòng ban" desc="Tạo phòng ban để bắt đầu neo dữ liệu lên blockchain." />;
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const tone = STATUS_TONE[item.status] || STATUS_TONE.UNANCHORED;
        return (
          <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-600">{item.departmentCode}</p>
                <h4 className="font-black text-slate-950">{item.name}</h4>
              </div>
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black ${tone.cls}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                {tone.label}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
              <HashRow label="Hash tính lại (DB)" value={item.recomputedHash} match={item.dbMatches} />
              <HashRow label="Hash trên chuỗi" value={item.onChainHash} match={item.chainMatches} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HistoryList({ items }) {
  if (!items.length) return <Empty title="Chưa có lịch sử" desc="Mọi thay đổi phòng ban sẽ được ghi lại và neo lên blockchain." />;
  return (
    <div className="space-y-3">
      {items.map((log) => (
        <div key={log.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${ACTION_TONE[log.action] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>{ACTION_LABEL[log.action] || log.action}</span>
              <span className="text-sm font-black text-slate-900">{log.afterJson?.name || log.beforeJson?.name || log.entityId}</span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">{formatTime(log.createdAt)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className={`rounded-md border px-2 py-0.5 font-black ${log.onChainStatus === 'ANCHORED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
              {log.onChainStatus === 'ANCHORED' ? 'Đã neo trên chuỗi' : 'Chờ neo trên chuỗi'}
            </span>
            {log.txHash && <span className="font-mono text-slate-500">tx: {shortHash(log.txHash)}</span>}
            {log.dataHash && <span className="font-mono text-slate-500">hash: {shortHash(log.dataHash)}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function HashRow({ label, value, match }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 font-mono ${match ? 'text-emerald-600' : value ? 'text-red-600' : 'text-slate-400'}`}>{shortHash(value)}</p>
    </div>
  );
}

function SummaryChip({ tone, value, label }) {
  const cls = tone === 'total'
    ? 'border-slate-200 bg-white text-slate-700'
    : (STATUS_TONE[tone]?.cls || 'border-slate-200 bg-white text-slate-700');
  return (
    <div className={`rounded-xl border px-3 py-1.5 text-xs font-black ${cls}`}>
      <span className="text-base">{value}</span> <span className="font-bold opacity-80">{label}</span>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-2 text-xs font-black transition-all ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <strong className="text-slate-700">{title}</strong>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
    </div>
  );
}
