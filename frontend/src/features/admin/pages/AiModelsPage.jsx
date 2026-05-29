import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { aiModelService } from '../apis/aiModelService';

const PROVIDERS = [
  { value: 'chatgpt', label: 'ChatGPT / OpenAI' },
  { value: 'gemini', label: 'Gemini / Google' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'qwen', label: 'Qwen' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'other', label: 'Khác' },
];

const emptyForm = {
  modelName: '',
  modelVersion: '',
  recommendedSpecialty: '',
  type: 'API',
  provider: 'chatgpt',
  apiEndpoint: '',
  secretOrIpHash: '',
  description: '',
};

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export default function AiModelsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await aiModelService.list(filter ? { type: filter } : {});
      setModels(getItems(res.data));
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được AI Model Registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  const stats = useMemo(() => [
    { label: 'Tổng model', value: models.length, icon: '🤖' },
    { label: 'API Provider', value: models.filter((m) => m.type === 'API').length, icon: '🔌' },
    { label: 'Model IP', value: models.filter((m) => m.type === 'IP').length, icon: '🔐' },
    { label: 'On-chain', value: models.filter((m) => m.isActiveOnChain).length, icon: '⛓️' },
  ], [models]);

  const updateForm = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'type' && value === 'IP' ? { provider: 'other', apiEndpoint: '' } : {}),
      ...(key === 'type' && value === 'API' ? { provider: 'chatgpt' } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        provider: form.type === 'API' ? form.provider : undefined,
        apiEndpoint: form.type === 'API' ? form.apiEndpoint : undefined,
      };
      const res = await aiModelService.create(payload);
      setSuccess(`Đã thêm model ${res.data.modelName}. Secret/IP đã được mã hóa AES-256.`);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không thêm được AI model');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="aiModels" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="relative overflow-hidden rounded-[32px] bg-slate-950 p-8 text-white shadow-2xl shadow-blue-100">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.55),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.3),transparent_36%)]" />
          <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] font-black text-blue-200">AI Model Registry</p>
              <h1 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">Quản lý Model AI</h1>
              <p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-300 leading-relaxed">
                Admin thêm model từ API provider như ChatGPT, Gemini, DeepSeek, Qwen hoặc thêm model nội bộ bằng IP/hash. API key/IP được mã hóa AES-256 trước khi lưu.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[280px]">
              {stats.map((item) => <Stat key={item.label} {...item} />)}
            </div>
          </div>
        </section>

        {success && <Alert tone="success" message={success} />}
        {error && <Alert tone="error" message={error} />}

        <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form onSubmit={submit} className="xl:col-span-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-blue-500">Create AI Model</p>
              <h2 className="text-xl font-black text-slate-950">Thêm model AI</h2>
              <p className="mt-1 text-sm text-slate-500">Chọn một trong hai cách: API provider hoặc Model IP.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1 border border-slate-100">
              <TypeButton active={form.type === 'API'} onClick={() => updateForm('type', 'API')} label="Thêm bằng API" />
              <TypeButton active={form.type === 'IP'} onClick={() => updateForm('type', 'IP')} label="Thêm bằng IP" />
            </div>

            <Field label="Tên model" value={form.modelName} onChange={(v) => updateForm('modelName', v)} required placeholder="VD: Gemini Medical Triage" />
            <Field label="Phiên bản" value={form.modelVersion} onChange={(v) => updateForm('modelVersion', v)} required placeholder="VD: 1.5-pro / 2026.05" />
            <Field label="Chuyên khoa khuyến nghị" value={form.recommendedSpecialty} onChange={(v) => updateForm('recommendedSpecialty', v)} placeholder="VD: Nội tổng quát" />

            {form.type === 'API' && (
              <>
                <label className="block"><span className="text-xs font-black text-slate-600">Nền tảng API</span><select value={form.provider} onChange={(event) => updateForm('provider', event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
                <Field label="API Endpoint" value={form.apiEndpoint} onChange={(v) => updateForm('apiEndpoint', v)} placeholder="https://api..." />
              </>
            )}

            <label className="block">
              <span className="text-xs font-black text-slate-600">{form.type === 'API' ? 'API Key / Token' : 'IP hoặc hash model nội bộ'}</span>
              <textarea required value={form.secretOrIpHash} onChange={(event) => updateForm('secretOrIpHash', event.target.value)} rows={3} placeholder={form.type === 'API' ? 'sk-... / token provider' : 'IPFS hash, model hash hoặc IP định danh'} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" />
              <p className="mt-1 text-[11px] font-semibold text-emerald-600">Giá trị này sẽ được mã hóa AES-256 bằng ENCRYPTION_KEY.</p>
            </label>

            <label className="block"><span className="text-xs font-black text-slate-600">Mô tả</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} rows={3} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>

            <button disabled={saving} className="w-full rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Đang mã hóa & lưu...' : 'Thêm AI Model'}
            </button>
          </form>

          <section className="xl:col-span-7 rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div><h2 className="text-xl font-black text-slate-950">Registry hiện tại</h2><p className="text-sm text-slate-500">Danh sách model đã đăng ký trong hệ thống.</p></div>
              <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold outline-none"><option value="">Tất cả</option><option value="API">API</option><option value="IP">IP</option></select>
            </div>
            <div className="p-5 space-y-3 max-h-[760px] overflow-y-auto">
              {loading && <LoadingIndicator size="lg" label="Đang tải AI models..." />}
              {!loading && models.map((model) => <ModelCard key={model.id} model={model} />)}
              {!loading && !models.length && <Empty title="Chưa có AI model" desc="Hãy thêm model đầu tiên bằng API provider hoặc IP/hash." />}
            </div>
          </section>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, icon }) { return <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><div className="flex justify-between"><p className="text-[10px] uppercase tracking-wider text-slate-300 font-black">{label}</p><span>{icon}</span></div><strong className="mt-2 block text-2xl font-black text-white">{String(value).padStart(2, '0')}</strong></div>; }
function TypeButton({ active, label, onClick }) { return <button type="button" onClick={onClick} className={`rounded-xl px-3 py-2 text-xs font-black transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-500 hover:bg-white'}`}>{label}</button>; }
function Field({ label, value, onChange, required = false, placeholder = '' }) { return <label className="block"><span className="text-xs font-black text-slate-600">{label}</span><input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>; }
function ModelCard({ model }) { const typeCls = model.type === 'API' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-purple-50 text-purple-700 border-purple-100'; return <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-950">{model.modelName}</h3><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${typeCls}`}>{model.type}</span></div><p className="mt-1 text-xs font-semibold text-slate-500">Version {model.modelVersion} · {model.provider || 'N/A'} · {model.recommendedSpecialty || 'Chưa gán chuyên khoa'}</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-emerald-700">AES-256</span></div><p className="mt-3 text-sm text-slate-600">{model.description || 'Chưa có mô tả'}</p><div className="mt-3 rounded-xl bg-white border border-slate-100 p-3"><p className="text-[10px] uppercase tracking-wider font-black text-slate-400">Fingerprint SHA-256</p><p className="mt-1 break-all text-xs font-mono text-slate-600">{model.ipHashPlain || 'Không hiển thị'}</p></div></article>; }
function Alert({ tone, message }) { const cls = tone === 'error' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-800'; return <div className={`rounded-2xl border p-4 text-sm font-bold ${cls}`}>{message}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-slate-800">{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
