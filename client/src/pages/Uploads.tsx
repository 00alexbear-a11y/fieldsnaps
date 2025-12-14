import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Cloud, RefreshCw, Wifi, WifiOff, Trash2, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { syncManager } from "@/lib/syncManager";
import { haptics } from "@/lib/nativeHaptics";
import { queryClient } from "@/lib/queryClient";

interface PendingItem {
  id: string;
  type: 'photo' | 'project';
  projectId?: string;
  fileName?: string;
  createdAt: Date;
  retryCount: number;
  lastError?: string;
}

export default function Uploads() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    projects: number;
    photos: number;
  } | null>(null);

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

  useEffect(() => {
    const loadSyncStatus = async () => {
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);
    };
    loadSyncStatus();
  }, []);

  const handleSyncNow = async () => {
    if (!isOnline) {
      haptics.warning();
      toast({
        title: "No internet connection",
        description: "Please check your connection and try again",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    haptics.light();
    
    try {
      const result = await syncManager.syncNow();
      if (result.synced > 0) {
        haptics.success();
        toast({
          title: "Synced successfully",
          description: `${result.synced} item${result.synced > 1 ? 's' : ''} uploaded`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      } else if (result.failed > 0) {
        haptics.warning();
        toast({
          title: "Sync incomplete",
          description: `${result.failed} item${result.failed > 1 ? 's' : ''} failed`,
          variant: "destructive",
        });
      } else {
        haptics.light();
        toast({
          title: "All synced",
          description: "No pending uploads",
        });
      }
      
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      haptics.error();
      toast({
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b px-4 py-3 flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setLocation('/projects')}
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold flex-1">Pending Uploads</h1>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* Sync Status Card */}
        <div className="p-4">
          <Card className="p-4" data-testid="card-sync-status">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Cloud className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {syncStatus?.pending || 0} pending upload{(syncStatus?.pending || 0) !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {syncStatus?.photos || 0} photos, {syncStatus?.projects || 0} projects
                </p>
              </div>
              <Button
                onClick={handleSyncNow}
                disabled={isSyncing || !isOnline || !syncStatus?.pending}
                className="gap-2"
                data-testid="button-sync-now"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Connection Status */}
        {!isOnline && (
          <div className="px-4 pb-4">
            <Card className="p-4 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">You're offline</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Your photos will sync when you're back online
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {(!syncStatus || syncStatus.pending === 0) && (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
              <Cloud className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-lg font-semibold mb-2">All synced!</h2>
            <p className="text-muted-foreground text-center max-w-xs">
              All your photos and projects are safely backed up to the cloud
            </p>
          </div>
        )}

        {/* Info Section */}
        <div className="px-4 pt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Photos taken while offline are stored locally and will automatically 
            sync when you have an internet connection.
          </p>
          <p className="text-sm text-muted-foreground">
            For best results, connect to WiFi when syncing large numbers of photos.
          </p>
        </div>
      </div>
    </div>
  );
}
