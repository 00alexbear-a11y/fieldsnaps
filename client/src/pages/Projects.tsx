import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, FolderOpen, Camera, MapPin, Clock, Search, Settings, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SwipeableProjectCard from "@/components/SwipeableProjectCard";
import type { Project, Photo } from "../../../shared/schema";

export default function Projects() {
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
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

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    
    const query = searchQuery.toLowerCase();
    return projects.filter(project => 
      project.name.toLowerCase().includes(query) ||
      (project.address?.toLowerCase()?.includes(query) ?? false) ||
      (project.description?.toLowerCase()?.includes(query) ?? false)
    );
  }, [projects, searchQuery]);

  // Toggle theme
  const toggleTheme = () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; address?: string }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/all"] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setAddress("");
      toast({ title: "Project created successfully" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/photos/all"] });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      toast({ 
        title: "Project deleted",
        description: "The project and all its photos have been removed"
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name, description, address });
  };

  const handleDeleteProject = (project: Project) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id);
    }
  };

  const isLoading = projectsLoading;

  return (
    <div className="flex flex-col h-full">
      {/* Top Navigation Bar - Sticky with glassmorphism */}
      <div className="sticky top-0 z-50 flex items-center justify-between p-4 border-b bg-background/80 backdrop-blur-xl">
        <img 
          src={logoPath} 
          alt="FieldSnaps" 
          className="h-9 w-auto object-contain"
          data-testid="img-fieldsnaps-logo"
        />
        <div className="flex items-center gap-2">
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid="button-settings-menu">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme} data-testid="menu-toggle-theme">
                  <Moon className="w-4 h-4 mr-2 dark:hidden" />
                  <Sun className="w-4 h-4 mr-2 hidden dark:inline" />
                  Toggle Theme
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/settings')} data-testid="menu-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-auto pb-20">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 m-3 mt-6">
            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center max-w-md">
              <FolderOpen className="w-16 h-16 mb-4 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
              <p className="text-muted-foreground mb-6">Create your first project to get started</p>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 m-3 mt-6">
            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center max-w-md">
              <Search className="w-16 h-16 mb-4 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold mb-2">No results found</h2>
              <p className="text-muted-foreground mb-6">Try a different search term</p>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredProjects.map((project) => {
              const coverPhoto = getCoverPhoto(project);
              const photoCount = photosByProject[project.id]?.length || 0;
              const pendingSyncCount = getPendingSyncCount(project.id);
              
              return (
                <SwipeableProjectCard
                  key={project.id}
                  project={project}
                  coverPhoto={coverPhoto}
                  photoCount={photoCount}
                  pendingSyncCount={pendingSyncCount}
                  onClick={() => setLocation(`/projects/${project.id}`)}
                  onDelete={() => handleDeleteProject(project)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Search Bar - Fixed at bottom for thumb reach */}
      <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-md border-t p-4 z-40">
        <div className="relative max-w-screen-sm mx-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-projects"
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? This will permanently remove the project and all {photosByProject[projectToDelete?.id || '']?.length || 0} of its photos. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
