import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import {
  initFaceEngine,
  detectFrame,
  classifyDirectionFromAngle,
  checkDistance,
  isBlink,
  destroyFaceEngine,
} from '../apis/faceEngine';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

// ─── Constants ───────────────────────────────────────────────────────────────

// Euclidean distance threshold for identity-continuity check.
// Embeddings are L2-normalised 128D vectors; threshold ~0.55 is loose enough to
// tolerate pose variance but tight enough to catch a different-person swap.
const IDENTITY_ANCHOR_THRESHOLD = 0.55;

// How long (ms) a head direction must be held before it counts as "passed".
const HOLD_DURATION = 800;       // non-center directions
const CENTER_HOLD_DURATION = 600; // center direction (easier to hold)

// Detection loop interval.
const LOOP_INTERVAL_MS = 100;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const euclideanDistance = (a, b) => {
  if (!a || !b || a.length !== b.length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
};

const generateRandomDirections = (count, { includeCenter = false } = {}) => {
  const pool = ['left', 'right', 'up', 'down'];
  if (includeCenter) pool.unshift('center');
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, pool.length));
};

const DIRECTION_INFO = {
  center: { instruction: 'Nhìn thẳng vào camera, giữ mặt ở giữa kén quét' },
  left:   { instruction: 'Quay đầu sang TRÁI, giữ trong 1 giây' },
  right:  { instruction: 'Quay đầu sang PHẢI, giữ trong 1 giây' },
  up:     { instruction: 'Ngẩng đầu lên TRÊN, giữ trong 1 giây' },
  down:   { instruction: 'Cúi đầu xuống DƯỚI, giữ trong 1 giây' },
};

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * LivenessCheck — Phiên bản Premium Clinical Tech (Xanh Y Tế Cao Cấp)
 *
 * Migrated from @mediapipe/tasks-vision + @vladmandic/face-api
 * → unified @vladmandic/human pipeline via faceEngine.js
 *
 * Changes vs previous version:
 *  - initFaceMesh() + loadFaceApiModels() → initFaceEngine() (single call)
 *  - detectLandmarks() + computeHeadPose() → detectFrame().{yaw, pitch}
 *  - classifyDirection(yawRatio, pitchRatio) → classifyDirectionFromAngle(yaw, pitch)
 *  - checkFaceDistance(landmarks) → checkDistance(face.distance)
 *  - computeBlendshapeBlink() / computeEyeOpenness() → isBlink(gestures)
 *  - detectFace(canvas) for identity anchor → detectFrame(video).embedding
 *  - destroyFaceMesh() → destroyFaceEngine()
 *
 *  Contract onLivenessPass(source, meta) is UNCHANGED.
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
  const capturedCanvasRef = useRef(null);
  const poseFramesRef = useRef([]);
  const passSentRef = useRef(false);
  const blinkStateRef = useRef({ closed: false, verified: false });
  const lastFrameWallTimeRef = useRef(null);
  const identityAnchorRef = useRef(null);   // 128D descriptor captured at blink moment
  const anchorPendingRef = useRef(false);

  // Keep latest callbacks in refs so timer effects don't re-arm on parent re-renders.
  const onLivenessPassRef = useRef(onLivenessPass);
  const onErrorRef = useRef(onError);
  onLivenessPassRef.current = onLivenessPass;
  onErrorRef.current = onError;

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

  // ─── Init / teardown ───────────────────────────────────────────────────────

  useEffect(() => {
    stateRef.current.directions = directions;
    let cancelled = false;

    const start = async () => {
      try {
        setStatus('loading');

        // Initialise human engine (loads + warms up blazeface, facemesh, faceres, iris).
        await initFaceEngine();
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

        // Wait until enough video data is available.
        await new Promise(resolve => {
          const check = () => {
            if (videoRef.current && videoRef.current.readyState >= 2) resolve();
            else setTimeout(check, 100);
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
      destroyFaceEngine();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Detection loop ────────────────────────────────────────────────────────

  const startLoop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(async () => {
      try {
        const s = stateRef.current;
        if (s.allPassed || disabled) return;
        if (!videoRef.current || videoRef.current.readyState < 2) return;

        // Anti-spoof: if wall-clock gap since last frame is too long, the stream
        // may be a pre-recorded video — reset blink state.
        const wallNow = performance.now();
        const lastWall = lastFrameWallTimeRef.current;
        if (lastWall !== null && (wallNow - lastWall) > 600) {
          blinkStateRef.current = { closed: false, verified: false };
          setBlinkVerified(false);
          holdStartRef.current = null;
          setDisplayProgress(0);
          setMessage('Khung hình bị gián đoạn. Vui lòng giữ camera ổn định.');
          lastFrameWallTimeRef.current = wallNow;
          return;
        }
        lastFrameWallTimeRef.current = wallNow;

        // Run the full human pipeline on the live video element.
        const detection = await detectFrame(videoRef.current);

        if (!detection) {
          setFaceDetected(false);
          setDisplayDir('center');
          setDistanceWarn(null);
          holdStartRef.current = null;
          setDisplayProgress(0);
          setMessage('Không tìm thấy khuôn mặt. Vui lòng điều chỉnh góc camera.');
          return;
        }

        setFaceDetected(true);

        // Distance guard (uses iris model).
        const dist = checkDistance(detection.distance);
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

        // ── Phase 1: Wait for blink (liveness proof) ──────────────────────
        const blinkState = blinkStateRef.current;

        if (!blinkState.verified) {
          const blinkNow = isBlink(detection.gestures);

          if (blinkNow) {
            // Eye is closing
            blinkState.closed = true;
            setMessage('Vui lòng chớp mắt một lần để xác nhận người thật');
          } else if (blinkState.closed) {
            // Eye re-opened after being closed → blink complete
            blinkState.verified = true;
            setBlinkVerified(true);
            setMessage('Đã xác nhận chớp mắt. Tiếp tục làm theo hướng dẫn');
            holdStartRef.current = null;
            setDisplayProgress(0);
            captureIdentityAnchor(detection);
          } else {
            setMessage('Vui lòng chớp mắt một lần để xác nhận người thật');
          }
          return;
        }

        // Retry anchor capture if blink-moment capture failed (eyes were half-closed).
        if (!identityAnchorRef.current && !anchorPendingRef.current) {
          captureIdentityAnchor(detection);
        }

        // ── Phase 2: Head direction challenge ─────────────────────────────
        const dir = classifyDirectionFromAngle(detection.yaw, detection.pitch);
        setDisplayDir(dir);

        if (dir === 'center') {
          const canvas = captureVideoFrame();
          if (canvas) capturedCanvasRef.current = canvas;
        }

        const targetDir = s.directions[s.currentIdx];
        if (!targetDir) return;

        const info = DIRECTION_INFO[targetDir] || DIRECTION_INFO.center;
        setMessage(info.instruction);

        const isCenterTarget = targetDir === 'center';
        // Center: yaw and pitch both close to 0 radians.
        const centerMatched = isCenterTarget && Math.abs(detection.yaw) < 0.12 && Math.abs(detection.pitch) < 0.12;
        const isTargetMatched = isCenterTarget ? centerMatched : dir === targetDir;

        if (isTargetMatched) {
          if (!holdStartRef.current) holdStartRef.current = performance.now();
          const elapsed = performance.now() - holdStartRef.current;
          const requiredHold = isCenterTarget ? CENTER_HOLD_DURATION : HOLD_DURATION;
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
                capturedCanvasRef.current = captureVideoFrame();
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
    }, LOOP_INTERVAL_MS);
  };

  const stopLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // ─── Identity anchor (blink moment) ───────────────────────────────────────

  /**
   * Store the 128D embedding from the detection result at blink-verify time.
   * Uses the embedding already computed by detectFrame() — no second inference.
   * Idempotent and async-safe via anchorPendingRef guard.
   * @param {object|null} latestDetection — detectFrame() result, may be null
   */
  const captureIdentityAnchor = (latestDetection) => {
    if (identityAnchorRef.current || anchorPendingRef.current) return;
    anchorPendingRef.current = true;
    try {
      if (latestDetection?.embedding?.length === 128) {
        identityAnchorRef.current = latestDetection.embedding;
      }
    } finally {
      anchorPendingRef.current = false;
    }
  };

  // ─── Identity continuity check ────────────────────────────────────────────

  /**
   * For each captured frame run detectFrame() and compare its 128D embedding
   * against the blink-moment anchor. Returns { ok, reason?, worstDistance?, anchor, descriptors }.
   */
  const verifyIdentityContinuity = async (framesToCheck) => {
    const descriptors = [];
    for (const frame of framesToCheck) {
      if (!frame) continue;
      try {
        const result = await detectFrame(frame);
        if (result?.embedding?.length === 128) {
          descriptors.push(result.embedding);
        }
      } catch (_) { /* skip bad frame */ }
    }

    // Prefer the live blink-moment anchor; fall back to first extracted descriptor.
    const anchor = identityAnchorRef.current || descriptors[0];

    if (!anchor) {
      return {
        ok: false,
        reason: 'Không phát hiện được khuôn mặt rõ ràng. Vui lòng cải thiện ánh sáng và thử lại.',
      };
    }

    let worstDistance = 0;
    for (const descriptor of descriptors) {
      const distance = euclideanDistance(anchor, descriptor);
      if (distance > worstDistance) worstDistance = distance;
      if (distance > IDENTITY_ANCHOR_THRESHOLD) {
        return {
          ok: false,
          reason: `Phát hiện thay đổi danh tính giữa phiên (khoảng cách ${distance.toFixed(2)}). Vui lòng đừng đổi người/ảnh trước camera.`,
        };
      }
    }

    return { ok: true, worstDistance, anchor, descriptors };
  };

  const restartScan = () => {
    passSentRef.current = false;
    blinkStateRef.current = { closed: false, verified: false };
    identityAnchorRef.current = null;
    anchorPendingRef.current = false;
    holdStartRef.current = null;
    poseFramesRef.current = [];
    capturedCanvasRef.current = null;

    stateRef.current.currentIdx = 0;
    stateRef.current.passedDirs = [];
    stateRef.current.allPassed = false;

    setAllPassedUI(false);
    setBlinkVerified(false);
    setDisplayIdx(0);
    setDisplayPassed([]);
    setDisplayProgress(0);
    setStatus('active');
    setMessage('Vui lòng đưa khuôn mặt vào chính giữa kén quét sinh trắc');

    startLoop();
  };

  // ─── Completion effect ────────────────────────────────────────────────────

  useEffect(() => {
    if (!allPassedUI || !videoRef.current || passSentRef.current) return;
    const timer = setTimeout(async () => {
      if (disabled || passSentRef.current) return;
      passSentRef.current = true;
      stopLoop();

      const frame = capturedCanvasRef.current || captureVideoFrame();
      const poseFrames = poseFramesRef.current.map(s => s.frame).filter(Boolean);
      const framesToCheck = isEnrollMode
        ? Array.from(new Set([...poseFrames, frame].filter(Boolean)))
        : [frame].filter(Boolean);

      setMessage('Đang kiểm tra tính liên tục của danh tính...');
      const continuity = await verifyIdentityContinuity(framesToCheck);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      if (!continuity.ok) {
        setStatus('error');
        setAllPassedUI(false);
        setMessage(continuity.reason);
        onErrorRef.current?.(continuity.reason);
        return;
      }

      console.log(`[Liveness] identity continuity OK, worst distance ${continuity.worstDistance?.toFixed(3)}`);
      const descriptor = Array.isArray(continuity.anchor) ? continuity.anchor : null;
      try {
        await onLivenessPassRef.current?.(
          isEnrollMode && poseFrames.length > 0 ? poseFrames : (frame || videoRef.current),
          { descriptor, descriptors: continuity.descriptors },
        );
      } catch (passErr) {
        setStatus('error');
        setAllPassedUI(false);
        const errMsg = passErr?.response?.data?.message || passErr?.message || 'Xác thực sinh trắc học thất bại.';
        setMessage(errMsg);
        onErrorRef.current?.(errMsg);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [allPassedUI, disabled, isEnrollMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── UI helpers ───────────────────────────────────────────────────────────

  const renderArrow = (direction) => {
    const rotationMap = { right: 0, down: 90, left: 180, up: 270 };
    const rotation = rotationMap[direction] ?? 0;
    return (
      <ArrowRight
        className="w-5 h-5 text-white transition-transform duration-300"
        strokeWidth={3.5}
        style={{ transform: `rotate(${rotation}deg)` }}
      />
    );
  };

  const getFeedbackStateClasses = () => {
    if (status === 'loading') return 'bg-slate-50 border-slate-100 text-slate-500';
    if (status === 'error') return 'bg-rose-50 border-rose-100 text-rose-600';
    if (allPassedUI) return 'bg-emerald-50 border-emerald-100 text-emerald-700';
    if (!blinkVerified && status === 'active') return 'bg-cyan-50 border-cyan-100 text-cyan-700';
    if (distanceWarn || (!faceDetected && status === 'active')) return 'bg-amber-50 border-amber-100/70 text-amber-700';
    return 'bg-cyan-50/70 border-cyan-100/50 text-cyan-800';
  };

  const getRingColorStyle = () => {
    if (status === 'loading') return 'ring-slate-100/80';
    if (allPassedUI) return 'ring-emerald-500/30';
    if (!blinkVerified && status === 'active') return 'ring-cyan-500/30';
    if (distanceWarn || (!faceDetected && status === 'active')) return 'ring-amber-500/30';
    if (displayProgress > 0) return 'ring-cyan-600/30';
    return 'ring-slate-200/60';
  };

  const currentDirection = directions[displayIdx];

  const arrowPositionClasses = {
    left:  '-left-14 top-1/2 -translate-y-1/2 animate-bounce-left',
    right: '-right-14 top-1/2 -translate-y-1/2 animate-bounce-right',
    up:    '-top-14 left-1/2 -translate-x-1/2 animate-bounce-up',
    down:  '-bottom-14 left-1/2 -translate-x-1/2 animate-bounce-down',
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-[480px] mx-auto p-6 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(59,130,246,0.04)] font-sans antialiased selection:bg-cyan-50 selection:text-cyan-700">

      {/* Header Panel */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100/80">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-cyan-600 animate-pulse" />
          <div>
            <p className="text-[10px] font-bold text-cyan-600/80 uppercase tracking-widest tracking-wider">Hệ thống nhận diện y tế</p>
            <h3 className="text-base font-bold text-slate-800 tracking-tight">
              {isEnrollMode ? 'Khởi Tạo Sinh Trắc Học' : 'Xác Minh Khuôn Mặt'}
            </h3>
          </div>
        </div>
        <div className="px-3 py-1 text-xs font-bold text-cyan-700 bg-cyan-50/60 border border-cyan-100/60 rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          Tiến trình: {Math.min(displayIdx + 1, directions.length)}/{directions.length}
        </div>
      </div>

      {/* Camera Scanning Stage */}
      <div className="relative w-full aspect-[4/3] bg-slate-50/50 border border-slate-100/40 rounded-2xl flex items-center justify-center overflow-visible">

        {/* Đường góc định vị trang trí chuẩn Medical OS */}
        <div className="absolute inset-4 border border-dashed border-slate-200/50 rounded-xl pointer-events-none opacity-50" />

        {/* Kén Oval quét Camera */}
        <div className={`relative w-[210px] h-[260px] rounded-[105px/130px] bg-slate-950 flex items-center justify-center transition-colors duration-500 ring-8 ${getRingColorStyle()} z-10`}>

          {/* Lớp Mặt nạ chứa camera */}
          <div className="absolute inset-0 overflow-hidden rounded-inherit">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-500 ${status === 'loading' ? 'opacity-0' : 'opacity-100'}`}
              muted
              playsInline
            />

            {/* Vòng chấm đứt đoạn phụ */}
            {status === 'active' && !allPassedUI && (
              <div className="absolute inset-4 border border-dashed border-white/20 rounded-[89px/114px] pointer-events-none opacity-40" />
            )}

            {/* Thanh Quét Laser */}
            {status === 'active' && !allPassedUI && (
              <div className="absolute left-[5%] right-[5%] h-[1.5px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_8px_#06b6d4] opacity-90 animate-scan-line pointer-events-none" />
            )}
          </div>

          {/* Màn kính phủ mờ khi Đang tải */}
          {status === 'loading' && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-md rounded-inherit flex flex-col items-center justify-center z-20">
              <LoadingIndicator size="md" tone="cyan" />
              <p className="text-[11px] font-semibold text-slate-400 mt-3 tracking-wide">Đang khởi tạo mô hình AI...</p>
            </div>
          )}

          {/* Màn kính phủ xanh khi Xác thực Thành công */}
          {allPassedUI && (
            <div className="absolute inset-0 bg-cyan-600/95 backdrop-blur-sm rounded-inherit flex flex-col items-center justify-center z-20 animate-in zoom-in-95 duration-300">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md mb-2 animate-bounce">
                <Check className="w-5 h-5 text-emerald-600" strokeWidth={4} />
              </div>
              <p className="text-[10px] font-bold text-white uppercase tracking-widest">Hợp Lệ</p>
            </div>
          )}

          {/* Mũi tên nổi hướng dẫn quay đầu */}
          {status === 'active' && !allPassedUI && faceDetected && !distanceWarn && currentDirection && currentDirection !== 'center' && (
            <div className={`absolute w-10 h-10 bg-cyan-600 text-white rounded-full shadow-sm flex items-center justify-center border border-cyan-400/20 z-30 ${arrowPositionClasses[currentDirection]}`}>
              {renderArrow(currentDirection)}
            </div>
          )}
        </div>
      </div>

      {/* Điều khiển Bảng hướng dẫn & Chỉ báo Tiến độ */}
      <div className="mt-6 flex flex-col items-center">

        {/* Hộp thông báo phản hồi động */}
        <div className={`w-full py-3.5 px-4 rounded-2xl border text-center transition-colors duration-300 min-h-[52px] flex items-center justify-center ${getFeedbackStateClasses()}`}>
          <p className="text-sm font-bold tracking-tight leading-snug">
            {message}
          </p>
        </div>

        {/* Chuỗi chấm chỉ số hành động */}
        {status === 'active' && directions.length > 0 && (
          <div className="flex justify-center items-center gap-2 mt-5">
            {directions.map((dir, idx) => {
              const isPassed = displayPassed.includes(dir);
              const isCurrent = idx === displayIdx && !allPassedUI;
              return (
                <div
                  key={`${dir}-${idx}`}
                  className={`h-2 rounded-full transition-colors duration-300
                    ${isPassed ? 'w-6 bg-emerald-500 shadow-sm' : isCurrent ? 'w-4 bg-cyan-600 ring-4 ring-cyan-100' : 'w-2 bg-slate-200'}`}
                />
              );
            })}
          </div>
        )}

        {/* Thanh Progress lưu giữ vị trí hướng */}
        {status === 'active' && !allPassedUI && displayProgress > 0 && (
          <div className="w-full max-w-[180px] h-1 bg-slate-100 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-cyan-600 transition-colors duration-70 linear rounded-full shadow-sm"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        )}

        {/* Xử lý lỗi */}
        {status === 'error' && (
          <button
            type="button"
            onClick={restartScan}
            className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-xl text-xs transition-colors shadow-sm outline-none flex items-center justify-center gap-2"
          >
            <span>Quét lại khuôn mặt</span>
          </button>
        )}
      </div>

      {/* CSS keyframes */}
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
