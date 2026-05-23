import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useThemeLang } from '../contexts/ThemeLangContext';
import { authService } from '../services/authService';
import SecretCodeModal from '../components/SecretCodeModal';
import api from '../services/api';
import { ethers } from 'ethers';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithWallet, loginWithInvite, loading } = useAuth();
  const { theme, toggleTheme, lang, toggleLang, t } = useThemeLang();

  // Role Tab: 'doctor' | 'admin'
  const [activeTab, setActiveTab] = useState('doctor');
  // Admin sub-mode: 'wallet' | 'invite'
  const [adminMode, setAdminMode] = useState('wallet');

  // Doctor state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Admin wallet state
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletSigning, setWalletSigning] = useState(false);

  // Admin invite state
  const [inviteToken, setInviteToken] = useState('');

  // Secret code modal
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [secretCode, setSecretCode] = useState('');
  const [generatingSecret, setGeneratingSecret] = useState(false);

  const [error, setError] = useState('');

  // ============================================================
  // Premium SVGs
  // ============================================================
  const firstAidIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>;
  const walletIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" /><path d="M23 11a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2z" /><circle cx="18" cy="12" r="1" /></svg>;
  const userIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  const lockIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
  const inviteIcon = <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="9" x2="15" y2="9" /><line x1="9" y1="13" x2="13" y2="13" /></svg>;
  const globeIcon = <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>;
  const moonIcon = <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>;
  const sunIcon = <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>;
  const arrowRightIcon = <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6 }}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
  const metamaskFox = <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12l5-3 3 8 2-8 3 8 5-3v6H2z"/><circle cx="12" cy="12" r="10"/></svg>;

  // ============================================================
  // Handlers
  // ============================================================
  const handleWalletLogin = async () => {
    setError('');
    if (!window.ethereum) return setError(t('login.noMetamask'));
    try {
      setWalletConnecting(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setWalletSigning(true);
      const challengeRes = await authService.walletChallenge(address);
      const { message } = challengeRes.data;
      const signature = await signer.signMessage(message);
      const result = await loginWithWallet(address, signature, message);
      
      if (result.success) navigate('/authenticate');
      else setError(result.error);
    } catch (err) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') setError(t('login.walletRejected'));
      else setError(err.response?.data?.message || err.message || t('login.walletFailed'));
    } finally {
      setWalletConnecting(false);
      setWalletSigning(false);
    }
  };

  const handleInviteLogin = async (e) => {
    e.preventDefault();
    setError('');
    const result = await loginWithInvite(inviteToken.trim());
    if (result.success) {
      setGeneratingSecret(true);
      try {
        const res = await api.post('/auth/generate-secret', null, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        setSecretCode(res.data.secret);
        setShowSecretModal(true);
      } catch (err) {
        navigate('/register');
      } finally {
        setGeneratingSecret(false);
      }
    } else setError(result.error);
  };

  const handleDoctorLogin = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(username, password);
    if (result.success) navigate(result.firstLogin ? '/register' : '/authenticate');
    else setError(result.error);
  };

  const handleSecretConfirm = () => {
    setShowSecretModal(false);
    navigate('/register');
  };

  // ============================================================
  // Dynamic Theming Colors
  // ============================================================
  const isDark = theme === 'dark';
  const cssVars = {
    '--bg-color': isDark ? '#0f172a' : '#f8fafc',
    '--card-bg': isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
    '--card-border': isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    '--text-main': isDark ? '#f8fafc' : '#0f172a',
    '--text-muted': isDark ? '#94a3b8' : '#64748b',
    '--input-bg': isDark ? '#0f172a' : '#ffffff',
    '--input-border': isDark ? '#334155' : '#cbd5e1',
    '--primary-doc': isDark ? '#2dd4bf' : '#0d9488',
    '--primary-doc-hover': isDark ? '#14b8a6' : '#0f766e',
    '--primary-adm': isDark ? '#818cf8' : '#4f46e5',
    '--primary-adm-hover': isDark ? '#6366f1' : '#4338ca',
  };

  const activeColor = activeTab === 'doctor' ? 'var(--primary-doc)' : 'var(--primary-adm)';
  const activeHover = activeTab === 'doctor' ? 'var(--primary-doc-hover)' : 'var(--primary-adm-hover)';

  return (
    <div className="saas-login-wrapper" style={cssVars}>
      {/* INJECTED PREMIUM STYLES */}
      <style>{`
        .saas-login-wrapper {
          min-height: 100vh; width: 100%; display: flex; align-items: center; justify-content: center;
          background-color: var(--bg-color); position: relative; overflow: hidden;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          transition: background-color 0.3s ease; color: var(--text-main);
        }
        
        /* Abstract Background Elements */
        .bg-mesh {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          background: radial-gradient(circle at 15% 50%, rgba(13, 148, 136, ${isDark ? '0.15' : '0.08'}), transparent 25%),
                      radial-gradient(circle at 85% 30%, rgba(79, 70, 229, ${isDark ? '0.15' : '0.08'}), transparent 25%);
          filter: blur(60px);
        }

        /* Top Controls */
        .top-nav { position: absolute; top: 24px; right: 32px; display: flex; gap: 12px; z-index: 20; }
        .brand-logo { position: absolute; top: 28px; left: 32px; font-size: 1.25rem; font-weight: 800; z-index: 20; letter-spacing: -0.02em; display: flex; gap: 10px; align-items: center;}
        
        .icon-btn {
          display: flex; align-items: center; gap: 6px; padding: 8px 12px;
          background: var(--card-bg); border: 1px solid var(--card-border);
          border-radius: 8px; color: var(--text-main); font-weight: 600; font-size: 0.8rem;
          cursor: pointer; transition: all 0.2s; backdrop-filter: blur(10px);
        }
        .icon-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.05); }

        /* Form Card */
        .saas-glass-card {
          position: relative; z-index: 10; width: 100%; max-width: 440px; margin: 20px;
          background: var(--card-bg); backdrop-filter: blur(20px); Webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--card-border); border-radius: 20px; padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
          animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Segmented Tab Control */
        .tab-switcher {
          display: flex; background: var(--input-bg); border: 1px solid var(--card-border);
          border-radius: 12px; padding: 4px; margin-bottom: 32px; position: relative;
        }
        .tab-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 0; font-size: 0.85rem; font-weight: 600; color: var(--text-muted);
          background: transparent; border: none; border-radius: 8px; cursor: pointer;
          transition: all 0.3s ease; z-index: 2; position: relative;
        }
        .tab-btn.active { color: #ffffff; }
        .tab-indicator {
          position: absolute; top: 4px; bottom: 4px; width: calc(50% - 4px);
          border-radius: 8px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 1;
        }

        /* Form Inputs */
        .input-group { margin-bottom: 20px; }
        .input-label { display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
        .input-wrapper { position: relative; display: flex; align-items: center; }
        .input-icon { position: absolute; left: 16px; color: var(--text-muted); pointer-events: none; transition: color 0.2s; }
        .saas-input {
          width: 100%; height: 48px; padding: 0 16px 0 44px; background: var(--input-bg);
          border: 1px solid var(--input-border); border-radius: 12px; color: var(--text-main);
          font-size: 0.95rem; outline: none; transition: all 0.2s ease; box-sizing: border-box;
        }
        .saas-input:focus { border-color: ${activeColor}; box-shadow: 0 0 0 4px ${activeColor}20; }
        .saas-input:focus + .input-icon { color: ${activeColor}; }
        .saas-input::placeholder { color: var(--text-muted); opacity: 0.6; }

        /* Buttons */
        .saas-submit-btn {
          width: 100%; height: 48px; border: none; border-radius: 12px;
          background: ${activeColor}; color: #ffffff; font-size: 0.95rem; font-weight: 600;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          transition: all 0.2s ease; margin-top: 10px;
        }
        .saas-submit-btn:hover:not(:disabled) { background: ${activeHover}; transform: translateY(-1px); box-shadow: 0 6px 15px ${activeColor}30; }
        .saas-submit-btn:disabled { opacity: 0.7; cursor: not-allowed; }

        /* Links & Helpers */
        .text-link {
          background: none; border: none; color: var(--text-muted); font-size: 0.85rem;
          font-weight: 500; cursor: pointer; transition: color 0.2s; padding: 0;
        }
        .text-link:hover { color: ${activeColor}; }
        
        .admin-info-box {
          background: var(--input-bg); border: 1px solid var(--card-border);
          border-radius: 12px; padding: 16px; margin-bottom: 24px; display: flex; gap: 12px;
        }

        /* Animations */
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Responsive */
        @media (max-width: 480px) {
          .saas-glass-card { padding: 30px 20px; margin: 16px; }
          .top-nav { top: 16px; right: 16px; }
          .brand-logo { top: 16px; left: 16px; font-size: 1.1rem; }
        }
      `}</style>

      <div className="bg-mesh" />

      {/* ZKP Branding */}
      <div className="brand-logo" style={{ color: activeTab === 'doctor' ? 'var(--primary-doc)' : 'var(--primary-adm)' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        ZKP Identity
      </div>

      {/* Top Controls */}
      <div className="top-nav">
        <button onClick={toggleLang} className="icon-btn">
          {globeIcon} {lang === 'vi' ? 'VI' : 'EN'}
        </button>
        <button onClick={toggleTheme} className="icon-btn" style={{ padding: '8px' }}>
          {isDark ? sunIcon : moonIcon}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="saas-glass-card">
        
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px 0', letterSpacing: '-0.01em' }}>
            {lang === 'vi' ? 'Chào mừng trở lại' : 'Welcome back'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            {lang === 'vi' ? 'Vui lòng xác thực danh tính để tiếp tục' : 'Please authenticate your identity to continue'}
          </p>
        </div>

        {/* Unified Tab Switcher */}
        <div className="tab-switcher">
          <div className="tab-indicator" style={{
            background: activeColor,
            left: activeTab === 'doctor' ? '4px' : 'calc(50% + 0px)'
          }} />
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'doctor' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('doctor'); setError(''); }}
          >
            {firstAidIcon} Bác sĩ
          </button>
          <button 
            type="button" 
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('admin'); setError(''); }}
          >
            {walletIcon} Admin
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '20px', fontWeight: 500 }}>
            {error}
          </div>
        )}

        {/* ── DOCTOR FORM ── */}
        {activeTab === 'doctor' && (
          <form onSubmit={handleDoctorLogin} style={{ animation: 'slideUpFade 0.3s ease' }}>
            <div className="input-group">
              <label className="input-label">{t('login.username')}</label>
              <div className="input-wrapper">
                <input
                  className="saas-input"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={lang === 'vi' ? 'Nhập mã nhân viên hoặc email' : 'Employee ID or email'}
                  required autoFocus
                />
                <div className="input-icon">{userIcon}</div>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">{t('login.password')}</label>
              <div className="input-wrapper">
                <input
                  className="saas-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
                <div className="input-icon">{lockIcon}</div>
              </div>
            </div>

            <button type="submit" className="saas-submit-btn" disabled={loading || !username || !password}>
              {loading ? <div className="spinner" /> : <>{lang === 'vi' ? 'Đăng nhập hệ thống' : 'Login to System'} {arrowRightIcon}</>}
            </button>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button type="button" className="text-link" onClick={() => navigate('/forgot-password')}>
                {t('login.forgotPassword')}
              </button>
            </div>
          </form>
        )}

        {/* ── ADMIN FORM ── */}
        {activeTab === 'admin' && (
          <div style={{ animation: 'slideUpFade 0.3s ease' }}>
            
            {/* Admin Controls toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
               <button 
                  type="button" className="text-link" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => { setAdminMode(adminMode === 'wallet' ? 'invite' : 'wallet'); setError(''); }}
                >
                  {adminMode === 'wallet' ? (lang === 'vi' ? 'Chưa có ví? Dùng mã mời' : 'No wallet? Use invite code') : (lang === 'vi' ? 'Quay lại đăng nhập Web3' : 'Back to Web3 Login')}
                  <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>
               </button>
            </div>

            {adminMode === 'wallet' ? (
              <div className="admin-info-box">
                <div style={{ color: 'var(--primary-adm)', marginTop: 2 }}>{metamaskFox}</div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-main)' }}>MetaMask Authentication</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {lang === 'vi' ? 'Hệ thống sẽ đối chiếu địa chỉ ví với Smart Contract trên mạng lưới.' : 'System will cross-reference your wallet with the Smart Contract.'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteLogin}>
                <div className="input-group">
                  <label className="input-label">{t('login.inviteLabel')}</label>
                  <div className="input-wrapper">
                    <input
                      className="saas-input" type="text" value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      placeholder="XXXX-XXXX-XXXX" required autoFocus
                      style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: 1 }}
                    />
                    <div className="input-icon">{inviteIcon}</div>
                  </div>
                </div>
              </form>
            )}

            <button 
              type="button" 
              className="saas-submit-btn" 
              onClick={adminMode === 'wallet' ? handleWalletLogin : handleInviteLogin}
              disabled={loading || walletConnecting || generatingSecret || (adminMode === 'invite' && !inviteToken)}
            >
              {walletConnecting || generatingSecret || loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="spinner" /> 
                  <span>{generatingSecret ? t('login.generatingSecret') : walletSigning ? t('login.signing') : t('login.connecting')}</span>
                </div>
              ) : (
                <>{adminMode === 'wallet' ? (lang === 'vi' ? 'Kết nối Ví MetaMask' : 'Connect MetaMask') : (lang === 'vi' ? 'Xác thực Mã Mời' : 'Verify Invite Code')} {arrowRightIcon}</>
              )}
            </button>

            {adminMode === 'wallet' && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button type="button" className="text-link" style={{ color: '#ef4444' }} onClick={() => navigate('/recovery')}>
                  {lang === 'vi' ? 'Mất quyền truy cập ví? Khôi phục ngay' : 'Lost wallet access? Recover now'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Secret Code Modal */}
      {showSecretModal && secretCode && (
        <SecretCodeModal
          secret={secretCode}
          onConfirm={handleSecretConfirm}
        />
      )}
    </div>
  );
}