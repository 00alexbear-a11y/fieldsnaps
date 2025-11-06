import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { useEffect, useState, lazy, Suspense } from "react";

// Lazy-load Toaster to prevent Safari dispatcher error
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));

// Lazy-load the 4 largest pages (2228, 1730, 1548, 1393 lines respectively)
const ProjectPhotos = lazy(() => import("./pages/ProjectPhotos"));
const Camera = lazy(() => import("./pages/Camera"));
const Settings = lazy(() => import("./pages/Settings"));
const UploadQueue = lazy(() => import("./pages/UploadQueue"));
const ToDos = lazy(() => import("./pages/ToDos"));

// Eager-load smaller, frequently-used pages
import Projects from "./pages/Projects";
import PhotoEdit from "./pages/PhotoEdit";
import PhotoView from "./pages/PhotoView";
import SyncStatus from "./pages/SyncStatus";
import Trash from "./pages/Trash";
import ShareView from "./pages/ShareView";
import Map from "./pages/Map";
import Login from "./pages/Login";
import NativeAppLogin from "./pages/NativeAppLogin";
import Landing from "./pages/Landing";
import Waitlist from "./pages/Waitlist";
import Impact from "./pages/Impact";
import BillingSuccess from "./pages/BillingSuccess";
import CompanySetup from "./pages/CompanySetup";
import MyTasks from "./pages/MyTasks";
import NotFound from "./pages/not-found";
import BottomNav from "./components/BottomNav";
import { PaymentNotification } from "./components/PaymentNotification";
import { SyncStatusNotifier } from "./components/SyncStatusNotifier";
import { ServiceWorkerUpdate } from "./components/ServiceWorkerUpdate";
import { OfflineIndicator } from "./components/OfflineIndicator";
import Onboarding from "./components/Onboarding";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useIsNativeApp } from "./hooks/usePlatform";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SwipeBackGesture } from "./components/SwipeBackGesture";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { isNativePlatform } from './lib/nativeNavigation';
import { nativeStatusBar } from './lib/nativeStatusBar';

function AppContent() {
  // CRITICAL: All hooks must be called at the top, before any conditional logic
  const [location, setLocation] = useLocation();
  
  // Auto-login in development mode (tree-shaken from production)
  // Disabled auto dev login - user must manually login
  // useDevAutoLogin();
  
  const { isAuthenticated, isLoading, user } = useAuth();
  const isNativeApp = useIsNativeApp();
  
  // Email whitelist - only these emails can access the app
  const WHITELIST_EMAILS = ['team.abgroup@gmail.com', 'dev@fieldsnaps.local'];
  const isWhitelisted = user && user.email && WHITELIST_EMAILS.includes(user.email);
  
  // Initialize theme (handles localStorage and DOM automatically)
  useTheme();
  
  
  // Disable swipe back on main pages to prevent blank white screen
  const isMainPage = location === '/projects' || location === '/todos' || location === '/map' || location === '/camera';
  const disableSwipeBack = isMainPage;

  // Public routes that don't require authentication
  const publicRoutes = ['/share/', '/impact', '/login', '/waitlist'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route)) || location === '/';
  
  // Onboarding routes are authenticated but before full setup
  const onboardingRoutes = ['/onboarding/company-setup'];
  const isOnboardingRoute = onboardingRoutes.some(route => location.startsWith(route));

  // Redirect authenticated whitelisted users from landing to dashboard
  // Non-whitelisted users can stay on landing page
  useEffect(() => {
    if (!isLoading && isAuthenticated && isWhitelisted && location === '/') {
      setLocation('/projects');
    }
  }, [isAuthenticated, isWhitelisted, isLoading, location, setLocation]);

  // Redirect unauthenticated users from private routes to landing
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute && !isOnboardingRoute) {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, isPublicRoute, isOnboardingRoute, setLocation]);

  // Redirect non-whitelisted authenticated users to waitlist
  useEffect(() => {
    if (!isLoading && isAuthenticated && !isWhitelisted && location !== '/waitlist' && !isPublicRoute) {
      setLocation('/waitlist');
    }
  }, [isAuthenticated, isLoading, isWhitelisted, location, isPublicRoute, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
          <Route path="/waitlist" component={Waitlist} />
          <Route path="/share/:token" component={ShareView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    );
  }

  // Check if authenticated user has seen onboarding (scoped to user ID)
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  useEffect(() => {
    if (isAuthenticated && isWhitelisted && user?.id) {
      const onboardingKey = `onboarding_complete_${user.id}`;
      const hasCompletedOnboarding = localStorage.getItem(onboardingKey);
      if (!hasCompletedOnboarding) {
        setShowOnboarding(true);
      }
    }
  }, [isAuthenticated, isWhitelisted, user]);

  const handleOnboardingComplete = () => {
    if (user?.id) {
      const onboardingKey = `onboarding_complete_${user.id}`;
      localStorage.setItem(onboardingKey, 'true');
      setShowOnboarding(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-white dark:bg-black text-foreground flex flex-col">
      {/* Universal swipe-back gesture (disabled on main pages) */}
      <SwipeBackGesture disabled={disableSwipeBack} />
      
      {/* Global offline indicator */}
      <OfflineIndicator />
      
      {/* Show payment notification for past_due users */}
      <PaymentNotification />
      
      {/* Onboarding for authenticated, whitelisted users only */}
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      
      <main className="flex-1 bg-white dark:bg-black overflow-y-auto">
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
          <Switch>
            <Route path="/camera" component={Camera} />
            <Route path="/projects" component={Projects} />
            <Route path="/projects/:id" component={ProjectPhotos} />
            <Route path="/photo/:id/edit" component={PhotoEdit} />
            <Route path="/photo/:id/view" component={PhotoView} />
            <Route path="/my-tasks" component={MyTasks} />
            <Route path="/settings" component={Settings} />
            <Route path="/upload-queue" component={UploadQueue} />
            <Route path="/sync-status" component={SyncStatus} />
            <Route path="/trash" component={Trash} />
            <Route path="/map" component={Map} />
            <Route path="/todos" component={ToDos} />
            <Route path="/billing/success" component={BillingSuccess} />
            <Route path="/share/:token" component={ShareView} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </main>
      <BottomNav />
    </div>
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
      <QueryClientProvider client={queryClient}>
        <AppContent />
        <SyncStatusNotifier />
        <ServiceWorkerUpdate />
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
