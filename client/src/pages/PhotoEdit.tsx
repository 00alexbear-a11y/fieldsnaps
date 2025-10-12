import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PhotoAnnotationEditor } from '@/components/PhotoAnnotationEditor';
import { indexedDB as idb } from '@/lib/indexeddb';
import { apiRequest, queryClient } from '@/lib/queryClient';

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

    // Load photo from IndexedDB
    const loadPhoto = async () => {
      try {
        const photo = await idb.getPhoto(photoId);
        if (photo && photo.blob) {
          const url = URL.createObjectURL(photo.blob);
          photoUrlRef.current = url;
          setPhotoUrl(url);
          setProjectId(photo.projectId);
        } else {
          toast({
            title: 'Photo not found',
            description: 'The photo could not be loaded',
            variant: 'destructive',
          });
          setLocation('/camera');
        }
      } catch (error) {
        console.error('Error loading photo:', error);
        toast({
          title: 'Error loading photo',
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
      // Queue annotations for sync when online
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

      // Revoke URL only after successful save (before navigation)
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
      }

      // Return to camera to continue shooting
      setLocation('/camera');
    } catch (error) {
      console.error('Error saving annotations:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      // Keep URL valid so user can see image and retry
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Revoke URL before navigation (navigation is synchronous)
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
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b p-4 flex items-center justify-between bg-background z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={isSaving}
            data-testid="button-cancel-edit"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Annotate Photo</h1>
        </div>
        <Button
          onClick={() => {
            // Trigger save via the editor's save mechanism
            const saveButton = document.querySelector('[data-testid="button-save-annotations"]') as HTMLButtonElement;
            if (saveButton) saveButton.click();
          }}
          disabled={isSaving}
          data-testid="button-save-edit"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </header>

      <main className="flex-1 overflow-hidden">
        <PhotoAnnotationEditor
          photoUrl={photoUrl}
          photoId={photoId!}
          existingAnnotations={[]}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
