import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from '../contexts/WalletContext';
import api from '../services/api';
import FaceCapture from './FaceCapture';

const AI_MODEL_ABI = [
  'function registerModel(string memory _modelId, string memory _modelHash) external',
  'function addModelHash(string memory _modelId, string memory _modelHash) external',
  'function deactivateModelHash(string memory _modelId, string memory _modelHash) external'
];

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

export default function EditAiModelModal({ open, onClose, onSuccess, modelId }) {
  const { isMock } = useWallet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [originalModel, setOriginalModel] = useState(null);
  const [originalPlainHash, setOriginalPlainHash] = useState('');

  // Form states
  const [form, setForm] = useState({
    modelName: '',
    modelVersion: '',
    recommendedSpecialty: '',
    endpoint: '',
    description: '',
  });

  const [method, setMethod] = useState('IP'); // 'IP' | 'API'
  const [activeProvider, setActiveProvider] = useState('openai');
  const [providerConfig, setProviderConfig] = useState({
    openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', customModel: '' },
    anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', customModel: '' },
    gemini: { apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-1.5-flash', customModel: '' },
    deepseek: { apiKey: '', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', customModel: '' },
  });
  const [showApiKey, setShowApiKey] = useState(false);

  // Connection testing states
  const [testedSuccess, setTestedSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  // Face verify states
  const [faceStep, setFaceStep] = useState('form'); // 'form' | 'face' | 'loading' | 'success'
  const [statusText, setStatusText] = useState('');
  const [faceError, setFaceError] = useState('');
  const [pendingEndpoint, setPendingEndpoint] = useState('');
  const [txHash, setTxHash] = useState('');

  useEffect(() => {
    if (!open || !modelId) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [modelRes, plainRes] = await Promise.all([
          api.get(`/ai-model/${modelId}`),
          api.get(`/ai-model/${modelId}/plain-hash`),
        ]);

        const modelData = modelRes.data;
        const plainHash = plainRes.data.plainHash || '';

        setOriginalModel(modelData);
        setOriginalPlainHash(plainHash);

        // Pre-fill model details
        setForm({
          modelName: modelData.modelName || '',
          modelVersion: modelData.modelVersion || '',
          recommendedSpecialty: modelData.recommendedSpecialty || '',
          endpoint: '',
          description: modelData.description || '',
        });

        // Parse plainHash to detect integration type
        try {
          const parsed = JSON.parse(plainHash);
          if (parsed && parsed.provider) {
            setMethod('API');
            setActiveProvider(parsed.provider);
            setProviderConfig((prev) => {
              const defaultModels = PROVIDER_MODELS[parsed.provider] || [];
              const isStandardModel = defaultModels.includes(parsed.model) && parsed.model !== 'custom';
              return {
                ...prev,
                [parsed.provider]: {
                  apiKey: parsed.apiKey || '',
                  baseUrl: parsed.baseUrl || '',
                  model: isStandardModel ? parsed.model : 'custom',
                  customModel: isStandardModel ? '' : parsed.model,
                },
              };
            });
            // Initially mark API key as tested since it works
            setTestedSuccess(true);
            setTestMessage('Cấu hình hiện tại đã được nạp');
          } else {
            setMethod('IP');
            setForm((prev) => ({ ...prev, endpoint: plainHash }));
          }
        } catch {
          // If not JSON, it is a plain IP
          setMethod('IP');
          setForm((prev) => ({ ...prev, endpoint: plainHash }));
        }
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Không thể tải dữ liệu mô hình AI');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, modelId]);

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
      setTestMessage(Array.isArray(msg) ? msg.join(', ') : (msg || 'Không thể kiểm tra kết nối API'));
    } finally {
      setTestingConnection(false);
    }
  };

  const resetAndClose = () => {
    setForm({
      modelName: '',
      modelVersion: '',
      recommendedSpecialty: '',
      endpoint: '',
      description: '',
    });
    setMethod('IP');
    setError('');
    setFaceStep('form');
    setStatusText('');
    setFaceError('');
    setPendingEndpoint('');
    setTestedSuccess(false);
    setTestingConnection(false);
    setTestMessage('');
    setActiveProvider('openai');
    setShowApiKey(false);
    setTxHash('');
    onClose();
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

    // Determine current endpoint value
    let currentEndpointVal = '';
    if (method === 'IP') {
      if (!form.endpoint.trim()) {
        setError('Vui lòng điền trường: Địa chỉ IP / host');
        return;
      }
      currentEndpointVal = form.endpoint.trim();
    } else {
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

      currentEndpointVal = JSON.stringify({
        provider: activeProvider,
        baseUrl: currentConfig.baseUrl.trim(),
        model: selectedModel,
        apiKey: currentConfig.apiKey.trim(),
      });
    }

    // Compare with original plain hash to check if credentials/IP changed
    const credentialsChanged = currentEndpointVal !== originalPlainHash;

    if (!credentialsChanged) {
      // Simple metadata edit: no face scan, no MetaMask!
      setFaceStep('loading');
      setStatusText('Đang lưu thông tin cập nhật...');
      try {
        await api.post(`/ai-model/update/${modelId}`, {
          modelName: form.modelName.trim(),
          modelVersion: form.modelVersion.trim(),
          recommendedSpecialty: form.recommendedSpecialty.trim() || undefined,
          description: form.description?.trim(),
        });
        setFaceStep('success');
        await onSuccess?.();
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Không thể cập nhật thông tin');
        setFaceStep('form');
      }
    } else {
      // IP/Credentials changed: Requires Face Verify & Blockchain Transaction signing!
      setPendingEndpoint(currentEndpointVal);
      setFaceStep('face');
    }
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

      // 2. Update model registry on DB
      setStatusText('Đang cập nhật cơ sở dữ liệu hệ thống...');
      await api.post(`/ai-model/update/${modelId}`, {
        modelName: form.modelName.trim(),
        modelVersion: form.modelVersion.trim(),
        recommendedSpecialty: form.recommendedSpecialty.trim() || undefined,
        description: form.description?.trim(),
        ipHash: pendingEndpoint,
        type: method === 'API' ? activeProvider : 'IP',
      });

      // 3. Register updated hash on blockchain
      let txHashVal = '';
      if (isMock) {
        setStatusText('Đang đồng bộ địa chỉ mới lên blockchain...');
        const blockRes = await api.post(`/ai-model/blockchain/add-hash/${modelId}`, {
          ipHash: pendingEndpoint,
        });
        txHashVal = blockRes.data.txHash;
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
        const hashRes = await api.get(`/ai-model/${modelId}/blockchain-hash`);
        const ipHashForBlockchain = hashRes.data.ipHashForBlockchain;

        setStatusText('Vui lòng ký và xác nhận giao dịch trên ví MetaMask...');
        const browserProvider = new ethers.BrowserProvider(window.ethereum);
        const walletSigner = await browserProvider.getSigner();
        const aiModelContract = new ethers.Contract(contractAddress, AI_MODEL_ABI, walletSigner);

        const tx = await aiModelContract.addModelHash(modelId, ipHashForBlockchain);
        setStatusText('Đang chờ giao dịch xác nhận trên blockchain...');
        const receipt = await tx.wait();
        txHashVal = receipt.hash || tx.hash;

        setStatusText('Đang cập nhật trạng thái giao dịch lên hệ thống...');
        await api.post(`/ai-model/${modelId}/blockchain-status`, {
          txHash: txHashVal,
          isActiveOnChain: true,
        });
      }

      setTxHash(txHashVal);
      setFaceStep('success');
      await onSuccess?.();
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || err.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Xử lý thất bại. Vui lòng kiểm tra lại.'));
      setFaceStep('form');
    }
  };

  return (
    <div
      onClick={resetAndClose}
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
        className="ai-model-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, calc(100vw - 24px))',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'modalIn 0.18s ease-out',
          color: 'var(--text-primary)',
          maxHeight: '90vh',
        }}
      >
        <style>{`
          .ai-model-header {
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .ai-model-body {
            padding: 24px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .ai-model-footer {
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--bg-elevated);
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
            letter-spacing: 0.05em;
          }
          .ai-model-field input, .ai-model-field textarea, .ai-model-field select {
            width: 100%;
            border: 1px solid var(--border);
            border-radius: 6px;
            background: var(--bg-surface);
            color: var(--text-primary);
            font: inherit;
            font-size: var(--text-sm);
            outline: none;
            padding: 10px 12px;
            box-sizing: border-box;
          }
          .ai-model-field input:focus, .ai-model-field textarea:focus, .ai-model-field select:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(77, 163, 255, 0.15);
          }
          .ai-model-field textarea {
            min-height: 80px;
            resize: vertical;
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
          .method-toggle-group {
            display: flex;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 4px;
            background: var(--bg-elevated);
          }
          .method-toggle-btn {
            flex: 1;
            padding: 8px 16px;
            border: none;
            background: transparent;
            color: var(--text-secondary);
            font-size: var(--text-sm);
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .method-toggle-btn.active {
            background: var(--bg-surface);
            color: var(--primary);
            box-shadow: var(--shadow-sm);
          }
          .api-config-section {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            background: var(--bg-elevated);
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .section-label {
            font-size: var(--text-xs);
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
          }
          .api-providers-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
          }
          .provider-card {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 12px;
            cursor: pointer;
            background: var(--bg-surface);
            transition: all 0.2s ease;
          }
          .provider-card.active {
            border-color: var(--active-color);
            box-shadow: 0 0 0 2px var(--active-color);
          }
          .provider-card-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .provider-name {
            font-size: var(--text-sm);
            font-weight: 600;
          }
          .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--border);
          }
          .status-dot.configured {
            background: #10b981;
          }
          .provider-card-sub {
            font-size: 10px;
            color: var(--text-muted);
          }
          .provider-details-panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 16px;
            background: var(--bg-surface);
            display: flex;
            flex-direction: column;
            gap: 14px;
          }
          .provider-panel-title {
            font-size: var(--text-sm);
            font-weight: 600;
            border-bottom: 1px solid var(--border);
            padding-bottom: 8px;
          }
          .api-field-group {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          .api-key-input-container {
            display: flex;
            gap: 8px;
          }
          .api-key-toggle-btn {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            color: var(--text-primary);
            border-radius: 6px;
            padding: 0 12px;
            cursor: pointer;
            font-size: var(--text-xs);
          }
          @keyframes modalIn {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>

        <div className="ai-model-header">
          <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700 }}>
            Chỉnh sửa Mô hình AI
          </h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetAndClose}
            disabled={faceStep === 'loading'}
          >
            Đóng
          </button>
        </div>

        {loading ? (
          <div className="ai-model-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
            <div style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <h3 style={{ marginTop: '16px', fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Đang tải dữ liệu mô hình...
            </h3>
          </div>
        ) : (
          <>
            {faceStep === 'form' && (
              <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
                <div className="ai-model-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="ai-model-field">
                      <label>Tên Mô hình AI *</label>
                      <input
                        type="text"
                        name="modelName"
                        value={form.modelName}
                        onChange={handleChange}
                        placeholder="Ví dụ: DeepSeek Diagnostic"
                        required
                      />
                    </div>

                    <div className="ai-model-field">
                      <label>Phiên bản *</label>
                      <input
                        type="text"
                        name="modelVersion"
                        value={form.modelVersion}
                        onChange={handleChange}
                        placeholder="Ví dụ: v2.5.4"
                        required
                      />
                    </div>
                  </div>

                  <div className="ai-model-field">
                    <label>Chuyên khoa Khuyến nghị (Tùy chọn)</label>
                    <input
                      type="text"
                      name="recommendedSpecialty"
                      value={form.recommendedSpecialty}
                      onChange={handleChange}
                      placeholder="Ví dụ: Da liễu, Nội khoa"
                    />
                  </div>

                  <div className="ai-model-field">
                    <label>Phương thức Kết nối</label>
                    <div className="method-toggle-group">
                      <button
                        type="button"
                        className={`method-toggle-btn ${method === 'IP' ? 'active' : ''}`}
                        onClick={() => {
                          setMethod('IP');
                          setTestedSuccess(false);
                          setTestMessage('');
                        }}
                      >
                        Địa chỉ IP / Host
                      </button>
                      <button
                        type="button"
                        className={`method-toggle-btn ${method === 'API' ? 'active' : ''}`}
                        onClick={() => {
                          setMethod('API');
                          setTestedSuccess(false);
                          setTestMessage('');
                        }}
                      >
                        API Cloud Providers
                      </button>
                    </div>
                  </div>

                  {method === 'IP' ? (
                    <div className="ai-model-field">
                      <label>Địa chỉ IP / host *</label>
                      <input
                        type="text"
                        name="endpoint"
                        value={form.endpoint}
                        onChange={handleChange}
                        placeholder="192.168.1.100:8080/model"
                      />
                    </div>
                  ) : (
                    <div className="api-config-section">
                      <span className="section-label">API Cloud Providers</span>

                      <div className="api-providers-grid">
                        {Object.entries(PROVIDER_DEFAULTS).map(([key, data]) => {
                          const isActive = activeProvider === key;
                          const isConfigured = !!providerConfig[key].apiKey;
                          return (
                            <div
                              key={key}
                              className={`provider-card ${isActive ? 'active' : ''}`}
                              onClick={() => {
                                setActiveProvider(key);
                                setTestedSuccess(false);
                                setTestMessage('');
                              }}
                              style={{ '--active-color': data.color }}
                            >
                              <div className="provider-card-header">
                                <span className="provider-name" style={{ fontSize: '11px' }}>{data.name}</span>
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
                          Cấu hình {PROVIDER_DEFAULTS[activeProvider].name}
                        </div>

                        <div className="api-field-group">
                          <div className="ai-model-field">
                            <label>API Key *</label>
                            <div className="api-key-input-container">
                              <input
                                type={showApiKey ? 'text' : 'password'}
                                value={providerConfig[activeProvider].apiKey}
                                onChange={(e) => handleConfigChange(activeProvider, 'apiKey', e.target.value)}
                                placeholder="Nhập API Key mới hoặc giữ nguyên"
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
                              placeholder="Mặc định nhà cung cấp"
                            />
                          </div>
                        </div>

                        <div className="api-field-group">
                          <div className="ai-model-field">
                            <label>Model *</label>
                            <select
                              value={providerConfig[activeProvider].model}
                              onChange={(e) => handleConfigChange(activeProvider, 'model', e.target.value)}
                            >
                              {(PROVIDER_MODELS[activeProvider] || []).map((m) => (
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
                                placeholder="Nhập tên model"
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
                      placeholder="Ghi chú về model AI này"
                    />
                  </div>

                  {error && <div className="ai-model-alert">{error}</div>}
                </div>

                <div className="ai-model-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                  {method === 'API' && !testedSuccess && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      * Vui lòng kiểm tra kết nối API Key thành công trước khi lưu
                    </span>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={resetAndClose}>
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={method === 'API' && !testedSuccess}
                  >
                    Lưu Thay đổi
                  </button>
                </div>
              </form>
            )}

            {faceStep === 'face' && (
              <div className="ai-model-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '16px' }}>
                <div style={{ color: 'var(--primary)', fontWeight: 600, textAlign: 'center', fontSize: 'var(--text-sm)' }}>
                  ⚠️ Phát hiện thay đổi thông tin kết nối/bảo mật. Vui lòng quét khuôn mặt sinh trắc học của Quản trị viên để ủy quyền giao dịch.
                </div>
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
              <div className="ai-model-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '20px' }}>
                <div style={{ width: '48px', height: '48px', border: '4px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600 }}>{statusText}</h3>
              </div>
            )}

            {faceStep === 'success' && (
              <div className="ai-model-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '350px', gap: '16px' }}>
                <div style={{ width: '56px', height: '56px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid #10b981', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' }}>✓</div>
                <h3 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: '#10b981' }}>
                  Cập nhật mô hình AI thành công!
                </h3>
                {txHash && (
                  <div style={{ width: '100%', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '8px', padding: '12px', fontSize: 'var(--text-sm)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Trạng thái:</strong>
                      <span>Đã cập nhật trên Blockchain</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          </>
        )}
      </div>
    </div>
  );
}
