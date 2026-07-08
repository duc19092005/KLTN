import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ExternalLink, MapPin } from 'lucide-react';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { patientService } from '../apis/patientService';
import { useToast } from '../../../providers/ToastProvider';

const emptyPatient = { fullName: '', gender: 'MALE', birthDate: '', citizenId: '', phone: '', address: '', insuranceNumber: '', emergencyContact: '' };
const GENDERS = [{ value: 'MALE', label: 'Nam' }, { value: 'FEMALE', label: 'Nữ' }];
const OSM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_BIRTH_YEAR = 1900;
const VN_PHONE_REGEX = /^(0)(3[2-9]|5[2689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/;
const VN_CITIZEN_ID_REGEX = /^\d{12}$/;
const VN_HEALTH_INSURANCE_REGEX = /^\d{10}$/;
const VIETNAMESE_NAME_REGEX = /^[A-Za-zÀ-ỹ\s]+$/;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 255;
const genderLabel = (value) => GENDERS.find((item) => item.value === value)?.label || value || 'Chưa rõ';
const onlyDigits = (value) => (value || '').replace(/\D/g, '');
const onlyVietnameseNameChars = (value) => (value || '').replace(/[^A-Za-zÀ-ỹ\s]/g, '').replace(/\s{2,}/g, ' ').slice(0, MAX_FULL_NAME_LENGTH);
const limitAddress = (value) => (value || '').slice(0, MAX_ADDRESS_LENGTH);
const formatDateInput = (value) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};
const sanitizeDateTyping = (value) => (value || '').replace(/[^\d/]/g, '').slice(0, 10);
const isoToDisplayDate = (value) => {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};
const displayDateToIso = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
};
const isValidBirthDate = (value) => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!match) return false;
  const [, dayText, monthText, yearText] = match;
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);
  if (year < MIN_BIRTH_YEAR) return false;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
};
const buildGoogleMapsDirectionsUrl = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
const buildAddressQueries = (query) => {
  const normalized = query.replace(/[\/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...new Set([query, `${query}, Việt Nam`, normalized, `${normalized}, Việt Nam`, `${normalized}, Hồ Chí Minh, Việt Nam`])].filter((item) => item.length >= 3);
};
const getTypedHouseNumber = (query) => /^(\d+[\w/-]*)\s+(?=(đường|duong|street|đ|d)\b)/i.exec((query || '').trim())?.[1] || '';
const withTypedHouseNumber = (query, displayName) => {
  const houseNumber = getTypedHouseNumber(query);
  if (!houseNumber || displayName.toLowerCase().startsWith(houseNumber.toLowerCase())) return displayName;
  return `${houseNumber} ${displayName}`;
};

export default function PatientFinder({ onPatientSelected }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyPatient);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSearched, setAddressSearched] = useState(false);
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setResults(null);
      setSearching(false);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await patientService.search({ search: keyword, limit: 10 });
        const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
        setResults(items);
      } catch (err) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const addressQuery = form.address?.trim();
    if (!addressTouched || !addressQuery || addressQuery.length < 3) {
      setAddressSuggestions([]);
      setAddressSearched(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setAddressLoading(true);
      try {
        const mergedResults = [];
        const seenPlaceIds = new Set();
        for (const itemQuery of buildAddressQueries(addressQuery)) {
          const params = new URLSearchParams({ q: itemQuery, format: 'jsonv2', addressdetails: '1', limit: '5', countrycodes: 'vn' });
          const response = await fetch(`${OSM_SEARCH_URL}?${params.toString()}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Không tải được gợi ý địa chỉ');
          for (const item of await response.json()) {
            if (!seenPlaceIds.has(item.place_id)) {
              seenPlaceIds.add(item.place_id);
              mergedResults.push({ ...item, displayName: withTypedHouseNumber(addressQuery, item.display_name) });
            }
          }
          if (mergedResults.length >= 5) break;
        }
        setAddressSuggestions(mergedResults.slice(0, 5));
        setAddressSearched(true);
        setAddressDropdownOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setAddressSuggestions([]);
          setAddressSearched(true);
        }
      } finally {
        if (!controller.signal.aborted) setAddressLoading(false);
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.address, addressTouched]);

  const getFieldError = (field, overrideValue) => {
    const value = overrideValue ?? form[field] ?? '';
    if (field === 'fullName') {
      if (!value.trim()) return 'Vui lòng nhập họ tên.';
      if (!VIETNAMESE_NAME_REGEX.test(value.trim())) return 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.';
      if (value.trim().length > MAX_FULL_NAME_LENGTH) return `Họ tên không được vượt quá ${MAX_FULL_NAME_LENGTH} ký tự.`;
    }
    if (field === 'gender' && !GENDERS.some((item) => item.value === value)) return 'Vui lòng chọn giới tính Nam hoặc Nữ.';
    if (field === 'birthDate' && !isValidBirthDate(value)) return `Ngày sinh phải là dd/mm/yyyy, từ năm ${MIN_BIRTH_YEAR} và không lớn hơn hôm nay.`;
    if (field === 'citizenId' && value && !VN_CITIZEN_ID_REGEX.test(value)) return 'CCCD phải gồm đúng 12 chữ số.';
    if (field === 'phone' && value && !VN_PHONE_REGEX.test(value)) return 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.';
    if (field === 'insuranceNumber' && value && !VN_HEALTH_INSURANCE_REGEX.test(value)) return 'Số BHYT phải gồm đúng 10 chữ số.';
    if (field === 'address') {
      if (!value.trim()) return 'Vui lòng nhập địa chỉ.';
      if (value.length > MAX_ADDRESS_LENGTH) return `Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.`;
    }
    if (field === 'emergencyContact' && value && !VN_PHONE_REGEX.test(value)) return 'Liên hệ khẩn cấp phải là SĐT Việt Nam 10 số và đúng đầu số.';
    return '';
  };

  const validateField = (field, overrideValue) => {
    const error = getFieldError(field, overrideValue);
    setFieldErrors((current) => ({ ...current, [field]: error }));
    return !error;
  };

  const validateFormBeforeSubmit = () => {
    const fields = ['fullName', 'gender', 'birthDate', 'citizenId', 'phone', 'insuranceNumber', 'address', 'emergencyContact'];
    const nextErrors = fields.reduce((errors, field) => {
      const error = getFieldError(field);
      if (error) errors[field] = error;
      return errors;
    }, {});
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

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
    event.preventDefault();
    if (!validateFormBeforeSubmit()) return;
    setSaving(true);
    try {
      const res = await patientService.create({ ...form, birthDate: displayDateToIso(form.birthDate) });
      setShowForm(false); setForm(emptyPatient); setFieldErrors({}); setResults([res.data]);
      onPatientSelected(res.data);
      toast.success('Tạo hồ sơ bệnh nhân thành công!');
    } catch (err) { toast.error(err.response?.data?.message || 'Không tạo được hồ sơ bệnh nhân'); }
    finally { setSaving(false); }
  };

  const f = (field) => ({ value: form[field], onChange: (v) => setForm({ ...form, [field]: v }) });
  const selectAddress = (suggestion) => {
    setForm({ ...form, address: suggestion.displayName || suggestion.display_name });
    setAddressSuggestions([]); setAddressSearched(false); setAddressDropdownOpen(false);
    setFieldErrors((current) => ({ ...current, address: '' }));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={searchPatient} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Tra cứu bệnh nhân</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Tìm hồ sơ tiếp nhận</h2>
          </div>
          {searching && <span className="text-xs font-bold text-slate-400">Đang gợi ý...</span>}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_150px] lg:items-end">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nhập CCCD, SĐT hoặc tên bệnh nhân..."
            className="h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100"
          />
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="inline-flex h-[42px] w-full items-center justify-center rounded-xl bg-cyan-600 px-5 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-60 whitespace-nowrap"
          >
            {searching ? <LoadingIndicator size="sm" tone="white" /> : 'Tìm kiếm'}
          </button>
        </div>
      </form>
      {results !== null && <PatientResults results={results} onPatientSelected={onPatientSelected} onShowForm={() => setShowForm(true)} />}
      {showForm && (
        <div className="rounded-2xl border border-cyan-100 bg-cyan-50/40 p-5 space-y-4">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700">Tạo hồ sơ mới</p>
          <form onSubmit={createPatient} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input id="pf-fullname" label="Họ và tên" required {...f('fullName')} onChange={(v) => setForm({ ...form, fullName: onlyVietnameseNameChars(v) })} onBlur={() => validateField('fullName')} error={fieldErrors.fullName} maxLength={MAX_FULL_NAME_LENGTH} />
            <Select id="pf-gender" label="Giới tính" options={GENDERS} required {...f('gender')} onBlur={() => validateField('gender')} error={fieldErrors.gender} />
            <DateInput id="pf-birthdate" label="Ngày sinh" required value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} onBlur={(v) => validateField('birthDate', v)} error={fieldErrors.birthDate} />
            <Input id="pf-citizenid" label="CCCD" {...f('citizenId')} onChange={(v) => setForm({ ...form, citizenId: onlyDigits(v).slice(0, 12) })} onBlur={() => validateField('citizenId')} error={fieldErrors.citizenId} placeholder="012345678901" inputMode="numeric" maxLength={12} />
            <Input id="pf-phone" label="SĐT" {...f('phone')} onChange={(v) => setForm({ ...form, phone: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('phone')} error={fieldErrors.phone} placeholder="0909..." inputMode="numeric" maxLength={10} />
            <Input id="pf-insurance" label="Số BHYT" {...f('insuranceNumber')} onChange={(v) => setForm({ ...form, insuranceNumber: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('insuranceNumber')} error={fieldErrors.insuranceNumber} placeholder="10 chữ số" inputMode="numeric" maxLength={10} />
            <div className="md:col-span-2"><AddressInput id="pf-address" label="Địa chỉ" value={form.address} onChange={(v) => { setAddressTouched(true); setForm({ ...form, address: limitAddress(v) }); }} onBlur={() => { validateField('address'); window.setTimeout(() => setAddressDropdownOpen(false), 120); }} onFocus={() => { if (addressLoading || addressSearched || addressSuggestions.length > 0) setAddressDropdownOpen(true); }} error={fieldErrors.address} suggestions={addressSuggestions} loading={addressLoading} searched={addressSearched} open={addressDropdownOpen} onSelect={selectAddress} /></div>
            <div className="md:col-span-2"><Input id="pf-emergency" label="Liên hệ khẩn cấp" {...f('emergencyContact')} onChange={(v) => setForm({ ...form, emergencyContact: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('emergencyContact')} error={fieldErrors.emergencyContact} placeholder="SĐT người thân 10 số" inputMode="numeric" maxLength={10} /></div>
            <div className="md:col-span-2 flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100">Hủy</button>
              <button disabled={saving} className="flex-1 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-black hover:bg-cyan-700 disabled:opacity-60">{saving ? <LoadingIndicator size="sm" tone="white" /> : 'Tạo hồ sơ bệnh nhân'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function PatientResults({ results, onPatientSelected, onShowForm }) {
  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 shadow-sm">
        <p className="text-sm font-bold text-amber-800">Không tìm thấy hồ sơ phù hợp.</p>
        <button type="button" className="mt-2 text-xs font-black text-amber-700 underline hover:text-amber-900" onClick={onShowForm}>+ Tạo bệnh nhân mới</button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Gợi ý hồ sơ</p>
          <h3 className="mt-1 text-base font-black text-slate-950">Tìm thấy {results.length} bệnh nhân</h3>
        </div>
        <button type="button" onClick={onShowForm} className="rounded-xl border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100">+ Tạo mới</button>
      </div>
      <div className="space-y-2">
        {results.map((p) => (
          <article key={p.id} className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition-colors hover:border-cyan-200 hover:bg-cyan-50/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-xs font-black text-cyan-700">
                  {p.fullName?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-black text-slate-950">{p.fullName}</h4>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">{p.patientCode} · {genderLabel(p.gender)} · {p.birthDate ? new Date(p.birthDate).toLocaleDateString('vi-VN') : 'Chưa có ngày sinh'}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">{p.citizenId ? `CCCD: ${p.citizenId}` : 'Chưa có CCCD'}{p.phone ? ` · SĐT: ${p.phone}` : ''}</p>
                </div>
              </div>
              <button type="button" onClick={() => onPatientSelected(p)} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700">Chọn</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Input({ id, label, value, onChange, onBlur, error, required, type = 'text', placeholder, inputMode, maxLength }) { return <label htmlFor={id} className="block space-y-1"><span className="text-[12px] font-bold text-slate-600">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</span><input id={id} type={type} value={value || ''} required={required} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} /><p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p></label>; }
function Select({ id, label, value, onChange, onBlur, options, required, error }) { return <label htmlFor={id} className="block space-y-1"><span className="text-[12px] font-bold text-slate-600">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</span><select id={id} required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p></label>; }
function DateInput({ id, label, value, onChange, onBlur, error, required }) {
  const pickerRef = useRef(null);
  const handleBlur = () => { const formattedValue = formatDateInput(value); if (formattedValue !== value) onChange(formattedValue); onBlur?.(formattedValue); };
  const openPicker = () => { if (pickerRef.current) pickerRef.current.value = isValidBirthDate(value) ? displayDateToIso(value) : ''; if (pickerRef.current?.showPicker) pickerRef.current.showPicker(); else pickerRef.current?.click(); };
  return <label htmlFor={id} className="block space-y-1"><span className="text-[12px] font-bold text-slate-600">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</span><div className="relative"><input id={id} type="text" required={required} value={value || ''} onChange={(e) => onChange(sanitizeDateTyping(e.target.value))} onBlur={handleBlur} placeholder="dd/mm/yyyy" inputMode="numeric" maxLength={10} className={`w-full px-3 py-2 pr-10 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} /><button type="button" onClick={openPicker} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600" title="Chọn ngày sinh"><Calendar className="h-4 w-4" /></button><input ref={pickerRef} type="date" defaultValue="" min={`${MIN_BIRTH_YEAR}-01-01`} max={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange(isoToDisplayDate(e.target.value))} className="pointer-events-none absolute right-0 top-full h-0 w-0 opacity-0" tabIndex={-1} /></div><p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p></label>;
}
function AddressInput({ id, label, value, onChange, onBlur, onFocus, error, suggestions, loading, searched, open, onSelect }) { return <label htmlFor={id} className="relative block space-y-1"><span className="text-[12px] font-bold text-slate-600">{label}<span className="text-rose-500 ml-0.5">*</span></span><div className="relative"><input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} onFocus={onFocus} placeholder="Nhập địa chỉ để gợi ý..." title={value || ''} required maxLength={MAX_ADDRESS_LENGTH} className={`w-full px-3 py-2 pr-10 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} /><MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /></div>{open && (loading || searched || suggestions.length > 0) && <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">{loading && <p className="px-3.5 py-3 text-sm font-semibold text-slate-500">Đang tìm địa chỉ...</p>}{!loading && searched && suggestions.length === 0 && <p className="px-3.5 py-3 text-sm font-semibold text-slate-500">Chưa tìm thấy trên OpenStreetMap. Thử nhập thêm phường/quận/thành phố.</p>}{!loading && suggestions.map((item) => <div key={item.place_id} className="flex items-start gap-2 border-b border-slate-100 p-2.5 last:border-b-0 hover:bg-cyan-50/60"><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left"><span className="block text-sm font-bold leading-5 text-slate-800 line-clamp-2" title={item.displayName || item.display_name}>{item.displayName || item.display_name}</span><span className="mt-1 block text-xs font-semibold text-slate-400">{item.lat}, {item.lon}</span></button><a href={buildGoogleMapsDirectionsUrl(item.lat, item.lon)} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-100 bg-white p-2 text-cyan-600 hover:bg-cyan-600 hover:text-white" title="Mở chỉ đường Google Maps" onClick={(e) => e.stopPropagation()}><ExternalLink className="h-4 w-4" /></a></div>)}</div>}<p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p></label>; }
