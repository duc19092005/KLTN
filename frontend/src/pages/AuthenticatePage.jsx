import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import { useThemeLang } from '../contexts/ThemeLangContext';
import WalletConnect from '../components/WalletConnect';
import FaceCapture from '../components/FaceCapture';
import { authService } from '../services/authService';
import { ethers } from 'ethers';

export default function AuthenticatePage() {
  const { user, token, updateToken } = useAuth();
  const { address, connectMock, disconnect } = useWallet();
  const navigate = useNavigate();
  const { theme, toggleTheme, lang, toggleLang } = useThemeLang();

  const isAdmin = user?.role === 'ADMIN';
  const isDoctor = user?.role === 'DOCTOR';

  // Doctors do NOT need wallet authentication.
  // All blockchain operations are signed server-side using the private key in .env.
  // Wallet step is Admin-only. Skip directly to face scan for doctors.
  const [walletVerified, setWalletVerified] = useState(isAdmin ? true : true);
  const [verifiedWalletAddress, setVerifiedWalletAddress] = useState(
    isAdmin ? (user?.walletAddress || '') : ''
  );
  const [customWallet, setCustomWallet] = useState('');
  const [status, setStatus] = useState(
    isAdmin ? 'Ví đã được xác thực qua blockchain khi đăng nhập. Tiến hành quét khuôn mặt.' : ''
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.verified) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleWalletVerify = async (addr, isMockSelection = false) => {
    setLoading(true);
    setStatus('');
    try {
      if (isMockSelection) {
        connectMock(addr);
        setWalletVerified(true);
        setVerifiedWalletAddress(addr);
        setStatus('Xác thực thành công (Mock Wallet). Hãy tiến hành quét khuôn mặt.');
        return;
      }

      setStatus('Đang ký tin nhắn xác thực...');
      const message = `ZKP Identity Verification\nTimestamp: ${Date.now()}\nAddress: ${addr}`;

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(message);

      setStatus('Đang xác minh ví trên hệ thống...');
      const res = await authService.verifyWallet(addr, signature, message);

      if (res.data.verified) {
        setWalletVerified(true);
        setVerifiedWalletAddress(addr);
        setStatus('Xác thực ví thành công. Vui lòng thực hiện quét khuôn mặt.');
      }
    } catch (err) {
      setStatus('Xác thực ví thất bại: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  const handleFaceVerify = async (embedding) => {
    setLoading(true);
    setStatus('Đang đối khớp dữ liệu sinh học khuôn mặt...');
    try {
      const res = await authService.verifyFace(embedding);
      if (res.data.verified) {
        setStatus(`Xác thực thành công. Độ tương đồng: ${(res.data.similarity * 100).toFixed(1)}%`);
        updateToken(res.data.access_token, { verified: true });
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (err) {
      setStatus('Xác thực khuôn mặt thất bại: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = () => {
    setWalletVerified(false);
    setVerifiedWalletAddress('');
    setCustomWallet('');
    disconnect();
    setStatus('');
  };

  const isDark = theme === 'dark';

  const cssVars = {
    '--bg-color': isDark ? '#070a13' : '#f8fafc',
    '--card-bg': isDark ? 'rgba(15, 23, 42, 0.65)' : 'rgba(255, 255, 255, 0.85)',
    '--card-border': isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.08)',
    '--text-main': isDark ? '#f8fafc' : '#0f172a',
    '--text-muted': isDark ? '#94a3b8' : '#64748b',
    '--primary-auth': '#6366f1',
    '--primary-hover': '#4f46e5',
    '--input-bg': isDark ? '#0f172a' : '#ffffff',
    '--input-border': isDark ? '#1e293b' : '#cbd5e1',
    '--success': '#10b981',
    '--danger': '#ef4444',
    '--warning': '#f59e0b',
    '--auth-rgb': '99, 102, 241'
  };

  return (
    <div className="auth-premium-wrapper" style={cssVars}>
      <style>{`
        .auth-premium-wrapper {
          min-height: calc(100vh - 64px); width: 100%; display: flex; flex-direction: column;
          align-items: center; justify-content: flex-start; background-color: var(--bg-color);
          color: var(--text-main); padding: 48px 24px 32px; box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          position: relative; overflow-x: hidden; transition: background-color 0.3s;
        }

        .ambient-glow-auth {
          position: absolute; width: 680px; height: 420px; top: -12%; left: 50%;
          transform: translateX(-50%); background: radial-gradient(circle, rgba(var(--auth-rgb), ${isDark ? '0.08' : '0.03'}), transparent 70%);
          filter: blur(80px); pointer-events: none; z-index: 0;
        }

        .auth-page-intro {
          position: relative; z-index: 5; width: 100%; max-width: 520px;
          margin-bottom: 28px; text-align: center;
        }

        .auth-glass-card {
          width: 100%; max-width: 520px; background: var(--card-bg);
          border: 1px solid var(--card-border); border-radius: 24px;
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          box-shadow: ${isDark ? '0 24px 50px -12px rgba(0, 0, 0, 0.5)' : '0 20px 40px -12px rgba(15, 23, 42, 0.08)'};
          overflow: hidden; z-index: 5; box-sizing: border-box;
          animation: cardEntrance 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .auth-title { font-size: 1.85rem; font-weight: 700; text-align: center; margin: 0 0 10px; letter-spacing: -0.03em; }
        .auth-subtitle { color: var(--text-muted); font-size: 0.95rem; text-align: center; margin: 0; line-height: 1.55; }

        .stepper-container { display: flex; gap: 6px; padding: 28px 28px 0; }
        .step-segment { flex: 1; height: 4px; border-radius: 9999px; background: var(--input-border); transition: all 0.4s ease; }
        .step-segment.active { background: var(--primary-auth); box-shadow: 0 0 10px rgba(var(--auth-rgb), 0.25); }

        .card-header-pane { padding: 28px 28px 16px; }
        .card-body-pane { padding: 0 28px 28px; }
        .step-heading { font-size: 1.2rem; font-weight: 700; margin: 0; letter-spacing: -0.02em; }
        .step-desc { color: var(--text-muted); font-size: 0.85rem; margin: 6px 0 0; line-height: 1.45; }

        /* Ép phẳng nút kết nối MetaMask bên trong WalletConnect */
        .wallet-container-box .action-button-core {
          width: 100% !important; height: 46px !important; background: var(--input-bg) !important;
          color: var(--text-main) !important; border: 1px solid var(--input-border) !important;
          border-radius: 12px !important; font-size: 0.9rem !important; font-weight: 600 !important;
          cursor: pointer !important; transition: all 0.2s ease !important; box-shadow: none !important;
        }
        .wallet-container-box .action-button-core:hover { border-color: var(--primary-auth) !important; background: rgba(var(--auth-rgb), 0.05) !important; }

        .wallet-container-box .disconnect-icon-btn {
          width: 28px !important; height: 28px !important; min-width: 28px !important; padding: 0 !important;
          background: transparent !important; border: 1px solid rgba(239, 68, 68, 0.15) !important;
          color: var(--danger) !important; box-shadow: none !important;
        }

        .auth-select, .auth-input {
          width: 100%; height: 44px; padding: 0 14px; background: var(--input-bg);
          border: 1px solid var(--input-border); border-radius: 10px; color: var(--text-main);
          font-size: 0.875rem; outline: none; transition: all 0.2s; box-sizing: border-box;
        }
        .auth-select:focus, .auth-input:focus { border-color: var(--primary-auth); }

        .auth-label { font-size: 0.725rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
        .form-block { margin-bottom: 16px; }

        .core-btn {
          width: 100%; height: 44px; background: var(--primary-auth); color: #fff;
          border: none; border-radius: 10px; font-size: 0.9rem; font-weight: 600;
          cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center;
        }
        .core-btn:hover:not(:disabled) { background: var(--primary-hover); }
        .core-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .tech-camera-frame {
          border: 1px solid var(--input-border); border-radius: 16px; padding: 12px;
          background: rgba(0,0,0,0.02); display: flex; justify-content: center;
        }

        .status-toast {
          margin-top: 20px; padding: 12px 14px; border-radius: 10px; font-size: 0.85rem; font-weight: 500; line-height: 1.4;
          background: rgba(255,255,255,0.03); border: 1px solid var(--input-border);
        }
        .status-toast.has-error { color: var(--danger); border-color: rgba(239, 64, 64, 0.2); background: rgba(239, 64, 64, 0.02); }
        .status-toast.has-success { color: var(--success); border-color: rgba(16, 185, 129, 0.2); background: rgba(16, 185, 129, 0.02); }

        .dev-drawer { margin-top: 28px; padding-top: 20px; border-top: 1px dashed var(--input-border); }
        .dev-title { font-size: 0.8rem; font-weight: 700; color: rgba(var(--auth-rgb), 0.7); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }

        .rollback-link {
          background: none; border: none; color: var(--text-muted); font-size: 0.85rem; font-weight: 500;
          cursor: pointer; display: inline-flex; align-items: center; margin-top: 16px; transition: color 0.2s;
        }
        .rollback-link:hover { color: var(--primary-auth); }

        @keyframes cardEntrance { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .recovery-gate {
          padding: 18px 28px 28px; border-top: 1px solid var(--input-border);
          display: flex; justify-content: center;
        }

        @media (max-width: 640px) {
          .auth-premium-wrapper { padding: 32px 16px 24px; }
          .auth-title { font-size: 1.6rem; }
          .card-header-pane { padding: 22px 20px 12px; }
          .card-body-pane { padding: 0 20px 20px; }
          .stepper-container { padding: 22px 20px 0; }
          .recovery-gate { padding: 16px 20px 22px; }
        }
      `}</style>

      <div className="ambient-glow-auth"></div>

      <div className="auth-page-intro">
        <h1 className="auth-title">
          {isAdmin ? 'Xác thực Sinh trắc học Admin' : 'Xác thực Khuôn Mặt Bác Sĩ'}
        </h1>
        <p className="auth-subtitle">
          {isAdmin
            ? 'Ví đã được xác thực on-chain khi đăng nhập. Hãy quét khuôn mặt để hoàn tất.'
            : 'Quét khuôn mặt để xác thực danh tính sinh trắc học và truy cập Cổng Lâm Sàng.'
          }
        </p>
      </div>

      <div className="auth-glass-card">
        {/* Stepper: Admin has 2 segments (wallet + face), Doctor has 1 (face only) */}
        <div className="stepper-container">
          {isAdmin && <div className="step-segment active" />}
          <div className="step-segment active" />
        </div>

        {/* STEP 1: WALLET SELECTION */}
        {!walletVerified ? (
          <div className="wallet-container-box">
            <div className="card-header-pane">
              <h2 className="step-heading">1. Chứng minh sở hữu Ví</h2>
              <p className="step-desc">
                Kết nối ví MetaMask của bạn và ký chuỗi mã hóa để xác thực tài khoản Node phân tán.
              </p>
            </div>
            <div className="card-body-pane">
              <WalletConnect onConnect={(addr) => handleWalletVerify(addr, false)} />

              {/* Developer Testing Tools Drawer */}
              <div className="dev-drawer">
                <div className="dev-title">Developer Testing Box</div>

                <div className="form-block">
                  <label className="auth-label">Hardhat Accounts</label>
                  <select className="auth-select" value={customWallet} onChange={e => setCustomWallet(e.target.value)}>
                    <option value="">-- Chọn tài khoản mẫu Sandbox --</option>
                    <option value="0x70997970C51812dc3A010C7d01b50e0d17dc79C8">Account #1: 0x7099...79C8</option>
                    <option value="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC">Account #2: 0x3C44...93BC</option>
                    <option value="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266">Account #0: 0xf39F...2266</option>
                  </select>
                </div>

                <div className="form-block">
                  <label className="auth-label">Custom Mock Address</label>
                  <input
                    className="auth-input"
                    type="text"
                    placeholder="0x..."
                    value={customWallet}
                    onChange={e => setCustomWallet(e.target.value)}
                  />
                </div>

                <button
                  className="core-btn"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--input-border)', height: '38px', fontSize: '0.825rem' }}
                  disabled={!customWallet || loading}
                  onClick={() => handleWalletVerify(customWallet, true)}
                >
                  Bypass MetaMask với Ví giả lập
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="card-header-pane">
              <h2 className="step-heading">
                {isAdmin ? 'Xác thực sinh học khuôn mặt' : 'Quét khuôn mặt để xác thực'}
              </h2>
              <p className="step-desc">
                Vui lòng nhìn thẳng vào camera điều hướng để đối khớp lớp bảo mật liveness dữ liệu mã hóa.
              </p>
            </div>

            <div className="card-body-pane">
              <div className="tech-camera-frame">
                <FaceCapture onCapture={handleFaceVerify} requireLiveness={true} />
              </div>

              {/* Rollback to wallet step only makes sense for Admin */}
              {isAdmin && (
                <button className="rollback-link" onClick={handleRollback} disabled={loading}>
                  Quay lại thay đổi Ví xác thực
                </button>
              )}
            </div>
          </div>
        )}

        {/* Global Toast Status Message */}
        {status && (
          <div className={`status-toast ${status.includes('thất bại') || status.includes('failed') ? 'has-error' : status.includes('thành công') ? 'has-success' : ''}`} style={{ margin: '0 28px 28px' }}>
            {status}
          </div>
        )}

        {/* Alternate Recovery Gate */}
        <div className="recovery-gate">
          <button
            onClick={() => navigate('/recovery')}
            style={{ background: 'none', border: 'none', color: 'var(--warning)', fontSize: '0.825rem', fontWeight: 600, cursor: 'pointer' }}
          >
            {isAdmin
              ? 'Yêu cầu khôi phục quyền Admin gốc'
              : 'Quên mật khẩu? Khôi phục qua nhận diện khuôn mặt'} →
          </button>
        </div>

      </div>
    </div>
  );
}
