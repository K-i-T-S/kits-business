import { lazy, Suspense, useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './context/AppContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { WCAGComplianceProvider } from './providers/WCAGComplianceProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';
import { MobileNavigation } from './components/MobileNavigation';
import EnhancedKeyboardNavigation from './components/EnhancedKeyboardNavigation';
import AccessibilityAudit from './components/AccessibilityAudit';
import ScreenReaderOptimizer from './components/ScreenReaderOptimizer';
import HighContrastMode, { ColorBlindnessFilters } from './components/HighContrastMode';
import { useApp } from './context/AppContext';
import './index.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const POS = lazy(() => import('./pages/POS'));
const Customers = lazy(() => import('./pages/Customers'));
const Employees = lazy(() => import('./pages/Employees'));
const Reports = lazy(() => import('./pages/Reports'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const SystemSettings = lazy(() => import('./pages/SystemSettings'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const HelpSupport = lazy(() => import('./pages/HelpSupport'));

// Advanced Inventory Management Components
const BatchTracking = lazy(() => import('./components/BatchTracking'));
const SupplierManagement = lazy(() => import('./components/SupplierManagement'));
const PurchaseOrderManagement = lazy(() => import('./components/PurchaseOrderManagement'));
const StockTransferManagement = lazy(() => import('./components/StockTransferManagement'));
const ReorderPointManagement = lazy(() => import('./components/ReorderPointManagement'));

// Heavy Analytics and Reporting Components
const AdvancedAnalytics = lazy(() => import('./components/AdvancedAnalytics'));
const ReportBuilder = lazy(() => import('./components/ReportBuilder'));
const Forecasting = lazy(() => import('./components/Forecasting'));

// Heavy Modal Components
const EnhancedImportInventoryModal = lazy(() => import('./components/EnhancedImportInventoryModal'));
const EnhancedPOS = lazy(() => import('./components/EnhancedPOS'));
const PromotionManagementModal = lazy(() => import('./components/PromotionManagementModal'));

// CRM Components
const CRMAnalytics = lazy(() => import('./components/crm/CRMAnalytics'));
const CustomerSegmentation = lazy(() => import('./components/crm/CustomerSegmentation'));
const AutomatedMarketing = lazy(() => import('./components/crm/AutomatedMarketing'));
const MarketingCampaigns = lazy(() => import('./components/crm/MarketingCampaigns'));

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize Sentry in production
    if (process.env.NODE_ENV === 'production' && import.meta.env.VITE_SENTRY_DSN) {
      sentryService.initialize({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        environment: import.meta.env.MODE || 'production',
        release: import.meta.env.VITE_APP_VERSION || '1.0.0',
        tracesSampleRate: 0.1,
      });
    }

    // Check for existing session
    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      
      // Update Sentry user context
      if (session?.user) {
        sentryService.setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.name || session.user.email,
        });
      } else {
        sentryService.setUser(null);
      }
    });

    return () => subscription.unsubscribe();
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
    return <LoadingSpinner />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/reports"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><Reports /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/profile-settings"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><ProfileSettings /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/system-settings"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><SystemSettings /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/activity-log"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><ActivityLog /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/help-support"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><HelpSupport /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route
                      path="*"
                      element={
                        isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
                      }
                    />
                  </Routes>
                </Suspense>
                <PWAInstallPrompt />
                <OfflineIndicator />
                <MobileNavigation />
                <KeyboardNavigationHelper />
                <AccessibilityAudit />
                <Toaster />
                <SpeedInsights />
              </div>
            </AccessibilityProvider>
          </LanguageProvider>
        </QueryProvider>
      </AppProvider>
    </Router>
    </ErrorBoundary>
  );
}
