/**
 * IndexedDB Storage Layer for Offline-First Photo Management
 * 
 * Stores photos locally with sync queue for background upload when online.
 * Enables complete offline functionality for construction site photo capture.
 */

export interface LocalPhoto {
  id: string;
  projectId: string;
  blob: Blob;
  // url is NOT stored - create on-demand from blob using createPhotoUrl()
  caption?: string;
  quality: 'standard' | 'detailed' | 'quick';
  timestamp: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  syncError?: string;
  serverId?: string; // ID from server after successful upload
  retryCount: number;
  annotations?: string | null; // JSON string of annotations
  createdAt: number;
  updatedAt: number;
}

/**
 * Create a temporary object URL from a LocalPhoto's blob.
 * IMPORTANT: Caller must revoke the URL when done: URL.revokeObjectURL(url)
 */
export function createPhotoUrl(photo: LocalPhoto): string {
  return URL.createObjectURL(photo.blob);
}

export interface LocalProject {
  id: string;
  name: string;
  description?: string;
  photoCount: number;
  lastPhotoAt?: number;
  syncStatus: 'pending' | 'synced';
  serverId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'photo' | 'project' | 'annotation';
  localId: string;
  projectId?: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  retryCount: number;
  lastAttempt?: number;
  error?: string;
  createdAt: number;
}

const DB_NAME = 'ConstructionPhotoDB';
const DB_VERSION = 1;

// Object store names
const STORES = {
  PHOTOS: 'photos',
  PROJECTS: 'projects',
  SYNC_QUEUE: 'syncQueue',
  THUMBNAILS: 'thumbnails',
} as const;

