import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import AvatarUpload from '../../../shared/components/AvatarUpload';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import StaffDetailModal from '../components/StaffDetailModal';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { Calendar, ExternalLink, MapPin, Search, X } from 'lucide-react';

const emptyStaff = { username: '', email: '', fullName: '', avatarUrl: '', departmentId: '', phone: '', gender: '', citizenId: '', birthDate: '', address: '', position: '', role: 'LAB_MANAGER' };
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100', INACTIVE: 'bg-rose-50 text-rose-700 border-rose-100', PENDING: 'bg-amber-50 text-amber-700 border-amber-100' };
const statusLabel = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động', PENDING: 'Chờ kích hoạt' };
const ROLE_LABEL = { RECEPTIONIST: 'Lễ tân', LAB_MANAGER: 'KTV cận lâm sàng', ADMIN: 'Quản trị viên' };
const ROLE_TONE = { RECEPTIONIST: 'bg-cyan-50 text-cyan-700 border-cyan-100', LAB_MANAGER: 'bg-cyan-50 text-cyan-700 border-cyan-100', ADMIN: 'bg-slate-100 text-slate-700 border-slate-200' };
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
function getError(err) { return err?.response?.data?.message || err.message || 'Thao tác thất bại'; }
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
function limitPosition(value) { return (value || '').slice(0, MAX_POSITION_LENGTH); }
function limitAddress(value) { return (value || '').slice(0, MAX_ADDRESS_LENGTH); }
function onlyEmailChars(value) { return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9@._-]/g, ''); }
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
function buildStaffPayload(form) {
  return {
    username: form.username,
    email: form.email,
    fullName: form.fullName,
    avatarUrl: form.avatarUrl,
    departmentId: form.departmentId || null,
    phone: form.phone,
    gender: form.gender,
    citizenId: form.citizenId,
    birthDate: displayDateToIso(form.birthDate),
    address: form.address,
    position: form.position,
    role: form.role,
  };
}

