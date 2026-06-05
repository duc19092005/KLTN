import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import { FaceStepUpModal } from '../../auth';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';

const DEPARTMENT_TYPES = [
  { value: 'ADMINISTRATIVE', label: 'Hành chính / Lễ tân' },
  { value: 'CLINICAL', label: 'Lâm sàng / Khoa khám' },
  { value: 'LABORATORY', label: 'Xét nghiệm' },
  { value: 'IMAGING', label: 'Chẩn đoán hình ảnh' },
  { value: 'PHARMACY', label: 'Nhà thuốc' },
  { value: 'OTHER', label: 'Khác' },
];

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

const LAB_TEST_TYPES = [
  'Xét nghiệm Máu (Công thức máu, Sinh hóa, Đông máu)',
  'Xét nghiệm Nước tiểu',
  'Xét nghiệm Phân',
  'Xét nghiệm Vi sinh (Nuôi cấy, Soi tươi)',
  'Xét nghiệm Sinh học phân tử (PCR, ADN)',
  'Giải phẫu bệnh & Tế bào học',
  'Xét nghiệm Miễn dịch & Dị ứng'
];

const emptyForm = { departmentCode: '', name: '', floor: '', status: 'ACTIVE', type: 'CLINICAL', canReceiveOrders: false, description: '', specialty: '' };
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100', INACTIVE: 'bg-red-50 text-red-700 border-red-100' };
const orderTone = { true: 'bg-purple-50 text-purple-700 border-purple-100', false: 'bg-slate-50 text-slate-600 border-slate-100' };
const USER_ROLE_LABELS = { ADMIN: 'Quản trị viên', RECEPTIONIST: 'Lễ tân', DOCTOR: 'Bác sĩ', LAB_MANAGER: 'Quản lý xét nghiệm', DEPT_SHARED: 'Tài khoản phòng máy' };
const STATUS_LABELS = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động', PENDING: 'Chờ kích hoạt' };
function getTypeLabel(type) { return DEPARTMENT_TYPES.find((item) => item.value === type)?.label || type || 'Chưa phân loại'; }
function getStatusLabel(status) { return STATUS_LABELS[status] || status || 'Không rõ'; }
function getRoleLabel(role) { return USER_ROLE_LABELS[role] || role || 'Không rõ'; }
function getDepartmentItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getStaffItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getError(err, fallback) { return err?.response?.data?.message || err.message || fallback; }

