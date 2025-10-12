import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import Camera from "./pages/Camera";
import Projects from "./pages/Projects";
import ProjectPhotos from "./pages/ProjectPhotos";
import PhotoEdit from "./pages/PhotoEdit";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import BottomNav from "./components/BottomNav";
import Onboarding from "./components/Onboarding";

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
      <TooltipProvider>
        {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          <main className="flex-1 overflow-auto pb-16">
            <Switch>
              <Route path="/camera" component={Camera} />
              <Route path="/" component={Projects} />
              <Route path="/projects/:id" component={ProjectPhotos} />
              <Route path="/photo/:id/edit" component={PhotoEdit} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <BottomNav />
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
