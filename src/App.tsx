import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import POS from './pages/POS';
import Customers from './pages/Customers';
import Employees from './pages/Employees';
import Reports from './pages/Reports';
import { AppProvider } from './context/AppContext';
import { supabase } from './utils/supabaseClient';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    } catch (error) {
      console.error('Session check error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
              <Navigate to="/dashboard" replace /> : 
              <Login onLogin={() => setIsAuthenticated(true)} />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              isAuthenticated ? 
              <Dashboard /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/inventory" 
            element={
              isAuthenticated ? 
              <Inventory /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/pos" 
            element={
              isAuthenticated ? 
              <POS /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/customers" 
            element={
              isAuthenticated ? 
              <Customers /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/employees" 
            element={
              isAuthenticated ? 
              <Employees /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route 
            path="/reports" 
            element={
              isAuthenticated ? 
              <Reports /> : 
              <Navigate to="/login" replace />
            } 
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}