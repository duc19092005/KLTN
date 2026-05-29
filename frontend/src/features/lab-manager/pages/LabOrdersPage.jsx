import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';

const STATUS_FILTERS = ['', 'ORDERED', 'IN_PROGRESS', 'RESULT_READY', 'CANCELLED'];
const emptyResult = { files: [], note: '' };

function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function getStatusUI(status) {
  const map = {
    ORDERED: { label: 'MỚI TẠO', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
    IN_PROGRESS: { label: 'ĐANG XỬ LÝ', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    RESULT_READY: { label: 'ĐÃ CÓ KẾT QUẢ', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    CANCELLED: { label: 'ĐÃ HỦY', cls: 'bg-red-100 text-red-800 border-red-200' }
  };
  return map[status] || map.ORDERED;
}

export default function LabOrdersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [filter, setFilter] = useState('ORDERED');
  const [query, setQuery] = useState('');

  const [form, setForm] = useState(emptyResult);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const res = await medicalOrderService.list(filter ? { status: filter } : {});
      const items = getItems(res.data);
      setOrders(items);

      if (activeOrder) {
        const updatedActive = items.find((o) => o.id === activeOrder.id);
        setActiveOrder(updatedActive || null);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Không tải được chỉ định xét nghiệm');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filter]);

  useEffect(() => { setForm(emptyResult); setError(''); setSuccess(''); }, [activeOrder?.id]);

  const filteredOrders = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return orders;
    return orders.filter((o) =>
      [o.orderCode, o.orderType, o.patient?.fullName, o.patient?.patientCode, o.doctor?.staffProfile?.fullName]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(text))
    );
  }, [orders, query]);

  const updateStatus = async (status) => {
    if (!activeOrder) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await medicalOrderService.updateStatus(activeOrder.id, status);
      setSuccess(`Đã cập nhật trạng thái: ${getStatusUI(status).label}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Không cập nhật được trạng thái');
    } finally {
      setBusy(false);
    }
  };

  const submitResult = async (event) => {
    event.preventDefault();
    if (!activeOrder) return;

    setBusy(true); setError(''); setSuccess('');
    try {
      if (!form.files?.length) {
        setError('Vui lòng upload ít nhất một file PDF hoặc ảnh kết quả.');
        return;
      }
      const uploadRes = await medicalOrderService.uploadResultFiles(activeOrder.id, form.files);
      await medicalOrderService.createResult(activeOrder.id, { files: uploadRes.data, note: form.note });

      setSuccess('Đã trả kết quả về cho Bác sĩ thành công.');
      setForm(emptyResult);
      await load();

      // Có thể tự động đóng modal sau khi thành công nếu muốn:
      // setActiveOrder(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Lỗi hệ thống khi trả kết quả');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="orders" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-[1440px] mx-auto min-h-[calc(100vh-100px)] pb-10">

        {/* Header Section */}
        <div className="mb-6 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.28em] font-black text-emerald-600 mb-2">Workspace</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Workbench Xét Nghiệm</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">Quản lý các chỉ định xét nghiệm, chuyển trạng thái xử lý mẫu và tải lên kết quả lâm sàng (PDF/Hình ảnh) để trả về cho Bác sĩ.</p>
        </div>

        {/* Cảnh báo (Alerts) */}
        {(success || error) && (
          <div className="mb-6">
            {success && <Alert tone="success" message={success} />}
            {error && <Alert tone="error" message={error} />}
          </div>
        )}

        {/* Controls: Search & Filter */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã chỉ định, tên bệnh nhân..."
            className="w-full md:max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all shadow-sm"
          />
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s || 'ALL'}
                onClick={() => setFilter(s)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border shadow-sm ${filter === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                {s ? getStatusUI(s).label : 'TẤT CẢ'}
              </button>
            ))}
          </div>
        </div>

        {/* Grid Danh sách Orders */}
        {loading ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm"><LoadingIndicator size="lg" label="Đang tải danh sách..." /></div>
        ) : filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onClick={() => setActiveOrder(o)}
              />
            ))}
          </div>
        ) : (
          <Empty title="Chưa có chỉ định nào" desc="Không tìm thấy chỉ định xét nghiệm phù hợp với điều kiện lọc." />
        )}

      </div>

      {/* POPUP: Order Detail Modal */}
      {activeOrder && (
        <OrderModal
          order={activeOrder}
          form={form}
          setForm={setForm}
          onStatus={updateStatus}
          onSubmit={submitResult}
          busy={busy}
          onClose={() => setActiveOrder(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ----------------------------------------------------------------------
// CÁC COMPONENT PHỤ TRỢ
// ----------------------------------------------------------------------

function OrderCard({ order, onClick }) {
  const statusInfo = getStatusUI(order.status);
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-3xl p-6 transition-all border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-100/50 flex flex-col h-full group"
    >
      <div className="flex justify-between items-start mb-4 w-full">
        <span className="text-xs uppercase tracking-wider font-black text-slate-400 group-hover:text-emerald-600 transition-colors">{order.orderCode}</span>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border ${statusInfo.cls}`}>{statusInfo.label}</span>
      </div>
      <h3 className="font-black text-slate-900 text-lg mb-2 line-clamp-2">{order.orderType}</h3>

      <div className="mt-auto pt-4 border-t border-slate-100">
        <p className="text-sm text-slate-600">
          <span className="text-xs font-bold text-slate-400 block mb-1">Bệnh nhân</span>
          <span className="font-bold text-slate-800">{order.patient?.fullName}</span>
          <span className="text-slate-400 ml-1">({order.patient?.patientCode})</span>
        </p>
      </div>
    </button>
  );
}

