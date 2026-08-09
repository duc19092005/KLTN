import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import AvatarUpload from '../../../shared/components/AvatarUpload';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorService } from '../apis/doctorService';
import { staffService } from '../apis/staffService';
import { departmentService } from '../apis/departmentService';
import DoctorDetailModal from '../components/DoctorDetailModal';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { Calendar, ExternalLink, MapPin, Search, Trash2, Plus, Stethoscope, Filter, UserCheck } from 'lucide-react';

const OSM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_BIRTH_YEAR = 1900;
const VN_PHONE_REGEX = /^(0)(3[2-9]|5[2689]|7[06-9]|8[1-689]|9[0-46-9])\d{7}$/;
const VN_CITIZEN_ID_REGEX = /^\d{12}$/;
const VIETNAMESE_NAME_REGEX = /^[A-Za-zÀ-ỹ\s]+$/;
const USERNAME_REGEX = /^[a-z0-9]+$/;
const EMAIL_REGEX = /^[a-z0-9]+(?:[._-][a-z0-9]+)*@[a-z0-9]+(?:[-.][a-z0-9]+)*\.[a-z]{2,}$/;
const MAX_FULL_NAME_LENGTH = 80;
const MAX_USERNAME_LENGTH = 30;
const MAX_POSITION_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 255;
const MIN_YEARS_EXPERIENCE = 1;
const MAX_YEARS_EXPERIENCE = 50;
const MAX_LICENSE_NUMBER_LENGTH = 30;
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', INACTIVE: 'bg-rose-50 text-rose-700 border-rose-200/80', PENDING: 'bg-amber-50 text-amber-700 border-amber-200/80' };
const statusLabel = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động', PENDING: 'Chờ kích hoạt' };

