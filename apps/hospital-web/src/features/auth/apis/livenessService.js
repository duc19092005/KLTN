import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker = null;
let initPromise = null;

// ── Self-hosted asset paths (served from apps/hospital-web/public) ──────────
// Avoids depending on jsdelivr/googleapis at runtime; better privacy + offline.
const MEDIAPIPE_WASM_URL = '/mediapipe/wasm';
const MEDIAPIPE_MODEL_URL = '/mediapipe/models/face_landmarker.task';

// ── Thresholds ──────────────────────────────────────────────────
export const THRESHOLDS = {
  // Head direction thresholds (ratio-based)
  // Yaw center ≈ 1.0, Pitch center ≈ 0.85
  YAW_LEFT: 1.28,      // ratio > this → looking LEFT
  YAW_RIGHT: 0.72,     // ratio < this → looking RIGHT
  PITCH_UP: 0.67,      // ratio < this → looking UP
  PITCH_DOWN: 1.03,    // ratio > this → looking DOWN

  // Minimum deviation from center to count as a direction
  MIN_YAW_DEVIATION: 0.28,   // |yawRatio - 1.0| must exceed this (increased from 0.18)
  MIN_PITCH_DEVIATION: 0.18, // |pitchRatio - 0.85| must exceed this (increased from 0.12)

  // Face distance (inter-eye distance in normalized coords)
  DISTANCE_TOO_FAR: 0.05,
  DISTANCE_TOO_CLOSE: 0.35,

  // Hold duration in ms
  HOLD_DURATION: 1000,
  CENTER_HOLD_DURATION: 450,

  // Center pose is intentionally wider because exact front-facing ratios vary per camera/person
  CENTER_MAX_YAW_DEVIATION: 0.42,
  CENTER_MAX_PITCH_DEVIATION: 0.30,

  // Face inside oval tolerance
  FACE_BOUNDS_TOLERANCE: 0.25,

  // Blendshape blink (eyeBlink* score is 0-1; >0.55 ≈ closed)
  BLENDSHAPE_BLINK_CLOSED: 0.55,
  BLENDSHAPE_BLINK_OPEN: 0.30,

  // Temporal anti-spoof: if frames stop arriving for too long the session is suspect.
  MAX_FRAME_GAP_MS: 800,
};

// ── Key landmark indices (MediaPipe Face Mesh 468 points) ───────
const LM = {
  NOSE_TIP: 1,
  CHIN: 152,
  LEFT_EYE_OUTER: 33,
  RIGHT_EYE_OUTER: 263,
  FOREHEAD: 10,
  LEFT_MOUTH: 61,
  RIGHT_MOUTH: 291,
  LEFT_EYE_INNER: 133,
  RIGHT_EYE_INNER: 362,
  LEFT_EYE_UPPER: 159,
  LEFT_EYE_LOWER: 145,
  RIGHT_EYE_UPPER: 386,
  RIGHT_EYE_LOWER: 374,
};

/**
 * Initialize MediaPipe FaceLandmarker from self-hosted assets.
 * Returns a promise that resolves when ready.
 */
export async function initFaceMesh() {
  if (faceLandmarker) return faceLandmarker;
  if (initPromise) return initPromise;

  const buildOptions = (delegate) => ({
    baseOptions: {
      modelAssetPath: MEDIAPIPE_MODEL_URL,
      delegate,
    },
    outputFaceBlendshapes: true, // Enables eyeBlinkLeft/Right + mouth/expression scores for stronger anti-spoof signals.
    outputFacialTransformationMatrixes: false,
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  initPromise = (async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, buildOptions('GPU'));
      console.log('✅ MediaPipe FaceLandmarker loaded (self-hosted, GPU)');
      return faceLandmarker;
    } catch (err) {
      console.warn('⚠️ MediaPipe GPU load failed, falling back to CPU:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
        faceLandmarker = await FaceLandmarker.createFromOptions(vision, buildOptions('CPU'));
        console.log('✅ MediaPipe FaceLandmarker loaded (self-hosted, CPU fallback)');
        return faceLandmarker;
      } catch (fallbackErr) {
        initPromise = null;
        throw fallbackErr;
      }
    }
  })();

  return initPromise;
}

/**
 * Detect face landmarks from a video frame.
 * Returns landmarks + blendshape scores when available.
 */
export function detectLandmarks(videoEl, timestampMs) {
  if (!faceLandmarker) return null;

  const result = faceLandmarker.detectForVideo(videoEl, timestampMs);
  if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
    return null;
  }
  return {
    landmarks: result.faceLandmarks[0],
    blendshapes: result.faceBlendshapes?.[0]?.categories || null,
  };
}

