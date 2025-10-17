import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';
import { UpgradeModal } from '@/components/UpgradeModal';
import { PhotoAnnotationEditor } from '@/components/PhotoAnnotationEditor';
import { indexedDB as idb } from '@/lib/indexeddb';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Annotation {
  id: string;
  type: "text" | "arrow" | "line" | "circle" | "pen" | "measurement";
  content?: string;
  color: string;
  strokeWidth: number;
  fontSize?: number;
  feet?: number;
  inches?: number;
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

// Todo form schema
const todoFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  assignedTo: z.string().min(1, 'Please assign to a team member'),
});

type TodoFormValues = z.infer<typeof todoFormSchema>;

export default function PhotoEdit() {
  const { id: photoId } = useParams();
  const [, setLocation] = useLocation();
  const { canWrite, isTrialExpired, isPastDue, isCanceled } = useSubscriptionAccess();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const { toast } = useToast();
  const photoUrlRef = useRef<string | null>(null);
  
  // Check if we should create a todo after save
  const urlParams = new URLSearchParams(window.location.search);
  const shouldCreateTodo = urlParams.get('createTodo') === 'true';
  const todoProjectId = urlParams.get('projectId');
  
  // Fetch team members for assignment
  const { data: teamMembers = [] } = useQuery<{ id: string; email: string; fullName: string | null }[]>({
    queryKey: ['/api/users/company'],
  });
  
  // Todo creation form
  const todoForm = useForm<TodoFormValues>({
    resolver: zodResolver(todoFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assignedTo: '',
    },
  });
  
  // Todo creation mutation
  const createTodoMutation = useMutation({
    mutationFn: async (data: TodoFormValues) => {
      const response = await apiRequest('POST', '/api/todos', {
        ...data,
        projectId: todoProjectId || projectId,
        photoId: photoId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({
        title: 'To-Do Created',
        description: 'Task has been assigned successfully',
        duration: 2000,
      });
      setTodoDialogOpen(false);
      // Navigate to todos page
      setLocation('/todos');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create to-do',
        description: error.message,
        variant: 'destructive',
      });
    },
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
        console.error('[PhotoEdit] Error loading photo:', error);
        toast({
          title: 'Photo not found',
          description: 'The photo could not be loaded',
          variant: 'destructive',
        });
        setLocation('/projects');
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

    // Check subscription access
    if (!canWrite) {
      setUpgradeModalOpen(true);
      return;
    }

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
          mediaType: 'photo',
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

      // If we should create a todo, show the dialog
      if (shouldCreateTodo) {
        setTodoDialogOpen(true);
      } else {
        // Return to camera with project context
        if (projectId) {
          setLocation(`/camera?projectId=${projectId}`);
        } else {
          setLocation('/camera');
        }
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
    <>
      <PhotoAnnotationEditor
        photoUrl={photoUrl}
        photoId={photoId!}
        existingAnnotations={[]}
        onSave={handleSave}
        onCancel={handleCancel}
        onDelete={handleDelete}
      />
      
      {/* Upgrade Modal */}
      <UpgradeModal 
        open={upgradeModalOpen} 
        onClose={() => setUpgradeModalOpen(false)}
        reason={isTrialExpired ? 'trial_expired' : isPastDue ? 'past_due' : isCanceled ? 'canceled' : 'trial_expired'}
      />
      
      {/* Todo Creation Dialog */}
      <Dialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create To-Do</DialogTitle>
            <DialogDescription>
              Assign this task to a team member
            </DialogDescription>
          </DialogHeader>
          
          <Form {...todoForm}>
            <form onSubmit={todoForm.handleSubmit((data) => createTodoMutation.mutate(data))} className="space-y-4">
              <FormField
                control={todoForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Fix electrical outlet" data-testid="input-todo-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={todoForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Additional details..." rows={3} data-testid="input-todo-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={todoForm.control}
                name="assignedTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-todo-assignee">
                          <SelectValue placeholder="Select team member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.fullName || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setTodoDialogOpen(false);
                    // Navigate back to camera
                    if (projectId) {
                      setLocation(`/camera?projectId=${projectId}`);
                    } else {
                      setLocation('/camera');
                    }
                  }}
                  data-testid="button-cancel-todo"
                >
                  Skip
                </Button>
                <Button 
                  type="submit" 
                  disabled={createTodoMutation.isPending}
                  data-testid="button-create-todo"
                >
                  {createTodoMutation.isPending ? 'Creating...' : 'Create To-Do'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