function buildGoogleMapsDirectionsUrl(lat, lng) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`; }
function buildAddressQueries(query) {
  const normalized = query.replace(/[\/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  return [...new Set([
    query,
    `${query}, Việt Nam`,
    normalized,
    `${normalized}, Việt Nam`,
    `${normalized}, Hồ Chí Minh, Việt Nam`,
  ])].filter((item) => item.length >= 3);
}
function getTypedHouseNumber(query) {
  const match = /^(\d+[\w/-]*)\s+(?=(đường|duong|street|đ|d)\b)/i.exec((query || '').trim());
  return match?.[1] || '';
}
function withTypedHouseNumber(query, displayName) {
  const houseNumber = getTypedHouseNumber(query);
  if (!houseNumber || displayName.toLowerCase().startsWith(houseNumber.toLowerCase())) return displayName;
  return `${houseNumber} ${displayName}`;
}
function onlyDigits(value) { return (value || '').replace(/\D/g, ''); }
function onlyVietnameseNameChars(value) { return (value || '').replace(/[^A-Za-zÀ-ỹ\s]/g, '').replace(/\s{2,}/g, ' ').slice(0, MAX_FULL_NAME_LENGTH); }
function onlyUsernameChars(value) { return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '').slice(0, MAX_USERNAME_LENGTH); }
function onlyEmailChars(value) { return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9@._-]/g, ''); }
function limitPosition(value) { return (value || '').slice(0, MAX_POSITION_LENGTH); }
function limitAddress(value) { return (value || '').slice(0, MAX_ADDRESS_LENGTH); }
function formatDateInput(value) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
function sanitizeDateTyping(value) {
  return (value || '').replace(/[^\d/]/g, '').slice(0, 10);
}
function isoToDisplayDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}
function displayDateToIso(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value || '');
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}
function isValidBirthDate(value) {
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
}

const SPECIALTIES = [
  { value: 'GENERAL_INTERNAL_MEDICINE', label: 'Nội tổng quát' },
  { value: 'GENERAL_SURGERY', label: 'Ngoại tổng quát' },
  { value: 'PEDIATRICS', label: 'Nhi khoa' },
  { value: 'OBSTETRICS_GYNECOLOGY', label: 'Sản phụ khoa' },
  { value: 'CARDIOLOGY', label: 'Tim mạch' },
  { value: 'ENT', label: 'Tai Mũi Họng' },
  { value: 'DENTOMAXILLOFACIAL', label: 'Răng Hàm Mặt' },
  { value: 'OPHTHALMOLOGY', label: 'Mắt' },
  { value: 'DERMATOLOGY', label: 'Da liễu' },
  { value: 'NEUROLOGY', label: 'Thần kinh' },
  { value: 'ORTHOPEDICS', label: 'Chấn thương chỉnh hình' },
  { value: 'GASTROENTEROLOGY', label: 'Tiêu hóa' },
  { value: 'ENDOCRINOLOGY', label: 'Nội tiết' },
  { value: 'ONCOLOGY', label: 'Ung bướu' },
  { value: 'RESPIRATORY', label: 'Hô hấp' },
];

function getSpecialtyLabel(value) {
  return SPECIALTIES.find((item) => item.value === value)?.label || value || 'N/A';
}

const DOCTOR_POSITIONS = [
  'Bác sĩ',
  'Thạc sĩ Bác sĩ',
  'Bác sĩ Chuyên khoa I',
  'Bác sĩ Chuyên khoa II',
  'Tiến sĩ Bác sĩ',
  'Phó Giáo sư',
  'Giáo sư'
];

const QUALIFICATIONS = [
  'Đại học',
  'Thạc sĩ',
  'Bác sĩ Chuyên khoa I',
  'Bác sĩ Chuyên khoa II',
  'Tiến sĩ'
];

const emptyForm = {
  username: '',
  email: '',
  fullName: '',
  avatarUrl: '',
  departmentId: '',
  phone: '',
  gender: '',
  citizenId: '',
  birthDate: '',
  address: '',
  position: 'Bác sĩ',
  specialty: '',
  licenseNumber: '',
  qualification: '',
  yearsExperience: '',
};

function getItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getError(err) { return err?.response?.data?.message || err.message || 'Thao tác thất bại'; }
function buildDoctorPayload(form) {
  return {
    specialty: form.specialty,
    licenseNumber: form.licenseNumber.trim(),
    qualification: form.qualification,
    yearsExperience: form.yearsExperience === '' ? undefined : Number(form.yearsExperience),
  };
}
function buildFullDoctorPayload(form) {
  return {
    username: form.username,
    email: form.email,
    fullName: form.fullName,
    avatarUrl: form.avatarUrl,
    departmentId: form.departmentId || undefined,
    phone: form.phone,
    gender: form.gender,
    citizenId: form.citizenId,
    birthDate: displayDateToIso(form.birthDate),
    address: form.address || undefined,
    position: form.position || undefined,
    ...buildDoctorPayload(form),
  };
}

export default function DoctorsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ specialty: '', search: '', status: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [editing, setEditing] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailDoctorId, setDetailDoctorId] = useState(null);
  const totalLabel = useMemo(() => `${pagination.total} bác sĩ`, [pagination.total]);

  const load = async (page = pagination.page) => {
    setLoading(true);
    try {
      const doctorParams = {
        page,
        limit: pagination.limit,
        ...(filters.specialty ? { specialty: filters.specialty } : {}),
        ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      };
      const [doctorRes, departmentRes] = await Promise.all([
        doctorService.search(doctorParams),
        departmentService.list({ limit: 100 }),
      ]);
      const data = doctorRes.data || {};
      setDoctors(getItems(data));
      if (!Array.isArray(data)) setPagination({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
      setDepartments(getItems(departmentRes.data));
    } catch (err) { toast.error(getError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setIsCreateOpen(true);
  };
  const openEdit = (doctor) => {
    setIsCreateOpen(false);
    setEditing(doctor);
    const staff = doctor.staffProfile || {};
    const formattedBirthDate = isoToDisplayDate(staff.birthDate);
    setForm({
      username: staff.user?.username || '',
      email: staff.user?.email || '',
      fullName: staff.fullName || '',
      avatarUrl: staff.avatarUrl || '',
      departmentId: staff.departmentId || '',
      phone: staff.phone || '',
      gender: staff.gender || '',
      citizenId: staff.citizenId || '',
      birthDate: formattedBirthDate,
      address: staff.address || '',
      position: staff.position || 'Bác sĩ',
      specialty: doctor.specialty || '',
      licenseNumber: doctor.licenseNumber || '',
      qualification: doctor.qualification || '',
      yearsExperience: doctor.yearsExperience ?? '',
    });
  };
  const close = () => { setEditing(null); setIsCreateOpen(false); setForm(emptyForm); };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.avatarUrl) {
      toast.error('Vui lòng tải lên ảnh đại diện của bác sĩ.');
      return;
    }
    setBusy(true);
    const nextPage = pagination.page;
    try {
      if (editing) {
        const payload = {
          ...buildDoctorPayload(form),
          fullName: form.fullName,
          phone: form.phone,
          citizenId: form.citizenId,
          gender: form.gender,
          address: form.address || undefined,
          avatarUrl: form.avatarUrl,
          departmentId: form.departmentId || undefined,
          position: form.position || undefined,
          birthDate: displayDateToIso(form.birthDate),
        };
        await doctorService.update(editing.id, payload);
        toast.success('Cập nhật thông tin bác sĩ thành công!');
        close(); await load(nextPage);
      } else {
        await doctorService.createFull(buildFullDoctorPayload(form));
        toast.success('Tạo bác sĩ mới thành công! Thông tin tài khoản đã được gửi đến email của bác sĩ.');
        close(); await load(1);
      }
    } catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };

  const toggleDoctorStatus = async (doctor) => {
    const staffId = doctor?.staffProfile?.id;
    if (!staffId) {
      toast.error('Không tìm thấy hồ sơ nhân sự của bác sĩ.');
      return;
    }
    setBusy(true);
    try {
      if (doctor.staffProfile?.user?.status === 'INACTIVE') {
        await staffService.unlock(staffId);
        toast.success('Hiện bác sĩ thành công!');
      } else {
        await staffService.lock(staffId);
        toast.success('Ẩn bác sĩ thành công!');
      }
      await load(pagination.page);
    } catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };

  const removeDoctor = async (doctor) => {
    const staffId = doctor?.staffProfile?.id;
    if (!staffId) {
      toast.error('Không tìm thấy hồ sơ nhân sự của bác sĩ.');
      return;
    }
    setBusy(true);
    try {
      await staffService.remove(staffId);
      toast.success('Xóa bác sĩ thành công!');
      await load(pagination.page);
    } catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };

  const search = async (event) => { event.preventDefault(); await load(1); };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="doctors" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-[1600px] mx-auto space-y-6 pb-10">
        <Hero totalLabel={totalLabel} onCreate={openCreate} onTrash={() => navigate('/admin/doctors/trash')} total={pagination.total} />
        {loading ? <LoadingIndicator size="lg" label="Đang tải danh sách bác sĩ..." /> : (
          <>
            <SearchBar filters={filters} setFilters={setFilters} onSearch={search} onReset={() => setFilters({ specialty: '', search: '', status: '' })} />
            <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-sky-600" strokeWidth={2} />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Danh sách bác sĩ</h3>
                    <p className="text-xs font-medium text-slate-400">Quản lý hồ sơ chuyên môn và phòng khám phụ trách.</p>
                  </div>
                </div>
                <span className="rounded-xl bg-slate-50 px-3.5 py-1.5 text-xs font-bold text-slate-600 border border-slate-200/80">{totalLabel}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {doctors.map((doctor) => <DoctorRow key={doctor.id} doctor={doctor} onEdit={openEdit} onToggleStatus={toggleDoctorStatus} onRemove={removeDoctor} onViewDetails={setDetailDoctorId} busy={busy} />)}
                {!doctors.length && <div className="p-8 text-center text-xs font-bold text-slate-400">Chưa có bác sĩ nào.</div>}
              </div>
              <Pagination pagination={pagination} onPageChange={load} />
            </section>
          </>
        )}
        {(isCreateOpen || editing) && <DoctorModal mode={editing ? 'edit' : 'create'} form={form} setForm={setForm} departments={departments} onSubmit={submit} onClose={close} busy={busy} />}
        {detailDoctorId && <DoctorDetailModal doctorId={detailDoctorId} onClose={() => setDetailDoctorId(null)} />}
      </div>
    </DashboardLayout>
  );
}

function Hero({ onCreate, onTrash, total }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200/60">
              Đội ngũ Bác sĩ ({total} chuyên gia)
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Quản lý Đội ngũ Bác sĩ
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Quản lý chứng chỉ hành nghề, chuyên khoa khám và lịch phân công bác sĩ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            title="Bác sĩ đã xóa"
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
            Thêm bác sĩ mới
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchBar({ filters, setFilters, onSearch, onReset }) {
  const activeCount = [filters.specialty, filters.search, filters.status].filter(Boolean).length;
  return (
    <form onSubmit={onSearch} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
            <Filter className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-base font-bold text-slate-900">Bộ lọc bác sĩ</p>
            <p className="text-xs font-medium text-slate-400">{activeCount > 0 ? `${activeCount} bộ lọc đang áp dụng` : 'Tìm theo chuyên khoa, từ khóa và trạng thái hiển thị.'}</p>
          </div>
        </div>
        {activeCount > 0 && <button type="button" onClick={onReset} className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">Xóa lọc</button>}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1.4fr_1fr_140px] lg:items-end">
        <FilterSelect label="Chuyên khoa" value={filters.specialty} onChange={(v) => setFilters({ ...filters, specialty: v })} empty="Tất cả chuyên khoa" options={SPECIALTIES} />
        <FilterInput label="Tìm kiếm" value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Tên bác sĩ, chứng chỉ..." />
        <FilterSelect label="Ẩn / hiện" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} empty="Tất cả trạng thái" options={[{ value: 'ACTIVE', label: 'Đang hiện' }, { value: 'INACTIVE', label: 'Đã ẩn' }]} />
        <div className="space-y-1.5"><span className="block text-xs font-bold text-transparent">Tìm kiếm</span><button className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-sky-700 whitespace-nowrap"><Search className="h-4 w-4" strokeWidth={2.5} /> Tìm kiếm</button></div>
      </div>
    </form>
  );
}

function FilterInput({ label, value, onChange, placeholder }) { return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}</span><input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-[42px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-semibold focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 outline-none" /></label>; }
function FilterSelect({ label, value, onChange, options, empty }) { return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="h-[42px] w-full rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 text-xs font-semibold focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 outline-none">{empty && <option value="">{empty}</option>}{options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }

function DoctorRow({ doctor, onEdit, onToggleStatus, onRemove, onViewDetails, busy }) {
  return (
    <article className="p-6 hover:bg-slate-50/80 transition-all">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.9fr_0.9fr_0.85fr_0.9fr_220px] xl:items-center">
        <div className="flex items-center gap-3.5">
          <img src={doctor.staffProfile?.avatarUrl} alt={doctor.staffProfile?.fullName || 'Bác sĩ'} className="w-12 h-12 rounded-2xl object-cover border border-sky-100 bg-sky-50 shadow-xs" />
          <div className="min-w-0">
            <strong className="block text-slate-900 font-bold truncate text-sm">{doctor.staffProfile?.fullName}</strong>
            <span className="text-xs font-medium text-slate-400 truncate block">{doctor.staffProfile?.user?.email}</span>
          </div>
        </div>
        <Info label="Chuyên khoa" value={getSpecialtyLabel(doctor.specialty)} />
        <Info label="Phòng khám" value={doctor.staffProfile?.department?.name || 'Chưa gán'} />
        <span className={`w-fit rounded-lg border px-2.5 py-1 text-xs font-bold ${statusTone[doctor.staffProfile?.user?.status] || statusTone.ACTIVE}`}>{statusLabel[doctor.staffProfile?.user?.status] || 'Không rõ'}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Trạng thái dữ liệu</p>
          <BlockchainStatusBadge status={doctor.blockchainStatus} size="xs" />
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <SmallButton onClick={() => onViewDetails(doctor.id)} disabled={busy}>Chi tiết</SmallButton>
          <SmallButton onClick={() => onEdit(doctor)} disabled={busy}>Sửa</SmallButton>
          <SmallButton onClick={() => onToggleStatus(doctor)} disabled={busy}>{doctor.staffProfile?.user?.status === 'INACTIVE' ? 'Hiện' : 'Ẩn'}</SmallButton>
          <SmallButton danger onClick={() => onRemove(doctor)} disabled={busy}>Xóa</SmallButton>
        </div>
      </div>
    </article>
  );
}

function DoctorModal({ mode, form, setForm, departments, onSubmit, onClose, busy }) {
  const isCreate = mode === 'create';
  const [fieldErrors, setFieldErrors] = useState({});
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSearched, setAddressSearched] = useState(false);
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);

  useEffect(() => {
    const query = form.address?.trim();
    if (!addressTouched || !query || query.length < 3) {
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
        for (const addressQuery of buildAddressQueries(query)) {
          const params = new URLSearchParams({ q: addressQuery, format: 'jsonv2', addressdetails: '1', limit: '5', countrycodes: 'vn' });
          const response = await fetch(`${OSM_SEARCH_URL}?${params.toString()}`, { signal: controller.signal });
          if (!response.ok) throw new Error('Không tải được gợi ý địa chỉ');
          const data = await response.json();
          for (const item of Array.isArray(data) ? data : []) {
            if (!seenPlaceIds.has(item.place_id)) {
              seenPlaceIds.add(item.place_id);
              mergedResults.push({ ...item, displayName: withTypedHouseNumber(query, item.display_name) });
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
    if (field === 'username' && isCreate) {
      if (!value) return 'Vui lòng nhập tên đăng nhập.';
      if (!USERNAME_REGEX.test(value)) return 'Tên đăng nhập chỉ gồm chữ thường không dấu và số.';
      if (value.length > MAX_USERNAME_LENGTH) return `Tên đăng nhập không được vượt quá ${MAX_USERNAME_LENGTH} ký tự.`;
    }
    if (field === 'email' && isCreate) {
      if (!value) return 'Vui lòng nhập email.';
      if (value !== onlyEmailChars(value)) return 'Email không được chứa dấu, khoảng trắng hoặc ký tự đặc biệt lạ.';
      if (!EMAIL_REGEX.test(value)) return 'Email phải đúng định dạng và không chứa dấu/ký tự đặc biệt lạ.';
    }
    if (field === 'phone' && !VN_PHONE_REGEX.test(value)) return 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.';
    if (field === 'citizenId' && !VN_CITIZEN_ID_REGEX.test(value)) return 'CCCD phải gồm đúng 12 chữ số.';
    if (field === 'birthDate' && !isValidBirthDate(value)) return `Ngày sinh phải là dd/mm/yyyy, từ năm ${MIN_BIRTH_YEAR} và không lớn hơn hôm nay.`;
    if (field === 'position') {
      if (!value.trim()) return 'Vui lòng chọn chức danh.';
      if (value.length > MAX_POSITION_LENGTH) return `Chức danh không được vượt quá ${MAX_POSITION_LENGTH} ký tự.`;
    }
    if (field === 'gender' && !value) return 'Vui lòng chọn giới tính.';
    if (field === 'departmentId' && !value) return 'Vui lòng chọn phòng ban khám cho bác sĩ.';
    if (field === 'specialty' && !value) return 'Vui lòng chọn chuyên khoa.';
    if (field === 'qualification' && !value) return 'Vui lòng chọn trình độ.';
    if (field === 'licenseNumber') {
      if (!value.trim()) return 'Vui lòng nhập số chứng chỉ.';
      if (value.trim().length > MAX_LICENSE_NUMBER_LENGTH) return `Số chứng chỉ không được vượt quá ${MAX_LICENSE_NUMBER_LENGTH} ký tự.`;
    }
    if (field === 'address') {
      if (!value.trim()) return 'Vui lòng nhập địa chỉ.';
      if (value.length > MAX_ADDRESS_LENGTH) return `Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.`;
    }
    if (field === 'yearsExperience') {
      if (value === '') return 'Vui lòng nhập số năm kinh nghiệm.';
      const years = Number(value);
      if (!Number.isInteger(years) || years < MIN_YEARS_EXPERIENCE || years > MAX_YEARS_EXPERIENCE) {
        return `Số năm kinh nghiệm phải từ ${MIN_YEARS_EXPERIENCE} đến ${MAX_YEARS_EXPERIENCE}.`;
      }
    }
    return '';
  };

  const validateField = (field, overrideValue) => {
    const error = getFieldError(field, overrideValue);
    setFieldErrors((current) => ({ ...current, [field]: error }));
    return !error;
  };

  const selectAddress = (suggestion) => {
    const nextAddress = suggestion.displayName || suggestion.display_name;
    setForm({ ...form, address: nextAddress });
    setAddressSuggestions([]);
    setAddressSearched(false);
    setAddressDropdownOpen(false);
    validateField('address', nextAddress);
  };

  const handleAddressBlur = () => {
    validateField('address');
    window.setTimeout(() => setAddressDropdownOpen(false), 180);
  };

  const handleAddressFocus = () => {
    if (addressTouched && (addressSuggestions.length > 0 || addressLoading || addressSearched)) {
      setAddressDropdownOpen(true);
    }
  };

  const validateFormBeforeSubmit = () => {
    const fields = ['fullName', ...(isCreate ? ['username', 'email'] : []), 'phone', 'citizenId', 'birthDate', 'gender', 'departmentId', 'position', 'address', 'specialty', 'licenseNumber', 'qualification', 'yearsExperience'];
    const nextErrors = fields.reduce((errors, field) => {
      const error = getFieldError(field);
      if (error) errors[field] = error;
      return errors;
    }, {});
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateFormBeforeSubmit()) return;
    onSubmit(event);
  };

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-[1280px] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">{isCreate ? 'Thêm bác sĩ' : 'Cập nhật bác sĩ'}</h3>
            <p className="text-xs font-semibold text-slate-400">
              {isCreate
                ? 'Tạo mới hồ sơ nhân sự kèm thông tin chứng chỉ bác sĩ.'
                : 'Cập nhật thông tin nhân sự, chuyên môn và phòng khám phụ trách.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Đóng</button>
        </div>
        <SectionTitle title="Thông tin tài khoản và nhân sự" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Họ tên" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: onlyVietnameseNameChars(v) })} onBlur={() => validateField('fullName')} error={fieldErrors.fullName} required maxLength={MAX_FULL_NAME_LENGTH} />
          <AvatarUpload value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} uploadFn={doctorService.uploadAvatar} />
          <Input label="Tên đăng nhập" value={form.username} onChange={(v) => setForm({ ...form, username: onlyUsernameChars(v) })} onBlur={() => validateField('username')} error={fieldErrors.username} disabled={!isCreate} required maxLength={MAX_USERNAME_LENGTH} />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: onlyEmailChars(v) })} onBlur={() => validateField('email')} error={fieldErrors.email} disabled={!isCreate} required />
          <Input label="Số điện thoại" value={form.phone} onChange={(v) => setForm({ ...form, phone: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('phone')} error={fieldErrors.phone} required maxLength={10} />
          <Input label="CCCD/CMND" value={form.citizenId} onChange={(v) => setForm({ ...form, citizenId: onlyDigits(v).slice(0, 12) })} onBlur={() => validateField('citizenId')} error={fieldErrors.citizenId} required maxLength={12} />
          <DateInput label="Ngày sinh" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} onBlur={(nextValue) => validateField('birthDate', nextValue)} error={fieldErrors.birthDate} required />
          <Select label="Giới tính" value={form.gender} onChange={(v) => { setForm({ ...form, gender: v }); validateField('gender', v); }} error={fieldErrors.gender} empty="Chọn giới tính" required options={['Nam', 'Nữ']} />
          <Select label="Phòng ban" value={form.departmentId} onChange={(v) => { setForm({ ...form, departmentId: v }); validateField('departmentId', v); }} error={fieldErrors.departmentId} empty="Chưa gán phòng ban" required options={departments.filter((d) => ['EXAMINATION', 'CLINICAL'].includes(d.type)).map((d) => ({ value: d.id, label: `${d.departmentCode || 'PB'} - ${d.name}` }))} />
          <Select label="Chức danh" value={form.position} onChange={(v) => { setForm({ ...form, position: limitPosition(v) }); validateField('position', v); }} error={fieldErrors.position} empty="Chọn chức danh" required options={DOCTOR_POSITIONS} />
          <AddressInput
            label="Địa chỉ"
            value={form.address}
            onChange={(v) => {
              setAddressTouched(true);
              setForm({ ...form, address: limitAddress(v) });
            }}
            onBlur={handleAddressBlur}
            onFocus={handleAddressFocus}
            error={fieldErrors.address}
            maxLength={MAX_ADDRESS_LENGTH}
            suggestions={addressSuggestions}
            loading={addressLoading}
            searched={addressSearched}
            open={addressDropdownOpen}
            onSelect={selectAddress}
          />
        </div>
        <SectionTitle title="Thông tin chuyên môn" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Chuyên khoa" value={form.specialty} onChange={(v) => { setForm({ ...form, specialty: v }); validateField('specialty', v); }} error={fieldErrors.specialty} empty="Chọn chuyên khoa" required options={SPECIALTIES} />
          <Input label="Số chứng chỉ" value={form.licenseNumber} onChange={(v) => setForm({ ...form, licenseNumber: v.slice(0, MAX_LICENSE_NUMBER_LENGTH) })} onBlur={() => validateField('licenseNumber')} error={fieldErrors.licenseNumber} required maxLength={MAX_LICENSE_NUMBER_LENGTH} />
          <Select label="Trình độ" value={form.qualification} onChange={(v) => { setForm({ ...form, qualification: v }); validateField('qualification', v); }} error={fieldErrors.qualification} empty="Chọn trình độ" required options={QUALIFICATIONS} />
          <Input type="text" label="Số năm kinh nghiệm" value={form.yearsExperience} onChange={(v) => setForm({ ...form, yearsExperience: onlyDigits(v).slice(0, 2) })} onBlur={() => validateField('yearsExperience')} error={fieldErrors.yearsExperience} required maxLength={2} inputMode="numeric" pattern="[0-9]*" />
        </div>
        <button disabled={busy} className="w-full rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-70 shadow-sm transition-all">
          {isCreate ? 'Tạo bác sĩ' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>,
    document.body
  );
}

function SectionTitle({ title }) { return <h4 className="border-t border-slate-100 pt-4 text-xs font-extrabold uppercase tracking-wider text-slate-700 first:border-t-0 first:pt-0">{title}</h4>; }

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
function Info({ label, value, mono }) { return <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`text-xs text-slate-800 ${mono ? 'font-mono' : 'font-bold'}`}>{value}</p></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-sm font-bold text-slate-800">{title}</strong><p className="mt-1 text-xs text-slate-400">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${danger ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'}`}>{children}</button>; }
function FieldError({ message }) { return <p className={`min-h-[14px] text-[11px] font-bold leading-3 ${message ? 'text-rose-600' : 'text-transparent'}`}>{message || 'Lỗi'}</p>; }