/**
 * Read a blendshape score by category name (e.g. 'eyeBlinkLeft').
 */
export function getBlendshape(blendshapes, name) {
  if (!Array.isArray(blendshapes)) return undefined;
  const entry = blendshapes.find((item) => item?.categoryName === name);
  return entry ? entry.score : undefined;
}

/**
 * Average eye blink score from blendshapes. Higher = more closed.
 * Returns undefined if blendshapes are not available.
 */
export function computeBlendshapeBlink(blendshapes) {
  const left = getBlendshape(blendshapes, 'eyeBlinkLeft');
  const right = getBlendshape(blendshapes, 'eyeBlinkRight');
  if (left === undefined && right === undefined) return undefined;
  if (left === undefined) return right;
  if (right === undefined) return left;
  return (left + right) / 2;
}

/**
 * Detect a frame-time discontinuity (e.g. paused/recorded video) and return
 * true if the gap since last frame is suspiciously large.
 */
export function isTemporalGapSuspicious(prevTs, currentTs) {
  if (typeof prevTs !== 'number') return false;
  return currentTs - prevTs > THRESHOLDS.MAX_FRAME_GAP_MS;
}

/**
 * Compute head pose from face landmarks using geometric heuristics
 *
 * Yaw (left/right): Compare distance from nose to each eye
 *   - If the ratio grows above center → looking LEFT from user's perspective
 *   - If the ratio drops below center → looking RIGHT from user's perspective
 *
 * Pitch (up/down): Compare nose-to-eye vs nose-to-chin vertical ratio
 *   - If nose is relatively higher → looking UP
 *   - If nose is relatively lower → looking DOWN
 *
 * @param {Array} landmarks - 468 face landmark points with {x, y, z}
 * @returns {{ yawRatio: number, pitchRatio: number }}
 */
export function computeHeadPose(landmarks) {
  const nose = landmarks[LM.NOSE_TIP];
  const leftEye = landmarks[LM.LEFT_EYE_OUTER];
  const rightEye = landmarks[LM.RIGHT_EYE_OUTER];
  const chin = landmarks[LM.CHIN];
  const forehead = landmarks[LM.FOREHEAD];

  // ── Yaw calculation ──
  // Distance from nose to left eye vs right eye (in X axis)
  // Note: MediaPipe returns mirrored coords, left eye in image = user's right eye
  const leftDist = Math.abs(nose.x - leftEye.x);
  const rightDist = Math.abs(nose.x - rightEye.x);
  const yawRatio = leftDist / (rightDist + 0.0001); // Avoid division by zero

  // ── Pitch calculation ──
  // Ratio of nose-to-eye-midpoint vs nose-to-chin (in Y axis)
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const noseToEyeY = Math.abs(nose.y - eyeMidY);
  const noseToChinY = Math.abs(chin.y - nose.y);
  const pitchRatio = noseToEyeY / (noseToChinY + 0.0001);

  return { yawRatio, pitchRatio };
}

/**
 * Classify head direction from pose ratios
 * @param {number} yawRatio
 * @param {number} pitchRatio
 * @returns {'left'|'right'|'up'|'down'|'center'}
 */
export function classifyDirection(yawRatio, pitchRatio) {
  // Calculate how far each ratio deviates from its "center" value
  // Yaw center ≈ 1.0 (nose equidistant from both eyes)
  // Pitch center ≈ 0.85 (nose naturally closer to eyes than to chin)
  const yawDeviation = Math.abs(yawRatio - 1.0);
  const pitchDeviation = Math.abs(pitchRatio - 0.85);

  const yawSignificant = yawDeviation >= THRESHOLDS.MIN_YAW_DEVIATION;
  const pitchSignificant = pitchDeviation >= THRESHOLDS.MIN_PITCH_DEVIATION;

  // If both axes are significant, pick the one with larger deviation
  if (yawSignificant && pitchSignificant) {
    if (yawDeviation > pitchDeviation) {
      return yawRatio > 1.0 ? 'left' : 'right';
    } else {
      return pitchRatio < 0.85 ? 'up' : 'down';
    }
  }

  // Only one axis is significant
  if (yawSignificant) {
    return yawRatio > 1.0 ? 'left' : 'right';
  }
  if (pitchSignificant) {
    return pitchRatio < 0.85 ? 'up' : 'down';
  }

  return 'center';
}

