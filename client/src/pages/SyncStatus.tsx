import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Image, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { indexedDB as indexedDBService, type SyncQueueItem } from '@/lib/indexeddb';
import { syncManager } from '@/lib/syncManager';
import { format } from 'date-fns';

export default function SyncStatus() {
  const [, setLocation] = useLocation();
  const [syncItems, setSyncItems] = useState<SyncQueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSyncItems();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadSyncItems = async () => {
    try {
      setLoading(true);
      const items = await indexedDBService.getPendingSyncItems();
      setSyncItems(items);
    } catch (error) {
      console.error('Failed to load sync items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncManager.syncNow();
      await loadSyncItems();
    } finally {
      setSyncing(false);
    }
  };

  const photoItems = syncItems.filter(item => item.type === 'photo');
  const projectItems = syncItems.filter(item => item.type === 'project');

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/settings')}
            data-testid="button-back-to-settings"
            aria-label="Back to settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Sync Status</h1>
        </div>
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-500" data-testid="icon-online" />
          ) : (
            <WifiOff className="w-5 h-5 text-destructive" data-testid="icon-offline" />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24 space-y-6">
        {/* Summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending Items</h2>
            <Button
              size="sm"
              onClick={handleSync}
              disabled={!isOnline || syncing || syncItems.length === 0}
              data-testid="button-sync-now"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary" data-testid="text-pending-photos">
                {photoItems.length}
              </div>
              <div className="text-sm text-muted-foreground">Photos</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-primary" data-testid="text-pending-projects">
                {projectItems.length}
              </div>
              <div className="text-sm text-muted-foreground">Projects</div>
            </div>
          </div>
        </Card>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full w-8 h-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && syncItems.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium mb-1">All synced!</p>
              <p className="text-sm">No items waiting to be synced</p>
            </div>
          </Card>
        )}

        {/* Photo Items */}
        {!loading && photoItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-md font-semibold flex items-center gap-2">
              <Image className="w-4 h-4" />
              Photos ({photoItems.length})
            </h3>
            {photoItems.map((item) => (
              <Card key={item.id} className="p-3" data-testid={`card-sync-photo-${item.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      Photo {item.localId?.substring(0, 8)}...
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                    {item.error && (
                      <div className="text-xs text-destructive mt-1">
                        Error: {item.error}
                      </div>
                    )}
                  </div>
                  <div className="ml-3">
                    {item.error ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                        Error
                      </span>
                    ) : item.retryCount > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-500">
                        Retry {item.retryCount}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-500">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Project Items */}
        {!loading && projectItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-md font-semibold flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              Projects ({projectItems.length})
            </h3>
            {projectItems.map((item) => (
              <Card key={item.id} className="p-3" data-testid={`card-sync-project-${item.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      Project {item.localId?.substring(0, 8)}...
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                    </div>
                    {item.error && (
                      <div className="text-xs text-destructive mt-1">
                        Error: {item.error}
                      </div>
                    )}
                  </div>
                  <div className="ml-3">
                    {item.error ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                        Error
                      </span>
                    ) : item.retryCount > 0 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-500">
                        Retry {item.retryCount}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-500">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
