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
import { Trash2, Cpu, Plus, Filter, Search, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

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
function needsManualEndpoint(provider) { return !isCloudProvider(provider); }
function requiresKey(provider) { return isCloudProvider(provider); }
function providerLabel(provider) { return providerInfo(provider).label; }

export default function AiModelsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [models, setModels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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

  const load = async (page = pagination.page, currentFilter = filter, currentSearch = search, currentStatus = statusFilter) => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        aiModelService.list({
          page,
          limit: pagination.limit,
          provider: currentFilter || undefined,
          search: currentSearch || undefined,
          status: currentStatus || undefined,
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
    load(1, val, search, statusFilter);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    load(1, filter, search, statusFilter);
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

  const toggleModelStatus = async (model) => {
    if (!model?.id) return;
    setSaving(true);
    try {
      if (model.status === 'INACTIVE') {
        await aiModelService.restore(model.id);
        toast.success(`Đã hiện mô hình ${model.modelName}.`);
      } else {
        await aiModelService.hide(model.id);
        toast.success(`Đã ẩn mô hình ${model.modelName}.`);
      }
      await load(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không đổi được trạng thái mô hình AI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="aiModels" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-6 pb-10">
        <Hero onCreate={openCreateModal} onTrash={() => navigate('/admin/ai-models/trash')} total={pagination.total} />

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((item) => (
            <div key={item.label} className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{item.label}</p>
              <strong className="mt-1 block text-3xl font-extrabold text-slate-900">{String(item.value).padStart(2, '0')}</strong>
            </div>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Danh mục mô hình AI</h2>
                <p className="text-xs font-medium text-slate-400">Lọc theo nền tảng, trạng thái hiển thị và từ khóa mô hình.</p>
              </div>
              {(filter || statusFilter || search) && (
                <button type="button" onClick={() => { setFilter(''); setStatusFilter(''); setSearch(''); load(1, '', '', ''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">Xóa lọc</button>
              )}
            </div>
            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr_1.4fr_140px] lg:items-end">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Nền tảng</span>
                <select value={filter} onChange={(event) => handleFilterChange(event.target.value)} className="h-[42px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-semibold outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100">
                  <option value="">Tất cả nền tảng</option>
                  <option value="cloud">API đám mây</option>
                  <option value="local">Tự lưu trữ</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Ẩn / hiện</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); load(1, filter, search, event.target.value); }} className="h-[42px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-semibold outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100">
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hiện</option>
                  <option value="INACTIVE">Đã ẩn</option>
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Tìm kiếm</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên mô hình, nền tảng..." className="h-[42px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-semibold outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" />
              </label>
              <div className="space-y-1.5"><span className="block text-xs font-bold text-transparent">Tìm kiếm</span><button type="submit" className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-sky-700 whitespace-nowrap"><Search className="h-4 w-4" strokeWidth={2.5} /> Tìm kiếm</button></div>
            </form>
          </div>
          <div className="p-6 space-y-4 max-h-[760px] overflow-y-auto">
            {loading && <LoadingIndicator size="lg" label="Đang tải mô hình AI..." />}
            {!loading && visibleModels.map((model) => <ModelCard key={model.id} model={model} onViewDetails={setDetailModelId} onEdit={openEditModal} onToggleStatus={toggleModelStatus} onDelete={requestDelete} busy={saving} />)}
            {!loading && !visibleModels.length && <Empty title="Chưa có mô hình AI" desc="Bấm + Thêm mô hình AI để mở cửa sổ đăng ký mô hình." />}
          </div>
          <Pagination pagination={pagination} onPageChange={load} />
        </section>

        {statsData && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bảng điều khiển Chất lượng & Xác thực Đánh giá AI</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  Mô hình được đánh giá cao nhất
                </h3>
                <div className="space-y-2">
                  {statsData.topModels?.map((m) => (
                    <div key={m.id} className="flex justify-between items-center rounded-xl bg-slate-50 border border-slate-100 p-3 shadow-xs">
                      <div>
                        <strong className="block text-xs text-slate-900">{m.modelName}</strong>
                        <span className="text-[10px] font-bold text-slate-400">Phiên bản {m.modelVersion} · {providerLabel(m.provider) || m.provider}</span>
                      </div>
                      <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{m.averageAccuracy}% tin cậy</span>
                    </div>
                  ))}
                  {!statsData.topModels?.length && <div className="text-xs text-slate-400 italic text-center py-4">Chưa có đánh giá nào.</div>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  Mô hình được đánh giá thấp nhất
                </h3>
                <div className="space-y-2">
                  {statsData.bottomModels?.map((m) => (
                    <div key={m.id} className="flex justify-between items-center rounded-xl bg-slate-50 border border-slate-100 p-3 shadow-xs">
                      <div>
                        <strong className="block text-xs text-slate-900">{m.modelName}</strong>
                        <span className="text-[10px] font-bold text-slate-400">Phiên bản {m.modelVersion} · {providerLabel(m.provider) || m.provider}</span>
                      </div>
                      <span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">{m.averageAccuracy}% tin cậy</span>
                    </div>
                  ))}
                  {!statsData.bottomModels?.length && <div className="text-xs text-slate-400 italic text-center py-4">Chưa có đánh giá nào.</div>}
                </div>
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

function Hero({ onCreate, onTrash, total }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 border border-sky-200/60">
              Quản lý AI & Chẩn đoán ({total} mô hình)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý Mô hình AI
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Đăng ký điểm cuối API, bảo mật AES-256 token và đối chiếu độ tin cậy trên Blockchain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            title="Mô hình AI đã xóa"
            onClick={onTrash}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-xs"
          >
            <Trash2 size={18} strokeWidth={2} />
          </button>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 transition-all"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Thêm mô hình AI
          </button>
        </div>
      </div>
    </div>
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
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-[1280px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">{editing ? 'Cập nhật mô hình AI' : 'Thêm mô hình AI'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Đóng</button>
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
          <TextAreaField
            label={editing ? 'Khóa API / Token (để trống nếu giữ secret hiện tại)' : 'Khóa API / Token'}
            value={form.secretOrIpHash}
            onChange={(v) => changeField('secretOrIpHash', limitText(v, MAX_SECRET_LENGTH))}
            onBlur={() => validateField('secretOrIpHash')}
            error={fieldErrors.secretOrIpHash}
            required={keyRequiredForSubmit}
            optional={!keyRequiredForSubmit}
            rows={2}
            maxLength={MAX_SECRET_LENGTH}
            className="md:col-span-2"
            inputType="password"
          />
          <TextAreaField label="Mô tả" value={form.description} onChange={(v) => changeField('description', limitText(v, MAX_DESCRIPTION_LENGTH))} onBlur={() => validateField('description')} error={fieldErrors.description} rows={2} maxLength={MAX_DESCRIPTION_LENGTH} className="md:col-span-2" />
        </div>

        <SectionTitle title="Kiểm tra kết nối" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button type="button" disabled={testing || !canTest} onClick={testApi} className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-all disabled:opacity-50">
            {testing ? 'Đang kiểm tra kết nối...' : 'Kiểm tra kết nối mô hình'}
          </button>
          {testResult && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">Thành công · {testResult.provider} · {testResult.latencyMs}ms · {testResult.endpoint}</div>}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
          <button disabled={saving} className="flex-1 rounded-2xl bg-sky-600 px-5 py-3 text-xs font-bold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-60">{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm mô hình AI'}</button>
        </div>
      </form>
    </div>
  );
}

function SectionTitle({ title }) { return <h4 className="border-t border-slate-100 pt-4 text-xs font-extrabold uppercase tracking-wider text-slate-700 first:border-t-0 first:pt-0">{title}</h4>; }

function ModelPicker({ form, updateForm, errors = {}, validateField = () => true }) {
  const options = modelOptions(form.provider);
  if (!options.length) return <Field label="ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', normalizeModelVersion(v))} onBlur={() => validateField('modelVersion')} error={errors.modelVersion} required placeholder="VD: mo-hinh-tuy-chinh" maxLength={MAX_MODEL_VERSION_LENGTH} />;
  const useCustom = !isKnownModel(form.provider, form.modelVersion);
  return <div className="space-y-1.5"><SelectField label="Mô hình" value={useCustom ? '__custom__' : form.modelVersion} onChange={(v) => updateForm('modelVersion', v === '__custom__' ? '' : v)} options={[...options, { value: '__custom__', label: 'Tùy chỉnh ID mô hình' }]} />{useCustom && <Field label="Nhập ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', normalizeModelVersion(v))} onBlur={() => validateField('modelVersion')} error={errors.modelVersion} required placeholder="VD: llama3.1 hoặc gpt-5.2" maxLength={MAX_MODEL_VERSION_LENGTH} />}</div>;
}

function Field({ label, value, onChange, onBlur, error, required = false, placeholder = '', maxLength }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span><input required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} /><FieldError message={error} /></label>;
}
function SelectField({ label, value, onChange, onBlur, options, empty, required, error }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span><select required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}>{empty && <option value="">{empty}</option>}{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select><FieldError message={error} /></label>;
}
function TextAreaField({ label, value, onChange, onBlur, error, required = false, optional = false, rows = 2, maxLength, className = '', inputType }) {
  const fieldClass = `w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`;
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-bold text-slate-700">
        {label}
        {required && <span className="text-rose-500"> *</span>}
        {optional && <span className="font-semibold text-slate-400"> (tùy chọn)</span>}
      </span>
      {inputType === 'password' ? (
        <input
          type="password"
          autoComplete="new-password"
          required={required}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          className={fieldClass}
        />
      ) : (
        <textarea
          required={required}
          value={value || ''}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          rows={rows}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          className={fieldClass}
        />
      )}
      <FieldError message={error} />
    </label>
  );
}
function FieldError({ message }) { return <p className={`min-h-[14px] text-[11px] font-bold leading-3 transition-colors ${message ? 'text-rose-600' : 'text-transparent'}`}>{message || 'Lỗi'}</p>; }

function ModelCard({ model, onViewDetails, onEdit, onToggleStatus, onDelete, busy }) {
  const isLocal = model.provider === 'local';
  const badgeCls = 'bg-sky-50 text-sky-700 border-sky-200/80';
  const badge = isLocal ? 'TỰ LƯU TRỮ' : (providerLabel(model.provider) || model.provider || 'API').toUpperCase();
  const hasAccuracy = model.averageAccuracy !== null && model.averageAccuracy !== undefined;
  const isInactive = model.status === 'INACTIVE';
  const statusClass = isInactive ? 'bg-amber-50 text-amber-700 border-amber-200/80' : 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  const statusLabel = isInactive ? 'Đang ẩn' : 'Đang hoạt động';

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">{model.modelName}</h3>
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${badgeCls}`}>{badge}</span>
            {hasAccuracy && (
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${model.averageAccuracy >= 80 ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                Độ tin cậy: {model.averageAccuracy}% ({model.totalRatings} đánh giá)
              </span>
            )}
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-400">Phiên bản {model.modelVersion} · {model.recommendedSpecialty || 'Chưa gán chuyên khoa'}</p>
        </div>
        <div className="flex gap-2 items-center">
          <BlockchainStatusBadge status={model.blockchainStatus} />
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-sky-700 border border-slate-200/80 shadow-xs">AES-256</span>
        </div>
      </div>
      <p className="text-xs font-medium text-slate-600">{model.description || 'Chưa có mô tả'}</p>
      {model.apiEndpoint && (
        <div className="rounded-xl bg-white border border-slate-200/80 p-3">
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Điểm cuối API</p>
          <p className="mt-1 break-all text-xs font-mono text-slate-600">{model.apiEndpoint}</p>
        </div>
      )}
      <div className="rounded-xl bg-white border border-slate-200/80 p-3">
        <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Cấu hình secret</p>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          {model.secretConfigured ? 'Đã cấu hình secret (không hiển thị plaintext)' : 'Chưa cấu hình secret'}
        </p>
        {(model.secretFingerprint || model.ipHashPlain) && (
          <>
            <p className="mt-2 text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Dấu vân tay SHA-256</p>
            <p className="mt-1 break-all text-xs font-mono text-slate-600">{model.secretFingerprint || model.ipHashPlain}</p>
          </>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <SmallButton onClick={() => onViewDetails(model.id)}>Chi tiết</SmallButton>
        <SmallButton onClick={() => onEdit(model)} disabled={busy}>Sửa</SmallButton>
        <SmallButton onClick={() => onToggleStatus(model)} disabled={busy}>{isInactive ? 'Hiện' : 'Ẩn'}</SmallButton>
        <SmallButton danger onClick={() => onDelete(model)} disabled={busy}>Xóa</SmallButton>
      </div>
    </article>
  );
}

function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-sm font-bold text-slate-800">{title}</strong><p className="mt-1 text-xs text-slate-400">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${danger ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'}`}>{children}</button>; }
function Pagination({ pagination, onPageChange }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
      <p className="text-xs font-bold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p>
      <div className="flex gap-2">
        <SmallButton disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trang trước</SmallButton>
        <SmallButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Trang sau</SmallButton>
      </div>
    </div>
  );
}
