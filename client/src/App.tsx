import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useEffect, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";

// Lazy-load Toaster to prevent Safari dispatcher error
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));

// Lazy-load the 4 largest pages (2228, 1730, 1548, 1393 lines respectively)
const ProjectPhotos = lazy(() => import("./pages/ProjectPhotos"));
const Camera = lazy(() => import("./pages/Camera"));
const Settings = lazy(() => import("./pages/Settings"));
const ToDos = lazy(() => import("./pages/ToDos"));

// Eager-load smaller, frequently-used pages
import Projects from "./pages/Projects";
import AllPhotos from "./pages/AllPhotos";
import Activity from "./pages/Activity";
import PhotoEdit from "./pages/PhotoEdit";
import PhotoView from "./pages/PhotoView";
import SyncStatus from "./pages/SyncStatus";
import Uploads from "./pages/Uploads";
import Trash from "./pages/Trash";
import ShareView from "./pages/ShareView";
import Map from "./pages/Map";
import Help from "./pages/Help";
import Login from "./pages/Login";
import NativeAppLogin from "./pages/NativeAppLogin";
import Landing from "./pages/Landing";
import Waitlist from "./pages/Waitlist";
import Impact from "./pages/Impact";
import BillingSuccess from "./pages/BillingSuccess";
import CompanySetup from "./pages/CompanySetup";
import MyTasks from "./pages/MyTasks";
import Timesheets from "./pages/Timesheets";
import Time from "./pages/Time";
import AdminLocations from "./pages/AdminLocations";
import AdminTimesheets from "./pages/AdminTimesheets";
import LocationPrivacy from "./pages/LocationPrivacy";
import LocationPermissionEducation from "./pages/LocationPermissionEducation";
import GeofenceDebugConsole from "./pages/GeofenceDebugConsole";
import AuthCallback from "./pages/AuthCallback";
import NotFound from "./pages/not-found";
import BottomNav from "./components/BottomNav";
import { AppSidebar } from "./components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { Button } from "./components/ui/button";
import { PaymentNotification } from "./components/PaymentNotification";
import { SyncStatusNotifier } from "./components/SyncStatusNotifier";
import { ServiceWorkerUpdate } from "./components/ServiceWorkerUpdate";
import { OfflineIndicator } from "./components/OfflineIndicator";
import OnboardingPage from "./pages/Onboarding";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import { ProfileSetupDialog } from "./components/ProfileSetupDialog";
import { UpgradeModal } from "./components/UpgradeModal";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useIsNativeApp } from "./hooks/usePlatform";
import { useSubscriptionAccess } from "./hooks/useSubscriptionAccess";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SwipeBackGesture } from "./components/SwipeBackGesture";
import { TodoSessionProvider } from "./contexts/TodoSessionContext";
import { AuthProvider } from "./contexts/AuthContext";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { isNativePlatform } from './lib/nativeNavigation';
import { nativeStatusBar } from './lib/nativeStatusBar';
import { SafeAreaProvider } from './components/SafeAreaProvider';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

