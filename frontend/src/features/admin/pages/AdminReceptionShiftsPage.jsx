import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { shiftService as paraclinicalShiftService } from '../../paraclinical/apis/paraclinicalService';
import { getRoleNav } from '../../profile/constants/roleNav';
import RejectReasonModal from '../../../shared/components/RejectReasonModal';

const STATUS_META = {
  PENDING:  { label: 'Chờ duyệt', dot: 'bg-amber-400',  bg: 'bg-amber-50 border-amber-200 text-amber-800' },
  APPROVED: { label: 'Đã duyệt',  dot: 'bg-emerald-500', bg: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  REJECTED: { label: 'Từ chối',   dot: 'bg-red-400',     bg: 'bg-red-50 border-red-200 text-red-700' },
};

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Normalize a server response that might be wrapped by the global ApiResponseInterceptor
// and/or by the paginated() helper. Returns a plain array of items.
function unwrapList(res) {
  const payload = res?.data?.data ?? res?.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}
function getShiftDepartment(shift) {
  return shift.department || shift.staff?.department || null;
}

/**
 * Unified shift management page for ADMIN / LAB_MANAGER (paraclinical shifts only).
 * Reception shifts have been removed — receptionists no longer register shifts.
 *
 * Visibility rules:
 *  - ADMIN: full access
 *  - LAB_MANAGER: paraclinical shifts within their department
 *
 * Server-side already enforces who can approve what.
 */
export default function AdminShiftsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const role = user?.role;
  const roleNav = getRoleNav(role);
  const showParaclinical = role === 'ADMIN' || role === 'LAB_MANAGER';

  return (
    <DashboardLayout
      user={user}
      navItems={roleNav.items}
      activeItem={role === 'ADMIN' ? 'shifts' : 'approveShifts'}
      onNavigate={(id) => navigate(roleNav.routeFor(id))}
      onLogout={logout}
    >
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">Duyệt và quản lý ca trực</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Phê duyệt ca trực cận lâm sàng</h1>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {role === 'ADMIN' && 'Quản trị viên xem được toàn bộ ca trực của kỹ thuật cận lâm sàng.'}
                {role === 'LAB_MANAGER' && 'Trưởng khoa cận lâm sàng duyệt ca của kỹ thuật viên trong khoa.'}
              </p>
            </div>
          </div>
        </section>

        {showParaclinical && <ParaclinicalTab user={user} toast={toast} />}
      </div>
    </DashboardLayout>
  );
}

