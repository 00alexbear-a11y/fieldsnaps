import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { indexedDB as idb } from '@/lib/indexeddb';

export default function PhotoView() {
  const { id: photoId } = useParams();
  const [, setLocation] = useLocation();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
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
          return;
        }

        // Fallback to server if not in IndexedDB
        const response = await fetch(`/api/photos/${photoId}`);
        if (!response.ok) throw new Error('Photo not found');
        
        const serverPhoto = await response.json();
        setMediaUrl(serverPhoto.url);
        // Use mediaType from server if available, otherwise default to 'photo'
        setMediaType(serverPhoto.mediaType || 'photo');
        setProjectId(serverPhoto.projectId);
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
      <div className="flex items-center justify-center h-screen bg-black">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent pt-safe-2 pb-4 px-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white"
            data-testid="button-delete"
          >
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
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
