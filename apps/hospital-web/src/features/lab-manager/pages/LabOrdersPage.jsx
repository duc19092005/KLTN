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

  const openResultFile = async (fileId) => {
    try {
      const dl = await medicalOrderService.getResultFileDownloadUrl(fileId);
      if (dl.data?.url) {
        window.open(dl.data.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast.error('Không tải được tệp kết quả hoặc bạn không có quyền truy cập.');
    }
  };

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
  }, []);

  const statusCounts = useMemo(() => orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, { ALL: orders.length }), [orders]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus = !status || order.status === status;
      if (!matchesStatus) return false;
      if (!text) return true;

      return [
        order.orderCode,
        order.orderType,
        order.note,
        order.patient?.fullName,
        order.patient?.patientCode,
        order.visit?.visitCode,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(text));
    });
  }, [orders, query, status]);

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
      <div className="mx-auto max-w-[1600px] space-y-5 pb-12">
        <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-lg font-black text-slate-950">Phiếu chỉ định CLS</h1>
              </div>
              <span className="w-fit rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-black text-cyan-700">{filteredOrders.length} phiếu</span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm mã phiếu, bệnh nhân, loại chỉ định..."
                className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50"
              />
              <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[760px]">
                <FilterPill label="Tất cả" count={statusCounts.ALL || 0} active={!status} onClick={() => setStatus('')} />
                {Object.entries(MEDICAL_ORDER_STATUS).map(([key, value]) => (
                  <FilterPill key={key} label={value.shortLabel || value.label} count={statusCounts[key] || 0} active={status === key} onClick={() => setStatus(key)} />
                ))}
              </div>
            </div>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="py-16"><LoadingIndicator size="lg" label="Đang tải phiếu CLS..." /></div>
            ) : filteredOrders.length > 0 ? (
              <OrderTable orders={filteredOrders} onOpen={setSelectedOrder} onStatusChange={handleStatusChange} />
            ) : (
              <Empty title="Không có phiếu phù hợp" />
            )}
          </div>
        </section>
      </div>

      {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onStatusChange={handleStatusChange} onReload={loadOrders} onOpenFile={openResultFile} />}
    </DashboardLayout>
  );
}

function OrderTable({ orders, onOpen, onStatusChange }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100">
      <table className="ui-table min-w-full text-left">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            <th className="px-5 py-3">Phiếu</th>
            <th className="px-5 py-3">Bệnh nhân</th>
            <th className="px-5 py-3">Chỉ định</th>
            <th className="px-5 py-3">Trạng thái</th>
            <th className="px-5 py-3 text-right">Thao tác</th>
          </tr>
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
    <tr className="bg-white transition-colors hover:bg-slate-50">
      <td className="whitespace-nowrap px-5 py-4"><strong className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-700">{order.orderCode || 'Chưa có mã'}</strong><p className="mt-2 text-[11px] font-semibold text-slate-500">{formatDate(order.createdAt)}</p></td>
      <td className="min-w-[240px] px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-xs font-black text-cyan-700 ring-1 ring-cyan-100">{(order.patient?.fullName || 'BN').slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{order.patient?.fullName || 'Chưa có tên'}</p><p className="text-xs font-semibold text-slate-500">{order.patient?.patientCode || 'Chưa có mã BN'}</p></div></div></td>
      <td className="px-5 py-4"><p className="text-sm font-black text-slate-800">{order.orderType || 'CLS'}</p><p className="line-clamp-1 text-xs font-semibold text-slate-500">{order.note || 'Không có ghi chú'}</p></td>
      <td className="whitespace-nowrap px-5 py-4"><StatusBadge status={order.status} /></td>
      <td className="px-5 py-4 text-right">
        <div className="flex justify-end gap-2">
          <QuickAction order={order} onOpen={onOpen} onStatusChange={onStatusChange} />
          {order.status === 'RESULT_READY' && (
            <button type="button" onClick={onOpen} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Chi tiết</button>
          )}
        </div>
      </td>
    </tr>
  );
}

function QuickAction({ order, onOpen, onStatusChange }) {
  if (order.status === 'ORDERED') return <button type="button" onClick={() => onStatusChange(order, 'IN_PROGRESS')} className="min-h-[36px] rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700 hover:bg-cyan-100">Tiếp nhận</button>;
  if (order.status === 'IN_PROGRESS') return <button type="button" onClick={onOpen} className="min-h-[36px] rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white shadow-sm hover:bg-cyan-700">Trả kết quả</button>;
  return null;
}