function AppContent() {
  // CRITICAL: All hooks must be called at the top, before any conditional logic
  const [location, setLocation] = useLocation();
  
  // Auto-login in development mode (tree-shaken from production)
  // Disabled auto dev login - user must manually login
  // useDevAutoLogin();
  
  const { isAuthenticated, isLoading, user } = useAuth();
  const isNativeApp = useIsNativeApp();
  const { canWrite } = useSubscriptionAccess();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  
  // EMERGENCY: If still loading after 5 seconds, force render anyway
  const [forceRender, setForceRender] = useState(false);
  
  useEffect(() => {
    if (isLoading && !forceRender) {
      console.log('[App] Loading... isAuthenticated:', isAuthenticated, 'user:', !!user);
      const timeout = setTimeout(() => {
        console.error('[App] Loading timeout (5s) - forcing render');
        setForceRender(true);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, forceRender, isAuthenticated, user]);
  
  // Email whitelist - only these emails can access the app
  const WHITELIST_EMAILS = ['team.abgroup@gmail.com', 'dev@fieldsnaps.local', 'snapspeak@test.com', 'hello@fieldsnaps.com', 'alexmbear@yahoo.com'];
  const isWhitelisted = user && user.email && WHITELIST_EMAILS.includes(user.email);
  
  // Initialize theme (handles localStorage and DOM automatically)
  useTheme();
  

  // Profile setup state - show before onboarding if user is missing name
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  useEffect(() => {
    if (isAuthenticated && isWhitelisted && user?.id) {
      // ONLY check database fields - trust the server, not localStorage
      // If user already has firstName AND lastName in database, they don't need setup
      const hasName = user.firstName && user.lastName;
      
      // Only show profile setup if user is missing name data in the database
      // This prevents the dialog from showing for existing users on fresh iOS installs
      if (!hasName) {
        setShowProfileSetup(true);
      } else {
        // User has name data - ensure dialog stays closed
        setShowProfileSetup(false);
      }
    }
  }, [isAuthenticated, isWhitelisted, user]);

  const handleProfileSetupComplete = () => {
    // Close the dialog and refetch user data
    setShowProfileSetup(false);
    if (user?.id) {
      // Refetch user data to update UI with new profile data
      queryClient.invalidateQueries({ queryKey: ['auth', 'currentUser'] });
    }
  };
  
  // Disable swipe back on main pages to prevent blank white screen
  const isMainPage = location === '/projects' || location === '/todos' || location === '/map' || location === '/camera';
  const disableSwipeBack = isMainPage;

  // Public routes that don't require authentication
  const publicRoutes = ['/share/', '/impact', '/login', '/waitlist', '/auth/callback'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route)) || location === '/';
  
  // Onboarding routes are authenticated but before full setup
  const onboardingRoutes = ['/onboarding/company-setup', '/onboarding'];
  const isOnboardingRoute = onboardingRoutes.some(route => location.startsWith(route));
  
  // Check if user needs onboarding - ONLY if they don't have a company
  // If user has companyId, they're already set up (ignore onboardingComplete flag)
  // This prevents existing users from getting stuck in onboarding loop
  const needsOnboarding = isAuthenticated && isWhitelisted && user && !user.companyId;

  // Redirect authenticated whitelisted users from landing to dashboard or onboarding
  // Non-whitelisted users can stay on landing page
  useEffect(() => {
    if (!isLoading && isAuthenticated && isWhitelisted && location === '/') {
      // When at '/', always redirect to appropriate destination
      setLocation(needsOnboarding ? '/onboarding' : '/projects');
    }
  }, [isAuthenticated, isWhitelisted, isLoading, needsOnboarding, location, setLocation]);
  
  // Redirect users who need onboarding to /onboarding page
  useEffect(() => {
    if (!isLoading && needsOnboarding && !isOnboardingRoute && !isPublicRoute && location !== '/onboarding') {
      setLocation('/onboarding');
    }
  }, [isLoading, needsOnboarding, isOnboardingRoute, isPublicRoute, location, setLocation]);

  // Redirect unauthenticated users from private routes to landing
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute && !isOnboardingRoute && location !== '/') {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, isPublicRoute, isOnboardingRoute, location, setLocation]);

  // Redirect non-whitelisted authenticated users to waitlist
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isWhitelisted && !isPublicRoute && location !== '/waitlist') {
      setLocation('/waitlist');
    }
  }, [isAuthenticated, isLoading, isWhitelisted, isPublicRoute, location, setLocation]);

  // Show loading state while checking authentication (with 5s timeout fallback)
  if (isLoading && !forceRender) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // CRITICAL: Block rendering of private routes for unauthenticated users (redirect happens in useEffect)
  // This prevents data queries from firing without auth credentials
  // Allow onboarding routes for authenticated users without companies
  if (!isAuthenticated && !isPublicRoute && !isOnboardingRoute) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Render onboarding routes without bottom nav
  if (isAuthenticated && isOnboardingRoute) {
    return (
      <main className="min-h-screen bg-white dark:bg-black text-foreground">
        <Switch>
          <Route path="/onboarding" component={OnboardingPage} />
          <Route path="/onboarding/company-setup" component={CompanySetup} />
          <Route component={NotFound} />
        </Switch>
      </main>
    );
  }

  // Public routes get different layout (no bottom nav)
  if (!isAuthenticated && isPublicRoute) {
    return (
      <main className="min-h-screen bg-white dark:bg-black text-foreground">
        <Switch>
          {/* Native app users see mobile-optimized login, web users see marketing landing */}
          <Route path="/" component={isNativeApp ? NativeAppLogin : Landing} />
          <Route path="/impact" component={Impact} />
          <Route path="/login" component={isNativeApp ? NativeAppLogin : Login} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/waitlist" component={Waitlist} />
          <Route path="/share/:token" component={ShareView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    );
  }

  // Authenticated but not whitelisted users can see landing and waitlist pages
  if (isAuthenticated && !isWhitelisted) {
    return (
      <main className="min-h-screen bg-white dark:bg-black text-foreground">
        <Switch>
          <Route path="/" component={isNativeApp ? NativeAppLogin : Landing} />
          <Route path="/login" component={isNativeApp ? NativeAppLogin : Login} />
          <Route path="/auth/callback" component={AuthCallback} />
          <Route path="/waitlist" component={Waitlist} />
          <Route path="/share/:token" component={ShareView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    );
  }

  // At this point, user is authenticated AND whitelisted
  // (unauthenticated users blocked at line ~198, non-whitelisted at line ~238)
  
  // Routes where sidebar should be hidden (camera, edit modes, full-screen views)
  // These render COMPLETELY OUTSIDE SidebarProvider to avoid transform issues on iOS
  // Extract pathname without query params or hash
  const pathname = location.split('?')[0].split('#')[0];
  
  const fullScreenRoutes = ['/camera', '/photo/:id/edit', '/photo/:id/view'];
  const isFullScreenRoute = fullScreenRoutes.some(route => {
    if (route.includes(':')) {
      const pattern = route.replace(/:[^/]+/g, '[^/]+');
      return new RegExp(`^${pattern}/?$`).test(pathname);
    }
    return pathname === route || pathname === route + '/';
  });

  // Full-screen routes render WITHOUT SidebarProvider to ensure position:fixed works on iOS
  // SidebarProvider applies transforms that break position:fixed in WKWebView
  if (isFullScreenRoute) {
    return (
      <div className="min-h-screen bg-black text-foreground">
        <SwipeBackGesture disabled={disableSwipeBack} />
        <OfflineIndicator />
        <Suspense fallback={<div className="flex items-center justify-center h-screen bg-black"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
          <Switch>
            <Route path="/camera" component={Camera} />
            <Route path="/photo/:id/edit" component={PhotoEdit} />
            <Route path="/photo/:id/view" component={PhotoView} />
          </Switch>
        </Suspense>
        <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
      </div>
    );
  }

  // Normal routes with SidebarProvider
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="app-shell bg-white dark:bg-black text-foreground">
        {/* Universal swipe-back gesture (disabled on main pages) */}
        <SwipeBackGesture disabled={disableSwipeBack} />
        
        {/* Global offline indicator */}
        <OfflineIndicator />
        
        {/* Show payment notification for past_due users */}
        <PaymentNotification />
        
        {/* Profile setup for first-time login (show before onboarding) */}
        {showProfileSetup && (
          <ProfileSetupDialog
            open={showProfileSetup}
            onOpenChange={setShowProfileSetup}
            user={user || null}
            isFirstTime={true}
            onComplete={handleProfileSetupComplete}
          />
        )}
        
        
        {/* Sidebar */}
        <AppSidebar />
        
        {/* Header with menu button and logo - rendered via portal to escape transform ancestors */}
        {/* NOTE: Use portal to bypass SidebarProvider transforms that break position:fixed on iOS */}
        {createPortal(
          <header 
            className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-3 pb-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 touch-none"
            style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          >
            <SidebarTrigger 
              data-testid="button-sidebar-trigger"
              className="hover-elevate active-elevate-2 !h-auto !w-auto flex items-center gap-2 px-1"
              aria-label="Toggle sidebar"
            >
              <img 
                src={logoPath} 
                alt="FieldSnaps" 
                className="h-8 w-auto object-contain"
                data-testid="img-fieldsnaps-logo"
              />
            </SidebarTrigger>
            {/* New Project button - only shown on /projects route */}
            {pathname === '/projects' && (
              <CreateProjectDialog 
                canWrite={canWrite} 
                onUpgradeRequired={() => setUpgradeModalOpen(true)} 
              />
            )}
          </header>,
          document.body
        )}
        
        {/* Main content - scrollable area with padding for fixed header/footer */}
        <div className="flex flex-col flex-1 min-w-0">
          <main 
            className="flex-1 bg-white dark:bg-black"
            style={{ 
              paddingTop: 'calc(env(safe-area-inset-top, 0px) + 68px)',
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)'
            }}
          >
            <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
              <Switch>
                <Route path="/auth/callback" component={AuthCallback} />
                <Route path="/projects" component={Projects} />
                <Route path="/projects/:id" component={ProjectPhotos} />
                <Route path="/all-photos" component={AllPhotos} />
                <Route path="/activity" component={Activity} />
                <Route path="/my-tasks" component={MyTasks} />
                <Route path="/timesheets" component={Timesheets} />
                <Route path="/settings" component={Settings} />
                <Route path="/location-privacy" component={LocationPrivacy} />
                <Route path="/location-permission" component={LocationPermissionEducation} />
                <Route path="/debug-console" component={GeofenceDebugConsole} />
                <Route path="/help" component={Help} />
                <Route path="/sync-status" component={SyncStatus} />
                <Route path="/uploads" component={Uploads} />
                <Route path="/trash" component={Trash} />
                <Route path="/map" component={Map} />
                <Route path="/todos" component={ToDos} />
                <Route path="/time" component={Time} />
                <Route path="/admin/locations" component={AdminLocations} />
                <Route path="/admin/timesheets" component={AdminTimesheets} />
                <Route path="/billing/success" component={BillingSuccess} />
                <Route path="/share/:token" component={ShareView} />
                <Route component={NotFound} />
              </Switch>
            </Suspense>
          </main>
        </div>
        
        {/* BottomNav - rendered via portal to escape transform ancestors */}
        <BottomNav />
        
        {/* Upgrade Modal */}
        <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  // Initialize status bar for native apps (transparent with dark content)
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      // Set status bar to overlay the webview (transparent)
      nativeStatusBar.setOverlay(true);
      // Use dark style (dark text/icons) for light backgrounds
      nativeStatusBar.setDark();
    }
  }, []);

  // Note: OAuth deep link handling is now obsolete with ASWebAuthenticationSession.
  // ASWebAuthenticationSession handles the entire OAuth flow internally and returns
  // the authorization code directly to the app without using deep links.
  // The NativeAppLogin component handles the complete OAuth flow including token storage.

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TodoSessionProvider>
              <AppContent />
              <SyncStatusNotifier />
              <ServiceWorkerUpdate />
              <Suspense fallback={null}>
                <Toaster />
              </Suspense>
            </TodoSessionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
