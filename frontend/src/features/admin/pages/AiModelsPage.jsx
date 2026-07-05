import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { aiModelService } from '../apis/aiModelService';
import { useToast } from '../../../providers/ToastProvider';
import AiModelDetailModal from '../components/AiModelDetailModal';

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

const SPECIALTIES = [
  'Nội tổng quát',
  'Ngoại tổng quát',
  'Nhi khoa',
  'Sản phụ khoa',
  'Tim mạch',
  'Tai Mũi Họng',
  'Răng Hàm Mặt',
  'Mắt',
  'Da liễu',
  'Thần kinh',
  'Chấn thương chỉnh hình',
  'Tiêu hóa',
  'Nội tiết',
  'Ung bướu',
  'Hô hấp',
];

const MAX_MODEL_NAME_LENGTH = 80;
const MAX_MODEL_VERSION_LENGTH = 80;
const MAX_SPECIALTY_LENGTH = 80;
const MAX_ENDPOINT_LENGTH = 500;
const MAX_SECRET_LENGTH = 2000;
const MAX_DESCRIPTION_LENGTH = 500;
const MODEL_VERSION_REGEX = /^[A-Za-z0-9._:/@-]+$/;
const URL_REGEX = /^https?:\/\/.+/i;

function limitText(value, max) { return (value || '').slice(0, max); }
function normalizeModelVersion(value) { return (value || '').trim().replace(/\s+/g, '-').slice(0, MAX_MODEL_VERSION_LENGTH); }
function validateAiModelForm(form, { editing = false } = {}) {
  const errors = {};
  const modelName = form.modelName.trim();
  const modelVersion = form.modelVersion.trim();
  const specialty = form.recommendedSpecialty.trim();
  const endpoint = form.apiEndpoint.trim();
  const secret = form.secretOrIpHash.trim();
  const description = form.description.trim();
  const manualEndpoint = needsManualEndpoint(form.provider);
  const keyRequiredForSubmit = requiresKey(form.provider) && !editing;

  if (!modelName) errors.modelName = 'Vui lòng nhập tên mô hình.';
  else if (modelName.length > MAX_MODEL_NAME_LENGTH) errors.modelName = `Tên mô hình không vượt quá ${MAX_MODEL_NAME_LENGTH} ký tự.`;
  if (specialty.length > MAX_SPECIALTY_LENGTH) errors.recommendedSpecialty = `Chuyên khoa không vượt quá ${MAX_SPECIALTY_LENGTH} ký tự.`;
  if (!form.provider) errors.provider = 'Vui lòng chọn nền tảng.';
  if (!modelVersion) errors.modelVersion = 'Vui lòng chọn hoặc nhập ID mô hình.';
  else if (!MODEL_VERSION_REGEX.test(modelVersion)) errors.modelVersion = 'ID mô hình chỉ gồm chữ, số, dấu ., _, -, /, :, @.';
  else if (modelVersion.length > MAX_MODEL_VERSION_LENGTH) errors.modelVersion = `ID mô hình không vượt quá ${MAX_MODEL_VERSION_LENGTH} ký tự.`;
  if (manualEndpoint && !endpoint) errors.apiEndpoint = 'Vui lòng nhập điểm cuối API.';
  else if (endpoint && !URL_REGEX.test(endpoint)) errors.apiEndpoint = 'Điểm cuối API phải bắt đầu bằng http:// hoặc https://.';
  else if (endpoint.length > MAX_ENDPOINT_LENGTH) errors.apiEndpoint = `Điểm cuối API không vượt quá ${MAX_ENDPOINT_LENGTH} ký tự.`;
  if (keyRequiredForSubmit && !secret) errors.secretOrIpHash = 'Vui lòng nhập khóa API/token.';
  else if (secret.length > MAX_SECRET_LENGTH) errors.secretOrIpHash = `Khóa API/token không vượt quá ${MAX_SECRET_LENGTH} ký tự.`;
  if (description.length > MAX_DESCRIPTION_LENGTH) errors.description = `Mô tả không vượt quá ${MAX_DESCRIPTION_LENGTH} ký tự.`;
  return errors;
}

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
  const [editingModel, setEditingModel] = useState(null);
  const [detailModelId, setDetailModelId] = useState(null);
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
    setEditingModel(null);
    setForm(emptyForm);
    setTestResult(null);
    setShowCreateModal(true);
  };

  const openEditModal = (model) => {
    setEditingModel(model);
    setForm({
      modelName: model.modelName || '',
      modelVersion: model.modelVersion || defaultModelForProvider(model.provider || 'chatgpt'),
      recommendedSpecialty: model.recommendedSpecialty || '',
      provider: model.provider || 'chatgpt',
      apiEndpoint: model.apiEndpoint || '',
      secretOrIpHash: '',
      description: model.description || '',
    });
    setTestResult(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (saving || testing) return;
    setShowCreateModal(false);
    setEditingModel(null);
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
    const validationErrors = validateAiModelForm(form, { editing: Boolean(editingModel) });
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Vui lòng kiểm tra lại thông tin mô hình AI.');
      return;
    }
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
      if (editingModel) {
        const res = await aiModelService.update(editingModel.id, payload);
        toast.success(`Đã cập nhật mô hình ${res.data.modelName}.`);
      } else {
        const res = await aiModelService.create(payload);
        toast.success(`Đã thêm mô hình ${res.data.modelName}.`);
      }
      setForm(emptyForm); setTestResult(null); setShowCreateModal(false); setEditingModel(null);
      await load(editingModel ? pagination.page : 1);
    } catch (err) { toast.error(err.response?.data?.message || (editingModel ? 'Không cập nhật được mô hình AI' : 'Không thêm được mô hình AI')); }
    finally { setSaving(false); }
  };

  const requestDelete = async (model) => {
    if (!model?.id) return;
    setSaving(true);
    try {
      await aiModelService.remove(model.id);
      toast.success(`Đã xóa mềm mô hình ${model.modelName}.`);
      await load(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không xóa được mô hình AI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="aiModels" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex justify-end">
          <button type="button" onClick={openCreateModal} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 transition-colors">+ Thêm mô hình AI</button>
        </div>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((item) => <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{item.label}</p><strong className="mt-1 block text-2xl font-black text-slate-950">{String(item.value).padStart(2, '0')}</strong></div>)}
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-950">Danh mục hiện tại</h2>
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
            {!loading && visibleModels.map((model) => <ModelCard key={model.id} model={model} onViewDetails={setDetailModelId} onEdit={openEditModal} onDelete={requestDelete} busy={saving} />)}
            {!loading && !visibleModels.length && <Empty title="Chưa có mô hình AI" desc="Bấm + Thêm mô hình AI để mở cửa sổ đăng ký mô hình." />}
          </div>
          <Pagination pagination={pagination} onPageChange={load} />
        </section>

        {/* Bảng phân tích & Xác thực toàn vẹn Đánh giá AI */}
        {statsData && (
          <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-950">Bảng điều khiển Chất lượng & Xác thực Đánh giá AI</h2>
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
      {showCreateModal && <CreateModelModal form={form} updateForm={updateForm} onSubmit={submit} onClose={closeCreateModal} saving={saving} testing={testing} testApi={testApi} testResult={testResult} editing={Boolean(editingModel)} />}
      {detailModelId && <AiModelDetailModal modelId={detailModelId} onClose={() => setDetailModelId(null)} />}
    </DashboardLayout>
  );
}

function CreateModelModal({ form, updateForm, onSubmit, onClose, saving, testing, testApi, testResult, editing = false }) {
  const manualEndpoint = needsManualEndpoint(form.provider);
  const keyRequired = requiresKey(form.provider);
  const keyRequiredForSubmit = keyRequired && !editing;
  const canTest = Boolean(form.provider && form.modelVersion && (manualEndpoint ? form.apiEndpoint : true) && (keyRequired ? form.secretOrIpHash : true));
  const specialtyOptions = SPECIALTIES.map((specialty) => ({ value: specialty, label: specialty }));
  const [fieldErrors, setFieldErrors] = useState({});

  const getFieldError = (field, overrideValue) => validateAiModelForm({ ...form, [field]: overrideValue ?? form[field] }, { editing })[field] || '';
  const validateField = (field, overrideValue) => {
    const error = getFieldError(field, overrideValue);
    setFieldErrors((current) => ({ ...current, [field]: error }));
    return !error;
  };
  const handleSubmit = (event) => {
    const errors = validateAiModelForm(form, { editing });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  };
  const changeField = (field, value) => {
    updateForm(field, value);
    if (fieldErrors[field]) setFieldErrors((current) => ({ ...current, [field]: getFieldError(field, value) }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black text-slate-950">{editing ? 'Cập nhật mô hình AI' : 'Thêm mô hình AI'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button>
        </div>

        <SectionTitle title="Thông tin mô hình" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Tên mô hình" value={form.modelName} onChange={(v) => changeField('modelName', limitText(v, MAX_MODEL_NAME_LENGTH))} onBlur={() => validateField('modelName')} error={fieldErrors.modelName} required placeholder="VD: OpenAI" maxLength={MAX_MODEL_NAME_LENGTH} />
          <SelectField label="Nền tảng" value={form.provider} onChange={(v) => changeField('provider', v)} onBlur={() => validateField('provider')} error={fieldErrors.provider} options={PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} required />
          <ModelPicker form={form} updateForm={changeField} errors={fieldErrors} validateField={validateField} />
          <SelectField label="Chuyên khoa" value={form.recommendedSpecialty} onChange={(v) => changeField('recommendedSpecialty', v)} onBlur={() => validateField('recommendedSpecialty')} error={fieldErrors.recommendedSpecialty} empty="Chọn chuyên khoa hệ thống" options={specialtyOptions} />
        </div>

        <SectionTitle title="Kết nối và bảo mật" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {manualEndpoint && <div className="md:col-span-2"><Field label="Điểm cuối API" value={form.apiEndpoint} onChange={(v) => changeField('apiEndpoint', limitText(v.trim(), MAX_ENDPOINT_LENGTH))} onBlur={() => validateField('apiEndpoint')} error={fieldErrors.apiEndpoint} required placeholder="http://localhost:11434/v1/chat/completions" maxLength={MAX_ENDPOINT_LENGTH} /></div>}
          <TextAreaField label="Khóa API / Token" value={form.secretOrIpHash} onChange={(v) => changeField('secretOrIpHash', limitText(v, MAX_SECRET_LENGTH))} onBlur={() => validateField('secretOrIpHash')} error={fieldErrors.secretOrIpHash} required={keyRequiredForSubmit} optional={!keyRequiredForSubmit} rows={3} maxLength={MAX_SECRET_LENGTH} className="md:col-span-2" />
          <TextAreaField label="Mô tả" value={form.description} onChange={(v) => changeField('description', limitText(v, MAX_DESCRIPTION_LENGTH))} onBlur={() => validateField('description')} error={fieldErrors.description} rows={3} maxLength={MAX_DESCRIPTION_LENGTH} className="md:col-span-2" />
        </div>

        <SectionTitle title="Kiểm tra kết nối" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button type="button" disabled={testing || !canTest} onClick={testApi} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-black text-cyan-700 hover:bg-cyan-100 disabled:opacity-50">
            {testing ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối mô hình'}
          </button>
          {testResult && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">Thành công · {testResult.provider} · {testResult.latencyMs}ms · {testResult.endpoint}</div>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50">Hủy</button>
          <button disabled={saving} className="flex-1 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-60">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm mô hình AI'}</button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ title }) { return <h4 className="border-t border-slate-100 pt-4 text-sm font-black text-slate-800 first:border-t-0 first:pt-0">{title}</h4>; }

function ModelPicker({ form, updateForm, errors = {}, validateField = () => true }) {
  const options = modelOptions(form.provider);
  if (!options.length) return <Field label="ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', normalizeModelVersion(v))} onBlur={() => validateField('modelVersion')} error={errors.modelVersion} required placeholder="VD: mo-hinh-tuy-chinh" maxLength={MAX_MODEL_VERSION_LENGTH} />;
  const useCustom = !isKnownModel(form.provider, form.modelVersion);
  return <div className="space-y-1.5"><SelectField label="Mô hình" value={useCustom ? '__custom__' : form.modelVersion} onChange={(v) => updateForm('modelVersion', v === '__custom__' ? '' : v)} options={[...options, { value: '__custom__', label: 'Tùy chỉnh ID mô hình' }]} />{useCustom && <Field label="Nhập ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', normalizeModelVersion(v))} onBlur={() => validateField('modelVersion')} error={errors.modelVersion} required placeholder="VD: llama3.1 hoặc gpt-5.2" maxLength={MAX_MODEL_VERSION_LENGTH} />}</div>;
}

function Field({ label, value, onChange, onBlur, error, required = false, placeholder = '', maxLength }) {
  return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span><input required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none transition-colors ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} /><FieldError message={error} /></label>;
}
function SelectField({ label, value, onChange, onBlur, options, empty, required, error }) {
  return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span><select required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none transition-colors ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`}>{empty && <option value="">{empty}</option>}{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><FieldError message={error} /></label>;
}
function TextAreaField({ label, value, onChange, onBlur, error, required = false, optional = false, rows = 2, maxLength, className = '' }) {
  return <label className={`block space-y-1.5 ${className}`}><span className="text-[13px] font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}{optional && <span className="font-semibold text-slate-400"> (tùy chọn)</span>}</span><textarea required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} rows={rows} maxLength={maxLength} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none transition-colors ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} /><FieldError message={error} /></label>;
}
function FieldError({ message }) { return <p className={`min-h-[2rem] text-xs font-bold leading-4 transition-colors ${message ? 'text-rose-600' : 'text-transparent'}`}>{message || 'Không có lỗi'}</p>; }
function ModelCard({ model, onViewDetails, onEdit, onDelete, busy }) {
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
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => onViewDetails(model.id)} className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100">Chi tiết</button>
        <button type="button" disabled={busy} onClick={() => onEdit(model)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 disabled:opacity-50">Sửa</button>
        <button type="button" disabled={busy} onClick={() => onDelete(model)} className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100 disabled:opacity-50">Xóa</button>
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
