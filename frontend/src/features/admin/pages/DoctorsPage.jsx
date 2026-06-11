import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import AvatarUpload from '../../../shared/components/AvatarUpload';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorService } from '../apis/doctorService';
import { departmentService } from '../apis/departmentService';
import DoctorDetailModal from '../components/DoctorDetailModal';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

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
  'Hô hấp'
];

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
    licenseNumber: form.licenseNumber,
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
    birthDate: form.birthDate,
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
  const [filters, setFilters] = useState({ specialty: '', search: '' });
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
      const [doctorRes, departmentRes] = await Promise.all([
        doctorService.search({ ...filters, page, limit: pagination.limit }),
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
    const formattedBirthDate = staff.birthDate ? new Date(staff.birthDate).toISOString().split('T')[0] : '';
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
  // Create/update anchor on-chain via a step-up SESSION: the axios interceptor prompts one face
  // scan when needed and replays the request, so the admin scans once per session, not per save.
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
          birthDate: form.birthDate,
        };
        await doctorService.update(editing.id, payload);
        toast.success('Cập nhật thông tin bác sĩ thành công!');
        close(); await load(nextPage);
      } else {
        await doctorService.createFull(buildFullDoctorPayload(form));
        toast.success('Tạo bác sĩ mới thành công! Mật khẩu mặc định là: 123456');
        close(); await load(1);
      }
    } catch (err) { toast.error(getError(err)); }
    finally { setBusy(false); }
  };

  const search = async (event) => { event.preventDefault(); await load(1); };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="doctors" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <Hero totalLabel={totalLabel} onCreate={openCreate} />
        {loading ? <LoadingIndicator size="lg" label="Đang tải bác sĩ..." /> : (
          <>
            <SearchBar filters={filters} setFilters={setFilters} onSearch={search} />
            <section className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-950">Danh sách bác sĩ</h3>
                <p className="text-sm text-slate-500">Quản lý hồ sơ chuyên môn và phòng khám phụ trách.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {doctors.map((doctor) => <DoctorRow key={doctor.id} doctor={doctor} onEdit={openEdit} onViewDetails={setDetailDoctorId} busy={busy} />)}
                {!doctors.length && <div className="p-6 text-center text-sm text-slate-500">Chưa có bác sĩ.</div>}
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

function Hero({ totalLabel, onCreate }) { return <div className="flex items-center justify-between gap-3"><span className="rounded-xl bg-white px-3 py-1 text-xs font-black text-cyan-700 border border-cyan-100">{totalLabel}</span><button onClick={onCreate} className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700">+ Thêm bác sĩ</button></div>; }
function SearchBar({ filters, setFilters, onSearch }) { return <form onSubmit={onSearch} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3 items-end"><Select label="Chuyên khoa" value={filters.specialty} onChange={(v) => setFilters({ ...filters, specialty: v })} empty="Tất cả chuyên khoa" options={SPECIALTIES} /><Input label="Tìm kiếm" value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Tên bác sĩ, chứng chỉ..." /><button className="rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white hover:bg-cyan-700">Tìm kiếm</button></form>; }
function DoctorRow({ doctor, onEdit, onViewDetails, busy }) {
  return (
    <article className="p-5 hover:bg-slate-50/70">
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr_0.9fr_240px] gap-4 lg:items-center">
        <div className="flex items-center gap-3">
          <img src={doctor.staffProfile?.avatarUrl} alt={doctor.staffProfile?.fullName || 'Bác sĩ'} className="w-11 h-11 rounded-2xl object-cover border border-cyan-100 bg-cyan-50" />
          <div>
            <strong className="block text-slate-950">{doctor.staffProfile?.fullName}</strong>
            <span className="text-xs text-slate-500">{doctor.staffProfile?.user?.email}</span>
          </div>
        </div>
        <Info label="Chuyên khoa" value={doctor.specialty} />
        <Info label="Phòng khám" value={doctor.staffProfile?.department?.name || 'Chưa gán'} />
        <div>
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Trạng thái dữ liệu</p>
          <BlockchainStatusBadge status={doctor.blockchainStatus} size="xs" />
        </div>
        <div className="lg:text-right flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => onViewDetails(doctor.id)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-cyan-600 hover:bg-cyan-50 disabled:opacity-50">Xem chi tiết</button>
          <button type="button" disabled={busy} onClick={() => onEdit(doctor)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50">Sửa</button>
        </div>
      </div>
    </article>
  );
}
function DoctorModal({ mode, form, setForm, departments, onSubmit, onClose, busy }) {
  const isCreate = mode === 'create';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex justify-between gap-4">
          <div>
            <p className="text-[11px] font-black text-cyan-600 uppercase tracking-[0.18em]">Hồ sơ bác sĩ</p>
            <h3 className="text-2xl font-black text-slate-950">{isCreate ? 'Thêm bác sĩ' : 'Cập nhật bác sĩ'}</h3>
            <p className="text-sm text-slate-500">
              {isCreate
                ? 'Nhập đầy đủ thông tin tài khoản, nhân sự và chuyên môn bác sĩ. Mật khẩu mặc định là 123456 và được mã hóa trước khi lưu.'
                : 'Cập nhật thông tin nhân sự, chuyên môn và phòng khám phụ trách.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button>
        </div>
        <SectionTitle title="Thông tin tài khoản và nhân sự" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Họ tên" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required />
          <AvatarUpload value={form.avatarUrl} onChange={(url) => setForm({ ...form, avatarUrl: url })} uploadFn={doctorService.uploadAvatar} />
          <Input label="Tên đăng nhập" value={form.username} onChange={(v) => setForm({ ...form, username: v })} disabled={!isCreate} required />
          <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} disabled={!isCreate} required />
          <Input label="Số điện thoại" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required />
          <Input label="CCCD/CMND" value={form.citizenId} onChange={(v) => setForm({ ...form, citizenId: v })} required />
          <Input type="date" label="Ngày sinh" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} required />
          <Select label="Giới tính" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} empty="Chọn giới tính" required options={['Nam', 'Nữ', 'Khác']} />
          <Select label="Phòng ban" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} empty="Chưa gán phòng ban" options={departments.filter((d) => ['EXAMINATION', 'CLINICAL'].includes(d.type)).map((d) => ({ value: d.id, label: `${d.departmentCode || 'PB'} - ${d.name}` }))} />
          <Select label="Chức danh" value={form.position} onChange={(v) => setForm({ ...form, position: v })} empty="Chọn chức danh" required options={DOCTOR_POSITIONS} />
          <Input label="Địa chỉ" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        </div>
        <SectionTitle title="Thông tin chuyên môn" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Chuyên khoa" value={form.specialty} onChange={(v) => setForm({ ...form, specialty: v })} empty="Chọn chuyên khoa" required options={SPECIALTIES} />
          <Input label="Số chứng chỉ" value={form.licenseNumber} onChange={(v) => setForm({ ...form, licenseNumber: v })} required />
          <Select label="Trình độ" value={form.qualification} onChange={(v) => setForm({ ...form, qualification: v })} empty="Chọn trình độ" required options={QUALIFICATIONS} />
          <Input type="number" label="Số năm kinh nghiệm" value={form.yearsExperience} onChange={(v) => setForm({ ...form, yearsExperience: v })} />
        </div>
        <button disabled={busy} className="w-full rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white hover:bg-cyan-700 disabled:opacity-70">
          {isCreate ? 'Tạo bác sĩ' : 'Lưu thay đổi'}
        </button>
      </form>
    </div>
  );
}

function SectionTitle({ title }) { return <h4 className="border-t border-slate-100 pt-4 text-sm font-black text-slate-800 first:border-t-0 first:pt-0">{title}</h4>; }
function Pagination({ pagination, onPageChange }) { return <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p><div className="flex gap-2"><SmallButton disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trước</SmallButton><SmallButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Sau</SmallButton></div></div>; }
function Info({ label, value }) { return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="text-sm font-bold text-slate-700">{value}</p></div>; }
function Alert({ children }) { return <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{children}</div>; }
function SmallButton({ children, onClick, disabled }) { return <button type="button" disabled={disabled} onClick={onClick} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50">{children}</button>; }
function Input({ label, value, onChange, required, placeholder, type = 'text', disabled }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input type={type} required={required} disabled={disabled} value={value || ''} min={type === 'number' ? '0' : undefined} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none disabled:opacity-60 disabled:cursor-not-allowed" /></label>; }
function Select({ label, value, onChange, options, empty, required, disabled }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select required={required} disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none disabled:opacity-60 disabled:cursor-not-allowed">{empty && <option value="">{empty}</option>}{options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
