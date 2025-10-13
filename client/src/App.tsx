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
import ShareView from "./pages/ShareView";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import Onboarding from "./components/Onboarding";
import SyncBanner from "./components/SyncBanner";

function AppContent() {
  const [location] = useLocation();
  const showSyncBanner = location === '/' || location === '/settings';

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
