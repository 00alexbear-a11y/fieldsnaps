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
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import Onboarding from "./components/Onboarding";
import SyncBanner from "./components/SyncBanner";
import { useAuth } from "./hooks/useAuth";

function AppContent() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const showSyncBanner = location === '/' || location === '/settings';

  // Public routes that don't require authentication
  const publicRoutes = ['/share/'];
  const isPublicRoute = publicRoutes.some(route => location.startsWith(route));

  // Redirect to login if not authenticated (except for public routes)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isPublicRoute) {
      setLocation('/login');
    }
  }, [isAuthenticated, isLoading, isPublicRoute, setLocation]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login page if not authenticated and not on a public route
  if (!isAuthenticated && !isPublicRoute) {
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

  // Initialize theme and check onboarding status
  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    }

    // Check if onboarding has been completed
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
    <QueryClientProvider client={queryClient}>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <AppContent />
      <Toaster />
    </QueryClientProvider>
  );
}
