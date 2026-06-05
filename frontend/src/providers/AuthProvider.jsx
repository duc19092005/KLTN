import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../shared/apis/api';

const AuthContext = createContext(null);
const COOKIE_SESSION = 'cookie_session';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((userData) => {
    setToken(COOKIE_SESSION);
    setUser(userData);
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const response = await api.get('/auth/me');
    persistSession(response.data.user);
    return response.data.user;
  }, [persistSession]);

  useEffect(() => {
    let cancelled = false;

    const verifySession = async () => {
      try {
        const response = await api.get('/auth/me');
        if (!cancelled) persistSession(response.data.user);
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    verifySession();
    return () => {
      cancelled = true;
    };
  }, [clearSession, persistSession]);

  const loginWithWallet = async (walletAddress, signature, message) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/wallet-login', { walletAddress, signature, message });
      persistSession({ ...response.data.user, firstLogin: false });
      return { success: true, ...response.data };
    } catch (err) {
      clearSession();
      return { success: false, error: err.response?.data?.message || 'Đăng nhập bằng ví thất bại.' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithInvite = async (inviteToken) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/invite-login', { inviteToken });
      persistSession({ ...response.data.user, firstLogin: true });
      return { success: true, user: response.data.user };
    } catch (err) {
      clearSession();
      return { success: false, error: err.response?.data?.message || 'Mã mời không hợp lệ.' };
    } finally {
      setLoading(false);
    }
  };

  const loginWithPassword = async (username, password) => {
    setLoading(true);
    try {
      const response = await api.post('/auth/staff-login', { username, password });
      persistSession(response.data.user);
      return { success: true, ...response.data };
    } catch (err) {
      clearSession();
      return { success: false, error: err.response?.data?.message || 'Tên đăng nhập hoặc mật khẩu không đúng.' };
    } finally {
      setLoading(false);
    }
  };

  const updateSession = (userData = null) => {
    setToken(COOKIE_SESSION);
    setUser((currentUser) => (userData ? { ...currentUser, ...userData } : currentUser));
  };

  const updateToken = (_newToken, userData = null) => {
    updateSession(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {}
    clearSession();
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        loginWithWallet,
        loginWithInvite,
        loginWithPassword,
        logout,
        updateToken,
        updateSession,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
