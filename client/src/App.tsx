import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useEffect, useState } from "react";
import Camera from "./pages/Camera";
import Projects from "./pages/Projects";
import ProjectPhotos from "./pages/ProjectPhotos";
import PhotoEdit from "./pages/PhotoEdit";
import Settings from "./pages/Settings";
import SyncStatus from "./pages/SyncStatus";
import Trash from "./pages/Trash";
import ShareView from "./pages/ShareView";
import Map from "./pages/Map";
import Inbox from "./pages/Inbox";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import Onboarding from "./components/Onboarding";
import SyncBanner from "./components/SyncBanner";
import { SyncStatusNotifier } from "./components/SyncStatusNotifier";
import { ServiceWorkerUpdate } from "./components/ServiceWorkerUpdate";
import { useAuth } from "./hooks/useAuth";
import { useTheme } from "./hooks/useTheme";
import { ErrorBoundary } from "./components/ErrorBoundary";

function AppContent() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const showSyncBanner = location === '/' || location === '/settings';
  
  // Initialize theme (handles localStorage and DOM automatically)
  useTheme();

  // Check for skip auth flag (testing mode)
  const skipAuth = sessionStorage.getItem('skipAuth') === 'true';

  // Public routes that don't require authentication
  const publicRoutes = ['/share/'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));

  // Redirect to login if not authenticated (except for public routes or skip mode)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute && !skipAuth) {
      setLocation('/login');
    }
  }, [isAuthenticated, isLoading, isPublicRoute, skipAuth, setLocation]);

  // Show loading state while checking authentication (skip if in skip mode)
  if (isLoading && !skipAuth) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login page if not authenticated and not on a public route (skip if in skip mode)
  if (!isAuthenticated && !isPublicRoute && !skipAuth) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black text-foreground flex flex-col">
      {/* Show sync banner only on Projects list and Settings pages */}
      {showSyncBanner && <SyncBanner />}
      
      <main className="flex-1 overflow-auto pb-16 bg-white dark:bg-black">
        <Switch>
          <Route path="/camera" component={Camera} />
          <Route path="/" component={Projects} />
          <Route path="/projects/:id" component={ProjectPhotos} />
          <Route path="/photo/:id/edit" component={PhotoEdit} />
          <Route path="/settings" component={Settings} />
          <Route path="/sync-status" component={SyncStatus} />
          <Route path="/trash" component={Trash} />
          <Route path="/map" component={Map} />
          <Route path="/inbox" component={Inbox} />
          <Route path="/login" component={Login} />
          <Route path="/share/:token" component={ShareView} />
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
