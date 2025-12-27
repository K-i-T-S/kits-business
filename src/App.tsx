import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense, useState, useEffect } from 'react';
import { LoadingSpinner } from './components/LoadingSpinner';
import Login from './pages/Login';
import TenantSelection from './pages/TenantSelection';
import { AppProvider } from './context/AppContext';
import { QueryProvider } from './providers/QueryProvider';
import { LanguageProvider } from './contexts/LanguageContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { AccessibilityProvider } from './providers/AccessibilityProvider';
import { supabase } from './utils/supabaseClient';
import { Toaster } from './components/ui/sonner';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { sentryService } from './services/sentryService';
import './i18n';
import './styles/rtl.css';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileNavigation } from './components/MobileNavigation';
import KeyboardNavigationHelper from './components/KeyboardNavigationHelper';
import AccessibilityAudit from './components/AccessibilityAudit';
import { TranslationManager } from './components/TranslationManager';

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

// Enterprise Components
const EnterpriseDashboard = lazy(() => import('./components/enterprise/EnterpriseDashboard'));
const RolesAndPermissionsManager = lazy(() => import('./components/enterprise/RolesAndPermissionsManager'));
const WorkflowAutomation = lazy(() => import('./components/enterprise/WorkflowAutomation'));
const MultiLocationSupport = lazy(() => import('./components/enterprise/MultiLocationSupport'));
const ApiAndWebhooks = lazy(() => import('./components/enterprise/ApiAndWebhooks'));

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
    <ErrorBoundary>
      <Router>
        <AppProvider>
          <QueryProvider>
            <LanguageProvider>
              <TranslationProvider>
                <AccessibilityProvider>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                  <Suspense fallback={<LoadingSpinner />}>
                    <Routes>
                    <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
                    <Route path="/tenant-selection" element={<TenantSelection />} />
                    <Route
                      path="/dashboard"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><Dashboard /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/pos"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><POS /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/inventory"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><Inventory /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/inventory/batch-tracking"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><BatchTracking /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route 
                      path="/inventory/suppliers" 
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><SupplierManagement /></div> : 
                        <Navigate to="/login" replace />
                      } 
                    />
                    <Route 
                      path="/inventory/purchase-orders" 
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><PurchaseOrderManagement /></div> : 
                        <Navigate to="/login" replace />
                      } 
                    />
                    <Route 
                      path="/inventory/stock-transfers" 
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><StockTransferManagement /></div> : 
                        <Navigate to="/login" replace />
                      } 
                    />
                    <Route 
                      path="/inventory/reorder-points" 
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><ReorderPointManagement /></div> : 
                        <Navigate to="/login" replace />
                      } 
                    />
                    <Route
                      path="/customers"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><Customers /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/employees"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><Employees /></div> : 
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
                    <Route
                      path="/translation-manager"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><TranslationManager /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/enterprise"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><EnterpriseDashboard /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/enterprise/roles"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><RolesAndPermissionsManager /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/enterprise/workflows"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><WorkflowAutomation /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/enterprise/locations"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><MultiLocationSupport /></div> : 
                        <Navigate to="/login" replace />
                      }
                    />
                    <Route
                      path="/enterprise/api"
                      element={
                        isAuthenticated ? 
                        <div className="mobile-content"><ApiAndWebhooks /></div> : 
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
          </TranslationProvider>
        </LanguageProvider>
      </QueryProvider>
    </AppProvider>
  </Router>
    </ErrorBoundary>
  );
};
