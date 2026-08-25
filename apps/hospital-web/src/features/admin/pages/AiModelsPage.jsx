import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { aiModelService } from '../apis/aiModelService';
import { useToast } from '../../../providers/ToastProvider';
import AiModelDetailModal from '../components/AiModelDetailModal';
import {
  Trash2,
  Cpu,
  Plus,
  Filter,
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Square,
  Cloud,
  Server,
  Activity,
  Eye,
  EyeOff,
  Pencil,
  Lock,
  Zap,
  Globe,
  Award,
  Layers,
  ChevronRight,
} from 'lucide-react';

const PROVIDERS = [
  { value: 'chatgpt', label: 'ChatGPT / OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', hint: 'API Chat Completions của OpenAI', cloud: true, badgeTone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'gemini', label: 'Gemini / Google', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', hint: 'API generateContent của Google Gemini', cloud: true, badgeTone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'deepseek', label: 'DeepSeek AI', endpoint: 'https://api.deepseek.com/chat/completions', hint: 'DeepSeek tương thích OpenAI', cloud: true, badgeTone: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'qwen', label: 'Qwen / Alibaba', endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', hint: 'Nền tảng Alibaba DashScope', cloud: true, badgeTone: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'anthropic', label: 'Anthropic Claude', endpoint: 'https://api.anthropic.com/v1/messages', hint: 'API Messages của Claude', cloud: true, badgeTone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'local', label: 'Llama / Tự lưu trữ', endpoint: '', hint: 'Máy chủ tương thích OpenAI (Ollama, vLLM, LM Studio) - chỉ cần nhập điểm cuối API', cloud: false, badgeTone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'other', label: 'Khác / Tùy chỉnh', endpoint: '', hint: 'Nhập điểm cuối API tùy chỉnh của bạn', cloud: false, badgeTone: 'bg-slate-100 text-slate-700 border-slate-200' },
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
  const [selectedIds, setSelectedIds] = useState([]);

  const [statsData, setStatsData] = useState(null);

  const load = async (page = pagination.page, currentFilter = filter, currentSearch = search, currentStatus = statusFilter) => {
    setLoading(true);
    setSelectedIds([]);
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
    { label: 'Tổng số mô hình AI', value: pagination.total, icon: Cpu, tone: 'bg-sky-50 text-sky-600 border-sky-100' },
    { label: 'Dịch vụ Đám mây', value: statsData?.totalCloudCount || models.filter((m) => m.provider && m.provider !== 'local' && m.provider !== 'ip').length, icon: Cloud, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Tự lưu trữ (Local)', value: statsData?.totalLocalCount || models.filter((m) => m.provider === 'local').length, icon: Server, tone: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'Đã xác thực', value: models.filter((m) => m.isActiveOnChain).length, icon: ShieldCheck, tone: 'bg-amber-50 text-amber-600 border-amber-100' },
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
      toast.success(`Đã xóa tạm thời mô hình ${model.modelName}.`);
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

  const handleBulkSoftDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn chuyển ${ids.length} mô hình AI đã chọn vào thùng rác?`)) return;
    setSaving(true);
    try {
      const res = await aiModelService.softDeleteMany(ids);
      const data = res.data;
      if (data?.failed > 0) {
        toast.warning(`Thành công: ${data.succeeded}/${data.requested}. Thất bại: ${data.failed}.`);
      } else {
        toast.success(`Đã chuyển ${data.succeeded} mô hình AI vào thùng rác!`);
      }
      setSelectedIds([]);
      await load(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xóa hàng loạt mô hình AI');
    } finally {
      setSaving(false);
    }
  };

  const allSelected = visibleModels.length > 0 && selectedIds.length === visibleModels.length;
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleModels.map((m) => m.id));
    }
  };
  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="aiModels" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-7 pb-12 animate-in fade-in duration-300">
        
        {/* Header Hero */}
        <Hero onCreate={openCreateModal} onTrash={() => navigate('/admin/ai-models/trash')} total={pagination.total} />

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300 bg-white/95 px-6 py-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-600 text-xs font-black text-white shadow-md">
                {selectedIds.length}
              </span>
              <span className="text-sm font-black text-slate-900">
                Đã chọn {selectedIds.length} mô hình AI
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => handleBulkSoftDelete(selectedIds)}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-40 transition"
              >
                <Trash2 size={15} />
                Xóa tạm thời chọn ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{item.label}</p>
                  <strong className="mt-1 block text-3xl font-black text-slate-900 tracking-tight">{String(item.value).padStart(2, '0')}</strong>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border shrink-0 ${item.tone}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            );
          })}
        </section>

        {/* Main List Section */}
        <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          {/* Controls Bar */}
          <div className="p-6 border-b border-slate-100 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-slate-700 hover:text-sky-600 transition"
                  title="Chọn tất cả mô hình AI"
                >
                  {allSelected ? <CheckSquare size={20} className="text-sky-600" /> : <Square size={20} className="text-slate-400" />}
                </button>
                <div>
                  <h2 className="text-lg font-black text-slate-900">Danh mục Mô hình AI Chẩn Đoán</h2>
                  <p className="text-xs font-semibold text-slate-400">Lọc theo nhà cung cấp, trạng thái kích hoạt hoặc tìm kiếm tên mô hình</p>
                </div>
              </div>

              {(filter || statusFilter || search) && (
                <button type="button" onClick={() => { setFilter(''); setStatusFilter(''); setSearch(''); load(1, '', '', ''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
                  Xóa lọc
                </button>
              )}
            </div>

            <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.15fr_1fr_1.4fr_140px] lg:items-end">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Nền tảng</span>
                <select value={filter} onChange={(event) => handleFilterChange(event.target.value)} className="h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100">
                  <option value="">Tất cả nền tảng</option>
                  <option value="cloud">Dịch vụ Đám mây (Cloud)</option>
                  <option value="local">Tự lưu trữ (Local)</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Trạng thái</span>
                <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); load(1, filter, search, event.target.value); }} className="h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100">
                  <option value="">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang hiện</option>
                  <option value="INACTIVE">Đã ẩn</option>
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700">Tìm kiếm</span>
                <div className="relative">
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập tên mô hình, chuyên khoa..." className="h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 pl-10 pr-3.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" />
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                </div>
              </label>

              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-transparent">Thao tác</span>
                <button type="submit" className="inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-sky-700 whitespace-nowrap">
                  <Search className="h-4 w-4" strokeWidth={2.5} />
                  <span>Tìm kiếm</span>
                </button>
              </div>
            </form>
          </div>

          {/* Cards List */}
          <div className="p-6 space-y-4 max-h-[760px] overflow-y-auto">
            {loading && <LoadingIndicator size="lg" label="Đang tải danh mục mô hình AI..." />}
            {!loading && visibleModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onViewDetails={setDetailModelId}
                onEdit={openEditModal}
                onToggleStatus={toggleModelStatus}
                onDelete={requestDelete}
                busy={saving}
                isSelected={selectedIds.includes(model.id)}
                onToggleSelect={() => toggleSelectOne(model.id)}
              />
            ))}
            {!loading && !visibleModels.length && <Empty title="Chưa có mô hình AI nào" desc="Bấm nút + Thêm mô hình AI để mở cửa sổ cấu hình." />}
          </div>

          <Pagination pagination={pagination} onPageChange={load} />
        </section>

        {/* Quality Evaluation Board */}
        {statsData && (
          <section className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Bảng Đánh Giá Độ Tin Cậy & Chất Lượng AI</h2>
                <p className="text-xs font-semibold text-slate-400">Xếp hạng đánh giá thực tế từ đội ngũ bác sĩ chuyên khoa</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Models */}
              <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-sky-50/40 p-6 space-y-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Mô hình được đánh giá cao nhất
                </h3>
                <div className="space-y-3">
                  {statsData.topModels?.map((m) => (
                    <div key={m.id} className="flex justify-between items-center rounded-2xl bg-white border border-emerald-100 p-4 shadow-xs">
                      <div>
                        <strong className="block text-sm font-bold text-slate-900">{m.modelName}</strong>
                        <span className="text-[11px] font-semibold text-slate-400">Phiên bản {m.modelVersion} · {providerLabel(m.provider) || m.provider}</span>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-black text-emerald-700">
                          {m.averageAccuracy}% tin cậy
                        </span>
                        {m.totalRatings > 0 && (
                          <span className="block text-[10px] font-semibold text-slate-400 mt-1">
                            ({m.totalRatings} lượt đánh giá)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!statsData.topModels?.length && <div className="text-xs text-slate-400 italic text-center py-6">Chưa có dữ liệu đánh giá từ bác sĩ.</div>}
                </div>
              </div>

              {/* Bottom Models / Quality Status */}
              {statsData.bottomModels?.length > 0 ? (
                <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50/40 via-white to-amber-50/40 p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600" />
                    Mô hình cần cải thiện độ chính xác
                  </h3>
                  <div className="space-y-3">
                    {statsData.bottomModels.map((m) => (
                      <div key={m.id} className="flex justify-between items-center rounded-2xl bg-white border border-rose-100 p-4 shadow-xs">
                        <div>
                          <strong className="block text-sm font-bold text-slate-900">{m.modelName}</strong>
                          <span className="text-[11px] font-semibold text-slate-400">Phiên bản {m.modelVersion} · {providerLabel(m.provider) || m.provider}</span>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-black text-rose-700">
                            {m.averageAccuracy ?? 0}% tin cậy
                          </span>
                          {m.negativeRatings > 0 && (
                            <span className="block text-[10px] font-bold text-rose-500 mt-1">
                              {m.negativeRatings} phản hồi chưa hài lòng
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : statsData.topModels?.length > 0 ? (
                <div className="rounded-3xl border border-emerald-100/80 bg-gradient-to-br from-emerald-50/30 via-white to-sky-50/20 p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Chất lượng & Độ chính xác AI
                  </h3>
                  <div className="flex flex-col items-center justify-center text-center py-6 px-4 rounded-2xl bg-white border border-emerald-100 text-emerald-800 space-y-2 shadow-2xs">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <strong className="text-xs font-bold text-emerald-900">Tất cả mô hình đều đạt chuẩn chất lượng cao</strong>
                    <p className="text-[11px] font-medium text-slate-500 max-w-xs leading-relaxed">
                      Hiện tại toàn bộ mô hình AI đều đạt độ tin cậy cao (≥ 80%) và không ghi nhận phản hồi tiêu cực từ bác sĩ chuyên khoa.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-slate-100 bg-slate-50/40 p-6 space-y-4 shadow-xs">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-slate-400" />
                    Mô hình cần cải thiện độ chính xác
                  </h3>
                  <div className="text-xs text-slate-400 italic text-center py-6">Chưa có dữ liệu đánh giá từ bác sĩ.</div>
                </div>
              )}
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
    <div className="relative overflow-hidden rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50/90 via-white to-cyan-50/70 p-7 sm:p-9 text-slate-900 shadow-sm">
      {/* Decorative Glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-200/25 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-100/80 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-sky-800 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-sky-600" />
            <span>Bệnh Viện Đa Khoa Quốc Tế KLTN · Quản Lý AI ({total} mô hình)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Quản lý Mô hình AI Chẩn Đoán
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-2xl">
            Cấu hình điểm cuối API, bảo mật AES-256 token và đối chiếu độ tin cậy được lưu trữ minh bạch trên Blockchain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            title="Thùng rác mô hình AI"
            onClick={onTrash}
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-xs"
          >
            <Trash2 size={19} strokeWidth={2} />
          </button>

          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-bold px-6 py-3.5 text-xs uppercase tracking-wider transition-all shadow-md shadow-sky-600/20"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span>Thêm mô hình AI</span>
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

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
      <form onSubmit={handleSubmit} noValidate className="relative z-10 w-full max-w-[1000px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 space-y-6 overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-6 sm:p-7 border-b border-sky-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100/80 px-3 py-0.5 text-xs font-bold text-sky-800">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span>Cấu Hình Mô Hình Trí Tuệ Nhân Tạo</span>
            </span>
            <h3 className="text-xl font-black text-slate-900">{editing ? 'Cập nhật mô hình AI' : 'Thêm mô hình AI mới'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
            Đóng
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <SectionTitle title="Thông tin cơ bản" icon={Layers} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Tên mô hình" value={form.modelName} onChange={(v) => changeField('modelName', limitText(v, MAX_MODEL_NAME_LENGTH))} onBlur={() => validateField('modelName')} error={fieldErrors.modelName} required placeholder="VD: OpenAI Chẩn Đoán" maxLength={MAX_MODEL_NAME_LENGTH} />
            <SelectField label="Nền tảng cung cấp" value={form.provider} onChange={(v) => changeField('provider', v)} onBlur={() => validateField('provider')} error={fieldErrors.provider} options={PROVIDERS.map((p) => ({ value: p.value, label: p.label }))} required />
            <ModelPicker form={form} updateForm={changeField} errors={fieldErrors} validateField={validateField} />
            <SelectField label="Chuyên khoa khuyến nghị" value={form.recommendedSpecialty} onChange={(v) => changeField('recommendedSpecialty', v)} onBlur={() => validateField('recommendedSpecialty')} error={fieldErrors.recommendedSpecialty} empty="Chọn chuyên khoa hệ thống" options={specialtyOptions} />
          </div>

          <SectionTitle title="Điểm cuối API & Khóa bảo mật" icon={Lock} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {manualEndpoint && <div className="md:col-span-2"><Field label="Điểm cuối API" value={form.apiEndpoint} onChange={(v) => changeField('apiEndpoint', limitText(v.trim(), MAX_ENDPOINT_LENGTH))} onBlur={() => validateField('apiEndpoint')} error={fieldErrors.apiEndpoint} required placeholder="http://localhost:11434/v1/chat/completions" maxLength={MAX_ENDPOINT_LENGTH} /></div>}
            <TextAreaField
              label={editing ? 'Khóa API / Token (để trống nếu giữ nguyên)' : 'Khóa API / Token'}
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
            <TextAreaField label="Mô tả công dụng mô hình" value={form.description} onChange={(v) => changeField('description', limitText(v, MAX_DESCRIPTION_LENGTH))} onBlur={() => validateField('description')} error={fieldErrors.description} rows={2} maxLength={MAX_DESCRIPTION_LENGTH} className="md:col-span-2" />
          </div>

          <SectionTitle title="Kiểm tra kết nối trực tiếp" icon={Activity} />
          <div className="space-y-3">
            <button type="button" disabled={testing || !canTest} onClick={testApi} className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              <span>{testing ? 'Đang gửi ping kiểm tra kết nối...' : 'Kiểm tra kết nối mô hình'}</span>
            </button>
            {testResult && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs font-bold text-emerald-800 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-extrabold">Kết nối thành công ({testResult.latencyMs}ms)</p>
                  <p className="text-[11px] font-mono text-emerald-700 mt-0.5">{testResult.provider} · {testResult.endpoint}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">Hủy</button>
            <button disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3.5 text-xs font-bold text-white shadow-md hover:bg-sky-700 disabled:opacity-70 transition">
              {saving && <LoadingIndicator size="sm" tone="white" />}{editing ? 'Lưu thay đổi' : 'Thêm mô hình mới'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}

function SectionTitle({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 border-t border-slate-100 pt-5 first:border-t-0 first:pt-0">
      {Icon && <Icon className="h-4 w-4 text-sky-600" />}
      <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">{title}</h4>
    </div>
  );
}

function ModelPicker({ form, updateForm, errors = {}, validateField = () => true }) {
  const options = modelOptions(form.provider);
  if (!options.length) return <Field label="ID mô hình" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', normalizeModelVersion(v))} onBlur={() => validateField('modelVersion')} error={errors.modelVersion} required placeholder="VD: mo-hinh-tuy-chinh" maxLength={MAX_MODEL_VERSION_LENGTH} />;
  const useCustom = !isKnownModel(form.provider, form.modelVersion);
  return (
    <div className="space-y-1.5">
      <SelectField label="ID Mô hình chọn sẵn" value={useCustom ? '__custom__' : form.modelVersion} onChange={(v) => updateForm('modelVersion', v === '__custom__' ? '' : v)} options={[...options, { value: '__custom__', label: 'Tùy chỉnh ID mô hình...' }]} />
      {useCustom && <Field label="Nhập ID mô hình tùy chỉnh" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', normalizeModelVersion(v))} onBlur={() => validateField('modelVersion')} error={errors.modelVersion} required placeholder="VD: llama3.1 hoặc gpt-5.2" maxLength={MAX_MODEL_VERSION_LENGTH} />}
    </div>
  );
}

function Field({ label, value, onChange, onBlur, error, required = false, placeholder = '', maxLength }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
      <input required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50/70 border rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} />
      <FieldError message={error} />
    </label>
  );
}

function SelectField({ label, value, onChange, onBlur, options, empty, required, error }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
      <select required={required} value={value || ''} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 bg-slate-50/70 border rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}>
        {empty && <option value="">{empty}</option>}
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <FieldError message={error} />
    </label>
  );
}

function TextAreaField({ label, value, onChange, onBlur, error, required = false, optional = false, rows = 2, maxLength, className = '', inputType }) {
  const fieldClass = `w-full resize-none px-3.5 py-2.5 bg-slate-50/70 border rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`;
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

function ModelCard({ model, onViewDetails, onEdit, onToggleStatus, onDelete, busy, isSelected, onToggleSelect }) {
  const isLocal = model.provider === 'local';
  const info = providerInfo(model.provider);
  const badgeCls = info.badgeTone || 'bg-sky-50 text-sky-700 border-sky-200/80';
  const badge = isLocal ? 'TỰ LƯU TRỮ (LOCAL)' : (info.label || model.provider || 'API').toUpperCase();
  const hasAccuracy = model.averageAccuracy !== null && model.averageAccuracy !== undefined;
  const isInactive = model.status === 'INACTIVE';
  const statusClass = isInactive ? 'bg-amber-50 text-amber-700 border-amber-200/80' : 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
  const statusLabel = isInactive ? 'Đang ẩn' : 'Đang hoạt động';

  return (
    <article className={`rounded-3xl border transition-all p-6 space-y-4 ${isSelected ? 'border-sky-300 bg-sky-50/50 shadow-sm' : 'border-slate-200/80 bg-white hover:border-slate-300 shadow-xs'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSelect}
            className="mt-1 text-slate-400 hover:text-sky-600 transition"
          >
            {isSelected ? <CheckSquare size={20} className="text-sky-600" /> : <Square size={20} />}
          </button>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-slate-900 text-base">{model.modelName}</h3>
              <span className={`rounded-full border px-3 py-0.5 text-[10px] font-bold ${badgeCls}`}>{badge}</span>
              {hasAccuracy && (
                <span className={`rounded-full border px-3 py-0.5 text-[10px] font-bold ${model.averageAccuracy >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  Độ tin cậy: {model.averageAccuracy}% ({model.totalRatings} đánh giá)
                </span>
              )}
              <span className={`rounded-full border px-3 py-0.5 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
            </div>
            <p className="text-xs font-semibold text-slate-400">Phiên bản {model.modelVersion} · Chuyên khoa: {model.recommendedSpecialty || 'Toàn khoa'}</p>
          </div>
        </div>

        <div className="flex gap-2 items-center shrink-0">
          <BlockchainStatusBadge status={model.blockchainStatus} />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-700 border border-slate-200 shadow-2xs">AES-256</span>
        </div>
      </div>

      <p className="text-xs font-medium text-slate-600 leading-relaxed">{model.description || 'Chưa có mô tả chi tiết cho mô hình AI này.'}</p>

      {model.apiEndpoint && (
        <div className="rounded-2xl bg-slate-950 text-slate-200 p-3.5 font-mono text-xs break-all border border-slate-800 flex items-center justify-between gap-3 shadow-inner">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Điểm cuối API</span>
            <code className="text-sky-300 mt-0.5 block">{model.apiEndpoint}</code>
          </div>
          <Globe className="h-4 w-4 text-slate-500 shrink-0" />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span>{model.secretConfigured ? 'Khóa bảo mật: Đã thiết lập' : 'Khóa bảo mật: Chưa cấu hình'}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SmallButton onClick={() => onViewDetails(model.id)}>
            <Eye className="h-3.5 w-3.5" />
            <span>Chi tiết</span>
          </SmallButton>
          <SmallButton onClick={() => onEdit(model)} disabled={busy}>
            <Pencil className="h-3.5 w-3.5" />
            <span>Sửa</span>
          </SmallButton>
          <SmallButton onClick={() => onToggleStatus(model)} disabled={busy}>
            {isInactive ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5 text-amber-600" />}
            <span>{isInactive ? 'Hiện' : 'Ẩn'}</span>
          </SmallButton>
          <SmallButton danger onClick={() => onDelete(model)} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
            <span>Xóa</span>
          </SmallButton>
        </div>
      </div>
    </article>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/60 p-10 text-center space-y-2">
      <Cpu className="h-10 w-10 text-slate-400 mx-auto" />
      <strong className="text-sm font-bold text-slate-800 block">{title}</strong>
      <p className="text-xs text-slate-400 max-w-sm mx-auto">{desc}</p>
    </div>
  );
}

function SmallButton({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all disabled:opacity-50 shadow-2xs ${
        danger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200'
      }`}
    >
      {children}
    </button>
  );
}

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
