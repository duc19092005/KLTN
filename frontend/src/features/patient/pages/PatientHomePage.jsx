import React, { useState } from 'react';
import api from '../../../shared/apis/api';

export default function PatientHomePage() {
  const [qrText, setQrText] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  const resolveHistory = async (code = qrText) => {
    const value = String(code || '').trim();
    if (!value) {
      setError('Vui lòng nhập Mã hồ sơ/Mã QR.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/patients/verify-history', { qrCode: value });
      setHistory(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Không truy vấn được lịch sử hồ sơ.');
    } finally {
      setLoading(false);
    }
  };

  const decodeQrFromFile = async (file) => {
    const imageBitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    const context = canvas.getContext('2d');
    context.drawImage(imageBitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const { default: jsQR } = await import('jsqr');
    return jsQR(imageData.data, imageData.width, imageData.height)?.data || '';
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setManualMode(false);
    try {
      const decoded = await decodeQrFromFile(file);
      if (!decoded) {
        setManualMode(true);
        setError('Không thể đọc mã QR từ ảnh đã tải lên.');
        return;
      }
      setQrText(decoded);
      await resolveHistory(decoded);
    } catch {
      setManualMode(true);
      setError('Không thể đọc mã QR từ ảnh đã tải lên.');
    }
  };

  const visits = history?.visits || [];

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-cyan-50 px-4 py-10">
      <section className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-xl backdrop-blur">
        <div className="bg-gradient-to-br from-cyan-600 via-cyan-600 to-cyan-700 p-8 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-100">Patient Home</p>
          <h1 className="mt-2 text-3xl font-black">Tra cứu hồ sơ khám bằng QR</h1>
          <p className="mt-2 max-w-2xl text-sm font-semibold text-cyan-50">Quét hoặc upload ảnh mã QR trong sổ khám để hệ thống đối chiếu DB và blockchain audit log.</p>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-5">
            <label className="block rounded-2xl border-2 border-dashed border-cyan-200 bg-white p-5 text-center transition hover:border-cyan-400 hover:bg-cyan-50/50">
              <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <span className="text-sm font-black text-slate-900">Upload ảnh mã QR</span>
              <span className="mt-1 block text-xs font-semibold text-slate-500">Hỗ trợ ảnh chụp từ sổ khám hoặc file QR.</span>
            </label>

            {(manualMode || error) && (
              <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <label className="block text-xs font-black text-amber-900">
                  Không thể đọc mã QR? Vui lòng nhập Mã hồ sơ/Mã QR thủ công tại đây
                </label>
                <input
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder="VD: PAT-00001 hoặc QR payload"
                  className="mt-2 w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            )}

            {!manualMode && !error && (
              <div>
                <label className="block text-xs font-black text-slate-600">Mã hồ sơ/Mã QR</label>
                <input
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  placeholder="Nhập mã nếu không upload ảnh"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            )}

            {error && <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}

            <button
              type="button"
              onClick={() => resolveHistory()}
              disabled={loading}
              className="w-full rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {loading ? 'Đang truy vấn...' : 'Tra cứu lịch sử'}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <h2 className="text-lg font-black text-slate-950">Lịch sử khám gần nhất</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">Các lượt khám được sắp xếp mới nhất trước; mục bị thay đổi sẽ có cảnh báo integrity.</p>

            <div className="mt-4 space-y-3">
              {visits.map((visit) => (
                <article key={visit.id || visit.visitCode} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-cyan-700">{visit.visitCode}</p>
                      <h3 className="mt-1 text-sm font-black text-slate-900">{visit.finalDiagnosis || visit.summary || 'Lượt khám'}</h3>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{visit.completedAt || visit.checkInAt || 'Chưa có thời gian'}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${visit.integrityStatus === 'TAMPERED' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                      {visit.integrityStatus === 'TAMPERED' ? 'WARNING' : 'VERIFIED'}
                    </span>
                  </div>
                </article>
              ))}
              {!visits.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Chưa có dữ liệu hiển thị.</div>}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
