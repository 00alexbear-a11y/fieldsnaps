import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Camera, Settings as SettingsIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PhotoAnnotationEditor } from "@/components/PhotoAnnotationEditor";
import { PhotoGestureViewer } from "@/components/PhotoGestureViewer";
import LazyImage from "@/components/LazyImage";
import type { Photo, Project } from "../../../shared/schema";

export default function ProjectPhotos() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [viewerPhotoIndex, setViewerPhotoIndex] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editedProject, setEditedProject] = useState({ name: "", description: "", address: "", coverPhotoId: "" });
  const { toast } = useToast();

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
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
    <div className="min-h-screen flex flex-col">
      <header className="border-b p-4 flex items-center justify-between bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{project?.name || "Project Photos"}</h1>
            {project?.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            data-testid="button-project-settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </Button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
            id="photo-upload"
          />
          <label htmlFor="photo-upload">
            <Button asChild disabled={uploadMutation.isPending}>
              <span>
                <Camera className="w-5 h-5 mr-2" />
                {uploadMutation.isPending ? "Uploading..." : "Add Photo"}
              </span>
            </Button>
          </label>
        </div>
      </header>

      <main className="flex-1 p-4">
        {isLoading ? (
          <div className="text-center py-12">Loading photos...</div>
        ) : photos.length === 0 ? (
          <div className="text-center py-12">
            <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No photos yet</h2>
            <p className="text-muted-foreground mb-6">Add your first photo to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2 animate-scale-in touch-feedback"
                onClick={() => setViewerPhotoIndex(index)}
                data-testid={`photo-${photo.id}`}
              >
                <LazyImage
                  src={photo.url}
                  alt={photo.caption || "Photo"}
                  className="w-full h-full object-cover"
                />
                {photo.photographerName && (
                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-primary/80 flex items-center justify-center text-[10px] font-medium">
                      {photo.photographerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span className="font-medium">{photo.photographerName.split(' ')[0]}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Gesture-enabled Photo Viewer */}
      {viewerPhotoIndex !== null && (
        <PhotoGestureViewer
          photos={photos}
          initialIndex={viewerPhotoIndex}
          onClose={() => setViewerPhotoIndex(null)}
          onDelete={(photoId) => deleteMutation.mutate(photoId)}
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
        />
      )}

      {/* Annotation Editor Dialog (can be accessed via long-press in future) */}
      {selectedPhoto && (
        <Dialog open={true} onOpenChange={() => setSelectedPhoto(null)}>
          <DialogContent className="max-w-5xl max-h-[90vh] p-0">
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

          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
