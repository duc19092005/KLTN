import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import BlockchainStatusBadge from '../../../shared/components/BlockchainStatusBadge';
import { useAuth } from '../../../providers/AuthProvider';
import { departmentService } from '../apis/departmentService';
import { staffService } from '../apis/staffService';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { useToast } from '../../../providers/ToastProvider';
import { Search, Trash2, X, Plus, Building2, Layers, Filter, CheckCircle2, ShieldCheck, CheckSquare, Square, Sparkles, Eye, EyeOff, Pencil, Activity, UserCheck, AlertTriangle } from 'lucide-react';
import AuditHistoryChanges from '../components/AuditHistoryChanges';

const DEPARTMENT_TYPES = [
  { value: 'EXAMINATION', label: 'Phòng khám' },
  { value: 'CLINICAL', label: 'Khoa lâm sàng' },
  { value: 'ADMINISTRATIVE', label: 'Hành chính / Lễ tân' },
  { value: 'LABORATORY', label: 'Xét nghiệm' },
  { value: 'IMAGING', label: 'Chẩn đoán hình ảnh' },
  { value: 'PHARMACY', label: 'Nhà thuốc' },
  { value: 'OTHER', label: 'Khác' },
];

const emptyForm = { departmentCode: '', name: '', floor: '', status: 'ACTIVE', type: 'EXAMINATION', canReceiveOrders: false, description: '' };
const statusTone = { ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200/80', INACTIVE: 'bg-amber-50 text-amber-700 border-amber-200/80' };
const orderTone = { true: 'bg-sky-50 text-sky-700 border-sky-200/80', false: 'bg-slate-50 text-slate-600 border-slate-200/80' };
const STATUS_LABELS = { ACTIVE: 'Đang hoạt động', INACTIVE: 'Đã ẩn', PENDING: 'Chờ kích hoạt' };
const BLOCKCHAIN_TONE = {
  VERIFIED: { label: 'Xác thực khớp với blockchain', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  TAMPERED: { label: 'CẢNH BÁO: Dữ liệu đã bị sửa đổi!', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
  PENDING_ANCHOR: { label: 'Đang chờ neo on-chain', cls: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  UNANCHORED: { label: 'Chưa được neo trên blockchain', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  VERIFICATION_UNAVAILABLE: { label: 'Tạm thời chưa xác minh được blockchain', cls: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
};
const MAX_DEPARTMENT_CODE_LENGTH = 10;
const MAX_DEPARTMENT_NAME_LENGTH = 50;
const MAX_DEPARTMENT_FLOOR_LENGTH = 3;
const MAX_DEPARTMENT_DESCRIPTION_LENGTH = 500;

function normalizeDepartmentNameInput(value) {
  return value
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/(?<![\p{L}\p{N}])-|-(?![\p{L}\p{N}])/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_DEPARTMENT_NAME_LENGTH);
}
function getTypeLabel(type) { return DEPARTMENT_TYPES.find((item) => item.value === type)?.label || type || 'Chưa phân loại'; }
function getStatusLabel(status) { return STATUS_LABELS[status] || status || 'Không rõ'; }
function canDepartmentReceiveOrders(type) { return ['LABORATORY', 'IMAGING'].includes(type); }
function departmentHasBusinessRefs(department, staffs = []) {
  if (!department?.id) return false;
  const staffCount = staffs.filter((s) => s.departmentId === department.id).length;
  const count = department._count || {};
  return staffCount > 0
    || Number(count.staffs || 0) > 0
    || Number(count.visits || 0) > 0
    || Number(count.medicalOrders || 0) > 0
    || Number(count.appointments || 0) > 0;
}
function getDepartmentItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getStaffItems(data) { return Array.isArray(data) ? data : data?.items || []; }
function getError(err, fallback) { return err?.response?.data?.message || err.message || fallback; }
function shortHash(hash) {
  if (!hash) return '—';
  const clean = hash.startsWith('0x') ? hash.slice(2) : hash;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

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
  const [selectedIds, setSelectedIds] = useState([]);

  const load = async (page = pagination.page) => {
    setLoading(true);
    setSelectedIds([]);
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
    const structuralLocked = Boolean(editingDepartment) && departmentHasBusinessRefs(editingDepartment, staffs);
    const payload = structuralLocked
      ? {
          name: form.name,
          floor: form.floor || undefined,
          status: form.status,
          description: form.description || undefined,
        }
      : {
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

  const handleBulkSoftDelete = async (ids) => {
    if (!ids || ids.length === 0) return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa tạm thời ${ids.length} phòng ban đã chọn vào thùng rác?`)) return;
    setBusy(true);
    try {
      const res = await departmentService.softDeleteMany(ids);
      const data = res.data;
      if (data?.failed > 0) {
        toast.warning(`Thành công: ${data.succeeded}/${data.requested}. Thất bại: ${data.failed}.`);
      } else {
        toast.success(`Đã chuyển ${data.succeeded} phòng ban vào thùng rác!`);
      }
      setSelectedIds([]);
      await load(pagination.page);
    } catch (err) {
      toast.error(getError(err, 'Không thể xóa hàng loạt phòng ban'));
    } finally {
      setBusy(false);
    }
  };

  const selectedStaffs = selectedDepartment ? staffs.filter((s) => s.departmentId === selectedDepartment.id) : [];

  const stats = React.useMemo(() => [
    { label: 'Tổng số phòng ban', value: pagination.total, icon: Building2, tone: 'bg-sky-50 text-sky-600 border-sky-100' },
    { label: 'Phòng khám & Lâm sàng', value: departments.filter((d) => d.type === 'EXAMINATION' || d.type === 'CLINICAL').length, icon: Activity, tone: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
    { label: 'Đã gán phụ trách', value: departments.filter((d) => d.managerId).length, icon: UserCheck, tone: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { label: 'Đã xác thực', value: departments.filter((d) => d.blockchainStatus === 'VERIFIED' || d.blockchainStatus === 'ANCHORED').length, icon: ShieldCheck, tone: 'bg-amber-50 text-amber-600 border-amber-100' },
  ], [departments, pagination.total]);

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="departments" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-7 pb-12 animate-in fade-in duration-300">
        <Hero onCreate={openCreate} onTrash={() => navigate('/admin/departments/trash')} total={pagination.total} />

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

        {loading ? <LoadingIndicator size="lg" label="Đang tải danh sách phòng ban..." /> : (
          <DepartmentDirectory
            departments={departments}
            staffs={staffs}
            busy={busy}
            selectedDepartment={selectedDepartment}
            onSelect={handleSelectDepartment}
            onAssignManager={assignManager}
            onEdit={openEdit}
            onHide={hideDepartment}
            onRestore={restoreDepartment}
            onDelete={confirmRemoveDepartment}
            pagination={pagination}
            onPageChange={load}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            onBulkSoftDelete={handleBulkSoftDelete}
          />
        )}
        {selectedDepartment && (
          <DepartmentDetail
            department={selectedDepartment}
            staffs={selectedStaffs}
            onGoStaff={() => navigate('/admin/staff')}
            onClose={() => setSelectedDepartment(null)}
          />
        )}
        {isModalOpen && (
          <DepartmentModal
            form={form}
            setForm={setForm}
            onSubmit={submitDepartment}
            onClose={closeModal}
            busy={busy}
            editing={Boolean(editingDepartment)}
            structuralLocked={Boolean(editingDepartment) && departmentHasBusinessRefs(editingDepartment, staffs)}
          />
        )}
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
            <span>Bệnh Viện Đa Khoa Quốc Tế KLTN · Danh Mục Đơn Vị ({total} phòng)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Danh mục Khoa & Phòng ban
          </h1>

          <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-2xl">
            Quản lý sơ đồ tổ chức phòng khám, gán nhân sự phụ trách và xác thực dữ liệu phòng ban trên Blockchain.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            title="Thùng rác phòng ban đã xóa"
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
            <span>Tạo phòng ban mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DepartmentDirectory({
  departments,
  staffs,
  busy,
  selectedDepartment,
  onSelect,
  onAssignManager,
  onEdit,
  onHide,
  onRestore,
  onDelete,
  pagination,
  onPageChange,
  selectedIds = [],
  setSelectedIds,
  onBulkSoftDelete,
}) {
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

  const allSelected = visibleDepartments.length > 0 && selectedIds.length === visibleDepartments.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleDepartments.map((d) => d.id));
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
              Đã chọn {selectedIds.length} phòng ban
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

      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100">
              <Filter className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-base font-black text-slate-900">Bộ lọc danh mục phòng ban</p>
              <p className="text-xs font-semibold text-slate-400">Tìm nhanh theo tên phòng ban, phân loại chức năng và trạng thái.</p>
            </div>
          </div>
          {(search || typeFilter || orderFilter || statusFilter) && (
            <button type="button" onClick={() => { setSearch(''); setTypeFilter(''); setOrderFilter(''); setStatusFilter(''); }} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-all">
              <X className="h-3.5 w-3.5" /> Xóa bộ lọc
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_140px] lg:items-end">
          <FilterInput label="Tên / Mã phòng ban" value={search} onChange={setSearch} placeholder="Nhập tên hoặc mã phòng ban..." />
          <FilterSelect label="Phân loại" value={typeFilter} onChange={setTypeFilter} options={DEPARTMENT_TYPES} empty="Tất cả phân loại" />
          <FilterSelect label="Chỉ định" value={orderFilter} onChange={setOrderFilter} options={[{ value: 'true', label: 'Nhận chỉ định' }, { value: 'false', label: 'Không nhận chỉ định' }]} empty="Tất cả" />
          <FilterSelect label="Trạng thái" value={statusFilter} onChange={setStatusFilter} options={[{ value: 'ACTIVE', label: 'Đang hiện' }, { value: 'INACTIVE', label: 'Đã ẩn' }]} empty="Tất cả trạng thái" />
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-transparent">Thao tác</span>
            <button type="button" className="inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-sky-700 whitespace-nowrap">
              <Search className="h-4 w-4" strokeWidth={2.5} /> Tìm kiếm
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-slate-700 hover:text-sky-600 transition"
              title="Chọn tất cả phòng ban"
            >
              {allSelected ? <CheckSquare size={20} className="text-sky-600" /> : <Square size={20} className="text-slate-400" />}
            </button>
            <Building2 className="h-5 w-5 text-sky-600" strokeWidth={2.25} />
            <h3 className="text-lg font-black text-slate-900">Danh sách Phòng ban & Khoa chuyên môn</h3>
          </div>
          <span className="rounded-xl border border-sky-200/80 bg-sky-50 px-4 py-1.5 text-xs font-bold text-sky-800">{visibleDepartments.length} / {pagination.total} phòng</span>
        </div>

        <div className="divide-y divide-slate-100">
          {visibleDepartments.map((dep) => {
            const depStaffs = staffs.filter((s) => s.departmentId === dep.id);
            const active = selectedDepartment?.id === dep.id;
            const isChecked = selectedIds.includes(dep.id);
            return (
              <article key={dep.id} className={`p-6 transition-all hover:bg-sky-50/30 ${isChecked ? 'bg-sky-50/70' : active ? 'bg-sky-50/40' : 'bg-white'}`}>
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr_0.55fr_0.55fr_0.8fr_300px] xl:items-center">
                  <div className="min-w-0 flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelectOne(dep.id)}
                      className="mt-1 text-slate-400 hover:text-sky-600 transition shrink-0"
                    >
                      {isChecked ? <CheckSquare size={20} className="text-sky-600" /> : <Square size={20} />}
                    </button>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-sky-600">{dep.departmentCode}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusTone[dep.status] || statusTone.ACTIVE}`}>{getStatusLabel(dep.status)}</span>
                      </div>
                      <h4 className="truncate text-base font-black text-slate-900">{dep.name}</h4>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-100">{getTypeLabel(dep.type)}</span>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${orderTone[String(Boolean(dep.canReceiveOrders))]}`}>{dep.canReceiveOrders ? 'Nhận chỉ định' : 'Không nhận chỉ định'}</span>
                      </div>
                      <p className="line-clamp-1 text-xs font-medium text-slate-400">{dep.description || 'Chưa có mô tả chi tiết'}</p>
                    </div>
                  </div>

                  <Info label="Phụ trách" value={dep.manager?.fullName || 'Chưa gán'} />
                  <Info label="Tầng" value={dep.floor || '—'} mono />
                  <Info label="Nhân sự" value={`${depStaffs.length} NV`} mono />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Trạng thái dữ liệu</p>
                    <BlockchainStatusBadge status={dep.blockchainStatus} size="xs" />
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <select disabled={busy} value={dep.managerId || ''} onChange={(e) => onAssignManager(dep.id, e.target.value)} className="min-w-[140px] flex-1 rounded-2xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 xl:flex-none">
                      <option value="">Chọn phụ trách</option>
                      {depStaffs.map((staff) => <option key={staff.id} value={staff.id}>{staff.fullName}</option>)}
                    </select>
                    <SmallButton onClick={() => onSelect(dep)} disabled={busy}>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Chi tiết</span>
                    </SmallButton>
                    <SmallButton onClick={() => onEdit(dep)} disabled={busy}>
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Sửa</span>
                    </SmallButton>
                    {dep.status === 'INACTIVE' ? (
                      <SmallButton onClick={() => onRestore(dep.id)} disabled={busy}>
                        <Eye className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Hiện</span>
                      </SmallButton>
                    ) : (
                      <SmallButton onClick={() => onHide(dep.id)} disabled={busy}>
                        <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                        <span>Ẩn</span>
                      </SmallButton>
                    )}
                    <SmallButton danger onClick={() => onDelete(dep)} disabled={busy}>
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa</span>
                    </SmallButton>
                  </div>
                </div>
              </article>
            );
          })}
          {!visibleDepartments.length && <div className="p-12 text-center text-xs font-bold text-slate-400">Không có phòng ban nào trong danh sách.</div>}
        </div>

        <Pagination pagination={pagination} onPageChange={onPageChange} />
      </section>
    </div>
  );
}

function FilterInput({ label, value, onChange, placeholder }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}</span><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 text-xs font-semibold outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100" /></label>;
}
function FilterSelect({ label, value, onChange, options, empty }) {
  return <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="h-[44px] w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 text-xs font-semibold outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100">{empty && <option value="">{empty}</option>}{options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></label>;
}

function DepartmentDetail({ department, staffs, onGoStaff, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  if (!department) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative z-10 flex max-h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="shrink-0 border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-sky-600">Chi tiết phòng ban</p>
            <h3 className="mt-1 text-2xl font-extrabold text-slate-900">{department.name}</h3>
            <p className="mt-1 text-xs font-semibold text-slate-400">{department.departmentCode} · {department.description || 'Chưa có mô tả'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">Đóng</button>
        </div>

        <div className="shrink-0 px-6 py-2.5 border-b border-slate-100 flex gap-2">
          <button onClick={() => setActiveTab('info')} className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${activeTab === 'info' ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Hồ sơ & Xác thực blockchain
          </button>
          <button onClick={() => setActiveTab('history')} className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${activeTab === 'history' ? 'bg-sky-600 text-white border-sky-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            Lịch sử cập nhật
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
          {activeTab === 'info' ? (
            <div className="space-y-6">
              <DepartmentIntegrityCard department={department} />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Thông tin phòng ban</h4>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Info label="Mã phòng ban" value={department.departmentCode} mono />
                    <Info label="Tên phòng ban" value={department.name} />
                    <Info label="Phân loại" value={getTypeLabel(department.type)} />
                    <Info label="Tầng" value={department.floor || 'Chưa gán'} mono />
                    <Info label="Nhận chỉ định" value={department.canReceiveOrders ? 'Có' : 'Không'} />
                    <Info label="Trạng thái" value={getStatusLabel(department.status)} />
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Nhân sự & phụ trách</h4>
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Info label="Phụ trách" value={department.manager?.fullName || 'Chưa gán'} />
                    <Info label="Số nhân sự" value={`${staffs.length} NV`} mono />
                  </div>
                  <div className="mt-4 space-y-2">
                    {staffs.map((staff) => (
                      <div key={staff.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 flex items-center justify-between">
                        <strong className="block text-xs font-bold text-slate-900">{staff.fullName}</strong>
                        <span className="text-[11px] font-semibold text-slate-400">{staff.employeeCode}</span>
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
          <button onClick={onGoStaff} className="w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-all">Đi tới quản lý nhân sự</button>
        </div>
      </aside>
    </div>
  );
}

function DepartmentIntegrityCard({ department }) {
  const audit = department.audit || {};
  const status = audit.status || department.blockchainStatus;
  const tone = BLOCKCHAIN_TONE[status] || BLOCKCHAIN_TONE.UNANCHORED;

  return (
    <div className={`rounded-2xl border p-5 shadow-xs space-y-4 ${status === 'VERIFIED' ? 'bg-emerald-50/60 border-emerald-200' : status === 'TAMPERED' ? 'bg-rose-50/60 border-rose-200 animate-pulse' : 'bg-amber-50/60 border-amber-200'}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone[department.status] || statusTone.ACTIVE}`}>{getStatusLabel(department.status)}</span>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${tone.cls}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
            Trạng thái: {tone.label}
          </span>
        </div>
        <span className="text-[11px] font-extrabold uppercase text-sky-700 tracking-wider">
          Xác thực bằng hợp đồng thông minh Solidity
        </span>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2 mt-3">
        <strong className="block text-slate-900 font-bold border-b pb-1.5 text-xs">Xác thực toàn vẹn dữ liệu phòng ban</strong>
        <div className="space-y-1.5 text-xs">
          <HashRow label="Trạng thái" value={audit.chainMatches ? 'Khớp với blockchain' : audit.onChainHash ? 'Mâu thuẫn' : 'Chưa neo'} match={audit.chainMatches} />
          <HashRow label="Hash trong CSDL" value={audit.storedHash} match={audit.dbMatches} />
          <HashRow label="Hash trên chuỗi" value={audit.onChainHash} match={audit.chainMatches} />
          <HashRow label="Hash tính lại" value={audit.recomputedHash} match={audit.dbMatches && audit.chainMatches} />
        </div>
      </div>
    </div>
  );
}

function HashRow({ label, value, match }) {
  return (
    <div className="flex justify-between items-center gap-2 py-0.5">
      <span className="text-slate-500 font-semibold">{label}:</span>
      <span className={`font-mono text-right ${match === true ? 'text-emerald-600 font-bold' : match === false ? 'text-rose-600 font-bold' : 'text-slate-700'}`}>
        {label === 'Trạng thái' ? value : shortHash(value)}
      </span>
    </div>
  );
}

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
    CREATE: { label: 'Tạo mới', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    UPDATE: { label: 'Cập nhật', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    DELETE: { label: 'Xóa', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Lịch sử sửa đổi</h4>
        <span className="text-[11px] font-bold text-slate-400">{logs.length} bản ghi</span>
      </div>
      {loading && <p className="text-xs font-bold text-slate-400">Đang tải...</p>}
      {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
      {!loading && !error && logs.length === 0 && <Empty title="Chưa có lịch sử" desc="Chưa có thay đổi nào được ghi nhận." />}
      {!loading && !error && logs.length > 0 && (
        <ol className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {logs.map((log) => {
            const meta = actionLabel[log.action] || { label: log.action, cls: 'bg-slate-50 text-slate-700 border-slate-200' };
            return (
              <li key={log.id || log.seq} className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>{meta.label}</span>
                  <span className="text-[10px] font-bold text-slate-400">{log.createdAt ? new Date(log.createdAt).toLocaleString('vi-VN') : ''}</span>
                </div>
                <p className="mt-1.5 text-xs font-bold text-slate-700">
                  {log.actor?.username || log.actor?.email || log.actorId || 'Hệ thống'}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-bold ${log.batchId ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
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
  const isActive = department.status === 'ACTIVE';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-slate-100 p-6">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-xs font-bold uppercase tracking-wider">Cảnh báo xóa phòng ban</p>
          </div>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Chuyển vào thùng rác?</h3>
          <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed">
            Phòng ban sẽ được chuyển sang thùng rác lưu trữ (lưu trong 30 ngày để có thể khôi phục).
          </p>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Tên phòng ban</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}`}>
                {isActive ? 'Đang hoạt động' : 'Ngưng hoạt động'}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{department.name}</p>
            <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-slate-200/60">
              <span>Mã phòng: <strong className="font-mono text-sky-600">{department.departmentCode}</strong></span>
              <span>Tầng: <strong>{department.floor || '—'}</strong></span>
            </div>
          </div>

          {isActive && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Lưu ý:</strong> Phòng ban này hiện đang ở trạng thái <strong>Đang hoạt động</strong>. Khi xóa, phòng ban sẽ tự động chuyển sang <strong>NGƯNG HOẠT ĐỘNG</strong> và đưa vào Thùng rác.
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

function DepartmentModal({ form, setForm, onSubmit, onClose, busy, editing, structuralLocked = false }) {
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
      if (!/^[\p{L}]+(?:[\s-]+[\p{L}]+)*(?:[\s-]+\d+)?$/u.test(value.trim())) return 'Tên phòng ban phải bắt đầu bằng chữ; cho phép khoảng trắng/dấu gạch ngang, số chỉ được đặt ở cuối. VD: X-Ray, Tổng quát 1.';
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

  if (typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <form onSubmit={handleSubmit} noValidate className="relative z-10 w-full max-w-xl rounded-3xl bg-white p-6 sm:p-8 shadow-2xl space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">{editing ? 'Cập nhật phòng ban' : 'Tạo phòng ban'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50">Đóng</button>
        </div>
        {structuralLocked && (
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
            Phòng ban đã có dữ liệu liên quan: không thể đổi mã, loại hoặc khả năng nhận chỉ định. Vẫn sửa được tên, tầng, mô tả và trạng thái.
          </div>
        )}
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
            disabled={structuralLocked}
          />
          <Input
            label="Tên phòng ban"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: normalizeDepartmentNameInput(v) })}
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
          <Select
            label="Loại phòng ban"
            value={form.type}
            onChange={(v) => setForm({ ...form, type: v, canReceiveOrders: canDepartmentReceiveOrders(v) ? form.canReceiveOrders : false })}
            options={DEPARTMENT_TYPES}
            disabled={structuralLocked}
          />
          {canReceiveOrders && (
            <label className={`rounded-2xl border border-sky-100 bg-sky-50/60 p-4 flex items-start gap-3 ${structuralLocked ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={Boolean(form.canReceiveOrders)}
                disabled={structuralLocked}
                onChange={(e) => setForm({ ...form, canReceiveOrders: e.target.checked })}
                className="mt-1 h-4 w-4 accent-sky-600"
              />
              <span>
                <strong className="block text-xs font-bold text-sky-900">Nhận phiếu chỉ định</strong>
                <small className="mt-0.5 block text-[11px] font-semibold text-sky-700">Bật cho Xét nghiệm / Chẩn đoán hình ảnh để hiện trong biểu mẫu bác sĩ.</small>
              </span>
            </label>
          )}
        </div>
        <Textarea label="Mô tả nhiệm vụ" value={form.description} onChange={(v) => setForm({ ...form, description: v.slice(0, MAX_DEPARTMENT_DESCRIPTION_LENGTH) })} onBlur={() => validateField('description')} error={fieldErrors.description} placeholder="Mô tả chức năng phòng ban" maxLength={MAX_DEPARTMENT_DESCRIPTION_LENGTH} />
        <button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-70">{busy && <LoadingIndicator size="sm" tone="white" />}{editing ? 'Lưu thay đổi' : 'Tạo phòng ban'}</button>
      </form>
    </div>,
    document.body
  );
}

function Info({ label, value, mono }) { return <div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className={`mt-0.5 truncate text-sm font-bold text-slate-800 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p></div>; }
function Empty({ title, desc }) { return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center"><strong className="text-sm font-bold text-slate-800">{title}</strong><p className="mt-1 text-xs text-slate-400">{desc}</p></div>; }
function SmallButton({ children, onClick, disabled, danger }) { return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${danger ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-600 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200'}`}>{children}</button>; }
function Input({ label, value, onChange, onBlur, error, required, placeholder, type = 'text', min, max, minLength, maxLength, pattern, hint, disabled = false }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <input type={type} required={required} disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} min={min} max={max} minLength={minLength} maxLength={maxLength} pattern={pattern} className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} />
      <p className={`min-h-[14px] text-[11px] font-bold leading-3 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Lỗi'}</p>
    </label>
  );
}
function Textarea({ label, value, onChange, onBlur, error, placeholder, maxLength }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder} maxLength={maxLength} rows={3} className={`w-full resize-none px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:ring-2 outline-none transition-all ${error ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`} />
      <p className={`min-h-[14px] text-[11px] font-bold leading-3 ${error ? 'text-rose-600' : 'text-transparent'}`}>{error || 'Lỗi'}</p>
    </label>
  );
}
function Select({ label, value, onChange, options, disabled }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <select disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-100 outline-none disabled:cursor-not-allowed disabled:opacity-60 transition-all">
        {options.map((opt) => typeof opt === 'string' ? <option key={opt} value={opt}>{opt}</option> : <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
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
