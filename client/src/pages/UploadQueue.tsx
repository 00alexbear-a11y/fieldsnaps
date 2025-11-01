import { ArrowLeft, Wifi, Clock, Check, AlertCircle, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { indexedDB as idb, type SyncQueueItem } from '@/lib/indexeddb';
import { syncManager } from '@/lib/syncManager';
import { useToast } from '@/hooks/use-toast';

export default function UploadQueue() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load queue items
  const loadQueue = async () => {
    setIsLoading(true);
    try {
      const items = await idb.getPendingSyncItems();
      setQueueItems(items);
    } catch (error) {
      console.error('Failed to load queue:', error);
      toast({
        title: 'Failed to load upload queue',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const handleRetryFailed = async () => {
    try {
      await syncManager.syncNow();
      toast({
        title: 'Retrying uploads',
        description: 'Attempting to sync failed items',
      });
      // Reload queue after a short delay
      setTimeout(loadQueue, 1000);
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: 'Please try again later',
        variant: 'destructive',
      });
    }
  };

  const handleClearCompleted = async () => {
    try {
      const completedItems = queueItems.filter(item => item.status === 'synced');
      for (const item of completedItems) {
        await idb.removeSyncItem(item.id);
      }
      toast({
        title: 'Queue cleared',
        description: `Removed ${completedItems.length} completed items`,
      });
      loadQueue();
    } catch (error) {
      toast({
        title: 'Failed to clear queue',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
      case 'syncing':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'synced':
        return 'Uploaded';
      case 'error':
        return 'Failed';
      case 'pending':
        return 'Waiting for WiFi...';
      case 'syncing':
        return 'Uploading...';
      default:
        return 'Pending';
    }
  };

  const pendingCount = queueItems.filter(item => item.status === 'pending' || item.status === 'syncing').length;
  const failedCount = queueItems.filter(item => item.status === 'error').length;
  const completedCount = queueItems.filter(item => item.status === 'synced').length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-black border-b border-border">
        <div className="px-4 pt-safe-3 pb-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/settings')}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Upload Queue</h1>
          </div>
          
          {/* Summary */}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{pendingCount} pending</span>
            {failedCount > 0 && <span className="text-red-500">{failedCount} failed</span>}
            <span>{completedCount} completed</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pb-24 pt-4 space-y-4 max-w-screen-sm mx-auto">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading queue...
            </div>
          ) : queueItems.length === 0 ? (
            <Card className="p-8 text-center">
              <Check className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <h3 className="font-semibold mb-1">All caught up!</h3>
              <p className="text-sm text-muted-foreground">
                No items in upload queue
              </p>
            </Card>
          ) : (
            <>
              {/* Action Buttons */}
              <div className="flex gap-2">
                {failedCount > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRetryFailed}
                    data-testid="button-retry-failed"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Retry Failed
                  </Button>
                )}
                {completedCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearCompleted}
                    data-testid="button-clear-completed"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Completed
                  </Button>
                )}
              </div>

              {/* Queue Items */}
              <div className="space-y-2">
                {queueItems.map((item) => (
                  <Card
                    key={item.id}
                    className="p-4"
                    data-testid={`queue-item-${item.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          <span className="font-medium text-sm">
                            {item.type === 'photo' ? 'Photo' : 'Project'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getStatusText(item.status)}
                        </p>
                        {item.retryCount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Retry attempt: {item.retryCount}/{5}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
