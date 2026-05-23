import { useState } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import api from '../services/api';
import FaceCapture from './FaceCapture';

const AI_MODEL_ABI = [
  'function registerModel(string memory _modelId, string memory _modelHash) external',
  'function addModelHash(string memory _modelId, string memory _modelHash) external',
  'function deactivateModelHash(string memory _modelId, string memory _modelHash) external'
];

export default function ManageAiModelModal({ open, onClose, onSuccess, model, action }) {
  const { isMock } = useWallet();
  const [newIp, setNewIp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [faceStep, setFaceStep] = useState('form'); // 'form' | 'face' | 'loading' | 'success'
  const [statusText, setStatusText] = useState('');
  const [faceError, setFaceError] = useState('');
  const [txHash, setTxHash] = useState('');

  if (!open || !model) return null;

  const resetAndClose = () => {
    setNewIp('');
    setError('');
    setLoading(false);
    setFaceStep('form');
    setStatusText('');
    setFaceError('');
    setTxHash('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (action === 'edit' && !newIp.trim()) {
      setError('Vui lòng nhập địa chỉ IP/host mới');
      return;
    }

    setFaceStep('face');
  };

  const handleFaceCaptured = async (embedding) => {
    setFaceStep('loading');
    setStatusText('Đang xác minh khuôn mặt sinh trắc học...');
    setFaceError('');

    try {
      // 1. Verify face
      const faceRes = await api.post('/face/verify', { embedding });
      if (!faceRes.data?.match) {
        setFaceError('Khuôn mặt không khớp. Vui lòng quét lại.');
        setFaceStep('face');
        return;
      }

      let hash = '';

      if (action === 'edit') {
        // 2. Edit model - add new IP hash
        if (isMock) {
          setStatusText('Đang ghi nhận IP mới lên blockchain...');
          const res = await api.post(`/ai-model/blockchain/add-hash/${model.modelId}`, {
            ipHash: newIp.trim(),
          });
          hash = res.data.txHash;
        } else {
          if (!window.ethereum) {
            throw new Error('Không tìm thấy MetaMask. Vui lòng cài đặt và kết nối ví.');
          }

          // A. Update in DB first
          setStatusText('Đang cập nhật địa chỉ IP mới trong cơ sở dữ liệu...');
          await api.post('/ai-model/add-hash', {
            modelId: model.modelId,
            ipHash: newIp.trim(),
          });

          // B. Get contract address
          setStatusText('Đang lấy địa chỉ Smart Contract...');
          const configRes = await api.get('/ai-model/config');
          const contractAddress = configRes.data.aiModelRegistryAddress;
          if (!contractAddress) {
            throw new Error('Chưa cấu hình địa chỉ Smart Contract AI Model Registry.');
          }

          // C. Get decrypted SHA-256 hash
          setStatusText('Đang lấy mã băm IP để ghi nhận blockchain...');
          const hashRes = await api.get(`/ai-model/${model.modelId}/blockchain-hash`);
          const ipHashForBlockchain = hashRes.data.ipHashForBlockchain;

          // D. Sign and send tx
          setStatusText('Vui lòng ký và xác nhận giao dịch trên ví MetaMask...');
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          const walletSigner = await browserProvider.getSigner();
          const aiModelContract = new ethers.Contract(contractAddress, AI_MODEL_ABI, walletSigner);

          const tx = await aiModelContract.addModelHash(model.modelId, ipHashForBlockchain);
          setStatusText('Đang chờ giao dịch xác nhận trên blockchain...');
          const receipt = await tx.wait();
          hash = receipt.hash || tx.hash;

          // E. Sync status
          setStatusText('Đang cập nhật trạng thái giao dịch lên hệ thống...');
          await api.post(`/ai-model/${model.modelId}/blockchain-status`, {
            txHash: hash,
            isActiveOnChain: true,
          });
        }
      } else {
        // 3. Deactivate model
        if (isMock) {
          setStatusText('Đang vô hiệu hóa model trên blockchain...');
          const res = await api.post(`/ai-model/blockchain/deactivate-hash/${model.modelId}`);
          hash = res.data.txHash;
        } else {
          if (!window.ethereum) {
            throw new Error('Không tìm thấy MetaMask. Vui lòng cài đặt và kết nối ví.');
          }

          // A. Get contract address
          setStatusText('Đang lấy địa chỉ Smart Contract...');
          const configRes = await api.get('/ai-model/config');
          const contractAddress = configRes.data.aiModelRegistryAddress;
          if (!contractAddress) {
            throw new Error('Chưa cấu hình địa chỉ Smart Contract AI Model Registry.');
          }

          // B. Get SHA-256 hash
          setStatusText('Đang lấy mã băm IP để ghi nhận blockchain...');
          const hashRes = await api.get(`/ai-model/${model.modelId}/blockchain-hash`);
          const ipHashForBlockchain = hashRes.data.ipHashForBlockchain;

          // C. Sign and send tx
          setStatusText('Vui lòng ký và xác nhận giao dịch trên ví MetaMask...');
          const browserProvider = new ethers.BrowserProvider(window.ethereum);
          const walletSigner = await browserProvider.getSigner();
          const aiModelContract = new ethers.Contract(contractAddress, AI_MODEL_ABI, walletSigner);

          const tx = await aiModelContract.deactivateModelHash(model.modelId, ipHashForBlockchain);
          setStatusText('Đang chờ giao dịch xác nhận trên blockchain...');
          const receipt = await tx.wait();
          hash = receipt.hash || tx.hash;

          // D. Sync status
          setStatusText('Đang cập nhật trạng thái giao dịch lên hệ thống...');
          await api.post(`/ai-model/${model.modelId}/blockchain-status`, {
            txHash: hash,
            isActiveOnChain: false,
          });
        }
      }

      setTxHash(hash);
      setFaceStep('success');
      await onSuccess?.();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Thao tác thất bại. Vui lòng thử lại.'));
      setFaceStep('form');
    }
  };

  return (
    <Backdrop onClick={resetAndClose}>
      <div className="manage-model-modal" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .manage-model-modal {
            width: min(520px, calc(100vw - 24px));
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            box-shadow: var(--shadow-xl);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: modalIn 0.18s ease-out;
            color: var(--text-primary);
          }
          .modal-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .modal-body {
            padding: 22px 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .modal-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-elevated);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .field label {
            color: var(--text-secondary);
            font-size: var(--text-xs);
            font-weight: 700;
            text-transform: uppercase;
          }
          .field input {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg-surface);
            color: var(--text-primary);
            font: inherit;
            font-size: var(--text-sm);
            outline: none;
            padding: 10px 12px;
          }
          .field input:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.15);
          }
          .alert {
            border: 1px solid rgba(239, 68, 68, 0.25);
            background: rgba(239, 68, 68, 0.08);
            color: var(--danger);
            border-radius: 6px;
            padding: 10px 12px;
            font-size: var(--text-sm);
            font-weight: 600;
          }
          .warning-box {
            border: 1px solid rgba(245, 158, 11, 0.3);
            background: rgba(245, 158, 11, 0.08);
            color: #f59e0b;
            border-radius: 8px;
            padding: 14px;
            font-size: var(--text-sm);
            line-height: 1.5;
          }
          .result-box {
            border: 1px solid rgba(16, 185, 129, 0.24);
            background: rgba(16, 185, 129, 0.08);
            border-radius: 8px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            font-size: var(--text-sm);
          }
          .result-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }
          @keyframes modalIn {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
              {action === 'edit' ? 'Cập nhật IP Model' : 'Vô hiệu hóa Model'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Model: {model.name || model.modelName} ({model.modelId})
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetAndClose} disabled={faceStep === 'loading'}>
            Đóng
          </button>
        </div>

        {faceStep === 'form' && (
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <div className="modal-body">
              {action === 'edit' ? (
                <div className="field">
                  <label>Địa chỉ IP / host mới *</label>
                  <input
                    type="text"
                    value={newIp}
                    onChange={(e) => {
                      setNewIp(e.target.value);
                      setError('');
                    }}
                    placeholder="Ví dụ: 192.168.1.150:8080/model"
                    required
                  />
                </div>
              ) : (
                <div className="warning-box">
                  ⚠️ <strong>Cảnh báo:</strong> Việc vô hiệu hóa model sẽ đánh dấu trạng thái không hoạt động của model trên Blockchain. Thao tác này yêu cầu xác thực bằng khuôn mặt sinh trắc học của quản trị viên.
                </div>
              )}
              {error && <div className="alert">{error}</div>}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={resetAndClose}>
                Hủy
              </button>
              <button type="submit" className={`btn ${action === 'edit' ? 'btn-primary' : 'btn-danger'}`}>
                {action === 'edit' ? 'Cập nhật' : 'Vô hiệu hóa'}
              </button>
            </div>
          </form>
        )}

        {faceStep === 'face' && (
          <div className="modal-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <FaceCapture
              requireLiveness={true}
              onCapture={handleFaceCaptured}
              onError={(msg) => setFaceError(msg)}
            />
            {faceError && <div className="alert" style={{ width: '100%' }}>{faceError}</div>}
            <button type="button" className="btn btn-secondary" onClick={() => setFaceStep('form')} style={{ marginTop: '12px' }}>
              Quay lại
            </button>
          </div>
        )}

        {faceStep === 'loading' && (
          <div className="modal-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '20px' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600 }}>{statusText}</h3>
          </div>
        )}

        {faceStep === 'success' && (
          <div className="modal-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
            <div style={{ width: '56px', height: '56px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10b981', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>✓</div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: '#10b981' }}>
              Thực hiện thành công!
            </h3>
            {txHash && (
              <div className="result-box" style={{ width: '100%' }}>
                <div className="result-row">
                  <strong>Trạng thái:</strong>
                  <span>{action === 'edit' ? 'Đã cập nhật IP' : 'Đã vô hiệu hóa'}</span>
                </div>
                <div className="result-row">
                  <strong>Tx Hash:</strong>
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', opacity: 0.8 }}>
                    {txHash.substring(0, 16)}...{txHash.substring(txHash.length - 12)}
                  </span>
                </div>
              </div>
            )}
            <button type="button" className="btn btn-primary" style={{ marginTop: '16px', width: '100%', maxWidth: '160px' }} onClick={resetAndClose}>
              Hoàn tất
            </button>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClick }) {
  return (
    <div
      onClick={onClick}
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
      {children}
    </div>
  );
}
