import React, { useState, useCallback } from 'react';
import { X, Check } from 'lucide-react';
import { useToast } from '../../../providers/ToastProvider';
import { handoverService } from '../apis/paraclinicalService';
import FaceCapture from '../../auth/components/FaceCapture';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * Handover Modal — 4-step flow:
 * 1. Select incoming staff (Person B)
 * 2. Face scan Person A (outgoing)
 * 3. Face scan Person B (incoming)
 * 4. Success confirmation
 */
export default function HandoverModal({ isOpen, onClose, currentStaff, clinicalRoomId, availableStaff = [], onHandoverComplete }) {
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [handoverId, setHandoverId] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedStaffInfo = availableStaff.find((s) => s.id === selectedStaff);

  const resetState = () => {
    setStep(1);
    setSelectedStaff('');
    setHandoverId(null);
    setReason('');
    setError('');
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose?.();
  };

  // Step 1 → Initiate handover
  const handleInitiate = async () => {
    if (!selectedStaff) return;
    setLoading(true);
    setError('');
    try {
      const res = await handoverService.initiate(selectedStaff, clinicalRoomId, reason || undefined);
      setHandoverId(res.data.id);
      setStep(2);
      toast.success('Phiên bàn giao đã được khởi tạo.');
    } catch (err) {
      setError(err.response?.data?.message || 'Khởi tạo bàn giao thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Face A
  const handleFaceA = useCallback(async (embedding) => {
    setLoading(true);
    setError('');
    try {
      await handoverService.verifyFaceA(handoverId, embedding);
      toast.success('Xác thực người bàn giao thành công!');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Xác thực khuôn mặt thất bại');
    } finally {
      setLoading(false);
    }
  }, [handoverId, toast]);

  // Step 3 → Face B → Complete
  const handleFaceB = useCallback(async (embedding) => {
    setLoading(true);
    setError('');
    try {
      const res = await handoverService.verifyFaceB(handoverId, embedding);
      toast.success('Bàn giao ca trực thành công! Sự kiện đã neo lên blockchain.');
      setStep(4);
      onHandoverComplete?.(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Xác thực khuôn mặt thất bại');
    } finally {
      setLoading(false);
    }
  }, [handoverId, toast, onHandoverComplete]);

  const handleFaceError = useCallback((msg) => setError(msg), []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-3xl bg-white shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Bàn giao ca trực</h2>
              <p className="text-xs font-semibold text-cyan-100 mt-0.5">Xác thực sinh trắc học kép</p>
            </div>
            <button onClick={handleClose} className="rounded-xl bg-white/20 p-2 hover:bg-white/30 transition-colors">
              <X className="w-4 h-4 text-white" strokeWidth={2} />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-white' : 'bg-white/20'} transition-colors`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-3 mb-4 text-sm font-bold text-red-700 text-center">
              {error}
            </div>
          )}

          {/* Step 1: Select Staff B */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Người bàn giao (hiện tại)</p>
                <p className="mt-1 text-lg font-black text-slate-950">{currentStaff?.fullName || 'Bạn'}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Chọn người nhận ca</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {availableStaff.map((s) => (
                    <option key={s.id} value={s.id}>{s.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Lý do (tùy chọn)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 outline-none"
                  placeholder="Hết ca, chuyển giao,..."
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Hủy</button>
                <button onClick={handleInitiate} disabled={!selectedStaff || loading} className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-xs font-black text-white hover:bg-cyan-700 disabled:opacity-50">
                  {loading ? <LoadingIndicator size="sm" tone="white" /> : 'Tiếp tục'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Face A */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center">
                <p className="text-sm font-black text-blue-800">Bước 1: Quét mặt người bàn giao</p>
                <p className="text-xs font-bold text-blue-600 mt-1">{currentStaff?.fullName || 'Bạn'}</p>
              </div>
              {loading ? (
                <div className="flex flex-col items-center py-8">
                  <LoadingIndicator size="lg" tone="blue" />
                  <p className="mt-4 text-sm font-bold text-slate-600">Đang xác thực...</p>
                </div>
              ) : (
                <FaceCapture onCapture={handleFaceA} onError={handleFaceError} captureMode="verify" label="Đang xác thực người bàn giao..." />
              )}
            </div>
          )}

          {/* Step 3: Face B */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center">
                <p className="text-sm font-black text-emerald-800">Bước 2: Quét mặt người nhận ca</p>
                <p className="text-xs font-bold text-emerald-600 mt-1">{selectedStaffInfo?.fullName || 'Nhân viên B'}</p>
              </div>
              {loading ? (
                <div className="flex flex-col items-center py-8">
                  <LoadingIndicator size="lg" tone="blue" />
                  <p className="mt-4 text-sm font-bold text-slate-600">Đang xác thực & neo blockchain...</p>
                </div>
              ) : (
                <FaceCapture onCapture={handleFaceB} onError={handleFaceError} captureMode="verify" label="Đang xác thực người nhận ca..." />
              )}
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
                <Check className="w-8 h-8 text-emerald-600" strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-950">Bàn giao thành công!</h3>
                <p className="text-sm font-semibold text-slate-500 mt-2">
                  Ca trực đã được chuyển sang <span className="font-black text-emerald-700">{selectedStaffInfo?.fullName}</span>.
                </p>
                <p className="text-xs font-bold text-cyan-600 mt-1">
                  Sự kiện đã được neo bất biến lên chuỗi khối
                </p>
              </div>
              <button onClick={handleClose} className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-black text-white hover:bg-emerald-700">
                Hoàn tất
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
