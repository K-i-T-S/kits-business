import { useApp } from '../context/AppContext';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentTenant } = useApp();
  
  if (!currentTenant) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

export default ProtectedRoute;
