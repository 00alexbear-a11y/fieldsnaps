import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Camera, Settings as SettingsIcon, Check, Trash2, Share2, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PhotoAnnotationEditor } from "@/components/PhotoAnnotationEditor";
import { PhotoGestureViewer } from "@/components/PhotoGestureViewer";
import LazyImage from "@/components/LazyImage";
import type { Photo, Project } from "../../../shared/schema";
import { format } from "date-fns";

export default function ProjectPhotos() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editedProject, setEditedProject] = useState({ name: "", description: "", address: "", coverPhotoId: "" });
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState<string>("");
  const { toast } = useToast();

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: showMoveDialog,
  });

  // Sync editedProject with project data
  useEffect(() => {
    if (project) {
      setEditedProject({
        name: project.name || "",
        description: project.description || "",
        address: project.address || "",
        coverPhotoId: project.coverPhotoId || "",
      });
    }
  }, [project]);

  // Reset form when dialog opens
  useEffect(() => {
    if (showSettings && project) {
      setEditedProject({
        name: project.name || "",
        description: project.description || "",
        address: project.address || "",
        coverPhotoId: project.coverPhotoId || "",
      });
    }
  }, [showSettings, project]);

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/projects", projectId, "photos"],
  });

  // Group photos by date (newest first)
  const photosByDate = useMemo(() => {
    if (!photos.length) return [];

    // Sort photos by createdAt (newest first)
    const sortedPhotos = [...photos].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Group by date
    const groups = new Map<string, Photo[]>();
    sortedPhotos.forEach(photo => {
      const date = format(new Date(photo.createdAt), 'MMMM d, yyyy');
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(photo);
    });

    // Convert to array of { date, photos }
    return Array.from(groups.entries()).map(([date, photos]) => ({
      date,
      photos,
    }));
  }, [photos]);

  const { data: annotations = [] } = useQuery<any[]>({
    queryKey: ["/api/photos", selectedPhoto?.id, "annotations"],
    enabled: !!selectedPhoto,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Upload photo using multipart/form-data
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', file.name);
      
      const res = await fetch(`/api/projects/${projectId}/photos`, {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) {
        throw new Error(`Upload failed: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      toast({ title: "Photo uploaded successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (photoId: string) => {
      await apiRequest("DELETE", `/api/photos/${photoId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      toast({ title: "Photo deleted successfully" });
    },
    onError: () => {
      toast({ 
        title: "Failed to delete photo", 
        variant: "destructive" 
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: Partial<{ name: string; description: string; address: string; coverPhotoId: string }>) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project updated successfully" });
      setShowSettings(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update project", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const setCoverPhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      return await apiRequest("PATCH", `/api/projects/${projectId}`, { coverPhotoId: photoId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project icon updated" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update project icon", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const movePhotosMutation = useMutation({
    mutationFn: async ({ photoIds, targetProjectId }: { photoIds: string[]; targetProjectId: string }) => {
      // Move each photo to the target project
      await Promise.all(
        photoIds.map(photoId => 
          apiRequest("PATCH", `/api/photos/${photoId}`, { projectId: targetProjectId })
        )
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.targetProjectId, "photos"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: `${variables.photoIds.length} photo${variables.photoIds.length === 1 ? '' : 's'} moved successfully` });
      setShowMoveDialog(false);
      setSelectedPhotoIds(new Set());
      setIsSelectMode(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to move photos", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Project deleted successfully" });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to delete project", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
  };

  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    if (isSelectMode) {
      // Clear selection when exiting select mode
      setSelectedPhotoIds(new Set());
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    const newSelected = new Set(selectedPhotoIds);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotoIds(newSelected);
  };

  const toggleDateSelection = (datePhotos: Photo[]) => {
    const newSelected = new Set(selectedPhotoIds);
    const datePhotoIds = datePhotos.map(p => p.id);
    const allSelected = datePhotoIds.every(id => newSelected.has(id));
    
    if (allSelected) {
      // Deselect all photos from this date
      datePhotoIds.forEach(id => newSelected.delete(id));
    } else {
      // Select all photos from this date
      datePhotoIds.forEach(id => newSelected.add(id));
    }
    setSelectedPhotoIds(newSelected);
  };

  const isDateFullySelected = (datePhotos: Photo[]) => {
    return datePhotos.every(photo => selectedPhotoIds.has(photo.id));
  };

  const isDatePartiallySelected = (datePhotos: Photo[]) => {
    const selectedCount = datePhotos.filter(photo => selectedPhotoIds.has(photo.id)).length;
    return selectedCount > 0 && selectedCount < datePhotos.length;
  };

  const handleShareSelected = async () => {
    if (selectedPhotoIds.size === 0) {
      toast({
        title: 'No photos selected',
        description: 'Please select at least one photo to share',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Create share via API
      const response = await fetch('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          photoIds: Array.from(selectedPhotoIds),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      const share = await response.json();
      const shareUrl = `${window.location.origin}/share/${share.token}`;

      // Try to copy to clipboard (may fail in some browsers)
      let copiedToClipboard = false;
      try {
        await navigator.clipboard.writeText(shareUrl);
        copiedToClipboard = true;
        toast({
          title: 'Share link created!',
          description: `Link copied to clipboard. ${selectedPhotoIds.size} photo${selectedPhotoIds.size === 1 ? '' : 's'} shared.`,
        });
      } catch (clipboardError) {
        console.log('Clipboard write failed, will show dialog instead');
        toast({
          title: 'Share link created',
          description: 'Use the Copy button to copy the link',
        });
      }

      // Show the link in a dialog
      setShareLink(shareUrl);

      // Exit select mode
      setIsSelectMode(false);
      setSelectedPhotoIds(new Set());
    } catch (error) {
      console.error('Share error:', error);
      toast({
        title: 'Failed to create share link',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleSaveAnnotations = async (annotations: any[]) => {
    if (!selectedPhoto) return;

    try {
      // Delete existing annotations
      const existingRes = await fetch(`/api/photos/${selectedPhoto.id}/annotations`);
      const existing = await existingRes.json();
      
      for (const anno of existing) {
        await apiRequest("DELETE", `/api/annotations/${anno.id}`);
      }

      // Save new annotations
      for (const anno of annotations) {
        await apiRequest("POST", `/api/photos/${selectedPhoto.id}/annotations`, {
          type: anno.type,
          content: anno.content,
          color: anno.color,
          strokeWidth: anno.strokeWidth,
          fontSize: anno.fontSize,
          position: anno.position,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/photos", selectedPhoto.id, "annotations"] });
      toast({ title: `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} saved successfully` });
      setSelectedPhoto(null);
    } catch (error: any) {
      toast({ title: "Failed to save annotations", variant: "destructive", description: error.message });
    }
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <header className="border-b p-4 flex items-center justify-between bg-background sticky top-0 z-10 gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-shrink">
            <h1 className="text-lg sm:text-xl font-bold truncate">{project?.name || "Project Photos"}</h1>
            {project?.description && (
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 flex-shrink-0">
          {!isSelectMode && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                data-testid="button-project-settings"
                className="flex-shrink-0"
              >
                <SettingsIcon className="w-5 h-5" />
              </Button>
              {photos.length > 0 && (
                <Button
                  onClick={toggleSelectMode}
                  data-testid="button-select-mode"
                  size="sm"
                  className="flex-shrink-0"
                >
                  Select
                </Button>
              )}
            </>
          )}
          {isSelectMode && (
            <Button
              onClick={toggleSelectMode}
              variant="outline"
              data-testid="button-cancel-select"
              size="sm"
              className="flex-shrink-0"
            >
              Cancel
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center py-12">Loading photos...</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No photos yet</h2>
            <p className="text-muted-foreground mb-4">Tap the camera button below to get started</p>
            <label htmlFor="photo-upload-fab" className="text-sm text-primary hover:underline cursor-pointer">
              or choose from library
            </label>
          </div>
        ) : (
          <div className="space-y-8">
            {photosByDate.map(({ date, photos: datePhotos }) => (
              <div key={date} data-testid={`date-group-${date}`}>
                {/* Date Header with Checkbox */}
                <div className="flex items-center gap-3 mb-4">
                  {isSelectMode && (
                    <Checkbox
                      checked={isDateFullySelected(datePhotos)}
                      onCheckedChange={() => toggleDateSelection(datePhotos)}
                      data-testid={`checkbox-date-${date}`}
                      className="w-5 h-5"
                    />
                  )}
                  <h2 className="text-lg font-semibold text-foreground">
                    {date}
                  </h2>
                </div>
                
                {/* Photos Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {datePhotos.map((photo) => {
                    const photoIndex = photos.findIndex(p => p.id === photo.id);
                    const isSelected = selectedPhotoIds.has(photo.id);
                    return (
                      <div
                        key={photo.id}
                        className={`relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2 animate-scale-in touch-feedback ${
                          isSelectMode && isSelected ? 'ring-4 ring-primary' : ''
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            togglePhotoSelection(photo.id);
                          } else {
                            setViewerPhotoIndex(photoIndex);
                          }
                        }}
                        data-testid={`photo-${photo.id}`}
                      >
                        {isSelectMode && (
                          <div className="absolute top-2 left-2 z-10">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => togglePhotoSelection(photo.id)}
                              data-testid={`checkbox-photo-${photo.id}`}
                              className="w-6 h-6 bg-white/90 backdrop-blur-sm border-2"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        <LazyImage
                          src={photo.url}
                          alt={photo.caption || "Photo"}
                          className="w-full h-full object-cover"
                        />
                        {photo.photographerName && !isSelectMode && (
                          <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center text-[10px] font-medium">
                              {photo.photographerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </div>
                            <span className="font-medium">{photo.photographerName.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Selection Toolbar */}
      {isSelectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border p-4 safe-area-inset-bottom animate-in slide-in-from-bottom">
          <div className="max-w-screen-sm mx-auto flex items-center justify-between gap-4">
            <span className="text-sm font-medium">
              {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowMoveDialog(true)}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-move-selected"
              >
                <FolderInput className="w-4 h-4 mr-2" />
                Move
              </Button>
              <Button
                onClick={handleShareSelected}
                disabled={selectedPhotoIds.size === 0}
                data-testid="button-share-selected"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Gesture-enabled Photo Viewer */}
      {viewerPhotoIndex !== null && (
        <PhotoGestureViewer
          photos={photos}
          initialIndex={viewerPhotoIndex}
          onClose={() => setViewerPhotoIndex(null)}
          onDelete={(photoId) => deleteMutation.mutate(photoId)}
          onAnnotate={(photo) => {
            const fullPhoto = photos.find(p => p.id === photo.id);
            if (fullPhoto) {
              setViewerPhotoIndex(null);
              setSelectedPhoto(fullPhoto);
            }
          }}
          onShare={(photo) => {
            if (navigator.clipboard && window.isSecureContext) {
              toast({ title: "Photo URL copied to clipboard" });
            } else if (!navigator.share) {
              toast({ 
                title: "Sharing not available",
                description: "Please use a secure connection (HTTPS) to share photos",
                variant: "destructive"
              });
            }
          }}
          onSetCoverPhoto={(photoId) => setCoverPhotoMutation.mutate(photoId)}
        />
      )}

      {/* Annotation Editor Dialog (can be accessed via long-press in future) */}
      {selectedPhoto && (
        <Dialog open={true} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-full md:max-w-5xl h-screen max-h-screen md:h-auto md:max-h-[90vh] p-0 sm:rounded-none md:sm:rounded-lg gap-0">
            <DialogHeader className="sr-only">
              <DialogTitle>Photo Annotation Editor</DialogTitle>
              <DialogDescription>
                Draw, annotate, and markup this photo with arrows, text, lines, and freehand drawing
              </DialogDescription>
            </DialogHeader>
            <PhotoAnnotationEditor
              photoUrl={selectedPhoto.url}
              photoId={selectedPhoto.id}
              existingAnnotations={annotations}
              onSave={handleSaveAnnotations}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Project Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Project Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                value={editedProject.name}
                onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                placeholder="Enter project name"
                data-testid="input-project-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-address">Job Site Address</Label>
              <Input
                id="project-address"
                value={editedProject.address}
                onChange={(e) => setEditedProject({ ...editedProject, address: e.target.value })}
                placeholder="Enter job site address"
                data-testid="input-project-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={editedProject.description}
                onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
                placeholder="Enter project description"
                rows={3}
                data-testid="textarea-project-description"
              />
            </div>

            <div className="space-y-2">
              <Label>Cover Photo</Label>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Add photos to select a cover</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className={`relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 hover-elevate ${
                        editedProject.coverPhotoId === photo.id
                          ? "border-primary"
                          : "border-transparent"
                      }`}
                      onClick={() => setEditedProject({ ...editedProject, coverPhotoId: photo.id })}
                      data-testid={`cover-photo-option-${photo.id}`}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || "Photo"}
                        className="w-full h-full object-cover"
                      />
                      {editedProject.coverPhotoId === photo.id && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <div className="bg-primary text-primary-foreground rounded-full p-1">
                            <Check className="w-4 h-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteConfirm(true);
              }}
              data-testid="button-delete-project"
              className="mr-auto"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                data-testid="button-cancel-settings"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateProjectMutation.mutate(editedProject)}
                disabled={updateProjectMutation.isPending || !editedProject.name}
                data-testid="button-save-settings"
              >
                {updateProjectMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project?.name}" and all its photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteProjectMutation.mutate();
                setShowDeleteConfirm(false);
                setShowSettings(false);
              }}
              data-testid="button-confirm-delete"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Link Dialog */}
      <Dialog open={!!shareLink} onOpenChange={() => setShareLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share Link Created</DialogTitle>
            <DialogDescription>
              Copy this link to share your photos with others. The link will expire in 30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <Input
                id="share-link"
                value={shareLink || ''}
                readOnly
                className="font-mono text-sm"
                data-testid="input-share-link"
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="px-3"
              onClick={async () => {
                if (shareLink) {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    toast({
                      title: 'Copied!',
                      description: 'Share link copied to clipboard',
                    });
                  } catch (error) {
                    toast({
                      title: 'Copy failed',
                      description: 'Please copy the link manually',
                      variant: 'destructive',
                    });
                  }
                }
              }}
              data-testid="button-copy-link"
            >
              Copy
            </Button>
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShareLink(null)}
              data-testid="button-close-share-dialog"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move to Project Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Photos to Project</DialogTitle>
            <DialogDescription>
              Select a project to move {selectedPhotoIds.size} photo{selectedPhotoIds.size === 1 ? '' : 's'} to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="target-project">Target Project</Label>
              <Select
                value={targetProjectId}
                onValueChange={setTargetProjectId}
              >
                <SelectTrigger id="target-project" data-testid="select-target-project">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {allProjects
                    .filter(p => p.id !== projectId)
                    .map(project => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMoveDialog(false);
                setTargetProjectId("");
              }}
              data-testid="button-cancel-move"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (targetProjectId) {
                  movePhotosMutation.mutate({
                    photoIds: Array.from(selectedPhotoIds),
                    targetProjectId,
                  });
                }
              }}
              disabled={!targetProjectId || movePhotosMutation.isPending}
              data-testid="button-confirm-move"
            >
              {movePhotosMutation.isPending ? "Moving..." : "Move Photos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating Action Buttons (FABs) - Camera & Upload */}
      {!isSelectMode && (
        <>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            id="photo-upload-fab"
          />
          {/* Main FAB - Camera (centered at bottom) */}
          <Button
            onClick={() => setLocation(`/camera?projectId=${projectId}`)}
            data-testid="button-add-photo-fab"
            size="lg"
            className="fixed bottom-20 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full shadow-xl z-20 hover:scale-110 transition-transform"
          >
            <Camera className="w-6 h-6" />
          </Button>
        </>
      )}
    </div>
  );
}
