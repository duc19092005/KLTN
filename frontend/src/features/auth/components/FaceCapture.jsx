import React, { useState, useRef, useEffect, useCallback } from 'react';
import { loadModels, detectFace } from '../apis/faceService';
import LivenessCheck from './LivenessCheck';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * FaceCapture - Clinical Blue UX/UI (Tailwind CSS)
 */
export default function FaceCapture({
  onCapture,
  onError,
  autoStart = false,
  requireLiveness = true,
  disabled = false,
  label,
  captureMode = 'verify',
}) {
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const [mode, setMode] = useState('upload');
  const [status, setStatus] = useState('idle');
  const [stream, setStream] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [message, setMessage] = useState('Vui lòng chọn phương thức khởi tạo.');
  const [extractingEmbedding, setExtractingEmbedding] = useState(false);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (mountedRef.current) {
      setStream(null);
      setStatus('idle');
    }
  }, []);

  const startCamera = useCallback(async () => {
    setStatus('loading');
    setMessage('Đang nạp mô hình nhận diện cốt lõi...');

    try {
      await loadModels();
      setMessage('Đang yêu cầu quyền truy cập Camera...');

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });

      if (!mountedRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => {
          if (e.name !== 'AbortError') console.warn('Lỗi Camera:', e);
        });
      }

      setStream(mediaStream);
      setStatus('ready');
      setMessage('Luồng sinh trắc học đã sẵn sàng để quét.');
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setMessage(err.message || 'Lỗi khởi tạo thiết bị phần cứng.');
      onError?.(err.message);
    }
  }, [onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!requireLiveness && autoStart && mode === 'camera') {
      startCamera();
      return;
    }

    if (requireLiveness || mode !== 'camera') {
      stopCamera();
    }
  }, [autoStart, mode, requireLiveness, startCamera, stopCamera]);

  // ── Luồng Liveness: Trích xuất Face Embedding sau khi quét sống thành công ──
  const handleLivenessPass = async (source) => {
    setExtractingEmbedding(true);
    try {
      await loadModels();
      if (!mountedRef.current) return;

      const sources = Array.isArray(source) ? source : [source];
      const embeddings = [];

      for (const item of sources) {
        const embedding = await detectFace(item);
        if (embedding) embeddings.push(embedding);
      }

      if (embeddings.length === 0) {
        await new Promise(r => setTimeout(r, 500));
        if (!mountedRef.current) return;
        const retrySource = sources[0];
        const retry = await detectFace(retrySource);
        if (!retry) {
          setExtractingEmbedding(false);
          onError?.('Không thể trích xuất định danh khuôn mặt. Vui lòng thử lại.');
          return;
        }
        embeddings.push(retry);
      }

      if (captureMode === 'enroll' && embeddings.length < 3) {
        onError?.('Không đủ mẫu khuôn mặt tin cậy. Vui lòng ghi danh lại trong điều kiện đủ sáng.');
        return;
      }

      onCapture?.(captureMode === 'enroll' ? embeddings : embeddings[0]);
    } catch (err) {
      onError?.('Lỗi trích xuất: ' + err.message);
    } finally {
      if (mountedRef.current) setExtractingEmbedding(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setStatus('error');
      setMessage('Vui lòng chọn tệp hình ảnh có dung lượng dưới 5MB.');
      return;
    }

    setStatus('loading');
    setMessage('Đang xử lý ma trận tệp tin...');
    try {
      await loadModels();

      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
        setStatus('ready');
        setMessage('Tệp hình ảnh đã được tải vào bộ nhớ đệm.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setStatus('error');
      setMessage('Không thể xử lý cấu trúc: ' + err.message);
      onError?.(err.message);
    }
  };

  const scanFace = async () => {
    const elementToScan = mode === 'camera' ? videoRef.current : imageRef.current;
    if (!elementToScan) return;

    setStatus('scanning');
    setMessage('Đang thực thi thuật toán phân tích điểm neo...');

    try {
      const embedding = await detectFace(elementToScan);

      if (!embedding) {
        setStatus('ready');
        setMessage('Không tìm thấy bản đồ đặc trưng khuôn mặt hợp lệ.');
        return;
      }

      setStatus('captured');
      setMessage('Dữ liệu định danh đã được tạo và đồng bộ thành công.');
      onCapture?.(embedding);
    } catch (err) {
      setStatus('error');
      setMessage('Lỗi xác thực: ' + err.message);
      onError?.(err.message);
    }
  };

  // Trả về class màu sắc theo trạng thái cho các đường viền và text
  const getStateColorClasses = () => {
    if (status === 'error') return { ring: 'ring-red-500 shadow-red-100/60', text: 'text-red-600' };
    if (status === 'captured') return { ring: 'ring-emerald-500 shadow-emerald-100/60', text: 'text-emerald-700' };
    if (status === 'scanning' || status === 'loading') return { ring: 'ring-blue-600 shadow-blue-100/60', text: 'text-blue-700' };
    return { ring: 'ring-slate-200 shadow-slate-100', text: 'text-slate-600' };
  };

  const colorClasses = getStateColorClasses();

  // ── GIAO DIỆN CHẾ ĐỘ LIVENESS (Mặc định) ──
  if (requireLiveness) {
    return (
      <div className="relative w-full max-w-[500px] mx-auto flex flex-col items-center">
        <div className="w-full">
          <LivenessCheck
            onLivenessPass={handleLivenessPass}
            onError={onError}
            disabled={disabled}
            challengeMode={captureMode}
            sampleCount={captureMode === 'enroll' ? 5 : 1}
          />
        </div>

        {/* Màn che mờ khi AI đang trích xuất dữ liệu ngầm */}
        {extractingEmbedding && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
            <LoadingIndicator size="lg" tone="blue" />
            <p className="mt-4 text-sm font-bold text-slate-800 tracking-tight text-center px-6">
              {label || (captureMode === 'enroll' ? 'Đang mã hóa dữ liệu sinh trắc học đa góc...' : 'Đang trích xuất Token định danh mã hóa...')}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── GIAO DIỆN CHẾ ĐỘ CỔ ĐIỂN (Legacy Mode - Không yêu cầu Liveness) ──
  return (
    <div className="w-full max-w-md mx-auto p-5 sm:p-6 bg-white border border-slate-200/80 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] font-sans antialiased selection:bg-blue-100 selection:text-blue-700">

      {/* Cụm thanh điều hướng Tabs */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-xl w-full max-w-[320px] mx-auto mb-6">
        <button
          type="button"
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 outline-none
            ${mode === 'upload' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => { setMode('upload'); stopCamera(); setPreviewUrl(null); setStatus('idle'); setMessage('Vui lòng chọn tệp hình ảnh để tải lên.'); }}
        >
          Tải Tệp Lên
        </button>
        <button
          type="button"
          className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 outline-none
            ${mode === 'camera' ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => { setMode('camera'); setPreviewUrl(null); setStatus('idle'); setMessage('Khởi động luồng Camera thời gian thực.'); }}
        >
          Quét Trực Tiếp
        </button>
      </div>

      {/* Khung hiển thị Viewport chính */}
      <div className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center transition-all duration-300 ring-4 ring-offset-4 ${colorClasses.ring}`}>

        {/* Render Camera */}
        {mode === 'camera' && stream && (
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1] animate-in fade-in duration-500"
            muted
            playsInline
          />
        )}

        {/* Render Ảnh tải lên */}
        {mode === 'upload' && previewUrl && (
          <img
            ref={imageRef}
            src={previewUrl}
            alt="Nguồn dữ liệu đăng ký"
            className="w-full h-full object-cover animate-in fade-in duration-500"
          />
        )}

        {/* Lớp phủ Loading/Scanning */}
        {status === 'scanning' && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 animate-in fade-in">
            <LoadingIndicator size="md" tone="blue" />
          </div>
        )}

        {/* Trạng thái trống (Placeholder) */}
        {((mode === 'camera' && (!stream || status === 'loading')) || (mode === 'upload' && !previewUrl)) && (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <svg className="w-10 h-10 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              {mode === 'camera'
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              }
            </svg>
            <span className="text-sm font-semibold tracking-tight">
              {mode === 'camera' ? 'Camera Đang Ngắt Kết Nối' : 'Chưa Có Dữ Liệu'}
            </span>
          </div>
        )}
      </div>

      {/* Thông báo trạng thái phản hồi */}
      <div className="mt-5 min-h-[24px] flex items-center justify-center text-center">
        <p className={`text-sm font-bold tracking-tight transition-colors duration-300 ${colorClasses.text}`}>
          {message}
        </p>
      </div>

      {/* Vùng Nút bấm thao tác (Call to actions) */}
      <div className="flex flex-col gap-3 w-full max-w-[320px] mx-auto mt-5">

        {/* Controls: Chế độ Upload */}
        {mode === 'upload' && (
          <>
            <label className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-4 rounded-xl cursor-pointer text-center text-sm transition-colors duration-200 outline-none focus-within:ring-2 focus-within:ring-blue-400">
              Mở Thư Mục Cục Bộ
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
            </label>

            {previewUrl && status === 'ready' && (
              <button
                type="button"
                onClick={scanFace}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors duration-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Thực Thi Mã Hóa Khuôn Mặt
              </button>
            )}
          </>
        )}

        {/* Controls: Chế độ Camera */}
        {mode === 'camera' && (
          <div className="flex gap-2 w-full">
            {status === 'idle' && (
              <button
                type="button"
                onClick={startCamera}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors duration-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Bật Camera
              </button>
            )}

            {status === 'ready' && (
              <button
                type="button"
                onClick={scanFace}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-colors duration-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Quét Sinh Trắc
              </button>
            )}

            {(status === 'ready' || status === 'captured' || status === 'error') && (
              <button
                type="button"
                onClick={stopCamera}
                className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-4 rounded-xl text-sm transition-colors duration-200 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Ngắt Kết Nối
              </button>
            )}
          </div>
        )}

        {/* Nút Reset chung khi đã capture thành công */}
        {status === 'captured' && (
          <button
            type="button"
            onClick={() => {
              setStatus('idle');
              setPreviewUrl(null);
              setMessage(mode === 'camera' ? 'Luồng Camera đã được đặt lại.' : 'Đang chờ nguồn tệp tin mới.');
            }}
            className="w-full bg-transparent border border-slate-200 hover:bg-slate-50 text-slate-500 font-bold py-3 px-4 rounded-xl text-sm transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Xóa & Khởi tạo lại
          </button>
        )}
      </div>
    </div>
  );
}