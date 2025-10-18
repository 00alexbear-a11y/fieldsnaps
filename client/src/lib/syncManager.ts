/**
 * Background Sync Manager for Construction PWA
 * 
 * Handles:
 * - Photo upload queue with retry logic
 * - Background sync when connection returns
 * - Exponential backoff for failed uploads
 * - Sync status tracking and notifications
 */

import { indexedDB as idb, type LocalPhoto, type LocalProject, type SyncQueueItem } from './indexeddb';

const MAX_RETRY_COUNT = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 60000; // 1 minute
const BATCH_SIZE = 10; // Process up to 10 items concurrently

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export type SyncEventType = 'sync-complete' | 'sync-error' | 'item-error' | 'sync-progress';

export interface SyncProgress {
  total: number;
  processed: number;
  synced: number;
  failed: number;
  currentBatch: number;
  totalBatches: number;
}

export interface SyncEvent {
  type: SyncEventType;
  result?: SyncResult;
  error?: string;
  itemType?: string;
  progress?: SyncProgress;
}

type SyncEventListener = (event: SyncEvent) => void;

class SyncManager {
  private isSyncing = false;
  private syncInProgress = false;
  private listeners: Set<SyncEventListener> = new Set();

  constructor() {
    // Setup network listeners on initialization
    this.setupNetworkListeners();
    this.setupServiceWorkerListener();
  }

