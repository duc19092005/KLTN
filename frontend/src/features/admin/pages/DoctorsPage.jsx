import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { doctorService } from '../apis/doctorService';
import { clinicalRoomService } from '../apis/clinicalRoomService';
import { departmentService } from '../apis/departmentService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';

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
  clinicalRoomId: '',
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
    clinicalRoomId: form.clinicalRoomId || undefined,
    ...buildDoctorPayload(form),
  };
}

export default function DoctorsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({ specialty: '', search: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [editing, setEditing] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const totalLabel = useMemo(() => `${pagination.total} bác sĩ`, [pagination.total]);

  const load = async (page = pagination.page) => {
    setLoading(true); setError('');
    try {
      const [doctorRes, roomRes, departmentRes] = await Promise.all([
        doctorService.search({ ...filters, page, limit: pagination.limit }),
        clinicalRoomService.search({ limit: 100 }),
        departmentService.list({ limit: 100 }),
      ]);
      const data = doctorRes.data || {};
      setDoctors(getItems(data));
      if (!Array.isArray(data)) setPagination({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
      setRooms(getItems(roomRes.data));
      setDepartments(getItems(departmentRes.data));
    } catch (err) { setError(getError(err)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    setIsCreateOpen(true);
  };
  const openEdit = (doctor) => {
    setIsCreateOpen(false);
    setEditing(doctor);
    setForm({ ...emptyForm, specialty: doctor.specialty || '', licenseNumber: doctor.licenseNumber || '', qualification: doctor.qualification || '', yearsExperience: doctor.yearsExperience ?? '', clinicalRoomId: doctor.clinicalRoom?.id || '' });
  };
  const close = () => { setEditing(null); setIsCreateOpen(false); setForm(emptyForm); };
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const nextPage = editing ? pagination.page : 1;
    try {
      if (editing) {
        await doctorService.update(editing.id, buildDoctorPayload(form));
        await doctorService.assignRoom(editing.id, form.clinicalRoomId || undefined);
      } else {
        await doctorService.createFull(buildFullDoctorPayload(form));
        setNotice('Tài khoản bác sĩ mới dùng mật khẩu mặc định: 123456');
      }
      close(); await load(nextPage);
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  };
  const search = async (event) => { event.preventDefault(); await load(1); };

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="doctors" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <Hero totalLabel={totalLabel} onCreate={openCreate} />
        {error && <Alert>{error}</Alert>}
        {notice && <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{notice}</div>}
        {loading ? <LoadingIndicator size="lg" label="Đang tải bác sĩ..." /> : (
          <>
            <SearchBar filters={filters} setFilters={setFilters} onSearch={search} />
            <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-950">Danh sách bác sĩ</h3>
                <p className="text-sm text-slate-500">Quản lý hồ sơ chuyên môn và phòng khám phụ trách.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {doctors.map((doctor) => <DoctorRow key={doctor.id} doctor={doctor} onEdit={openEdit} busy={busy} />)}
                {!doctors.length && <div className="p-6 text-center text-sm text-slate-500">Chưa có bác sĩ.</div>}
              </div>
              <Pagination pagination={pagination} onPageChange={load} />
            </section>
          </>
        )}
        {(isCreateOpen || editing) && <DoctorModal mode={editing ? 'edit' : 'create'} form={form} setForm={setForm} departments={departments} rooms={rooms} onSubmit={submit} onClose={close} busy={busy} />}
      </div>
    </DashboardLayout>
  );
}

function Hero({ totalLabel, onCreate }) { return <section className="rounded-[28px] border border-indigo-100 bg-gradient-to-br from-white via-indigo-50 to-cyan-50 p-8 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.24em] mb-3">Doctor OS</p><h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Quản lý bác sĩ</h2><p className="mt-3 text-sm sm:text-base text-slate-600">Tạo mới đầy đủ tài khoản, hồ sơ nhân sự, chuyên khoa, chứng chỉ và phòng khám trong một bước.</p><span className="mt-4 inline-flex rounded-xl bg-white/80 px-3 py-1 text-xs font-black text-indigo-700 border border-indigo-100">{totalLabel}</span></div><button onClick={onCreate} className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700">+ Thêm bác sĩ</button></section>; }
function SearchBar({ filters, setFilters, onSearch }) { return <form onSubmit={onSearch} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-3 items-end"><Input label="Chuyên khoa" value={filters.specialty} onChange={(v) => setFilters({ ...filters, specialty: v })} /><Input label="Tìm kiếm" value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} placeholder="Tên bác sĩ, chứng chỉ..." /><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">Tìm kiếm</button></form>; }
function DoctorRow({ doctor, onEdit, busy }) { return <article className="p-5 hover:bg-slate-50/70"><div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr_170px] gap-4 lg:items-center"><div className="flex items-center gap-3"><img src={doctor.staffProfile?.avatarUrl} alt={doctor.staffProfile?.fullName || 'Bác sĩ'} className="w-11 h-11 rounded-2xl object-cover border border-indigo-100 bg-indigo-50" /><div><strong className="block text-slate-950">{doctor.staffProfile?.fullName}</strong><span className="text-xs text-slate-500">{doctor.staffProfile?.user?.email}</span></div></div><Info label="Chuyên khoa" value={doctor.specialty} /><Info label="Phòng khám" value={doctor.clinicalRoom?.roomName || 'Chưa gán'} /><div className="lg:text-right"><button type="button" disabled={busy} onClick={() => onEdit(doctor)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50">Sửa / Gán phòng</button></div></div></article>; }
function DoctorModal({ mode, form, setForm, departments, rooms, onSubmit, onClose, busy }) { const isCreate = mode === 'create'; return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-5"><div className="flex justify-between gap-4"><div><p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.18em]">Doctor profile</p><h3 className="text-2xl font-black text-slate-950">{isCreate ? 'Thêm bác sĩ' : 'Cập nhật bác sĩ'}</h3><p className="text-sm text-slate-500">{isCreate ? 'Nhập đầy đủ thông tin tài khoản, nhân sự và chuyên môn bác sĩ. Mật khẩu mặc định là 123456 và được mã hóa trước khi lưu.' : 'Cập nhật chuyên môn và phòng khám phụ trách.'}</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button></div>{isCreate && <><SectionTitle title="Thông tin tài khoản và nhân sự" /><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><Input label="Họ tên" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required /><Input label="Avatar URL" value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} placeholder="https://..." required /><Input label="Username" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required /><Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required /><Input label="Số điện thoại" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required /><Input label="CCCD/CMND" value={form.citizenId} onChange={(v) => setForm({ ...form, citizenId: v })} required /><Input type="date" label="Ngày sinh" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} required /><Select label="Giới tính" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} empty="Chọn giới tính" required options={['Nam', 'Nữ', 'Khác']} /><Select label="Phòng ban" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} empty="Chưa gán phòng ban" options={departments.map((d) => ({ value: d.id, label: `${d.departmentCode || 'PB'} - ${d.name}` }))} /><Input label="Chức danh" value={form.position} onChange={(v) => setForm({ ...form, position: v })} placeholder="Bác sĩ" /><Input label="Địa chỉ" value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></div></>}<SectionTitle title="Thông tin chuyên môn" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Chuyên khoa" value={form.specialty} onChange={(v) => setForm({ ...form, specialty: v })} required /><Input label="Số chứng chỉ" value={form.licenseNumber} onChange={(v) => setForm({ ...form, licenseNumber: v })} required /><Input label="Trình độ" value={form.qualification} onChange={(v) => setForm({ ...form, qualification: v })} required /><Input type="number" label="Số năm kinh nghiệm" value={form.yearsExperience} onChange={(v) => setForm({ ...form, yearsExperience: v })} /><Select label="Phòng khám phụ trách" value={form.clinicalRoomId} onChange={(v) => setForm({ ...form, clinicalRoomId: v })} empty="Chưa gán phòng" options={rooms.map((r) => ({ value: r.id, label: `${r.roomCode} - ${r.roomName}` }))} /></div><button disabled={busy} className="w-full rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-70">{isCreate ? 'Tạo bác sĩ' : 'Lưu thay đổi'}</button></form></div>; }
function SectionTitle({ title }) { return <h4 className="border-t border-slate-100 pt-4 text-sm font-black text-slate-800 first:border-t-0 first:pt-0">{title}</h4>; }
function Pagination({ pagination, onPageChange }) { return <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p><div className="flex gap-2"><SmallButton disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trước</SmallButton><SmallButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Sau</SmallButton></div></div>; }
function Info({ label, value }) { return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="text-sm font-bold text-slate-700">{value}</p></div>; }
function Alert({ children }) { return <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{children}</div>; }
function SmallButton({ children, onClick, disabled }) { return <button type="button" disabled={disabled} onClick={onClick} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50">{children}</button>; }
function Input({ label, value, onChange, required, placeholder, type = 'text' }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input type={type} required={required} value={value || ''} min={type === 'number' ? '0' : undefined} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none" /></label>; }
function Select({ label, value, onChange, options, empty, required }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none">{empty && <option value="">{empty}</option>}{options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
