import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import { FaceStepUpModal } from '../../auth';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

const emptyStaff = { username: '', email: '', fullName: '', avatarUrl: '', departmentId: '', phone: '', gender: '', citizenId: '', birthDate: '', address: '', position: '', role: 'LAB_MANAGER' };
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100', INACTIVE: 'bg-red-50 text-red-700 border-red-100', PENDING: 'bg-amber-50 text-amber-700 border-amber-100' };
const statusLabel = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động', PENDING: 'Chờ kích hoạt' };
function getError(err) { return err?.response?.data?.message || err.message || 'Thao tác thất bại'; }
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
    birthDate: form.birthDate,
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
  const [filters, setFilters] = useState({ employeeCode: '', fullName: '', citizenId: '', department: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // staff awaiting face step-up

  const totalLabel = useMemo(() => `${pagination.total} hồ sơ`, [pagination.total]);

  const load = async (page = pagination.page) => {
    setLoading(true);
    try {
      const [depRes, staffRes] = await Promise.all([
        departmentService.list(),
        staffService.search({ ...filters, page, limit: pagination.limit }),
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
    setForm({ username: staff.user?.username || '', email: staff.user?.email || '', fullName: staff.fullName || '', avatarUrl: staff.avatarUrl || '', departmentId: staff.departmentId || '', phone: staff.phone || '', gender: staff.gender || '', citizenId: staff.citizenId || '', birthDate: staff.birthDate ? staff.birthDate.slice(0, 10) : '', address: staff.address || '', position: staff.position || '', role: staff.user?.role || 'LAB_MANAGER' });
    setIsFormOpen(true);
  };
  const closeForm = () => { setIsFormOpen(false); setEditingStaff(null); setForm(emptyStaff); };

  const submitStaff = async (event) => {
    event.preventDefault(); setBusy(true);
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
  // Deleting/deactivating a staff (incl. doctors) is sensitive -> require a fresh face scan.
  const removeStaff = (staff) => {
    setPendingDelete(staff);
  };
  const handleDeleteStepUp = async (ticket) => {
    const staff = pendingDelete;
    setPendingDelete(null);
    if (!staff?.id) return;
    setBusy(true);
    try {
      await staffService.remove(staff.id, ticket);
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
            <StaffSearch filters={filters} setFilters={setFilters} onSearch={search} />
            <StaffList staffs={staffs} totalLabel={totalLabel} onEdit={openEdit} onToggleStatus={toggleStatus} onRemove={removeStaff} busy={busy} pagination={pagination} onPageChange={load} />
          </>
        )}
        {isFormOpen && <StaffModal departments={departments} form={form} setForm={setForm} onSubmit={submitStaff} onClose={closeForm} busy={busy} editingStaff={editingStaff} />}
        {pendingDelete && (
          <FaceStepUpModal
            action="DELETE_STAFF"
            resourceId={pendingDelete.id}
            title="Xác nhận xóa nhân sự"
            description={`Xóa/ẩn nhân sự "${pendingDelete.fullName || pendingDelete.id}" là thao tác nhạy cảm. Vui lòng quét khuôn mặt để xác nhận chính bạn thực hiện.`}
            onSuccess={handleDeleteStepUp}
            onClose={() => setPendingDelete(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
function Hero({ onCreate }) { return <section className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-8 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.24em] mb-3">Hệ thống nhân sự</p><h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Quản lý nhân sự</h2><p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">Hiển thị toàn bộ nhân sự có phân trang, bộ lọc và thao tác từng dòng. Mã nhân viên được hệ thống tự sinh NV-0001 hoặc BS-0001 cho bác sĩ.</p></div><button onClick={onCreate} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700">+ Thêm nhân sự</button></section>; }
function StaffSearch({ filters, setFilters, onSearch }) { return <form onSubmit={onSearch} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-3 items-end"><Input label="Mã NV" value={filters.employeeCode} onChange={(v) => setFilters({ ...filters, employeeCode: v })} /><Input label="Họ tên" value={filters.fullName} onChange={(v) => setFilters({ ...filters, fullName: v })} /><Input label="CCCD/CMND" value={filters.citizenId} onChange={(v) => setFilters({ ...filters, citizenId: v })} /><Input label="Phòng ban" value={filters.department} onChange={(v) => setFilters({ ...filters, department: v })} /><button className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">Tìm kiếm</button></form>; }
function StaffList({ staffs, totalLabel, onEdit, onToggleStatus, onRemove, busy, pagination, onPageChange }) { return <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100 flex items-center justify-between"><div><h3 className="text-xl font-black text-slate-950">Danh sách nhân sự</h3><p className="text-sm text-slate-500">Theo dõi phòng ban và trạng thái tài khoản.</p></div><span className="rounded-xl bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 border border-slate-100">{totalLabel}</span></div><div className="divide-y divide-slate-100">{staffs.map((staff) => <StaffRow key={staff.id} staff={staff} onEdit={onEdit} onToggleStatus={onToggleStatus} onRemove={onRemove} busy={busy} />)}{!staffs.length && <div className="p-6"><Empty title="Không có nhân sự" desc="Thử đổi bộ lọc hoặc tạo nhân sự mới." /></div>}</div><Pagination pagination={pagination} onPageChange={onPageChange} /></section>; }
function StaffRow({ staff, onEdit, onToggleStatus, onRemove, busy }) { return <article className="p-5 hover:bg-slate-50/70"><div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_190px] gap-4 xl:items-center"><div className="flex items-center gap-3"><img src={staff.avatarUrl} alt={staff.fullName} className="w-11 h-11 rounded-2xl object-cover border border-blue-100 bg-blue-50" /><div><strong className="block text-slate-950">{staff.fullName}</strong><span className="text-xs text-slate-500">{staff.user?.email}</span></div></div><Info label="Phòng ban" value={staff.department?.name || 'Chưa gán'} /><Info label="Mã NV" value={staff.employeeCode} mono /><span className={`w-fit px-2.5 py-1 rounded-lg border text-xs font-black ${statusTone[staff.user?.status] || statusTone.ACTIVE}`}>{statusLabel[staff.user?.status] || 'Không rõ'}</span><div className="flex flex-wrap gap-2 xl:justify-end"><SmallButton onClick={() => onEdit(staff)} disabled={busy}>Sửa</SmallButton><SmallButton onClick={() => onToggleStatus(staff)} disabled={busy}>{staff.user?.status === 'INACTIVE' ? 'Hiện' : 'Ẩn'}</SmallButton><SmallButton danger onClick={() => onRemove(staff)} disabled={busy}>Xóa</SmallButton></div></div></article>; }
function StaffModal({ departments, form, setForm, onSubmit, onClose, busy, editingStaff }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl space-y-5"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.18em]">Thiết lập nhân sự</p><h3 className="text-2xl font-black text-slate-950">{editingStaff ? 'Chỉnh sửa nhân sự' : 'Thêm nhân sự'}</h3><p className="text-sm text-slate-500">Tài khoản nhân sự dùng mật khẩu mặc định 123456. Mật khẩu được mã hóa trước khi lưu. Bác sĩ được tạo ở trang Bác sĩ.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Select label="Loại nhân sự" value={form.role} onChange={(v) => setForm({ ...form, role: v })} options={[...(editingStaff?.user?.role === 'DOCTOR' ? [{ value: 'DOCTOR', label: 'Bác sĩ' }] : []), { value: 'RECEPTIONIST', label: 'Lễ tân' }, { value: 'LAB_MANAGER', label: 'Trưởng khoa / Lãnh đạo phòng ban' }]} required /><Input label="Họ tên" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} required /><Input label="URL ảnh đại diện" value={form.avatarUrl} onChange={(v) => setForm({ ...form, avatarUrl: v })} placeholder="https://..." required /><Input label="Tên đăng nhập" value={form.username} onChange={(v) => setForm({ ...form, username: v })} required /><Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required /><Input label="Số điện thoại" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required /><Input label="CCCD/CMND" value={form.citizenId} onChange={(v) => setForm({ ...form, citizenId: v })} required /><Input type="date" label="Ngày sinh" value={form.birthDate} onChange={(v) => setForm({ ...form, birthDate: v })} required /><Select label="Giới tính" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={['Nam', 'Nữ', 'Khác']} empty="Chọn giới tính" required /><Select label="Phòng ban" value={form.departmentId} onChange={(v) => setForm({ ...form, departmentId: v })} options={departments.map((d) => ({ value: d.id, label: d.name }))} empty="Chưa gán phòng ban" /><Input label="Chức danh" value={form.position} onChange={(v) => setForm({ ...form, position: v })} placeholder="Trưởng khoa, lễ tân..." /><Input label="Địa chỉ" value={form.address} onChange={(v) => setForm({ ...form, address: v })} /></div><button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-70">{busy && <LoadingIndicator size="sm" tone="white" />}{editingStaff ? 'Lưu thay đổi' : 'Tạo nhân sự'}</button></form></div>; }
function Pagination({ pagination, onPageChange }) { return <div className="flex items-center justify-between border-t border-slate-100 p-4"><p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p><div className="flex gap-2"><SmallButton disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>Trước</SmallButton><SmallButton disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>Sau</SmallButton></div></div>; }
function Info({ label, value, mono }) { return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`text-sm text-slate-700 ${mono ? 'font-mono' : 'font-bold'}`}>{value}</p></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong>{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${danger ? 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>{children}</button>; }
function Input({ label, value, onChange, required, placeholder, type = 'text' }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input type={type} required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} min={type === 'number' ? '0' : undefined} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" /></label>; }
function Select({ label, value, onChange, options, empty, required }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none">{empty && <option value="">{empty}</option>}{options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
