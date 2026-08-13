import React, { useEffect, useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { aiModelService } from '../apis/aiModelService';
import { useToast } from '../../../providers/ToastProvider';
import AuditHistoryChanges from './AuditHistoryChanges';

const STATUS_TONE = {
  VERIFIED: { label: 'Xác thực khớp với blockchain', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  TAMPERED: { label: 'CẢNH BÁO: Dữ liệu đã bị sửa đổi!', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  PENDING_ANCHOR: { label: 'Đang chờ neo on-chain', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  UNANCHORED: { label: 'Chưa được neo trên blockchain', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
};

const ACTION_LABEL = {
  CREATE: 'Tạo mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

const ACTION_TONE = {
  CREATE: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  UPDATE: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  DELETE: 'bg-rose-50 text-rose-700 border-rose-100',
};

const PROVIDER_LABEL = {
  chatgpt: 'ChatGPT / OpenAI',
  gemini: 'Gemini / Google',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  anthropic: 'Anthropic Claude',
  local: 'Llama / Tự lưu trữ',
  other: 'Khác / Tùy chỉnh',
};

function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : 'N/A';
}

function providerLabel(provider) {
  return PROVIDER_LABEL[provider] || provider || 'Chưa cập nhật';
}

function historyHash(log) {
  return log.afterHash || log.dataHash || log.entryHash || null;
}

const FIELD_LABELS = {
  apiEndpoint: 'Điểm cuối API',
  createdBy: 'Người tạo',
  ipHashPlain: 'Dấu vân tay cấu hình',
  modelName: 'Tên mô hình',
  modelVersion: 'Phiên bản mô hình',
  provider: 'Nền tảng',
  recommendedSpecialty: 'Chuyên khoa gợi ý',
  type: 'Loại tích hợp',
};

function isRedacted(value) {
  return typeof value === 'string' && value.toUpperCase().includes('REDACTED');
}

function auditDisplayName(log) {
  const rawName = log.afterJson?.modelName || log.beforeJson?.modelName;
  if (rawName && !isRedacted(rawName)) return rawName;
  if (log.action === 'CREATE') return 'Tạo cấu hình mô hình AI';
  if (log.action === 'UPDATE') return 'Cập nhật cấu hình mô hình AI';
  if (log.action === 'DELETE') return 'Xóa cấu hình mô hình AI';
  return 'Thay đổi cấu hình mô hình AI';
}

function fieldLabel(field) {
  return FIELD_LABELS[field] || field;
}
export default function AiModelDetailModal({ modelId, onClose }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('info');

  const load = async () => {
    setLoading(true);
    try {
      const [res, historyRes] = await Promise.all([
        aiModelService.get(modelId),
        aiModelService.history(modelId),
      ]);
      setDetail(res.data);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.items || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Không tải được chi tiết mô hình AI');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (modelId) load();
  }, [modelId]);

  if (!modelId) return null;

  const model = detail || {};
  const audit = model.audit || {};
  const tone = STATUS_TONE[audit.status] || STATUS_TONE.UNANCHORED;
  const ratingText = model.averageAccuracy === null || model.averageAccuracy === undefined
    ? 'Chưa có đánh giá'
    : `${model.averageAccuracy}% (${model.totalRatings || 0} đánh giá)`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-xl font-black text-cyan-600">
              AI
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-600">Chi tiết mô hình AI</p>
              <h3 className="text-2xl font-black text-slate-950">{model.modelName || 'Mô hình AI'}</h3>
              <p className="text-sm text-slate-500">
                Phiên bản {model.modelVersion || 'N/A'} · {providerLabel(model.provider)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={load} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Làm mới</button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
          </div>
        </div>

        <div className="shrink-0 px-6 py-2 border-b border-slate-100 flex gap-2">
          <button onClick={() => setActiveTab('info')} className={`px-4 py-2 text-xs font-black rounded-xl border transition-colors ${activeTab === 'info' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Hồ sơ & Xác thực blockchain
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-xs font-black rounded-xl border transition-colors ${activeTab === 'history' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Lịch sử cập nhật ({history.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-6">
          {loading ? (
            <LoadingIndicator size="lg" label="Đang tải chi tiết mô hình AI..." />
          ) : activeTab === 'info' ? (
            <div className="space-y-6">
              <div className={`rounded-2xl border p-5 shadow-sm space-y-4 ${audit.status === 'VERIFIED' ? 'bg-emerald-50/60 border-emerald-100' : audit.status === 'TAMPERED' ? 'bg-rose-50/60 border-rose-100 animate-pulse' : 'bg-amber-50/60 border-amber-100'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${tone.cls}`}>
                    <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
                    Trạng thái: {tone.label}
                  </span>
                  <span className="text-[11px] font-black uppercase text-cyan-700 tracking-wider">
                    Xác thực bằng hợp đồng thông minh Solidity
                  </span>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2 mt-3">
                  <strong className="block text-slate-900 font-bold border-b pb-1 text-sm">Xác thực toàn vẹn dữ liệu mô hình AI</strong>
                  <div className="space-y-1.5 text-xs">
                    <HashRow label="Trạng thái" value={audit.chainMatches ? 'Khớp với blockchain' : audit.onChainHash ? 'Mâu thuẫn' : 'Chưa neo'} match={audit.chainMatches} />
                    <HashRow label="Hash trong CSDL" value={audit.storedHash} match={audit.dbMatches} />
                    <HashRow label="Hash trên chuỗi" value={audit.onChainHash} match={audit.chainMatches} />
                    <HashRow label="Hash tính lại" value={audit.recomputedHash} match={audit.dbMatches && audit.chainMatches} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-b pb-2 tracking-wide uppercase">Thông tin mô hình</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Tên mô hình" value={model.modelName} />
                    <Field label="Phiên bản" value={model.modelVersion} />
                    <Field label="Nền tảng" value={providerLabel(model.provider)} />
                    <Field label="Loại tích hợp" value={model.type || 'API'} />
                    <Field label="Chuyên khoa" value={model.recommendedSpecialty || 'Tổng quát'} />
                    <Field label="Trạng thái" value={model.isDeleted ? 'Đã xóa mềm' : 'Đang sử dụng'} />
                    <Field label="Độ tin cậy" value={ratingText} colSpan={2} />
                    <Field label="Mô tả" value={model.description || 'Chưa có mô tả'} colSpan={2} />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <h4 className="text-sm font-black text-slate-900 border-b pb-2 tracking-wide uppercase">Cấu hình bảo mật</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Mã mô hình" value={model.id} colSpan={2} mono />
                    <Field label="Điểm cuối API" value={model.apiEndpoint || 'Không hiển thị'} colSpan={2} mono />
                    <Field
                      label="Cấu hình secret"
                      value={model.secretConfigured || model.ipHashPlain || model.secretFingerprint
                        ? 'Đã cấu hình (không hiển thị plaintext)'
                        : 'Chưa cấu hình secret'}
                      colSpan={2}
                    />
                    <Field label="Dấu vân tay SHA-256" value={model.secretFingerprint || model.ipHashPlain || 'Không hiển thị'} colSpan={2} mono />
                    <Field label="Mã hóa khóa" value="AES-256" />
                    <Field label="Blockchain" value={model.isActiveOnChain ? 'Đã kích hoạt' : 'Theo audit log'} />
                    <Field label="Ngày tạo" value={formatTime(model.createdAt)} colSpan={2} />
                    <Field label="Lần cập nhật cuối" value={formatTime(model.updatedAt)} colSpan={2} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((log) => {
                const hash = historyHash(log);
                const name = auditDisplayName(log);
                const changedFields = Array.isArray(log.fieldsChanged) ? log.fieldsChanged.map(fieldLabel).join(', ') : '';
                return (
                  <div key={log.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-black ${ACTION_TONE[log.action] || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                          {ACTION_LABEL[log.action] || log.action}
                        </span>
                        <span className="truncate text-sm font-black text-slate-900">{name}</span>
                        <span className="shrink-0 text-xs font-semibold text-slate-400">{formatTime(log.createdAt)}</span>
                      </div>
                      <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black ${log.onChainStatus === 'ANCHORED' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-amber-100 bg-amber-50 text-amber-700'}`}>
                        {log.onChainStatus === 'ANCHORED' ? 'Đã neo' : 'Chờ neo'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {hash && (
                        <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span>Hash neo:</span>
                          <span className="font-bold text-slate-700">{shortHash(hash)}</span>
                        </div>
                      )}
                      {log.txHash && (
                        <div className="text-[10px] text-slate-500 font-mono flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100">
                          <span>TX:</span>
                          <span className="font-bold text-slate-700">{shortHash(log.txHash)}</span>
                        </div>
                      )}
                    </div>
                    <AuditHistoryChanges log={log} />
                  </div>
                );
              })}
              {!history.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <strong className="text-slate-700">Chưa có lịch sử thay đổi</strong>
                  <p className="mt-1 text-sm text-slate-500">Mọi chỉnh sửa mô hình AI sẽ được ghi lại và neo lên blockchain.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HashRow({ label, value, match }) {
  return (
    <div className="flex justify-between items-center gap-2 py-0.5">
      <span className="text-slate-500 font-semibold">{label}:</span>
      <span className={`font-mono ${match === true ? 'text-emerald-600 font-bold' : match === false ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
        {label === 'Trạng thái' ? (value || '—') : shortHash(value)}
      </span>
    </div>
  );
}

function Field({ label, value, colSpan = 1, mono = false }) {
  return (
    <div className={colSpan === 2 ? 'col-span-2' : ''}>
      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <p className={`mt-0.5 break-words text-sm font-bold text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</p>
    </div>
  );
}
