import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { aiModelService } from '../apis/aiModelService';
import { useToast } from '../../../providers/ToastProvider';

// A provider is either a managed cloud API (endpoint auto-filled, key required) or a
// self-hosted / custom endpoint (admin types the URL, key optional). "local" covers
// OpenAI-compatible servers like Ollama, vLLM, LM Studio running Llama and friends.
const PROVIDERS = [
  { value: 'chatgpt', label: 'ChatGPT / OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', hint: 'API Chat Completions của OpenAI', cloud: true },
  { value: 'gemini', label: 'Gemini / Google', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', hint: 'API generateContent của Google Gemini', cloud: true },
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions', hint: 'DeepSeek tương thích OpenAI', cloud: true },
  { value: 'qwen', label: 'Qwen', endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', hint: 'Nền tảng Alibaba DashScope', cloud: true },
  { value: 'anthropic', label: 'Anthropic Claude', endpoint: 'https://api.anthropic.com/v1/messages', hint: 'API Messages của Claude', cloud: true },
  { value: 'local', label: 'Llama / Tự lưu trữ', endpoint: '', hint: 'Máy chủ tương thích OpenAI (Ollama, vLLM, LM Studio) - chỉ cần nhập điểm cuối API', cloud: false },
  { value: 'other', label: 'Khác / Tùy chỉnh', endpoint: '', hint: 'Nhập điểm cuối API tùy chỉnh của bạn', cloud: false },
];

const MODEL_OPTIONS = {
  chatgpt: [
    { value: 'gpt-5.2', label: 'GPT-5.2' },
    { value: 'gpt-5.2-pro', label: 'GPT-5.2 Pro' },
    { value: 'gpt-5-mini', label: 'GPT-5 mini' },
    { value: 'gpt-5-nano', label: 'GPT-5 nano' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-flash-latest', label: 'Gemini Flash mới nhất' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek Chat' },
    { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner' },
  ],
  qwen: [
    { value: 'qwen-plus', label: 'Qwen Plus' },
    { value: 'qwen-turbo', label: 'Qwen Turbo' },
    { value: 'qwen-max', label: 'Qwen Max' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
    { value: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  local: [
    { value: 'llama3.3', label: 'Llama 3.3' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'qwen2.5', label: 'Qwen 2.5 (nội bộ)' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'phi4', label: 'Phi-4' },
  ],
};

const emptyForm = {
  modelName: '',
  modelVersion: 'gpt-5.2',
  recommendedSpecialty: '',
  provider: 'chatgpt',
  apiEndpoint: '',
  secretOrIpHash: '',
  description: '',
};

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function providerInfo(provider) { return PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0]; }
function modelOptions(provider) { return MODEL_OPTIONS[provider] || []; }
function defaultModelForProvider(provider) { return modelOptions(provider)[0]?.value || ''; }
function isKnownModel(provider, modelVersion) { return modelOptions(provider).some((model) => model.value === modelVersion); }
function isCloudProvider(provider) { return Boolean(providerInfo(provider).cloud); }
// local + other have no preset URL → the admin must type the endpoint themselves.
function needsManualEndpoint(provider) { return !isCloudProvider(provider); }
// Cloud providers authenticate with a key; self-hosted/custom can run keyless.
function requiresKey(provider) { return isCloudProvider(provider); }
function providerLabel(provider) { return providerInfo(provider).label; }
function resolvedEndpoint(form) {
  const custom = form.apiEndpoint.trim();
  if (custom) return custom;
  return providerInfo(form.provider).endpoint.replace('{model}', form.modelVersion || defaultModelForProvider(form.provider) || 'gemini-2.5-flash');
}

export default function AiModelsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [models, setModels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState(''); // '' | cloud | local
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const load = async (page = pagination.page, currentFilter = filter, currentSearch = search) => {
    setLoading(true);
    setStatsLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        aiModelService.list({
          page,
          limit: pagination.limit,
          provider: currentFilter || undefined,
          search: currentSearch || undefined,
        }),
        aiModelService.stats(),
      ]);
      const data = res.data || {};
      setModels(getItems(data));
      if (!Array.isArray(data)) {
        setPagination({
          page: data.page,
          limit: data.limit,
          total: data.total,
          totalPages: data.totalPages,
        });
      }
      setStatsData(statsRes.data);
    } catch (err) { 
      toast.error(err.response?.data?.message || 'Không tải được danh mục mô hình AI'); 
    } finally { 
      setLoading(false); 
      setStatsLoading(false);
    }
  };

  useEffect(() => { load(1); }, []);

  const stats = useMemo(() => [
    { label: 'Tổng số mô hình', value: pagination.total },
    { label: 'API đám mây', value: statsData?.totalCloudCount || models.filter((m) => m.provider && m.provider !== 'local' && m.provider !== 'ip').length },
    { label: 'Tự lưu trữ', value: statsData?.totalLocalCount || models.filter((m) => m.provider === 'local').length },
    { label: 'Trên chuỗi', value: models.filter((m) => m.isActiveOnChain).length },
  ], [models, pagination.total, statsData]);

  const visibleModels = models;

  const handleFilterChange = (val) => {
    setFilter(val);
    load(1, val, search);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    load(1, filter, search);
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setTestResult(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (saving || testing) return;
    setShowCreateModal(false);
    setTestResult(null);
  };

  const updateForm = (key, value) => {
    setTestResult(null);
    setForm((current) => ({
      ...current,
      [key]: value,
      // Switching provider resets the model id to that provider's default and clears any
      // previously typed endpoint (cloud providers auto-resolve theirs).
      ...(key === 'provider' ? { modelVersion: defaultModelForProvider(value), apiEndpoint: '' } : {}),
    }));
  };

  const testApi = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await aiModelService.testApi({
        provider: form.provider,
        modelVersion: form.modelVersion,
        secretOrIpHash: form.secretOrIpHash || undefined,
        apiEndpoint: form.apiEndpoint || undefined,
      });
      setTestResult(res.data);
      toast.success(`Kết nối thành công (${res.data.latencyMs}ms).`);
    } catch (err) { toast.error(err.response?.data?.message || 'Kết nối mô hình thất bại'); }
    finally { setTesting(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      // Unified flow: every model is registered as an API endpoint. Self-hosted (local) just
      // points at its own URL. type is kept for backend compatibility.
      const payload = {
        modelName: form.modelName,
        modelVersion: form.modelVersion,
        recommendedSpecialty: form.recommendedSpecialty || undefined,
        type: 'API',
        provider: form.provider,
        apiEndpoint: form.apiEndpoint || undefined,
        secretOrIpHash: form.secretOrIpHash || undefined,
        description: form.description || undefined,
      };
      const res = await aiModelService.create(payload);
      toast.success(`Đã thêm mô hình ${res.data.modelName}.`);
      setForm(emptyForm); setTestResult(null); setShowCreateModal(false);
      await load(1);
    } catch (err) { toast.error(err.response?.data?.message || 'Không thêm được mô hình AI'); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="aiModels" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-2xl border border-cyan-100 bg-gradient-to-br from-white via-cyan-50 to-white p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] font-black text-cyan-600">Danh mục mô hình AI</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950 tracking-tight">Quản lý mô hình AI</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">Một luồng duy nhất cho mọi mô hình. Chọn nền tảng đám mây hoặc mô hình tự lưu trữ (Llama, Ollama, vLLM) - chỉ cần dán điểm cuối API là chạy.</p>
              <span className="mt-4 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-700">{pagination.total} mô hình</span>
            </div>
            <button type="button" onClick={openCreateModal} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 transition-colors">+ Thêm mô hình AI</button>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((item) => <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{item.label}</p><strong className="mt-1 block text-2xl font-black text-slate-950">{String(item.value).padStart(2, '0')}</strong></div>)}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Danh mục hiện tại</h2>
                <p className="text-sm text-slate-500">Danh sách mô hình đã đăng ký trong hệ thống.</p>
              </div>
              <select value={filter} onChange={(event) => handleFilterChange(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold outline-none">
                <option value="">Tất cả</option>
                <option value="cloud">API đám mây</option>
                <option value="local">Tự lưu trữ</option>
              </select>
            </div>
            <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-3">
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên mô hình, nền tảng..." className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
              <button type="submit" className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-700">Tìm kiếm</button>
            </form>
          </div>
          <div className="p-5 space-y-3 max-h-[760px] overflow-y-auto">
            {loading && <LoadingIndicator size="lg" label="Đang tải mô hình AI..." />}
            {!loading && visibleModels.map((model) => <ModelCard key={model.id} model={model} />)}
            {!loading && !visibleModels.length && <Empty title="Chưa có mô hình AI" desc="Bấm + Thêm mô hình AI để mở cửa sổ đăng ký mô hình." />}
          </div>
          <Pagination pagination={pagination} onPageChange={load} />
        </section>

        {/* Bảng phân tích & Xác thực toàn vẹn Đánh giá AI */}
        {statsData && (
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
            <div>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-cyan-600 bg-cyan-50 px-2.5 py-1 rounded-md">Kiểm định chất lượng và bảo mật AI</span>
              <h2 className="text-xl font-black text-slate-950 mt-2">Bảng điều khiển Chất lượng & Xác thực Đánh giá AI</h2>
              <p className="text-xs text-slate-500 mt-1">Đánh giá thực tế từ các bác sĩ và kết quả đối soát chữ ký số/blockchain của từng phản hồi.</p>
            </div>

            {/* Top & Bottom Models */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
	              Mô hình được đánh giá cao nhất
                </h3>
                <div className="space-y-2">
                  {statsData.topModels?.map((m) => (
                    <div key={m.id} className="flex justify-between items-center rounded-xl bg-slate-50 border border-slate-100 p-3 shadow-xs">
                      <div>
                        <strong className="block text-xs text-slate-900">{m.modelName}</strong>
	                        <span className="text-[10px] font-bold text-slate-400">Phiên bản {m.modelVersion} · {providerLabel(m.provider) || m.provider}</span>
                      </div>
                      <span className="rounded-lg bg-cyan-50 px-2 py-1 text-xs font-black text-cyan-700">{m.averageAccuracy}% tin cậy</span>
                    </div>
                  ))}
                  {!statsData.topModels?.length && <div className="text-xs text-slate-500 italic text-center py-4">Chưa có đánh giá nào.</div>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-950 flex items-center gap-2">
	                  Mô hình được đánh giá thấp nhất
                </h3>
                <div className="space-y-2">
                  {statsData.bottomModels?.map((m) => (
                    <div key={m.id} className="flex justify-between items-center rounded-xl bg-slate-50 border border-slate-100 p-3 shadow-xs">
                      <div>
                        <strong className="block text-xs text-slate-900">{m.modelName}</strong>
	                        <span className="text-[10px] font-bold text-slate-400">Phiên bản {m.modelVersion} · {providerLabel(m.provider) || m.provider}</span>
                      </div>
                      <span className="rounded-lg bg-rose-50 px-2 py-1 text-xs font-black text-rose-700">{m.averageAccuracy}% tin cậy</span>
                    </div>
                  ))}
                  {!statsData.bottomModels?.length && <div className="text-xs text-slate-500 italic text-center py-4">Chưa có đánh giá nào.</div>}
                </div>
              </div>
            </div>

            {/* Ý kiến phản hồi & Xác thực toàn vẹn từ Blockchain */}
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                Ý kiến phản hồi gần đây & Xác thực toàn vẹn dữ liệu
              </h3>
              <div className="space-y-3">
                {statsData.recentNegativeFeedbacks?.map((f) => {
                  let statusLabel = 'Chưa xác thực';
                  let statusClass = 'bg-slate-100 text-slate-600 border-slate-200';
                  if (f.audit?.status === 'VERIFIED') {
                    statusLabel = 'Hợp lệ (trên chuỗi)';
                    statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                  } else if (f.audit?.status === 'TAMPERED') {
                    statusLabel = 'BỊ GIẢ MẠO!';
                    statusClass = 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse';
                  } else if (f.audit?.status === 'UNANCHORED') {
                    statusLabel = 'Chờ neo (5 phút)';
                    statusClass = 'bg-amber-50 text-amber-700 border-amber-100';
                  }

                  return (
                    <div key={f.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div>
                          <strong className="block text-xs text-slate-900">
                            Mô hình: {f.modelName} (v{f.modelVersion})
                          </strong>
                          <span className="text-[10px] font-semibold text-slate-400">
                            Bác sĩ: {f.doctorName} · {new Date(f.createdAt).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>

                      <div className="rounded-xl bg-white border border-slate-100 p-3">
                        <p className="text-xs text-slate-700 italic">" {f.feedback} "</p>
                      </div>

                      {/* Audit Details */}
                      {f.audit && (
                        <div className="text-[10px] font-mono bg-white rounded-lg border border-slate-100 p-2 text-slate-500 space-y-1">
                          <div className="flex justify-between">
                            <span>Hash CSDL:</span>
                            <span className="font-bold truncate max-w-[200px] text-slate-700">{f.audit.storedHash || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hash Neo (Blockchain):</span>
                            <span className="font-bold truncate max-w-[200px] text-slate-700">{f.audit.onChainHash || 'Chưa neo'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Đối khớp cục bộ:</span>
                            <span className={`font-bold ${f.audit.dbMatches ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {f.audit.dbMatches ? 'KHỚP' : 'LỆCH (Cảnh báo)'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!statsData.recentNegativeFeedbacks?.length && (
                  <div className="text-xs text-slate-500 italic text-center py-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                    Không có phản hồi kém chất lượng nào gần đây.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
      {showCreateModal && <CreateModelModal form={form} updateForm={updateForm} onSubmit={submit} onClose={closeCreateModal} saving={saving} testing={testing} testApi={testApi} testResult={testResult} />}
    </DashboardLayout>
  );
}

function CreateModelModal({ form, updateForm, onSubmit, onClose, saving, testing, testApi, testResult }) {
  const endpoint = resolvedEndpoint(form);
  const selectedProvider = providerInfo(form.provider);
  const manualEndpoint = needsManualEndpoint(form.provider);
  const keyRequired = requiresKey(form.provider);
  const canTest = Boolean(form.provider && form.modelVersion && (manualEndpoint ? form.apiEndpoint : true) && (keyRequired ? form.secretOrIpHash : true));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/60 bg-white shadow-xl">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 p-6 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
	              <p className="text-[10px] uppercase tracking-[0.24em] font-black text-cyan-500">Tạo mô hình AI</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Thêm mô hình AI</h2>
	              <p className="mt-1 text-sm text-slate-500">Chọn nền tảng. Nền tảng đám mây tự điền điểm cuối API; mô hình tự lưu trữ chỉ cần dán điểm cuối API.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600">Đóng</button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tên mô hình hiển thị" value={form.modelName} onChange={(v) => updateForm('modelName', v)} required placeholder="VD: Trợ lý nội tổng quát" />
            <Field label="Chuyên khoa khuyến nghị" value={form.recommendedSpecialty} onChange={(v) => updateForm('recommendedSpecialty', v)} placeholder="VD: Nội tổng quát" />
          </div>

          <label className="block">
            <span className="text-xs font-black text-slate-600">Nền tảng</span>
            <select value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
              {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">{selectedProvider.hint}</p>
          </label>

          <ModelPicker form={form} updateForm={updateForm} />

          {/* Endpoint: cloud auto-resolves and shows a read-only preview + optional override.
              Self-hosted/custom requires the admin to paste the URL. */}
          {manualEndpoint ? (
            <Field
	              label="Điểm cuối API"
              value={form.apiEndpoint}
              onChange={(v) => updateForm('apiEndpoint', v)}
              required
              placeholder="http://localhost:11434/v1/chat/completions"
            />
          ) : (
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
	                <p className="text-xs font-black text-slate-600">Điểm cuối API</p>
	                <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-cyan-700">{form.apiEndpoint ? 'GHI ĐÈ' : 'TỰ ĐỘNG'}</span>
              </div>
              <p className="mt-2 break-all rounded-xl bg-white px-3 py-3 text-sm font-bold text-slate-700 border border-cyan-100">{endpoint || 'Tự động theo nền tảng'}</p>
              <div className="mt-3">
	                <Field label="Ghi đè điểm cuối API (tùy chọn)" value={form.apiEndpoint} onChange={(v) => updateForm('apiEndpoint', v)} placeholder="Để trống để dùng điểm cuối mặc định" />
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-xs font-black text-slate-600">
	              Khóa API / Token {keyRequired ? <span className="text-rose-500">*</span> : <span className="font-bold text-slate-400">(tùy chọn)</span>}
            </span>
            <textarea
              required={keyRequired}
              value={form.secretOrIpHash}
              onChange={(event) => updateForm('secretOrIpHash', event.target.value)}
              rows={2}
	              placeholder={keyRequired ? 'sk-... / token nhà cung cấp' : 'Mô hình tự lưu trữ thường không cần khóa - để trống nếu vậy'}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
            />
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">Nếu nhập, giá trị sẽ được mã hóa AES-256 bằng ENCRYPTION_KEY trước khi lưu.</p>
          </label>

          <label className="block">
            <span className="text-xs font-black text-slate-600">Mô tả</span>
            <textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={2} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" />
          </label>

          <button type="button" disabled={testing || !canTest} onClick={testApi} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-black text-cyan-700 disabled:opacity-50">
            {testing ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối mô hình'}
          </button>
          {testResult && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">Thành công · {testResult.provider} · {testResult.latencyMs}ms · {testResult.endpoint}</div>}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">Hủy</button>
            <button disabled={saving} className="flex-1 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-60">{saving ? 'Đang lưu...' : 'Thêm mô hình AI'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModelPicker({ form, updateForm }) {
  const options = modelOptions(form.provider);
  // Providers with presets (cloud + local) show a dropdown plus a free-text escape hatch.
  // Providers without presets (other) are pure free-text.
  if (!options.length) {
    return <Field label="ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', v)} required placeholder="VD: mo-hinh-tuy-chinh" />;
  }
  const useCustom = !isKnownModel(form.provider, form.modelVersion);
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="text-xs font-black text-slate-600">Mô hình</span>
        <select value={useCustom ? '__custom__' : form.modelVersion} onChange={(event) => updateForm('modelVersion', event.target.value === '__custom__' ? '' : event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">
          {options.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}
          <option value="__custom__">Tùy chỉnh ID mô hình</option>
        </select>
      </label>
      {useCustom && <Field label="Nhập ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', v)} required placeholder="VD: llama3.1 hoặc gpt-5.2" />}
    </div>
  );
}

function Field({ label, value, onChange, required = false, placeholder = '' }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}{required && <span className="text-rose-500"> *</span>}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>; }
function ModelCard({ model }) {
  const isLocal = model.provider === 'local';
  const badgeCls = isLocal ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : 'bg-cyan-50 text-cyan-700 border-cyan-100';
  const badge = isLocal ? 'TỰ LƯU TRỮ' : (providerLabel(model.provider) || model.provider || 'API').toUpperCase();
  const hasAccuracy = model.averageAccuracy !== null && model.averageAccuracy !== undefined;

  return (
    <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-black text-slate-950">{model.modelName}</h3>
            <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${badgeCls}`}>{badge}</span>
            {hasAccuracy && (
              <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${model.averageAccuracy >= 80 ? 'bg-cyan-50 text-cyan-700 border-cyan-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                Độ tin cậy: {model.averageAccuracy}% ({model.totalRatings} đánh giá)
              </span>
            )}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">Phiên bản {model.modelVersion} · {model.recommendedSpecialty || 'Chưa gán chuyên khoa'}</p>
        </div>
        <div className="flex gap-2 items-center">
          <BlockchainStatusBadge status={model.blockchainStatus} />
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-cyan-700 border border-slate-100 shadow-xs">AES-256</span>
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-600">{model.description || 'Chưa có mô tả'}</p>
      {model.apiEndpoint && (
        <div className="mt-3 rounded-xl bg-white border border-slate-100 p-3">
          <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Điểm cuối API</p>
          <p className="mt-1 break-all text-xs font-mono text-slate-600">{model.apiEndpoint}</p>
        </div>
      )}
      <div className="mt-3 rounded-xl bg-white border border-slate-100 p-3">
        <p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Dấu vân tay SHA-256</p>
        <p className="mt-1 break-all text-xs font-mono text-slate-600">{model.ipHashPlain || 'Không hiển thị'}</p>
      </div>
    </article>
  );
}
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function Pagination({ pagination, onPageChange }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4">
      <p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50"
        >
          Trước
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