function Input({ label, value, onChange, onBlur, error, required = false, placeholder, type = 'text', inputMode, maxLength, pattern, disabled = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}{required && <span className="text-rose-500"> *</span>}</span>
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value || ''}
        maxLength={maxLength}
        inputMode={inputMode}
        pattern={pattern}
        min={type === 'number' ? '0' : undefined}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}
      />
      <FieldError message={error} />
    </label>
  );
}

function DateInput({ label, value, onChange, onBlur, error, required }) {
  const pickerRef = useRef(null);
  const openPicker = () => {
    if (pickerRef.current) {
      pickerRef.current.value = isValidBirthDate(value) ? displayDateToIso(value) : '';
    }
    if (pickerRef.current?.showPicker) pickerRef.current.showPicker();
    else pickerRef.current?.click();
  };

  const handleBlur = () => {
    const formattedValue = formatDateInput(value);
    if (formattedValue !== value) onChange(formattedValue);
    onBlur?.(formattedValue);
  };

  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="text"
          required={required}
          value={value || ''}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(sanitizeDateTyping(e.target.value))}
          onBlur={handleBlur}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          maxLength={10}
          className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}
        />
        <button type="button" onClick={openPicker} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600" title="Chọn ngày sinh">
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
      <FieldError message={error} />
    </label>
  );
}

