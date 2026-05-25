import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout } from '../api/auth.js';
import { setOnUnauthorized } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authed' | 'guest'

  const refreshMe = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      setStatus('authed');
    } catch {
      setUser(null);
      setStatus('guest');
    }
  }, []);

  useEffect(() => {
    refreshMe();
    setOnUnauthorized(() => {
      setUser(null);
      setStatus('guest');
    });
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const me = await apiLogin(email, password);
    setUser(me);
    setStatus('authed');
    return me;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setUser(null);
    setStatus('guest');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