function OrderModal({ order, onClose, onStatusChange, onReload, onOpenFile }) {
  const toast = useToast();
  const [note, setNote] = useState(order.results?.[0]?.note || '');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const selectedFiles = Array.from(files || []);
  const result = order.results?.[0] || null;
  const resultFiles = result?.files || [];
  const isResultReady = order.status === 'RESULT_READY';

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const submitResult = async () => {
    if (!files.length) {
      toast.error('Vui lòng tải lên ít nhất một file kết quả PDF hoặc hình ảnh.');
      return;
    }

    setSubmitting(true);
    try {
      const uploadRes = await medicalOrderService.uploadResultFiles(order.id, files);
      await medicalOrderService.createResult(order.id, { note, files: uploadRes.data || [] });
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
      <div className="relative flex max-h-[90vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-cyan-50 px-2.5 py-1 text-xs font-black text-cyan-700">{order.orderCode || 'Chưa có mã'}</span><StatusBadge status={order.status} /></div>
            <h2 className="mt-2 text-xl font-black text-slate-950">{order.orderType || 'Chỉ định CLS'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">Đóng</button>
        </div>
        <div className="grid flex-1 gap-5 overflow-y-auto bg-slate-50/70 p-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <InfoCard label="Bệnh nhân" value={`${order.patient?.fullName || 'Chưa có tên'} · ${order.patient?.patientCode || 'Chưa có mã BN'}`} />
            <InfoCard label="Lượt khám" value={order.visit?.visitCode || 'Chưa có mã lượt'} />
            <InfoCard label="Ghi chú chỉ định" value={order.note || 'Không có'} />
          </section>
          {isResultReady ? (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Kết quả đã trả</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Chi tiết kết quả cận lâm sàng</h3>
              <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Nhận xét / kết luận</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-bold text-slate-900">{result?.note || 'Không có nhận xét'}</p>
              </div>
              <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Tệp kết quả ({resultFiles.length})</p>
                {resultFiles.length ? (
                  <div className="mt-2 space-y-2">
                    {resultFiles.map((file, index) => (
                      <button key={file.id || `${file.originalName}-${index}`} type="button" onClick={() => onOpenFile(file.id)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-left text-xs ring-1 ring-emerald-100 hover:bg-emerald-50">
                        <span className="min-w-0 truncate font-black text-slate-800">{file.originalName || file.fileName || 'Tệp kết quả'}</span>
                        <span className="shrink-0 font-bold text-slate-500">{formatFileSize(file.size)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm font-semibold text-slate-500">Chưa có tệp kết quả.</p>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-600">Trả kết quả</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">Nhập kết quả cận lâm sàng</h3>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="Nhập nhận xét / kết luận cận lâm sàng..." className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none transition-colors focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-50" />
              <label className="mt-3 block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600 transition-colors hover:border-cyan-300 hover:bg-cyan-50/40">
                <input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFiles(e.target.files)} className="hidden" />
                <span className="block text-center text-slate-900">Tải lên file kết quả bắt buộc</span>
                <span className="mt-1 block text-center text-xs font-semibold text-slate-500">Chấp nhận PDF, JPG, PNG, WEBP · tối đa 10MB/tệp</span>
                <span className="mt-3 block rounded-xl bg-white px-3 py-2 text-center text-xs font-black text-cyan-700 ring-1 ring-cyan-100">Chọn tệp từ máy tính</span>
              </label>
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-700">Tệp đã chọn ({selectedFiles.length})</p>
                  <div className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-cyan-100">
                        <span className="min-w-0 truncate font-black text-slate-800">{file.name}</span>
                        <span className="shrink-0 font-bold text-slate-500">{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button type="button" disabled={submitting} onClick={submitResult} className="mt-4 min-h-[44px] w-full rounded-xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Đang lưu...' : 'Lưu và trả kết quả'}</button>
            </section>
          )}
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
  return <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-bold text-slate-900">{value}</p></div>;
}

function Empty({ title }) {
  return <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center"><strong className="text-slate-900">{title}</strong><p className="mt-1 text-sm font-semibold text-slate-500">Thử đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.</p></div>;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa cập nhật';
}

function FilterPill({ label, count, active, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black transition-colors ${active ? 'border-cyan-600 bg-cyan-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
    </button>
  );
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
