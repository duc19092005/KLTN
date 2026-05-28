import React, { useState, useRef, useEffect } from 'react';
import {
  initFaceMesh,
  detectLandmarks,
  computeHeadPose,
  classifyDirection,
  checkFaceDistance,
  generateRandomDirections,
  getDirectionInfo,
  destroyFaceMesh,
  THRESHOLDS,
  computeEyeOpenness,
} from '../apis/livenessService';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * LivenessCheck - Phiên bản Premium Clinical Tech (Xanh Y Tế Cao Cấp)
 */
export default function LivenessCheck({
  onLivenessPass,
  onError,
  disabled = false,
  challengeMode = 'verify',
  sampleCount = 4,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const holdStartRef = useRef(null);
  const tsCounterRef = useRef(1);
  const capturedCanvasRef = useRef(null);
  const poseFramesRef = useRef([]);
  const passSentRef = useRef(false);
  const blinkStateRef = useRef({ baseline: null, closed: false, verified: false });

  const captureVideoFrame = () => {
    if (!videoRef.current) return null;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
      }
    } catch (e) {
      console.error('Không thể chụp khung hình video:', e);
    }
    return null;
  };

  const stateRef = useRef({
    directions: [],
    currentIdx: 0,
    passedDirs: [],
    allPassed: false,
  });

  const isEnrollMode = challengeMode === 'enroll';

  const [status, setStatus] = useState('loading');
  const [displayDir, setDisplayDir] = useState('center');
  const [displayProgress, setDisplayProgress] = useState(0);
  const [displayPassed, setDisplayPassed] = useState([]);
  const [displayIdx, setDisplayIdx] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [distanceWarn, setDistanceWarn] = useState(null);
  const [message, setMessage] = useState('Đang kết nối hệ thống ghi hình sinh trắc...');
  const [allPassedUI, setAllPassedUI] = useState(false);
  const [blinkVerified, setBlinkVerified] = useState(false);

  const [directions] = useState(() => (
    challengeMode === 'enroll'
      ? ['center', 'left', 'right', 'up', 'down']
      : generateRandomDirections(sampleCount, { includeCenter: false })
  ));

  useEffect(() => {
    stateRef.current.directions = directions;
    let cancelled = false;

    const start = async () => {
      try {
        setStatus('loading');
        await initFaceMesh();

        if (cancelled) return;

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });

        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => { });
        }

        await new Promise(resolve => {
          const check = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              resolve();
            } else {
              setTimeout(check, 100);
            }
          };
          check();
        });

        if (cancelled) return;
        setStatus('active');
        setMessage('Vui lòng đưa khuôn mặt vào chính giữa kén quét sinh trắc');

        startLoop();
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage('Không thể truy cập camera hệ thống. Vui lòng kiểm tra quyền thiết bị.');
          onError?.(err.message);
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      stopLoop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      destroyFaceMesh();
    };
  }, []);

  const startLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      try {
        const s = stateRef.current;
        if (s.allPassed || disabled) return;
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        tsCounterRef.current += 80;
        const landmarks = detectLandmarks(videoRef.current, tsCounterRef.current);

        if (!landmarks) {
          setFaceDetected(false);
          setDisplayDir('center');
          setDistanceWarn(null);
          holdStartRef.current = null;
          setDisplayProgress(0);
          setMessage('Không tìm thấy dữ liệu khuôn mặt phù hợp');
          return;
        }

        setFaceDetected(true);

        const dist = checkFaceDistance(landmarks);
        if (dist === 'TOO_FAR') {
          setDistanceWarn('Vui lòng di chuyển lại gần camera');
          setMessage('Vui lòng di chuyển lại gần camera');
          holdStartRef.current = null;
          setDisplayProgress(0);
          return;
        }
        if (dist === 'TOO_CLOSE') {
          setDistanceWarn('Vui lòng đưa khuôn mặt ra xa một chút');
          setMessage('Vui lòng đưa khuôn mặt ra xa một chút');
          holdStartRef.current = null;
          setDisplayProgress(0);
          return;
        }
        setDistanceWarn(null);

        const eyeOpenness = computeEyeOpenness(landmarks);
        const blinkState = blinkStateRef.current;
        if (!blinkState.baseline && eyeOpenness > 0.12) {
          blinkState.baseline = eyeOpenness;
        }
        const closedThreshold = Math.max(0.055, (blinkState.baseline || 0.16) * 0.58);
        const reopenedThreshold = Math.max(0.09, (blinkState.baseline || 0.16) * 0.78);

        if (!blinkState.verified) {
          if (eyeOpenness < closedThreshold) {
            blinkState.closed = true;
            setMessage('Vui lòng chớp mắt một lần để xác nhận người thật');
          } else if (blinkState.closed && eyeOpenness > reopenedThreshold) {
            blinkState.verified = true;
            setBlinkVerified(true);
            setMessage('Đã xác nhận chớp mắt. Tiếp tục làm theo hướng dẫn');
            holdStartRef.current = null;
            setDisplayProgress(0);
          } else {
            setMessage('Vui lòng chớp mắt một lần để xác nhận người thật');
          }
          return;
        }

        const pose = computeHeadPose(landmarks);
        const { yawRatio, pitchRatio } = pose;
        const dir = classifyDirection(yawRatio, pitchRatio);
        setDisplayDir(dir);

        if (dir === 'center') {
          const canvas = captureVideoFrame();
          if (canvas) {
            capturedCanvasRef.current = canvas;
          }
        }

        const targetDir = s.directions[s.currentIdx];
        if (!targetDir) return;

        const info = getDirectionInfo(targetDir);
        const isCenterTarget = targetDir === 'center';
        const centerMatched = isCenterTarget
          && Math.abs(yawRatio - 1.0) <= THRESHOLDS.CENTER_MAX_YAW_DEVIATION
          && Math.abs(pitchRatio - 0.85) <= THRESHOLDS.CENTER_MAX_PITCH_DEVIATION;
        const isTargetMatched = isCenterTarget ? centerMatched : dir === targetDir;
        setMessage(info.instruction);

        if (isTargetMatched) {
          if (!holdStartRef.current) {
            holdStartRef.current = performance.now();
          }
          const elapsed = performance.now() - holdStartRef.current;
          const requiredHold = isCenterTarget ? THRESHOLDS.CENTER_HOLD_DURATION : THRESHOLDS.HOLD_DURATION;
          const pct = Math.min(100, (elapsed / requiredHold) * 100);
          setDisplayProgress(pct);

          if (elapsed >= requiredHold) {
            s.passedDirs.push(targetDir);
            setDisplayPassed([...s.passedDirs]);
            setDisplayProgress(0);
            holdStartRef.current = null;

            const passedFrame = captureVideoFrame();
            if (passedFrame) {
              poseFramesRef.current.push({ direction: targetDir, frame: passedFrame });
              if (targetDir === 'center') capturedCanvasRef.current = passedFrame;
            }

            if (s.currentIdx + 1 >= s.directions.length) {
              s.allPassed = true;
              setAllPassedUI(true);
              setMessage('Xác thực thực thể sống thành công');
              if (!capturedCanvasRef.current) {
                const canvas = captureVideoFrame();
                capturedCanvasRef.current = canvas;
              }
            } else {
              s.currentIdx++;
              setDisplayIdx(s.currentIdx);
            }
          }
        } else {
          holdStartRef.current = null;
          setDisplayProgress(0);
        }
      } catch (err) {
        console.error('[Liveness] Vòng lặp lỗi:', err.message);
      }
    }, 80);
  };

  const stopLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (allPassedUI && videoRef.current && !passSentRef.current) {
      const timer = setTimeout(() => {
        if (disabled || passSentRef.current) return;
        passSentRef.current = true;
        stopLoop();
        const frame = capturedCanvasRef.current || captureVideoFrame();
        const poseFrames = poseFramesRef.current.map((sample) => sample.frame);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        onLivenessPass?.(isEnrollMode && poseFrames.length > 0 ? poseFrames : (frame || videoRef.current));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allPassedUI, onLivenessPass, disabled, isEnrollMode]);

  const renderArrow = (direction) => {
    const rotationMap = { right: 0, down: 90, left: 180, up: 270 };
    const rotation = rotationMap[direction] ?? 0;
    return (
      <svg className="w-5 h-5 text-white transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rotation}deg)` }}>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    );
  };

  // Xác định màu sắc khối phản hồi thông báo động dựa trên ngữ cảnh thực tế
  const getFeedbackStateClasses = () => {
    if (status === 'loading') return 'bg-slate-50 border-slate-100 text-slate-500';
    if (status === 'error') return 'bg-rose-50 border-rose-100 text-rose-600';
    if (allPassedUI) return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    if (!blinkVerified && status === 'active') return 'bg-cyan-50 border-cyan-100 text-cyan-700';
    if (distanceWarn || (!faceDetected && status === 'active')) return 'bg-amber-50 border-amber-100/70 text-amber-700';
    return 'bg-blue-50/70 border-blue-100/50 text-blue-800';
  };

  // Đồng bộ màu đường viền của kén quét mượt mà bằng CSS transitions
  const getRingColorStyle = () => {
    if (status === 'loading') return 'ring-slate-100/80 shadow-slate-100/40';
    if (allPassedUI) return 'ring-emerald-500/30 shadow-emerald-100';
    if (!blinkVerified && status === 'active') return 'ring-cyan-500/30 shadow-cyan-100';
    if (distanceWarn || (!faceDetected && status === 'active')) return 'ring-amber-500/30 shadow-amber-100';
    if (displayProgress > 0) return 'ring-blue-600/30 shadow-blue-100';
    return 'ring-slate-200/60 shadow-slate-100/30';
  };

  const currentDirection = directions[displayIdx];

  // Map class định vị tuyệt đối cho mũi tên nổi bên ngoài kén quét (Tránh đè mặt)
  const arrowPositionClasses = {
    left: '-left-14 top-1/2 -translate-y-1/2 animate-bounce-left',
    right: '-right-14 top-1/2 -translate-y-1/2 animate-bounce-right',
    up: '-top-14 left-1/2 -translate-x-1/2 animate-bounce-up',
    down: '-bottom-14 left-1/2 -translate-x-1/2 animate-bounce-down',
  };

  return (
    <div className="w-full max-w-[480px] mx-auto p-6 bg-white border border-slate-100 rounded-3xl shadow-[0_20px_50px_rgba(59,130,246,0.04)] font-sans antialiased selection:bg-blue-50 selection:text-blue-700">

      {/* Header Panel */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <div>
            <p className="text-[10px] font-bold text-blue-600/80 uppercase tracking-widest tracking-wider">Hệ thống nhận diện y tế</p>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {isEnrollMode ? 'Khởi Tạo Sinh Trắc Học' : 'Xác Minh Khuôn Mặt'}
            </h3>
          </div>
        </div>
        <div className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50/60 border border-blue-100/60 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          Tiến trình: {Math.min(displayIdx + 1, directions.length)}/{directions.length}
        </div>
      </div>

      {/* Camera Scanning Stage */}
      <div className="relative w-full aspect-[4/3] bg-slate-50/50 border border-slate-100/40 rounded-2xl flex items-center justify-center overflow-visible">

        {/* Đường góc định vị trang trí chuẩn Medical OS */}
        <div className="absolute inset-4 border border-dashed border-slate-200/50 rounded-xl pointer-events-none opacity-50" />

        {/* Kén Oval quét Camera (Chứa Video gốc và các vòng trạng thái) */}
        <div className={`relative w-[210px] h-[260px] rounded-[105px/130px] bg-slate-950 flex items-center justify-center transition-all duration-500 ring-8 ${getRingColorStyle()} z-10`}>

          {/* Lớp Mặt nạ chứa camera */}
          <div className="absolute inset-0 overflow-hidden rounded-inherit">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-500 ${status === 'loading' ? 'opacity-0' : 'opacity-100'}`}
              muted
              playsInline
            />

            {/* Vòng chấm đứt đoạn phụ giúp bệnh nhân căn giữa mặt nhanh hơn */}
            {status === 'active' && !allPassedUI && (
              <div className="absolute inset-4 border border-dashed border-white/20 rounded-[89px/114px] pointer-events-none opacity-40" />
            )}

            {/* Thanh Quét Laser Chạy Chậm dọc khuôn mặt */}
            {status === 'active' && !allPassedUI && (
              <div className="absolute left-[5%] right-[5%] h-[1.5px] bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_8px_#3b82f6] opacity-90 animate-scan-line pointer-events-none" />
            )}
          </div>

          {/* Màn kính phủ mờ khi Đang tải tài nguyên */}
          {status === 'loading' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md rounded-inherit flex flex-col items-center justify-center z-20">
              <LoadingIndicator size="md" tone="blue" />
              <p className="text-[11px] font-semibold text-slate-400 mt-3 tracking-wide">Đang khởi tạo AI Model...</p>
            </div>
          )}

          {/* Màn kính phủ xanh khi Xác thực Thành công hoàn toàn */}
          {allPassedUI && (
            <div className="absolute inset-0 bg-emerald-600/95 backdrop-blur-sm rounded-inherit flex flex-col items-center justify-center z-20 animate-in zoom-in-95 duration-300">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md mb-2 animate-bounce">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">Hợp Lệ</p>
            </div>
          )}

          {/* Mũi tên nổi hướng dẫn quay đầu thiết kế dạng Bubble Cao Cấp */}
          {status === 'active' && !allPassedUI && faceDetected && !distanceWarn && currentDirection && currentDirection !== 'center' && (
            <div className={`absolute w-10 h-10 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-200/40 flex items-center justify-center border border-blue-400/20 z-30 ${arrowPositionClasses[currentDirection]}`}>
              {renderArrow(currentDirection)}
            </div>
          )}
        </div>
      </div>

      {/* Điều khiển Bảng hướng dẫn & Chỉ báo Tiến độ */}
      <div className="mt-6 flex flex-col items-center">

        {/* Hộp thông báo phản hồi động (Dynamic Feedback Card) */}
        <div className={`w-full py-3.5 px-4 rounded-2xl border text-center transition-all duration-300 min-h-[52px] flex items-center justify-center ${getFeedbackStateClasses()}`}>
          <p className="text-sm font-bold tracking-tight leading-snug">
            {message}
          </p>
        </div>

        {/* Chuỗi chấm chỉ số hành động (Sleek Progress dots) */}
        {status === 'active' && directions.length > 0 && (
          <div className="flex justify-center items-center gap-2 mt-5">
            {directions.map((dir, idx) => {
              const isPassed = displayPassed.includes(dir);
              const isCurrent = idx === displayIdx && !allPassedUI;
              return (
                <div
                  key={`${dir}-${idx}`}
                  className={`h-2 rounded-full transition-all duration-300
                    ${isPassed ? 'w-6 bg-emerald-500 shadow-sm shadow-emerald-100' : isCurrent ? 'w-4 bg-blue-600 ring-4 ring-blue-100' : 'w-2 bg-slate-200'}`}
                />
              );
            })}
          </div>
        )}

        {/* Thanh Progress lưu giữ vị trí hướng (Hold duration) */}
        {status === 'active' && !allPassedUI && displayProgress > 0 && (
          <div className="w-full max-w-[180px] h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-70 linear rounded-full shadow-sm"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        )}

        {/* Xử lý lỗi hỏng thiết bị phần cứng */}
        {status === 'error' && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full mt-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors shadow-sm outline-none"
          >
            Khởi động lại Camera cấu hình
          </button>
        )}
      </div>

      {/* Tối ưu hóa các Keyframes CSS phục vụ chuyển động định hướng */}
      <style>{`
        @keyframes scanLineAnimation {
          0%, 100% { top: 6%; }
          50% { top: 94%; }
        }
        .animate-scan-line {
          animation: scanLineAnimation 2s ease-in-out infinite;
        }
        @keyframes bounceLeft {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(-8px); }
        }
        @keyframes bounceRight {
          0%, 100% { transform: translateY(-50%) translateX(0); }
          50% { transform: translateY(-50%) translateX(8px); }
        }
        @keyframes bounceUp {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-8px); }
        }
        @keyframes bounceDown {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(8px); }
        }
        .animate-bounce-left { animation: bounceLeft 1.2s ease-in-out infinite; }
        .animate-bounce-right { animation: bounceRight 1.2s ease-in-out infinite; }
        .animate-bounce-up { animation: bounceUp 1.2s ease-in-out infinite; }
        .animate-bounce-down { animation: bounceDown 1.2s ease-in-out infinite; }
        .rounded-inherit { border-radius: inherit; }
      `}</style>
    </div>
  );
}