  /**
   * Add event listener for sync events
   */
  addEventListener(listener: SyncEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: SyncEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit sync event to all listeners
   */
  private emitEvent(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[Sync] Event listener error:', error);
      }
    });
  }

  /**
   * Setup Service Worker message listener
   */
  private setupServiceWorkerListener(): void {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_PHOTOS') {
          console.log('[Sync] Received sync request from SW');
          this.syncNow();
        }
      });
    }
  }

  /**
   * Register service worker sync (for background sync)
   */
  async registerBackgroundSync(): Promise<void> {
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Type assertion for Background Sync API
        await (registration as any).sync.register('sync-photos');
        console.log('[Sync] Background sync registered');
      } catch (error) {
        console.error('[Sync] Failed to register background sync:', error);
        // Fallback: sync immediately
        this.syncNow();
      }
    } else {
      // Browser doesn't support background sync
      // Fallback: sync immediately
      this.syncNow();
    }
  }

  /**
   * Sync photos immediately (foreground sync)
   */
  async syncNow(): Promise<SyncResult> {
    if (this.syncInProgress) {
      console.log('[Sync] Sync already in progress, skipping');
      return {
        success: false,
        synced: 0,
        failed: 0,
        errors: ['Sync already in progress'],
      };
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // First, try to apply any pending tags from previous failures
      // This runs even if sync queue is empty
      await this.retryPendingTags();
      
      // Get pending sync items
      const queueItems = await idb.getPendingSyncItems();
      
      if (queueItems.length === 0) {
        console.log('[Sync] No items to sync');
        return result;
      }

      // Separate items by type and sort newest first within each type
      const projects = queueItems
        .filter(item => item.type === 'project')
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first
      
      const photos = queueItems
        .filter(item => item.type === 'photo')
        .sort((a, b) => b.createdAt - a.createdAt); // Newest first

      const totalItems = projects.length + photos.length;
      const projectBatches = Math.ceil(projects.length / BATCH_SIZE);
      const photoBatches = Math.ceil(photos.length / BATCH_SIZE);
      const totalBatches = projectBatches + photoBatches;
      
      console.log(`[Sync] Processing ${projects.length} projects, ${photos.length} photos (${totalBatches} batches)`);

      // Shared batch counter for monotonic progress
      let batchCounter = { current: 0 };
      
      // Process projects first in batches (projects must exist before their photos)
      await this.processBatch(projects, result, totalItems, totalBatches, batchCounter);

      // Then process photos in batches
      await this.processBatch(photos, result, totalItems, totalBatches, batchCounter);

      console.log(`[Sync] Complete: ${result.synced} synced, ${result.failed} failed`);
      
      // Emit sync completion event with result
      if (result.failed > 0) {
        this.emitEvent({
          type: 'sync-error',
          result,
          error: `${result.failed} item${result.failed > 1 ? 's' : ''} failed to sync`,
        });
      } else if (result.synced > 0) {
        this.emitEvent({
          type: 'sync-complete',
          result,
        });
      }
      
    } catch (error) {
      console.error('[Sync] Sync failed:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      // Emit sync error event
      this.emitEvent({
        type: 'sync-error',
        result,
        error: error instanceof Error ? error.message : 'Unknown sync error',
      });
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  /**
   * Process a batch of sync items concurrently
   */
  private async processBatch(
    items: SyncQueueItem[], 
    result: SyncResult, 
    totalItems: number,
    totalBatches: number,
    batchCounter: { current: number }
  ): Promise<void> {
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      batchCounter.current++; // Increment for this batch
      
      console.log(`[Sync] Processing batch ${batchCounter.current}/${totalBatches} (${batch.length} items)`);
      
      // Emit progress event BEFORE batch (shows items completed so far)
      this.emitEvent({
        type: 'sync-progress',
        progress: {
          total: totalItems,
          processed: result.synced + result.failed,
          synced: result.synced,
          failed: result.failed,
          currentBatch: batchCounter.current,
          totalBatches,
        },
      });
      
      // Process batch items concurrently
      const results = await Promise.allSettled(
        batch.map(item => this.processSyncItem(item))
      );
      
      // Update results and remove successful items from queue
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const itemResult = results[j];
        
        if (itemResult.status === 'fulfilled' && itemResult.value) {
          result.synced++;
          await idb.removeFromSyncQueue(item.id);
        } else {
          result.failed++;
          result.success = false;
          
          if (itemResult.status === 'rejected') {
            const errorMsg = itemResult.reason instanceof Error ? 
              itemResult.reason.message : 'Unknown error';
            result.errors.push(`${item.type} ${item.localId}: ${errorMsg}`);
          }
        }
      }
      
      // Emit progress event AFTER batch completes (shows updated totals)
      this.emitEvent({
        type: 'sync-progress',
        progress: {
          total: totalItems,
          processed: result.synced + result.failed,
          synced: result.synced,
          failed: result.failed,
          currentBatch: batchCounter.current,
          totalBatches,
        },
      });
    }
  }

  /**
   * Process a single sync queue item
   */
  private async processSyncItem(item: SyncQueueItem): Promise<boolean> {
    // Check if max retries exceeded
    if (item.retryCount >= MAX_RETRY_COUNT) {
      console.error(`[Sync] Max retries exceeded for ${item.type} ${item.localId} - removing from queue`);
      await idb.removeFromSyncQueue(item.id);
      return false;
    }

    // Calculate retry delay with exponential backoff
    // Only apply delay if we've already retried (retryCount > 0) and we're offline
    if (item.lastAttempt && item.retryCount > 0 && !navigator.onLine) {
      const delay = Math.min(
        INITIAL_RETRY_DELAY * Math.pow(2, item.retryCount),
        MAX_RETRY_DELAY
      );
      const timeSinceLastAttempt = Date.now() - item.lastAttempt;
      
      if (timeSinceLastAttempt < delay) {
        console.log(`[Sync] Waiting for retry delay: ${delay - timeSinceLastAttempt}ms`);
        return false;
      }
    }

    try {
      console.log(`[Sync] Processing ${item.type} ${item.action} ${item.localId}`);

      let success = false;

      switch (item.type) {
        case 'project':
          success = await this.syncProject(item);
          break;
        case 'photo':
          success = await this.syncPhoto(item);
          break;
        case 'annotation':
          // TODO: Implement annotation sync
          success = true;
          break;
        default:
          console.warn(`[Sync] Unknown sync type: ${item.type}`);
          success = false;
      }

      if (!success) {
        // Update retry count
        await idb.updateSyncQueueItem(item.id, {
          retryCount: item.retryCount + 1,
          lastAttempt: Date.now(),
        });
      }

      return success;
    } catch (error) {
      console.error(`[Sync] Error processing ${item.type}:`, error);
      
      // Update retry count and error
      await idb.updateSyncQueueItem(item.id, {
        retryCount: item.retryCount + 1,
        lastAttempt: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      return false;
    }
  }

  /**
   * Sync a project to the server
   */
  /**
   * Get headers for sync requests with auth
   */
  private getSyncHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }

  private async syncProject(item: SyncQueueItem): Promise<boolean> {
    const project = await idb.getProject(item.localId);
    
    if (!project) {
      console.error('[Sync] Project not found:', item.localId);
      return false;
    }

    try {
      if (item.action === 'create') {
        const response = await fetch('/api/projects', {
          method: 'POST',
          headers: this.getSyncHeaders('application/json'),
          credentials: 'include',
          body: JSON.stringify({
            name: project.name,
            description: project.description,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        
        // Update local project with server ID
        await idb.updateProject(item.localId, {
          serverId: data.id,
          syncStatus: 'synced',
        });

        console.log(`[Sync] Project created: ${data.id}`);
        return true;
      }

      if (item.action === 'update' && project.serverId) {
        const response = await fetch(`/api/projects/${project.serverId}`, {
          method: 'PATCH',
          headers: this.getSyncHeaders('application/json'),
          credentials: 'include',
          body: JSON.stringify({
            name: project.name,
            description: project.description,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        await idb.updateProject(item.localId, {
          syncStatus: 'synced',
        });

        console.log(`[Sync] Project updated: ${project.serverId}`);
        return true;
      }

      if (item.action === 'delete' && project.serverId) {
        const response = await fetch(`/api/projects/${project.serverId}`, {
          method: 'DELETE',
          headers: this.getSyncHeaders(),
          credentials: 'include',
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Remove from local storage
        await idb.deleteProject(item.localId);

        console.log(`[Sync] Project deleted: ${project.serverId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Sync] Project sync error:', error);
      return false;
    }
  }

  /**
   * Sync a photo to the server
   */
  private async syncPhoto(item: SyncQueueItem): Promise<boolean> {
    const photo = await idb.getPhoto(item.localId);
    
    if (!photo) {
      console.error('[Sync] Photo not found:', item.localId);
      return false;
    }

    // Photo's projectId is the SERVER project ID (not a local IndexedDB ID)
    // since projects are created server-first in this app
    const serverProjectId = photo.projectId;
    
    if (!serverProjectId) {
      console.error('[Sync] Photo missing project ID:', item.localId);
      return false;
    }

    try {
      if (item.action === 'create') {
        console.log('[Sync] Starting photo upload for:', item.localId, 'to project:', serverProjectId);
        
        // Create FormData for multipart upload
        const formData = new FormData();
        formData.append('photo', photo.blob, `photo-${photo.id}.jpg`);
        if (photo.caption) {
          formData.append('caption', photo.caption);
        }
        if (photo.annotations) {
          formData.append('annotations', photo.annotations);
        }
        // Include mediaType to distinguish photos from videos
        formData.append('mediaType', photo.mediaType);

        // Get headers (without Content-Type for FormData)
        const headers = this.getSyncHeaders();
        console.log('[Sync] Upload headers:', headers);
        console.log('[Sync] Upload URL:', `/api/projects/${serverProjectId}/photos`);

        const response = await fetch(`/api/projects/${serverProjectId}/photos`, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: formData,
        });

        console.log('[Sync] Upload response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Sync] Upload failed:', response.status, errorText);
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('[Sync] Upload successful, server response:', data);
        
        // Update local photo with server ID and sync status
        await idb.updatePhotoSyncStatus(item.localId, 'synced', data.id);

        // Apply pending tags if any
        if (photo.pendingTagIds && photo.pendingTagIds.length > 0 && data.id) {
          console.log('[Sync] Applying pending tags:', photo.pendingTagIds);
          
          const failedTagIds: string[] = [];
          
          try {
            for (const tagId of photo.pendingTagIds) {
              try {
                const tagResponse = await fetch(`/api/photos/${data.id}/tags`, {
                  method: 'POST',
                  headers: {
                    ...this.getSyncHeaders(),
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({ tagId }),
                });
                
                if (!tagResponse.ok) {
                  const errorText = await tagResponse.text();
                  console.error(`[Sync] Failed to apply tag ${tagId}:`, errorText);
                  failedTagIds.push(tagId);
                }
              } catch (tagFetchError) {
                console.error(`[Sync] Error applying tag ${tagId}:`, tagFetchError);
                failedTagIds.push(tagId);
              }
            }
            
            // Only clear successfully applied tags
            if (failedTagIds.length === 0) {
              // All tags applied successfully
              await idb.updatePhoto(item.localId, { pendingTagIds: [] });
              console.log('[Sync] All pending tags applied successfully');
            } else {
              // Keep failed tags for retry
              await idb.updatePhoto(item.localId, { pendingTagIds: failedTagIds });
              console.log(`[Sync] ${failedTagIds.length} tags failed to apply, will retry on next sync`);
            }
          } catch (tagError) {
            console.error('[Sync] Error applying pending tags:', tagError);
            // Keep all pending tags for retry if there was an unexpected error
          }
        }

        console.log(`[Sync] Photo uploaded: ${data.id}`);
        return true;
      }

      if (item.action === 'update' && photo.serverId) {
        console.log('[Sync] Updating photo:', photo.serverId);
        
        // Create FormData for multipart upload
        const formData = new FormData();
        
        // Include updated blob from item.data if available
        if (item.data.blob) {
          formData.append('photo', item.data.blob, `photo-${photo.id}.jpg`);
        }
        
        if (item.data.annotations !== undefined) {
          formData.append('annotations', item.data.annotations || '');
        }
        
        if (photo.caption) {
          formData.append('caption', photo.caption);
        }

        const response = await fetch(`/api/photos/${photo.serverId}`, {
          method: 'PATCH',
          headers: this.getSyncHeaders(),
          credentials: 'include',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Sync] Update failed:', response.status, errorText);
          throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        await idb.updatePhotoSyncStatus(item.localId, 'synced');

        console.log(`[Sync] Photo updated: ${photo.serverId}`);
        return true;
      }

      if (item.action === 'delete' && photo.serverId) {
        const response = await fetch(`/api/photos/${photo.serverId}`, {
          method: 'DELETE',
          headers: this.getSyncHeaders(),
          credentials: 'include',
        });

        if (!response.ok && response.status !== 404) {
          throw new Error(`Server error: ${response.status}`);
        }

        // Remove from local storage
        await idb.deletePhoto(item.localId);

        console.log(`[Sync] Photo deleted: ${photo.serverId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Sync] Photo sync error:', error);
      
      // Update photo sync status
      await idb.updatePhotoSyncStatus(
        item.localId,
        'error',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      return false;
    }
  }

  /**
   * Retry pending tags for all synced photos that have them
   * This is called after main sync completes to ensure tags are eventually applied
   */
  private async retryPendingTags(): Promise<void> {
    console.log('[Sync] Checking for photos with pending tags...');
    
    try {
      // Get all photos - we need to scan all projects
      const allProjects = await idb.getAllProjects();
      
      for (const project of allProjects) {
        // Get photos for this project
        const photos = await idb.getProjectPhotos(project.id);
        
        // Filter to synced photos with pending tags
        const photosWithPendingTags = photos.filter(
          photo => photo.syncStatus === 'synced' && 
                   photo.serverId && 
                   photo.pendingTagIds && 
                   photo.pendingTagIds.length > 0
        );
        
        if (photosWithPendingTags.length === 0) continue;
        
        console.log(`[Sync] Found ${photosWithPendingTags.length} photos with pending tags in project ${project.name}`);
        
        // Try to apply pending tags for each photo
        for (const photo of photosWithPendingTags) {
          if (!photo.serverId || !photo.pendingTagIds) continue;
          
          console.log(`[Sync] Retrying tags for photo ${photo.serverId}:`, photo.pendingTagIds);
          
          const failedTagIds: string[] = [];
          
          try {
            for (const tagId of photo.pendingTagIds) {
              try {
                const tagResponse = await fetch(`/api/photos/${photo.serverId}/tags`, {
                  method: 'POST',
                  headers: {
                    ...this.getSyncHeaders(),
                    'Content-Type': 'application/json',
                  },
                  credentials: 'include',
                  body: JSON.stringify({ tagId }),
                });
                
                if (!tagResponse.ok) {
                  const errorText = await tagResponse.text();
                  console.error(`[Sync] Failed to retry tag ${tagId}:`, errorText);
                  failedTagIds.push(tagId);
                }
              } catch (tagFetchError) {
                console.error(`[Sync] Error retrying tag ${tagId}:`, tagFetchError);
                failedTagIds.push(tagId);
              }
            }
            
            // Update pending tags - clear if all succeeded, keep failed ones
            if (failedTagIds.length === 0) {
              await idb.updatePhoto(photo.id, { pendingTagIds: [] });
              console.log(`[Sync] All pending tags applied for photo ${photo.serverId}`);
            } else {
              await idb.updatePhoto(photo.id, { pendingTagIds: failedTagIds });
              console.log(`[Sync] ${failedTagIds.length} tags still pending for photo ${photo.serverId}`);
            }
          } catch (error) {
            console.error(`[Sync] Error processing pending tags for photo ${photo.serverId}:`, error);
            // Keep all pending tags if there was an unexpected error
          }
        }
      }
    } catch (error) {
      console.error('[Sync] Error in retryPendingTags:', error);
      // Don't throw - this is a best-effort operation
    }
  }

  /**
   * Queue a project for sync
   */
  async queueProjectSync(projectId: string, action: 'create' | 'update' | 'delete'): Promise<void> {
    await idb.addToSyncQueue({
      type: 'project',
      localId: projectId,
      action,
      data: {},
      retryCount: 0,
    });

    // If online, sync immediately. Otherwise use background sync
    if (navigator.onLine) {
      console.log('[Sync] Online - syncing immediately');
      this.syncNow();
    } else {
      console.log('[Sync] Offline - registering background sync');
      await this.registerBackgroundSync();
    }
  }

  /**
   * Queue a photo for sync
   */
  async queuePhotoSync(photoId: string, projectId: string, action: 'create' | 'delete'): Promise<void> {
    console.log('[Sync] Queuing photo for sync:', { photoId, projectId, action, online: navigator.onLine });
    
    await idb.addToSyncQueue({
      type: 'photo',
      localId: photoId,
      projectId,
      action,
      data: {},
      retryCount: 0,
    });

    console.log('[Sync] Photo added to queue successfully');

    // If online, sync immediately. Otherwise use background sync
    if (navigator.onLine) {
      console.log('[Sync] Online - syncing immediately');
      this.syncNow();
    } else {
      console.log('[Sync] Offline - registering background sync');
      await this.registerBackgroundSync();
    }
  }

  /**
   * Upload a photo immediately and wait for completion, returning the server photo ID
   * Used for attach-to-todo flow where we need the server ID before proceeding
   */
  async uploadPhotoAndWait(photoId: string, projectId: string): Promise<string | null> {
    console.log('[Sync] Uploading photo and waiting:', { photoId, projectId });
    
    // If offline, we can't wait for upload
    if (!navigator.onLine) {
      console.log('[Sync] Offline - cannot upload immediately');
      return null;
    }

    // Add to queue and get the created item
    await idb.addToSyncQueue({
      type: 'photo',
      localId: photoId,
      projectId,
      action: 'create',
      data: {},
      retryCount: 0,
    });

    // Get the queue item that was just added
    const allItems = await idb.getPendingSyncItems();
    const item = allItems.find(i => i.localId === photoId && i.type === 'photo');
    
    if (!item) {
      console.error('[Sync] Could not find queue item for photo:', photoId);
      return null;
    }

    // Sync the photo immediately
    const success = await this.syncPhoto(item);
    
    if (!success) {
      console.error('[Sync] Photo upload failed');
      return null;
    }

    // Remove from queue after successful sync
    await idb.removeFromSyncQueue(photoId);

    // Get the updated photo with server ID
    const photo = await idb.getPhoto(photoId);
    
    if (photo && photo.serverId) {
      console.log('[Sync] Photo uploaded successfully, server ID:', photo.serverId);
      return photo.serverId;
    }

    console.error('[Sync] Photo uploaded but no server ID found');
    return null;
  }

  /**
   * Get sync queue status
   */
  async getSyncStatus(): Promise<{
    pending: number;
    projects: number;
    photos: number;
  }> {
    const items = await idb.getPendingSyncItems();
    
    return {
      pending: items.length,
      projects: items.filter(i => i.type === 'project').length,
      photos: items.filter(i => i.type === 'photo').length,
    };
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Setup online/offline listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[Sync] Network online, attempting sync');
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      console.log('[Sync] Network offline');
    });
  }

  /**
   * Get detailed sync metrics including historical stats
   */
  async getSyncMetrics(): Promise<{
    queue: { pending: number; projects: number; photos: number };
    photos: { pending: number; synced: number; failed: number };
  }> {
    const queueItems = await idb.getPendingSyncItems();
    const allProjects = await idb.getAllProjects();
    
    // Count photos by sync status across all projects
    let totalPending = 0;
    let totalSynced = 0;
    let totalFailed = 0;
    
    for (const project of allProjects) {
      const photos = await idb.getProjectPhotos(project.id);
      totalPending += photos.filter(p => p.syncStatus === 'pending').length;
      totalSynced += photos.filter(p => p.syncStatus === 'synced').length;
      totalFailed += photos.filter(p => p.syncStatus === 'error').length;
    }
    
    return {
      queue: {
        pending: queueItems.length,
        projects: queueItems.filter(i => i.type === 'project').length,
        photos: queueItems.filter(i => i.type === 'photo').length,
      },
      photos: {
        pending: totalPending,
        synced: totalSynced,
        failed: totalFailed,
      },
    };
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
