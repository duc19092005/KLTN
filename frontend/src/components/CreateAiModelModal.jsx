import { useState } from 'react';
import api from '../services/api';

const INITIAL_FORM = {
  modelName: '',
  modelVersion: '',
  recommendedSpecialty: '',
  endpoint: '',
  description: '',
};

export default function CreateAiModelModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [method, setMethod] = useState('IP');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  if (!open) return null;

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const resetAndClose = () => {
    setForm(INITIAL_FORM);
    setMethod('IP');
    setError('');
    setResult(null);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const required = ['modelName', 'modelVersion', 'endpoint'];
    for (const key of required) {
      if (!form[key]?.trim()) {
        setError(`Vui lòng điền trường: ${fieldLabel(key)}`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.post('/ai-model/register', {
        modelName: form.modelName.trim(),
        modelVersion: form.modelVersion.trim(),
        recommendedSpecialty: form.recommendedSpecialty.trim() || undefined,
        ipHash: form.endpoint.trim(),
        description: form.description?.trim()
          ? `[${method}] ${form.description.trim()}`
          : `[${method}]`,
      });
      setResult(res.data);
      await onSuccess?.(res.data);
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Thêm Model AI thất bại'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Backdrop onClick={resetAndClose}>
      <div className="ai-model-modal" onClick={(e) => e.stopPropagation()}>
        <style>{`
          .ai-model-modal {
            width: min(680px, calc(100vw - 24px));
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
          @keyframes aiModalIn {
            from { opacity: 0; transform: translateY(8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @media (max-width: 680px) {
            .ai-model-grid { grid-template-columns: 1fr; }
            .ai-model-header, .ai-model-body, .ai-model-footer { padding-left: 16px; padding-right: 16px; }
            .ai-model-footer { flex-direction: column-reverse; }
            .ai-model-footer .btn { width: 100%; }
          }
        `}</style>

        <div className="ai-model-header">
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              Thêm Model AI
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              Khai báo thông tin triển khai model
            </p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={resetAndClose}>
            Đóng
          </button>
        </div>

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

            <Field
              label={method === 'IP' ? 'Địa chỉ IP / host *' : 'API endpoint *'}
              name="endpoint"
              value={form.endpoint}
              onChange={handleChange}
              placeholder={method === 'IP' ? '192.168.1.100:8080/model' : 'https://api.example.com/models/predict'}
            />

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

            {result && (
              <div className="ai-model-result">
                <ResultRow label="Model ID" value={result.modelId} />
                <ResultRow label="Chuyên khoa đề xuất" value={result.recommendedSpecialty} />
                <ResultRow label="SHA-256" value={formatHash(result.ipHashForBlockchain)} mono />
                <ResultRow label="Trạng thái" value="Đã lưu DB, chờ ghi blockchain" />
              </div>
            )}
          </div>

          <div className="ai-model-footer">
            <button type="button" className="btn btn-secondary" onClick={resetAndClose} disabled={loading}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Đang thêm...' : 'Thêm Model AI'}
            </button>
          </div>
        </form>
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
