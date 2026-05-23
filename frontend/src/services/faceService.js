import * as faceapi from '@vladmandic/face-api';

let modelsLoaded = false;

/**
 * Load face-api.js models from public/models directory
 */
export async function loadModels() {
  if (modelsLoaded) return;

  // Sử dụng CDN chính thức của jsdelivr thay vì local path để tránh việc người dùng phải tải thủ công
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]);

  modelsLoaded = true;
  console.log('✅ Face-api models loaded');
}

/**
 * Detect a face and extract 128-dimensional embedding from video element
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} videoEl
 * @returns {Float32Array|null} 128-dim face embedding or null if no face found
 */
export async function detectFace(videoEl) {
  if (!modelsLoaded) await loadModels();

  // Try first with default/standard confidence threshold (0.4)
  let detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  // Fallback to a lower confidence threshold (0.2) if not found (helps with turned/tilted faces)
  if (!detection) {
    detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
      .withFaceLandmarks()
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

