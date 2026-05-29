import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../shared/components/DashboardLayout';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';
import { useAuth } from '../../../providers/AuthProvider';
import { medicalOrderService } from '../../medical-order/apis/medicalOrderService';
import { LAB_MANAGER_NAV_ITEMS, labManagerRouteFor } from '../constants/navigation';

// Hàm hỗ trợ
function getItems(data) {
  return Array.isArray(data) ? data : data?.items || [];
}

function fileUrl(file) {
  return file.url?.startsWith('http')
    ? file.url
    : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001'}${file.url}`;
}

export default function LabResultsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedResult, setSelectedResult] = useState(null);

  // Load dữ liệu
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        // Chỉ lấy các order đã có kết quả
        const res = await medicalOrderService.list({ status: 'RESULT_READY' });
        if (mounted) setOrders(getItems(res.data));
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Không tải được danh sách kết quả');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Trích xuất mảng results từ mảng orders
  const results = useMemo(() => {
    return orders.flatMap((order) => (order.results || []).map((result) => ({ ...result, order })));
  }, [orders]);

  // Lọc kết quả theo từ khóa
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return results;

    return results.filter((r) =>
      [
        r.resultCode,
        r.note,
        r.order?.orderCode,
        r.order?.orderType,
        r.order?.patient?.fullName,
        r.order?.patient?.patientCode
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(text))
    );
  }, [query, results]);

  return (
    <DashboardLayout user={user} navItems={LAB_MANAGER_NAV_ITEMS} activeItem="results" onNavigate={(id) => navigate(labManagerRouteFor(id))} onLogout={logout}>
      <div className="max-w-[1440px] mx-auto min-h-[calc(100vh-100px)] pb-10">

        {/* Header Section */}
        <div className="mb-6 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.28em] font-black text-blue-600 mb-2">MedicalResult Archive</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Kho Lưu Trữ Kết Quả</h1>
          <p className="mt-2 text-sm text-slate-500 max-w-2xl">Tra cứu nhanh các kết quả xét nghiệm đã được tải lên, xem lại ghi chú của kỹ thuật viên và tải xuống file đính kèm (PDF/Hình ảnh).</p>
        </div>

        {error && (
          <div className="mb-6">
            <Alert tone="error" message={error} />
          </div>
        )}

        {/* Controls: Search */}
        <div className="mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm mã kết quả, tên bệnh nhân, loại chỉ định..."
            className="w-full md:max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all shadow-sm"
          />
        </div>

        {/* Grid Danh sách Kết quả */}
        {loading ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
            <LoadingIndicator size="lg" label="Đang tải dữ liệu kho lưu trữ..." />
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((result) => (
              <ResultCard
                key={result.id}
                result={result}
                onClick={() => setSelectedResult(result)}
              />
            ))}
          </div>
        ) : (
          <Empty title="Chưa có kết quả nào" desc="Các MedicalResult phù hợp với từ khóa tìm kiếm sẽ hiển thị tại đây." />
        )}

      </div>

      {/* POPUP: Result Detail Modal */}
      {selectedResult && (
        <ResultModal
          result={selectedResult}
          onClose={() => setSelectedResult(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ----------------------------------------------------------------------
// CÁC COMPONENT PHỤ TRỢ
// ----------------------------------------------------------------------

function ResultCard({ result, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-3xl p-6 transition-all border border-slate-200 bg-white hover:border-blue-300 hover:shadow-xl hover:shadow-blue-100/50 flex flex-col h-full group"
    >
      <div className="flex justify-between items-start mb-4 w-full">
        <span className="text-xs uppercase tracking-wider font-black text-slate-400 group-hover:text-blue-600 transition-colors">{result.resultCode}</span>
        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black border bg-emerald-100 text-emerald-800 border-emerald-200">ĐÃ TRẢ KQ</span>
      </div>

      <h3 className="font-black text-slate-900 text-lg mb-2 line-clamp-2">{result.order?.orderType}</h3>

      <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
        <p className="text-sm text-slate-600">
          <span className="text-xs font-bold text-slate-400 block mb-1">Bệnh nhân</span>
          <span className="font-bold text-slate-800">{result.order?.patient?.fullName}</span>
          <span className="text-slate-400 ml-1">({result.order?.patient?.patientCode})</span>
        </p>

        {/* Hiển thị số lượng file đính kèm */}
        {result.files?.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50/80 w-fit px-2.5 py-1.5 rounded-lg border border-blue-100">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
            {result.files.length} Tệp đính kèm
          </div>
        )}
      </div>
    </button>
  );
}

function ResultModal({ result, onClose }) {
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
              <span className="text-xs font-black text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-lg">Mã KQ: {result.resultCode}</span>
              <span className="text-xs font-black px-2.5 py-1 rounded-lg border bg-white text-slate-700 border-slate-200 shadow-sm">Mã Order: {result.order?.orderCode || 'N/A'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{result.order?.orderType}</h2>
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

          {/* Grid thông tin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Bệnh nhân" value={`${result.order?.patient?.fullName || 'N/A'} - ${result.order?.patient?.patientCode || ''}`} />
            <InfoCard label="Loại chỉ định" value={result.order?.orderType || 'N/A'} />
            <div className="md:col-span-2">
              <InfoCard label="Ghi chú từ Lab" value={result.note || 'Không có ghi chú nào được lưu lại.'} />
            </div>
          </div>

          {/* Danh sách File đính kèm */}
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              File Kết Quả Đính Kèm
            </h3>

            {result.files?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {result.files.map((file) => (
                  <a
                    key={file.id}
                    href={fileUrl(file)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-4 p-4 rounded-2xl border border-blue-100 bg-white hover:border-blue-300 hover:shadow-md transition-all group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-black text-slate-800 truncate">{file.originalName}</span>
                      <span className="block text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                        {file.mimeType?.split('/')[1] || 'FILE'} · {((file.size || 0) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center">
                <p className="text-sm font-bold text-slate-500">Không có tệp đính kèm nào được ghi nhận cho kết quả này.</p>
              </div>
            )}
          </div>
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
  return (
    <div className={`p-4 rounded-2xl border text-sm font-bold shadow-sm ${tone === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
      {message}
    </div>
  );
}

function Empty({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
      </div>
      <span className="text-slate-900 font-black text-lg mb-1">{title}</span>
      <p className="text-sm text-slate-500 max-w-sm">{desc}</p>
    </div>
  );
}