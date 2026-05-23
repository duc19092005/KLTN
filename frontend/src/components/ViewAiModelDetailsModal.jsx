import { useState, useEffect } from 'react';
import api from '../services/api';

export default function ViewAiModelDetailsModal({ open, onClose, modelId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [model, setModel] = useState(null);

  useEffect(() => {
    if (!open || !modelId) return;

    const fetchDetails = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/ai-model/${modelId}`);
        setModel(res.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Không thể tải thông tin chi tiết mô hình AI');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [open, modelId]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.32)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <div
        className="details-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(600px, calc(100vw - 24px))',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalIn 0.18s ease-out',
          color: 'var(--text-primary)',
        }}
      >
        <style>{`
          .details-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .details-body {
            padding: 24px;
            overflow-y: auto;
            max-height: 70vh;
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .details-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-elevated);
            display: flex;
            justify-content: flex-end;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .info-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .info-item.full-width {
            grid-column: span 2;
          }
          .info-label {
            font-size: var(--text-xs);
            color: var(--text-secondary);
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .info-value {
            font-size: var(--text-sm);
            font-weight: 500;
          }
          .info-value.mono {
            font-family: monospace;
            font-size: 11px;
            background: var(--bg-elevated);
            padding: 4px 6px;
            border-radius: 4px;
            border: 1px solid var(--border);
            word-break: break-all;
          }
          .verification-box {
            border-radius: 8px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .verification-box.success {
            border: 1px solid rgba(16, 185, 129, 0.25);
            background: rgba(16, 185, 129, 0.05);
          }
          .verification-box.danger {
            border: 1px solid rgba(239, 68, 68, 0.25);
            background: rgba(239, 68, 68, 0.05);
          }
          .verification-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: var(--text-sm);
          }
          .verification-badge.success {
            color: #10b981;
          }
          .verification-badge.danger {
            color: var(--danger);
          }
          .loading-spinner {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            gap: 16px;
          }
          .spinner {
            width: 36px;
            height: 36px;
            border: 3px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes modalIn {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="details-header">
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            Chi tiết Mô hình AI
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              Đang tải thông tin & đối chiếu dữ liệu blockchain...
            </span>
          </div>
        ) : error ? (
          <div className="details-body">
            <div style={{ color: 'var(--danger)', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '6px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {error}
            </div>
          </div>
        ) : (
          <div className="details-body">
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Tên Mô hình</span>
                <span className="info-value" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  {model.modelName}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Phiên bản</span>
                <span className="info-value font-mono">{model.modelVersion}</span>
              </div>

              <div className="info-item">
                <span className="info-label">Chuyên khoa khuyến nghị</span>
                <span className="info-value">{model.recommendedSpecialty || 'Chưa cập nhật'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phương thức tích hợp</span>
                <span className="info-value" style={{ textTransform: 'capitalize' }}>
                  {model.type === 'IP' || !model.type ? 'Địa chỉ IP / Host' : `API Key (${model.type})`}
                </span>
              </div>

              <div className="info-item full-width">
                <span className="info-label">Mô tả chi tiết</span>
                <span className="info-value" style={{ opacity: 0.95, lineHeight: 1.4 }}>
                  {model.description || 'Không có mô tả'}
                </span>
              </div>

              <div className="info-item">
                <span className="info-label">Trạng thái Blockchain</span>
                <span className="info-value">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${model.isActiveOnChain ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                    {model.isActiveOnChain ? 'ON-CHAIN (Hoạt động)' : 'PENDING (Chưa đồng bộ)'}
                  </span>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Người khởi tạo (ID)</span>
                <span className="info-value font-mono" style={{ fontSize: '11px' }}>{model.createdBy}</span>
              </div>

              {model.blockchainTxHash && (
                <div className="info-item full-width">
                  <span className="info-label">Transaction Hash</span>
                  <span className="info-value mono">{model.blockchainTxHash}</span>
                </div>
              )}
            </div>

            {/* Blockchain Integrity Verification Box */}
            <div className={`verification-box ${model.integrityVerified ? 'success' : 'danger'}`}>
              <div className={`verification-badge ${model.integrityVerified ? 'success' : 'danger'}`}>
                {model.integrityVerified ? (
                  <>
                    <span>✓</span>
                    <span>Toàn vẹn Dữ liệu được Xác thực</span>
                  </>
                ) : (
                  <>
                    <span>❌</span>
                    <span>Cảnh báo Sai lệch / Chưa xác thực dữ liệu</span>
                  </>
                )}
              </div>
              
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', opacity: 0.8, lineHeight: 1.4 }}>
                {model.integrityVerified ? (
                  'Chữ ký mật mã lưu trữ trên Blockchain hoàn toàn khớp với dữ liệu cấu hình trong Cơ sở dữ liệu. Không phát hiện dấu hiệu giả mạo hoặc thay đổi trái phép.'
                ) : (
                  'Mã băm dữ liệu lưu trên Blockchain không khớp với cấu hình hệ thống hoặc mô hình chưa được đồng bộ hóa thành công trên Blockchain. Vui lòng kiểm tra lại.'
                )}
              </p>

              {model.blockchainHash && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                  <span className="info-label" style={{ fontSize: '9px' }}>Mã băm công khai trên Blockchain</span>
                  <span className="info-value mono" style={{ background: 'rgba(0,0,0,0.15)' }}>{model.blockchainHash}</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="details-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
