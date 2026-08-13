import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckSquare, RefreshCw, RotateCcw, Square, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { aiModelService } from '../apis/aiModelService';
import { departmentService } from '../apis/departmentService';
import { doctorService } from '../apis/doctorService';
import { staffService } from '../apis/staffService';

const CONFIG = {
  aiModels: {
    title: 'Mô hình AI đã xóa', route: '/admin/ai-models', active: 'aiModels',
    load: (params) => aiModelService.list({ ...params, status: 'DELETE', includeDeleted: true }),
    restore: aiModelService.restore, permanentDelete: aiModelService.permanentDelete,
    restoreMany: aiModelService.restoreMany, permanentDeleteMany: aiModelService.permanentDeleteMany,
    name: (row) => row.modelName, detail: (row) => `${row.modelVersion} · ${row.provider || 'Chưa có nền tảng'}`,
  },
  staff: {
    title: 'Nhân sự đã xóa', route: '/admin/staff', active: 'staff',
    load: (params) => staffService.search({ ...params, status: 'DELETE', includeDeleted: true, excludeRole: 'DOCTOR' }),
    restore: staffService.restore, permanentDelete: staffService.permanentDelete,
    restoreMany: staffService.restoreMany, permanentDeleteMany: staffService.permanentDeleteMany,
    name: (row) => row.fullName, detail: (row) => `${row.employeeCode} · ${row.user?.email || 'Chưa có email'}`,
  },
  departments: {
    title: 'Phòng ban đã xóa', route: '/admin/departments', active: 'departments',
    load: (params) => departmentService.list({ ...params, status: 'DELETE' }),
    restore: departmentService.restore, permanentDelete: departmentService.permanentDelete,
    restoreMany: departmentService.restoreMany, permanentDeleteMany: departmentService.permanentDeleteMany,
    name: (row) => row.name, detail: (row) => `${row.departmentCode} · ${row.type}`,
  },
  doctors: {
    title: 'Bác sĩ đã xóa', route: '/admin/doctors', active: 'doctors',
    load: (params) => doctorService.search({ ...params, status: 'DELETE', includeDeleted: true }),
    restore: doctorService.restore, permanentDelete: doctorService.permanentDelete,
    restoreMany: doctorService.restoreMany, permanentDeleteMany: doctorService.permanentDeleteMany,
    name: (row) => row.staffProfile?.fullName, detail: (row) => `${row.staffProfile?.employeeCode || 'Chưa có mã'} · ${row.licenseNumber}`,
  },
};

const unwrap = (response) => response?.data?.items || response?.data?.data || [];
const paginationOf = (response) => response?.data || {};