class IndexedDBManager {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  /**
   * Initialize IndexedDB with proper schema
   */
  private async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db!);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Photos store - main photo storage with blobs
        if (!db.objectStoreNames.contains(STORES.PHOTOS)) {
          const photoStore = db.createObjectStore(STORES.PHOTOS, { keyPath: 'id' });
          photoStore.createIndex('projectId', 'projectId', { unique: false });
          photoStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          photoStore.createIndex('timestamp', 'timestamp', { unique: false });
          photoStore.createIndex('serverId', 'serverId', { unique: false });
        }

        // Projects store
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projectStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
          projectStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          projectStore.createIndex('serverId', 'serverId', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          queueStore.createIndex('type', 'type', { unique: false });
          queueStore.createIndex('localId', 'localId', { unique: false });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Thumbnails store - for fast grid display
        if (!db.objectStoreNames.contains(STORES.THUMBNAILS)) {
          const thumbStore = db.createObjectStore(STORES.THUMBNAILS, { keyPath: 'photoId' });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Save photo to local storage
   */
  async savePhoto(photo: Omit<LocalPhoto, 'id' | 'createdAt' | 'updatedAt'>): Promise<LocalPhoto> {
    const db = await this.init();
    const id = crypto.randomUUID();
    const now = Date.now();

    const localPhoto: LocalPhoto = {
      ...photo,
      id,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PHOTOS], 'readwrite');
      const store = transaction.objectStore(STORES.PHOTOS);
      const request = store.add(localPhoto);

      request.onsuccess = () => resolve(localPhoto);
      request.onerror = () => {
        console.error('[IndexedDB] Failed to save photo:', request.error);
        reject(request.error);
      };
      
      transaction.onerror = () => {
        console.error('[IndexedDB] Transaction error while saving photo:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Save or update photo with a specified ID (useful for server-synced photos)
   */
  async savePhotoWithId(id: string, photo: Omit<LocalPhoto, 'id' | 'createdAt' | 'updatedAt'>): Promise<LocalPhoto> {
    const db = await this.init();
    const now = Date.now();
    
    // Check if photo already exists
    const existing = await this.getPhoto(id);
    
    const localPhoto: LocalPhoto = {
      ...photo,
      id,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PHOTOS], 'readwrite');
      const store = transaction.objectStore(STORES.PHOTOS);
      // Use put instead of add to allow updating existing records
      const request = store.put(localPhoto);

      request.onsuccess = () => resolve(localPhoto);
      request.onerror = () => {
        console.error('[IndexedDB] Failed to save photo with ID:', id, request.error);
        reject(request.error);
      };
      
      transaction.onerror = () => {
        console.error('[IndexedDB] Transaction error while saving photo with ID:', id, transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * Update an existing photo in local storage
   */
  async updatePhoto(id: string, updates: Partial<LocalPhoto>): Promise<LocalPhoto> {
    const db = await this.init();
    
    try {
      const existingPhoto = await this.getPhoto(id);
      
      if (!existingPhoto) {
        console.error('[IndexedDB] Photo not found:', id);
        throw new Error(`Photo ${id} not found`);
      }

      // Ensure existingPhoto is a proper object before spreading
      if (typeof existingPhoto !== 'object' || existingPhoto === null) {
        console.error('[IndexedDB] Invalid photo data:', { id, existingPhoto, type: typeof existingPhoto });
        throw new Error(`Invalid photo data type: ${typeof existingPhoto}`);
      }

      console.log('[IndexedDB] Updating photo:', { id, hasBlob: !!existingPhoto.blob, hasAnnotations: !!existingPhoto.annotations });

      const updatedPhoto: LocalPhoto = {
        ...existingPhoto,
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: Date.now(),
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORES.PHOTOS], 'readwrite');
        const store = transaction.objectStore(STORES.PHOTOS);
        const request = store.put(updatedPhoto);

        request.onsuccess = () => resolve(updatedPhoto);
        request.onerror = () => {
          console.error('[IndexedDB] Failed to update photo:', id, request.error);
          reject(request.error);
        };
        
        transaction.onerror = () => {
          console.error('[IndexedDB] Transaction error while updating photo:', id, transaction.error);
          reject(transaction.error);
        };
      });
    } catch (error) {
      console.error('[IndexedDB] updatePhoto error:', error);
      throw error;
    }
  }

  /**
   * Get photo by ID
   */
  async getPhoto(id: string): Promise<LocalPhoto | null> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PHOTOS], 'readonly');
      const store = transaction.objectStore(STORES.PHOTOS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all photos for a project
   */
  async getProjectPhotos(projectId: string): Promise<LocalPhoto[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PHOTOS], 'readonly');
      const store = transaction.objectStore(STORES.PHOTOS);
      const index = store.index('projectId');
      const request = index.getAll(projectId);

      request.onsuccess = () => {
        const photos = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(photos);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update photo sync status
   */
  async updatePhotoSyncStatus(
    id: string,
    status: LocalPhoto['syncStatus'],
    serverId?: string,
    error?: string
  ): Promise<void> {
    const db = await this.init();
    const photo = await this.getPhoto(id);
    if (!photo) throw new Error('Photo not found');

    photo.syncStatus = status;
    photo.updatedAt = Date.now();
    if (serverId) photo.serverId = serverId;
    if (error !== undefined) photo.syncError = error;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PHOTOS], 'readwrite');
      const store = transaction.objectStore(STORES.PHOTOS);
      const request = store.put(photo);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete photo
   */
  async deletePhoto(id: string): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PHOTOS, STORES.THUMBNAILS], 'readwrite');
      
      // Delete photo
      const photoStore = transaction.objectStore(STORES.PHOTOS);
      photoStore.delete(id);

      // Delete thumbnail
      const thumbStore = transaction.objectStore(STORES.THUMBNAILS);
      thumbStore.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Save project to local storage
   */
  async saveProject(project: Omit<LocalProject, 'id' | 'createdAt' | 'updatedAt'>): Promise<LocalProject> {
    const db = await this.init();
    const id = crypto.randomUUID();
    const now = Date.now();

    const localProject: LocalProject = {
      ...project,
      id,
      createdAt: now,
      updatedAt: now,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.add(localProject);

      request.onsuccess = () => resolve(localProject);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<LocalProject | null> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all projects
   */
  async getAllProjects(): Promise<LocalProject[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result.sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(projects);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<LocalProject>): Promise<void> {
    const db = await this.init();

    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction([STORES.PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const project = getRequest.result;
        if (!project) {
          reject(new Error('Project not found'));
          return;
        }

        const updated = {
          ...project,
          ...updates,
          updatedAt: Date.now(),
        };

        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete project and all associated photos and sync queue items
   */
  async deleteProject(id: string): Promise<void> {
    const db = await this.init();

    // Get all photos for this project first
    const photos = await this.getProjectPhotos(id);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.PROJECTS, STORES.PHOTOS, STORES.THUMBNAILS, STORES.SYNC_QUEUE],
        'readwrite'
      );

      // Delete project
      const projectStore = transaction.objectStore(STORES.PROJECTS);
      projectStore.delete(id);

      // Delete all photos for this project
      const photoStore = transaction.objectStore(STORES.PHOTOS);
      const thumbStore = transaction.objectStore(STORES.THUMBNAILS);
      
      photos.forEach(photo => {
        photoStore.delete(photo.id);
        thumbStore.delete(photo.id);
      });

      // Delete related sync queue items
      const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);
      const queueRequest = queueStore.getAll();
      
      queueRequest.onsuccess = () => {
        const allQueueItems: SyncQueueItem[] = queueRequest.result;
        const itemsToDelete = allQueueItems.filter(
          item => 
            // Delete queue items for the project itself
            item.localId === id ||
            // Delete queue items scoped to this project
            item.projectId === id ||
            // Delete queue items for photos in this project
            photos.some(p => p.id === item.localId)
        );
        
        itemsToDelete.forEach(item => {
          queueStore.delete(item.id);
        });
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Add item to sync queue
   */
  async addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt'>): Promise<SyncQueueItem> {
    const db = await this.init();
    const id = crypto.randomUUID();

    const queueItem: SyncQueueItem = {
      ...item,
      id,
      createdAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.add(queueItem);

      request.onsuccess = () => resolve(queueItem);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get pending sync items
   */
  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readonly');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.getAll();

      request.onsuccess = () => {
        // Sort by creation time
        const items = request.result.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Remove item from sync queue
   */
  async removeFromSyncQueue(id: string): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Update sync queue item retry count
   */
  async updateSyncQueueItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
    const db = await this.init();

    return new Promise(async (resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (!item) {
          reject(new Error('Sync queue item not found'));
          return;
        }

        const updated = { ...item, ...updates };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Get storage usage stats
   */
  async getStorageStats(): Promise<{ used: number; quota: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      return {
        used,
        quota,
        available: quota - used,
      };
    }
    return { used: 0, quota: 0, available: 0 };
  }

  /**
   * Clear all data (for testing/reset)
   */
  async clearAll(): Promise<void> {
    const db = await this.init();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(
        [STORES.PHOTOS, STORES.PROJECTS, STORES.SYNC_QUEUE, STORES.THUMBNAILS],
        'readwrite'
      );

      transaction.objectStore(STORES.PHOTOS).clear();
      transaction.objectStore(STORES.PROJECTS).clear();
      transaction.objectStore(STORES.SYNC_QUEUE).clear();
      transaction.objectStore(STORES.THUMBNAILS).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

// Export singleton instance
export const indexedDB = new IndexedDBManager();
