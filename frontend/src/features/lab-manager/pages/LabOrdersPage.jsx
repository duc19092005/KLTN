import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus, MEDICAL_ORDER_STATUS } from '../constants/medicalOrderStatus';

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

export default function LabOrdersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await medicalOrderService.list(status ? { status } : {});
      setOrders(getItems(res.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không tải được danh sách phiếu cận lâm sàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [status]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return orders;

    return orders.filter((order) => [
      order.orderCode,
      order.orderType,
      order.note,
      order.patient?.fullName,
      order.patient?.patientCode,
      order.visit?.visitCode,
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(text)));
  }, [orders, query]);

  const handleStatusChange = async (order, nextStatus) => {
    try {
      await medicalOrderService.updateStatus(order.id, nextStatus);
      toast.success('Đã cập nhật trạng thái phiếu CLS');
      await loadOrders();
      setSelectedOrder((current) => current?.id === order.id ? { ...current, status: nextStatus } : current);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không cập nhật được trạng thái');
    }
  };

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="orders" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-7xl mx-auto space-y-4 pb-10">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] font-black text-cyan-600">Phòng cận lâm sàng</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950">Phiếu chỉ định CLS</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Tiếp nhận, theo dõi và trả kết quả các chỉ định xét nghiệm / chẩn đoán hình ảnh.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={loadOrders} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Làm mới</button>
              <button type="button" onClick={() => navigate('/lab-manager/results')} className="rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:bg-cyan-700">Kho kết quả</button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm mã phiếu, bệnh nhân, loại chỉ định..."
              className="w-full lg:max-w-md rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold outline-none focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-700 outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50">
                <option value="">Tất cả trạng thái</option>
                {Object.entries(MEDICAL_ORDER_STATUS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
              </select>
              <span className="rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700">{filteredOrders.length} phiếu</span>
            </div>
          </div>

          {loading ? (
            <div className="py-16"><LoadingIndicator size="lg" label="Đang tải phiếu CLS..." /></div>
          ) : filteredOrders.length > 0 ? (
            <OrderTable orders={filteredOrders} onOpen={setSelectedOrder} onStatusChange={handleStatusChange} />
          ) : (
            <Empty title="Không có phiếu phù hợp" />
          )}
        </section>
      </div>

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onStatusChange={handleStatusChange} onReload={loadOrders} />}
    </DashboardLayout>
  );
}

function OrderTable({ orders, onOpen, onStatusChange }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <table className="ui-table min-w-full text-left">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
          <tr><th className="px-4 py-3">Phiếu</th><th className="px-4 py-3">Bệnh nhân</th><th className="px-4 py-3">Chỉ định</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3 text-right">Thao tác</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => <OrderRow key={order.id} order={order} onOpen={() => onOpen(order)} onStatusChange={onStatusChange} />)}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({ order, onOpen, onStatusChange }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-4"><strong className="font-mono text-xs text-slate-900">{order.orderCode || 'N/A'}</strong><p className="text-[11px] font-semibold text-slate-500">{formatDate(order.createdAt)}</p></td>
      <td className="px-4 py-4"><p className="text-sm font-black text-slate-900">{order.patient?.fullName || 'N/A'}</p><p className="text-xs font-semibold text-slate-500">{order.patient?.patientCode || ''}</p></td>
      <td className="px-4 py-4"><p className="text-sm font-bold text-slate-800">{order.orderType || 'CLS'}</p><p className="text-xs font-semibold text-slate-500 line-clamp-1">{order.note || 'Không có ghi chú'}</p></td>
      <td className="px-4 py-4"><StatusBadge status={order.status} /></td>
      <td className="px-4 py-4 text-right"><div className="flex justify-end gap-2"><QuickAction order={order} onStatusChange={onStatusChange} /><button type="button" onClick={onOpen} className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-700">Chi tiết</button></div></td>
    </tr>
  );
}

function QuickAction({ order, onStatusChange }) {
  if (order.status === 'ORDERED') return <button type="button" onClick={() => onStatusChange(order, 'IN_PROGRESS')} className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100">Tiếp nhận</button>;
  if (order.status === 'IN_PROGRESS') return <button type="button" onClick={() => onStatusChange(order, 'RESULT_READY')} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">Hoàn tất</button>;
  return null;
}

function OrderModal({ order, onClose, onStatusChange, onReload }) {
  const toast = useToast();
  const [note, setNote] = useState(order.results?.[0]?.note || '');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const submitResult = async () => {
    setSubmitting(true);
    try {
      await medicalOrderService.createResult(order.id, { note });
      if (files.length) await medicalOrderService.uploadResultFiles(order.id, files);
      if (order.status !== 'RESULT_READY') await medicalOrderService.updateStatus(order.id, 'RESULT_READY');
      toast.success('Đã lưu kết quả cận lâm sàng');
      await onReload();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không lưu được kết quả');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div><div className="mb-2 flex flex-wrap gap-2"><span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700">{order.orderCode}</span><StatusBadge status={order.status} /></div><h2 className="text-xl font-black text-slate-950">{order.orderType || 'Chỉ định CLS'}</h2></div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200">×</button>
        </div>
        <div className="grid flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <InfoCard label="Bệnh nhân" value={`${order.patient?.fullName || 'N/A'} · ${order.patient?.patientCode || ''}`} />
            <InfoCard label="Lượt khám" value={order.visit?.visitCode || 'N/A'} />
            <InfoCard label="Ghi chú chỉ định" value={order.note || 'Không có'} />
            <div className="flex flex-wrap gap-2 pt-2"><QuickAction order={order} onStatusChange={onStatusChange} /></div>
          </section>
          <section className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <h3 className="mb-4 text-lg font-black text-slate-950">Nhập kết quả</h3>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="Nhập nhận xét / kết luận cận lâm sàng..." className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold outline-none focus:border-cyan-400 focus:ring-4 focus:ring-cyan-50" />
            <input type="file" multiple onChange={(e) => setFiles(e.target.files)} className="mt-3 block w-full rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-bold text-slate-600" />
            <button type="button" disabled={submitting} onClick={submitResult} className="mt-4 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Đang lưu...' : 'Lưu và trả kết quả'}</button>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = getMedicalOrderStatus(status);
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black ${st.color}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.shortLabel}</span>;
}

function InfoCard({ label, value }) {
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><p className="text-[11px] uppercase font-bold tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-bold text-slate-900 whitespace-pre-wrap">{value}</p></div>;
}

function Empty({ title }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><strong className="text-slate-900">{title}</strong></div>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'N/A';
}
