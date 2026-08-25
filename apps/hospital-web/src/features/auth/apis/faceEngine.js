/**
 * faceEngine.js — Unified face recognition engine (hospital-web)
 *
 * Replaces both `faceService.js` (@vladmandic/face-api) and `livenessService.js`
 * (@mediapipe/tasks-vision) with a single @vladmandic/human pipeline.
 *
 * Key responsibilities:
 *  1. initFaceEngine()   — load + warm up models (self-hosted under /human/models/)
 *  2. detectFrame()      — run full pipeline on a video/canvas frame; returns angle,
 *                          gestures, distance, and a 128D embedding ready for the backend.
 *  3. reduceEmbeddingTo128() — reshape 1024D FaceRes output → 128D via logSumExp + L2 norm
 *  4. classifyDirectionFromAngle() — from Euler yaw/pitch → 'left'|'right'|'up'|'down'|'center'
 *  5. isBlink()          — check if gesture list contains a blink event
 *  6. destroyFaceEngine() — release GPU memory when component unmounts
 *
 * Backend compatibility note:
 *   hospital-api validateFaceDescriptor() requires exactly 128 numbers all in [-2, 2].
 *   FaceRes natively outputs 1024D → we reduce with the formula the author commented out
 *   in faceres.ts: reshape [128×8] then logSumExp over dim-1, then L2-normalize.
 *   All values after L2-norm are in [-1, 1] ⊂ [-2, 2], so the backend check passes.
 *   This transform is applied identically during enroll AND verify, ensuring consistency.
 */

import Human from '@vladmandic/human';

// ─── Direction classification thresholds (degrees from Euler angles) ─────────
// `rotation.angle.yaw` and `rotation.angle.pitch` are in RADIANS from human lib.
// Positive yaw  = face turning right (from user's perspective → camera sees left)
// Negative yaw  = face turning left
// Positive pitch = face tilting up
// Negative pitch = face tilting down
// Thresholds optimized for natural gentle head movements (±0.15 rad ≈ ±8.6°).

const DIR_THRESHOLDS = {
  YAW:   0.15, // radians — min absolute yaw to count as left/right (~8.6°)
  PITCH: 0.14, // radians — min absolute pitch to count as up/down (~8.0°)
};

// Distance guard: iris-based distance in metres from camera.
// human returns face.distance in metres when iris model is enabled.
// Broadened to accommodate typical desk & laptop camera distances (0.2m - 1.1m).
const DISTANCE = {
  TOO_FAR:   1.10, // metres > this → user is too far
  TOO_CLOSE: 0.15, // metres < this → user is too close
};

// ─── Human config ─────────────────────────────────────────────────────────────

/**
 * Minimal config: only face pipeline + gesture. Body/hand/object/segmentation
 * disabled for performance. iris enabled for distance measurement.
 * Models are self-hosted at /human/models/ to avoid any CDN dependency.
 */
const humanConfig = {
  modelBasePath: '/human/models/',
  backend: 'webgl',
  warmup: 'face',
  debug: false,
  async: true,
  cacheSensitivity: 0,  // always run fresh — embedding must not be stale
  filter: {
    enabled: false,     // disable auto-brightness to keep embedding stable across frames
  },
  gesture: {
    enabled: true,      // blink left eye / blink right eye / facing left|right|center / head up|down
  },
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: true,   // correct for head tilt before mesh/embedding pass
      maxDetected: 1,
      skipFrames: 0,    // liveness loop — never skip
      skipTime: 0,
      minConfidence: 0.2, // increased sensitivity for quick face acquisition
    },
    mesh: {
      enabled: true,    // required for rotation.angle + gesture
      skipFrames: 0,
      skipTime: 0,
    },
    attention: { enabled: false },
    iris: {
      enabled: true,    // required for face.distance
      skipFrames: 0,
      skipTime: 0,
    },
    description: {
      enabled: true,    // FaceRes → 1024D embedding (we reduce to 128D)
      modelPath: 'faceres.json',
      skipFrames: 0,
      skipTime: 0,
      minConfidence: 0.1,
    },
    emotion:   { enabled: false },
    antispoof: { enabled: false },
    liveness:  { enabled: false },
  },
  body:        { enabled: false },
  hand:        { enabled: false },
  object:      { enabled: false },
  segmentation:{ enabled: false },
};

