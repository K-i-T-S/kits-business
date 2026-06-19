import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { supabase } from '../utils/supabaseClient';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(!!data.session);
      setChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!checked) return null;
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default ProtectedRoute;
