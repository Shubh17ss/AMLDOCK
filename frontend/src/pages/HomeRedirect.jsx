import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'BROKER': return <Navigate to="/my-deals" replace />;
    case 'COMPLIANCE':
    case 'MANAGER': return <Navigate to="/queue" replace />;
    case 'FIRM_USER': return <Navigate to="/firm/deals" replace />;
    default: return <Navigate to="/profile" replace />;
  }
}
