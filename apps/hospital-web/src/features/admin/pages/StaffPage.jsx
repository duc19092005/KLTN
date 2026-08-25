import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { Calendar, ExternalLink, MapPin, Search, Trash2, X, Plus, Filter, Users, UserCheck, CheckSquare, Square, Sparkles, Eye, EyeOff, Pencil, FlaskConical, ShieldCheck, Building2, AlertTriangle } from 'lucide-react';

const emptyStaff = { username: '', email: '', fullName: '', avatarUrl: '', departmentId: '', phone: '', gender: '', citizenId: '', birthDate: '', address: '', position: '', role: 'LAB_MANAGER' };
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', INACTIVE: 'bg-amber-50 text-amber-700 border-amber-200/80', PENDING: 'bg-amber-50 text-amber-700 border-amber-200/80' };
const statusLabel = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Đã ẩn', PENDING: 'Chờ kích hoạt' };
const ROLE_LABEL = { RECEPTIONIST: 'Lễ tân', LAB_MANAGER: 'KTV cận lâm sàng', ADMIN: 'Quản trị viên' };
const ROLE_TONE = { RECEPTIONIST: 'bg-sky-50 text-sky-700 border-sky-200/80', LAB_MANAGER: 'bg-indigo-50 text-indigo-700 border-indigo-200/80', ADMIN: 'bg-slate-100 text-slate-700 border-slate-200' };
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
  const [pendingDeleteStaff, setPendingDeleteStaff] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  const totalLabel = useMemo(() => `${pagination.total} hồ sơ`, [pagination.total]);

  const load = async (page = pagination.page, filterOverride = null) => {
    const activeFilters = filterOverride || filters;
    setLoading(true);
    setSelectedIds([]);
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
    if (form.departmentId) {
      const selectedDept = departments.find((d) => d.id === form.departmentId);
      if (selectedDept) {
        if (form.role === 'LAB_MANAGER' && !['LABORATORY', 'IMAGING'].includes(selectedDept.type)) {
          toast.error('Kỹ thuật viên chỉ được gán vào phòng ban Kỹ thuật (Xét nghiệm, Chẩn đoán hình ảnh).');
          return;
        }
        if (form.role === 'RECEPTIONIST' && !['ADMINISTRATIVE'].includes(selectedDept.type)) {
          toast.error('Nhân viên Lễ tân chỉ được gán vào phòng ban Hành chính / Tiếp đón.');
          return;
        }
      }
    }
    setBusy(true);
    try {
      if (editingStaff?.doctorProfile && form.role !== 'DOCTOR') {
        throw new Error('Không thể đổi bác sĩ sang vai trò khác vì hệ thống chưa có API xóa hồ sơ bác sĩ.');
      }
      const staffPayload = buildStaffPayload(form);
      if (editingStaff) {
        const { username, role, ...editableProfile } = staffPayload;
        await staffService.update(editingStaff.id, editableProfile);
        toast.success('Cập nhật nhân sự thành công!');
      } else {
        await staffService.create(staffPayload);
        toast.success('Tạo nhân sự thành công! Thông tin tài khoản đã được gửi đến email của nhân sự.');
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
  const removeStaff = (staff) => {
    setPendingDeleteStaff(staff);
  };

  const confirmRemoveStaff = async () => {
    if (!pendingDeleteStaff) return;
    setBusy(true);
    try {
      await staffService.remove(pendingDeleteStaff.id);
      toast.success('Đã chuyển nhân sự vào thùng rác thành công!');
      setPendingDeleteStaff(null);
      await load(pagination.page);
    } catch (err) {
      toast.error(getError(err, 'Không xóa được nhân sự'));
    } finally {
      setBusy(false);
    }
  };

  const handleBulkSoftDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tạm thời ${ids.length} nhân sự đã chọn vào thùng rác?`)) return;
    setBusy(true);
    try {
      const res = await staffService.softDeleteMany(ids);
      const data = res.data;
      if (data?.failed > 0) {
        toast.warning(`Thành công: ${data.succeeded}/${data.requested}. Thất bại: ${data.failed}.`);
      } else {
        toast.success(`Đã chuyển ${data.succeeded} nhân sự vào thùng rác!`);
      }
      setSelectedIds([]);
      await load(pagination.page);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => [
    { label: 'Tổng số nhân sự', value: pagination.total, icon: Users, tone: 'bg-sky-50 text-sky-600 border-sky-100' },
    { label: 'Bộ phận Lễ tân', value: staffs.filter((s) => s.user?.role === 'RECEPTIONIST').length, icon: UserCheck, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'KTV Cận lâm sàng', value: staffs.filter((s) => s.user?.role === 'LAB_MANAGER').length, icon: FlaskConical, tone: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'Tài khoản Đang hoạt động', value: staffs.filter((s) => s.user?.status === 'ACTIVE').length, icon: ShieldCheck, tone: 'bg-amber-50 text-amber-600 border-amber-100' },
  ], [staffs, pagination.total]);

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="staff" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-[1600px] mx-auto space-y-7 pb-12 animate-in fade-in duration-300">
        <Hero onCreate={openCreate} onTrash={() => navigate('/admin/staff/trash')} total={pagination.total} />

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

        {loading ? <LoadingIndicator size="lg" label="Đang tải danh sách nhân sự..." /> : (
          <>
            <StaffSearch filters={filters} setFilters={setFilters} onSearch={search} onReset={resetFilters} departments={departments} />
            <StaffList
              staffs={staffs}
              totalLabel={totalLabel}
              onEdit={openEdit}
              onToggleStatus={toggleStatus}
              onRemove={removeStaff}
              onViewDetails={setDetailStaffId}
              busy={busy}
              pagination={pagination}
              onPageChange={load}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              onBulkSoftDelete={handleBulkSoftDelete}
            />
          </>
        )}
        {isFormOpen && <StaffModal departments={departments} form={form} setForm={setForm} onSubmit={submitStaff} onClose={closeForm} busy={busy} editingStaff={editingStaff} />}
        {detailStaffId && <StaffDetailModal staffId={detailStaffId} onClose={() => setDetailStaffId(null)} />}
        {pendingDeleteStaff && (
          <DeleteStaffModal
            staff={pendingDeleteStaff}
            busy={busy}
            onCancel={() => setPendingDeleteStaff(null)}
            onConfirm={confirmRemoveStaff}
          />
        )}
      </div>
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
            <span>Bệnh Viện Đa Khoa Quốc Tế KLTN · Đội Ngũ Nhân Sự ({total} hồ sơ)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Quản lý Nhân sự Bệnh viện
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-2xl">
            Quản lý hồ sơ nhân viên lễ tân, kỹ thuật viên cận lâm sàng, phân quyền phòng ban và theo dõi trạng thái bảo mật.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            title="Nhân sự đã xóa"
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
            <span>Thêm nhân sự mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const ROLE_OPTIONS = [{ value: 'RECEPTIONIST', label: 'Lễ tân' }, { value: 'LAB_MANAGER', label: 'Kỹ thuật viên cận lâm sàng' }];

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
    <form onSubmit={onSearch} className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
            <Filter className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-base font-black text-slate-900">Bộ lọc thông tin nhân sự</p>
            <p className="text-xs font-semibold text-slate-400">{activeCount > 0 ? `${activeCount} bộ lọc đang áp dụng` : 'Tìm theo họ tên, phòng ban, vai trò vận hành và trạng thái.'}</p>
          </div>
        </div>
        {activeCount > 0 && <button type="button" onClick={onReset} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all"><X className="h-3.5 w-3.5" /> Xóa lọc</button>}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr_1.15fr_1fr_1fr_140px] lg:items-end">
        <FilterInput label="Họ tên / Mã NV" value={filters.fullName} onChange={(v) => setFilters({ ...filters, fullName: v })} placeholder="Nhập tên hoặc mã NV..." />
        <FilterInput label="CCCD/CMND" value={filters.citizenId} onChange={(v) => setFilters({ ...filters, citizenId: v })} placeholder="Số căn cước..." />
        <Select label="Phòng ban" value={filters.departmentId} onChange={(v) => setFilters({ ...filters, departmentId: v })} options={departments.map((d) => ({ value: d.id, label: `${d.departmentCode} · ${d.name}` }))} empty="Tất cả phòng ban" />
        <Select label="Vai trò" value={filters.role} onChange={(v) => setFilters({ ...filters, role: v })} options={ROLE_OPTIONS} empty="Tất cả vai trò" />
        <Select label="Trạng thái" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={[{ value: 'ACTIVE', label: 'Đang hiện' }, { value: 'INACTIVE', label: 'Đã ẩn' }]} empty="Tất cả trạng thái" />
        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-transparent">Thao tác</span>
          <button className="inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-sky-700 whitespace-nowrap">
            <Search className="h-4 w-4" strokeWidth={2.5} />
            <span>Tìm kiếm</span>
          </button>
        </div>
      </div>
      <label className="mt-4 inline-flex items-center gap-2.5 cursor-pointer select-none rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-2.5">
        <input type="checkbox" checked={filters.isManager} onChange={(e) => setFilters({ ...filters, isManager: e.target.checked })} className="h-4 w-4 rounded accent-sky-600" />
        <span className="text-xs font-bold text-slate-700">Chỉ hiện trưởng phòng / trưởng khoa</span>
      </label>
    </form>
  );
}

function FilterInput({ label, value, onChange, placeholder }) { return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}</span><input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 text-xs font-semibold focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100 outline-none transition-all" /></label>; }

function StaffList({
  staffs,
  totalLabel,
  onEdit,
  onToggleStatus,
  onRemove,
  onViewDetails,
  busy,
  pagination,
  onPageChange,
  selectedIds = [],
  setSelectedIds,
  onBulkSoftDelete,
}) {
  const allSelected = staffs.length > 0 && selectedIds.length === staffs.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(staffs.map((s) => s.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      {/* Floating Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300 bg-white/95 px-6 py-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-sky-600 text-xs font-black text-white shadow-md">
              {selectedIds.length}
            </span>
            <span className="text-sm font-black text-slate-900">
              Đã chọn {selectedIds.length} nhân sự
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onBulkSoftDelete(selectedIds)}
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

      <section className="rounded-3xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-slate-700 hover:text-sky-600 transition"
              title="Chọn tất cả nhân sự"
            >
              {allSelected ? <CheckSquare size={20} className="text-sky-600" /> : <Square size={20} className="text-slate-400" />}
            </button>
            <Users className="h-5 w-5 text-sky-600" strokeWidth={2.25} />
            <h3 className="text-lg font-black text-slate-900">Danh sách Hồ sơ Nhân sự</h3>
          </div>
          <span className="rounded-xl bg-sky-50 px-4 py-1.5 text-xs font-bold text-sky-800 border border-sky-200/80">{totalLabel}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {staffs.map((staff) => (
            <StaffRow
              key={staff.id}
              staff={staff}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onRemove={onRemove}
              onViewDetails={onViewDetails}
              busy={busy}
              isSelected={selectedIds.includes(staff.id)}
              onToggleSelect={() => toggleSelectOne(staff.id)}
            />
          ))}
          {!staffs.length && <div className="p-12 text-center text-xs font-bold text-slate-400">Không có nhân sự nào trong danh sách.</div>}
        </div>
        <Pagination pagination={pagination} onPageChange={onPageChange} />
      </section>
    </div>
  );
}

function StaffRow({ staff, onEdit, onToggleStatus, onRemove, onViewDetails, busy, isSelected, onToggleSelect }) {
  return (
    <article className={`p-6 transition-all hover:bg-sky-50/30 ${isSelected ? 'bg-sky-50/70' : 'bg-white'}`}>
      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.8fr_220px] gap-4 xl:items-center">
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={onToggleSelect}
            className="text-slate-400 hover:text-sky-600 transition shrink-0"
          >
            {isSelected ? <CheckSquare size={20} className="text-sky-600" /> : <Square size={20} />}
          </button>
          <img src={staff.avatarUrl} alt={staff.fullName} className="w-12 h-12 rounded-2xl object-cover border-2 border-white ring-2 ring-sky-100 shadow-md shrink-0 bg-sky-50" />
          <div className="min-w-0">
            <strong className="block text-slate-900 font-bold truncate text-sm">{staff.fullName}</strong>
            <span className="text-xs font-medium text-slate-400 truncate block">{staff.user?.email}</span>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${ROLE_TONE[staff.user?.role] || ROLE_TONE.ADMIN}`}>{ROLE_LABEL[staff.user?.role] || staff.user?.role || 'N/A'}</span>
              {staff.managedDepartment && <span className="px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 text-[10px] font-bold">★ Trưởng {staff.managedDepartment.name}</span>}
            </div>
          </div>
        </div>
        <Info label="Phòng ban" value={staff.department?.name || 'Chưa gán'} />
        <Info label="Mã NV" value={staff.employeeCode} mono />
        <span className={`w-fit px-3 py-1 rounded-full border text-[11px] font-bold ${statusTone[staff.user?.status] || statusTone.ACTIVE}`}>{statusLabel[staff.user?.status] || 'Không rõ'}</span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Trạng thái dữ liệu</p>
          <BlockchainStatusBadge status={staff.blockchainStatus} size="xs" />
        </div>
        <div className="flex flex-wrap gap-2 xl:justify-end">
          <SmallButton onClick={() => onViewDetails(staff.id)} disabled={busy}>
            <Eye className="h-3.5 w-3.5" />
            <span>Chi tiết</span>
          </SmallButton>
          <SmallButton onClick={() => onEdit(staff)} disabled={busy}>
            <Pencil className="h-3.5 w-3.5" />
            <span>Sửa</span>
          </SmallButton>
          <SmallButton onClick={() => onToggleStatus(staff)} disabled={busy}>
            {staff.user?.status === 'INACTIVE' ? <Eye className="h-3.5 w-3.5 text-emerald-600" /> : <EyeOff className="h-3.5 w-3.5 text-amber-600" />}
            <span>{staff.user?.status === 'INACTIVE' ? 'Hiện' : 'Ẩn'}</span>
          </SmallButton>
          <SmallButton danger onClick={() => onRemove(staff)} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
            <span>Xóa</span>
          </SmallButton>
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

  const isTech = form.role === 'LAB_MANAGER';
  const isReceptionist = form.role === 'RECEPTIONIST';

  const departmentOptions = useMemo(() => {
    return departments
      .filter((department) => {
        if (isTech) return ['LABORATORY', 'IMAGING'].includes(department.type);
        if (isReceptionist) return ['ADMINISTRATIVE'].includes(department.type);
        return department.type !== 'EXAMINATION';
      })
      .map((department) => {
        let typeBadge = '';
        if (department.type === 'LABORATORY') typeBadge = 'Xét nghiệm';
        else if (department.type === 'IMAGING') typeBadge = 'CĐHA';
        else if (department.type === 'ADMINISTRATIVE') typeBadge = 'Hành chính / Lễ tân';
        else typeBadge = department.type;

        return {
          value: department.id,
          label: `${department.name} (${department.departmentCode || 'PB'} • ${typeBadge})`,
        };
      });
  }, [departments, form.role, isTech, isReceptionist]);

  const selectAddress = (suggestion) => {
    setForm((prev) => ({ ...prev, address: suggestion.displayName || suggestion.display_name }));
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
    if (field === 'citizenId') {
      if (!value) return 'Vui lòng nhập CCCD/CMND.';
      if (!/^\d{12}$/.test(value)) return 'CCCD phải gồm đúng 12 chữ số.';
    }
    if (field === 'birthDate' && !value) return 'Vui lòng chọn ngày sinh.';
    if (field === 'position') {
      if (!value.trim()) return 'Vui lòng nhập chức danh.';
      if (value.trim().length > MAX_POSITION_LENGTH) return `Chức danh không được vượt quá ${MAX_POSITION_LENGTH} ký tự.`;
    }
    if (field === 'address') {
      if (!value.trim()) return 'Vui lòng nhập địa chỉ.';
      if (value.trim().length > MAX_ADDRESS_LENGTH) return `Địa chỉ không được vượt quá ${MAX_ADDRESS_LENGTH} ký tự.`;
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

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" onClick={onClose} />
      <form onSubmit={handleSubmit} noValidate className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-200 space-y-6 overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-6 sm:p-7 border-b border-sky-100 flex items-center justify-between">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-100/80 px-3 py-0.5 text-xs font-bold text-sky-800">
              <Sparkles className="h-3.5 w-3.5 text-sky-600" />
              <span>Cấu Hình Hồ Sơ Nhân Sự</span>
            </span>
            <h3 className="text-xl font-black text-slate-900">{editingStaff ? 'Cập nhật nhân sự' : 'Thêm nhân sự mới'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">
            Đóng
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Loại nhân sự"
              value={form.role}
              onChange={(v) => {
                setForm((prev) => {
                  const nextRole = v;
                  const currentDept = departments.find((d) => d.id === prev.departmentId);
                  let nextDeptId = prev.departmentId;
                  if (currentDept) {
                    if (nextRole === 'LAB_MANAGER' && !['LABORATORY', 'IMAGING'].includes(currentDept.type)) {
                      nextDeptId = '';
                    } else if (nextRole === 'RECEPTIONIST' && !['ADMINISTRATIVE'].includes(currentDept.type)) {
                      nextDeptId = '';
                    }
                  }
                  return { ...prev, role: nextRole, departmentId: nextDeptId };
                });
              }}
              options={[{ value: 'RECEPTIONIST', label: 'Lễ tân' }, { value: 'LAB_MANAGER', label: 'Kỹ thuật viên cận lâm sàng' }]}
              required
              disabled={Boolean(editingStaff)}
            />
            <Input label="Họ tên" value={form.fullName} onChange={(v) => setForm((prev) => ({ ...prev, fullName: onlyVietnameseNameChars(v) }))} onBlur={() => validateField('fullName')} error={fieldErrors.fullName} placeholder="Nguyễn Văn A" pattern="[A-Za-zÀ-ỹ\\s]+" maxLength={MAX_FULL_NAME_LENGTH} required />
            <AvatarUpload value={form.avatarUrl} onChange={(url) => setForm((prev) => ({ ...prev, avatarUrl: url }))} uploadFn={staffService.uploadAvatar} ringTone="cyan" />
            <Input label="Tên đăng nhập" value={form.username} onChange={(v) => setForm((prev) => ({ ...prev, username: onlyUsernameChars(v) }))} onBlur={() => validateField('username')} error={fieldErrors.username} placeholder="nguyenvana01" pattern="[a-z0-9]+" maxLength={MAX_USERNAME_LENGTH} required disabled={Boolean(editingStaff)} />
            <Input label="Email" value={form.email} onChange={(v) => setForm((prev) => ({ ...prev, email: v }))} onBlur={handleEmailBlur} error={fieldErrors.email} placeholder="example@gmail.com" type="text" inputMode="email" pattern="[a-z0-9._%\\-]+@[a-z0-9.\\-]+\\.[a-z]{2,}" required />
            <Input label="Số điện thoại" value={form.phone} onChange={(v) => setForm((prev) => ({ ...prev, phone: onlyDigits(v).slice(0, 10) }))} onBlur={() => validateField('phone')} error={fieldErrors.phone} placeholder="0xxxxxxxxx" inputMode="numeric" maxLength={10} pattern="0[0-9]{9}" required />
            <Input label="CCCD/CMND" value={form.citizenId} onChange={(v) => setForm((prev) => ({ ...prev, citizenId: onlyDigits(v).slice(0, 12) }))} onBlur={() => validateField('citizenId')} error={fieldErrors.citizenId} placeholder="12 chữ số CCCD" inputMode="numeric" maxLength={12} pattern="[0-9]{12}" required />
            <DateInput label="Ngày sinh" value={form.birthDate} onChange={(v) => setForm((prev) => ({ ...prev, birthDate: v }))} onBlur={(nextValue) => validateField('birthDate', nextValue)} error={fieldErrors.birthDate} required />
            <Select label="Giới tính" value={form.gender} onChange={(v) => setForm((prev) => ({ ...prev, gender: v }))} options={['Nam', 'Nữ']} empty="Chọn giới tính" required />
            
            <div className="space-y-1.5">
              <Select
                label="Phòng ban"
                value={form.departmentId}
                onChange={(v) => setForm((prev) => ({ ...prev, departmentId: v }))}
                options={departmentOptions}
                empty={
                  departmentOptions.length === 0
                    ? (isTech ? 'Chưa có phòng ban Kỹ thuật (Xét nghiệm/CĐHA)' : 'Chưa có phòng ban Lễ tân / Hành chính')
                    : 'Chưa gán phòng ban'
                }
              />
              <div className="flex items-center gap-1.5 px-1">
                {isTech ? (
                  <>
                    <FlaskConical className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-500">
                      Kỹ thuật viên chỉ thuộc phòng <span className="font-bold text-indigo-700">Xét nghiệm / CĐHA</span>
                    </span>
                  </>
                ) : (
                  <>
                    <Building2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-[11px] font-medium text-slate-500">
                      Lễ tân chỉ thuộc phòng <span className="font-bold text-emerald-700">Hành chính / Tiếp đón</span>
                    </span>
                  </>
                )}
              </div>
            </div>

            <Input label="Chức danh" value={form.position} onChange={(v) => setForm((prev) => ({ ...prev, position: limitPosition(v) }))} onBlur={() => validateField('position')} error={fieldErrors.position} placeholder="Lễ tân, KTV xét nghiệm..." maxLength={MAX_POSITION_LENGTH} required />
            <AddressInput
              label="Địa chỉ"
              value={form.address}
              onChange={(v) => {
                setAddressTouched(true);
                setForm((prev) => ({ ...prev, address: limitAddress(v) }));
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

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition">Hủy</button>
            <button disabled={busy} className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3.5 text-xs font-bold text-white shadow-md hover:bg-sky-700 disabled:opacity-70 transition">
              {busy && <LoadingIndicator size="sm" tone="white" />}{editingStaff ? 'Lưu thay đổi' : 'Tạo nhân sự mới'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
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

function Info({ label, value, mono }) { return <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`text-xs text-slate-800 ${mono ? 'font-mono' : 'font-bold'}`}>{value}</p></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-sm font-bold text-slate-800">{title}</strong><p className="mt-1 text-xs text-slate-400">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${danger ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'}`}>{children}</button>; }

function Input({ label, value, onChange, onBlur, error, required, placeholder, type = 'text', inputMode, maxLength, pattern, disabled = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <input type={type} required={required} disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} pattern={pattern} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} />
      <p className={`min-h-[14px] text-[11px] font-bold leading-3 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Lỗi'}</p>
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
          onChange={(e) => onChange(sanitizeDateTyping(e.target.value))}
          onBlur={handleBlur}
          placeholder="dd/mm/yyyy"
          inputMode="numeric"
          maxLength={10}
          className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}
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
      <p className={`min-h-[14px] text-[11px] font-bold leading-3 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Lỗi'}</p>
    </label>
  );
}

function AddressInput({ label, value, onChange, onBlur, onFocus, error, maxLength, suggestions, loading, searched, open, onSelect }) {
  return (
    <label className="relative block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <div className="relative">
        <input value={value || ''} onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Nhập địa chỉ để gợi ý..." title={value || ''} required maxLength={maxLength} className={`w-full px-3.5 py-2.5 pr-10 bg-slate-50 border rounded-xl text-xs font-semibold focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} />
        <MapPin className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>
      {open && (loading || searched || suggestions.length > 0) && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
          {loading && <p className="px-3.5 py-3 text-xs font-semibold text-slate-500">Đang tìm địa chỉ...</p>}
          {!loading && searched && suggestions.length === 0 && <p className="px-3.5 py-3 text-xs font-semibold text-slate-500">Chưa tìm thấy địa chỉ. Thử nhập thêm chi tiết.</p>}
          {!loading && suggestions.map((item) => (
            <div key={item.place_id} className="flex items-start gap-2 border-b border-slate-100 p-2.5 last:border-b-0 hover:bg-sky-50/60">
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(item)} className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-bold leading-5 text-slate-800 line-clamp-2" title={item.displayName || item.display_name}>{item.displayName || item.display_name}</span>
              </button>
            </div>
          ))}
        </div>
      )}
      <p className={`min-h-[14px] text-[11px] font-bold leading-3 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Lỗi'}</p>
    </label>
  );
}

function Select({ label, value, onChange, options, empty, required, disabled = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <select required={required} disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all">
        {empty && <option value="">{empty}</option>}
        {options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}

function DeleteStaffModal({ staff, busy, onCancel, onConfirm }) {
  const isActive = staff?.user?.status === 'ACTIVE';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 p-6">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-xs font-bold uppercase tracking-wider">Xác nhận xóa nhân sự</p>
          </div>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Chuyển vào thùng rác?</h3>
          <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">
            Hồ sơ nhân sự sẽ được chuyển sang thùng rác lưu trữ (lưu trong 30 ngày để có thể khôi phục).
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Họ và tên</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                {isActive ? 'Đang hoạt động' : 'Ngưng hoạt động'}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{staff?.fullName || 'Nhân sự'}</p>
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-slate-200/60">
              <span>Mã NV: <strong className="font-mono text-sky-600">{staff?.employeeCode || '—'}</strong></span>
              <span>Chức vụ: <strong>{staff?.position || '—'}</strong></span>
            </div>
          </div>

          {isActive && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Lưu ý:</strong> Nhân sự này hiện đang ở trạng thái <strong>Đang hoạt động</strong>. Khi xóa, tài khoản sẽ tự động chuyển sang <strong>NGƯNG HOẠT ĐỘNG</strong> và đưa vào Thùng rác.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-sm disabled:opacity-50"
            >
              {busy ? 'Đang xóa...' : 'Xác nhận xóa'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
