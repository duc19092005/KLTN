import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'));
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));

  useEffect(() => {
    const verifySession = async () => {
      try {
        const response = await api.get('/auth/me');
        const userData = response.data.user;
        const tokenValue = localStorage.getItem('token') || 'cookie_present';
        setToken(tokenValue);
        setUser(userData);
        localStorage.setItem('token', tokenValue);
        localStorage.setItem('user', JSON.stringify(userData));
      } catch {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    if (token) verifySession();
    else setLoading(false);
  }, []);

  const persistSession = (accessToken, userData) => {
    const tokenValue = accessToken || 'cookie_present';
    setToken(tokenValue);
    setUser(userData);
    localStorage.setItem('token', tokenValue);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const loginWithWallet = async (walletAddress, signature, message) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/wallet-login', { walletAddress, signature, message });
      persistSession(response.data.access_token, { ...response.data.user, firstLogin: false });
      return { success: true, user: response.data.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Wallet login failed' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithInvite = async (inviteToken) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/invite-login', { inviteToken });
      persistSession(response.data.access_token, { ...response.data.user, firstLogin: true });
      return { success: true, user: response.data.user };
    } catch (err) {
      return { success: false, error: err.response?.data?.message || 'Invalid invite token' };
    } finally {
      setLoading(false);
    }
  };

  const updateToken = (newToken, userData = null) => {
    const tokenValue = newToken || 'cookie_present';
    const nextUser = userData ? { ...user, ...userData } : user;
    setToken(tokenValue);
    setUser(nextUser);
    localStorage.setItem('token', tokenValue);
    if (nextUser) localStorage.setItem('user', JSON.stringify(nextUser));
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, loginWithWallet, loginWithInvite, logout, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