// ──────────────────────────────────────────────────────────────────
// Paraclinical shift tab
// ──────────────────────────────────────────────────────────────────
function ParaclinicalTab({ user, toast }) {
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState([]);
  const [approvedByRoom, setApprovedByRoom] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRoom) loadRoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom]);

  async function loadAll() {
    setLoading(true);
    try {
      // Pending shifts (system-wide for admin; backend already scopes for managers)
      const [pendingRes, depRes] = await Promise.all([
        paraclinicalShiftService.listPending(),
        // Pull rooms via the LABORATORY/IMAGING departments. Cheap-and-cheerful: just fetch all
        // departments once and use their id to fetch rooms via existing room endpoints? We don't
        // have a /rooms endpoint here; for the admin view we only need pending + per-room. So let's
        // populate room dropdown from the pending shifts + (later) add admin-only room listing.
        Promise.resolve({ data: [] }),
      ]);
      const pendingList = unwrapList(pendingRes);
      setPending(pendingList);

      // Build a deduped department list from pending shifts so the admin can navigate to a specific department.
      const roomMap = new Map();
      for (const s of pendingList) {
        const department = getShiftDepartment(s);
        if (department?.id && !roomMap.has(department.id)) {
          roomMap.set(department.id, department);
        }
      }
      const roomArr = [...roomMap.values()];
      setRooms(roomArr);
      if (!selectedRoom && roomArr.length > 0) setSelectedRoom(roomArr[0].id);
    } catch (err) {
      console.error('Load paraclinical shifts failed:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoom() {
    try {
      const res = await paraclinicalShiftService.listByDepartment(selectedRoom);
      setApprovedByRoom(unwrapList(res));
    } catch { /* ignore */ }
  }

  async function handleApprove(id) {
    try {
      await paraclinicalShiftService.approve(id);
      toast.success('Đã duyệt ca trực.');
      loadAll();
      if (selectedRoom) loadRoom();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duyệt thất bại.');
    }
  }

  async function handleReject(id) {
    const shift = [...pending, ...approvedByRoom].find((s) => s.id === id);
    setRejectTarget(shift || { id });
  }

  async function confirmReject(reason) {
    if (!rejectTarget) return;
    try {
      await paraclinicalShiftService.reject(rejectTarget.id, reason);
      toast.success('Đã từ chối ca trực.');
      setRejectTarget(null);
      loadAll();
      if (selectedRoom) loadRoom();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Từ chối thất bại.');
    }
  }

  const allShifts = [...pending, ...approvedByRoom];
  const summary = useMemo(() => {
    const c = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    for (const s of allShifts) if (c[s.status] !== undefined) c[s.status]++;
    return c;
  }, [allShifts]);

  return (
    <>
      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
        <p className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">Phòng máy</p>
        <select
          value={selectedRoom}
          onChange={(e) => setSelectedRoom(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
        >
          {rooms.length === 0 && <option value="">-- Chưa có phòng có ca chờ duyệt --</option>}
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.departmentCode} · {r.name}</option>
          ))}
        </select>
        <p className="text-[11px] font-bold text-slate-500">
          Chọn phòng để xem chi tiết ca đã duyệt; danh sách chờ duyệt phía dưới hiển thị toàn hệ thống.
        </p>
      </section>

      <ShiftPanel
        kind="Cận lâm sàng"
        summary={summary}
        filterStatus="" setFilterStatus={() => {}}
        filterDept="" setFilterDept={() => {}}
        departments={[]}
        pending={pending}
        shifts={allShifts}
        loading={loading}
        handleApprove={handleApprove}
        handleReject={handleReject}
        getDeptLabel={(s) => {
          const department = getShiftDepartment(s);
          return department?.name || department?.departmentCode || s.departmentId?.slice(0, 8);
        }}
        hideFilters
      />
      <RejectReasonModal
        open={Boolean(rejectTarget)}
        subtitle={rejectTarget?.staff?.fullName ? `Nhân viên: ${rejectTarget.staff.fullName}` : undefined}
        onConfirm={confirmReject}
        onClose={() => setRejectTarget(null)}
      />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────
// Shared shift panel UI used by both tabs
// ──────────────────────────────────────────────────────────────────
function ShiftPanel({
  kind,
  summary,
  filterStatus, setFilterStatus,
  filterDept, setFilterDept,
  departments,
  pending,
  shifts,
  loading,
  handleApprove,
  handleReject,
  getDeptLabel,
  hideFilters = false,
  hideDeptFilter = false,
}) {
  return (
    <>
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Chờ duyệt</p>
          <p className="mt-1 text-2xl font-black text-amber-900">{summary.PENDING}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Đã duyệt</p>
          <p className="mt-1 text-2xl font-black text-emerald-900">{summary.APPROVED}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-red-700">Từ chối</p>
          <p className="mt-1 text-2xl font-black text-red-900">{summary.REJECTED}</p>
        </div>
      </section>

      {!hideFilters && (
        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500 shrink-0">Lọc</p>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none">
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="REJECTED">Từ chối</option>
          </select>
          {!hideDeptFilter && (
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none">
              <option value="">Tất cả phòng</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.departmentCode} · {d.name}</option>
              ))}
            </select>
          )}
        </section>
      )}

      {loading ? (
        <LoadingIndicator size="lg" label="Đang tải dữ liệu..." />
      ) : (
        <>
          {pending.length > 0 && (
            <section className="rounded-3xl border border-amber-100 bg-amber-50/30 p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950 mb-3">Hàng đợi phê duyệt ({pending.length})</h2>
              <div className="space-y-2">
                {pending.map((s) => (
                  <div key={s.id} className="rounded-2xl border border-amber-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{s.staff?.fullName || 'N/A'}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">
                        {getDeptLabel(s)} · {fmtDateTime(s.startTime)} → {fmtDateTime(s.endTime)}
                      </p>
                      {s.note && (
                        <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 border border-slate-100">
                          <span className="font-black text-slate-500">Lời nhắn:</span> {s.note}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApprove(s.id)} className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700">Duyệt</button>
                      <button onClick={() => handleReject(s.id)} className="rounded-xl border border-red-200 px-4 py-2 text-xs font-black text-red-600 hover:bg-red-50">Từ chối</button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-black text-slate-950">Tất cả ca trực {kind} ({shifts.length})</h2>
            </div>
            {shifts.length === 0 ? (
              <p className="p-8 text-center text-sm font-bold text-slate-400">Chưa có ca trực nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Nhân viên</th>
                      <th className="px-4 py-3 text-left">Phòng / Phòng máy</th>
                      <th className="px-4 py-3 text-left">Bắt đầu</th>
                      <th className="px-4 py-3 text-left">Kết thúc</th>
                      <th className="px-4 py-3 text-left">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shifts.map((s) => {
                      const meta = STATUS_META[s.status] || STATUS_META.PENDING;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">{s.staff?.fullName || 'N/A'}</td>
                          <td className="px-4 py-3 text-slate-600">{getDeptLabel(s)}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{fmtDateTime(s.startTime)}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{fmtDateTime(s.endTime)}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-black ${meta.bg}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {s.status === 'PENDING' ? (
                              <div className="inline-flex items-center gap-2">
                                <button onClick={() => handleApprove(s.id)} className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-black text-white hover:bg-emerald-700">Duyệt</button>
                                <button onClick={() => handleReject(s.id)} className="rounded-lg border border-red-200 px-3 py-1 text-[11px] font-black text-red-600 hover:bg-red-50">Từ chối</button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-semibold text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
