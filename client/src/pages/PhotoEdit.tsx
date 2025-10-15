import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { PhotoAnnotationEditor } from '@/components/PhotoAnnotationEditor';
import { indexedDB as idb } from '@/lib/indexeddb';
import { useQuery } from '@tanstack/react-query';

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

interface Tag {
  id: string;
  name: string;
  color: string;
}

export default function PhotoEdit() {
  const { id: photoId } = useParams();
  const [, setLocation] = useLocation();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const photoUrlRef = useRef<string | null>(null);

  // Fetch available tags
  const { data: availableTags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
    enabled: true,
  });

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
          
          // Load photo tags from server
          try {
            const tagsResponse = await fetch(`/api/photos/${photoId}/tags`, {
              headers: { 'x-skip-auth': 'true' }
            });
            if (tagsResponse.ok) {
              const photoTags = await tagsResponse.json();
              setCurrentTags(photoTags.map((pt: any) => pt.tagId));
            }
          } catch (err) {
            console.error('Error loading photo tags:', err);
          }
          
          return;
        }

        const response = await fetch(`/api/photos/${photoId}`);
        if (!response.ok) {
          throw new Error('Photo not found');
        }
        const serverPhoto = await response.json();
        setPhotoUrl(serverPhoto.url);
        setProjectId(serverPhoto.projectId);
        
        // Load photo tags
        try {
          const tagsResponse = await fetch(`/api/photos/${photoId}/tags`, {
            headers: { 'x-skip-auth': 'true' }
          });
          if (tagsResponse.ok) {
            const photoTags = await tagsResponse.json();
            setCurrentTags(photoTags.map((pt: any) => pt.tagId));
          }
        } catch (err) {
          console.error('Error loading photo tags:', err);
        }
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

  const handleSave = async (annotations: Annotation[], annotatedBlob: Blob, selectedTagIds: string[]) => {
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
      
      // Update photo tags if they changed
      if (JSON.stringify(selectedTagIds.sort()) !== JSON.stringify(currentTags.sort())) {
        // Delete existing tags
        await fetch(`/api/photos/${photoId}/tags`, {
          method: 'DELETE',
          headers: { 'x-skip-auth': 'true' }
        });
        
        // Add new tags
        for (const tagId of selectedTagIds) {
          await fetch(`/api/photos/${photoId}/tags`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-skip-auth': 'true'
            },
            body: JSON.stringify({ tagId })
          });
        }
      }

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

      // Return to camera with project selected
      setLocation(projectId ? `/camera?projectId=${projectId}` : '/camera');
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
    // Return to camera with project selected
    setLocation(projectId ? `/camera?projectId=${projectId}` : '/camera');
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
      availableTags={availableTags}
      selectedTagIds={currentTags}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
