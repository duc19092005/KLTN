import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/authService';

export default function LoginPage() {
  const navigate = useNavigate();
  const { loginWithWallet, loginWithInvite, loading } = useAuth();
  const [mode, setMode] = useState('wallet');
  const [inviteToken, setInviteToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleWalletLogin = async () => {
    setError('');
    if (!window.ethereum) {
      setError('MetaMask is required for admin wallet login.');
      return;
    }

    try {
      setBusy(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const challenge = await authService.walletChallenge(address);
      const signature = await signer.signMessage(challenge.data.message);
      const result = await loginWithWallet(address, signature, challenge.data.message);
      if (!result.success) throw new Error(result.error);
      navigate('/authenticate');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Wallet login failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleInviteLogin = async (event) => {
    event.preventDefault();
    setError('');

    try {
      setBusy(true);
      const result = await loginWithInvite(inviteToken.trim());
      if (!result.success) throw new Error(result.error);
      navigate('/authenticate');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Invite login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Admin access</p>
        <h1>Admin Authentication</h1>
        <p className="muted">
          Bootstrap the first admin from the backend, then use invite onboarding or MetaMask wallet login.
        </p>

        <div className="mode-switch" role="tablist" aria-label="Admin login modes">
          <button
            id="wallet-mode-button"
            type="button"
            className={mode === 'wallet' ? 'active' : ''}
            onClick={() => setMode('wallet')}
          >
            Wallet Login
          </button>
          <button
            id="invite-mode-button"
            type="button"
            className={mode === 'invite' ? 'active' : ''}
            onClick={() => setMode('invite')}
          >
            Invite Setup
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        {mode === 'wallet' ? (
          <button
            id="wallet-login-button"
            className="primary-button"
            type="button"
            onClick={handleWalletLogin}
            disabled={busy || loading}
          >
            {busy ? 'Connecting wallet...' : 'Connect MetaMask and sign challenge'}
          </button>
        ) : (
          <form onSubmit={handleInviteLogin} className="invite-form">
            <label htmlFor="invite-token-input">Admin invite token</label>
            <input
              id="invite-token-input"
              value={inviteToken}
              onChange={(event) => setInviteToken(event.target.value)}
              placeholder="Paste bootstrap invite token"
              autoComplete="one-time-code"
              required
            />
            <button
              id="invite-login-button"
              className="primary-button"
              type="submit"
              disabled={busy || loading || !inviteToken.trim()}
            >
              {busy ? 'Verifying invite...' : 'Verify invite token'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}