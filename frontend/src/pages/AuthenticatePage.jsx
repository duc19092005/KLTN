import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import FaceCapture from '../components/FaceCapture';

const HARDHAT_ACCOUNTS = [
  '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
];

export default function AuthenticatePage() {
  const navigate = useNavigate();
  const { user, token, updateToken } = useAuth();
  const isFirstLogin = Boolean(user?.firstLogin || user?.isFirstLogin);
  const [step, setStep] = useState(isFirstLogin ? 1 : 4);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [customWallet, setCustomWallet] = useState(HARDHAT_ACCOUNTS[0]);
  const [secret, setSecret] = useState('');

  const registerFace = async (embedding) => {
    setBusy(true);
    setStatus('Đang lưu face embedding...');
    try {
      await authService.registerFace(embedding);
      updateToken(token, { registrationStep: 2, hasFace: true });
      setStep(2);
      setStatus('Đã đăng ký khuôn mặt. Tiếp tục kích hoạt ví.');
    } catch (err) {
      setStatus(err.response?.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  };

  const bindWallet = async (mockAddress) => {
    setBusy(true);
    setStatus('Đang ký ví và ghi quyền admin on-chain...');
    try {
      let address = mockAddress;
      let signature;
      let message;

      if (window.ethereum && !mockAddress) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        address = await signer.getAddress();
        message = `Bind admin wallet: ${address}`;
        signature = await signer.signMessage(message);
      } else {
        const wallet = ethers.Wallet.createRandom();
        address = mockAddress || wallet.address;
        message = `Bind admin wallet: ${address}`;
        signature = await wallet.signMessage(message);
        address = wallet.address;
      }

      const result = await authService.verifyWallet(address, signature, message);
      updateToken(result.data.access_token, { walletAddress: address, registrationStep: 3 });
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
      updateToken(token, { firstLogin: false, registrationStep: 4 });
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
      updateToken(result.data.access_token, { verified: true });
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
            <button id="bind-wallet-button" className="primary-button" onClick={() => bindWallet()} disabled={busy}>
              Kết nối MetaMask và kích hoạt ví
            </button>
            <label>Hoặc ví Hardhat để test</label>
            <select value={customWallet} onChange={(e) => setCustomWallet(e.target.value)}>
              {HARDHAT_ACCOUNTS.map((account) => <option key={account} value={account}>{account}</option>)}
            </select>
            <button className="secondary-button" onClick={() => bindWallet(customWallet)} disabled={busy}>
              Dùng ví test đã chọn
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
