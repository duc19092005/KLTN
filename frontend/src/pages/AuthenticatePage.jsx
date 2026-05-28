import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import FaceCapture from '../components/FaceCapture';

export default function AuthenticatePage() {
  const navigate = useNavigate();
  const { user, updateSession } = useAuth();
  const isFirstLogin = Boolean(user?.firstLogin || user?.isFirstLogin);
  const [step, setStep] = useState(isFirstLogin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 4);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState('');

  useEffect(() => {
    setStep(isFirstLogin ? Math.min(Math.max(user?.registrationStep || 1, 1), 3) : 4);
  }, [isFirstLogin, user?.registrationStep]);

  const registerFace = async (embedding) => {
    setBusy(true);
    setStatus('Đang lưu face embedding...');
    try {
      await authService.registerFace(embedding);
      updateSession({ registrationStep: 2, hasFace: true });
      setStep(2);
      setStatus('Đã đăng ký khuôn mặt. Tiếp tục kích hoạt ví.');
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const bindWallet = async () => {
    setBusy(true);
    setStatus('Đang ký ví và ghi quyền admin on-chain...');
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask is required to bind an admin wallet.');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletBindChallenge(address);
      const message = challenge.data.message;
      const signature = await signer.signMessage(message);
      const result = await authService.verifyWallet(address, signature, message);
      updateSession(result.data.user || { walletAddress: address, registrationStep: 3 });
      setStep(3);
      setStatus('Ví đã được kích hoạt và authorize trên blockchain.');
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const generateZkpIdentity = async () => {
    setBusy(true);
    setStatus('Đang tạo định danh ZKP...');
    try {
      const result = await authService.generateMfaSecret();
      setSecret(result.data.secret);
      updateSession(result.data.user || { firstLogin: false, registrationStep: 4, verified: true });
      setStatus('Định danh ZKP đã được tạo. Hãy lưu secret khôi phục trước khi vào dashboard.');
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyFaceLogin = async (embedding) => {
    setBusy(true);
    setStatus('Đang xác thực khuôn mặt sau đăng nhập ví...');
    try {
      const result = await authService.verifyFace(embedding);
      updateSession(result.data.user || { verified: true });
      navigate('/admin');
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-card wide-card">
        <p className="eyebrow">{isFirstLogin ? 'Admin identity flow' : 'Admin secure login'}</p>
        <h1>{isFirstLogin ? 'Kích hoạt Admin theo flow KLTN' : 'Xác thực khuôn mặt Admin'}</h1>
        <p className="muted">
          {isFirstLogin
            ? 'Invite → Face liveness → Wallet on-chain → Recovery secret → Wallet login + Face.'
            : 'Bạn đã đăng nhập ví thành công. Hoàn tất kiểm tra liveness để mở quyền quản trị.'}
        </p>

        {isFirstLogin && (
          <div className="setup-steps">
            {['Tạo face', 'Ví kết nối', 'Tạo định danh ZKP', 'Hoàn tất'].map((name, index) => (
              <span key={name} className={step >= index + 1 ? 'active' : ''}>{index + 1}. {name}</span>
            ))}
          </div>
        )}

        {isFirstLogin && step === 1 && (
          <FaceCapture onCapture={registerFace} disabled={busy} label="Lưu khuôn mặt Admin" />
        )}

        {isFirstLogin && step === 2 && (
          <div className="wallet-panel">
            <button id="bind-wallet-button" className="primary-button" onClick={bindWallet} disabled={busy}>
              Kết nối MetaMask và kích hoạt ví
            </button>
          </div>
        )}

        {isFirstLogin && step === 3 && (
          <button id="generate-zkp-button" className="primary-button" onClick={generateZkpIdentity} disabled={busy}>
            Tạo định danh ZKP
          </button>
        )}

        {secret && (
          <div className="secret-box">
            <p>Lưu secret khôi phục này:</p>
            <code>{secret}</code>
            <button className="primary-button" onClick={() => navigate('/admin')}>Tôi đã lưu, vào Admin</button>
          </div>
        )}

        {!isFirstLogin && <FaceCapture onCapture={verifyFaceLogin} disabled={busy} label="Xác thực khuôn mặt" />}

        {status && <div className="status-box">{status}</div>}
      </section>
    </main>
  );
}
