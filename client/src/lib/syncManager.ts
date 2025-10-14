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

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

export type SyncEventType = 'sync-complete' | 'sync-error' | 'item-error';

export interface SyncEvent {
  type: SyncEventType;
  result?: SyncResult;
  error?: string;
  itemType?: string;
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
      // Get pending sync items
      const queueItems = await idb.getPendingSyncItems();
      
      if (queueItems.length === 0) {
        console.log('[Sync] No items to sync');
        return result;
      }

      // Sort items to ensure projects are synced before photos
      const sortedItems = [...queueItems].sort((a, b) => {
        // Projects first, then photos
        if (a.type === 'project' && b.type !== 'project') return -1;
        if (a.type !== 'project' && b.type === 'project') return 1;
        return 0;
      });

      console.log(`[Sync] Processing ${sortedItems.length} items`);

      // Process each item
      for (const item of sortedItems) {
        try {
          const success = await this.processSyncItem(item);
          
          if (success) {
            result.synced++;
            await idb.removeFromSyncQueue(item.id);
          } else {
            result.failed++;
            result.success = false;
          }
        } catch (error) {
          result.failed++;
          result.success = false;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`${item.type} ${item.localId}: ${errorMsg}`);
        }
      }

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
   * Process a single sync queue item
   */
  private async processSyncItem(item: SyncQueueItem): Promise<boolean> {
    // Check if max retries exceeded
    if (item.retryCount >= MAX_RETRY_COUNT) {
      console.error(`[Sync] Max retries exceeded for ${item.type} ${item.localId}`);
      await idb.updateSyncQueueItem(item.id, {
        error: 'Max retries exceeded',
      });
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
    // Add skip auth header if needed (development only)
    if (sessionStorage.getItem('skipAuth') === 'true') {
      headers['x-skip-auth'] = 'true';
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
