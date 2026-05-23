import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWallet } from '../contexts/WalletContext';
import FaceCapture from '../components/FaceCapture';
import WalletConnect from '../components/WalletConnect';
import { authService } from '../services/authService';
import { faceApiService } from '../services/zkpService';
import { zkpService } from '../services/zkpService';
import api from '../services/api';

export default function RegisterPage() {
  const { user, token, updateToken } = useAuth();
  const { address, registerIdentity, connectMock, disconnect } = useWallet();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'ADMIN';
  const isDoctor = user?.role === 'DOCTOR';

  // Admin: 3 steps (Face → Wallet → ZKP)
  // Doctor: 4 steps (Password → Face → Wallet → ZKP)
  const getInitialStep = () => {
    const regStep = user?.registrationStep || 1;
    if (isAdmin) {
      // Admin skips password step. Map: regStep 1→1(face), 2→2(wallet), 3→3(zkp), 4→4(done)
      return regStep;
    }
    return regStep; // Doctor: 1=password, 2=face, 3=done
  };

  const [step, setStep] = useState(getInitialStep());
  const [passwords, setPasswords] = useState({ old: '', new: '', confirm: '' });
  const [faceEmbedding, setFaceEmbedding] = useState(null);
  const [zkpSecret, setZkpSecret] = useState('');
  const [customWallet, setCustomWallet] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ============================================================
  // SHARED: Navigate to dashboard after registration complete
  // Ensures firstLogin is cleared in DB before redirecting.
  // This also fixes existing accounts whose DB still has firstLogin:true.
  // ============================================================
  const handleGoToDashboard = async () => {
    if (isDoctor && user?.firstLogin) {
      // Call /zkp/complete to set firstLogin=false in DB for this account.
      // Safe to call multiple times (idempotent update).
      try {
        await zkpService.completeRegistration();
      } catch (e) {
        console.warn('completeRegistration during navigation failed, proceeding anyway:', e.message);
      }
      updateToken(token, { firstLogin: false });
    }
    navigate('/dashboard');
  };

  // ============================================================
  // Step definitions differ by role
  // ============================================================
  const adminSteps = [
    { num: 1, label: 'Face Scan', icon: '' },
    { num: 2, label: 'Connect Wallet', icon: '' },
    { num: 3, label: 'ZKP Identity', icon: '' },
    { num: 4, label: 'Complete', icon: '' },
  ];

  const doctorSteps = [
    { num: 1, label: 'Change Password', icon: '' },
    { num: 2, label: 'Face Scan', icon: '' },
    { num: 3, label: 'Complete', icon: '' },
  ];

  const steps = isAdmin ? adminSteps : doctorSteps;
  const doneStep = isAdmin ? 4 : 3;

  // ============================================================
  // DOCTOR ONLY: Change Password (Step 1)
  // ============================================================
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.changePassword(passwords.old, passwords.new);
      updateToken(token, { registrationStep: 2 });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // SHARED: Face Scan
  // Admin: Step 1 | Doctor: Step 2
  // ============================================================
  const faceStep = isAdmin ? 1 : 2;
  const handleFaceCapture = async (embedding) => {
    setLoading(true);
    setError('');
    try {
      await faceApiService.registerFace(embedding);
      setFaceEmbedding(embedding);
      const nextStep = isAdmin ? 2 : 3; // Admin goes to Wallet (2), Doctor goes to Complete (3)

      if (isDoctor) {
        // Doctor registration is complete after face scan.
        // Call /zkp/complete to set firstLogin=false in the database,
        // then update local state so the ProtectedRoute no longer blocks navigation.
        try {
          await zkpService.completeRegistration();
        } catch (completeErr) {
          console.warn('completeRegistration call failed, proceeding anyway:', completeErr.message);
        }
        updateToken(token, { firstLogin: false, registrationStep: nextStep });
      } else {
        updateToken(token, { registrationStep: nextStep });
      }

      setStep(nextStep);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register face');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ADMIN ONLY: Wallet Connect
  // Admin: Step 2
  // ============================================================
  const walletStep = 2;
  const handleWalletConnected = async (addr, isMockSelection = false) => {
    setLoading(true);
    setError('');
    try {
      if (isMockSelection) {
        connectMock(addr);
      }
      try {
        await api.post('/zkp/update-wallet', { newAddress: addr });
      } catch (walletErr) {
        console.warn('Failed to update wallet in backend, continuing:', walletErr.message);
      }
      const nextStep = 3; // Admin goes to ZKP step
      updateToken(token, { registrationStep: nextStep });
      setStep(nextStep);
    } catch (err) {
      setError('Failed to save wallet address');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ADMIN ONLY: ZKP Register
  // Admin: Step 3
  // ============================================================
  const zkpStep = 3;
  const handleZkpRegister = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await zkpService.registerIdentity();
      if (!res || !res.data) {
        throw new Error('Backend returned empty response for ZKP registration');
      }
      if (res.data.error) {
        throw new Error(res.data.error);
      }
      const { secret, commitment } = res.data;
      if (!commitment) {
        throw new Error('No commitment returned from backend. Ensure face registration was completed.');
      }
      setZkpSecret(secret);

      if (!address) {
        throw new Error('Please connect your wallet in the previous step first');
      }

      await registerIdentity(commitment);
      await zkpService.completeRegistration();

      updateToken(token, { firstLogin: false, registrationStep: 4 });
      setStep(4);
    } catch (err) {
      console.error('[ZKP Register Error]', err);
      setError(err.response?.data?.message || err.message || 'Failed to register ZKP identity');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // Rollback
  // ============================================================
  const handleRollback = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/users/rollback', { currentStep: step });
      const nextStep = res.data.registrationStep;
      updateToken(token, { registrationStep: nextStep });

      if (step === walletStep) {
        setCustomWallet('');
        disconnect();
      }

      setStep(nextStep);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to rollback step');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container fade-in" style={{ maxWidth: 700, padding: '40px 24px' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>
        {isAdmin ? 'Admin Identity Registration' : 'Identity Registration'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 32 }}>
        {isAdmin
          ? 'Complete all steps to activate wallet-based + ZKP security (no password needed)'
          : 'Complete all steps to activate your multi-layer security'
        }
      </p>

      {/* Step Indicator */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 40,
        flexWrap: 'wrap',
      }}>
        {steps.map(s => (
          <div key={s.num} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px',
            borderRadius: 'var(--radius-sm)',
            background: step === s.num ? 'rgba(99, 102, 241, 0.15)' : step > s.num ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-card)',
            border: `1px solid ${step === s.num ? 'var(--primary)' : step > s.num ? 'var(--success)' : 'var(--border)'}`,
            fontSize: '0.8rem', fontWeight: 500,
            color: step >= s.num ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {s.icon} {s.label}
          </div>
        ))}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ======== DOCTOR ONLY: Step 1 Change Password ======== */}
      {isDoctor && step === 1 && (
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 20 }}>Change Your Temporary Password</h2>
          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current (Temporary) Password</label>
              <input className="form-input" type="password" value={passwords.old}
                onChange={e => setPasswords({ ...passwords, old: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={passwords.new}
                onChange={e => setPasswords({ ...passwords, new: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm New Password</label>
              <input className="form-input" type="password" value={passwords.confirm}
                onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} required />
            </div>
            <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password & Continue →'}
            </button>
          </form>
        </div>
      )}

      {/* ======== SHARED: Face Scan ======== */}
      {step === faceStep && (
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 20 }}>Xác thực khuôn mặt người thật</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            Hệ thống sẽ yêu cầu bạn quay đầu theo các hướng để xác minh bạn là người thật.
            Face embedding sẽ được dùng cho xác thực sinh trắc học và ZKP identity.
          </p>
          <FaceCapture onCapture={handleFaceCapture} onError={msg => setError(msg)} requireLiveness={true} />
          {/* Admin step 1 has no rollback, Doctor step 2 rolls back to step 1 */}
          {isDoctor && (
            <button
              className="btn btn-secondary btn-full"
              type="button"
              onClick={handleRollback}
              disabled={loading}
              style={{ marginTop: 16, border: '1px dashed var(--border)' }}
            >
              ← Quay lại bước trước (Đổi mật khẩu)
            </button>
          )}
        </div>
      )}

      {/* ======== ADMIN ONLY: Wallet Connect ======== */}
      {isAdmin && step === walletStep && (
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 20 }}>Connect Wallet</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            Your wallet will become your primary authentication method. Choose any wallet address you prefer.
          </p>
          <WalletConnect onConnect={handleWalletConnected} />

          {/* Dev/Admin Testing Tools Section */}
          <div style={{
            marginTop: 24, padding: '20px 16px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.1)',
          }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--accent)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              Developer Testing Tools
            </h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              Skip MetaMask connection or select a pre-funded Hardhat account directly:
            </p>

            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Select Pre-funded Account</label>
              <select
                className="form-input"
                style={{ fontSize: '0.85rem' }}
                value={customWallet}
                onChange={(e) => setCustomWallet(e.target.value)}
              >
                <option value="">-- Choose a Hardhat Funded Account --</option>
                <option value="0x70997970C51812dc3A010C7d01b50e0d17dc79C8">Account #1 (10,000 ETH): 0x7099...79C8</option>
                <option value="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC">Account #2 (10,000 ETH): 0x3C44...93BC</option>
                <option value="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266">Account #0 (10,000 ETH): 0xf39F...2266</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Or Enter Custom Wallet Address</label>
              <input
                className="form-input"
                type="text"
                placeholder="0x..."
                value={customWallet}
                onChange={(e) => setCustomWallet(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>

            <button
              className="btn btn-secondary btn-full"
              type="button"
              disabled={!customWallet || loading}
              onClick={() => handleWalletConnected(customWallet, true)}
              style={{ fontSize: '0.85rem', fontWeight: 600 }}
            >
              Confirm Selected Wallet Address
            </button>
          </div>

          <button
            className="btn btn-secondary btn-full"
            type="button"
            onClick={handleRollback}
            disabled={loading}
            style={{ marginTop: 16, border: '1px dashed var(--border)' }}
          >
            ← Quay lại bước trước (Quét khuôn mặt)
          </button>
        </div>
      )}

      {/* ======== ADMIN ONLY: ZKP Identity ======== */}
      {isAdmin && step === zkpStep && (
        <div className="card" style={{ padding: 32 }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: 20 }}>Generate ZKP Identity</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.9rem' }}>
            A cryptographic commitment will be created from your secret and face data, then stored on the blockchain.
            This is the final step of your passwordless identity setup.
          </p>

          {/* Wallet info */}
          <div style={{ marginBottom: 20, padding: '16px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: 8, border: '1px solid rgba(99, 102, 241, 0.1)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              Ví xác nhận giao dịch (Transaction Signer):
            </div>
            <div style={{ fontFamily: 'monospace', color: 'var(--success)', fontSize: '0.95rem', fontWeight: 600 }}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Chưa có ví nào đang kết nối'}
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: 12, color: 'var(--warning)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span>Nếu MetaMask bật lên yêu cầu ký với một ví khác, hãy <b>từ chối (Reject)</b> và chọn đúng ví này trong bảng điều khiển của Extension MetaMask trước khi thử lại!</span>
            </div>
          </div>

          <button className="btn btn-primary btn-lg btn-full" onClick={handleZkpRegister} disabled={loading || !address}>
            {loading ? 'Generating...' : 'Generate ZKP Identity'}
          </button>
          <button
            className="btn btn-secondary btn-full"
            type="button"
            onClick={handleRollback}
            disabled={loading}
            style={{ marginTop: 16, border: '1px dashed var(--border)' }}
          >
            ← Quay lại bước trước (Kết nối ví)
          </button>
        </div>
      )}

      {/* ======== SHARED: Done ======== */}
      {step === doneStep && (
        <div className="card" style={{ padding: 32, textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: 16 }}>
            {isAdmin ? 'Thiết lập tài khoản Admin hoàn tất!' : 'Đăng ký hoàn tất!'}
          </h2>

          <div className="alert alert-info" style={{ textAlign: 'left' }}>
            {isAdmin ? (
              <>
                <strong>Danh tính ZKP đã được đăng ký trên blockchain.</strong>
                <p style={{ fontSize: '0.85rem', marginTop: 8, color: 'var(--text-secondary)' }}>
                  Từ giờ bạn đăng nhập bằng <b>Connect Wallet</b> + <b>Face Scan</b>. 
                  Không cần username/password nữa!
                </p>
                <p style={{ fontSize: '0.85rem', marginTop: 8, color: 'var(--text-secondary)' }}>
                  Mã bí mật đã được cung cấp khi bạn đăng nhập lần đầu. 
                  Hãy đảm bảo bạn đã lưu mã đó để khôi phục tài khoản khi cần.
                </p>
              </>
            ) : (
              <strong>Bạn đã hoàn tất cập nhật mật khẩu và khuôn mặt. Từ giờ hãy sử dụng mật khẩu mới này để đăng nhập.</strong>
            )}
          </div>

          <button className="btn btn-primary btn-lg" onClick={handleGoToDashboard} style={{ marginTop: 16 }}>
            Vào Dashboard →
          </button>
        </div>
      )}
    </div>
  );
}
