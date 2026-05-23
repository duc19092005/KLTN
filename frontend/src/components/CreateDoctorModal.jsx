import { useState, useRef } from 'react';
import api from '../services/api';

const INITIAL_FORM = {
  doctorName: '',
  licenseId: '',
  identityNumber: '',
  position: '',
  specialties: '',
  degree: '',
  facultyOfWork: '',
  dateOfBirth: '',
  workingStartDate: '',
  email: '',
  username: '',
  tempPassword: '',
};

export default function CreateDoctorModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [portrait, setPortrait] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const fileRef = useRef(null);

  if (!open) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handlePortrait = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Chỉ chấp nhận file ảnh (jpg, png, webp)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh không được vượt quá 5 MB');
      return;
    }
    setPortrait(file);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(file);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const required = ['doctorName','licenseId','identityNumber','position','specialties',
                      'degree','facultyOfWork','dateOfBirth','workingStartDate','email',
                      'username','tempPassword'];
    for (const key of required) {
      if (!form[key]?.trim()) {
        setError(`Vui lòng điền trường: ${fieldLabel(key)}`);
        return;
      }
    }
    if (form.tempPassword.length < 6) {
      setError('Mật khẩu tạm thời phải ít nhất 6 ký tự');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (portrait) fd.append('portrait', portrait);

      const res = await api.post('/hospital/doctors', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(res.data);
      onSuccess?.(res.data.doctor);
    } catch (err) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : (msg || 'Tạo tài khoản thất bại'));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setPortrait(null);
    setPreview(null);
    setError('');
    setSuccess(null);
    onClose();
  };

  // ── Success Screen ──────────────────────────────────────────────────────
  if (success) {
    return (
      <Backdrop onClick={handleClose}>
        <div className="saas-modal-box scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, padding: '32px 24px' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="success-pulse-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            
            <h2 style={{ margin: '0 0 6px 0', fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
              Tạo tài khoản thành công!
            </h2>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.85rem', lineHeight: '1.4' }}>
              Hồ sơ y tế mã hóa của bác sĩ đã được khởi tạo và ghi nhận trên hệ thống.
            </p>

            <div className="credential-receipt">
              {[
                ['Username', success.doctor.username],
                ['Email', success.doctor.email],
                ['Họ tên', success.doctor.doctorName],
                ['Chức vụ', success.doctor.position],
                ['Blockchain', success.doctor.blockchainStatus || 'SUCCESS'],
                ['Metadata Hash', success.doctor.metadataHash],
              ].map(([label, val]) => (
                <div key={label} className="receipt-row">
                  <span className="receipt-label">{label}</span>
                  <span className={`receipt-value ${label === 'Metadata Hash' ? 'monospace-text' : ''}`} title={val}>
                    {label === 'Metadata Hash' ? `${val?.slice(0, 10)}...${val?.slice(-6)}` : val}
                  </span>
                </div>
              ))}
            </div>

            <button className="premium-btn btn-primary-color" style={{ width: '100%', height: 44 }} onClick={handleClose}>
              Xác nhận và đóng
            </button>
          </div>
        </div>
      </Backdrop>
    );
  }

  // ── Form Screen ─────────────────────────────────────────────────────────
  return (
    <Backdrop onClick={handleClose}>
      <div className="saas-modal-box scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        
        {/* INJECTED PREMIUM & RESPONSIVE STYLES */}
        <style>{`
          .saas-modal-box {
            background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;
            width: 100%; display: flex; flex-direction: column;
            box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
            max-height: calc(100vh - 40px); overflow: hidden;
            margin: 12px;
          }
          .modal-header {
            padding: 20px 24px; border-bottom: 1px solid #f1f5f9;
            display: flex; justify-content: space-between; align-items: center;
          }
          .modal-body-scroll {
            padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px;
          }
          .modal-footer {
            padding: 16px 24px; border-top: 1px solid #f1f5f9;
            display: flex; gap: 12px; justify-content: flex-end; background: #f8fafc;
          }
          
          /* Form Layouts & System Grids */
          .avatar-top-row {
            display: grid; grid-template-columns: 160px 1fr; gap: 24px;
          }
          .grid-row-sub {
            display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
          }
          .grid-three-cols {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px;
          }
          .grid-account-box {
            display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
          }

          .form-group { display: flex; flex-direction: column; gap: 6px; }
          .form-label { font-size: 0.75rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.3px; }
          .premium-input {
            width: 100%; height: 38px; padding: 0 12px; background: #ffffff;
            border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a;
            font-size: 0.875rem; outline: none; transition: all 0.15s ease;
          }
          .premium-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
          .premium-input::placeholder { color: #94a3b8; }
          
          .upload-zone {
            border: 2px dashed #cbd5e1; border-radius: 10px; background: #f8fafc;
            height: 128px; display: flex; flex-direction: column; align-items: center;
            justify-content: center; cursor: pointer; transition: all 0.2s; overflow: hidden;
          }
          .upload-zone:hover { border-color: #2563eb; background: #f0f5ff; }
          
          .account-section-box {
            padding: 18px; background: #f0f5ff; border: 1px solid #dbeafe; border-radius: 10px;
          }

          /* Buttons */
          .premium-btn {
            display: inline-flex; align-items: center; justify-content: center;
            padding: 0 16px; height: 38px; font-size: 0.875rem; font-weight: 500;
            border-radius: 6px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent;
          }
          .btn-secondary-color { background: #ffffff; border-color: #cbd5e1; color: #334155; }
          .btn-secondary-color:hover { background: #f8fafc; color: #0f172a; }
          .btn-primary-color { background: #2563eb; color: #ffffff; font-weight: 600; }
          .btn-primary-color:hover { background: #1d4ed8; }

          .success-pulse-icon {
            width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;
          }
          .credential-receipt {
            background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; text-align: left; margin-bottom: 24px;
          }
          .receipt-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
          .receipt-row:last-child { border-bottom: none; }
          .receipt-label { font-size: 0.75rem; color: #64748b; font-weight: 500; }
          .receipt-value { font-size: 0.8rem; color: #0f172a; font-weight: 600; text-align: right; word-break: break-all; padding-left: 8px;}
          .monospace-text { font-family: ui-monospace, monospace; color: #2563eb; }
          .alert-error-box { padding: 10px 14px; background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; color: #dc2626; font-size: 0.825rem; font-weight: 500; }
          .scale-up { animation: modalScaleUp 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
          @keyframes modalScaleUp { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          .modal-body-scroll::-webkit-scrollbar { width: 5px; }
          .modal-body-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

          /* ── 📱 MEDIA QUERIES RESPONSIVE SYSTEM ── */
          @media (max-width: 680px) {
            .avatar-top-row {
              grid-template-columns: 1fr;
              gap: 16px;
            }
            .upload-zone {
              height: 140px;
            }
            .grid-row-sub, .grid-three-cols, .grid-account-box {
              grid-template-columns: 1fr;
              gap: 12px;
            }
            .modal-body-scroll {
              padding: 16px;
              gap: 16px;
            }
            .saas-modal-box {
              max-height: calc(100vh - 24px);
              margin: 8px;
            }
          }
          
          @media (min-width: 681px) and (max-width: 900px) {
            .grid-three-cols {
              grid-template-columns: 1fr 1fr;
            }
          }
        `}</style>

        {/* ── HEADER ── */}
        <div className="modal-header">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Tạo tài khoản bác sĩ
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Khởi tạo hồ sơ nhân sự mã hóa mới</span>
          </div>
          <button type="button" onClick={handleClose} style={closeBtnStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* ── BODY (SCROLLABLE FORM) ── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', margin: 0, overflow: 'hidden' }}>
          
          <div className="modal-body-scroll">
            
            {/* Split Row: Upload Ảnh & Thông tin cơ bản */}
            <div className="avatar-top-row">
              <div className="form-group">
                <label className="form-label">Ảnh chân dung *</label>
                <div onClick={() => fileRef.current?.click()} className="upload-zone">
                  {preview ? (
                    <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ padding: '0 8px', textAlign: 'center' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ marginBottom: 4 }}>
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                        <circle cx="9" cy="9" r="2"/>
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                      </svg>
                      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>Tải ảnh lên (Max 5MB)</div>
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePortrait} style={{ display: 'none' }} />
                {preview && (
                  <button type="button" onClick={() => { setPortrait(null); setPreview(null); }}
                    style={{ marginTop: 4, fontSize: '0.75rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    Xóa ảnh
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                <Field label="Họ và tên bác sĩ *" name="doctorName" value={form.doctorName} onChange={handleChange} placeholder="Nguyễn Văn A" />
                <div className="grid-row-sub">
                  <Field label="Mã chứng chỉ hành nghề *" name="licenseId" value={form.licenseId} onChange={handleChange} placeholder="VN-BS-12345" />
                  <Field label="Số CMND / CCCD *" name="identityNumber" value={form.identityNumber} onChange={handleChange} placeholder="012345678901" />
                </div>
              </div>
            </div>

            {/* Chuyên môn hàng 1 */}
            <div className="grid-three-cols">
              <Field label="Chức vụ *" name="position" value={form.position} onChange={handleChange} placeholder="Bác sĩ chính" />
              <Field label="Chuyên khoa *" name="specialties" value={form.specialties} onChange={handleChange} placeholder="Tim mạch" />
              <Field label="Bằng cấp *" name="degree" value={form.degree} onChange={handleChange} placeholder="Tiến sĩ Y khoa" />
            </div>

            {/* Chuyên môn hàng 2 */}
            <div className="grid-three-cols">
              <Field label="Khoa / Phòng ban *" name="facultyOfWork" value={form.facultyOfWork} onChange={handleChange} placeholder="Khoa Tim mạch" />
              <Field label="Ngày sinh *" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
              <Field label="Ngày bắt đầu làm việc *" name="workingStartDate" type="date" value={form.workingStartDate} onChange={handleChange} />
            </div>

            <Field label="Địa chỉ Email chính thức *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="bsnguyenvana@hospital.vn" />

            {/* Tài khoản phân quyền */}
            <div className="account-section-box">
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Thông tin tài khoản đăng nhập hệ thống
              </div>
              <div className="grid-account-box">
                <Field label="Username đăng nhập *" name="username" value={form.username} onChange={handleChange} placeholder="bs_nguyenvana" />
                <Field label="Mật khẩu tạm thời *" name="tempPassword" type="password" value={form.tempPassword} onChange={handleChange} placeholder="Tối thiểu 6 ký tự" />
              </div>
            </div>

            {error && <div className="alert-error-box">{error}</div>}

          </div>

          {/* ── FOOTER ACTIONS ── */}
          <div className="modal-footer">
            <button type="button" className="premium-btn btn-secondary-color" onClick={handleClose} disabled={loading}>
              Hủy bỏ
            </button>
            <button type="submit" className="premium-btn btn-primary-color" disabled={loading} style={{ minWidth: 140 }}>
              {loading ? 'Đang khởi tạo...' : 'Khởi tạo hồ sơ'}
            </button>
          </div>
          
        </form>
      </div>
    </Backdrop>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="premium-input"
      />
    </div>
  );
}

function Backdrop({ children, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.3)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 4, // Đệm nhỏ ở viền để mobile không bị dính sát mép
      }}
    >
      {children}
    </div>
  );
}

const closeBtnStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  width: 28,
  height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  color: '#64748b',
  transition: 'all 0.15s',
};

function fieldLabel(key) {
  const map = {
    doctorName: 'Họ và tên', licenseId: 'Mã chứng chỉ',
    identityNumber: 'Số CMND/CCCD', position: 'Chức vụ',
    specialties: 'Chuyên khoa', degree: 'Bằng cấp',
    facultyOfWork: 'Khoa / Phòng ban', dateOfBirth: 'Ngày sinh',
    workingStartDate: 'Ngày bắt đầu làm việc', email: 'Email',
    username: 'Username đăng nhập', tempPassword: 'Mật khẩu tạm thời',
  };
  return map[key] || key;
}