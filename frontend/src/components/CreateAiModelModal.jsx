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

const INITIAL_FORM = {
  modelName: '',
  modelVersion: '',
  recommendedSpecialty: '',
  endpoint: '',
  description: '',
};

const PROVIDER_MODELS = {
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'custom'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307', 'custom'],
  gemini: ['gemini-1.5-pro', 'gemini-1.5-flash', 'custom'],
  deepseek: ['deepseek-chat', 'deepseek-coder', 'custom'],
};

const PROVIDER_DEFAULTS = {
  openai: { name: 'OpenAI', color: '#10a37f' },
  anthropic: { name: 'Anthropic', color: '#cc785c' },
  gemini: { name: 'Google Gemini', color: '#1a73e8' },
  deepseek: { name: 'DeepSeek', color: '#0066fe' },
};

export default function CreateAiModelModal({ open, onClose, onSuccess }) {
  const { isMock } = useWallet();
  const [form, setForm] = useState(INITIAL_FORM);
  const [method, setMethod] = useState('IP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // Face verify states
  const [faceStep, setFaceStep] = useState('form'); // 'form' | 'face' | 'loading' | 'success'
  const [statusText, setStatusText] = useState('');
  const [faceError, setFaceError] = useState('');
  const [pendingEndpoint, setPendingEndpoint] = useState('');

  // API Key test states
  const [testedSuccess, setTestedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  // API config state
  const [activeProvider, setActiveProvider] = useState('openai');
  const [providerConfig, setProviderConfig] = useState({
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', customModel: '' },
    anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', customModel: '' },
    gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', customModel: '' },
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', customModel: '' },
  });
  const [showApiKey, setShowApiKey] = useState(false);

  if (!open) return null;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleConfigChange = (provider, field, value) => {
    setProviderConfig((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
    setError('');
    setTestedSuccess(false);
    setTestMessage('');
  };

  const resetAndClose = () => {
    setForm(INITIAL_FORM);
    setMethod('IP');
    setError('');
    setResult(null);
    setFaceStep('form');
    setStatusText('');
    setFaceError('');
    setPendingEndpoint('');
    setTestedSuccess(false);
    setTestingConnection(false);
    setTestMessage('');
    setActiveProvider('openai');
    setProviderConfig({
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', customModel: '' },
      anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', customModel: '' },
      gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', customModel: '' },
      deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', customModel: '' },
    });
    setShowApiKey(false);
    onClose();
  };

  const handleTestConnection = async () => {
    setError('');
    setTestMessage('');
    setTestedSuccess(false);

    const currentConfig = providerConfig[activeProvider];
    if (!currentConfig.apiKey.trim()) {
      setError(`Vui lòng nhập API Key cho ${PROVIDER_DEFAULTS[activeProvider].name}`);
      return;
    }

    setTestingConnection(true);
    try {
      const res = await api.post('/ai-model/test-provider', {
        provider: activeProvider,
        apiKey: currentConfig.apiKey.trim(),
        baseUrl: currentConfig.baseUrl.trim() || undefined,
      });

      if (res.data.success) {
        setTestedSuccess(true);
        setTestMessage(res.data.message);
      } else {
        setTestedSuccess(false);
        setTestMessage(res.data.message || 'Kết nối thất bại');
      }
    } catch (err) {
      console.error(err);
      setTestedSuccess(false);
      const msg = err?.response?.data?.message;
      setTestMessage(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể kết nối đến máy chủ backend để kiểm tra'));
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.modelName.trim()) {
      setError('Vui lòng điền trường: Tên Model');
      return;
    }
    if (!form.modelVersion.trim()) {
      setError('Vui lòng điền trường: Phiên bản');
      return;
    }

    let endpointValue = '';
    if (method === 'IP') {
      if (!form.endpoint.trim()) {
        setError('Vui lòng điền trường: Địa chỉ IP / host');
        return;
      }
      endpointValue = form.endpoint.trim();
    } else {
      // API method
      const currentConfig = providerConfig[activeProvider];
      if (!currentConfig.apiKey.trim()) {
        setError(`Vui lòng nhập API Key cho ${PROVIDER_DEFAULTS[activeProvider].name}`);
        return;
      }
      const selectedModel = currentConfig.model === 'custom' ? currentConfig.customModel.trim() : currentConfig.model;
      if (!selectedModel) {
        setError('Vui lòng chọn hoặc nhập tên Model');
        return;
      }

      endpointValue = JSON.stringify({
        provider: activeProvider,
        baseUrl: currentConfig.baseUrl.trim(),
        model: selectedModel,
        apiKey: currentConfig.apiKey.trim(),
      });
    }

    setPendingEndpoint(endpointValue);
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

      // 2. Register in DB
      setStatusText('Đang lưu thông tin Model vào cơ sở dữ liệu...');
      const regRes = await api.post('/ai-model/register', {
        modelName: form.modelName.trim(),
        modelVersion: form.modelVersion.trim(),
        recommendedSpecialty: form.recommendedSpecialty.trim() || undefined,
        ipHash: pendingEndpoint,
        description: form.description?.trim()
          ? `[${method}] ${form.description.trim()}`
          : `[${method}]`,
        type: method === 'API' ? activeProvider : 'IP',
      });

      const registeredModel = regRes.data;

      // 3. Register on blockchain
      let txHash = '';
      if (isMock) {
        setStatusText('Đang đúc NFT và ghi nhận lên blockchain...');
        const blockRes = await api.post(`/ai-model/blockchain/register/${registeredModel.modelId}`);
        txHash = blockRes.data.txHash;
      } else {
        if (!window.ethereum) {
          throw new Error('Không tìm thấy MetaMask. Vui lòng cài đặt và kết nối ví.');
        }
        
        setStatusText('Đang lấy địa chỉ Smart Contract...');
        const configRes = await api.get('/ai-model/config');
        const contractAddress = configRes.data.aiModelRegistryAddress;
        if (!contractAddress) {
          throw new Error('Chưa cấu hình địa chỉ Smart Contract AI Model Registry.');
        }

        setStatusText('Đang lấy mã băm IP để ghi nhận blockchain...');
        const hashRes = await api.get(`/ai-model/${registeredModel.modelId}/blockchain-hash`);
        const ipHashForBlockchain = hashRes.data.ipHashForBlockchain;

        setStatusText('Vui lòng ký và xác nhận giao dịch trên ví MetaMask...');
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const walletSigner = await browserProvider.getSigner();
        const aiModelContract = new ethers.Contract(contractAddress, AI_MODEL_ABI, walletSigner);

        const tx = await aiModelContract.registerModel(registeredModel.modelId, ipHashForBlockchain);
        setStatusText('Đang chờ giao dịch xác nhận trên blockchain...');
        const receipt = await tx.wait();
        txHash = receipt.hash || tx.hash;

        setStatusText('Đang cập nhật trạng thái giao dịch lên hệ thống...');
        await api.post(`/ai-model/${registeredModel.modelId}/blockchain-status`, {
          txHash,
        });
      }

      setResult({
        ...registeredModel,
        txHash,
      });

      setFaceStep('success');
      await onSuccess?.();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Xử lý thất bại. Vui lòng kiểm tra lại.'));
      setFaceStep('form');
    }
  };

  return (
    <Backdrop onClick={resetAndClose}>
      <div className="ai-model-modal" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .ai-model-modal {
            width: min(820px, calc(100vw - 24px));
            max-height: calc(100vh - 32px);
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            box-shadow: var(--shadow-xl);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: aiModalIn 0.18s ease-out;
          }
          .ai-model-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
          }
          .ai-model-body {
            padding: 22px 24px;
            overflow-y: auto;
            display: grid;
            gap: 16px;
          }
          .ai-model-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .ai-model-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-elevated);
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .ai-model-field {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .ai-model-field label {
            color: var(--text-secondary);
            font-size: var(--text-xs);
            font-weight: 700;
            text-transform: uppercase;
          }
          .ai-model-field input,
          .ai-model-field textarea {
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
          .ai-model-field textarea {
            min-height: 82px;
            resize: vertical;
          }
          .ai-model-field input:focus,
          .ai-model-field textarea:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.15);
          }
          .ai-model-segment {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            padding: 4px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 8px;
          }
          .ai-model-segment button {
            height: 34px;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: var(--text-secondary);
            font-weight: 700;
            cursor: pointer;
          }
          .ai-model-segment button.active {
            background: var(--bg-surface);
            color: var(--primary);
            box-shadow: var(--shadow-sm);
          }
          .ai-model-alert {
            border: 1px solid rgba(239, 68, 68, 0.25);
            background: rgba(239, 68, 68, 0.08);
            color: var(--danger);
            border-radius: 6px;
            padding: 10px 12px;
            font-size: var(--text-sm);
            font-weight: 600;
          }
          .ai-model-result {
            border: 1px solid rgba(16, 185, 129, 0.24);
            background: rgba(16, 185, 129, 0.08);
            border-radius: 8px;
            padding: 12px;
            display: grid;
            gap: 8px;
          }
          .ai-model-result-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            font-size: var(--text-sm);
          }
          .ai-model-result-row strong {
            color: var(--text-secondary);
            font-weight: 600;
          }
          .ai-model-result-row span {
            text-align: right;
            word-break: break-all;
          }

          /* API Configuration Section Styles (Cursor style) */
          .api-config-section {
            display: grid;
            gap: 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            background: rgba(0, 0, 0, 0.015);
          }
          html[data-theme="dark"] .api-config-section {
            background: rgba(255, 255, 255, 0.01);
          }
          .section-label {
            font-size: var(--text-xs);
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .api-providers-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
            gap: 10px;
          }
          .provider-card {
            border: 1px solid var(--border);
            background: var(--bg-surface);
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .provider-card:hover {
            border-color: var(--active-color);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
          }
          .provider-card.active {
            border-color: var(--active-color);
            background: rgba(77, 163, 255, 0.04);
            box-shadow: 0 0 0 1px var(--active-color);
          }
          html[data-theme="dark"] .provider-card.active {
            background: rgba(77, 163, 255, 0.08);
          }
          .provider-card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .provider-name {
            font-weight: 600;
            font-size: var(--text-sm);
            color: var(--text-primary);
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--text-muted);
            transition: all 0.2s;
          }
          .status-dot.configured {
            background: var(--success);
            box-shadow: 0 0 8px var(--success);
          }
          .provider-card-sub {
            font-size: var(--text-xs);
            color: var(--text-muted);
          }
          .provider-details-panel {
            border-top: 1px dashed var(--border);
            padding-top: 14px;
            margin-top: 6px;
            display: grid;
            gap: 14px;
          }
          .provider-panel-title {
            font-weight: 600;
            font-size: var(--text-sm);
            color: var(--text-primary);
          }
          .api-field-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
          }
          .api-key-input-container {
            display: flex;
            position: relative;
            align-items: center;
          }
          .api-key-input-container input {
            padding-right: 50px !important;
          }
          .api-key-toggle-btn {
            position: absolute;
            right: 8px;
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text-secondary);
            border-radius: 4px;
            font-size: var(--text-xs);
            font-weight: 600;
            padding: 4px 8px;
            cursor: pointer;
            transition: all 0.15s ease;
            user-select: none;
          }
          .api-key-toggle-btn:hover {
            color: var(--text-primary);
            border-color: var(--border-hover);
          }
          .api-model-select {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg-surface);
            color: var(--text-primary);
            font: inherit;
            font-size: var(--text-sm);
            outline: none;
            padding: 10px 12px;
            cursor: pointer;
          }
          .api-model-select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.15);
          }

          @keyframes aiModalIn {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @media (max-width: 680px) {
            .ai-model-grid { grid-template-columns: 1fr; }
            .api-field-group { grid-template-columns: 1fr; }
            .ai-model-header, .ai-model-body, .ai-model-footer { padding-left: 16px; padding-right: 16px; }
            .ai-model-footer { flex-direction: column-reverse; }
            .ai-model-footer .btn { width: 100%; }
          }
        `}</style>

        <div className="ai-model-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              {faceStep === 'form' ? 'Thêm Model AI' : faceStep === 'face' ? 'Xác minh Sinh trắc học' : faceStep === 'loading' ? 'Đang xử lý...' : 'Thành công'}
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {faceStep === 'form' ? 'Khai báo thông tin triển khai model' : faceStep === 'face' ? 'Quét khuôn mặt để xác thực quyền quản trị' : faceStep === 'loading' ? 'Vui lòng chờ trong giây lát...' : 'Ghi nhận thành công'}
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetAndClose} disabled={faceStep === 'loading'}>
            Đóng
          </button>
        </div>

        {faceStep === 'form' && (
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <div className="ai-model-body">
              <div className="ai-model-grid">
                <Field label="Tên Model *" name="modelName" value={form.modelName} onChange={handleChange} placeholder="ResNet50 X-Ray Classifier" />
                <Field label="Phiên bản *" name="modelVersion" value={form.modelVersion} onChange={handleChange} placeholder="1.0.0" />
              </div>

              <Field
                label="Chuyên khoa đề xuất"
                name="recommendedSpecialty"
                value={form.recommendedSpecialty}
                onChange={handleChange}
                placeholder="Chẩn đoán hình ảnh, Tim mạch, Da liễu..."
              />

              <div className="ai-model-field">
                <label>Phương thức thêm *</label>
                <div className="ai-model-segment">
                  {['IP', 'API'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={method === item ? 'active' : ''}
                      onClick={() => setMethod(item)}
                    >
                      {item === 'IP' ? 'Địa chỉ IP' : 'API endpoint'}
                    </button>
                  ))}
                </div>
              </div>

              {method === 'IP' ? (
                <Field
                  label="Địa chỉ IP / host *"
                  name="endpoint"
                  value={form.endpoint}
                  onChange={handleChange}
                  placeholder="192.168.1.100:8080/model"
                />
              ) : (
                <div className="api-config-section">
                  <span className="section-label">Cursor-Style API Providers</span>
                  
                  <div className="api-providers-grid">
                    {Object.entries(PROVIDER_DEFAULTS).map(([key, data]) => {
                      const isActive = activeProvider === key;
                      const isConfigured = !!providerConfig[key].apiKey;
                      return (
                        <div
                          key={key}
                          className={`provider-card ${isActive ? 'active' : ''}`}
                          onClick={() => setActiveProvider(key)}
                          style={{
                            '--active-color': data.color,
                          }}
                        >
                          <div className="provider-card-header">
                            <span className="provider-name">{data.name}</span>
                            <span className={`status-dot ${isConfigured ? 'configured' : ''}`} />
                          </div>
                          <div className="provider-card-sub">
                            {isConfigured ? 'Đã cấu hình' : 'Chưa thiết lập'}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="provider-details-panel">
                    <div className="provider-panel-title">
                      Cấu hình tích hợp {PROVIDER_DEFAULTS[activeProvider].name}
                    </div>
                    
                    <div className="api-field-group">
                      <div className="ai-model-field">
                        <label>API Key *</label>
                        <div className="api-key-input-container">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={providerConfig[activeProvider].apiKey}
                            onChange={(e) => handleConfigChange(activeProvider, 'apiKey', e.target.value)}
                            placeholder={`Nhập API Key của ${PROVIDER_DEFAULTS[activeProvider].name}`}
                          />
                          <button
                            type="button"
                            className="api-key-toggle-btn"
                            onClick={() => setShowApiKey(!showApiKey)}
                          >
                            {showApiKey ? 'Ẩn' : 'Hiện'}
                          </button>
                        </div>
                      </div>

                      <div className="ai-model-field">
                        <label>Base URL (Tùy chọn)</label>
                        <input
                          type="text"
                          value={providerConfig[activeProvider].baseUrl}
                          onChange={(e) => handleConfigChange(activeProvider, 'baseUrl', e.target.value)}
                          placeholder="Mặc định của nhà cung cấp"
                        />
                      </div>
                    </div>

                    <div className="api-field-group">
                      <div className="ai-model-field">
                        <label>Model *</label>
                        <select
                          value={providerConfig[activeProvider].model}
                          onChange={(e) => handleConfigChange(activeProvider, 'model', e.target.value)}
                          className="api-model-select"
                        >
                          {PROVIDER_MODELS[activeProvider].map((m) => (
                            <option key={m} value={m}>
                              {m === 'custom' ? 'Tùy chỉnh (Nhập tay)...' : m}
                            </option>
                          ))}
                        </select>
                      </div>

                      {providerConfig[activeProvider].model === 'custom' && (
                        <div className="ai-model-field">
                          <label>Tên Model Tùy chỉnh *</label>
                          <input
                            type="text"
                            value={providerConfig[activeProvider].customModel}
                            onChange={(e) => handleConfigChange(activeProvider, 'customModel', e.target.value)}
                            placeholder="Nhập tên Model tùy chọn"
                          />
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        style={{
                          borderColor: testedSuccess ? '#10b981' : 'var(--border)',
                          color: testedSuccess ? '#10b981' : 'var(--text-primary)',
                        }}
                      >
                        {testingConnection ? 'Đang kiểm tra...' : testedSuccess ? '✓ Kết nối OK' : 'Kiểm tra Kết nối'}
                      </button>
                      {testMessage && (
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: testedSuccess ? '#10b981' : 'var(--danger)'
                        }}>
                          {testMessage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="ai-model-field">
                <label>Mô tả</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Ghi chú về nhiệm vụ, dữ liệu huấn luyện hoặc môi trường triển khai"
                />
              </div>

              {error && <div className="ai-model-alert">{error}</div>}
            </div>

            <div className="ai-model-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
              {method === 'API' && !testedSuccess && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  * Vui lòng kiểm tra kết nối API Key thành công trước khi thêm
                </span>
              )}
              <button type="button" className="btn btn-secondary" onClick={resetAndClose} disabled={loading}>
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || (method === 'API' && !testedSuccess)}
              >
                Thêm Model AI
              </button>
            </div>
          </form>
        )}

        {faceStep === 'face' && (
          <div className="ai-model-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '16px' }}>
            <FaceCapture
              requireLiveness={true}
              onCapture={handleFaceCaptured}
              onError={(msg) => setFaceError(msg)}
            />
            {faceError && <div className="ai-model-alert" style={{ width: '100%' }}>{faceError}</div>}
            <button type="button" className="btn btn-secondary" onClick={() => setFaceStep('form')} style={{ marginTop: '12px' }}>
              Quay lại
            </button>
          </div>
        )}

        {faceStep === 'loading' && (
          <div className="ai-model-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '20px' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600 }}>{statusText}</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Vui lòng giữ nguyên cửa sổ, không tắt trình duyệt</p>
          </div>
        )}

        {faceStep === 'success' && (
          <div className="ai-model-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '16px' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10b981', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>✓</div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 600, color: '#10b981' }}>Đăng ký Model AI Thành công!</h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
              Model đã được lưu vào CSDL và ghi nhận trên hợp đồng thông minh blockchain.
            </p>
            {result && (
              <div className="ai-model-result" style={{ width: '100%', maxWidth: '500px' }}>
                <ResultRow label="Model ID" value={result.modelId} />
                <ResultRow label="Tên Model" value={form.modelName} />
                <ResultRow label="SHA-256 IP Hash" value={formatHash(result.ipHashForBlockchain || result.ipHashPlain)} mono />
                <ResultRow label="Transaction Hash" value={formatHash(result.txHash)} mono />
              </div>
            )}
            <button type="button" className="btn btn-primary" style={{ marginTop: '16px', width: '100%', maxWidth: '200px' }} onClick={resetAndClose}>
              Hoàn tất
            </button>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function Field({ label, name, value, onChange, placeholder }) {
  return (
    <div className="ai-model-field">
      <label>{label}</label>
      <input name={name} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function ResultRow({ label, value, mono = false }) {
  return (
    <div className="ai-model-result-row">
      <strong>{label}</strong>
      <span className={mono ? 'mono' : ''}>{value || 'Chưa cập nhật'}</span>
    </div>
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

function fieldLabel(key) {
  const map = {
    modelName: 'Tên Model',
    modelVersion: 'Phiên bản',
    recommendedSpecialty: 'Chuyên khoa đề xuất',
    endpoint: 'Endpoint',
  };
  return map[key] || key;
}

function formatHash(hash) {
  if (!hash) return 'Chưa cập nhật';
  if (hash.length <= 24) return hash;
  return `${hash.substring(0, 12)}...${hash.substring(hash.length - 10)}`;
}
