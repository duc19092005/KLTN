import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { useToast } from '../../../providers/ToastProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';
import { getMedicalOrderStatus, MEDICAL_ORDER_STATUS } from '../constants/medicalOrderStatus';
import { FileSpreadsheet, Search, Filter, UploadCloud, Download, CheckCircle2, AlertCircle, FileText, X, ArrowRight } from 'lucide-react';

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
      toast.success('Đã cập nhật trạng thái phiếu CLS thành công!');
      await loadOrders();
      setSelectedOrder((current) => current?.id === order.id ? { ...current, status: nextStatus } : current);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không cập nhật được trạng thái');
    }
  };

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="orders" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="mx-auto max-w-[1600px] space-y-6 antialiased pb-12">
        {/* HERO BANNER */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-sky-50/80 blur-2xl pointer-events-none" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/25 shrink-0">
                <FileSpreadsheet className="w-6 h-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-100">
                    Phân hệ Cận lâm sàng
                  </span>
                  <span className="text-xs font-semibold text-slate-400">• Quản lý phiếu chỉ định</span>
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900 tracking-tight">
                  Phiếu chỉ định Cận lâm sàng
                </h1>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/lab-manager/results')}
              className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              Xem lịch sử trả kết quả
            </button>
          </div>
        </section>

        {/* MAIN SECTION TABLE & FILTERS */}
        <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-100 p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Danh sách phiếu yêu cầu từ Bác sĩ</h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">
                  Hiển thị {filteredOrders.length} trên tổng số {orders.length} phiếu chỉ định
                </p>
              </div>
              <span className="w-fit rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1 text-xs font-bold text-sky-700">
                {filteredOrders.length} phiếu
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(280px,1fr)_auto]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm mã phiếu, bệnh nhân, loại chỉ định..."
                  className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 lg:max-w-[760px] scrollbar-thin">
                <FilterPill label="Tất cả" count={statusCounts.ALL || 0} active={!status} onClick={() => setStatus('')} />
                {Object.entries(MEDICAL_ORDER_STATUS).map(([key, value]) => (
                  <FilterPill key={key} label={value.shortLabel || value.label} count={statusCounts[key] || 0} active={status === key} onClick={() => setStatus(key)} />
                ))}
              </div>
            </div>
          </div>

          <div>
            {loading ? (
              <div className="py-16"><LoadingIndicator size="lg" label="Đang tải danh sách phiếu..." /></div>
            ) : filteredOrders.length > 0 ? (
              <OrderTable orders={filteredOrders} onOpen={setSelectedOrder} onStatusChange={handleStatusChange} />
            ) : (
              <Empty title="Không tìm thấy phiếu phù hợp" />
            )}
          </div>
        </section>
      </div>

      {/* DETAIL & UPLOAD RESULT MODAL */}
      {selectedOrder && (
        <OrderModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={handleStatusChange}
          onReload={loadOrders}
          onOpenFile={openResultFile}
        />
      )}
    </DashboardLayout>
  );
}

