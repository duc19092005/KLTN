import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { Search, X } from 'lucide-react';
import AuditHistoryChanges from '../components/AuditHistoryChanges';

const DEPARTMENT_TYPES = [
  { value: 'EXAMINATION', label: 'Phòng khám' },
  { value: 'ADMINISTRATIVE', label: 'Hành chính / Lễ tân' },
  { value: 'LABORATORY', label: 'Xét nghiệm' },
  { value: 'IMAGING', label: 'Chẩn đoán hình ảnh' },
];

const emptyForm = { departmentCode: '', name: '', floor: '', status: 'ACTIVE', type: 'EXAMINATION', canReceiveOrders: false, description: '' };
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100', INACTIVE: 'bg-rose-50 text-rose-700 border-rose-100' };
const orderTone = { true: 'bg-cyan-50 text-cyan-700 border-cyan-100', false: 'bg-slate-50 text-slate-600 border-slate-100' };
const STATUS_LABELS = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngưng hoạt động', PENDING: 'Chờ kích hoạt' };
const MAX_DEPARTMENT_CODE_LENGTH = 10;
const MAX_DEPARTMENT_NAME_LENGTH = 50;
const MAX_DEPARTMENT_FLOOR_LENGTH = 3;
const MAX_DEPARTMENT_DESCRIPTION_LENGTH = 500;
function getTypeLabel(type) { return DEPARTMENT_TYPES.find((item) => item.value === type)?.label || type || 'Chưa phân loại'; }
function getStatusLabel(status) { return STATUS_LABELS[status] || status || 'Không rõ'; }
function canDepartmentReceiveOrders(type) { return ['LABORATORY', 'IMAGING'].includes(type); }
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
  const handleSelectDepartment = async (dept) => {
    setSelectedDepartment(dept);
    if (!dept) return;
    try {
      const res = await departmentService.verifyOne(dept.id);
      const verifyRes = res.data?.success !== undefined ? res.data.data : res.data;
      setSelectedDepartment((prev) => {
        if (prev?.id === dept.id) {
          return {
            ...prev,
            blockchainStatus: verifyRes.status,
            audit: verifyRes,
          };
        }
        return prev;
      });
    } catch (err) {
      console.error('Failed to verify department on blockchain:', err);
    }
  };
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingDeleteDepartment, setPendingDeleteDepartment] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const load = async (page = pagination.page) => {
    setLoading(true);
    try {
      const [depRes, staffRes] = await Promise.all([
        departmentService.list({ page, limit: pagination.limit }),
        staffService.search({ limit: 100 }),
      ]);
      const depData = depRes.data || {};
      setDepartments(getDepartmentItems(depData));
      if (!Array.isArray(depData)) {
        setPagination({
          page: depData.page,
          limit: depData.limit,
          total: depData.total,
          totalPages: depData.totalPages,
        });
      }
      setStaffs(getStaffItems(staffRes.data));
    } catch (err) { toast.error(getError(err, 'Không tải được phòng ban')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(1); }, []);

  const openCreate = () => { setEditingDepartment(null); setForm(emptyForm); setIsModalOpen(true); };
  const openEdit = (department) => {
    setEditingDepartment(department);
    setForm({
      departmentCode: department.departmentCode || '',
      name: department.name || '',
      floor: department.floor || '',
      status: department.status || 'ACTIVE',
      type: department.type || 'EXAMINATION',
      canReceiveOrders: Boolean(department.canReceiveOrders),
      description: department.description || '',
    });
    setIsModalOpen(true);
  };
  const closeModal = () => { setForm(emptyForm); setEditingDepartment(null); setIsModalOpen(false); };
  const submitDepartment = async (event) => {
    event.preventDefault();
    if (!form.departmentCode.trim() || !form.name.trim()) {
      toast.error('Vui lòng nhập đầy đủ mã và tên phòng ban.');
      return;
    }
    if (form.departmentCode.length > MAX_DEPARTMENT_CODE_LENGTH || form.name.length > MAX_DEPARTMENT_NAME_LENGTH || form.floor.length > MAX_DEPARTMENT_FLOOR_LENGTH || form.description.length > MAX_DEPARTMENT_DESCRIPTION_LENGTH) {
      toast.error('Thông tin phòng ban vượt quá giới hạn ký tự cho phép.');
      return;
    }
    const payload = {
      ...form,
      floor: form.floor || undefined,
      description: form.description || undefined,
      canReceiveOrders: canDepartmentReceiveOrders(form.type) && Boolean(form.canReceiveOrders),
    };
    setBusy(true);
    try {
      if (editingDepartment) {
        const res = await departmentService.update(editingDepartment.id, payload);
        if (selectedDepartment?.id === editingDepartment.id) setSelectedDepartment(res.data);
        toast.success('Cập nhật phòng ban thành công!');
      } else {
        await departmentService.create(payload);
        toast.success('Tạo phòng ban thành công!');
      }
      const wasEditing = Boolean(editingDepartment);
      closeModal(); await load(wasEditing ? pagination.page : 1);
    } catch (err) {
      toast.error(getError(err, editingDepartment ? 'Không cập nhật được phòng ban' : 'Không tạo được phòng ban'));
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
      await load(pagination.page);
    } catch (err) { toast.error(getError(err, 'Không gán được phụ trách')); }
    finally { setBusy(false); }
  };
  const hideDepartment = async (id) => {
    setBusy(true);
    try {
      await departmentService.update(id, { status: 'INACTIVE' });
      if (selectedDepartment?.id === id) setSelectedDepartment(null);
      toast.success('Đã ẩn phòng ban thành công!');
      await load(pagination.page);
    }
    catch (err) { toast.error(getError(err, 'Không ẩn được phòng ban')); }
    finally { setBusy(false); }
  };
  const restoreDepartment = async (id) => {
    setBusy(true);
    try {
      await departmentService.update(id, { status: 'ACTIVE' });
      toast.success('Đã hiện lại phòng ban thành công!');
      await load(pagination.page);
    }
    catch (err) { toast.error(getError(err, 'Không hiện lại được phòng ban')); }
    finally { setBusy(false); }
  };
  const confirmRemoveDepartment = (department) => {
    setPendingDeleteDepartment(department);
  };
  const removeDepartment = async () => {
    if (!pendingDeleteDepartment) return;
    const id = pendingDeleteDepartment.id;

    setBusy(true);
    try {
      await departmentService.remove(id);
      if (selectedDepartment?.id === id) setSelectedDepartment(null);
      toast.success('Xóa phòng ban thành công!');
      setPendingDeleteDepartment(null);
      await load(pagination.page);
    }
    catch (err) { toast.error(getError(err, 'Không xóa được phòng ban')); }
    finally { setBusy(false); }
  };

  const selectedStaffs = selectedDepartment ? staffs.filter((s) => s.departmentId === selectedDepartment.id) : [];

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="departments" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-5">
        <Hero onCreate={openCreate} onTrash={() => navigate('/admin/departments/trash')} />
        {loading ? <LoadingIndicator size="lg" label="Đang tải phòng ban..." /> : (
          <DepartmentDirectory departments={departments} staffs={staffs} busy={busy} selectedDepartment={selectedDepartment} onSelect={handleSelectDepartment} onAssignManager={assignManager} onEdit={openEdit} onHide={hideDepartment} onRestore={restoreDepartment} onDelete={confirmRemoveDepartment} pagination={pagination} onPageChange={load} />
        )}
        {selectedDepartment && (
          <DepartmentDetail
            department={selectedDepartment}
            staffs={selectedStaffs}
            onGoStaff={() => navigate('/admin/staff')}
            onClose={() => setSelectedDepartment(null)}
          />
        )}
        {isModalOpen && <DepartmentModal form={form} setForm={setForm} onSubmit={submitDepartment} onClose={closeModal} busy={busy} editing={Boolean(editingDepartment)} />}
        {pendingDeleteDepartment && (
          <DeleteDepartmentModal
            department={pendingDeleteDepartment}
            busy={busy}
            onCancel={() => setPendingDeleteDepartment(null)}
            onConfirm={removeDepartment}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function Hero({ onCreate, onTrash }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" title="Phòng ban đã xóa" onClick={onTrash} className="grid h-11 w-11 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600">
        <Trash2 size={18} />
      </button>
      <button
        onClick={onCreate}
        className="rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-cyan-700"
      >
        + Tạo phòng ban
      </button>
    </div>
  );
}

function DepartmentDirectory({ departments, staffs, busy, selectedDepartment, onSelect, onAssignManager, onEdit, onHide, onRestore, onDelete, pagination, onPageChange }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const visibleDepartments = departments.filter((dep) => {
    const keyword = search.trim().toLowerCase();
    const matchesKeyword = !keyword || [dep.name, dep.departmentCode, dep.manager?.fullName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(keyword));
    const matchesType = !typeFilter || dep.type === typeFilter;
    const matchesOrder = !orderFilter || String(Boolean(dep.canReceiveOrders)) === orderFilter;
    const matchesStatus = !statusFilter || dep.status === statusFilter;
    return matchesKeyword && matchesType && matchesOrder && matchesStatus;
  });

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Search className="h-4 w-4" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-sm font-black text-slate-800">Bộ lọc phòng ban</p>
              <p className="text-xs font-semibold text-slate-400">Tìm nhanh theo tên, loại, chỉ định và trạng thái hiển thị.</p>
            </div>
          </div>
          {(search || typeFilter || orderFilter || statusFilter) && (
            <button type="button" onClick={() => { setSearch(''); setTypeFilter(''); setOrderFilter(''); setStatusFilter(''); }} className="inline-flex w-fit items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 hover:bg-slate-50">
              <X className="h-3.5 w-3.5" /> Xóa lọc
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_150px] lg:items-end">
          <FilterInput label="Tên / Mã phòng ban" value={search} onChange={setSearch} placeholder="Nhập tên hoặc mã phòng ban..." />
          <FilterSelect label="Phân loại" value={typeFilter} onChange={setTypeFilter} options={DEPARTMENT_TYPES} empty="Tất cả phân loại" />
          <FilterSelect label="Chỉ định" value={orderFilter} onChange={setOrderFilter} options={[{ value: 'true', label: 'Nhận chỉ định' }, { value: 'false', label: 'Không nhận chỉ định' }]} empty="Tất cả" />
          <FilterSelect label="Ẩn / hiện" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ACTIVE', label: 'Đang hiện' }, { value: 'INACTIVE', label: 'Đã ẩn' }]} empty="Tất cả trạng thái" />
          <div className="space-y-1.5"><span className="block text-xs font-black text-transparent">Tìm kiếm</span><button type="button" className="inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-5 text-sm font-black text-white shadow-sm hover:bg-cyan-700 whitespace-nowrap">
            <Search className="h-4 w-4" strokeWidth={2.5} /> Tìm kiếm
          </button></div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">Danh sách phòng ban</h3>
          </div>
          <span className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">{visibleDepartments.length} / {pagination.total} phòng</span>
        </div>

        <div className="divide-y divide-slate-100">
          {visibleDepartments.map((dep) => {
            const depStaffs = staffs.filter((s) => s.departmentId === dep.id);
            const active = selectedDepartment?.id === dep.id;
            return (
              <article key={dep.id} className={`p-5 transition-colors hover:bg-slate-50/70 ${active ? 'bg-cyan-50/60' : 'bg-white'}`}>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr_0.55fr_0.55fr_0.8fr_300px] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-cyan-600">{dep.departmentCode}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${statusTone[dep.status] || statusTone.ACTIVE}`}>{getStatusLabel(dep.status)}</span>
                    </div>
                    <h4 className="mt-1 truncate text-base font-black text-slate-950">{dep.name}</h4>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-[10px] font-black text-cyan-700">{getTypeLabel(dep.type)}</span>
                      <span className={`rounded-md border px-2 py-0.5 text-[10px] font-black ${orderTone[String(Boolean(dep.canReceiveOrders))]}`}>{dep.canReceiveOrders ? 'Nhận chỉ định' : 'Không nhận chỉ định'}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-400">{dep.description || 'Chưa có mô tả'}</p>
                  </div>

                  <Info label="Phụ trách" value={dep.manager?.fullName || 'Chưa gán'} />
                  <Info label="Tầng" value={dep.floor || '—'} mono />
                  <Info label="Nhân sự" value={`${depStaffs.length} NV`} mono />
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">Trạng thái dữ liệu</p>
                    <BlockchainStatusBadge status={dep.blockchainStatus} size="xs" />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <select disabled={busy} value={dep.managerId || ''} onChange={(e) => onAssignManager(dep.id, e.target.value)} className="min-w-[150px] flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 xl:flex-none">
                      <option value="">Chọn phụ trách</option>
                      {depStaffs.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}
                    </select>
                    <SmallButton onClick={() => onSelect(dep)} disabled={busy}>Chi tiết</SmallButton>
                    <SmallButton onClick={() => onEdit(dep)} disabled={busy}>Sửa</SmallButton>
                    {dep.status === 'INACTIVE' ? (
                      <SmallButton onClick={() => onRestore(dep.id)} disabled={busy}>Hiện</SmallButton>
                    ) : (
                      <SmallButton onClick={() => onHide(dep.id)} disabled={busy}>Ẩn</SmallButton>
                    )}
                    <SmallButton danger onClick={() => onDelete(dep)} disabled={busy}>Xóa</SmallButton>
                  </div>
                </div>
              </article>
            );
          })}
          {!visibleDepartments.length && <div className="p-6"><Empty title="Không có phòng ban phù hợp" desc="Thử đổi bộ lọc hoặc tạo phòng ban mới." /></div>}
        </div>

        <Pagination pagination={pagination} onPageChange={onPageChange} />
      </section>
    </div>
  );
}

function FilterInput({ label, value, onChange, placeholder }) {
  return <label className="block space-y-1.5"><span className="text-xs font-black text-slate-600">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100" /></label>;
}
function FilterSelect({ label, value, onChange, options, empty }) {
  return <label className="block space-y-1.5"><span className="text-xs font-black text-slate-600">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-semibold outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-2 focus:ring-cyan-100">{empty && <option value="">{empty}</option>}{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>;
}

function DepartmentDetail({ department, staffs, onGoStaff, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  if (!department) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <aside className="flex max-h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-600">Chi tiết phòng ban</p>
            <h3 className="mt-1 text-2xl font-black text-slate-950">{department.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{department.departmentCode} · {department.description || 'Chưa có mô tả'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
        </div>

        <div className="shrink-0 px-6 py-2 border-b border-slate-100 flex gap-2">
          <button onClick={() => setActiveTab('info')} className={`px-4 py-2 text-xs font-black rounded-xl border transition-colors ${activeTab === 'info' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Hồ sơ & Xác thực blockchain
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-xs font-black rounded-xl border transition-colors ${activeTab === 'history' ? 'bg-cyan-600 text-white border-cyan-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Lịch sử cập nhật
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/60 p-6">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${statusTone[department.status] || statusTone.ACTIVE}`}>{getStatusLabel(department.status)}</span>
                    <BlockchainStatusBadge status={department.blockchainStatus} prefix="Blockchain: " />
                  </div>
                  <span className="text-[11px] font-black uppercase text-cyan-700 tracking-wider">Xác thực bằng hợp đồng thông minh Solidity</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Thông tin phòng ban</h4>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Info label="Mã phòng ban" value={department.departmentCode} mono />
                    <Info label="Tên phòng ban" value={department.name} />
                    <Info label="Phân loại" value={getTypeLabel(department.type)} />
                    <Info label="Tầng" value={department.floor || 'Chưa gán'} mono />
                    <Info label="Nhận chỉ định" value={department.canReceiveOrders ? 'Có' : 'Không'} />
                    <Info label="Trạng thái" value={getStatusLabel(department.status)} />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-700">Nhân sự & phụ trách</h4>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Info label="Phụ trách" value={department.manager?.fullName || 'Chưa gán'} />
                    <Info label="Số nhân sự" value={`${staffs.length} NV`} mono />
                  </div>
                  <div className="mt-4 space-y-2">
                    {staffs.map((staff) => (
                      <div key={staff.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                        <strong className="block text-sm text-slate-950">{staff.fullName}</strong>
                        <span className="text-xs font-semibold text-slate-500">{staff.employeeCode}</span>
                      </div>
                    ))}
                    {!staffs.length && <Empty title="Chưa có nhân sự" desc="Phòng ban này chưa được gán nhân sự." />}
                  </div>
                </section>
              </div>
            </div>
          ) : (
            <DepartmentHistory departmentId={department.id} />
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/70 p-5">
          <button onClick={onGoStaff} className="w-full rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700 hover:bg-cyan-100">Đi tới quản lý nhân sự</button>
        </div>
      </aside>
    </div>
  );
}

// Audit history for one department. Pulls the BlockchainLogger entries for this entityId and
// renders them newest-first with a colored action chip + an "on-chain" indicator. The list
// re-fetches whenever the selected department changes (keyed by departmentId).
function DepartmentHistory({ departmentId }) {
  const [logs, setLogs] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    departmentService.historyOne(departmentId)
      .then((res) => {
        if (!alive) return;
        const payload = res.data?.data ?? res.data;
        setLogs(Array.isArray(payload) ? payload : (payload?.items || []));
      })
      .catch((err) => alive && setError(err.response?.data?.message || 'Không tải được lịch sử.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [departmentId]);

  const actionLabel = {
    CREATE: { label: 'Tạo mới', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    UPDATE: { label: 'Cập nhật', cls: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    DELETE: { label: 'Xóa', cls: 'bg-rose-50 text-rose-700 border-rose-100' },
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black text-slate-700">Lịch sử sửa đổi</h4>
        <span className="text-[11px] font-bold text-slate-400">{logs.length} bản ghi</span>
      </div>
      {loading && <p className="text-xs font-bold text-slate-400">Đang tải...</p>}
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      {!loading && !error && logs.length === 0 && <Empty title="Chưa có lịch sử" desc="Chưa có thay đổi nào được ghi nhận." />}
      {!loading && !error && logs.length > 0 && (
        <ol className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {logs.map((log) => {
            const meta = actionLabel[log.action] || { label: log.action, cls: 'bg-slate-50 text-slate-700 border-slate-100' };
            return (
              <li key={log.id || log.seq} className="rounded-2xl border border-slate-100 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-black ${meta.cls}`}>{meta.label}</span>
                  <span className="text-[10px] font-bold text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : ''}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {log.actor?.username || log.actor?.email || log.actorId || 'Hệ thống'}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${log.batchId ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                    {log.batchId ? 'Đã neo on-chain' : 'Đang chờ neo'}
                  </span>
                  {log.dataHash && <span className="text-[10px] font-mono text-slate-400 truncate">{log.dataHash.slice(0, 16)}…</span>}
                </div>
                <div className="mt-2">
                  <AuditHistoryChanges log={log} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
function DeleteDepartmentModal({ department, busy, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 p-4" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 p-6">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Xác nhận</p>
          <h3 className="mt-2 text-lg font-black text-slate-900">Xóa phòng ban?</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Phòng ban sẽ được chuyển sang trạng thái DELETE và không còn hiển thị trong danh sách.
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm font-black text-slate-900">{department.name}</p>
            <p className="mt-1 font-mono text-xs font-bold text-slate-500">{department.departmentCode}</p>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Hủy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {busy ? 'Đang xóa...' : 'Xóa'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DepartmentModal({ form, setForm, onSubmit, onClose, busy, editing }) {
  const canReceiveOrders = canDepartmentReceiveOrders(form.type);
  const [fieldErrors, setFieldErrors] = useState({});

  const getFieldError = (field) => {
    const value = form[field] || '';
    if (field === 'departmentCode') {
      if (!value.trim()) return 'Vui lòng nhập mã phòng ban.';
      if (value.length < 2) return 'Mã phòng ban phải có ít nhất 2 ký tự.';
      if (value.length > MAX_DEPARTMENT_CODE_LENGTH) return `Mã phòng ban không được vượt quá ${MAX_DEPARTMENT_CODE_LENGTH} ký tự.`;
      if (!/^[A-Z0-9-]+$/.test(value)) return 'Mã phòng ban chỉ gồm chữ hoa không dấu, số và dấu gạch ngang.';
    }
    if (field === 'name') {
      if (!value.trim()) return 'Vui lòng nhập tên phòng ban.';
      if (value.trim().length < 2) return 'Tên phòng ban phải có ít nhất 2 ký tự.';
      if (value.length > MAX_DEPARTMENT_NAME_LENGTH) return `Tên phòng ban không được vượt quá ${MAX_DEPARTMENT_NAME_LENGTH} ký tự.`;
      if (!/^[\p{L}]+(?:\s+[\p{L}]+)*(?:\s+\d+)?$/u.test(value.trim())) return 'Tên phòng ban phải bắt đầu bằng chữ; số chỉ được đặt ở cuối, ví dụ: Tổng quát 1.';
    }
    if (field === 'floor') {
      if (!value.trim()) return 'Vui lòng nhập tầng.';
      if (!/^[A-Z0-9]{1,3}$/.test(value)) return `Tầng chỉ gồm chữ không dấu và số, tối đa ${MAX_DEPARTMENT_FLOOR_LENGTH} ký tự. VD: 2A, 2B.`;
    }
    if (field === 'description' && value.length > MAX_DEPARTMENT_DESCRIPTION_LENGTH) {
      return `Mô tả không được vượt quá ${MAX_DEPARTMENT_DESCRIPTION_LENGTH} ký tự.`;
    }
    return '';
  };

  const validateField = (field) => {
    const error = getFieldError(field);
    setFieldErrors((current) => ({ ...current, [field]: error }));
    return !error;
  };

  const validateFormBeforeSubmit = () => {
    const fields = ['departmentCode', 'name', 'floor', 'description'];
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <form onSubmit={handleSubmit} noValidate className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-black text-slate-950">{editing ? 'Cập nhật phòng ban' : 'Tạo phòng ban'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-black text-slate-500">Đóng</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Mã phòng ban"
            value={form.departmentCode}
            onChange={(v) => setForm({ ...form, departmentCode: v.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, MAX_DEPARTMENT_CODE_LENGTH) })}
            onBlur={() => validateField('departmentCode')}
            error={fieldErrors.departmentCode}
            placeholder="PB-XRAY"
            required
            minLength={2}
            maxLength={MAX_DEPARTMENT_CODE_LENGTH}
            pattern="[A-Z0-9-]+"
          />
          <Input
            label="Tên phòng ban"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v.replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').slice(0, MAX_DEPARTMENT_NAME_LENGTH) })}
            onBlur={() => validateField('name')}
            error={fieldErrors.name}
            placeholder="X Ray, MRI, Lễ tân..."
            required
            minLength={2}
            maxLength={MAX_DEPARTMENT_NAME_LENGTH}
          />
          <Input
            label="Tầng"
            value={form.floor}
            onChange={(v) => setForm({ ...form, floor: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_DEPARTMENT_FLOOR_LENGTH) })}
            onBlur={() => validateField('floor')}
            error={fieldErrors.floor}
            placeholder="VD: 2A"
            required
            maxLength={MAX_DEPARTMENT_FLOOR_LENGTH}
            pattern="[A-Z0-9]{1,3}"
            hint={`Tối đa ${MAX_DEPARTMENT_FLOOR_LENGTH} ký tự, ví dụ 2A hoặc 2B.`}
          />
          <Select label="Loại phòng ban" value={form.type} onChange={(v) => setForm({ ...form, type: v, canReceiveOrders: canDepartmentReceiveOrders(v) ? form.canReceiveOrders : false })} options={DEPARTMENT_TYPES} />
          {canReceiveOrders && <label className="rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 flex items-start gap-3"><input type="checkbox" checked={Boolean(form.canReceiveOrders)} onChange={(e) => setForm({ ...form, canReceiveOrders: e.target.checked })} className="mt-1 h-4 w-4" /><span><strong className="block text-sm text-cyan-800">Nhận phiếu chỉ định</strong><small className="mt-1 block text-xs font-semibold text-cyan-600">Bật cho Xét nghiệm, X-Ray, MRI, Siêu âm để hiện trong biểu mẫu bác sĩ.</small></span></label>}
        </div>
        <Textarea label="Mô tả nhiệm vụ" value={form.description} onChange={(v) => setForm({ ...form, description: v.slice(0, MAX_DEPARTMENT_DESCRIPTION_LENGTH) })} onBlur={() => validateField('description')} error={fieldErrors.description} placeholder="Mô tả chức năng phòng ban" maxLength={MAX_DEPARTMENT_DESCRIPTION_LENGTH} />
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-70">{busy && <LoadingIndicator size="sm" tone="white" />}{editing ? 'Lưu thay đổi' : 'Tạo phòng ban'}</button>
      </form>
    </div>
  );
}
function Info({ label, value, mono }) { return <div><p className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-1 truncate text-sm font-black text-slate-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p></div>; }
function InfoBox({ label, value }) { return <div className="rounded-xl bg-white border border-slate-100 p-3"><p className="text-[11px] uppercase tracking-wider font-black text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>; }
function MiniMetric({ label, value }) { return <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"><p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 text-sm font-black text-slate-800">{value}</p></div>; }
function Alert({ children }) { return <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-700">{children}</div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong>{title}</strong><p className="mt-1 text-sm text-slate-500">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-50 ${danger ? 'border-rose-100 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-cyan-50 hover:text-cyan-600'}`}>{children}</button>; }
function Input({ label, value, onChange, onBlur, error, required, placeholder, type = 'text', min, max, minLength, maxLength, pattern, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-bold text-slate-700">{label}</span>
      <input type={type} required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} min={min} max={max} minLength={minLength} maxLength={maxLength} pattern={pattern} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} />
      <p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || hint || 'Không có lỗi'}</p>
    </label>
  );
}
function Select({ label, value, onChange, options }) { return <label className="block space-y-1.5"><span className="text-[13px] font-bold text-slate-700">{label}</span><select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 outline-none">{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>; }
function Textarea({ label, value, onChange, onBlur, error, placeholder, maxLength, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-bold text-slate-700">{label}</span>
      <textarea rows={4} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-sm focus:bg-white focus:ring-2 outline-none ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} />
      <p className={`min-h-[16px] text-xs font-semibold leading-4 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || hint || 'Không có lỗi'}</p>
    </label>
  );
}
function Pagination({ pagination, onPageChange }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-100 p-4">
      <p className="text-sm font-semibold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pagination.page <= 1}
          onClick={() => onPageChange(pagination.page - 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50"
        >
          Trước
        </button>
        <button
          type="button"
          disabled={pagination.page >= pagination.totalPages}
          onClick={() => onPageChange(pagination.page + 1)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-cyan-50 hover:text-cyan-600 disabled:opacity-50"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
