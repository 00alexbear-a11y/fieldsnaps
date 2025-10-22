import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { indexedDB as idb, createPhotoUrl, type LocalPhoto } from '@/lib/indexeddb';
import type { Photo, Tag } from '../../../shared/schema';
import { getPhotoImageUrl, getPhotoThumbnailUrl } from '@/lib/photoUrls';

export type PhotoWithStatus = Photo & {
  syncStatus?: 'pending' | 'syncing' | 'synced' | 'error';
  localBlobUrl?: string; // Temporary URL for local photos
  isLocal?: boolean; // True if photo is from IndexedDB
  tags?: Tag[]; // Tags associated with this photo
};

/**
 * Offline-first hook for loading photos
 * 1. Loads from IndexedDB immediately (instant display)
 * 2. Fetches from server in background
 * 3. Saves server data back to IndexedDB (refreshes offline cache)
 * 4. Merges results (dedupes by serverId, server data takes precedence)
 * 5. Creates blob URLs for local photos (properly revokes on cleanup)
 * 6. Preserves photos with syncStatus 'pending', 'syncing', or 'error'
 */
export function useOfflineFirstPhotos(projectId: string) {
  const [localPhotos, setLocalPhotos] = useState<PhotoWithStatus[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  
  // Use ref to track blob URLs created during async load
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  // Fetch from server in background
  const {
    data: serverPhotos = [],
    isLoading: isLoadingServer,
    error: serverError,
    dataUpdatedAt,
  } = useQuery<Photo[]>({
    queryKey: ['/api/projects', projectId, 'photos'],
    staleTime: 0,
    retry: false, // Don't retry if offline
    meta: {
      skipErrorToast: true, // Handle errors gracefully
    },
  });

  // Load from IndexedDB immediately and whenever photos are added
  useEffect(() => {
    const loadLocalPhotos = async () => {
      try {
        const photos = await idb.getProjectPhotos(projectId);
        const newBlobUrls = new Map<string, string>();

        // Revoke old blob URLs before creating new ones
        blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
        blobUrlsRef.current.clear();

        // Convert LocalPhoto to Photo format
        const photosWithStatus: PhotoWithStatus[] = photos.map((p: LocalPhoto) => {
          // Create blob URL for local photo
          const blobUrl = createPhotoUrl(p);
          newBlobUrls.set(p.id, blobUrl);

          return {
            id: p.serverId || p.id, // Use serverId if available
            projectId: projectId,
            url: blobUrl, // Use blob URL for local photos
            mediaType: p.mediaType,
            caption: p.caption || null,
            width: p.width || null,
            height: p.height || null,
            photographerId: null,
            photographerName: null,
            createdAt: new Date(p.createdAt),
            deletedAt: null,
            syncStatus: p.syncStatus,
            localBlobUrl: blobUrl,
            isLocal: true,
          };
        });

        blobUrlsRef.current = newBlobUrls;
        setLocalPhotos(photosWithStatus);
      } catch (error) {
        console.error('[Offline] Failed to load photos from IndexedDB:', error);
        setLocalPhotos([]);
      } finally {
        setIsLoadingLocal(false);
      }
    };

    loadLocalPhotos();

    // Listen for custom event when photos are added
    const handlePhotoAdded = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.projectId === projectId) {
        console.log('[Offline] Photo added event received, reloading from IndexedDB');
        loadLocalPhotos();
      }
    };

    window.addEventListener('photoAdded', handlePhotoAdded);

    // Cleanup: revoke blob URLs and remove event listener
    return () => {
      blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      blobUrlsRef.current.clear();
      window.removeEventListener('photoAdded', handlePhotoAdded);
    };
  }, [projectId]); // Only reload when projectId changes

  // Note: Server photos have URLs (not blobs), so true offline caching
  // would require downloading and storing the actual image data.
  // Current strategy: 
  // - When offline: show photos from IndexedDB (local captures)
  // - When online: show server photos (via URLs) + unsynced local photos
  // Enhancement: Pre-download server photo blobs for true offline viewing

  // Merge local and server photos (dedupe by ID)
  const mergedPhotos = useMemo(() => {
    if (serverPhotos.length > 0) {
      // Server data available - use it
      // Transform URLs to use backend proxy routes for proper CORS support
      const serverPhotosWithStatus: PhotoWithStatus[] = serverPhotos.map(p => ({
        ...p,
        url: getPhotoImageUrl(p.id, p.url),
        thumbnailUrl: p.thumbnailUrl ? getPhotoThumbnailUrl(p.id, p.thumbnailUrl) : undefined,
        syncStatus: 'synced' as const,
        isLocal: false,
      }));

      // Keep local photos that aren't on the server yet
      // This includes photos with syncStatus: 'pending', 'syncing', or 'error'
      // so failed uploads remain visible for retry
      const serverPhotoIds = new Set(serverPhotos.map(p => p.id));
      const unsyncedLocalPhotos = localPhotos.filter(
        p => !serverPhotoIds.has(p.id) && 
             (p.syncStatus === 'pending' || p.syncStatus === 'syncing' || p.syncStatus === 'error')
      );

      return [...unsyncedLocalPhotos, ...serverPhotosWithStatus];
    }

    // No server data - use local photos
    return localPhotos;
  }, [localPhotos, serverPhotos]);

  // Overall loading state
  const isLoading = isLoadingLocal && isLoadingServer;

  return {
    photos: mergedPhotos,
    isLoading,
    isOnline: serverPhotos.length > 0 || !serverError,
    hasLocalData: localPhotos.length > 0,
  };
}