function OrderTable({ orders, onOpen, onStatusChange }) {
  return (
    <div className="overflow-x-auto">
      <table className="ui-table min-w-full text-left">
        <thead className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-6 py-3.5">Mã phiếu</th>
            <th className="px-6 py-3.5">Bệnh nhân</th>
            <th className="px-6 py-3.5">Loại chỉ định</th>
            <th className="px-6 py-3.5">Trạng thái</th>
            <th className="px-6 py-3.5 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <OrderRow key={order.id} order={order} onOpen={() => onOpen(order)} onStatusChange={onStatusChange} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderRow({ order, onOpen, onStatusChange }) {
  return (
    <tr className="bg-white transition-colors hover:bg-sky-50/30">
      <td className="whitespace-nowrap px-6 py-4">
        <strong className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700 border border-slate-200/60">
          {order.orderCode || 'Chưa có mã'}
        </strong>
        <p className="mt-1 text-[11px] font-medium text-slate-400">{formatDate(order.createdAt)}</p>
      </td>
      <td className="min-w-[240px] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-2xl bg-sky-100 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
            {(order.patient?.fullName || 'BN').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">{order.patient?.fullName || 'Chưa có tên'}</p>
            <p className="text-[11px] font-medium text-slate-500">{order.patient?.patientCode || 'N/A'}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <p className="text-xs font-bold text-slate-800">{order.orderType || 'CLS'}</p>
        <p className="line-clamp-1 text-[11px] font-medium text-slate-400">{order.note || 'Không có ghi chú'}</p>
      </td>
      <td className="whitespace-nowrap px-6 py-4">
        <StatusBadge status={order.status} />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="flex justify-end gap-2">
          <QuickAction order={order} onOpen={onOpen} onStatusChange={onStatusChange} />
          {order.status === 'RESULT_READY' && (
            <button
              type="button"
              onClick={onOpen}
              className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Xem chi tiết
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function QuickAction({ order, onOpen, onStatusChange }) {
  if (order.status === 'ORDERED') {
    return (
      <button
        type="button"
        onClick={() => onStatusChange(order, 'IN_PROGRESS')}
        className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-colors"
      >
        Tiếp nhận phiếu
      </button>
    );
  }
  if (order.status === 'IN_PROGRESS') {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-sky-700 transition-all flex items-center gap-1.5"
      >
        <UploadCloud className="w-3.5 h-3.5" />
        <span>Trả kết quả</span>
      </button>
    );
  }
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
      toast.success('Đã lưu kết quả cận lâm sàng thành công!');
      await onReload();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không lưu được kết quả');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 antialiased">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl animate-fadeIn">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-mono font-bold text-sky-700 border border-sky-100">
                {order.orderCode || 'Chưa có mã'}
              </span>
              <StatusBadge status={order.status} />
            </div>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{order.orderType || 'Chỉ định CLS'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="grid flex-1 gap-6 overflow-y-auto bg-slate-50/50 p-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-3">
            <InfoCard label="Bệnh nhân" value={`${order.patient?.fullName || 'Chưa có tên'} • Mã BN: ${order.patient?.patientCode || 'N/A'}`} />
            <InfoCard label="Mã lượt khám" value={order.visit?.visitCode || 'Chưa có mã lượt'} />
            <InfoCard label="Ghi chú từ bác sĩ" value={order.note || 'Không có ghi chú'} />
          </section>

          {isResultReady ? (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">Kết quả đã trả</p>
                <h3 className="text-base font-bold text-slate-900">Chi tiết kết quả cận lâm sàng</h3>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Nhận xét / Kết luận</p>
                <p className="mt-1 whitespace-pre-wrap text-xs font-bold text-slate-900">{result?.note || 'Không có nhận xét'}</p>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3.5 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Tệp kết quả đã tải lên ({resultFiles.length})
                </p>
                {resultFiles.length ? (
                  <div className="space-y-2">
                    {resultFiles.map((file, index) => (
                      <button
                        key={file.id || `${file.originalName}-${index}`}
                        type="button"
                        onClick={() => onOpenFile(file.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3.5 py-2 text-left text-xs font-bold text-slate-800 border border-emerald-100 hover:bg-emerald-50 transition-colors shadow-xs"
                      >
                        <span className="min-w-0 truncate">{file.originalName || file.fileName || 'Tệp kết quả'}</span>
                        <span className="shrink-0 text-slate-400 font-medium">{formatFileSize(file.size)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-medium text-slate-500">Chưa có tệp kết quả.</p>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600">Thao tác trả kết quả</p>
                <h3 className="text-base font-bold text-slate-900">Nhập thông tin & Tải tệp kết quả</h3>
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="Nhập nhận xét / kết luận cận lâm sàng..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />

              <label className="block cursor-pointer rounded-2xl border border-dashed border-sky-300 bg-sky-50/40 p-4 text-center transition-all hover:bg-sky-50">
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) => setFiles(e.target.files)}
                  className="hidden"
                />
                <UploadCloud className="w-8 h-8 text-sky-600 mx-auto mb-1" />
                <span className="block text-xs font-bold text-slate-900">Tải lên file kết quả (PDF, JPG, PNG)</span>
                <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Dung lượng tối đa 10MB mỗi tệp</span>
              </label>

              {selectedFiles.length > 0 && (
                <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50/50 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-sky-700">Tệp đã chọn ({selectedFiles.length})</p>
                  <div className="space-y-1.5">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 border border-sky-100">
                        <span className="min-w-0 truncate">{file.name}</span>
                        <span className="shrink-0 text-slate-400 font-medium">{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={submitting}
                onClick={submitResult}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold text-white shadow-xs hover:bg-sky-700 disabled:opacity-60 transition-all"
              >
                {submitting ? <LoadingIndicator size="sm" tone="white" /> : 'Lưu và hoàn tất trả kết quả'}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function StatusBadge({ status }) {
  const st = getMedicalOrderStatus(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${st.color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${st.dot}`} />
      {st.shortLabel}
    </span>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 break-words text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}

function Empty({ title }) {
  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 grid place-items-center mx-auto mb-3">
        <Filter className="w-6 h-6 stroke-[1.75]" />
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="text-xs font-medium text-slate-400 mt-1">Thử đổi bộ lọc trạng thái hoặc nhập từ khóa khác.</p>
    </div>
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Chưa cập nhật';
}

function FilterPill({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
        active ? 'border-sky-600 bg-sky-600 text-white shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      <span>{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
}

function formatFileSize(bytes = 0) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
