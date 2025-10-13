import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle, FolderOpen, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import type { Project, Photo } from '@shared/schema';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Trash() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'project' | 'photo', id: string } | null>(null);

  const { data: deletedProjects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/trash/projects'],
  });

  const { data: deletedPhotos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ['/api/trash/photos'],
  });

  const restoreProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/trash/projects/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Project restored',
        description: 'The project has been restored successfully.',
      });
    },
  });

  const restorePhotoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/trash/photos/${id}/restore`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/photos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({
        title: 'Photo restored',
        description: 'The photo has been restored successfully.',
      });
    },
  });

  const permanentDeleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/trash/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/projects'] });
      toast({
        title: 'Project deleted permanently',
        description: 'The project has been permanently deleted.',
      });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
  });

  const permanentDeletePhotoMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/trash/photos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trash/photos'] });
      toast({
        title: 'Photo deleted permanently',
        description: 'The photo has been permanently deleted.',
      });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
  });

  const handlePermanentDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'project') {
      permanentDeleteProjectMutation.mutate(itemToDelete.id);
    } else {
      permanentDeletePhotoMutation.mutate(itemToDelete.id);
    }
  };

  const getDaysUntilDeletion = (deletedAt: Date | string | null) => {
    if (!deletedAt) return 30;
    const date = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt;
    const daysPassed = differenceInDays(new Date(), date);
    return Math.max(0, 30 - daysPassed);
  };

  const isLoading = projectsLoading || photosLoading;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/settings')}
            data-testid="button-back-to-settings"
            aria-label="Back to settings"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Trash</h1>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/30 p-4">
        <div className="flex items-start gap-3 max-w-screen-sm mx-auto">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Items in trash are automatically deleted after 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading trash...</div>
          </div>
        ) : deletedProjects.length === 0 && deletedPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center max-w-md">
              <Trash2 className="w-16 h-16 mb-4 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold mb-2">Trash is empty</h2>
              <p className="text-muted-foreground">Deleted items will appear here for 30 days before being permanently removed.</p>
            </div>
          </div>
        ) : (
          <div className="max-w-screen-sm mx-auto p-4 space-y-6">
            {/* Deleted Projects */}
            {deletedProjects.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" />
                  Deleted Projects ({deletedProjects.length})
                </h2>
                <div className="space-y-2">
                  {deletedProjects.map((project) => {
                    const daysLeft = getDaysUntilDeletion(project.deletedAt);
                    return (
                      <Card key={project.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate" data-testid={`text-project-name-${project.id}`}>
                              {project.name}
                            </h3>
                            {project.deletedAt && (
                              <p className="text-sm text-muted-foreground">
                                Deleted {format(new Date(project.deletedAt), 'MMM d, yyyy')} • {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreProjectMutation.mutate(project.id)}
                              disabled={restoreProjectMutation.isPending}
                              data-testid={`button-restore-project-${project.id}`}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setItemToDelete({ type: 'project', id: project.id });
                                setDeleteConfirmOpen(true);
                              }}
                              data-testid={`button-delete-project-${project.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Deleted Photos */}
            {deletedPhotos.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Image className="w-5 h-5" />
                  Deleted Photos ({deletedPhotos.length})
                </h2>
                <div className="space-y-2">
                  {deletedPhotos.map((photo) => {
                    const daysLeft = getDaysUntilDeletion(photo.deletedAt);
                    return (
                      <Card key={photo.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <img
                              src={photo.url}
                              alt={photo.caption || 'Deleted photo'}
                              className="w-16 h-16 object-cover rounded"
                              data-testid={`img-photo-${photo.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {photo.caption || 'Untitled photo'}
                              </p>
                              {photo.deletedAt && (
                                <p className="text-xs text-muted-foreground">
                                  Deleted {format(new Date(photo.deletedAt), 'MMM d, yyyy')} • {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restorePhotoMutation.mutate(photo.id)}
                              disabled={restorePhotoMutation.isPending}
                              data-testid={`button-restore-photo-${photo.id}`}
                            >
                              <RotateCcw className="w-4 h-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setItemToDelete({ type: 'photo', id: photo.id });
                                setDeleteConfirmOpen(true);
                              }}
                              data-testid={`button-delete-photo-${photo.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {itemToDelete?.type} from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-permanent-delete"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