function AddressInput({ label, value, onChange, onBlur, onFocus, error, maxLength, suggestions, loading, searched, open, onSelect }) {
  return (
    <label className="relative block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Nhập địa chỉ để gợi ý..." title={value || ''} required maxLength={maxLength} aria-invalid={Boolean(error)} className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open && (loading || searched || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {loading && <p className="px-3.5 py-3 text-xs font-semibold text-slate-500">Đang tìm địa chỉ...</p>}
          {!loading && searched && suggestions.length === 0 && <p className="px-3.5 py-3 text-xs font-semibold text-slate-500">Chưa tìm thấy địa chỉ.</p>}
          {!loading && suggestions.map((item) => (
            <div key={item.place_id} className="flex items-start gap-2 border-b border-slate-100 p-2.5 last:border-b-0 hover:bg-sky-50/60">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-bold leading-5 text-slate-800 line-clamp-2" title={item.displayName || item.display_name}>{item.displayName || item.display_name}</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <FieldError message={error} />
    </label>
  );
}

function Select({ label, value, onChange, options, empty, required, disabled, error }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <select required={required} disabled={disabled} value={value || ''} aria-invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none disabled:opacity-60 disabled:cursor-not-allowed transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}>
        {empty && <option value="">{empty}</option>}
        {options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <FieldError message={error} />
    </label>
  );
}
