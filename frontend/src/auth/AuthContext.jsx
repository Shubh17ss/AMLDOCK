import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  fetchMe, logout as apiLogout,
  requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp,
  adminLogin as apiAdminLogin, adminVerify as apiAdminVerify,
} from '../api/auth.js';
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

  const adoptSession = useCallback((me) => {
    setUser(me);
    setStatus('authed');
    return me;
  }, []);

  // Email + OTP (non-ROOT): step 1 requests a code, step 2 verifies and starts the session.
  const requestOtp = useCallback((email) => apiRequestOtp(email), []);
  const verifyOtp = useCallback(async (email, code) => adoptSession(await apiVerifyOtp(email, code)), [adoptSession]);

  // ROOT password + OTP: step 1 checks password & sends a code, step 2 verifies it.
  const adminLogin = useCallback((email, password) => apiAdminLogin(email, password), []);
  const adminVerify = useCallback(async (email, code) => adoptSession(await apiAdminVerify(email, code)), [adoptSession]);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    setUser(null);
    setStatus('guest');
  }, []);

  return (
    <AuthContext.Provider value={{
      user, status, logout, refreshMe,
      requestOtp, verifyOtp, adminLogin, adminVerify,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