export default function EntityTrashPage({ entity }) {
  const config = CONFIG[entity];
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);

  async function load(nextPage = page) {
    setLoading(true);
    setSelectedIds([]);
    try {
      const response = await config.load({ page: nextPage, limit: 10 });
      setRows(unwrap(response));
      setMeta(paginationOf(response));
      setPage(nextPage);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không tải được dữ liệu đã xóa.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(1); }, [entity]);

  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => r.id));
    }
  }

  function toggleSelectOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  async function mutate(row, action) {
    setBusy(`${action}:${row.id}`);
    try {
      if (action === 'restore') await config.restore(row.id);
      else await config.permanentDelete(row.id);
      toast.success(action === 'restore' ? 'Đã khôi phục về trạng thái ngừng hoạt động.' : 'Đã xóa vĩnh viễn bản ghi không có dữ liệu liên quan.');
      await load(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể thực hiện thao tác.');
    } finally { setBusy(null); }
  }

  async function handleBulkAction(action) {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    const isRestore = action === 'restore';
    const confirmMsg = isRestore
      ? `Bạn có chắc chắn muốn khôi phục ${count} bản ghi đã chọn?`
      : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN ${count} bản ghi đã chọn? Hành động này KHÔNG THỂ khôi phục!`;

    if (!window.confirm(confirmMsg)) return;

    setBusy(`bulk:${action}`);
    try {
      const apiFn = isRestore ? config.restoreMany : config.permanentDeleteMany;
      const res = await apiFn(selectedIds);
      const data = res.data;
      if (data?.failed > 0) {
        toast.warning(`Thành công: ${data.succeeded}/${data.requested}. Thất bại: ${data.failed}. Check thông báo chi tiết.`);
      } else {
        toast.success(isRestore ? `Đã khôi phục thành công ${count} bản ghi!` : `Đã xóa vĩnh viễn thành công ${count} bản ghi!`);
      }
      setSelectedIds([]);
      await load(page);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Lỗi khi thực hiện thao tác hàng loạt.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem={config.active} onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-[1400px] space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button type="button" title="Quay lại" onClick={() => navigate(config.route)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"><ArrowLeft size={18} /></button>
            <div><h1 className="text-xl font-black text-slate-950">{config.title}</h1><p className="text-sm font-semibold text-slate-500">Thùng rác riêng của phân hệ</p></div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" title="Làm mới" onClick={() => load(page)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"><RefreshCw size={18} /></button>
          </div>
        </header>

        {/* Floating Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/95 px-5 py-3 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white">
                {selectedIds.length}
              </span>
              <span className="text-sm font-bold text-blue-950">
                Đã chọn {selectedIds.length} bản ghi
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => handleBulkAction('restore')}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-40 transition"
              >
                <RotateCcw size={16} />
                Khôi phục chọn ({selectedIds.length})
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => handleBulkAction('permanent')}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-40 transition"
              >
                <Trash2 size={16} />
                Xóa vĩnh viễn chọn ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Bỏ chọn
              </button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {rows.length > 0 && !loading && (
            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <button
                type="button"
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-slate-700 hover:text-slate-950 transition"
              >
                {allSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-slate-400" />}
                <span>Chọn tất cả ({rows.length})</span>
              </button>
            </div>
          )}
          {loading && <LoadingIndicator size="lg" label="Đang tải dữ liệu đã xóa..." />}
          {!loading && rows.map((row) => {
            const isSelected = selectedIds.includes(row.id);
            return (
              <article key={row.id} className={`flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 md:flex-row md:items-center md:justify-between transition ${isSelected ? 'bg-blue-50/40' : ''}`}>
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelectOne(row.id)}
                    className="mt-1 text-slate-400 hover:text-blue-600 transition"
                  >
                    {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                  </button>
                  <div>
                    <h2 className="font-black text-slate-950">{config.name(row) || 'Bản ghi đã xóa'}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{config.detail(row)}</p>
                    <p className="mt-1 text-xs text-slate-400">Xóa lúc: {row.deletedAt ? new Date(row.deletedAt).toLocaleString('vi-VN') : 'Bản ghi cũ chưa có thời điểm xóa'}</p>
                  </div>
                </div>
                <div className="flex gap-2 self-end md:self-center">
                  <button type="button" title="Khôi phục" disabled={Boolean(busy)} onClick={() => mutate(row, 'restore')} className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-600 text-white disabled:opacity-40 hover:bg-cyan-700 transition"><RotateCcw size={17} /></button>
                  <button type="button" title="Xóa vĩnh viễn" disabled={Boolean(busy)} onClick={() => mutate(row, 'permanent')} className="grid h-10 w-10 place-items-center rounded-lg bg-rose-600 text-white disabled:opacity-40 hover:bg-rose-700 transition"><Trash2 size={17} /></button>
                </div>
              </article>
            );
          })}
          {!loading && rows.length === 0 && <div className="p-10 text-center text-sm font-semibold text-slate-500">Không có bản ghi đã xóa trong phân hệ này.</div>}
        </section>
        <footer className="flex items-center justify-between"><span className="text-sm font-bold text-slate-500">Trang {page}/{meta.totalPages || 1}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition">Trước</button><button disabled={page >= (meta.totalPages || 1)} onClick={() => load(page + 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition">Sau</button></div></footer>
      </div>
    </DashboardLayout>
  );
}
