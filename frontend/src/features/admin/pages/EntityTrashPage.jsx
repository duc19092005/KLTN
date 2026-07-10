import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
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
    name: (row) => row.modelName, detail: (row) => `${row.modelVersion} · ${row.provider || 'Chưa có nền tảng'}`,
  },
  staff: {
    title: 'Nhân sự đã xóa', route: '/admin/staff', active: 'staff',
    load: (params) => staffService.search({ ...params, status: 'DELETE', includeDeleted: true, excludeRole: 'DOCTOR' }),
    restore: staffService.restore, permanentDelete: staffService.permanentDelete,
    name: (row) => row.fullName, detail: (row) => `${row.employeeCode} · ${row.user?.email || 'Chưa có email'}`,
  },
  departments: {
    title: 'Phòng ban đã xóa', route: '/admin/departments', active: 'departments',
    load: (params) => departmentService.list({ ...params, status: 'DELETE' }),
    restore: departmentService.restore, permanentDelete: departmentService.permanentDelete,
    name: (row) => row.name, detail: (row) => `${row.departmentCode} · ${row.type}`,
  },
  doctors: {
    title: 'Bác sĩ đã xóa', route: '/admin/doctors', active: 'doctors',
    load: (params) => doctorService.search({ ...params, status: 'DELETE', includeDeleted: true }),
    restore: doctorService.restore, permanentDelete: doctorService.permanentDelete,
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

  async function load(nextPage = page) {
    setLoading(true);
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

  return <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem={config.active} onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
    <div className="mx-auto max-w-[1400px] space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" title="Quay lại" onClick={() => navigate(config.route)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700"><ArrowLeft size={18} /></button>
          <div><h1 className="text-xl font-black text-slate-950">{config.title}</h1><p className="text-sm font-semibold text-slate-500">Thùng rác riêng của phân hệ</p></div>
        </div>
        <button type="button" title="Làm mới" onClick={() => load(page)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700"><RefreshCw size={18} /></button>
      </header>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && <LoadingIndicator size="lg" label="Đang tải dữ liệu đã xóa..." />}
        {!loading && rows.map((row) => <article key={row.id} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 md:flex-row md:items-center md:justify-between">
          <div><h2 className="font-black text-slate-950">{config.name(row) || 'Bản ghi đã xóa'}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{config.detail(row)}</p><p className="mt-1 text-xs text-slate-400">Xóa lúc: {row.deletedAt ? new Date(row.deletedAt).toLocaleString('vi-VN') : 'Bản ghi cũ chưa có thời điểm xóa'}</p></div>
          <div className="flex gap-2">
            <button type="button" title="Khôi phục" disabled={Boolean(busy)} onClick={() => mutate(row, 'restore')} className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-600 text-white disabled:opacity-40"><RotateCcw size={17} /></button>
            <button type="button" title="Xóa vĩnh viễn" disabled={Boolean(busy)} onClick={() => mutate(row, 'permanent')} className="grid h-10 w-10 place-items-center rounded-lg bg-rose-600 text-white disabled:opacity-40"><Trash2 size={17} /></button>
          </div>
        </article>)}
        {!loading && rows.length === 0 && <div className="p-10 text-center text-sm font-semibold text-slate-500">Không có bản ghi đã xóa trong phân hệ này.</div>}
      </section>
      <footer className="flex items-center justify-between"><span className="text-sm font-bold text-slate-500">Trang {page}/{meta.totalPages || 1}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => load(page - 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Trước</button><button disabled={page >= (meta.totalPages || 1)} onClick={() => load(page + 1)} className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40">Sau</button></div></footer>
    </div>
  </DashboardLayout>;
}
