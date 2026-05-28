import { useState, useRef, useEffect } from 'react';
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
} from '../services/livenessService';

/**
 * LivenessCheck - Modern Fintech / Apple FaceID Aesthetic
 */
export default function LivenessCheck({ onLivenessPass, onError, disabled = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const holdStartRef = useRef(null);
  const tsCounterRef = useRef(1);
  const capturedCanvasRef = useRef(null);
  const passSentRef = useRef(false);

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
      console.error('Failed to capture video frame:', e);
    }
    return null;
  };

  const stateRef = useRef({
    directions: [],
    currentIdx: 0,
    passedDirs: [],
    allPassed: false,
  });

  const [status, setStatus] = useState('loading');
  const [displayDir, setDisplayDir] = useState('center');
  const [displayProgress, setDisplayProgress] = useState(0);
  const [displayPassed, setDisplayPassed] = useState([]);
  const [displayIdx, setDisplayIdx] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [distanceWarn, setDistanceWarn] = useState(null);
  const [message, setMessage] = useState('Đang khởi động camera...');
  const [allPassedUI, setAllPassedUI] = useState(false);

  const [directions] = useState(() => generateRandomDirections(3));

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
          videoRef.current.play().catch(() => {});
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
        setMessage('Hãy đưa khuôn mặt vào trong khung hình');

        startLoop();
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage('Không thể truy cập camera. Vui lòng kiểm tra quyền.');
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          setMessage('Không tìm thấy khuôn mặt');
          return;
        }

        setFaceDetected(true);

        const dist = checkFaceDistance(landmarks);
        if (dist === 'TOO_FAR') {
          setDistanceWarn('Vui lòng tiến gần hơn');
          setMessage('Vui lòng tiến gần hơn');
          holdStartRef.current = null;
          setDisplayProgress(0);
          return;
        }
        if (dist === 'TOO_CLOSE') {
          setDistanceWarn('Vui lòng lùi ra xa một chút');
          setMessage('Vui lòng lùi ra xa một chút');
          holdStartRef.current = null;
          setDisplayProgress(0);
          return;
        }
        setDistanceWarn(null);

        const { yawRatio, pitchRatio } = computeHeadPose(landmarks);
        const dir = classifyDirection(yawRatio, pitchRatio);
        setDisplayDir(dir);

        // Capture a candidate front-facing frame if the user is looking straight (center)
        if (dir === 'center') {
          const canvas = captureVideoFrame();
          if (canvas) {
            capturedCanvasRef.current = canvas;
          }
        }

        const targetDir = s.directions[s.currentIdx];
        if (!targetDir) return;

        const info = getDirectionInfo(targetDir);
        setMessage(info.instruction);

        if (dir === targetDir) {
          if (!holdStartRef.current) {
            holdStartRef.current = performance.now();
          }
          const elapsed = performance.now() - holdStartRef.current;
          const pct = Math.min(100, (elapsed / THRESHOLDS.HOLD_DURATION) * 100);
          setDisplayProgress(pct);

          if (elapsed >= THRESHOLDS.HOLD_DURATION) {
            s.passedDirs.push(targetDir);
            setDisplayPassed([...s.passedDirs]);
            setDisplayProgress(0);
            holdStartRef.current = null;

            if (s.currentIdx + 1 >= s.directions.length) {
              s.allPassed = true;
              setAllPassedUI(true);
              setMessage('Xác thực thành công');
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
        console.error('[Liveness] Loop error:', err.message);
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
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
        onLivenessPass?.(frame || videoRef.current);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allPassedUI, onLivenessPass, disabled]);

  // ============================================================
  // Soft Geometric Icons
  // ============================================================
  const successShield = (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );

  const renderArrow = (direction) => {
    const rotationMap = { right: 0, down: 90, left: 180, up: 270 };
    const rotation = rotationMap[direction] ?? 0;
    return (
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <line x1="4" y1="12" x2="20" y2="12" />
        <polyline points="14 6 20 12 14 18" />
      </svg>
    );
  };

  // Determine the dynamic border color
  const getRingColor = () => {
    if (status === 'loading') return '#cbd5e1';
    if (allPassedUI) return '#10b981'; // Success Green
    if (distanceWarn || (!faceDetected && status === 'active')) return '#ef4444'; // Error Red
    if (displayProgress > 0) return '#3b82f6'; // Action Blue
    return '#e2e8f0'; // Default Neutral
  };

  const ringColor = getRingColor();
  const currentDirection = directions[displayIdx];

  return (
    <div className="liveness-shell">
      <style>{`
        .liveness-shell {
          width: 100%;
          max-width: 560px;
          margin: 0 auto;
          padding: 18px;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background:
            radial-gradient(circle at 24% 10%, rgba(94, 234, 212, 0.16), transparent 28rem),
            radial-gradient(circle at 85% 22%, rgba(129, 140, 248, 0.20), transparent 24rem),
            rgba(15, 23, 42, 0.64);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 70px rgba(0,0,0,0.28);
          backdrop-filter: blur(18px);
        }

        .liveness-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 18px;
        }

        .liveness-kicker {
          margin: 0 0 6px;
          color: #5eead4;
          font-size: 0.72rem;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .liveness-title {
          margin: 0;
          color: #f8fbff;
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          font-weight: 850;
          letter-spacing: -0.04em;
        }

        .liveness-step-pill {
          flex: 0 0 auto;
          padding: 10px 12px;
          color: #cffafe;
          font-size: 0.78rem;
          font-weight: 850;
          border: 1px solid rgba(94, 234, 212, 0.28);
          border-radius: 999px;
          background: rgba(8, 47, 73, 0.42);
          box-shadow: 0 0 24px rgba(45, 212, 191, 0.10);
        }

        .liveness-stage {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 390px;
          border-radius: 26px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(2, 6, 23, 0.46)),
            radial-gradient(circle at center, rgba(34, 211, 238, 0.12), rgba(99, 102, 241, 0.08) 48%, rgba(2, 6, 23, 0.48));
        }

        .liveness-stage::before {
          content: '';
          position: absolute;
          inset: 18px;
          border-radius: 24px;
          border: 1px solid rgba(255,255,255,0.08);
          pointer-events: none;
        }

        .camera-oval-pod {
          position: relative;
          width: min(78vw, 300px);
          height: min(96vw, 360px);
          max-height: 360px;
          border-radius: 46% / 38%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          background: rgba(2, 6, 23, 0.72);
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.08),
            0 0 0 6px rgba(15,23,42,0.92),
            0 0 0 9px ${ringColor},
            0 28px 70px rgba(0,0,0,0.42),
            0 0 80px rgba(34, 211, 238, 0.13);
          transition: box-shadow 0.35s ease, transform 0.35s ease;
          z-index: 2;
        }

        .camera-oval-pod.scanning {
          animation: podPulse 1.6s ease-in-out infinite;
        }

        @keyframes podPulse {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 6px rgba(15,23,42,0.92), 0 0 0 9px #38bdf8, 0 28px 70px rgba(0,0,0,0.42), 0 0 82px rgba(56,189,248,0.18);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 6px rgba(15,23,42,0.92), 0 0 0 15px rgba(56,189,248,0.34), 0 28px 70px rgba(0,0,0,0.42), 0 0 98px rgba(56,189,248,0.26);
          }
        }

        .camera-oval-mask {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: inherit;
        }

        .hardware-feed-clean {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
          filter: contrast(1.08) saturate(1.05);
          opacity: ${status === 'loading' ? '0' : '1'};
          transition: opacity 0.45s ease;
        }

        .scan-sheen {
          position: absolute;
          left: 10%;
          right: 10%;
          height: 2px;
          top: 14%;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, #67e8f9, transparent);
          box-shadow: 0 0 18px rgba(103,232,249,0.9);
          opacity: ${status === 'active' && !allPassedUI ? 1 : 0};
          animation: scanSheen 2.2s ease-in-out infinite;
        }

        @keyframes scanSheen { 0%,100% { top: 14%; } 50% { top: 84%; } }

        .loading-glass,
        .success-glass {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 20;
          backdrop-filter: blur(10px);
        }

        .loading-glass { background: rgba(2, 6, 23, 0.76); }
        .success-glass {
          background: rgba(6, 78, 59, 0.62);
          animation: popIn 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes popIn { from { transform: scale(0.86); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .spinner-clean {
          width: 42px;
          height: 42px;
          border: 3px solid rgba(148, 163, 184, 0.28);
          border-top-color: #5eead4;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .floating-arrow {
          position: absolute;
          width: 58px;
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #06111f;
          border-radius: 22px;
          background: linear-gradient(135deg, #5eead4, #93c5fd 52%, #c4b5fd);
          box-shadow: 0 18px 38px rgba(45, 212, 191, 0.24), 0 0 0 1px rgba(255,255,255,0.26) inset;
          z-index: 15;
        }
        .floating-arrow.left { left: -30px; top: 50%; margin-top: -29px; animation: floatLeft 1.2s ease-in-out infinite; }
        .floating-arrow.right { right: -30px; top: 50%; margin-top: -29px; animation: floatRight 1.2s ease-in-out infinite; }
        .floating-arrow.up { top: -30px; left: 50%; margin-left: -29px; animation: floatUp 1.2s ease-in-out infinite; }
        .floating-arrow.down { bottom: -30px; left: 50%; margin-left: -29px; animation: floatDown 1.2s ease-in-out infinite; }
        @keyframes floatLeft { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-8px); } }
        @keyframes floatRight { 0%,100% { transform: translateX(0); } 50% { transform: translateX(8px); } }
        @keyframes floatUp { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes floatDown { 0%,100% { transform: translateY(0); } 50% { transform: translateY(8px); } }

        .instruction-panel {
          margin-top: 18px;
          padding: 16px;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 20px;
          background: rgba(255,255,255,0.055);
        }

        .instruction-text {
          min-height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin: 0;
          color: #e0f2fe;
          text-align: center;
          font-size: 1rem;
          font-weight: 750;
          letter-spacing: -0.01em;
        }
        .instruction-text.warn { color: #fecaca; }
        .instruction-text.success { color: #bbf7d0; }

        .progress-dots-container {
          display: flex;
          justify-content: center;
          gap: 10px;
          margin-top: 14px;
        }
        .progress-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.35);
          transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .progress-dot.passed { width: 28px; background: #5eead4; box-shadow: 0 0 18px rgba(94,234,212,.38); }
        .progress-dot.active { background: #93c5fd; box-shadow: 0 0 0 4px rgba(147,197,253,.18); }

        .hold-progress {
          width: min(100%, 260px);
          height: 7px;
          margin: 16px auto 0;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.22);
        }
        .hold-progress-bar {
          height: 100%;
          width: ${displayProgress}%;
          border-radius: inherit;
          background: linear-gradient(90deg, #5eead4, #93c5fd, #c4b5fd);
          box-shadow: 0 0 20px rgba(94,234,212,.35);
          transition: width 0.1s linear;
        }

        .retry-button {
          width: 100%;
          margin-top: 14px;
          padding: 13px 16px;
          border: 0;
          border-radius: 16px;
          color: #06111f;
          font-weight: 850;
          cursor: pointer;
          background: linear-gradient(135deg, #5eead4, #93c5fd 48%, #c4b5fd);
        }

        @media (max-width: 560px) {
          .liveness-shell { padding: 14px; }
          .liveness-header { align-items: flex-start; flex-direction: column; }
          .liveness-stage { min-height: 350px; }
          .camera-oval-pod { width: 235px; height: 310px; }
        }
      `}</style>

      <div className="liveness-header">
        <div>
          <p className="liveness-kicker">LIVE BIOMETRIC CHECK</p>
          <h3 className="liveness-title">Xác minh khuôn mặt</h3>
        </div>
        <div className="liveness-step-pill">
          Bước {Math.min(displayIdx + 1, directions.length)} / {directions.length}
        </div>
      </div>

      <div className="liveness-stage">
        <div className={`camera-oval-pod ${displayProgress > 0 && !allPassedUI ? 'scanning' : ''}`}>
          <div className="camera-oval-mask">
            <video ref={videoRef} className="hardware-feed-clean" muted playsInline />
            <div className="scan-sheen" />
          </div>

          {status === 'loading' && (
            <div className="loading-glass">
              <div className="spinner-clean" />
            </div>
          )}

          {allPassedUI && (
            <div className="success-glass">
              {successShield}
            </div>
          )}

          {status === 'active' && !allPassedUI && faceDetected && !distanceWarn && currentDirection && (
            <div className={`floating-arrow ${currentDirection}`}>
              {renderArrow(currentDirection)}
            </div>
          )}
        </div>
      </div>

      <div className="instruction-panel">
        <p className={`instruction-text ${distanceWarn || !faceDetected ? 'warn' : allPassedUI ? 'success' : ''}`}>
          {message}
        </p>

        {status === 'active' && directions.length > 0 && (
          <div className="progress-dots-container">
            {directions.map((dir, idx) => {
              const isPassed = displayPassed.includes(dir);
              const isCurrent = idx === displayIdx && !allPassedUI;
              return (
                <div
                  key={`${dir}-${idx}`}
                  className={`progress-dot ${isPassed ? 'passed' : isCurrent ? 'active' : ''}`}
                />
              );
            })}
          </div>
        )}

        {status === 'active' && !allPassedUI && (
          <div className="hold-progress">
            <div className="hold-progress-bar" />
          </div>
        )}

        {status === 'error' && (
          <button type="button" className="retry-button" onClick={() => window.location.reload()}>
            Thử lại camera
          </button>
        )}
      </div>
    </div>
  );
}
