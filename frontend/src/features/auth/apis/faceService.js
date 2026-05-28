import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

/**
 * Load face-api.js models from public/models directory
 */
export async function loadModels() {
  if (modelsLoaded) return;

  const MODEL_URL = '/models';
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
}

/**
 * Detect a face and extract 128-dimensional embedding from video element
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} videoEl
 * @returns {Float32Array|null} 128-dim face embedding or null if no face found
 */
export async function detectFace(videoEl) {
  if (!modelsLoaded) await loadModels();

  // Primary: high quality detection
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.50,  // Stricter: only confident detections
  });

  let detection = await faceapi
    .detectSingleFace(videoEl, detectorOptions)
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection) {
    // Fallback with slightly lower threshold, but NOT low enough to accept blurry/angled faces
    detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.40 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor();
  }

  if (!detection) return null;

  return Array.from(detection.descriptor); // 128-dim float array
}

/**
 * Check if models are loaded
 */
export function areModelsLoaded() {
  return modelsLoaded;
}