/**
 * Check face distance from camera using inter-eye distance
 * @param {Array} landmarks - Face landmarks
 * @returns {'TOO_FAR'|'TOO_CLOSE'|'OK'}
 */
export function checkFaceDistance(landmarks) {
  const leftEye = landmarks[LM.LEFT_EYE_OUTER];
  const rightEye = landmarks[LM.RIGHT_EYE_OUTER];

  // Inter-eye distance in normalized coordinates (0-1)
  const eyeDistance = Math.abs(rightEye.x - leftEye.x);

  if (eyeDistance < THRESHOLDS.DISTANCE_TOO_FAR) return 'TOO_FAR';
  if (eyeDistance > THRESHOLDS.DISTANCE_TOO_CLOSE) return 'TOO_CLOSE';
  return 'OK';
}

/**
 * Estimate eye openness using normalized eyelid distance.
 * Lower value means eyes are closed or nearly closed.
 * @param {Array} landmarks
 * @returns {number}
 */
export function computeEyeOpenness(landmarks) {
  const leftOuter = landmarks[LM.LEFT_EYE_OUTER];
  const leftInner = landmarks[LM.LEFT_EYE_INNER];
  const leftUpper = landmarks[LM.LEFT_EYE_UPPER];
  const leftLower = landmarks[LM.LEFT_EYE_LOWER];
  const rightOuter = landmarks[LM.RIGHT_EYE_OUTER];
  const rightInner = landmarks[LM.RIGHT_EYE_INNER];
  const rightUpper = landmarks[LM.RIGHT_EYE_UPPER];
  const rightLower = landmarks[LM.RIGHT_EYE_LOWER];

  const leftWidth = Math.abs(leftInner.x - leftOuter.x) + 0.0001;
  const rightWidth = Math.abs(rightInner.x - rightOuter.x) + 0.0001;
  const leftOpen = Math.abs(leftLower.y - leftUpper.y) / leftWidth;
  const rightOpen = Math.abs(rightLower.y - rightUpper.y) / rightWidth;

  return (leftOpen + rightOpen) / 2;
}

/**
 * Check if face center is roughly within the oval guide
 * @param {Array} landmarks
 * @returns {boolean}
 */
export function isFaceInOval(landmarks) {
  const nose = landmarks[LM.NOSE_TIP];
  const tolerance = THRESHOLDS.FACE_BOUNDS_TOLERANCE;

  // Face should be roughly centered (nose near 0.5, 0.5 in normalized coords)
  return (
    nose.x > (0.3 - tolerance) &&
    nose.x < (0.7 + tolerance) &&
    nose.y > (0.2 - tolerance) &&
    nose.y < (0.8 + tolerance)
  );
}

/**
 * Generate a random selection of directions for liveness check
 * @param {number} count - How many directions to pick (default: 4 = all directions)
 * @returns {string[]} - e.g. ['right', 'up', 'left', 'down']
 */
export function generateRandomDirections(count = 4, options = {}) {
  const all = options.includeCenter
    ? ['left', 'right', 'up', 'down', 'center']
    : ['left', 'right', 'up', 'down'];
  // Shuffle using Fisher-Yates
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, Math.min(count, all.length));
}

/**
 * Get display info for a direction
 * @param {string} direction
 * @returns {{ label: string, labelVi: string, arrow: string, instruction: string }}
 */
export function getDirectionInfo(direction) {
  const map = {
    left: {
      label: 'LEFT',
      labelVi: 'TRÁI',
      arrow: '←',
      instruction: 'Hãy quay mặt sang TRÁI',
    },
    right: {
      label: 'RIGHT',
      labelVi: 'PHẢI',
      arrow: '→',
      instruction: 'Hãy quay mặt sang PHẢI',
    },
    up: {
      label: 'UP',
      labelVi: 'LÊN',
      arrow: '↑',
      instruction: 'Hãy ngẩng mặt LÊN',
    },
    down: {
      label: 'DOWN',
      labelVi: 'XUỐNG',
      arrow: '↓',
      instruction: 'Hãy cúi mặt XUỐNG',
    },
    center: {
      label: 'CENTER',
      labelVi: 'THẲNG',
      arrow: '•',
      instruction: 'Hãy nhìn THẲNG vào camera',
    },
  };
  return map[direction] || map.left;
}

/**
 * Cleanup MediaPipe resources
 */
export function destroyFaceMesh() {
  if (faceLandmarker) {
    faceLandmarker.close();
    faceLandmarker = null;
    initPromise = null;
  }
}
