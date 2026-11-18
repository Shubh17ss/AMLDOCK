import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  fetchMe, logout as apiLogout, switchEntity as apiSwitchEntity,
  requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp,
  adminLogin as apiAdminLogin, adminVerify as apiAdminVerify,
} from '../api/auth.js';
import { setOnUnauthorized } from '../api/client.js';
import { clearSavedScope } from '../dashboard/scopeStorage.js';
import { DASHBOARD_PATH } from '../navigation/moduleRegistry.jsx';

const AuthContext = createContext(null);

// Written when this tab moves the session into another reporting entity. The session lives in
// cookies, which every tab shares, so the other tabs are now authorised for the new entity while
// still showing the old one — they hear this and start over on the dashboard.
const ENTITY_SWITCH_KEY = 'amldock.entitySwitch';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'authed' | 'guest'
  // Cached API responses belong to whoever fetched them. Query keys carry no user, so the cache
  // is emptied whenever the session ends or a new one starts; otherwise the next person to sign
  // in on this tab could be shown the previous user's firm data while their own loads (NV-09).
  const queryClient = useQueryClient();

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
      queryClient.clear();
      setUser(null);
      setStatus('guest');
    });
  }, [refreshMe, queryClient]);

  // Another tab switched entity. A full load rather than an in-place update: every screen in this
  // tab was built for the old entity, and a reload is the one way to be sure none of it survives.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === ENTITY_SWITCH_KEY && e.newValue) window.location.assign(DASHBOARD_PATH);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Takes an AuthResponse the caller already has and makes it the current session.
   *
   * Exported alongside `refreshMe` because several endpoints hand back the same shape `/auth/me`
   * would — signing in, and now editing your own profile. Re-fetching after those would be asking
   * the server to repeat what it just said.
   */
  const adoptSession = useCallback((me) => {
    setUser(me);
    setStatus('authed');
    return me;
  }, []);

  // Email + OTP (non-ROOT): step 1 requests a code, step 2 verifies and starts the session.
  const requestOtp = useCallback((email) => apiRequestOtp(email), []);
  const verifyOtp = useCallback(async (email, code) => {
    const me = await apiVerifyOtp(email, code);
    queryClient.clear();
    return adoptSession(me);
  }, [adoptSession, queryClient]);

  // ROOT password + OTP: step 1 checks password & sends a code, step 2 verifies it.
  const adminLogin = useCallback((email, password) => apiAdminLogin(email, password), []);
  const adminVerify = useCallback(async (email, code) => {
    const me = await apiAdminVerify(email, code);
    queryClient.clear();
    return adoptSession(me);
  }, [adoptSession, queryClient]);

  /**
   * Moves the session into another reporting entity the user belongs to (`user.memberships`).
   * Everything cached was fetched as a member of the old one, so the cache goes; where to go next
   * is the caller's — ScopeSelector sends the user to the dashboard.
   */
  const switchEntity = useCallback(async (membershipId) => {
    const me = await apiSwitchEntity(membershipId);
    queryClient.clear();
    try { localStorage.setItem(ENTITY_SWITCH_KEY, `${membershipId}:${Date.now()}`); } catch { /* ignore */ }
    return adoptSession(me);
  }, [adoptSession, queryClient]);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore */ }
    // The saved dashboard scope is keyed by userId, and ids are reused: a reseeded database
    // hands id 1 to a different person, who would otherwise inherit this selection. Signing out
    // is not the only defence; DashboardScope also refreshes a saved scope's names from the API.
    clearSavedScope(user);
    queryClient.clear();
    setUser(null);
    setStatus('guest');
  }, [user, queryClient]);

  return (
    <AuthContext.Provider value={{
      user, status, logout, refreshMe, adoptSession, switchEntity,
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