export default function StaffPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [form, setForm] = useState(emptyStaff);
  const [filters, setFilters] = useState({ fullName: '', employeeCode: '', citizenId: '', departmentId: '', role: '', status: '', isManager: false });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailStaffId, setDetailStaffId] = useState(null);

  const totalLabel = useMemo(() => `${pagination.total} hồ sơ`, [pagination.total]);

  const load = async (page = pagination.page, filterOverride = null) => {
    const activeFilters = filterOverride || filters;
    setLoading(true);
    try {
      const [depRes, staffRes] = await Promise.all([
        departmentService.list(),
        staffService.search({ ...cleanFilters(activeFilters), excludeRole: 'DOCTOR', page, limit: pagination.limit }),
      ]);
      setDepartments(Array.isArray(depRes.data) ? depRes.data : depRes.data?.items || []);
      const data = staffRes.data || {};
      setStaffs(Array.isArray(data) ? data : data.items || []);
      if (!Array.isArray(data)) setPagination({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
    } catch (err) { toast.error(getError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const openCreate = () => { setEditingStaff(null); setForm(emptyStaff); setIsFormOpen(true); };
  const openEdit = (staff) => {
    setEditingStaff(staff);
    setForm({ username: staff.user?.username || '', email: staff.user?.email || '', fullName: staff.fullName || '', avatarUrl: staff.avatarUrl || '', departmentId: staff.departmentId || '', phone: staff.phone || '', gender: staff.gender || '', citizenId: staff.citizenId || '', birthDate: isoToDisplayDate(staff.birthDate), address: staff.address || '', position: staff.position || '', role: staff.user?.role || 'LAB_MANAGER' });
    setIsFormOpen(true);
  };
  const closeForm = () => { setIsFormOpen(false); setEditingStaff(null); setForm(emptyStaff); };

  const submitStaff = async (event) => {
    event.preventDefault();
    if (!form.avatarUrl) {
      toast.error('Vui lòng tải lên ảnh đại diện của nhân sự.');
      return;
    }
    if (!form.fullName?.trim() || !VIETNAMESE_NAME_REGEX.test(form.fullName.trim())) {
      toast.error('Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.');
      return;
    }
    if (form.fullName.trim().length > MAX_FULL_NAME_LENGTH) {
      toast.error(`Họ tên không được vượt quá ${MAX_FULL_NAME_LENGTH} ký tự.`);
      return;
    }
    if (!form.username || !USERNAME_REGEX.test(form.username)) {
      toast.error('Tên đăng nhập chỉ được chứa chữ thường không dấu và số.');
      return;
    }
    if (form.username.length > MAX_USERNAME_LENGTH) {
      toast.error(`Tên đăng nhập không được vượt quá ${MAX_USERNAME_LENGTH} ký tự.`);
      return;
    }
    if (!form.position?.trim()) {
      toast.error('Vui lòng nhập chức danh.');
      return;
    }
    if ((form.position || '').length > MAX_POSITION_LENGTH) {
      toast.error(`Chức danh không được vượt quá ${MAX_POSITION_LENGTH} ký tự.`);
      return;
    }
    if (!EMAIL_REGEX.test(form.email)) {
      toast.error('Email phải đúng định dạng, không dấu và không chứa ký tự đặc biệt ngoài @, dấu chấm, gạch ngang/gạch dưới hợp lệ.');
      return;
    }
    if (!VN_PHONE_REGEX.test(form.phone)) {
      toast.error('Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số hợp lệ.');
      return;
    }
    if (!VN_CITIZEN_ID_REGEX.test(form.citizenId)) {
      toast.error('CCCD phải gồm đúng 12 chữ số.');
      return;
    }
    if (!isValidBirthDate(form.birthDate)) {
      toast.error(`Ngày sinh phải theo định dạng dd/mm/yyyy, năm từ ${MIN_BIRTH_YEAR} và không lớn hơn ngày hiện tại.`);
      return;
    }
    if (!form.address?.trim()) {
      toast.error('Vui lòng nhập địa chỉ.');
      return;
    }
    if (form.address.length > MAX_ADDRESS_LENGTH) {
      toast.error(`Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.`);
      return;
    }
    setBusy(true);
    try {
      if (editingStaff?.doctorProfile && form.role !== 'DOCTOR') {
        throw new Error('Không thể đổi bác sĩ sang vai trò khác vì hệ thống chưa có API xóa hồ sơ bác sĩ.');
      }
      const staffPayload = buildStaffPayload(form);
      if (editingStaff) {
        await staffService.update(editingStaff.id, staffPayload);
        toast.success('Cập nhật nhân sự thành công!');
      } else {
        await staffService.create(staffPayload);
        toast.success('Tạo nhân sự thành công! Mật khẩu mặc định: 123456');
      }
      closeForm(); await load(editingStaff ? pagination.page : 1);
    } catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };
  const search = async (event) => { event.preventDefault(); await load(1); };
  const resetFilters = () => {
    const cleared = { fullName: '', employeeCode: '', citizenId: '', departmentId: '', role: '', status: '', isManager: false };
    setFilters(cleared);
    load(1, cleared);
  };
  const toggleStatus = async (staff) => {
    setBusy(true);
    try {
      if (staff.user?.status === 'INACTIVE') {
        await staffService.unlock(staff.id);
        toast.success('Mở khóa tài khoản thành công!');
      } else {
        await staffService.lock(staff.id);
        toast.success('Khóa tài khoản thành công!');
      }
      await load(pagination.page);
    }
    catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };
  const removeStaff = async (staff) => {
    if (!staff?.id) return;
    setBusy(true);
    try {
      await staffService.remove(staff.id);
      toast.success('Xóa nhân sự thành công!');
      await load(pagination.page);
    }
    catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="staff" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <Hero onCreate={openCreate} />
        {loading ? <LoadingIndicator size="lg" label="Đang tải nhân sự..." /> : (
          <>
            <StaffSearch filters={filters} setFilters={setFilters} onSearch={search} onReset={resetFilters} departments={departments} />
            <StaffList staffs={staffs} totalLabel={totalLabel} onEdit={openEdit} onToggleStatus={toggleStatus} onRemove={removeStaff} onViewDetails={setDetailStaffId} busy={busy} pagination={pagination} onPageChange={load} />
          </>
        )}
        {isFormOpen && <StaffModal departments={departments} form={form} setForm={setForm} onSubmit={submitStaff} onClose={closeForm} busy={busy} editingStaff={editingStaff} />}
        {detailStaffId && <StaffDetailModal staffId={detailStaffId} onClose={() => setDetailStaffId(null)} />}
      </div>
    </DashboardLayout>
  );
}
function Hero({ onCreate }) { return <div className="flex justify-end"><button onClick={onCreate} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700">+ Thêm nhân sự</button></div>; }
const ROLE_OPTIONS = [{ value: 'RECEPTIONIST', label: 'Lễ tân' }, { value: 'LAB_MANAGER', label: 'Kỹ thuật viên cận lâm sàng' }];

// Remove empty/falsey filter values so we never send blank `departmentId` (the backend
// validates it as a UUID and would 400 on an empty string) or `isManager=false`.
function cleanFilters(filters) {
  const out = {};
  if (filters.fullName?.trim()) out.fullName = filters.fullName.trim();
  if (filters.employeeCode?.trim()) out.employeeCode = filters.employeeCode.trim();
  if (filters.citizenId?.trim()) out.citizenId = filters.citizenId.trim();
  if (filters.departmentId) out.departmentId = filters.departmentId;
  if (filters.role) out.role = filters.role;
  if (filters.status) out.status = filters.status;
  if (filters.isManager) out.isManager = true;
  return out;
}

function StaffSearch({ filters, setFilters, onSearch, onReset, departments }) {
  const activeCount = [filters.fullName, filters.employeeCode, filters.citizenId, filters.departmentId, filters.role, filters.status, filters.isManager].filter(Boolean).length;
  return (
    <form onSubmit={onSearch} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600"><Search className="h-4 w-4" strokeWidth={2.5} /></span>
          <div>
            <p className="text-sm font-black text-slate-800">Bộ lọc nhân sự</p>
            <p className="text-xs font-semibold text-slate-400">{activeCount > 0 ? `${activeCount} bộ lọc đang áp dụng` : 'Tìm theo hồ sơ, phòng ban, vai trò và trạng thái.'}</p>
          </div>
        </div>
        {activeCount > 0 && <button type="button" onClick={onReset} className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50"><X className="h-3.5 w-3.5" /> Xóa lọc</button>}
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr_1.15fr_1fr_1fr_150px] lg:items-end">
        <FilterInput label="Họ tên / Mã NV" value={filters.fullName} onChange={(v) => setFilters({ ...filters, fullName: v })} placeholder="Nhập tên hoặc mã NV..." />
        <FilterInput label="CCCD/CMND" value={filters.citizenId} onChange={(v) => setFilters({ ...filters, citizenId: v })} placeholder="Số căn cước..." />
        <Select label="Phòng ban" value={filters.departmentId} onChange={(v) => setFilters({ ...filters, departmentId: v })} options={departments.map((d) => ({ value: d.id, label: `${d.departmentCode} · ${d.name}` }))} empty="Tất cả phòng ban" />
        <Select label="Vai trò" value={filters.role} onChange={(v) => setFilters({ ...filters, role: v })} options={ROLE_OPTIONS} empty="Tất cả vai trò" />
        <Select label="Ẩn / hiện" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={[{ value: 'ACTIVE', label: 'Đang hiện' }, { value: 'INACTIVE', label: 'Đã ẩn' }]} empty="Tất cả trạng thái" />
        <div className="space-y-1.5"><span className="block text-xs font-black text-transparent">Tìm kiếm</span><button className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-black text-white shadow-sm hover:bg-cyan-700 whitespace-nowrap"><Search className="h-4 w-4" strokeWidth={2.5} /> Tìm kiếm</button></div>
      </div>
      <label className="mt-3 inline-flex items-center gap-2.5 cursor-pointer select-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
        <input type="checkbox" checked={filters.isManager} onChange={(e) => setFilters({ ...filters, isManager: e.target.checked })} className="h-4 w-4 rounded accent-cyan-600" />
        <span className="text-sm font-bold text-slate-700">Chỉ hiện trưởng phòng / trưởng khoa</span>
      </label>
    </form>
  );
}
function FilterInput({ label, value, onChange, placeholder }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100 outline-none" /></label>; }
function StaffList({ staffs, totalLabel, onEdit, onToggleStatus, onRemove, onViewDetails, busy, pagination, onPageChange }) { return <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-xl font-black text-slate-950">Danh sách nhân sự</h3></div><span className="rounded-xl bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 border border-slate-100">{totalLabel}</span></div><div className="divide-y divide-slate-100">{staffs.map((staff) => <StaffRow key={staff.id} staff={staff} onEdit={onEdit} onToggleStatus={onToggleStatus} onRemove={onRemove} onViewDetails={onViewDetails} busy={busy} />)}{!staffs.length && <div className="p-6"><Empty title="Không có nhân sự" desc="Thử đổi bộ lọc hoặc tạo nhân sự mới." /></div>}</div><Pagination pagination={pagination} onPageChange={onPageChange} /></section>; }
function StaffRow({ staff, onEdit, onToggleStatus, onRemove, onViewDetails, busy }) {
  return (
    <article className="p-5 hover:bg-slate-50/70">
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.8fr_190px] gap-4 xl:items-center">
        <div className="flex items-center gap-3">
          <img src={staff.avatarUrl} alt={staff.fullName} className="w-11 h-11 rounded-2xl object-cover border border-cyan-100 bg-cyan-50" />
          <div className="min-w-0">
            <strong className="block text-slate-950 truncate">{staff.fullName}</strong>
            <span className="text-xs text-slate-500 truncate block">{staff.user?.email}</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black ${ROLE_TONE[staff.user?.role] || ROLE_TONE.ADMIN}`}>{ROLE_LABEL[staff.user?.role] || staff.user?.role || 'N/A'}</span>
              {staff.managedDepartment && <span className="px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-black">★ Trưởng {staff.managedDepartment.name}</span>}
            </div>
          </div>
        </div>
        <Info label="Phòng ban" value={staff.department?.name || 'Chưa gán'} />
        <Info label="Mã NV" value={staff.employeeCode} mono />
        <span className={`w-fit px-2.5 py-1 rounded-lg border text-xs font-black ${statusTone[staff.user?.status] || statusTone.ACTIVE}`}>{statusLabel[staff.user?.status] || 'Không rõ'}</span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Trạng thái dữ liệu</p>
          <BlockchainStatusBadge status={staff.blockchainStatus} size="xs" />
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <SmallButton onClick={() => onViewDetails(staff.id)} disabled={busy}>Chi tiết</SmallButton>
          <SmallButton onClick={() => onEdit(staff)} disabled={busy}>Sửa</SmallButton>
          <SmallButton onClick={() => onToggleStatus(staff)} disabled={busy}>{staff.user?.status === 'INACTIVE' ? 'Hiện' : 'Ẩn'}</SmallButton>
          <SmallButton danger onClick={() => onRemove(staff)} disabled={busy}>Xóa</SmallButton>
        </div>
      </div>
    </article>
  );
}
function StaffModal({ departments, form, setForm, onSubmit, onClose, busy, editingStaff }) {
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSearched, setAddressSearched] = useState(false);
  const [addressDropdownOpen, setAddressDropdownOpen] = useState(false);
  const [addressTouched, setAddressTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

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

  const departmentOptions = departments
    .filter((department) => department.type !== 'EXAMINATION')
    .map((department) => ({ value: department.id, label: department.name }));

  const selectAddress = (suggestion) => {
    setForm({ ...form, address: suggestion.displayName || suggestion.display_name });
    setAddressSuggestions([]);
    setAddressSearched(false);
    setAddressDropdownOpen(false);
  };

  const getFieldError = (field, overrideValue) => {
    const value = overrideValue ?? form[field] ?? '';
    if (field === 'fullName') {
      if (!value.trim()) return 'Vui lòng nhập họ tên.';
      if (!VIETNAMESE_NAME_REGEX.test(value.trim())) return 'Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng.';
      if (value.trim().length > MAX_FULL_NAME_LENGTH) return `Họ tên không được vượt quá ${MAX_FULL_NAME_LENGTH} ký tự.`;
    }
    if (field === 'username') {
      if (!value) return 'Vui lòng nhập tên đăng nhập.';
      if (!USERNAME_REGEX.test(value)) return 'Tên đăng nhập chỉ gồm chữ thường không dấu và số.';
      if (value.length > MAX_USERNAME_LENGTH) return `Tên đăng nhập không được vượt quá ${MAX_USERNAME_LENGTH} ký tự.`;
    }
    if (field === 'email') {
      if (!value) return 'Vui lòng nhập email.';
      if (value !== onlyEmailChars(value)) return 'Email không được chứa dấu, khoảng trắng hoặc ký tự đặc biệt lạ.';
      if (!EMAIL_REGEX.test(value)) return 'Email phải đúng định dạng và không chứa dấu/ký tự đặc biệt lạ.';
    }
    if (field === 'phone' && !VN_PHONE_REGEX.test(value)) return 'Số điện thoại Việt Nam phải gồm 10 số và đúng đầu số.';
    if (field === 'citizenId' && !VN_CITIZEN_ID_REGEX.test(value)) return 'CCCD phải gồm đúng 12 chữ số.';
    if (field === 'birthDate' && !isValidBirthDate(value)) return `Ngày sinh phải là dd/mm/yyyy, từ năm ${MIN_BIRTH_YEAR} và không lớn hơn hôm nay.`;
    if (field === 'position') {
      if (!value.trim()) return 'Vui lòng nhập chức danh.';
      if (value.length > MAX_POSITION_LENGTH) return `Chức danh không được vượt quá ${MAX_POSITION_LENGTH} ký tự.`;
    }
    if (field === 'address') {
      if (!value.trim()) return 'Vui lòng nhập địa chỉ.';
      if (value.length > MAX_ADDRESS_LENGTH) return `Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.`;
    }
    return '';
  };

  const validateField = (field, overrideValue) => {
    const error = getFieldError(field, overrideValue);
    setFieldErrors((current) => ({ ...current, [field]: error }));
    return !error;
  };

  const validateFormBeforeSubmit = () => {
    const fields = ['fullName', 'username', 'email', 'phone', 'citizenId', 'birthDate', 'position', 'address'];
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

  const handleAddressBlur = () => {
    validateField('address');
    window.setTimeout(() => setAddressDropdownOpen(false), 120);
  };

  const handleAddressFocus = () => {
    if (addressLoading || addressSearched || addressSuggestions.length > 0) setAddressDropdownOpen(true);
  };

  const handleEmailBlur = () => {
    validateField('email');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-black text-slate-950">{editingStaff ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Loại nhân sự" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[{ value: 'RECEPTIONIST', label: 'Lễ tân' }, { value: 'LAB_MANAGER', label: 'Kỹ thuật viên cận lâm sàng' }]} required />
          <Input label="Họ tên" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: onlyVietnameseNameChars(v) })} onBlur={() => validateField('fullName')} error={fieldErrors.fullName} placeholder="Nguyễn Văn A" pattern="[A-Za-zÀ-ỹ\\s]+" maxLength={MAX_FULL_NAME_LENGTH} required />
          <AvatarUpload value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} uploadFn={staffService.uploadAvatar} ringTone="cyan" />
          <Input label="Tên đăng nhập" value={form.username} onChange={(v) => setForm({ ...form, username: onlyUsernameChars(v) })} onBlur={() => validateField('username')} error={fieldErrors.username} placeholder="nguyenvana01" pattern="[a-z0-9]+" maxLength={MAX_USERNAME_LENGTH} required />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} onBlur={handleEmailBlur} error={fieldErrors.email} placeholder="example@gmail.com" type="text" inputMode="email" pattern="[a-z0-9._%\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}" required />
          <Input label="Số điện thoại" value={form.phone} onChange={(v) => setForm({ ...form, phone: onlyDigits(v).slice(0, 10) })} onBlur={() => validateField('phone')} error={fieldErrors.phone} placeholder="0xxxxxxxxx" inputMode="numeric" maxLength={10} pattern="0[0-9]{9}" required />
          <Input label="CCCD/CMND" value={form.citizenId} onChange={(v) => setForm({ ...form, citizenId: onlyDigits(v).slice(0, 12) })} onBlur={() => validateField('citizenId')} error={fieldErrors.citizenId} placeholder="12 chữ số CCCD" inputMode="numeric" maxLength={12} pattern="[0-9]{12}" required />
          <DateInput label="Ngày sinh" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} onBlur={(nextValue) => validateField('birthDate', nextValue)} error={fieldErrors.birthDate} required />
          <Select label="Giới tính" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={['Nam', 'Nữ']} empty="Chọn giới tính" required />
          <Select label="Phòng ban" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} options={departmentOptions} empty="Chưa gán phòng ban" />
          <Input label="Chức danh" value={form.position} onChange={(v) => setForm({ ...form, position: limitPosition(v) })} onBlur={() => validateField('position')} error={fieldErrors.position} placeholder="Lễ tân, KTV xét nghiệm, KTV chẩn đoán hình ảnh..." maxLength={MAX_POSITION_LENGTH} required />
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
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-70">
          {busy && <LoadingIndicator size="sm" tone="white" />}{editingStaff ? 'Lưu thay đổi' : 'Tạo nhân sự'}
        </button>
      </form>
    </div>
  );
}

function Pagination({ pagination, onPageChange }) { return <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p><div className="flex gap-2"><SmallButton disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trước</SmallButton><SmallButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Sau</SmallButton></div></div>; }
function Info({ label, value, mono }) { return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`text-sm text-slate-700 ${mono ? 'font-mono' : 'font-bold'}`}>{value}</p></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong>{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${danger ? 'border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-cyan-50 hover:text-cyan-600'}`}>{children}</button>; }
function Input({ label, value, onChange, onBlur, error, required, placeholder, type = 'text', inputMode, maxLength, pattern }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input type={type} required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} pattern={pattern} min={type === 'number' ? '0' : undefined} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} /><p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p></label>; }
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
      <span className="text-[13px] font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input
          type="text"
          required={required}
          value={value || ''}
          onChange={(e) => onChange(sanitizeDateTyping(e.target.value))}
          onBlur={handleBlur}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          maxLength={10}
          className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`}
        />
        <button type="button" onClick={openPicker} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-cyan-50 hover:text-cyan-600" title="Chọn ngày sinh">
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
      <p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p>
    </label>
  );
}
function AddressInput({ label, value, onChange, onBlur, onFocus, error, maxLength, suggestions, loading, searched, open, onSelect }) {
  return (
    <label className="relative block space-y-1.5">
      <span className="text-[13px] font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Nhập địa chỉ để gợi ý..." title={value || ''} required maxLength={maxLength} className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open && (loading || searched || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {loading && <p className="px-3.5 py-3 text-sm font-semibold text-slate-500">Đang tìm địa chỉ...</p>}
          {!loading && searched && suggestions.length === 0 && <p className="px-3.5 py-3 text-sm font-semibold text-slate-500">Chưa tìm thấy trên OpenStreetMap. Thử nhập thêm phường/quận/thành phố.</p>}
          {!loading && suggestions.map((item) => (
            <div key={item.place_id} className="flex items-start gap-2 border-b border-slate-100 p-2.5 last:border-b-0 hover:bg-cyan-50/60">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-bold leading-5 text-slate-800 line-clamp-2" title={item.displayName || item.display_name}>{item.displayName || item.display_name}</span>
                <span className="mt-1 block text-xs font-semibold text-slate-400">{item.lat}, {item.lon}</span>
              </button>
              <a href={buildGoogleMapsDirectionsUrl(item.lat, item.lon)} target="_blank" rel="noreferrer" className="rounded-xl border border-cyan-100 bg-white p-2 text-cyan-600 hover:bg-cyan-600 hover:text-white" title="Mở chỉ đường Google Maps" onClick={(e) => e.stopPropagation()}>
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}
      <p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Không có lỗi'}</p>
    </label>
  );
}
function Select({ label, value, onChange, options, empty, required }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none">{empty && <option value="">{empty}</option>}{options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
