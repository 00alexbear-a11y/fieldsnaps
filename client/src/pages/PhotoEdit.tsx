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
        window.history.back();
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

  const handleSave = async (annotations: Annotation[], annotatedBlob: Blob) => {
    if (!photoId || !projectId) return;

    setIsSaving(true);

    try {
      // Check if photo exists in IndexedDB
      let existingPhoto = await idb.getPhoto(photoId);
      
      // If photo not in IndexedDB (e.g., it's a server-synced photo), create it first
      if (!existingPhoto) {
        // Fetch the original photo from server
        const response = await fetch(`/api/photos/${photoId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch photo from server');
        }
        const serverPhoto = await response.json();
        
        // Fetch the photo blob
        const blobResponse = await fetch(serverPhoto.url);
        if (!blobResponse.ok) {
          throw new Error('Failed to fetch photo blob from server');
        }
        const originalBlob = await blobResponse.blob();
        
        // Create photo entry in IndexedDB with correct ID using helper method
        existingPhoto = await idb.savePhotoWithId(photoId, {
          projectId: projectId,
          blob: originalBlob,
          caption: serverPhoto.caption || null,
          annotations: null,
          serverId: photoId,
          quality: 'detailed',
          timestamp: Date.now(),
          syncStatus: 'synced',
          retryCount: 0,
        });
      }

      // Update the photo with the annotated version
      await idb.updatePhoto(photoId, {
        blob: annotatedBlob,
        annotations: annotations.length > 0 ? JSON.stringify(annotations) : null,
      });

      // Add to sync queue to upload the annotated photo to server
      await idb.addToSyncQueue({
        type: 'photo',
        localId: photoId,
        projectId: projectId,
        action: 'update',
        data: { 
          blob: annotatedBlob,
          annotations: annotations.length > 0 ? JSON.stringify(annotations) : null,
        },
        retryCount: 0,
      });

      toast({
        title: '✓ Saved',
        description: annotations.length > 0 
          ? `Annotations saved and will sync when online`
          : 'Photo saved',
        duration: 1500,
      });

      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }

      // Return to camera with project context
      if (projectId) {
        setLocation(`/camera?projectId=${projectId}`);
      } else {
        setLocation('/camera');
      }
    } catch (error) {
      console.error('[PhotoEdit] Error saving annotations:', error);
      toast({
        title: 'Failed to save annotations',
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
    // Return to camera with project context
    if (projectId) {
      setLocation(`/camera?projectId=${projectId}`);
    } else {
      setLocation('/camera');
    }
  };

  const handleDelete = async () => {
    if (!photoId || !projectId) return;

    try {
      // Delete photo from IndexedDB
      await idb.deletePhoto(photoId);
      
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }

      toast({
        title: 'Photo deleted',
        description: 'Photo removed from session',
        duration: 1500,
      });

      // Return to camera with project context
      if (projectId) {
        setLocation(`/camera?projectId=${projectId}`);
      } else {
        setLocation('/camera');
      }
    } catch (error) {
      console.error('[PhotoEdit] Error deleting photo:', error);
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
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
      onDelete={handleDelete}
    />
  );
}
