import { useEffect } from 'react';
import { syncManager, type SyncEvent } from '@/lib/syncManager';
import { useToast } from '@/hooks/use-toast';

/**
 * Global sync status notifier component
 * Listens to sync events and shows toast notifications
 */
export function SyncStatusNotifier() {
  const { toast } = useToast();

  useEffect(() => {
    const handleSyncEvent = (event: SyncEvent) => {
      if (event.type === 'sync-complete' && event.result) {
        // Only show success toast for background syncs with multiple items
        // Manual syncs in Projects.tsx already show their own toasts
        if (event.result.synced > 1) {
          toast({
            title: '✓ Synced',
            description: `${event.result.synced} items uploaded in background`,
            duration: 2000,
          });
        }
      } else if (event.type === 'sync-error' && event.result) {
        // Show error toast for any failed syncs
        toast({
          title: 'Sync failed',
          description: event.error || `${event.result.failed} items failed to upload`,
          variant: 'destructive',
          duration: 4000,
        });
      }
    };

    syncManager.addEventListener(handleSyncEvent);

    return () => {
      syncManager.removeEventListener(handleSyncEvent);
    };
  }, [toast]);

  return null;
}
