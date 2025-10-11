import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PhotoAnnotationEditor } from "@/components/PhotoAnnotationEditor";
import type { Photo, Project } from "../../../shared/schema";

export default function ProjectPhotos() {
  const { id: projectId } = useParams();
  const [, setLocation] = useLocation();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const { toast } = useToast();

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["/api/projects", projectId, "photos"],
  });

  const { data: annotations = [] } = useQuery<any[]>({
    queryKey: ["/api/photos", selectedPhoto?.id, "annotations"],
    enabled: !!selectedPhoto,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // For now, create blob URL - TODO: Add proper cloud storage
      const url = URL.createObjectURL(file);
      const res = await apiRequest("POST", `/api/projects/${projectId}/photos`, { url, caption: file.name });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "photos"] });
      toast({ title: "Photo uploaded successfully" });
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
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover-elevate active-elevate-2"
                onClick={() => setSelectedPhoto(photo)}
                data-testid={`photo-${photo.id}`}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || "Photo"}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </main>

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
    </div>
  );
}
