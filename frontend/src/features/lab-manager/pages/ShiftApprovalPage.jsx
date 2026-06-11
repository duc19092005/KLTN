import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { shiftService } from '../../paraclinical/apis/paraclinicalService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
}

export default function ShiftApprovalPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');

  const pendingCount = shifts.length;
  const departmentNames = useMemo(() => {
    const names = new Set(shifts.map((shift) => shift.staff?.department?.name).filter(Boolean));
    return Array.from(names).join(', ') || 'phòng ban bạn quản lý';
  }, [shifts]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await shiftService.listPending();
      setShifts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được danh sách ca chờ duyệt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const approve = async (shiftId) => {
    setBusyId(shiftId);
    try {
      await shiftService.approve(shiftId);
      toast.success('Đã duyệt ca trực và gửi thông báo cho nhân viên.');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Duyệt ca thất bại.');
    } finally {
      setBusyId('');
    }
  };

  const reject = async (event) => {
    event.preventDefault();
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await shiftService.reject(rejecting.id, reason);
      toast.success('Đã từ chối ca trực và gửi thông báo cho nhân viên.');
      setRejecting(null);
      setReason('');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Từ chối ca thất bại.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="approvals" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-7xl space-y-5 pb-12">
        <div className="flex justify-end">
          <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4 text-center shadow-sm">
            <strong className="block text-3xl font-black text-cyan-600">{pendingCount}</strong>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">ca chờ duyệt</span>
          </div>
        </div>

        {loading ? <LoadingIndicator size="lg" label="Đang tải ca chờ duyệt..." /> : (
          <section className="grid grid-cols-1 gap-3">
            {shifts.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
                <p className="text-sm font-black text-slate-700">Không có ca nào đang chờ duyệt.</p>
                <p className="mt-1 text-xs font-semibold text-slate-400">Khi nhân viên xét nghiệm/chẩn đoán hình ảnh đăng ký, ca sẽ xuất hiện ở đây.</p>
              </div>
            ) : shifts.map((shift) => (
              <article key={shift.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-colors hover:border-cyan-200 hover:shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase text-amber-700">Chờ duyệt</span>
                      <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-black uppercase text-cyan-700">{shift.staff?.department?.type || 'CLS'}</span>
                    </div>
                    <h2 className="mt-2 text-base font-black text-slate-950">{shift.staff?.fullName || 'Nhân viên'}</h2>
                    <p className="mt-1 text-xs font-bold text-slate-500">{formatDateTime(shift.startTime)} → {formatDateTime(shift.endTime)}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">Phòng: {shift.department?.name || shift.department?.departmentCode || shift.staff?.department?.name || 'N/A'}</p>
                    <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Lời nhắn đăng ký</p>
                      <p className="mt-1 text-xs font-semibold text-slate-700">{shift.note || 'Không có lời nhắn'}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button disabled={Boolean(busyId)} onClick={() => approve(shift.id)} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">Duyệt</button>
                    <button disabled={Boolean(busyId)} onClick={() => { setRejecting(shift); setReason(''); }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50">Từ chối</button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {rejecting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <form onSubmit={reject} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
              <div className="bg-rose-600 p-5">
                <h3 className="text-lg font-black text-white">Từ chối ca trực</h3>
                <p className="mt-1 text-xs font-semibold text-rose-50">Lý do là tùy chọn nhưng vẫn được hiển thị trong lịch sử của nhân viên.</p>
              </div>
              <div className="space-y-4 p-5">
                <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600">
                  {rejecting.staff?.fullName} · {formatDateTime(rejecting.startTime)}
                </div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">Lý do từ chối <span className="text-slate-400">(có thể để trống)</span></label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} rows={4} placeholder="VD: Ca này trùng với lịch bảo trì thiết bị..." className="w-full resize-none rounded-2xl border border-slate-200 p-3 text-sm font-semibold outline-none transition-colors focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setRejecting(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Hủy</button>
                  <button type="submit" disabled={Boolean(busyId)} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-black text-white hover:bg-rose-700 disabled:opacity-50">Xác nhận từ chối</button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
