import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import AccessibilityAudit from './components/AccessibilityAudit';
import { ErrorBoundary } from './components/ErrorBoundary';
import KeyboardNavigationHelper from './components/KeyboardNavigationHelper';
import { LoadingSpinner } from './components/LoadingSpinner';
import { MobileNavigation } from './components/MobileNavigation';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { Toaster } from './components/ui/sonner';
import { AppProvider } from './context/AppContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { LanguageProvider } from './context/LanguageContext';
import Login from './pages/Login';
import TenantSelection from './pages/TenantSelection';
import { QueryProvider } from './providers/QueryProvider';
import { TranslationProvider } from './context/TranslationContext';
import { AccessibilityProvider } from './providers/AccessibilityProvider';
import { sentryService } from './services/sentryService';
import { supabase } from './utils/supabaseClient';
import './i18n';
import './styles/rtl.css';
import { TranslationManager } from './components/TranslationManager';

const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
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
const MonitoringDashboard = lazy(() => import('./components/monitoring/MonitoringDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));

// Mobile components wrapper that needs access to Router context
function MobileComponents({ isAuthenticated, loading }: { isAuthenticated: boolean; loading: boolean }) {
  const location = useLocation();

  // Only show mobile components after authentication and loading is complete, and not on login/tenant-selection pages
  if (!loading && isAuthenticated && !['/login', '/tenant-selection', '/accept-invite'].includes(location.pathname)) {
    return (
      <>
        <PWAInstallPrompt />
        <OfflineIndicator />
        <MobileNavigation />
      </>
    );
  }

  return null;
}

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
          <SubscriptionProvider>
          <QueryProvider>
            <LanguageProvider>
              <TranslationProvider>
                <AccessibilityProvider>
                  <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                    <Suspense fallback={<LoadingSpinner />}>
                      <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/tenant-selection" element={<TenantSelection />} />
                        <Route path="/accept-invite" element={<AcceptInvite />} />
                        <Route
                          path="/dashboard"
                          element={
                            isAuthenticated ?
                              <Dashboard /> :
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
                          path="/inventory"
                          element={
                            isAuthenticated ?
                              <Inventory /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/inventory/batch-tracking"
                          element={
                            isAuthenticated ?
                              <BatchTracking /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/inventory/suppliers"
                          element={
                            isAuthenticated ?
                              <SupplierManagement /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/inventory/purchase-orders"
                          element={
                            isAuthenticated ?
                              <PurchaseOrderManagement /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/inventory/stock-transfers"
                          element={
                            isAuthenticated ?
                              <StockTransferManagement /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/inventory/reorder-points"
                          element={
                            isAuthenticated ?
                              <ReorderPointManagement /> :
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
                        <Route
                          path="/profile-settings"
                          element={
                            isAuthenticated ?
                              <ProfileSettings /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/system-settings"
                          element={
                            isAuthenticated ?
                              <SystemSettings /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/activity-log"
                          element={
                            isAuthenticated ?
                              <ActivityLog /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/help-support"
                          element={
                            isAuthenticated ?
                              <HelpSupport /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/translation-manager"
                          element={
                            isAuthenticated ?
                              <TranslationManager /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/enterprise"
                          element={
                            isAuthenticated ?
                              <EnterpriseDashboard /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/enterprise/roles"
                          element={
                            isAuthenticated ?
                              <RolesAndPermissionsManager /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/enterprise/workflows"
                          element={
                            isAuthenticated ?
                              <WorkflowAutomation /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/enterprise/locations"
                          element={
                            isAuthenticated ?
                              <MultiLocationSupport /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/enterprise/api"
                          element={
                            isAuthenticated ?
                              <ApiAndWebhooks /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route path="/" element={<Navigate to="/login" replace />} />
                        <Route
                          path="/monitoring"
                          element={
                            isAuthenticated ?
                              <MonitoringDashboard /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="/admin"
                          element={
                            isAuthenticated ?
                              <AdminPanel /> :
                              <Navigate to="/login" replace />
                          }
                        />
                        <Route
                          path="*"
                          element={
                            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
                          }
                        />
                      </Routes>
                    </Suspense>

                    {/* Mobile components wrapper inside Router context */}
                    <MobileComponents isAuthenticated={isAuthenticated} loading={loading} />

                    <KeyboardNavigationHelper />
                    <AccessibilityAudit />
                    <Toaster />
                    <SpeedInsights />
                    <Analytics />
                  </div>
                </AccessibilityProvider>
              </TranslationProvider>
            </LanguageProvider>
          </QueryProvider>
          </SubscriptionProvider>
        </AppProvider>
      </Router>
    </ErrorBoundary>
  );
};
