import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { navProfileFor } from '../auth/roles.js';

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (navProfileFor(user.role)) {
    case 'agent': return <Navigate to="/my-deals" replace />;
    case 'salesManager': return <Navigate to="/firm/deals" replace />;
    case 'firmReviewer': return <Navigate to="/cdd/deals" replace />;
    case 'root': return <Navigate to="/settings/users" replace />;
    default: return <Navigate to="/profile" replace />;
  }
}
