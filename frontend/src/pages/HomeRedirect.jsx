import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { DASHBOARD_PATH } from '../navigation/moduleRegistry.jsx';

/**
 * Where "/app" sends you: the dashboard, whatever your role.
 *
 * This is the target of both the post-sign-in navigate and the role-mismatch bounce in
 * ProtectedRoute, so it is the single definition of "home". The rest of the nav chrome — the
 * sidebar logo, the mobile logo, BottomNav — already treats /dashboard as home for every role.
 *
 * A deep link someone was bounced off still wins: the login pages restore
 * location.state.from and only fall back to /app when there isn't one.
 */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={DASHBOARD_PATH} replace />;
}
