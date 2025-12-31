import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { indexedDB as idb } from '@/lib/indexeddb';
import { getApiUrl } from '@/lib/apiUrl';
import { formatDistanceToNow } from 'date-fns';

export default function PhotoView() {
  const { id: photoId } = useParams();
  const [, setLocation] = useLocation();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [photographerName, setPhotographerName] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const { toast } = useToast();
  const mediaUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!photoId) return;

    const loadMedia = async () => {
      try {
        // Try to load from IndexedDB first
        const photo = await idb.getPhoto(photoId);
        if (photo) {
          const url = URL.createObjectURL(photo.blob);
          mediaUrlRef.current = url;
          setMediaUrl(url);
          setMediaType(photo.mediaType);
          setProjectId(photo.projectId);
          
          // Use cached photographer metadata from IndexedDB for offline viewing
          if (photo.photographerName) {
            setPhotographerName(photo.photographerName);
          }
          if (photo.timestamp) {
            setCreatedAt(new Date(photo.timestamp).toISOString());
          }
          
          // Fetch latest metadata from server to refresh cache (non-blocking)
          try {
            const response = await fetch(getApiUrl(`/api/photos/${photoId}`), { credentials: 'include' });
            if (response.ok) {
              const serverPhoto = await response.json();
              
              // Update UI state
              if (serverPhoto.photographerName) {
                setPhotographerName(serverPhoto.photographerName);
              }
              if (serverPhoto.createdAt) {
                setCreatedAt(serverPhoto.createdAt);
              }
              
              // Persist refreshed metadata to IndexedDB for offline viewing (only update if present)
              const metadataUpdate: Partial<typeof photo> = {};
              if (serverPhoto.photographerId) metadataUpdate.photographerId = serverPhoto.photographerId;
              if (serverPhoto.photographerName) metadataUpdate.photographerName = serverPhoto.photographerName;
              if (serverPhoto.createdAt) {
                metadataUpdate.timestamp = new Date(serverPhoto.createdAt).getTime();
              }
              
              if (Object.keys(metadataUpdate).length > 0) {
                await idb.updatePhoto(photoId, metadataUpdate);
              }
            }
          } catch (metadataError) {
            console.warn('Failed to fetch latest photo metadata:', metadataError);
          }
          return;
        }

        // Fallback to server if not in IndexedDB
        const response = await fetch(getApiUrl(`/api/photos/${photoId}`), { credentials: 'include' });
        if (!response.ok) throw new Error('Photo not found');
        
        const serverPhoto = await response.json();
        setMediaUrl(getApiUrl(serverPhoto.url));
        // Use mediaType from server if available, otherwise default to 'photo'
        setMediaType(serverPhoto.mediaType || 'photo');
        setProjectId(serverPhoto.projectId);
        setPhotographerName(serverPhoto.photographerName);
        setCreatedAt(serverPhoto.createdAt);
      } catch (error) {
        console.error('Error loading media:', error);
        toast({
          title: 'Failed to load media',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    };

    loadMedia();

    return () => {
      if (mediaUrlRef.current) {
        URL.revokeObjectURL(mediaUrlRef.current);
      }
    };
  }, [photoId]);

  const handleBack = () => {
    if (projectId) {
      setLocation(`/camera?projectId=${projectId}`);
    } else {
      setLocation('/camera');
    }
  };

  const handleDelete = async () => {
    if (!photoId) return;

    try {
      await idb.deletePhoto(photoId);
      
      if (mediaUrlRef.current) {
        URL.revokeObjectURL(mediaUrlRef.current);
        mediaUrlRef.current = null;
      }

      toast({
        title: 'Video deleted',
        description: 'Video removed from session',
        duration: 1500,
      });

      handleBack();
    } catch (error) {
      console.error('Error deleting video:', error);
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (!mediaUrl) {
    return (
      <div className="flex items-center justify-center h-dvh bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent pt-safe-2 pb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="min-touch rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="min-touch rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
            data-testid="button-delete"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>

        {/* Photo Attribution */}
        {(photographerName || createdAt) && (
          <div className="flex items-center gap-2 text-white/90 text-sm backdrop-blur-sm bg-white/10 rounded-lg px-3 py-2 w-fit" data-testid="photo-attribution">
            <User className="w-4 h-4" />
            <div className="flex flex-col">
              {photographerName && (
                <span className="font-medium" data-testid="photographer-name">{photographerName}</span>
              )}
              {createdAt && (
                <span className="text-xs text-white/70" data-testid="photo-timestamp">
                  {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Media Display */}
      <div className="flex items-center justify-center h-full">
        {mediaType === 'video' ? (
          <video
            src={mediaUrl}
            controls
            autoPlay
            className="max-w-full max-h-full"
            data-testid="video-player"
          />
        ) : (
          <img
            src={mediaUrl}
            alt="Photo"
            className="max-w-full max-h-full object-contain"
            data-testid="image-viewer"
          />
        )}
      </div>
    </div>
  );
}
