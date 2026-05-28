import { useState, useRef, useEffect, useCallback } from 'react';
import { loadModels, detectFace } from '../services/faceService';
import LivenessCheck from './LivenessCheck';

/**
 * FaceCapture component with premium balanced layout and no emojis
 */
export default function FaceCapture({ onCapture, onError, autoStart = false, requireLiveness = true, disabled = false, label }) {
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);
  
  const [mode, setMode] = useState('upload');
  const [status, setStatus] = useState('idle');
  const [stream, setStream] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [message, setMessage] = useState('Select an option to initialize system.');
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
    setMessage('Loading core identification models...');

    try {
      await loadModels();
      setMessage('Requesting hardware access...');

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
          if (e.name !== 'AbortError') console.warn('Camera context aborted:', e);
        });
      }

      setStream(mediaStream);
      setStatus('ready');
      setMessage('Biometric feed is active. Ready to analyze.');
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus('error');
      setMessage(err.message || 'Hardware initialization failed');
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

  // ── Liveness mode: after liveness passes, extract face embedding ──
  const handleLivenessPass = async (videoElement) => {
    setExtractingEmbedding(true);
    try {
      await loadModels();
      if (!mountedRef.current) return;
      const embedding = await detectFace(videoElement);

      if (!embedding) {
        await new Promise(r => setTimeout(r, 500));
        if (!mountedRef.current) return;
        const retry = await detectFace(videoElement);
        if (!retry) {
          setExtractingEmbedding(false);
          onError?.('Could not extract face identity. Please try again.');
          return;
        }
        onCapture?.(retry);
      } else {
        onCapture?.(embedding);
      }
    } catch (err) {
      onError?.('Extraction error: ' + err.message);
    } finally {
      if (mountedRef.current) setExtractingEmbedding(false);
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setStatus('error');
      setMessage('Please select an image file smaller than 5 MB.');
      return;
    }

    setStatus('loading');
    setMessage('Processing file matrix...');
    try {
      await loadModels();
      
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
        setStatus('ready');
        setMessage('Static image source loaded into memory.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setStatus('error');
      setMessage('Failed to process structure: ' + err.message);
      onError?.(err.message);
    }
  };

  const scanFace = async () => {
    const elementToScan = mode === 'camera' ? videoRef.current : imageRef.current;
    if (!elementToScan) return;

    setStatus('scanning');
    setMessage('Executing node matching array...');

    try {
      const embedding = await detectFace(elementToScan);

      if (!embedding) {
        setStatus('ready');
        setMessage('Vector generation failed. No recognizable feature mapping found.');
        return;
      }

      setStatus('captured');
      setMessage('Identity data set generated and synchronized.');
      onCapture?.(embedding);
    } catch (err) {
      setStatus('error');
      setMessage('Verification fault: ' + err.message);
      onError?.(err.message);
    }
  };

  // State Color Matrix Mapping for Premium UI Boundaries
  const stateBorderColor = () => {
    if (status === 'error') return 'var(--danger, #ef4444)';
    if (status === 'captured') return 'var(--success, #10b981)';
    if (status === 'scanning' || status === 'loading') return 'var(--primary-adm, #4f46e5)';
    return 'var(--input-border, #cbd5e1)';
  };

  // ── LIVENESS MODE VIEW ──
  if (requireLiveness) {
    return (
      <div style={{ width: '100%', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <LivenessCheck
            onLivenessPass={handleLivenessPass}
            onError={onError}
            disabled={disabled}
          />
        </div>
        {extractingEmbedding && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15, 23, 42, 0.95)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            zIndex: 50, borderRadius: 16, border: '1px solid var(--card-border, rgba(255,255,255,0.08))'
          }}>
            <div className="processing-spinner" />
            <p style={{ marginTop: 16, color: 'var(--text-main)', fontWeight: 600, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
              {label || 'Extracting cryptographic face token...'}
            </p>
          </div>
        )}
        <style>{`
          .processing-spinner {
            width: 40px; height: 40px;
            border: 3px solid rgba(255, 255, 255, 0.1);
            border-radius: 50%;
            border-top-color: var(--primary-adm, #4f46e5);
            animation: spinLoop 0.8s linear infinite;
          }
          @keyframes spinLoop { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // ── LEGACY MODE VIEW (requireLiveness=false) ──
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`
        .tab-segment-bar { display: flex; gap: 8px; width: 100%; max-width: 320px; margin-bottom: 24px; background: rgba(0,0,0,0.03); padding: 4px; border-radius: 8px; }
        .tab-trigger { flex: 1; height: 36px; border: none; background: transparent; border-radius: 6px; color: var(--text-muted); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease; }
        .tab-trigger.active { background: var(--input-bg, #fff); color: var(--text-main); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        
        .viewscreen-viewport {
          position: relative; width: 100%; max-width: 440px; border-radius: 12px; overflow: hidden;
          background: #090d16; aspect-ratio: 4/3; transition: border-color 0.25s ease; display: flex; align-items: center; justify-content: center;
        }
        .placeholder-state-ui { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.85rem; font-weight: 500; }
        
        .internal-action-row { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; margin-top: 20px; align-items: center; }
        .hidden-file-input { display: none; }
        
        .legacy-feedback-msg { text-align: center; margin: 16px 0 0 0; font-size: 0.88rem; font-weight: 600; min-height: 20px; width: 100%; max-width: 440px; }
      `}</style>

      {/* Symmetric Controlled Segment Tabs */}
      <div className="tab-segment-bar">
        <button
          type="button" className={`tab-trigger ${mode === 'upload' ? 'active' : ''}`}
          onClick={() => { setMode('upload'); stopCamera(); setPreviewUrl(null); setStatus('idle'); setMessage('Select source image file.'); }}
        >
          Upload Source
        </button>
        <button
          type="button" className={`tab-trigger ${mode === 'camera' ? 'active' : ''}`}
          onClick={() => { setMode('camera'); setPreviewUrl(null); setStatus('idle'); setMessage('Initialize real-time camera node.'); }}
        >
          Live Console
        </button>
      </div>

      {/* Unified Screen Frame Geometry */}
      <div className="viewscreen-viewport" style={{ border: `2px solid ${stateBorderColor()}` }}>
        {mode === 'camera' && stream && (
          <video
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
            muted playsInline
          />
        )}

        {mode === 'upload' && previewUrl && (
          <img
            ref={imageRef} src={previewUrl} alt="Matrix Registration Source"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}

        {status === 'scanning' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifycontent: 'center', background: 'rgba(9,13,22,0.6)' }}>
            <div className="processing-spinner" />
          </div>
        )}

        {((mode === 'camera' && (!stream || status === 'loading')) || 
          (mode === 'upload' && !previewUrl)) && (
          <div className="placeholder-state-ui">
            <span>{mode === 'camera' ? 'Camera Node Offline' : 'No Source Detected'}</span>
          </div>
        )}
      </div>

      {/* Perfect Centered Feedback Message Area */}
      <p className="legacy-feedback-msg" style={{ color: stateBorderColor() }}>
        {message}
      </p>

      {/* Symmetric Structural Bottom Controls */}
      <div className="internal-action-row">
        {mode === 'upload' && (
          <>
            <label className="action-button-core" style={{ background: 'var(--input-border, #cbd5e1)', color: 'var(--text-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
              Browse System Directory
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden-file-input" />
            </label>
            
            {previewUrl && status === 'ready' && (
              <button className="action-button-core" style={{ width: '100%', height: '40px', borderRadius: '8px' }} onClick={scanFace}>
                Execute Authentication Vector
              </button>
            )}
          </>
        )}

        {mode === 'camera' && (
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            {status === 'idle' && (
              <button className="action-button-core" style={{ width: '100%', height: '40px', borderRadius: '8px' }} onClick={startCamera}>
                Power On Camera
              </button>
            )}
            {status === 'ready' && (
              <button className="action-button-core" style={{ width: '100%', height: '40px', borderRadius: '8px' }} onClick={scanFace}>
                Scan Structural Bounds
              </button>
            )}
            {(status === 'ready' || status === 'captured' || status === 'error') && (
              <button className="action-button-core" style={{ background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-main)', width: '100%', height: '40px', borderRadius: '8px' }} onClick={stopCamera}>
                Terminate Feed
              </button>
            )}
          </div>
        )}

        {status === 'captured' && (
          <button 
            className="action-button-core" style={{ background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-muted)', width: '100%', height: '40px', borderRadius: '8px' }}
            onClick={() => { 
              setStatus('idle'); 
              setPreviewUrl(null); 
              setMessage(mode === 'camera' ? 'Camera channel reset.' : 'Awaiting alternative file.'); 
            }}
          >
            Clear and Re-initialize
          </button>
        )}
      </div>
    </div>
  );
}