function OrderModal({ order, form, setForm, onStatus, onSubmit, busy, onClose }) {
  const statusInfo = getStatusUI(order.status);
  const isOrdered = order.status === 'ORDERED';
  const isInProgress = order.status === 'IN_PROGRESS';

  // Chặn scroll body khi mở modal
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Lớp nền mờ */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Nội dung Popup */}
      <div className="relative w-full max-w-4xl bg-white rounded-[32px] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header Modal */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">{order.orderCode}</span>
              <span className={`text-xs font-black px-2.5 py-1 rounded-lg border ${statusInfo.cls}`}>{statusInfo.label}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{order.orderType}</h2>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body Modal (Vùng cuộn) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-5 text-white">
            <div>
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Thao tác nhanh</p>
              <p className="text-sm font-medium">Bấm nhận xử lý mẫu trước khi tải lên kết quả.</p>
            </div>
            {isOrdered ? (
              <button
                disabled={busy}
                onClick={() => onStatus('IN_PROGRESS')}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
              >
                NHẬN XỬ LÝ MẪU
              </button>
            ) : (
              <span className="px-4 py-2 bg-slate-800 rounded-xl text-sm font-bold text-slate-300">Đã tiếp nhận</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Bệnh nhân" value={`${order.patient?.fullName} - ${order.patient?.patientCode}`} />
            <InfoCard label="Bác sĩ chỉ định" value={`BS. ${order.doctor?.staffProfile?.fullName || 'N/A'}`} />
            <div className="md:col-span-2">
              <InfoCard label="Ghi chú lâm sàng từ bác sĩ" value={order.clinicalNote || 'Không có ghi chú'} />
            </div>
          </div>

          <hr className="border-slate-200" />

          {isInProgress && (
            <form onSubmit={onSubmit} className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 space-y-5">
              <div>
                <h3 className="text-xl font-black text-slate-900">Trả Kết Quả</h3>
                <p className="text-sm text-slate-600 mt-1">Tải lên hình ảnh chụp hoặc file PDF kết quả xét nghiệm.</p>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Ghi chú cho Bác sĩ (Tùy chọn)</label>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  rows={3}
                  placeholder="VD: Mẫu máu khó lấy, hình ảnh hơi mờ do bệnh nhân cử động..."
                  className="w-full rounded-2xl border border-slate-200 p-4 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-2 uppercase tracking-wider">Tệp đính kèm (PDF, JPG, PNG)</label>
                <label className="flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50 transition-colors cursor-pointer group">
                  <span className="text-sm font-black text-emerald-600 group-hover:text-emerald-700">Click hoặc Kéo thả file vào đây</span>
                  <span className="text-xs text-slate-500 mt-2 font-medium">Tối đa 10MB/file. Chọn được nhiều file.</span>
                  <input
                    type="file" multiple accept=".pdf, image/*" className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      setForm({ ...form, files: [...(form.files || []), ...picked].slice(0, 10) });
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {form.files?.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {form.files.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                      <span className="text-sm font-bold text-slate-700 truncate mr-3">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, files: form.files.filter((_, i) => i !== idx) })}
                        className="text-[10px] uppercase font-black px-2 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                      >
                        XÓA
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !form.files?.length}
                className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 disabled:shadow-none"
              >
                {busy ? 'Đang tải lên...' : 'Hoàn Tất & Gửi Bác Sĩ'}
              </button>
            </form>
          )}

          {!isOrdered && !isInProgress && (
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
              <h3 className="text-lg font-black text-slate-900 mb-4">Kết quả đã ghi nhận</h3>
              {order.results?.length > 0 ? (
                <div className="space-y-4">
                  {order.results.map((r, i) => (
                    <div key={r.id || i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                      {r.note && <p className="text-sm text-slate-700 mb-4"><span className="font-bold text-slate-900">Ghi chú:</span> {r.note}</p>}
                      <div className="flex flex-wrap gap-2">
                        {r.files?.map((f, j) => (
                          <a key={j} href={f.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-bold rounded-xl border border-slate-200 hover:bg-slate-200 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            {f.originalName || 'Xem tệp đính kèm'}
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 font-medium italic">Không có file hiển thị.</p>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1.5">{label}</p>
      <p className="text-sm font-bold text-slate-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Alert({ tone, message }) {
  const isError = tone === 'error';
  return (
    <div className={`p-4 rounded-2xl border text-sm font-bold shadow-sm ${isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
      {message}
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      </div>
      <span className="text-slate-900 font-black text-lg mb-1">{title}</span>
      <p className="text-sm text-slate-500 max-w-sm">{desc}</p>
    </div>
  );
}