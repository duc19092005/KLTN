import React, { useEffect, useRef, useState } from 'react';
import { loadModels, detectFace } from '../apis/faceService';
import LivenessCheck from './LivenessCheck';
import LoadingIndicator from '../../../shared/components/LoadingIndicator';

/**
 * FaceCapture
 *
 * Captures a face descriptor only after a successful liveness check.
 * The legacy "upload image" mode was removed: a static image is trivial
 * to spoof and bypasses every liveness signal, so this component now
 * has a single, mandatory path through LivenessCheck.
 */
export default function FaceCapture({
  onCapture,
  onError,
  disabled = false,
  label,
  captureMode = 'verify',
}) {
  const mountedRef = useRef(true);
  const [extractingEmbedding, setExtractingEmbedding] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Liveness passed → extract face descriptor(s) from the captured frame(s).
  // `meta.descriptor` (verify/session mode) is the identity-anchor descriptor LivenessCheck already
  // validated during the continuity check; reuse it directly so we don't re-detect on the final
  // frame, which is often a turned/blurred pose that face-api can't read.
  const handleLivenessPass = async (source, meta = {}) => {
    setExtractingEmbedding(true);
    try {
      if (captureMode !== 'enroll' && Array.isArray(meta.descriptor) && meta.descriptor.length === 128) {
        onCapture?.(meta.descriptor);
        return;
      }

      await loadModels();
      if (!mountedRef.current) return;

      const sources = Array.isArray(source) ? source : [source];
      const embeddings = [];

      for (const item of sources) {
        const embedding = await detectFace(item);
        if (embedding) embeddings.push(embedding);
      }

      if (embeddings.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (!mountedRef.current) return;
        const retry = await detectFace(sources[0]);
        if (!retry) {
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

      {extractingEmbedding && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
          <LoadingIndicator size="lg" tone="cyan" />
          <p className="mt-4 text-sm font-bold text-slate-800 tracking-tight text-center px-6">
            {label || (captureMode === 'enroll'
              ? 'Đang mã hóa dữ liệu sinh trắc học đa góc...'
              : 'Đang trích xuất Token định danh mã hóa...')}
          </p>
        </div>
      )}
    </div>
  );
}