export default function DepartmentsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [departments, setDepartments] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null); // department awaiting face step-up
  const [pendingSave, setPendingSave] = useState(null); // { payload, mode: 'create' | 'edit', id?: string }

  const load = async () => {
    setLoading(true);
    try {
      const [depRes, staffRes] = await Promise.all([
        departmentService.list({ limit: 100 }),
        staffService.search({ limit: 100 }),
      ]);
      setDepartments(getDepartmentItems(depRes.data));
      setStaffs(getStaffItems(staffRes.data));
    } catch (err) { toast.error(getError(err, 'Không tải được phòng ban')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditingDepartment(null); setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (department) => {
    setEditingDepartment(department);
    setForm({
      departmentCode: department.departmentCode || '',
      name: department.name || '',
      floor: department.floor || '',
      status: department.status || 'ACTIVE',
      type: department.type || 'CLINICAL',
      canReceiveOrders: Boolean(department.canReceiveOrders),
      description: department.description || '',
      specialty: department.specialty || '',
    });
    setIsModalOpen(true);
  };
  const closeModal = () => { setForm(emptyForm); setEditingDepartment(null); setIsModalOpen(false); };
  const submitDepartment = async (event) => {
    event.preventDefault(); if (!form.departmentCode.trim() || !form.name.trim()) return;
    const payload = {
      ...form,
      floor: form.floor || undefined,
      description: form.description || undefined,
      canReceiveOrders: Boolean(form.canReceiveOrders),
      specialty: (form.type === 'CLINICAL' || form.type === 'LABORATORY') ? (form.specialty || undefined) : undefined,
    };
    setPendingSave({
      payload,
      mode: editingDepartment ? 'edit' : 'create',
      id: editingDepartment?.id,
    });
  };

  const handleSaveStepUp = async (ticket) => {
    const { payload, mode, id } = pendingSave || {};
    setPendingSave(null);
    if (!payload) return;
    setBusy(true);
    try {
      if (mode === 'edit') {
        const res = await departmentService.update(id, payload, ticket);
        if (selectedDepartment?.id === id) setSelectedDepartment(res.data);
        toast.success('Cập nhật phòng ban thành công!');
      } else {
        await departmentService.create(payload, ticket);
        toast.success('Tạo phòng ban thành công!');
      }
      closeModal(); await load();
    } catch (err) {
      toast.error(getError(err, mode === 'edit' ? 'Không cập nhật được phòng ban' : 'Không tạo được phòng ban'));
    } finally {
      setBusy(false);
    }
  };
  const assignManager = async (departmentId, managerId) => {
    setBusy(true);
    try {
      const res = await departmentService.assignManager(departmentId, managerId || undefined);
      if (selectedDepartment?.id === departmentId) setSelectedDepartment(res.data);
      toast.success('Gán phụ trách thành công!');
      await load();
    } catch (err) { toast.error(getError(err, 'Không gán được phụ trách')); }
    finally { setBusy(false); }
  };
  // Deleting a department is irreversible -> require a fresh face scan. Open the step-up modal
  // for the chosen department; the actual delete runs in handleDeleteStepUp once a ticket exists.
  const removeDepartment = (id) => {
    const dep = departments.find((d) => d.id === id) || { id };
    setPendingDelete(dep);
  };
  const handleDeleteStepUp = async (ticket) => {
    const id = pendingDelete?.id;
    setPendingDelete(null);
    if (!id) return;
    setBusy(true);
    try {
      await departmentService.remove(id, ticket);
      if (selectedDepartment?.id === id) setSelectedDepartment(null);
      toast.success('Xóa phòng ban thành công!');
      await load();
    }
    catch (err) { toast.error(getError(err, 'Không xóa được phòng ban')); }
    finally { setBusy(false); }
  };

  const selectedStaffs = selectedDepartment ? staffs.filter((s) => s.departmentId === selectedDepartment.id) : [];

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="departments" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-6">
        <Hero onCreate={openCreate} />
        {loading ? <LoadingIndicator size="lg" label="Đang tải phòng ban..." /> : (
          <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6 items-start">
            <DepartmentDirectory departments={departments} staffs={staffs} busy={busy} selectedDepartment={selectedDepartment} onSelect={setSelectedDepartment} onAssignManager={assignManager} onEdit={openEdit} onDelete={removeDepartment} />
            <DepartmentDetail department={selectedDepartment} staffs={selectedStaffs} onGoStaff={() => navigate('/admin/staff')} />
          </section>
        )}
        {isModalOpen && <DepartmentModal form={form} setForm={setForm} onSubmit={submitDepartment} onClose={closeModal} busy={busy} editing={Boolean(editingDepartment)} />}
        {pendingDelete && (
          <FaceStepUpModal
            action="DELETE_DEPARTMENT"
            resourceId={pendingDelete.id}
            title="Xác nhận xóa phòng ban"
            description={`Xóa phòng ban "${pendingDelete.name || pendingDelete.id}" là thao tác không thể hoàn tác. Vui lòng quét khuôn mặt để xác nhận chính bạn thực hiện.`}
            onSuccess={handleDeleteStepUp}
            onClose={() => setPendingDelete(null)}
          />
        )}
        {pendingSave && (
          <FaceStepUpModal
            action={pendingSave.mode === 'edit' ? 'UPDATE_DEPARTMENT' : 'CREATE_DEPARTMENT'}
            resourceId={pendingSave.id}
            title={pendingSave.mode === 'edit' ? 'Xác thực cập nhật phòng ban' : 'Xác thực tạo phòng ban'}
            description={
              pendingSave.mode === 'edit'
                ? `Cập nhật thông tin phòng ban "${pendingSave.payload.name}" yêu cầu xác thực khuôn mặt để xác nhận chính bạn thực hiện.`
                : `Tạo phòng ban mới "${pendingSave.payload.name}" yêu cầu xác thực khuôn mặt để xác nhận chính bạn thực hiện.`
            }
            onSuccess={handleSaveStepUp}
            onClose={() => setPendingSave(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function Hero({ onCreate }) { return <section className="rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-8 shadow-sm flex flex-col lg:flex-row lg:items-end justify-between gap-5"><div><p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.24em] mb-3">Hệ thống phòng ban</p><h2 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight">Quản lý phòng ban</h2><p className="mt-3 max-w-3xl text-sm sm:text-base text-slate-600 leading-relaxed">Quản lý mã phòng ban, tầng, trạng thái, phụ trách và nhân sự trực thuộc.</p></div><div className="flex flex-wrap gap-3"><button onClick={onCreate} className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700">+ Tạo phòng ban</button></div></section>; }
function DepartmentDirectory({ departments, staffs, busy, selectedDepartment, onSelect, onAssignManager, onEdit, onDelete }) { return <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between"><div><h3 className="text-xl font-black text-slate-950">Tất cả phòng ban</h3><p className="text-sm text-slate-500">Quản lý phân loại, quyền nhận chỉ định, tầng hoạt động và phụ trách.</p></div><span className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">{departments.length} phòng</span></div><div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{departments.map((dep) => { const depStaffs = staffs.filter((s) => s.departmentId === dep.id); const active = selectedDepartment?.id === dep.id; return <article key={dep.id} onClick={() => onSelect(dep)} className={`cursor-pointer rounded-2xl border p-5 transition-all ${active ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-100 bg-slate-50/70 hover:bg-white hover:shadow-sm'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-black uppercase tracking-wider text-blue-600">{dep.departmentCode}</p><h4 className="font-black text-slate-950">{dep.name}</h4><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-black text-blue-700">{getTypeLabel(dep.type)}</span>{dep.specialty && <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">{dep.specialty}</span>}<span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${orderTone[String(Boolean(dep.canReceiveOrders))]}`}>{dep.canReceiveOrders ? 'Nhận chỉ định' : 'Không nhận chỉ định'}</span></div><p className="mt-2 text-sm text-slate-500">{dep.description || 'Chưa có mô tả'}</p></div><span className={`rounded-xl border px-3 py-1 text-xs font-black ${statusTone[dep.status] || statusTone.ACTIVE}`}>{getStatusLabel(dep.status)}</span></div><div className="mt-4 grid grid-cols-2 gap-3"><InfoBox label="Tầng" value={dep.floor || 'Chưa gán'} /><InfoBox label="Nhân sự" value={`${depStaffs.length} NV`} /></div><div className="mt-4 rounded-xl bg-white border border-slate-100 p-3"><p className="text-[11px] uppercase tracking-wider font-black text-slate-400">Phụ trách</p><p className="mt-1 text-sm font-bold text-slate-800">{dep.manager?.fullName || 'Chưa gán'}</p></div><div className="mt-4 flex gap-2" onClick={(e) => e.stopPropagation()}><select disabled={busy} value={dep.managerId || ''} onChange={(e) => onAssignManager(dep.id, e.target.value)} className="min-w-0 flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100"><option value="">Chọn phụ trách</option>{depStaffs.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}</select><SmallButton onClick={() => onEdit(dep)} disabled={busy}>Sửa</SmallButton><SmallButton danger onClick={() => onDelete(dep.id)} disabled={busy}>Xóa</SmallButton></div></article>; })}{!departments.length && <Empty title="Chưa có phòng ban" desc="Bấm nút Tạo phòng ban để bắt đầu." />}</div></section>; }
function DepartmentDetail({ department, staffs, onGoStaff }) { return <aside className="xl:sticky xl:top-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"><p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.18em]">Chi tiết phòng ban</p>{!department ? <Empty title="Chọn một phòng ban" desc="Bấm vào thẻ phòng ban để xem nhân sự thuộc phòng đó." /> : <><div className="mt-2 flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-blue-600">{department.departmentCode}</p><h3 className="text-2xl font-black text-slate-950">{department.name}</h3><p className="mt-1 text-sm text-slate-500">{department.description || 'Chưa có mô tả'}</p></div><span className={`rounded-xl border px-3 py-1 text-xs font-black ${statusTone[department.status] || statusTone.ACTIVE}`}>{getStatusLabel(department.status)}</span></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{getTypeLabel(department.type)}</span>{department.specialty && <span className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-700">{department.specialty}</span>}<span className={`rounded-xl border px-3 py-1.5 text-xs font-black ${orderTone[String(Boolean(department.canReceiveOrders))]}`}>{department.canReceiveOrders ? 'Có thể nhận phiếu chỉ định' : 'Không nhận phiếu chỉ định'}</span></div>{department.sharedUser && <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/60 p-3"><p className="text-[11px] uppercase tracking-wider font-black text-cyan-600">Tài khoản chung</p><p className="mt-1 text-sm font-bold text-cyan-800 font-mono">{department.sharedUser.username}</p><p className="text-[10px] font-semibold text-cyan-600 mt-0.5">Vai trò: {getRoleLabel(department.sharedUser.role)} · Trạng thái: {getStatusLabel(department.sharedUser.status)}</p></div>}<div className="mt-5 grid grid-cols-2 gap-3"><InfoBox label="Tầng" value={department.floor || 'Chưa gán'} /><InfoBox label="Nhân sự" value={`${staffs.length} NV`} /></div><div className="mt-5 space-y-3"><h4 className="text-sm font-black text-slate-700">Nhân sự trong phòng ban</h4>{staffs.map((staff) => <div key={staff.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><strong className="block text-slate-950">{staff.fullName}</strong><span className="mt-1 block text-xs text-slate-500">{staff.employeeCode}</span></div>)}{!staffs.length && <Empty title="Chưa có nhân sự" desc="Phòng ban này chưa được gán nhân sự." />}</div><button onClick={onGoStaff} className="mt-5 w-full rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 hover:bg-blue-100">Đi tới quản lý nhân sự</button></>}</aside>; }
function DepartmentModal({ form, setForm, onSubmit, onClose, busy, editing }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl space-y-4"><div className="flex items-start justify-between"><div><p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.18em]">Thiết lập phòng ban</p><h3 className="text-2xl font-black text-slate-950">{editing ? 'Cập nhật phòng ban' : 'Tạo phòng ban'}</h3><p className="text-sm text-slate-500">Khai báo mã, phân loại, quyền nhận chỉ định và nhiệm vụ.</p></div><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button></div>{!editing && <div className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4"><p className="text-sm font-bold text-cyan-800">Hệ thống sẽ tự động tạo tài khoản dùng chung cho phòng ban này.</p><p className="text-xs font-semibold text-cyan-600 mt-1">Tên đăng nhập: dept_&lt;mã phòng ban&gt; · Mật khẩu mặc định: 123456</p></div>}<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Input label="Mã phòng ban" value={form.departmentCode} onChange={(v) => setForm({ ...form, departmentCode: v })} placeholder="PB-XRAY" required /><Input label="Tên phòng ban" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="X-Ray, MRI, Lễ tân..." required /><Input label="Tầng" value={form.floor} onChange={(v) => setForm({ ...form, floor: v })} placeholder="VD: 2" /><Select label="Trạng thái" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={[{ value: 'ACTIVE', label: 'Đang hoạt động' }, { value: 'INACTIVE', label: 'Ngưng hoạt động' }]} /><Select label="Loại phòng ban" value={form.type} onChange={(v) => setForm({ ...form, type: v, specialty: (v === 'CLINICAL' || v === 'LABORATORY') ? form.specialty : '' })} options={DEPARTMENT_TYPES} />{form.type === 'CLINICAL' && <Select label="Chuyên khoa" value={form.specialty} onChange={(v) => setForm({ ...form, specialty: v })} options={[{ value: '', label: 'Chọn chuyên khoa' }, ...SPECIALTIES.map(s => ({ value: s, label: s }))]} required />}{form.type === 'LABORATORY' && <Select label="Loại xét nghiệm" value={form.specialty} onChange={(v) => setForm({ ...form, specialty: v })} options={[{ value: '', label: 'Chọn loại xét nghiệm' }, ...LAB_TEST_TYPES.map(l => ({ value: l, label: l }))]} required />}<label className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4 flex items-start gap-3"><input type="checkbox" checked={Boolean(form.canReceiveOrders)} onChange={(e) => setForm({ ...form, canReceiveOrders: e.target.checked })} className="mt-1 h-4 w-4" /><span><strong className="block text-sm text-purple-800">Nhận phiếu chỉ định</strong><small className="mt-1 block text-xs font-semibold text-purple-600">Bật cho Xét nghiệm, X-Ray, MRI, Siêu âm để hiện trong biểu mẫu bác sĩ.</small></span></label></div><Textarea label="Mô tả nhiệm vụ" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Mô tả chức năng phòng ban" /><button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-100 hover:bg-blue-700 disabled:opacity-70">{busy && <LoadingIndicator size="sm" tone="white" />}{editing ? 'Lưu thay đổi' : 'Tạo phòng ban'}</button></form></div>; }
function InfoBox({ label, value }) { return <div className="rounded-xl bg-white border border-slate-100 p-3"><p className="text-[11px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>; }
function Alert({ children }) { return <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">{children}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong>{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${danger ? 'border-red-100 bg-red-50 text-red-600 hover:bg-red-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-600'}`}>{children}</button>; }
function Input({ label, value, onChange, required, placeholder }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><input required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" /></label>; }
function Select({ label, value, onChange, options }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none">{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
function Textarea({ label, value, onChange, placeholder }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><textarea rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none" /></label>; }
