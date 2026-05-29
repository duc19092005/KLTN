import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { aiModelService } from '../apis/aiModelService';

const PROVIDERS = [
  { value: 'chatgpt', label: 'ChatGPT / OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', hint: 'OpenAI-compatible chat completion' },
  { value: 'gemini', label: 'Gemini / Google', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent', hint: 'Google Gemini generateContent' },
  { value: 'deepseek', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/chat/completions', hint: 'DeepSeek OpenAI-compatible' },
  { value: 'qwen', label: 'Qwen', endpoint: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions', hint: 'Alibaba DashScope compatible mode' },
  { value: 'anthropic', label: 'Anthropic Claude', endpoint: 'https://api.anthropic.com/v1/messages', hint: 'Claude Messages API' },
  { value: 'other', label: 'Khác / Custom', endpoint: '', hint: 'Cho phép nhập API endpoint riêng' },
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
    { value: 'gemini-flash-latest', label: 'Gemini Flash latest' },
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
};

const emptyForm = {
  modelName: '',
  modelVersion: 'gpt-5.2',
  recommendedSpecialty: '',
  type: 'API',
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
function resolvedEndpoint(form) {
  if (form.type !== 'API') return '';
  const custom = form.apiEndpoint.trim();
  if (custom) return custom;
  return providerInfo(form.provider).endpoint.replace('{model}', form.modelVersion || defaultModelForProvider(form.provider) || 'gemini-2.5-flash');
}

export default function AiModelsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await aiModelService.list(filter ? { type: filter } : {});
      setModels(getItems(res.data));
    } catch (err) { setError(err.response?.data?.message || 'Không tải được AI Model Registry'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [filter]);

  const stats = useMemo(() => [
    { label: 'Tổng model', value: models.length },
    { label: 'API provider', value: models.filter((m) => m.type === 'API').length },
    { label: 'Model IP', value: models.filter((m) => m.type === 'IP').length },
    { label: 'On-chain', value: models.filter((m) => m.isActiveOnChain).length },
  ], [models]);

  const visibleModels = useMemo(() => {
    const text = search.trim().toLowerCase();
    if (!text) return models;
    return models.filter((m) => [m.modelName, m.modelVersion, m.provider, m.recommendedSpecialty].filter(Boolean).some((v) => v.toLowerCase().includes(text)));
  }, [models, search]);

  const openCreateModal = () => {
    setForm(emptyForm);
    setTestResult(null);
    setError('');
    setSuccess('');
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
      ...(key === 'type' && value === 'IP' ? { provider: 'other', apiEndpoint: '', modelVersion: '' } : {}),
      ...(key === 'type' && value === 'API' ? { provider: 'chatgpt', modelVersion: defaultModelForProvider('chatgpt'), apiEndpoint: '' } : {}),
      ...(key === 'provider' ? { modelVersion: defaultModelForProvider(value), apiEndpoint: '' } : {}),
    }));
  };

  const testApi = async () => {
    if (form.type !== 'API') return;
    setTesting(true); setError(''); setSuccess(''); setTestResult(null);
    try {
      const res = await aiModelService.testApi({
        provider: form.provider,
        modelVersion: form.modelVersion,
        secretOrIpHash: form.secretOrIpHash,
        apiEndpoint: form.apiEndpoint || undefined,
      });
      setTestResult(res.data);
      setSuccess(`Test API thành công (${res.data.latencyMs}ms).`);
    } catch (err) { setError(err.response?.data?.message || 'Test API thất bại'); }
    finally { setTesting(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...form, provider: form.type === 'API' ? form.provider : undefined, apiEndpoint: form.type === 'API' ? (form.apiEndpoint || undefined) : undefined };
      const res = await aiModelService.create(payload);
      setSuccess(`Đã thêm model ${res.data.modelName}. Secret/IP đã được mã hóa AES-256.`);
      setForm(emptyForm); setTestResult(null); setShowCreateModal(false);
      await load();
    } catch (err) { setError(err.response?.data?.message || 'Không thêm được AI model'); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="aiModels" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-emerald-50 p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] font-black text-cyan-600">AI Model Registry</p>
              <h1 className="mt-2 text-3xl font-black text-slate-950 tracking-tight">Quản lý Model AI</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-600">Thêm API provider hoặc model nội bộ. Endpoint tự chọn theo nền tảng, provider khác thì cho phép nhập endpoint.</p>
              <span className="mt-4 inline-flex rounded-full bg-cyan-100 px-3 py-1 text-[11px] font-black text-cyan-700">{models.length} model</span>
            </div>
            <button type="button" onClick={openCreateModal} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-cyan-100 hover:bg-cyan-700 transition-all">+ Thêm model AI</button>
          </div>
        </section>

        {success && <Alert tone="success" message={success} />}
        {error && !showCreateModal && <Alert tone="error" message={error} />}

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((item) => <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-[10px] uppercase tracking-wider text-slate-400 font-black">{item.label}</p><strong className="mt-1 block text-2xl font-black text-slate-950">{String(item.value).padStart(2, '0')}</strong></div>)}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-950">Registry hiện tại</h2><p className="text-sm text-slate-500">Danh sách model đã đăng ký trong hệ thống.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold outline-none"><option value="">Tất cả</option><option value="API">API</option><option value="IP">IP</option></select></div><div className="mt-4 flex gap-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên model, provider..." className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></div></div>
          <div className="p-5 space-y-3 max-h-[760px] overflow-y-auto">{loading && <LoadingIndicator size="lg" label="Đang tải AI models..." />}{!loading && visibleModels.map((model) => <ModelCard key={model.id} model={model} />)}{!loading && !visibleModels.length && <Empty title="Chưa có AI model" desc="Bấm + Thêm model AI để mở modal đăng ký model." />}</div>
        </section>
      </div>
      {showCreateModal && <CreateModelModal form={form} updateForm={updateForm} onSubmit={submit} onClose={closeCreateModal} saving={saving} testing={testing} testApi={testApi} testResult={testResult} error={error} />}
    </DashboardLayout>
  );
}

function CreateModelModal({ form, updateForm, onSubmit, onClose, saving, testing, testApi, testResult, error }) {
  const endpoint = resolvedEndpoint(form);
  const selectedProvider = providerInfo(form.provider);
  const canTest = form.type === 'API' && form.provider && form.modelVersion && form.secretOrIpHash && (form.provider !== 'other' || form.apiEndpoint);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-white/60 bg-white shadow-2xl"><div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 p-6 backdrop-blur"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] uppercase tracking-[0.24em] font-black text-cyan-500">Create AI Model</p><h2 className="mt-1 text-2xl font-black text-slate-950">Thêm model AI</h2><p className="mt-1 text-sm text-slate-500">API endpoint tự động theo nền tảng; chọn Khác để nhập endpoint riêng.</p></div><button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-600">Đóng</button></div></div><form onSubmit={onSubmit} className="space-y-4 p-6">{error && <Alert tone="error" message={error} />}<div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1 border border-slate-100"><TypeButton active={form.type === 'API'} onClick={() => updateForm('type', 'API')} label="Thêm bằng API" /><TypeButton active={form.type === 'IP'} onClick={() => updateForm('type', 'IP')} label="Thêm bằng IP" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Tên model hiển thị" value={form.modelName} onChange={(v) => updateForm('modelName', v)} required placeholder="VD: Gemini hỗ trợ nội tổng quát" /><ModelPicker form={form} updateForm={updateForm} /></div><Field label="Chuyên khoa khuyến nghị" value={form.recommendedSpecialty} onChange={(v) => updateForm('recommendedSpecialty', v)} placeholder="VD: Nội tổng quát" />{form.type === 'API' && <><label className="block"><span className="text-xs font-black text-slate-600">Nền tảng API</span><select value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">{PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select><p className="mt-1 text-[11px] font-semibold text-slate-400">{selectedProvider.hint}</p></label><div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-black text-slate-600">API Endpoint</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-cyan-700">{form.provider === 'other' ? 'CUSTOM' : 'AUTO'}</span></div><p className="mt-2 break-all rounded-xl bg-white px-3 py-3 text-sm font-bold text-slate-700 border border-cyan-100">{endpoint || 'Nhập endpoint tùy chỉnh bên dưới'}</p></div>{form.provider === 'other' && <Field label="Nhập API Endpoint" value={form.apiEndpoint} onChange={(v) => updateForm('apiEndpoint', v)} required placeholder="https://api.your-provider.com/v1/chat/completions" />}{form.provider !== 'other' && <Field label="Override endpoint nếu cần" value={form.apiEndpoint} onChange={(v) => updateForm('apiEndpoint', v)} placeholder="Để trống để dùng endpoint tự động" />}</>}<label className="block"><span className="text-xs font-black text-slate-600">{form.type === 'API' ? 'API Key / Token' : 'IP hoặc hash model nội bộ'}</span><textarea required value={form.secretOrIpHash} onChange={(event) => updateForm('secretOrIpHash', event.target.value)} rows={3} placeholder={form.type === 'API' ? 'sk-... / token provider' : 'IPFS hash, model hash hoặc IP định danh'} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /><p className="mt-1 text-[11px] font-semibold text-emerald-600">Giá trị này sẽ được mã hóa AES-256 bằng ENCRYPTION_KEY.</p></label><label className="block"><span className="text-xs font-black text-slate-600">Mô tả</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>{form.type === 'API' && <button type="button" disabled={testing || !canTest} onClick={testApi} className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-3 text-sm font-black text-cyan-700 disabled:opacity-50">{testing ? 'Đang test API...' : 'Test API có hoạt động không'}</button>}{testResult && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">OK · {testResult.provider} · {testResult.latencyMs}ms · {testResult.endpoint}</div>}<div className="flex flex-col sm:flex-row gap-3 pt-2"><button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-600">Hủy</button><button disabled={saving} className="flex-1 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-100 transition-all hover:bg-slate-800 disabled:opacity-60">{saving ? 'Đang mã hóa & lưu...' : 'Thêm AI Model'}</button></div></form></div></div>;
}

function ModelPicker({ form, updateForm }) {
  if (form.type !== 'API') {
    return <Field label="Phiên bản/model nội bộ" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', v)} required placeholder="VD: internal-med-v1" />;
  }

  const options = modelOptions(form.provider);
  const useCustom = form.provider === 'other' || !isKnownModel(form.provider, form.modelVersion);

  return <div className="space-y-2"><label className="block"><span className="text-xs font-black text-slate-600">Model API</span><select value={useCustom ? '__custom__' : form.modelVersion} onChange={(event) => updateForm('modelVersion', event.target.value === '__custom__' ? '' : event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100">{options.map((model) => <option key={model.value} value={model.value}>{model.label}</option>)}<option value="__custom__">Tùy chỉnh model id</option></select></label>{useCustom && <Field label="Nhập model id" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', v)} required placeholder="VD: gemini-2.5-flash hoặc gpt-5.2" />}</div>;
}

function TypeButton({ active, label, onClick }) { return <button type="button" onClick={onClick} className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-white'}`}>{label}</button>; }
function Field({ label, value, onChange, required = false, placeholder = '' }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100" /></label>; }
function ModelCard({ model }) { const typeCls = model.type === 'API' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'; return <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{model.modelName}</h3><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${typeCls}`}>{model.type}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">Version {model.modelVersion} · {model.provider || 'N/A'} · {model.recommendedSpecialty || 'Chưa gán chuyên khoa'}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-emerald-700">AES-256</span></div><p className="mt-3 text-sm text-slate-600">{model.description || 'Chưa có mô tả'}</p>{model.apiEndpoint && <div className="mt-3 rounded-xl bg-white border border-slate-100 p-3"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Endpoint</p><p className="mt-1 break-all text-xs font-mono text-slate-600">{model.apiEndpoint}</p></div>}<div className="mt-3 rounded-xl bg-white border border-slate-100 p-3"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Fingerprint SHA-256</p><p className="mt-1 break-all text-xs font-mono text-slate-600">{model.ipHashPlain || 'Không hiển thị'}</p></div></article>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
