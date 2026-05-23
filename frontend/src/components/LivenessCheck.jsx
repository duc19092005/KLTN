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
export default function LivenessCheck({ onLivenessPass, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const holdStartRef = useRef(null);
  const tsCounterRef = useRef(1);
  const capturedCanvasRef = useRef(null);

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
        if (s.allPassed) return;
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
    if (allPassedUI && videoRef.current) {
      const timer = setTimeout(() => {
        onLivenessPass?.(capturedCanvasRef.current || videoRef.current);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [allPassedUI, onLivenessPass]);

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
    <div className="liveness-fintech-card">
      <style>{`
        .liveness-fintech-card {
          width: 100%; max-width: 400px; margin: 0 auto;
          background: var(--bg-card, #ffffff);
          border-radius: 24px;
          padding: 32px 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0,0,0,0.02);
          display: flex; flex-direction: column; align-items: center;
          border: 1px solid var(--border-color, #f1f5f9);
        }

        .fintech-title {
          font-size: 1.15rem; font-weight: 700; color: var(--text-main, #0f172a);
          margin-bottom: 28px; text-align: center; letter-spacing: -0.01em;
        }

        .camera-oval-pod {
          position: relative;
          width: 240px; height: 320px;
          border-radius: 160px; /* Makes it a perfect pill/oval */
          background: #f8fafc;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 6px var(--bg-card, #ffffff), 0 0 0 8px ${ringColor}, 0 20px 40px rgba(0,0,0,0.08);
          transition: box-shadow 0.4s ease;
          z-index: 10;
        }

        /* Pulse animation when scanning properly */
        .camera-oval-pod.scanning {
          animation: podPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes podPulse {
          0%, 100% { box-shadow: 0 0 0 6px var(--bg-card, #ffffff), 0 0 0 8px #3b82f6, 0 20px 40px rgba(59, 130, 246, 0.15); }
          50% { box-shadow: 0 0 0 6px var(--bg-card, #ffffff), 0 0 0 12px rgba(59, 130, 246, 0.4), 0 20px 40px rgba(59, 130, 246, 0.25); }
        }

        .hardware-feed-clean {
          width: 100%; height: 100%; object-fit: cover;
          border-radius: 160px; transform: scaleX(-1);
          opacity: ${status === 'loading' ? '0' : '1'};
          transition: opacity 0.5s ease;
        }

        .instruction-text {
          margin-top: 32px; font-size: 1.05rem; font-weight: 600;
          color: var(--text-main, #1e293b); text-align: center;
          min-height: 28px; display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: color 0.3s ease;
        }
        .instruction-text.warn { color: #ef4444; }
        .instruction-text.success { color: #10b981; }

        .progress-dots-container {
          display: flex; gap: 12px; margin-top: 24px;
        }
        .progress-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #e2e8f0; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .progress-dot.passed { background: #10b981; transform: scale(1.1); }
        .progress-dot.active { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }

        .loading-glass {
          position: absolute; inset: 0; border-radius: 160px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.8); backdrop-filter: blur(4px); z-index: 20;
        }

        .success-glass {
          position: absolute; inset: 0; border-radius: 160px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.9); backdrop-filter: blur(8px); z-index: 20;
          animation: popIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes popIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .spinner-clean {
          width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: #3b82f6;
          border-radius: 50%; animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Floating Arrow */
        .floating-arrow {
          position: absolute; background: #ffffff; color: #3b82f6;
          border-radius: 50%; width: 48px; height: 48px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 15;
          animation: floatArrow 1.5s ease-in-out infinite;
        }
        @keyframes floatArrow { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(0, -6px); } }

        .floating-arrow.left { left: -24px; top: 50%; margin-top: -24px; animation: floatLeft 1.5s ease-in-out infinite; }
        .floating-arrow.right { right: -24px; top: 50%; margin-top: -24px; animation: floatRight 1.5s ease-in-out infinite; }
        .floating-arrow.up { top: -24px; left: 50%; margin-left: -24px; animation: floatUp 1.5s ease-in-out infinite; }
        .floating-arrow.down { bottom: -24px; left: 50%; margin-left: -24px; animation: floatDown 1.5s ease-in-out infinite; }

        @keyframes floatLeft { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-6px); } }
        @keyframes floatRight { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(6px); } }
        @keyframes floatUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes floatDown { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
      `}</style>

      <div className="fintech-title">
        Xác minh danh tính
      </div>

      <div className={`camera-oval-pod ${displayProgress > 0 && !allPassedUI ? 'scanning' : ''}`}>
        <video ref={videoRef} className="hardware-feed-clean" muted playsInline />

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

        {/* Floating Direction Arrow */}
        {status === 'active' && !allPassedUI && faceDetected && !distanceWarn && currentDirection && (
          <div className={`floating-arrow ${currentDirection}`}>
            {renderArrow(currentDirection)}
          </div>
        )}
      </div>

      {/* Main Instruction Area */}
      <div className={`instruction-text ${distanceWarn || !faceDetected ? 'warn' : allPassedUI ? 'success' : ''}`}>
        {message}
      </div>

      {/* Clean Progress Dots */}
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

      {/* Smooth Progress Bar for Hold Duration (Optional visual flair) */}
      {status === 'active' && !allPassedUI && (
        <div style={{ width: '120px', height: '4px', background: '#f1f5f9', borderRadius: '2px', marginTop: '20px', overflow: 'hidden' }}>
          <div style={{ 
            height: '100%', 
            background: '#3b82f6', 
            width: `${displayProgress}%`, 
            transition: 'width 0.1s linear',
            borderRadius: '2px'
          }} />
        </div>
      )}

      {/* Error Fallback */}
      {status === 'error' && (
        <button 
          onClick={() => window.location.reload()} 
          style={{
            marginTop: 24, padding: '10px 24px', borderRadius: '12px',
            background: '#eff6ff', color: '#2563eb', border: 'none',
            fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
          }}
        >
          Thử lại
        </button>
      )}
    </div>
  );
}