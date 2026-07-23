import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ExternalLink, MapPin, Search, UserPlus, CheckCircle, AlertCircle, Phone, CreditCard, ShieldAlert } from 'lucide-react';
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
    const hasContactMethod = [form.phone, form.citizenId, form.insuranceNumber, form.emergencyContact]
      .some((value) => typeof value === 'string' && value.trim().length > 0);
    if (!hasContactMethod) {
      const contactMessage = 'Hồ sơ bệnh nhân phải có ít nhất một thông tin liên hệ hoặc định danh hợp lệ (SĐT, CCCD, BHYT hoặc liên hệ khẩn cấp).';
      nextErrors.phone = nextErrors.phone || contactMessage;
      nextErrors.citizenId = nextErrors.citizenId || contactMessage;
      nextErrors.insuranceNumber = nextErrors.insuranceNumber || contactMessage;
      nextErrors.emergencyContact = nextErrors.emergencyContact || contactMessage;
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const searchPatient = async (event) => {
    event.preventDefault();
    setResults(null);
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await patientService.search({ search: query.trim(), limit: 10 });
      const items = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setResults(items);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Tìm kiếm thất bại');
    } finally {
      setSearching(false);
    }
  };

  const createPatient = async (event) => {
    event.preventDefault();
    if (!validateFormBeforeSubmit()) return;
    setSaving(true);
    try {
      const res = await patientService.create({ ...form, birthDate: displayDateToIso(form.birthDate) });
      setShowForm(false);
      setForm(emptyPatient);
      setFieldErrors({});
      setResults([res.data]);
      onPatientSelected(res.data);
      toast.success('Tạo hồ sơ bệnh nhân thành công!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tạo được hồ sơ bệnh nhân');
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => ({ value: form[field], onChange: (v) => setForm({ ...form, [field]: v }) });
  const selectAddress = (suggestion) => {
    setForm({ ...form, address: suggestion.displayName || suggestion.display_name });
    setAddressSuggestions([]);
    setAddressSearched(false);
    setAddressDropdownOpen(false);
    setFieldErrors((current) => ({ ...current, address: '' }));
  };

  return (
    <div className="space-y-6 antialiased">
      {/* SEARCH FORM */}
      <form onSubmit={searchPatient} className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Tra cứu thông tin</p>
            <h2 className="text-base font-bold text-slate-900">Tìm kiếm bệnh nhân tiếp nhận</h2>
          </div>
          {searching && (
            <span className="text-xs font-semibold text-sky-600 flex items-center gap-1.5">
              <LoadingIndicator size="sm" /> Đang tra cứu...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nhập CCCD, Số điện thoại hoặc Họ tên bệnh nhân..."
              className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !query.trim()}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 text-xs font-bold text-white shadow-sm transition-all hover:bg-sky-700 disabled:opacity-60 whitespace-nowrap"
          >
            {searching ? <LoadingIndicator size="sm" tone="white" /> : 'Tra cứu ngay'}
          </button>
        </div>
      </form>

      {/* RESULTS LIST */}
      {results !== null && (
        <PatientResults
          results={results}
          onPatientSelected={onPatientSelected}
          onShowForm={() => setShowForm(true)}
        />
      )}

      {/* NEW PATIENT FORM MODAL / PANEL */}
      {showForm && (
        <div className="rounded-3xl border border-sky-200 bg-sky-50/40 p-6 space-y-5 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b border-sky-100 pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-sky-600" />
              <h3 className="text-base font-bold text-slate-900">Thêm hồ sơ bệnh nhân mới</h3>
            </div>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-100/80 px-2.5 py-0.5 rounded-full">
              Hệ thống KLTN
            </span>
          </div>

          <form onSubmit={createPatient} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input id="pf-fullname" label="Họ và tên" required {...f('fullName')} onChange={(v) => setForm({ ...form, fullName: onlyVietnameseNameChars(v) })} onBlur={() => validateField('fullName')} error={fieldErrors.fullName} maxLength={MAX_FULL_NAME_LENGTH} placeholder="Nguyễn Văn A" />
            <Select id="pf-gender" label="Giới tính" options={GENDERS} required {...f('gender')} onBlur={() => validateField('gender')} error={fieldErrors.gender} />
            <DateInput id="pf-birthdate" label="Ngày sinh" required value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} onBlur={(v) => validateField('birthDate', v)} error={fieldErrors.birthDate} />
            <Input id="pf-citizenid" label="Số CCCD (12 số)" {...f('citizenId')} onChange={(v) => setForm({ ...form, citizenId: onlyDigits(v).slice(0, 12) })} onBlur={() => validateField('citizenId')} error={fieldErrors.citizenId} placeholder="012345678901" inputMode="numeric" maxLength={12} />
            <Input id="pf-phone" label="Số điện thoại" {...f('phone')} onChange={(v) => setForm({ ...form, phone: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('phone')} error={fieldErrors.phone} placeholder="0909123456" inputMode="numeric" maxLength={10} />
            <Input id="pf-insurance" label="Mã thẻ BHYT (10 số)" {...f('insuranceNumber')} onChange={(v) => setForm({ ...form, insuranceNumber: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('insuranceNumber')} error={fieldErrors.insuranceNumber} placeholder="10 chữ số BHYT" inputMode="numeric" maxLength={10} />
            
            <div className="md:col-span-2">
              <AddressInput id="pf-address" label="Địa chỉ cư trú" value={form.address} onChange={(v) => { setAddressTouched(true); setForm({ ...form, address: limitAddress(v) }); }} onBlur={() => { validateField('address'); window.setTimeout(() => setAddressDropdownOpen(false), 120); }} onFocus={() => { if (addressLoading || addressSearched || addressSuggestions.length > 0) setAddressDropdownOpen(true); }} error={fieldErrors.address} suggestions={addressSuggestions} loading={addressLoading} searched={addressSearched} open={addressDropdownOpen} onSelect={selectAddress} />
            </div>

            <div className="md:col-span-2">
              <Input id="pf-emergency" label="SĐT người thân khẩn cấp" {...f('emergencyContact')} onChange={(v) => setForm({ ...form, emergencyContact: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('emergencyContact')} error={fieldErrors.emergencyContact} placeholder="SĐT người thân 10 số" inputMode="numeric" maxLength={10} />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                disabled={saving}
                className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 shadow-sm transition-all disabled:opacity-60 flex items-center gap-2"
              >
                {saving ? <LoadingIndicator size="sm" tone="white" /> : 'Lưu hồ sơ bệnh nhân'}
              </button>
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
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-xs font-bold text-amber-900">Không tìm thấy hồ sơ bệnh nhân phù hợp.</p>
            <p className="text-[11px] font-medium text-amber-700 mt-0.5">Vui lòng kiểm tra lại từ khóa hoặc tạo hồ sơ bệnh nhân mới.</p>
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs shrink-0 transition-colors"
          onClick={onShowForm}
        >
          + Tạo bệnh nhân mới
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-600">Kết quả tra cứu</p>
          <h3 className="text-sm font-bold text-slate-900">Tìm thấy {results.length} hồ sơ bệnh nhân</h3>
        </div>
        <button
          type="button"
          onClick={onShowForm}
          className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors"
        >
          + Tạo mới
        </button>
      </div>

      <div className="space-y-3">
        {results.map((p) => (
          <article
            key={p.id}
            className="group rounded-2xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:border-sky-200 hover:bg-sky-50/40 hover:shadow-xs"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="w-12 h-12 shrink-0 rounded-2xl bg-sky-100 text-sky-700 font-bold text-sm flex items-center justify-center border border-sky-200">
                  {p.fullName?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                    {p.fullName}
                  </h4>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">
                    Mã BN: <span className="text-sky-600 font-bold">{p.patientCode}</span> • Giới tính: {genderLabel(p.gender)} • Ngày sinh: {p.birthDate ? new Date(p.birthDate).toLocaleDateString('vi-VN') : 'N/A'}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-400">
                    {p.citizenId ? `CCCD: ${p.citizenId}` : 'Chưa có CCCD'}{p.phone ? ` • SĐT: ${p.phone}` : ''}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onPatientSelected(p)}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-all shrink-0"
              >
                Chọn bệnh nhân
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Input({ id, label, value, onChange, onBlur, error, required, type = 'text', placeholder, inputMode, maxLength }) {
  return (
    <label htmlFor={id} className="block space-y-1">
      <span className="text-xs font-bold text-slate-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <input
        id={id}
        type={type}
        value={value || ''}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-semibold focus:ring-2 outline-none transition-all ${
          error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      />
      <p className={`min-h-[16px] text-[11px] font-medium leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>
        {error || 'Không có lỗi'}
      </p>
    </label>
  );
}

function Select({ id, label, value, onChange, onBlur, options, required, error }) {
  return (
    <label htmlFor={id} className="block space-y-1">
      <span className="text-xs font-bold text-slate-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <select
        id={id}
        required={required}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-semibold focus:ring-2 outline-none transition-all ${
          error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <p className={`min-h-[16px] text-[11px] font-medium leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>
        {error || 'Không có lỗi'}
      </p>
    </label>
  );
}

function DateInput({ id, label, value, onChange, onBlur, error, required }) {
  const pickerRef = useRef(null);
  const handleBlur = () => {
    const formattedValue = formatDateInput(value);
    if (formattedValue !== value) onChange(formattedValue);
    onBlur?.(formattedValue);
  };
  const openPicker = () => {
    if (pickerRef.current) pickerRef.current.value = isValidBirthDate(value) ? displayDateToIso(value) : '';
    if (pickerRef.current?.showPicker) pickerRef.current.showPicker();
    else pickerRef.current?.click();
  };

  return (
    <label htmlFor={id} className="block space-y-1">
      <span className="text-xs font-bold text-slate-700">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <div className="relative">
        <input
          id={id}
          type="text"
          required={required}
          value={value || ''}
          onChange={(e) => onChange(sanitizeDateTyping(e.target.value))}
          onBlur={handleBlur}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          maxLength={10}
          className={`w-full px-3.5 py-2.5 pr-10 bg-white border rounded-xl text-xs font-semibold focus:ring-2 outline-none transition-all ${
            error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
          }`}
        />
        <button
          type="button"
          onClick={openPicker}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors"
          title="Chọn ngày sinh"
        >
          <Calendar className="h-4 w-4" />
        </button>
        <input
          ref={pickerRef}
          type="date"
          defaultValue=""
          min={`${MIN_BIRTH_YEAR}-01-01`}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onChange(isoToDisplayDate(e.target.value))}
          className="pointer-events-none absolute right-0 top-full h-0 w-0 opacity-0"
          tabIndex={-1}
        />
      </div>
      <p className={`min-h-[16px] text-[11px] font-medium leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>
        {error || 'Không có lỗi'}
      </p>
    </label>
  );
}

function AddressInput({ id, label, value, onChange, onBlur, onFocus, error, suggestions, loading, searched, open, onSelect }) {
  return (
    <label htmlFor={id} className="relative block space-y-1">
      <span className="text-xs font-bold text-slate-700">
        {label}<span className="text-rose-500 ml-0.5">*</span>
      </span>
      <div className="relative">
        <input
          id={id}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder="Nhập địa chỉ để tìm kiếm gợi ý OpenStreetMap..."
          title={value || ''}
          required
          maxLength={MAX_ADDRESS_LENGTH}
          className={`w-full px-3.5 py-2.5 pr-10 bg-white border rounded-xl text-xs font-semibold focus:ring-2 outline-none transition-all ${
            error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'
          }`}
        />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      {open && (loading || searched || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {loading && <p className="px-4 py-3 text-xs font-semibold text-slate-500">Đang tìm địa chỉ...</p>}
          {!loading && searched && suggestions.length === 0 && (
            <p className="px-4 py-3 text-xs font-semibold text-slate-500">
              Chưa tìm thấy trên OpenStreetMap. Thử nhập thêm phường/quận/thành phố.
            </p>
          )}
          {!loading &&
            suggestions.map((item) => (
              <div
                key={item.place_id}
                className="flex items-start gap-2 border-b border-slate-100 p-3 last:border-b-0 hover:bg-sky-50/60 transition-colors"
              >
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(item)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block text-xs font-bold leading-5 text-slate-800 line-clamp-2" title={item.displayName || item.display_name}>
                    {item.displayName || item.display_name}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                    Tọa độ: {item.lat}, {item.lon}
                  </span>
                </button>
                <a
                  href={buildGoogleMapsDirectionsUrl(item.lat, item.lon)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-sky-200 bg-white p-1.5 text-sky-600 hover:bg-sky-600 hover:text-white transition-colors"
                  title="Mở chỉ đường Google Maps"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            ))}
        </div>
      )}
      <p className={`min-h-[16px] text-[11px] font-medium leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>
        {error || 'Không có lỗi'}
      </p>
    </label>
  );
}
