import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useEffect, useState } from "react";
import Camera from "./pages/Camera";
import Projects from "./pages/Projects";
import ProjectPhotos from "./pages/ProjectPhotos";
import PhotoEdit from "./pages/PhotoEdit";
import PhotoView from "./pages/PhotoView";
import Settings from "./pages/Settings";
import SyncStatus from "./pages/SyncStatus";
import Trash from "./pages/Trash";
import ShareView from "./pages/ShareView";
import Map from "./pages/Map";
import ToDos from "./pages/ToDos";
import Login from "./pages/Login";
import NativeAppLogin from "./pages/NativeAppLogin";
import Landing from "./pages/Landing";
import Impact from "./pages/Impact";
import BillingSuccess from "./pages/BillingSuccess";
import CompanySetup from "./pages/CompanySetup";
import MyTasks from "./pages/MyTasks";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import Onboarding from "./components/Onboarding";
import SyncBanner from "./components/SyncBanner";
import { PaymentNotification } from "./components/PaymentNotification";
import { SyncStatusNotifier } from "./components/SyncStatusNotifier";
import { ServiceWorkerUpdate } from "./components/ServiceWorkerUpdate";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { useIsNativeApp } from "./hooks/usePlatform";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SwipeBackGesture } from "./components/SwipeBackGesture";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { isOAuthCallback, parseOAuthCallback, closeBrowser } from './lib/nativeOAuth';
import { isNativePlatform } from './lib/nativeNavigation';

function AppContent() {
  // CRITICAL: All hooks must be called at the top, before any conditional logic
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const isNativeApp = useIsNativeApp();
  
  // Initialize theme (handles localStorage and DOM automatically)
  useTheme();
  
  const showSyncBanner = location === '/' || location === '/settings';
  
  // Disable swipe back on main pages to prevent blank white screen
  const isMainPage = location === '/projects' || location === '/todos' || location === '/map' || location === '/camera';
  const disableSwipeBack = isMainPage;

  // Public routes that don't require authentication
  const publicRoutes = ['/share/', '/shared/', '/impact', '/login'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route)) || location === '/';
  
  // Onboarding routes are authenticated but before full setup
  const onboardingRoutes = ['/onboarding/company-setup'];
  const isOnboardingRoute = onboardingRoutes.some(route => location.startsWith(route));

  // Redirect authenticated users from landing to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated && location === '/') {
      setLocation('/projects');
    }
  }, [isAuthenticated, isLoading, location, setLocation]);

  // Redirect unauthenticated users from private routes to landing
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute && !isOnboardingRoute) {
      setLocation('/');
    }
  }, [isAuthenticated, isLoading, isPublicRoute, isOnboardingRoute, setLocation]);

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
          <Route path="/shared/:token" component={ShareView} />
          <Route component={NotFound} />
        </Switch>
      </main>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-white dark:bg-black text-foreground flex flex-col">
      {/* Universal swipe-back gesture (disabled on main pages) */}
      <SwipeBackGesture disabled={disableSwipeBack} />
      
      {/* Global offline indicator */}
      <OfflineIndicator />
      
      {/* Show payment notification for past_due users */}
      <PaymentNotification />
      
      {/* Show sync banner only on Projects list and Settings pages */}
      {showSyncBanner && <SyncBanner />}
      
      <main className="flex-1 bg-white dark:bg-black overflow-y-auto">
        <Switch>
          <Route path="/camera" component={Camera} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectPhotos} />
          <Route path="/photo/:id/edit" component={PhotoEdit} />
          <Route path="/photo/:id/view" component={PhotoView} />
          <Route path="/my-tasks" component={MyTasks} />
          <Route path="/settings" component={Settings} />
          <Route path="/sync-status" component={SyncStatus} />
          <Route path="/trash" component={Trash} />
          <Route path="/map" component={Map} />
          <Route path="/todos" component={ToDos} />
          <Route path="/billing/success" component={BillingSuccess} />
          <Route path="/shared/:token" component={ShareView} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check onboarding status
  useEffect(() => {
    const onboardingComplete = localStorage.getItem('onboarding_complete');
    if (!onboardingComplete) {
      setShowOnboarding(true);
    }
  }, []);

  // Handle deep linking for native apps (OAuth callbacks)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // Only set up deep link listener for native platforms
      return;
    }

    console.log('[Deep Link] Setting up app URL listener for OAuth callbacks');

    let listenerHandle: any = null;

    // Set up the listener
    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        const url = event.url;
        console.log('[Deep Link] App opened with URL:', url);

        // Check if this is an OAuth callback
        if (isOAuthCallback(url)) {
          console.log('[Deep Link] OAuth callback detected');
          
          // Parse callback parameters
          const params = parseOAuthCallback(url);
          console.log('[Deep Link] Callback params:', params);

          // Close the browser (Safari) if still open
          await closeBrowser();

          // Exchange the session ID for a cookie
          if (params.session_id) {
            console.log('[Deep Link] Exchanging session ID for cookie...');
            try {
              // In native mode, use full server URL (fetch with relative URLs doesn't work in Capacitor)
              const serverUrl = isNativePlatform() 
                ? 'https://b031dd5d-5c92-4902-b04b-e2a8255614a2-00-1nc5d7i5pn8nb.picard.replit.dev'
                : '';
              
              const exchangeUrl = `${serverUrl}/api/auth/exchange-session`;
              console.log('[Deep Link] 🔄 Exchanging session at:', exchangeUrl);
              console.log('[Deep Link] 🔑 Session ID:', params.session_id);
              
              const response = await fetch(exchangeUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: params.session_id }),
                credentials: 'include', // Important: include cookies
              });

              console.log('[Deep Link] 📡 Response status:', response.status, response.statusText);
              console.log('[Deep Link] 📋 Response headers:', Object.fromEntries(response.headers.entries()));

              if (!response.ok) {
                const errorText = await response.text();
                console.error('[Deep Link] ❌ Session exchange failed:', response.status, errorText);
                window.location.href = '/login';
                return;
              }

              const responseData = await response.json();
              console.log('[Deep Link] ✅ Session exchange successful, response:', responseData);
            } catch (error) {
              console.error('[Deep Link] ❌ Session exchange error (exception):', error);
              console.error('[Deep Link] ❌ Error details:', {
                name: (error as Error).name,
                message: (error as Error).message,
                stack: (error as Error).stack
              });
              window.location.href = '/login';
              return;
            }
          }

          // Check if user needs company setup
          if (params.needs_company_setup === 'true') {
            console.log('[Deep Link] New user needs company setup, redirecting...');
            window.location.replace('/onboarding/company-setup');
          } else {
            // Reload to trigger auth check with new session
            console.log('[Deep Link] OAuth callback successful, reloading to apply session...');
            window.location.reload();
          }
        }
      });
    };

    setupListener();

    // Cleanup listener on unmount
    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('onboarding_complete', 'true');
    setShowOnboarding(false);
  };

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
        <AppContent />
        <SyncStatusNotifier />
        <ServiceWorkerUpdate />
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
