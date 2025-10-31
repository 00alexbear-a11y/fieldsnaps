import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Image, Home, Trash2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { indexedDB as indexedDBService, type SyncQueueItem, type LocalPhoto, createPhotoUrl } from '@/lib/indexeddb';
import { syncManager } from '@/lib/syncManager';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface EnhancedSyncItem extends SyncQueueItem {
  photoUrl?: string;
  projectName?: string;
}

export default function SyncStatus() {
  const [, setLocation] = useLocation();
  const [syncItems, setSyncItems] = useState<EnhancedSyncItem[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; projectName?: string } | null>(null);
  const photoUrlsRef = useRef<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [photoToMove, setPhotoToMove] = useState<{ syncItemId: string; photoId: string } | null>(null);

  useEffect(() => {
    loadSyncItems();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Clean up all photo URLs on unmount
      photoUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      photoUrlsRef.current = [];
    };
  }, []);

  const loadSyncItems = async () => {
    try {
      setLoading(true);
      
      // Close preview dialog to prevent showing revoked URLs
      setSelectedPhoto(null);
      
      // Revoke old URLs before creating new ones
      photoUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      photoUrlsRef.current = [];
      
      const items = await indexedDBService.getPendingSyncItems();
      
      // Enhance items with photo URLs and project names
      const enhancedItems = await Promise.all(
        items.map(async (item) => {
          const enhanced: EnhancedSyncItem = { ...item };
          
          // For photo items, fetch the photo and create URL
          if (item.type === 'photo' && item.localId) {
            try {
              const photo = await indexedDBService.getPhoto(item.localId);
              if (photo) {
                const url = createPhotoUrl(photo);
                enhanced.photoUrl = url;
                photoUrlsRef.current.push(url);
              }
            } catch (error) {
              console.error('Failed to load photo:', error);
            }
          }
          
          // Fetch project name if projectId exists
          if (item.projectId) {
            try {
              const project = await indexedDBService.getProject(item.projectId);
              if (project) {
                enhanced.projectName = project.name;
              }
            } catch (error) {
              console.error('Failed to load project:', error);
            }
          }
          
          return enhanced;
        })
      );
      
      setSyncItems(enhancedItems);
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

  const handleTouchStart = (e: React.TouchEvent, itemId: string) => {
    if (isSelectMode) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, itemId: string) => {
    if (isSelectMode) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 50) {
      setSwipedItemId(itemId);
    } else if (diff < -10) {
      setSwipedItemId(null);
    }
  };

  const handleTouchEnd = () => {
    if (isSelectMode) return;
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  const handleDeleteSwipedItem = async () => {
    if (!swipedItemId) return;
    
    try {
      await indexedDBService.removeFromSyncQueue(swipedItemId);
      await loadSyncItems();
      setSwipedItemId(null);
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedItems(new Set());
    setSwipedItemId(null);
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleBatchDelete = async () => {
    try {
      const itemsArray = Array.from(selectedItems);
      for (const itemId of itemsArray) {
        await indexedDBService.removeFromSyncQueue(itemId);
      }
      await loadSyncItems();
      setSelectedItems(new Set());
      setIsSelectMode(false);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Failed to delete items:', error);
    }
  };

  const photoItems = syncItems.filter(item => item.type === 'photo');
  const projectItems = syncItems.filter(item => item.type === 'project');

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between pt-safe-3 pb-3 px-4 border-b">
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
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            {isSelectMode ? `${selectedItems.size} Selected` : 'Sync Status'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isSelectMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                disabled={selectedItems.size === 0}
                data-testid="button-delete-selected"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSelectMode}
                data-testid="button-cancel-select"
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              {syncItems.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectMode}
                  data-testid="button-select-mode"
                >
                  Select
                </Button>
              )}
              {isOnline ? (
                <Wifi className="w-5 h-5 text-green-500" data-testid="icon-online" />
              ) : (
                <WifiOff className="w-5 h-5 text-destructive" data-testid="icon-offline" />
              )}
            </>
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
              <div 
                key={item.id}
                className="relative overflow-hidden"
                onTouchStart={(e) => handleTouchStart(e, item.id)}
                onTouchMove={(e) => handleTouchMove(e, item.id)}
                onTouchEnd={handleTouchEnd}
              >
                {/* Swipe Delete Button */}
                {swipedItemId === item.id && !isSelectMode && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 z-10">
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={handleDeleteSwipedItem}
                      data-testid={`button-delete-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                
                <Card 
                  className={`p-3 transition-transform ${
                    swipedItemId === item.id && !isSelectMode ? '-translate-x-20' : 'translate-x-0'
                  } ${!isSelectMode ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
                  data-testid={`card-sync-photo-${item.id}`}
                  onClick={() => {
                    if (isSelectMode) {
                      toggleItemSelection(item.id);
                    } else if (item.photoUrl) {
                      setSelectedPhoto({ url: item.photoUrl, projectName: item.projectName });
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Select Checkbox (in select mode) */}
                    {isSelectMode && (
                      <div className="flex-shrink-0 pt-1">
                        {selectedItems.has(item.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary" data-testid={`checkbox-selected-${item.id}`} />
                        ) : (
                          <Square className="w-5 h-5 text-muted-foreground" data-testid={`checkbox-unselected-${item.id}`} />
                        )}
                      </div>
                    )}
                    
                    {/* Photo Thumbnail */}
                    {item.photoUrl && (
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={item.photoUrl} 
                          alt="Photo preview" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* Photo Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        Photo {item.localId?.substring(0, 8)}...
                      </div>
                      {item.projectName && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          Project: {item.projectName}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {format(new Date(item.createdAt), 'MMM d, yyyy h:mm a')}
                      </div>
                      {item.error && (
                        <div className="text-xs text-destructive mt-1">
                          Error: {item.error}
                        </div>
                      )}
                    </div>
                    
                    {/* Status Badge */}
                    {!isSelectMode && (
                      <div className="ml-3 flex-shrink-0">
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
                    )}
                  </div>
                </Card>
              </div>
            ))}
          </div>
        )}

        {/* Project Items */}
        {!loading && projectItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-md font-semibold flex items-center gap-2">
              <Home className="w-4 h-4" />
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

      {/* Photo Preview Dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
          {selectedPhoto && (
            <div className="relative">
              <img 
                src={selectedPhoto.url} 
                alt="Photo preview" 
                className="w-full h-auto"
              />
              {selectedPhoto.projectName && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-sm text-white p-4">
                  <p className="text-sm font-medium">Project: {selectedPhoto.projectName}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-confirm-delete">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Sync Queue?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedItems.size} {selectedItems.size === 1 ? 'item' : 'items'} from the sync queue. 
              These items will not be uploaded to the server.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
