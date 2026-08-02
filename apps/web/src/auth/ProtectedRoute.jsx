import { Navigate } from 'react-router';
import { useAuth } from './AuthContext.jsx';
import { LoadingScreen } from '../components/LoadingScreen.jsx';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // Restoring a stored Supabase session is a real network round trip --
  // rendering nothing meanwhile makes a normal page load look broken.
  if (loading) return <LoadingScreen label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
