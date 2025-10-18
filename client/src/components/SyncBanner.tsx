import { useState, useEffect } from 'react';
import { CloudUpload, CloudOff, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { syncManager } from '@/lib/syncManager';
import { useToast } from '@/hooks/use-toast';

export default function SyncBanner() {
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    photos: number;
    projects: number;
  }>({ pending: 0, photos: 0, projects: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const { toast } = useToast();

  // Poll sync status every 5 seconds
  useEffect(() => {
    const updateSyncStatus = async () => {
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);
    };

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  // Listen to online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-hide success banner after 3 seconds
  useEffect(() => {
    if (showSuccessBanner) {
      const timer = setTimeout(() => setShowSuccessBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessBanner]);

  const handleSync = async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await syncManager.syncNow();
      
      if (result.success && result.synced > 0) {
        setShowSuccessBanner(true);
        toast({
          title: '✓ Photos synced',
          description: `${result.synced} photo${result.synced === 1 ? '' : 's'} uploaded successfully`,
        });
      } else if (result.failed > 0) {
        toast({
          title: 'Sync incomplete',
          description: `${result.synced} succeeded, ${result.failed} failed`,
          variant: 'destructive',
        });
      } else if (result.synced === 0 && syncStatus.pending === 0) {
        toast({
          title: 'All caught up',
          description: 'No photos to sync',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Don't show banner if no pending items and not showing success
  if (syncStatus.pending === 0 && !showSuccessBanner) {
    return null;
  }

  // Success banner (green)
  if (showSuccessBanner) {
    return (
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm animate-in slide-in-from-top overflow-hidden">
        <div className="h-1 bg-green-600" />
        <div className="px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">All photos synced</span>
          </div>
        </div>
      </div>
    );
  }

  // Offline banner (red)
  if (!isOnline) {
    return (
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm overflow-hidden">
        <div className="h-1 bg-red-600" />
        <div className="px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CloudOff className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-600">
              Offline - {syncStatus.photos} photo{syncStatus.photos === 1 ? '' : 's'} will sync when online
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Syncing banner (blue) with animated progress bar
  if (isSyncing) {
    return (
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm overflow-hidden">
        <div className="h-1 bg-primary/20 relative">
          <div 
            className="absolute top-0 left-0 h-full bg-primary animate-[slide-progress_1.5s_ease-in-out_infinite]" 
            style={{ width: '40%' }}
          />
        </div>
        <div className="px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm font-medium text-primary">
              Syncing {syncStatus.photos} photo{syncStatus.photos === 1 ? '' : 's'}...
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Pending banner (orange)
  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border shadow-sm overflow-hidden">
      <div className="h-1 bg-orange-600" />
      <div className="px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudUpload className="w-4 h-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-600">
            {syncStatus.photos} photo{syncStatus.photos === 1 ? '' : 's'} pending upload
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="h-7 text-orange-600 hover:bg-orange-600/10"
          data-testid="button-sync-now"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Sync
        </Button>
      </div>
    </div>
  );
}
