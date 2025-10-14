import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export function ServiceWorkerUpdate() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Only run in production with Service Worker support
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let intervalId: number | undefined;

    // Message handler for SW updates
    const messageHandler = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        setShowUpdate(true);
      }
    };

    // Listen for updates
    navigator.serviceWorker.ready.then((reg) => {
      // Check for updates every hour
      const checkForUpdates = () => {
        reg.update().catch((err) => {
          console.error('[SW Update] Check failed:', err);
        });
      };

      // Initial check
      checkForUpdates();

      // Periodic checks every hour
      intervalId = window.setInterval(checkForUpdates, 60 * 60 * 1000);

      // Listen for new service worker waiting
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is ready to take over
              console.log('[SW Update] New version available');
              setRegistration(reg);
              setShowUpdate(true);
            }
          });
        }
      });
    });

    // Add message listener
    navigator.serviceWorker.addEventListener('message', messageHandler);

    // Cleanup function
    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
      }
      navigator.serviceWorker.removeEventListener('message', messageHandler);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting and activate
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      
      // Reload the page to use the new service worker
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  if (!showUpdate) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5">
      <Card className="p-4 shadow-lg border-primary/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold mb-1">
              Update Available
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              A new version of FieldSnaps is ready. Update now for the latest features and fixes.
            </p>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleUpdate}
                data-testid="button-update-app"
                className="flex-1"
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Update Now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
                data-testid="button-dismiss-update"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
