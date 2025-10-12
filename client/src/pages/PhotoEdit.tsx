import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { PhotoAnnotationEditor } from '@/components/PhotoAnnotationEditor';
import { indexedDB as idb } from '@/lib/indexeddb';

interface Annotation {
  id: string;
  type: "text" | "arrow" | "line" | "circle" | "pen";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  position: {
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
  };
}

export default function PhotoEdit() {
  const { id: photoId } = useParams();
  const [, setLocation] = useLocation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const photoUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!photoId) return;

    const loadPhoto = async () => {
      try {
        const photo = await idb.getPhoto(photoId);
        if (photo && photo.blob) {
          const url = URL.createObjectURL(photo.blob);
          photoUrlRef.current = url;
          setPhotoUrl(url);
          setProjectId(photo.projectId);
          return;
        }

        const response = await fetch(`/api/photos/${photoId}`);
        if (!response.ok) {
          throw new Error('Photo not found');
        }
        const serverPhoto = await response.json();
        setPhotoUrl(serverPhoto.url);
        setProjectId(serverPhoto.projectId);
      } catch (error) {
        console.error('Error loading photo:', error);
        toast({
          title: 'Photo not found',
          description: 'The photo could not be loaded',
          variant: 'destructive',
        });
        setLocation('/camera');
      }
    };

    loadPhoto();

    return () => {
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }
    };
  }, [photoId]);

  const handleSave = async (annotations: Annotation[]) => {
    if (!photoId || !projectId) return;

    setIsSaving(true);

    try {
      if (annotations.length > 0) {
        await idb.addToSyncQueue({
          type: 'annotation',
          localId: photoId,
          projectId: projectId,
          action: 'create',
          data: { annotations },
          retryCount: 0,
        });
      }

      toast({
        title: '✓ Saved',
        description: annotations.length > 0 
          ? `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} will sync when online`
          : 'Photo saved',
        duration: 1500,
      });

      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }

      setLocation('/camera');
    } catch (error) {
      console.error('Error saving annotations:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (photoUrlRef.current) {
      URL.revokeObjectURL(photoUrlRef.current);
      photoUrlRef.current = null;
    }
    setLocation('/camera');
  };

  if (!photoUrl) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Loading photo...</p>
        </div>
      </div>
    );
  }

  return (
    <PhotoAnnotationEditor
      photoUrl={photoUrl}
      photoId={photoId!}
      existingAnnotations={[]}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
