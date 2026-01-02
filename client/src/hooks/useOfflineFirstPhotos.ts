import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { indexedDB as idb, createPhotoUrl, type LocalPhoto } from '@/lib/indexeddb';
import type { Photo, Tag } from '../../../shared/schema';
import { getPhotoImageUrl, getPhotoThumbnailUrl } from '@/lib/photoUrls';
import { apiRequest } from '@/lib/queryClient';

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
// Cache for signed URLs with expiry times - scoped by projectId
// Structure: Map<projectId, Map<photoId, { url, thumbnailUrl, expiresAt }>>
const signedUrlCacheByProject = new Map<string, Map<string, { url: string; thumbnailUrl: string | null; expiresAt: number }>>();
const SIGNED_URL_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// Helper to get project-scoped cache
function getProjectCache(projectId: string) {
  if (!signedUrlCacheByProject.has(projectId)) {
    signedUrlCacheByProject.set(projectId, new Map());
  }
  return signedUrlCacheByProject.get(projectId)!;
}

export function useOfflineFirstPhotos(projectId: string) {
  const [localPhotos, setLocalPhotos] = useState<PhotoWithStatus[]>([]);
  const [isLoadingLocal, setIsLoadingLocal] = useState(true);
  const [signedUrls, setSignedUrls] = useState<Record<string, { signedUrl: string | null; signedThumbnailUrl: string | null }>>({});
  const isNative = Capacitor.isNativePlatform();
  const prevProjectIdRef = useRef<string>(projectId);
  
  // Use ref to track blob URLs created during async load
  const blobUrlsRef = useRef<Map<string, string>>(new Map());

  // Fetch from server in background
  const {
    data: serverResponse,
    isLoading: isLoadingServer,
    error: serverError,
    dataUpdatedAt,
  } = useQuery<{ photos: Photo[]; nextCursor?: string }>({
    queryKey: ['/api/projects', projectId, 'photos'],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to prevent infinite refetch loops
    retry: false, // Don't retry if offline
    meta: {
      skipErrorToast: true, // Handle errors gracefully
    },
  });
  
  const serverPhotos = serverResponse?.photos || [];

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

          // Create thumbnail URL from thumbnailBlob if available (for videos)
          let thumbnailUrl: string | null = null;
          if (p.thumbnailBlob) {
            thumbnailUrl = URL.createObjectURL(p.thumbnailBlob);
            newBlobUrls.set(`${p.id}-thumb`, thumbnailUrl);
          }

          return {
            id: p.serverId || p.id, // Use serverId if available
            projectId: projectId,
            url: blobUrl, // Use blob URL for local photos
            thumbnailUrl, // Use blob URL for thumbnail if available
            mediaType: p.mediaType,
            caption: p.caption || null,
            width: p.width || null,
            height: p.height || null,
            photographerId: p.photographerId || null,
            photographerName: p.photographerName || null,
            sessionId: p.sessionId || null, // Camera session grouping
            unitLabel: p.unitLabel || null,
            createdAt: p.createdAt ? new Date(p.createdAt) : (p.timestamp ? new Date(p.timestamp) : new Date()),
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

  // Clear signed URLs when project changes
  useEffect(() => {
    if (prevProjectIdRef.current !== projectId) {
      setSignedUrls({});
      prevProjectIdRef.current = projectId;
    }
  }, [projectId]);

  // Fetch signed URLs for native platforms (iOS/Android)
  // Native <img> tags can't include Authorization headers, so we need pre-signed URLs
  useEffect(() => {
    if (!isNative || serverPhotos.length === 0) return;

    const fetchSignedUrls = async () => {
      const projectCache = getProjectCache(projectId);
      
      // Filter photos that need signed URLs (not videos, have URL)
      const photoIds = serverPhotos
        .filter(p => p.mediaType !== 'video' && (p.url || p.thumbnailUrl))
        .map(p => p.id);

      if (photoIds.length === 0) return;

      // Check cache for valid URLs
      const now = Date.now();
      const needsRefresh = photoIds.filter(id => {
        const cached = projectCache.get(id);
        return !cached || cached.expiresAt - SIGNED_URL_REFRESH_BUFFER < now;
      });

      if (needsRefresh.length === 0) {
        // All URLs are cached and valid
        const cachedUrls: Record<string, { signedUrl: string | null; signedThumbnailUrl: string | null }> = {};
        photoIds.forEach(id => {
          const cached = projectCache.get(id);
          if (cached) {
            cachedUrls[id] = { signedUrl: cached.url, signedThumbnailUrl: cached.thumbnailUrl };
          }
        });
        setSignedUrls(cachedUrls);
        return;
      }

      try {
        const response = await apiRequest(
          'POST',
          '/api/photos/batch-signed-urls',
          { photoIds: needsRefresh }
        );
        
        const data = await response.json() as { 
          signedUrls: Record<string, { signedUrl: string | null; signedThumbnailUrl: string | null }>;
          expiresAt: string;
        };
        
        const expiresAt = new Date(data.expiresAt).getTime();
        
        // Update project-scoped cache
        Object.entries(data.signedUrls).forEach(([id, urls]) => {
          projectCache.set(id, {
            url: urls.signedUrl || '',
            thumbnailUrl: urls.signedThumbnailUrl,
            expiresAt,
          });
        });

        // Merge with existing cached URLs for this project
        const allUrls: Record<string, { signedUrl: string | null; signedThumbnailUrl: string | null }> = {};
        photoIds.forEach(id => {
          const cached = projectCache.get(id);
          if (cached) {
            allUrls[id] = { signedUrl: cached.url, signedThumbnailUrl: cached.thumbnailUrl };
          }
        });
        
        setSignedUrls(allUrls);
      } catch (error) {
        console.error('[Native] Failed to fetch signed URLs:', error);
        // Clear signed URLs on error to prevent using stale/unauthorized URLs
        setSignedUrls({});
      }
    };

    fetchSignedUrls();
  }, [isNative, serverPhotos, projectId]);

  // Merge local and server photos (dedupe by ID)
  const mergedPhotos = useMemo(() => {
    if (serverPhotos.length > 0) {
      // Server data available - use it
      const serverPhotosWithStatus: PhotoWithStatus[] = serverPhotos.map(p => {
        // Videos always use raw URL (for <video> element playback)
        if (p.mediaType === 'video') {
          return {
            ...p,
            syncStatus: 'synced' as const,
            isLocal: false,
          };
        }

        // For native platforms, use signed URLs if available
        // For web, use proxy URLs (cookies work fine)
        const signedUrlData = isNative ? signedUrls[p.id] : null;
        
        return {
          ...p,
          url: signedUrlData?.signedUrl || getPhotoImageUrl(p.id, p.url),
          thumbnailUrl: signedUrlData?.signedThumbnailUrl || (p.thumbnailUrl ? getPhotoThumbnailUrl(p.id, p.thumbnailUrl) : null),
          syncStatus: 'synced' as const,
          isLocal: false,
        };
      });

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
  }, [localPhotos, serverPhotos, signedUrls, isNative]);

  // Overall loading state
  const isLoading = isLoadingLocal && isLoadingServer;

  return {
    photos: mergedPhotos,
    isLoading,
    isOnline: serverPhotos.length > 0 || !serverError,
    hasLocalData: localPhotos.length > 0,
  };
}
