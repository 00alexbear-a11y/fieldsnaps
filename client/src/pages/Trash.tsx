import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { ArrowLeft, Trash2, RotateCcw, AlertTriangle, Home, Image, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import type { Project, Photo } from '@shared/schema';
import { getPhotoImageUrl } from '@/lib/photoUrls';
import { haptics } from '@/lib/nativeHaptics';
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [deleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);

  const { data: deletedProjects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['/api/trash/projects'],
  });

  const { data: rawDeletedPhotos = [], isLoading: photosLoading } = useQuery<Photo[]>({
    queryKey: ['/api/trash/photos'],
  });

  // Transform photo URLs to use proxy routes
  const deletedPhotos = useMemo(
    () => rawDeletedPhotos.map(photo => ({
      ...photo,
      url: getPhotoImageUrl(photo.id, photo.url),
    })),
    [rawDeletedPhotos]
  );

  const restoreProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('POST', `/api/trash/projects/${id}/restore`);
    },
    onSuccess: () => {
      haptics.success();
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
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['/api/trash/photos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Invalidate project-specific photo queries so restored photos appear
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === '/api/projects' && 
          query.queryKey[2] === 'photos'
      });
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
      haptics.warning();
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
      haptics.warning();
      queryClient.invalidateQueries({ queryKey: ['/api/trash/photos'] });
      toast({
        title: 'Photo deleted permanently',
        description: 'The photo has been permanently deleted.',
      });
      setDeleteConfirmOpen(false);
      setItemToDelete(null);
    },
  });

  const deleteAllTrashMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/trash/delete-all');
      return await response.json();
    },
    onSuccess: (data: { projectsDeleted: number; photosDeleted: number }) => {
      haptics.warning();
      queryClient.invalidateQueries({ queryKey: ['/api/trash/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trash/photos'] });
      toast({
        title: 'All trash deleted',
        description: `Permanently deleted ${data.projectsDeleted} projects and ${data.photosDeleted} photos.`,
      });
      setDeleteAllConfirmOpen(false);
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

  const handleBatchRestore = async () => {
    try {
      const restorePromises = [];
      
      // Restore selected projects
      for (const projectId of Array.from(selectedProjects)) {
        restorePromises.push(
          apiRequest('POST', `/api/trash/projects/${projectId}/restore`)
        );
      }
      
      // Restore selected photos
      for (const photoId of Array.from(selectedPhotos)) {
        restorePromises.push(
          apiRequest('POST', `/api/trash/photos/${photoId}/restore`)
        );
      }
      
      await Promise.all(restorePromises);
      
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['/api/trash/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trash/photos'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      // Invalidate project-specific photo queries so restored photos appear
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          query.queryKey[0] === '/api/projects' && 
          query.queryKey[2] === 'photos'
      });
      
      toast({
        title: 'Items restored',
        description: `Successfully restored ${selectedProjects.size + selectedPhotos.size} items.`,
      });
      
      // Reset selection
      setSelectedProjects(new Set());
      setSelectedPhotos(new Set());
      setSelectMode(false);
    } catch (error) {
      haptics.error();
      toast({
        title: 'Error',
        description: 'Failed to restore some items.',
        variant: 'destructive',
      });
    }
  };

  const toggleProjectSelection = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const getDaysUntilDeletion = (deletedAt: Date | string | null) => {
    if (!deletedAt) return 30;
    const date = typeof deletedAt === 'string' ? new Date(deletedAt) : deletedAt;
    const daysPassed = differenceInDays(new Date(), date);
    return Math.max(0, 30 - daysPassed);
  };

  const isLoading = projectsLoading || photosLoading;
  const totalSelected = selectedProjects.size + selectedPhotos.size;
  const hasItems = deletedProjects.length > 0 || deletedPhotos.length > 0;

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="flex items-center justify-between pt-safe-3 pb-3 px-4 border-b">
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
          <h1 className="text-xl font-semibold" data-testid="text-page-title">
            {selectMode ? `${totalSelected} Selected` : 'Trash'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedProjects(new Set());
                  setSelectedPhotos(new Set());
                }}
                data-testid="button-cancel-select"
              >
                Cancel
              </Button>
              {totalSelected > 0 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleBatchRestore}
                  data-testid="button-batch-restore"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Restore
                </Button>
              )}
            </>
          ) : (
            hasItems && !isLoading && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectMode(true)}
                data-testid="button-select-mode"
              >
                <CheckSquare className="w-4 h-4 mr-1" />
                Select
              </Button>
            )
          )}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-900/30 p-4">
        <div className="flex items-start justify-between gap-3 max-w-screen-sm mx-auto">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-900 dark:text-amber-100">
                Items in trash are automatically deleted after 30 days.
              </p>
            </div>
          </div>
          {hasItems && !isLoading && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive flex-shrink-0"
              onClick={() => setDeleteAllConfirmOpen(true)}
              data-testid="button-delete-all-trash"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete All
            </Button>
          )}
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
                  <Home className="w-5 h-5" />
                  Deleted Projects ({deletedProjects.length})
                </h2>
                <div className="space-y-2">
                  {deletedProjects.map((project) => {
                    const daysLeft = getDaysUntilDeletion(project.deletedAt);
                    const isSelected = selectedProjects.has(project.id);
                    return (
                      <Card key={project.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          {selectMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleProjectSelection(project.id)}
                              data-testid={`checkbox-project-${project.id}`}
                            />
                          )}
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
                          {!selectMode && (
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
                          )}
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
                    const isSelected = selectedPhotos.has(photo.id);
                    return (
                      <Card key={photo.id} className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          {selectMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePhotoSelection(photo.id)}
                              data-testid={`checkbox-photo-${photo.id}`}
                            />
                          )}
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
                          {!selectMode && (
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
                          )}
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

      {/* Delete All Trash Confirmation Dialog */}
      <AlertDialog open={deleteAllConfirmOpen} onOpenChange={setDeleteAllConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all trash?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all {deletedProjects.length} projects and {deletedPhotos.length} photos from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllTrashMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-all"
            >
              Delete All Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
