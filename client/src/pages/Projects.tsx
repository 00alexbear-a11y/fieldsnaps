import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, FolderOpen, Camera, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, Photo } from "../../../shared/schema";

export default function Projects() {
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const { toast } = useToast();

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Create array of project IDs for query key to ensure refetch when projects change
  const projectIds = useMemo(() => projects.map(p => p.id).sort().join(','), [projects]);

  const { data: allPhotos = [] } = useQuery<Photo[]>({
    queryKey: ["/api/photos/all", projectIds],
    queryFn: async () => {
      // Fetch photos for all projects
      const photoPromises = projects.map(p => 
        fetch(`/api/projects/${p.id}/photos`).then(r => r.json())
      );
      const photoArrays = await Promise.all(photoPromises);
      return photoArrays.flat();
    },
    enabled: projects.length > 0,
  });

  // Group photos by project for counting
  const photosByProject = useMemo(() => {
    const grouped: Record<string, Photo[]> = {};
    allPhotos.forEach(photo => {
      if (!grouped[photo.projectId]) {
        grouped[photo.projectId] = [];
      }
      grouped[photo.projectId].push(photo);
    });
    return grouped;
  }, [allPhotos]);

  // Get cover photo for a project
  const getCoverPhoto = (project: Project): Photo | undefined => {
    if (!project.coverPhotoId) return undefined;
    return allPhotos.find(p => p.id === project.coverPhotoId);
  };

  // Get pending sync count for a project
  // TODO: Replace with real sync state from Background Sync API / IndexedDB
  const getPendingSyncCount = (projectId: string): number => {
    // Placeholder - will be replaced with actual sync queue check
    return 0;
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; address?: string }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      // Invalidate photos query to refresh counts (will refetch due to projectIds change)
      queryClient.invalidateQueries({ queryKey: ["/api/photos/all"] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setAddress("");
      toast({ title: "Project created successfully" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name, description, address });
  };

  const isLoading = projectsLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="default" data-testid="button-create-project">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <DialogDescription>
                Enter details for your new construction project.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter project name"
                  data-testid="input-project-name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Job site address"
                  data-testid="input-project-address"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter project description"
                  rows={3}
                  data-testid="input-project-description"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={createMutation.isPending}
                data-testid="button-submit-project"
              >
                {createMutation.isPending ? "Creating..." : "Create Project"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <FolderOpen className="w-16 h-16 mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
            <p className="text-muted-foreground mb-6 text-center">Create your first project to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {projects.map((project) => {
              const coverPhoto = getCoverPhoto(project);
              const photoCount = photosByProject[project.id]?.length || 0;
              const pendingSyncCount = getPendingSyncCount(project.id);
              
              return (
                <div
                  key={project.id}
                  className="flex gap-4 p-4 hover-elevate active-elevate-2 cursor-pointer"
                  onClick={() => setLocation(`/projects/${project.id}`)}
                  data-testid={`card-project-${project.id}`}
                >
                  {/* Cover Photo */}
                  <div className="flex-shrink-0">
                    {coverPhoto ? (
                      <img
                        src={coverPhoto.url}
                        alt={project.name}
                        className="w-20 h-20 rounded-md object-cover"
                        data-testid={`img-cover-${project.id}`}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center">
                        <FolderOpen className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Project Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold truncate" data-testid={`text-project-name-${project.id}`}>
                      {project.name}
                    </h3>
                    
                    {project.address && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate" data-testid={`text-address-${project.id}`}>{project.address}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5" />
                        <span data-testid={`text-photo-count-${project.id}`}>
                          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
                        </span>
                      </div>
                      
                      {pendingSyncCount > 0 && (
                        <div className="flex items-center gap-1 text-warning" data-testid={`text-pending-sync-${project.id}`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>{pendingSyncCount} pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
