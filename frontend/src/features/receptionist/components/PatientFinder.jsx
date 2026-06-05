import React, { useState } from 'react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { patientService } from '../apis/patientService';
import { useToast } from '../../../providers/ToastProvider';

const emptyPatient = { fullName: '', gender: 'MALE', birthDate: '', citizenId: '', phone: '', address: '', insuranceNumber: '', emergencyContact: '' };
const GENDERS = [{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }, { value: 'OTHER', label: 'Khác' }];
const genderLabel = (value) => GENDERS.find((item) => item.value === value)?.label || value || 'Chưa rõ';
function Input({ id, label, value, onChange, required, type = 'text', placeholder }) { return <label htmlFor={id} className="block space-y-1"><span className="text-[12px] font-bold text-slate-600">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</span><input id={id} type={type} value={value || ''} required={required} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" /></label>; }
function Select({ id, label, value, onChange, options }) { return <label htmlFor={id} className="block space-y-1"><span className="text-[12px] font-bold text-slate-600">{label}</span><select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>; }

export default function PatientFinder({ onPatientSelected }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPatient);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const searchPatient = async (event) => {
    event.preventDefault(); setResults(null);
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await patientService.search({ search: query.trim(), limit: 10 });
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setResults(items);
    } catch (err) { toast.error(err.response?.data?.message || 'Tìm kiếm thất bại'); }
    finally { setSearching(false); }
  };

  const createPatient = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const res = await patientService.create({ ...form, birthDate: form.birthDate });
      setShowForm(false); setResults([res.data]);
      onPatientSelected(res.data);
      toast.success('Tạo hồ sơ bệnh nhân thành công!');
    } catch (err) { toast.error(err.response?.data?.message || 'Không tạo được hồ sơ bệnh nhân'); }
    finally { setSaving(false); }
  };

  const f = (field) => ({
    value: form[field],
    onChange: (v) => setForm({ ...form, [field]: v }),
  });

  return (
    <div className="space-y-4">
      <form onSubmit={searchPatient} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="CCCD, SĐT, tên bệnh nhân..."
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none"
        />
        <button disabled={searching || !query.trim()} className="px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-black hover:bg-cyan-700 disabled:opacity-60">
          {searching ? <LoadingIndicator size="sm" tone="white" /> : 'Tìm kiếm'}
        </button>
      </form>
      {results !== null && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
              Không tìm thấy hồ sơ.{' '}
              <button className="font-black underline hover:text-amber-900" onClick={() => setShowForm(true)}>Tạo bệnh nhân mới</button>
            </div>
          ) : (
            results.map((p) => (
              <button key={p.id} onClick={() => onPatientSelected(p)} className="w-full text-left rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-cyan-300 hover:shadow-cyan-50 transition-all group">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-900 group-hover:text-cyan-700">{p.fullName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{p.patientCode} · {genderLabel(p.gender)} · {p.birthDate ? new Date(p.birthDate).toLocaleDateString('vi-VN') : ''}</p>
                    <p className="text-xs text-slate-500">{p.citizenId ? `CCCD: ${p.citizenId}` : ''}{p.citizenId && p.phone ? ' · ' : ''}{p.phone ? `SĐT: ${p.phone}` : ''}</p>
                  </div>
                  <span className="text-xs font-bold text-cyan-600 border border-cyan-100 rounded-xl px-2.5 py-1 bg-cyan-50 group-hover:bg-cyan-100">Chọn</span>
                </div>
              </button>
            ))
          )}
          {results.length > 0 && <button type="button" onClick={() => setShowForm(true)} className="text-xs font-bold text-cyan-600 hover:text-cyan-700 underline">+ Tạo hồ sơ mới</button>}
        </div>
      )}
      {showForm && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5 space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">Tạo hồ sơ mới</p>
          <form onSubmit={createPatient} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input id="pf-fullname" label="Họ và tên" required {...f('fullName')} />
            <Select id="pf-gender" label="Giới tính" options={GENDERS} {...f('gender')} />
            <Input id="pf-birthdate" label="Ngày sinh" required type="date" {...f('birthDate')} />
            <Input id="pf-citizenid" label="CCCD" {...f('citizenId')} placeholder="012345678901" />
            <Input id="pf-phone" label="SĐT" {...f('phone')} placeholder="0909..." />
            <Input id="pf-insurance" label="Số BHYT" {...f('insuranceNumber')} />
            <div className="md:col-span-2"><Input id="pf-address" label="Địa chỉ" {...f('address')} /></div>
            <div className="md:col-span-2"><Input id="pf-emergency" label="Liên hệ khẩn cấp" {...f('emergencyContact')} /></div>
            <div className="md:col-span-2 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Hủy</button>
              <button disabled={saving} className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-black hover:bg-cyan-700 disabled:opacity-60">
                {saving ? <LoadingIndicator size="sm" tone="white" /> : 'Tạo hồ sơ bệnh nhân'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
