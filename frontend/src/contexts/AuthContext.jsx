import { createContext, useContext, useState, useEffect } from 'react';
import { API_URL } from '../utils/constants';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));

  // Verify session on mount
  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await api.get('/auth/me');
        const userData = res.data.user;
        setUser(userData);
        // Keep the existing token if it's a valid JWT, otherwise fallback to 'cookie_present'
        const existingToken = localStorage.getItem('token');
        const tokenToSet = (existingToken && existingToken !== 'cookie_present') ? existingToken : 'cookie_present';
        setToken(tokenToSet);
        localStorage.setItem('token', tokenToSet);
        localStorage.setItem('user', JSON.stringify(userData));
      } catch (err) {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifySession();
    } else {
      setLoading(false);
    }
  }, []);

  // ============================================================
  // DOCTOR: Traditional login with username/password
  // ============================================================
  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { username, password });
      const { user: userData, firstLogin, access_token } = res.data;
      const tokenVal = access_token || 'cookie_present';
      setToken(tokenVal);
      setUser({ ...userData, firstLogin });
      localStorage.setItem('token', tokenVal);
      localStorage.setItem('user', JSON.stringify({ ...userData, firstLogin }));
      return { success: true, firstLogin, user: userData };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ADMIN: Wallet login (no password)
  // ============================================================
  const loginWithWallet = async (walletAddress, signature, message) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/wallet-login', {
        walletAddress,
        signature,
        message,
      });
      const { user: userData, access_token } = res.data;
      const tokenVal = access_token || 'cookie_present';
      setToken(tokenVal);
      setUser({ ...userData, firstLogin: false });
      localStorage.setItem('token', tokenVal);
      localStorage.setItem('user', JSON.stringify({ ...userData, firstLogin: false }));
      return { success: true, user: userData };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Wallet login failed' };
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // ADMIN: First-time login with invite token (no password)
  // ============================================================
  const loginWithInvite = async (inviteToken) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/invite-login', { inviteToken });
      const { user: userData, access_token } = res.data;
      const tokenVal = access_token || 'cookie_present';
      setToken(tokenVal);
      setUser({ ...userData, firstLogin: true });
      localStorage.setItem('token', tokenVal);
      localStorage.setItem('user', JSON.stringify({ ...userData, firstLogin: true }));
      return { success: true, user: userData };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Invalid invite token' };
    } finally {
      setLoading(false);
    }
  };

  const updateToken = (newToken, userData = null) => {
    const tokenVal = newToken || 'cookie_present';
    setToken(tokenVal);
    localStorage.setItem('token', tokenVal);
    if (userData) {
      setUser(prev => {
        const updatedUser = { ...prev, ...userData };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        return updatedUser;
      });
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.warn('Backend logout failed', err);
    }
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('recovery_token');
  };

  return (
    <AuthContext.Provider value={{
      token, user, loading,
      login, loginWithWallet, loginWithInvite,
      logout, updateToken, api
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

