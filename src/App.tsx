import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';

import AccessibilityAudit from './components/AccessibilityAudit';
import { ErrorBoundary } from './components/ErrorBoundary';
import FeatureRoute from './components/FeatureRoute';
import KeyboardNavigationHelper from './components/KeyboardNavigationHelper';
import { LoadingSpinner } from './components/LoadingSpinner';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { TranslationManager } from './components/TranslationManager';
import { Toaster } from './components/ui/sonner';
import { AppProvider } from './context/AppContext';
import { IndustryProvider } from './context/IndustryContext';
import { LanguageProvider } from './context/LanguageContext';
import { NotificationProvider } from './context/NotificationContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { ThemeProvider } from './context/ThemeContext';
import { TranslationProvider } from './context/TranslationContext';
import Login from './pages/Login';
import TenantSelection from './pages/TenantSelection';
import { AccessibilityProvider } from './providers/AccessibilityProvider';
import { QueryProvider } from './providers/QueryProvider';
import { sentryService } from './services/sentryService';
import { supabase } from './utils/supabaseClient';
import './i18n';
import './styles/rtl.css';

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

// Advanced Inventory Management Components (growth+: inventory_management)
const BatchTracking = lazy(() => import('./components/BatchTracking'));
const SupplierManagement = lazy(() => import('./components/SupplierManagement'));
const PurchaseOrderManagement = lazy(() => import('./components/PurchaseOrderManagement'));
const StockTransferManagement = lazy(() => import('./components/StockTransferManagement'));
const ReorderPointManagement = lazy(() => import('./components/ReorderPointManagement'));