// ─── Singleton human instance ─────────────────────────────────────────────────

let human = null;
let initPromise = null;

/**
 * Initialize the Human instance and warm up models.
 * Safe to call multiple times — returns the same promise.
 * @returns {Promise<void>}
 */
export async function initFaceEngine() {
  if (human) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    human = new Human(humanConfig);
    try {
      await human.warmup();
      console.log('[FaceEngine] ✅ @vladmandic/human warmed up (self-hosted models)');
    } catch (err) {
      human = null;
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

// ─── 1024D → 128D reduction ──────────────────────────────────────────────────

/**
 * Reduce a 1024-element FaceRes embedding to 128 elements.
 *
 * Algorithm (mirrors the commented-out code in human/src/face/faceres.ts):
 *   1. Reshape [1024] → [128, 8]
 *   2. For each group of 8: compute log-sum-exp (numerically stable via max trick)
 *   3. L2-normalise the resulting 128-element vector
 *
 * All resulting values are in [-1, 1] which satisfies the backend constraint [-2, 2].
 * This transform must be applied identically for BOTH enroll and verify.
 *
 * @param {number[]|Float32Array} embedding1024 — raw 1024D output from FaceRes model
 * @returns {number[]} — 128D L2-normalised descriptor
 */
export function reduceEmbeddingTo128(embedding1024) {
  if (!embedding1024 || embedding1024.length !== 1024) {
    throw new Error(`[FaceEngine] reduceEmbeddingTo128: expected 1024 elements, got ${embedding1024?.length}`);
  }

  const out = new Float32Array(128);

  // Step 1+2: reshape to [128, 8] and logSumExp over dim-1
  for (let i = 0; i < 128; i++) {
    const base = i * 8;
    let maxVal = -Infinity;
    for (let j = 0; j < 8; j++) {
      if (embedding1024[base + j] > maxVal) maxVal = embedding1024[base + j];
    }
    let sumExp = 0;
    for (let j = 0; j < 8; j++) {
      sumExp += Math.exp(embedding1024[base + j] - maxVal);
    }
    out[i] = maxVal + Math.log(sumExp); // log-sum-exp (stable)
  }

  // Step 3: L2-normalise so each element ∈ (-1, 1)
  let norm = 0;
  for (let i = 0; i < 128; i++) norm += out[i] * out[i];
  norm = Math.sqrt(norm) || 1; // guard against zero vector
  for (let i = 0; i < 128; i++) out[i] /= norm;

  return Array.from(out);
}

// ─── Direction classification ─────────────────────────────────────────────────

/**
 * Classify head direction from Euler angles (radians).
 *
 * human's `rotation.angle` convention:
 *   yaw   > 0 → face turning right (camera sees left side)  → gesture 'facing left' in code
 *   yaw   < 0 → face turning left  (camera sees right side) → gesture 'facing right' in code
 *   pitch > 0 → looking up
 *   pitch < 0 → looking down
 *
 * NOTE: we keep left/right semantics consistent with the existing LivenessCheck UI
 * (directions are from the user's perspective, matching original livenessService.js).
 *
 * @param {number} yaw   — radians
 * @param {number} pitch — radians
 * @returns {'left'|'right'|'up'|'down'|'center'}
 */
export function classifyDirectionFromAngle(yaw, pitch) {
  const absYaw   = Math.abs(yaw);
  const absPitch = Math.abs(pitch);

  const yawSig   = absYaw   >= DIR_THRESHOLDS.YAW;
  const pitchSig = absPitch >= DIR_THRESHOLDS.PITCH;

  // If both axes are significant pick the dominant one
  if (yawSig && pitchSig) {
    if (absYaw > absPitch) {
      return yaw < 0 ? 'left' : 'right';
    } else {
      return pitch < 0 ? 'up' : 'down';
    }
  }

  if (yawSig)   return yaw   < 0 ? 'left' : 'right';
  if (pitchSig) return pitch < 0 ? 'up'   : 'down';

  return 'center';
}

// ─── Blink detection ─────────────────────────────────────────────────────────

/**
 * Check if the gesture list from human.detect() contains a blink event.
 * human reports: { face: 0, gesture: 'blink left eye' } or 'blink right eye'.
 *
 * @param {Array} gestures — res.gesture from human.detect()
 * @returns {boolean}
 */
export function isBlink(gestures) {
  if (!Array.isArray(gestures)) return false;
  return gestures.some((g) => typeof g.gesture === 'string' && g.gesture.startsWith('blink '));
}

// ─── Distance check ──────────────────────────────────────────────────────────

/**
 * Check if the face is within an acceptable distance from the camera.
 * Uses face.distance (metres) from the iris model.
 *
 * @param {number|undefined} distanceMetres
 * @returns {'TOO_FAR'|'TOO_CLOSE'|'OK'}
 */
export function checkDistance(distanceMetres) {
  if (distanceMetres == null || distanceMetres === 0) return 'OK'; // iris not available → skip
  if (distanceMetres > DISTANCE.TOO_FAR)   return 'TOO_FAR';
  if (distanceMetres < DISTANCE.TOO_CLOSE) return 'TOO_CLOSE';
  return 'OK';
}

// ─── Main detection function ──────────────────────────────────────────────────

/**
 * Run the full face pipeline on a video or canvas element.
 * Returns null when no face is detected or engine is not initialised.
 *
 * Return shape:
 * {
 *   embedding:  number[128],  // ready for registerFace / verifyFace
 *   embedding1024: number[1024], // raw — can be used for identity-anchor comparison
 *   yaw:        number,       // radians
 *   pitch:      number,       // radians
 *   roll:       number,       // radians
 *   gestures:   GestureResult[],
 *   distance:   number|undefined, // metres
 *   score:      number,       // overall face detection confidence
 *   box:        [x,y,w,h],
 * }
 *
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} source
 * @returns {Promise<object|null>}
 */
export async function detectFrame(source) {
  if (!human) return null;

  let res;
  try {
    res = await human.detect(source);
  } catch (err) {
    console.warn('[FaceEngine] detect error:', err?.message || err);
    return null;
  }

  const face = res.face?.[0];
  if (!face) return null;

  // FaceRes embedding (1024D raw)
  const raw1024 = face.embedding;
  if (!raw1024 || raw1024.length !== 1024) return null; // description model not ready yet

  const embedding = reduceEmbeddingTo128(raw1024);

  return {
    embedding,                                     // number[128] — for backend
    embedding1024: Array.from(raw1024),            // number[1024] — for identity-anchor
    yaw:     face.rotation?.angle?.yaw   ?? 0,     // radians
    pitch:   face.rotation?.angle?.pitch ?? 0,     // radians
    roll:    face.rotation?.angle?.roll  ?? 0,     // radians
    gestures: res.gesture ?? [],
    distance: face.distance,                       // metres (iris model), may be undefined
    score:    face.score,
    box:      face.box,
  };
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Release all GPU memory and reset state.
 * Call from useEffect cleanup when the camera component unmounts.
 */
export function destroyFaceEngine() {
  if (human) {
    try { human.dispose(); } catch (_) { /* ignore */ }
    human = null;
    initPromise = null;
    console.log('[FaceEngine] disposed');
  }
}

/**
 * True once initFaceEngine() has completed successfully.
 */
export function isFaceEngineReady() {
  return human !== null;
}
