import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { ADMIN_NAV_ITEMS, navigateAdmin } from '../constants/navigation';
import { staffService } from '../apis/staffService';
import { doctorService } from '../apis/doctorService';
import { aiModelService } from '../apis/aiModelService';
import { departmentService } from '../apis/departmentService';

const MODULES = [
  { id: 'staff', label: 'Nhân sự', desc: 'Tài khoản nhân sự đã xóa mềm' },
  { id: 'doctors', label: 'Bác sĩ', desc: 'Hồ sơ bác sĩ đã xóa mềm' },
  { id: 'aiModels', label: 'Mô hình AI', desc: 'Cấu hình AI đã xóa mềm' },
  { id: 'departments', label: 'Phòng ban', desc: 'Đơn vị vận hành đã xóa mềm' },
];

function getItems(response) {
  return response?.data?.items || response?.data?.data || [];
}

function getPagination(response, fallbackPage, fallbackLimit) {
  const data = response?.data || {};
  return {
    page: data.page || fallbackPage,
    limit: data.limit || fallbackLimit,
    total: data.total || 0,
    totalPages: data.totalPages || 1,
  };
}

function isDeletedRecord(moduleId, item) {
  if (moduleId === 'staff') return item?.user?.status === 'DELETE';
  if (moduleId === 'doctors') return item?.staffProfile?.user?.status === 'DELETE';
  return item?.status === 'DELETE' || item?.isDeleted === true;
}

const STATUS_LABELS = {
  DELETE: 'Đã xóa',
  INACTIVE: 'Đã ẩn',
  ACTIVE: 'Đang hoạt động',
};

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  RECEPTIONIST: 'Lễ tân',
  DOCTOR: 'Bác sĩ',
  LAB_MANAGER: 'Quản lý xét nghiệm',
};

const DEPARTMENT_TYPE_LABELS = {
  ADMINISTRATIVE: 'Hành chính',
  CLINICAL: 'Lâm sàng',
  LABORATORY: 'Xét nghiệm',
  IMAGING: 'Chẩn đoán hình ảnh',
  EXAMINATION: 'Phòng khám',
};

function humanLabel(map, value, fallback = 'Chưa cập nhật') {
  return map[value] || value || fallback;
}

function recordTitle(moduleId, item) {
  if (moduleId === 'staff') return item?.fullName || item?.user?.username || 'Nhân sự đã xóa';
  if (moduleId === 'doctors') return item?.staffProfile?.fullName || item?.licenseNumber || 'Bác sĩ đã xóa';
  if (moduleId === 'aiModels') return item?.modelName || 'Mô hình AI đã xóa';
  return item?.name || 'Phòng ban đã xóa';
}

function recordSubtitle(moduleId, item) {
  if (moduleId === 'staff') {
    return `Mã nhân sự: ${item?.employeeCode || 'Chưa cập nhật'} · Vai trò: ${humanLabel(ROLE_LABELS, item?.user?.role, 'Nhân sự')}`;
  }
  if (moduleId === 'doctors') {
    return `Mã bác sĩ: ${item?.staffProfile?.employeeCode || 'Chưa cập nhật'} · Chuyên khoa: ${item?.specialty || 'Chưa cập nhật'} · Chứng chỉ: ${item?.licenseNumber || 'Chưa cập nhật'}`;
  }
  if (moduleId === 'aiModels') {
    return `Phiên bản: ${item?.modelVersion || 'Chưa cập nhật'} · Nhà cung cấp: ${item?.provider || 'Chưa cập nhật'}`;
  }
  return `Mã phòng ban: ${item?.departmentCode || 'Chưa cập nhật'} · Loại phòng ban: ${humanLabel(DEPARTMENT_TYPE_LABELS, item?.type)} · Tầng: ${item?.floor || 'Chưa cập nhật'}`;
}

export default function DeletedRecordsPage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [moduleId, setModuleId] = useState('staff');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const activeModule = useMemo(() => MODULES.find((item) => item.id === moduleId), [moduleId]);

  async function load(nextPage = page) {
    setLoading(true);
    try {
      const params = { page: nextPage, limit, includeDeleted: true };
      const response = moduleId === 'staff'
        ? await staffService.search({ ...params, excludeRole: 'DOCTOR', status: 'DELETE' })
        : moduleId === 'doctors'
          ? await doctorService.search(params)
          : moduleId === 'aiModels'
            ? await aiModelService.list(params)
            : await departmentService.list({ page: nextPage, limit, status: 'DELETE' });

      const deletedRows = getItems(response).filter((item) => isDeletedRecord(moduleId, item));
      setRows(deletedRows);
      setPagination(getPagination(response, nextPage, limit));
      setPage(nextPage);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được dữ liệu đã xóa');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); }, [moduleId]);

  async function restore(item) {
    setBusyId(item.id);
    try {
      if (moduleId === 'staff') await staffService.unlock(item.id);
      if (moduleId === 'doctors') await staffService.unlock(item.staffProfile?.id);
      if (moduleId === 'aiModels') await aiModelService.restore(item.id);
      if (moduleId === 'departments') await departmentService.update(item.id, { status: 'ACTIVE' });
      toast.success(`Đã khôi phục ${recordTitle(moduleId, item)}.`);
      await load(page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không khôi phục được dữ liệu');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardLayout user={user} navItems={ADMIN_NAV_ITEMS} activeItem="trash" onNavigate={(id) => navigateAdmin(navigate, id)} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex justify-end">
          <button type="button" onClick={() => load(page)} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white hover:bg-cyan-700">Làm mới</button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {MODULES.map((item) => (
            <button key={item.id} type="button" onClick={() => setModuleId(item.id)} className={`rounded-2xl border p-4 text-left transition ${moduleId === item.id ? 'border-cyan-200 bg-cyan-50 text-cyan-800' : 'border-slate-100 bg-white text-slate-700 hover:border-cyan-100'}`}>
              <p className="font-black">{item.label}</p>
              <p className="mt-1 text-xs font-semibold opacity-70">{item.desc}</p>
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-lg font-black text-slate-900">{activeModule?.label}</h2>
            <p className="text-sm font-semibold text-slate-500">Tổng theo truy vấn: {pagination.total} bản ghi</p>
          </div>
          <div className="space-y-3 p-5">
            {loading && <LoadingIndicator size="lg" label="Đang tải dữ liệu đã xóa..." />}
            {!loading && rows.map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-black text-slate-950">{recordTitle(moduleId, item)}</h3>
                    <span className="rounded-full border border-rose-100 bg-white px-2 py-1 text-[10px] font-black text-rose-600">{STATUS_LABELS.DELETE}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{recordSubtitle(moduleId, item)}</p>
                </div>
                <button type="button" disabled={busyId === item.id} onClick={() => restore(item)} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-black text-white hover:bg-cyan-700 disabled:opacity-50">Khôi phục</button>
              </article>
            ))}
            {!loading && rows.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><strong>Không có dữ liệu đã xóa</strong><p className="mt-1 text-sm text-slate-500">Module này hiện chưa có bản ghi DELETE.</p></div>}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 p-4">
            <p className="text-sm font-bold text-slate-500">Trang {pagination.page}/{pagination.totalPages}</p>
            <div className="flex gap-2">
              <button type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black disabled:opacity-40">Trước</button>
              <button type="button" disabled={page >= pagination.totalPages || loading} onClick={() => load(page + 1)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black disabled:opacity-40">Sau</button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