// Enterprise Components (business+)
const EnterpriseDashboard = lazy(() => import('./components/enterprise/EnterpriseDashboard'));
const RolesAndPermissionsManager = lazy(() => import('./components/enterprise/RolesAndPermissionsManager'));
const WorkflowAutomation = lazy(() => import('./components/enterprise/WorkflowAutomation'));
const MultiLocationSupport = lazy(() => import('./components/enterprise/MultiLocationSupport'));
const ApiAndWebhooks = lazy(() => import('./components/enterprise/ApiAndWebhooks'));
const MonitoringDashboard = lazy(() => import('./components/monitoring/MonitoringDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ForecastingPage = lazy(() => import('./pages/Forecasting'));
const Finance = lazy(() => import('./pages/Finance'));

// Restaurant Vertical Components
const RestaurantHub = lazy(() => import('./pages/restaurant/RestaurantHub'));
const AnalyticsCommandCenter = lazy(() => import('./pages/restaurant/AnalyticsCommandCenter'));
const RestaurantTableManagement = lazy(() => import('./pages/restaurant/TableManagement'));
const RestaurantKDS = lazy(() => import('./pages/restaurant/KitchenDisplay'));
const RestaurantReservations = lazy(() => import('./pages/restaurant/Reservations'));
const RestaurantWaiter = lazy(() => import('./pages/restaurant/WaiterInterface'));
const RestaurantArgile = lazy(() => import('./pages/restaurant/ArgileStation'));
const RestaurantRecipes = lazy(() => import('./pages/restaurant/RecipeInventory'));
const RestaurantAnalytics = lazy(() => import('./pages/restaurant/RestaurantAnalytics'));
const RestaurantShifts = lazy(() => import('./pages/restaurant/ShiftManager'));
const RestaurantEOD = lazy(() => import('./pages/restaurant/EODReport'));
const RestaurantTips = lazy(() => import('./pages/restaurant/TipsManagement'));
const RestaurantMenuManagement = lazy(() => import('./pages/restaurant/MenuManagement'));
const RestaurantBranches = lazy(() => import('./pages/restaurant/MultiBranchHub'));
const RestaurantSettings = lazy(() => import('./pages/restaurant/RestaurantSettings'));
const RestaurantAIAssistant = lazy(() => import('./pages/restaurant/AIAssistant'));
const RestaurantDelivery = lazy(() => import('./pages/restaurant/DeliveryIntegrations'));
const RestaurantCashManagement = lazy(() => import('./pages/restaurant/CashManagement'));
const RestaurantCashDrawer = lazy(() => import('./pages/restaurant/CashDrawer'));
const RestaurantEventsManager = lazy(() => import('./pages/restaurant/EventsManager'));
const QRMenuPage = lazy(() => import('./pages/qr-menu/QRMenuPage'));
const BookReservation = lazy(() => import('./pages/BookReservation'));

// Pharmacy Vertical Components
const PharmacyHub = lazy(() => import('./pages/pharmacy/PharmacyHub'));
const PharmacyDrugDatabase = lazy(() => import('./pages/pharmacy/DrugDatabase'));
const PharmacyPrescriptions = lazy(() => import('./pages/pharmacy/Prescriptions'));
const PharmacyNarcoticsRegister = lazy(() => import('./pages/pharmacy/NarcoticsRegister'));

// Mobile components wrapper that needs access to Router context
function MobileComponents({ isAuthenticated, loading }: { isAuthenticated: boolean; loading: boolean }) {
  const location = useLocation();

  // Only show mobile components after authentication and loading is complete, and not on login/tenant-selection pages
  if (!loading && isAuthenticated && !['/login', '/tenant-selection', '/accept-invite'].includes(location.pathname)) {
    return (
      <>
        <PWAInstallPrompt />
        <OfflineIndicator />
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
    void checkSession();

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
      <ThemeProvider>
        <Router>
          <AppProvider>
            <SubscriptionProvider>
              <IndustryProvider>
                <QueryProvider>
                  <LanguageProvider>
                    <TranslationProvider>
                      <AccessibilityProvider>
                        <NotificationProvider>
                          <div className="min-h-screen" style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}>
                            <Suspense fallback={<LoadingSpinner />}>
                              <Routes>
                                {/* ── Public routes ── */}
                                <Route path="/login" element={<Login />} />
                                <Route path="/tenant-selection" element={<TenantSelection />} />
                                <Route path="/accept-invite" element={<AcceptInvite />} />

                                {/* ── Starter+ routes (all authenticated users) ── */}
                                <Route
                                  path="/dashboard"
                                  element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/pos"
                                  element={isAuthenticated ? <POS /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/reports"
                                  element={isAuthenticated ? <Reports /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/finance"
                                  element={isAuthenticated ? <Finance /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/employees"
                                  element={isAuthenticated ? <Employees /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/profile-settings"
                                  element={isAuthenticated ? <ProfileSettings /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/system-settings"
                                  element={isAuthenticated ? <SystemSettings /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/activity-log"
                                  element={isAuthenticated ? <ActivityLog /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/help-support"
                                  element={isAuthenticated ? <HelpSupport /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/translation-manager"
                                  element={isAuthenticated ? <TranslationManager /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/admin"
                                  element={isAuthenticated ? <AdminPanel /> : <Navigate to="/login" replace />}
                                />

                                {/* ── Growth+ routes (forecasting) ── */}
                                <Route
                                  path="/forecasting"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="forecasting">
                                        <ForecastingPage />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Growth+ routes (inventory_management) ── */}
                                <Route
                                  path="/inventory"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="inventory_management">
                                        <Inventory />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/inventory/batch-tracking"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="inventory_management">
                                        <BatchTracking />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/inventory/suppliers"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="inventory_management">
                                        <SupplierManagement />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/inventory/purchase-orders"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="inventory_management">
                                        <PurchaseOrderManagement />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/inventory/stock-transfers"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="inventory_management">
                                        <StockTransferManagement />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/inventory/reorder-points"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="inventory_management">
                                        <ReorderPointManagement />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Growth+ routes (crm) ── */}
                                <Route
                                  path="/customers"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="crm">
                                        <Customers />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Business+ routes (enterprise_dashboard) ── */}
                                <Route
                                  path="/enterprise"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="enterprise_dashboard">
                                        <EnterpriseDashboard />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/enterprise/roles"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="enterprise_dashboard">
                                        <RolesAndPermissionsManager />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />
                                <Route
                                  path="/enterprise/workflows"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="enterprise_dashboard">
                                        <WorkflowAutomation />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Business+ routes (multi_location) ── */}
                                <Route
                                  path="/enterprise/locations"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="multi_location">
                                        <MultiLocationSupport />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Business+ routes (api_webhooks) ── */}
                                <Route
                                  path="/enterprise/api"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="api_webhooks">
                                        <ApiAndWebhooks />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Business+ routes (monitoring) ── */}
                                <Route
                                  path="/monitoring"
                                  element={
                                    isAuthenticated ? (
                                      <FeatureRoute feature="monitoring">
                                        <MonitoringDashboard />
                                      </FeatureRoute>
                                    ) : (
                                      <Navigate to="/login" replace />
                                    )
                                  }
                                />

                                {/* ── Restaurant Vertical routes ── */}
                                <Route path="/menu/:tenantSlug/:tableId" element={<QRMenuPage />} />
                                <Route path="/book/:tenantSlug" element={<Suspense fallback={<div className="min-h-screen bg-slate-950" />}><BookReservation /></Suspense>} />
                                <Route
                                  path="/restaurant"
                                  element={isAuthenticated ? <RestaurantHub /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/restaurant/analytics"
                                  element={isAuthenticated ? <AnalyticsCommandCenter /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/restaurant/tables"
                                  element={isAuthenticated ? <RestaurantTableManagement /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/restaurant/kds"
                                  element={isAuthenticated ? <RestaurantKDS /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/restaurant/reservations"
                                  element={isAuthenticated ? <RestaurantReservations /> : <Navigate to="/login" replace />}
                                />
                                <Route path="/restaurant/waiter" element={isAuthenticated ? <RestaurantWaiter /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/argile" element={isAuthenticated ? <RestaurantArgile /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/recipes" element={isAuthenticated ? <RestaurantRecipes /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/analytics" element={isAuthenticated ? <RestaurantAnalytics /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/shifts" element={isAuthenticated ? <RestaurantShifts /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/eod" element={isAuthenticated ? <RestaurantEOD /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/tips" element={isAuthenticated ? <RestaurantTips /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/menu" element={isAuthenticated ? <RestaurantMenuManagement /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/branches" element={isAuthenticated ? <RestaurantBranches /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/settings" element={isAuthenticated ? <RestaurantSettings /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/ai" element={isAuthenticated ? <RestaurantAIAssistant /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/delivery" element={isAuthenticated ? <RestaurantDelivery /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/cash" element={isAuthenticated ? <RestaurantCashDrawer /> : <Navigate to="/login" replace />} />
                                <Route path="/restaurant/events" element={isAuthenticated ? <RestaurantEventsManager /> : <Navigate to="/login" replace />} />

                                {/* ── Pharmacy Vertical routes ── */}
                                <Route
                                  path="/pharmacy"
                                  element={isAuthenticated ? <PharmacyHub /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/pharmacy/drugs"
                                  element={isAuthenticated ? <PharmacyDrugDatabase /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/pharmacy/prescriptions"
                                  element={isAuthenticated ? <PharmacyPrescriptions /> : <Navigate to="/login" replace />}
                                />
                                <Route
                                  path="/pharmacy/narcotics"
                                  element={isAuthenticated ? <PharmacyNarcoticsRegister /> : <Navigate to="/login" replace />}
                                />

                                {/* ── Fallbacks ── */}
                                <Route path="/" element={<Navigate to="/login" replace />} />
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
                        </NotificationProvider>
                      </AccessibilityProvider>
                    </TranslationProvider>
                  </LanguageProvider>
                </QueryProvider>
              </IndustryProvider>
            </SubscriptionProvider>
          </AppProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
