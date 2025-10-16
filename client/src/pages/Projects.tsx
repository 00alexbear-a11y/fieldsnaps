import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, FolderOpen, Camera, MapPin, Clock, Search, Settings, Moon, Sun, ArrowUpDown, RefreshCw } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UpgradeModal } from "@/components/UpgradeModal";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SwipeableProjectCard from "@/components/SwipeableProjectCard";
import type { Project, Photo } from "../../../shared/schema";
import { syncManager } from "@/lib/syncManager";
import { Copy, Check } from "lucide-react";

type SortOption = 'lastActivity' | 'name' | 'created';

export default function Projects() {
  const [, setLocation] = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { canWrite, isTrialExpired, isPastDue, isCanceled } = useSubscriptionAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('lastActivity');
  const [showCompleted, setShowCompleted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const { toast } = useToast();

  // Efficient bulk query - gets all projects with photo counts in one request
  const { data: projectsWithCounts = [], isLoading: projectsLoading } = useQuery<(Project & { photoCount: number })[]>({
    queryKey: ["/api/projects/with-counts"],
  });

  // For backward compatibility, extract projects
  const projects = useMemo(() => 
    projectsWithCounts.map(({ photoCount, ...project }) => project),
    [projectsWithCounts]
  );

  // Get photo count for a project from the bulk query
  const getPhotoCount = (projectId: string): number => {
    const project = projectsWithCounts.find(p => p.id === projectId);
    return project?.photoCount || 0;
  };

  // Get pending sync count for a project
  // TODO: Replace with real sync state from Background Sync API / IndexedDB
  const getPendingSyncCount = (projectId: string): number => {
    // Placeholder - will be replaced with actual sync queue check
    return 0;
  };

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    // Apply completed filter (hide completed by default unless showCompleted is true)
    if (!showCompleted) {
      filtered = filtered.filter(project => !project.completed);
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(query) ||
        (project.address?.toLowerCase()?.includes(query) ?? false) ||
        (project.description?.toLowerCase()?.includes(query) ?? false)
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'lastActivity':
          // Most recent activity first (top to bottom)
          return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          // Oldest first (ascending)
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [projects, searchQuery, sortBy, showCompleted]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; address?: string }) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      setDialogOpen(false);
      setName("");
      setDescription("");
      setAddress("");
      toast({ title: "Project created successfully" });
    },
    onError: (error: any) => {
      console.error('Project creation error:', error);
      toast({ 
        title: "Error creating project", 
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
      toast({ 
        title: "Project deleted",
        description: "The project and all its photos have been removed"
      });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/share`);
      return await res.json();
    },
    onSuccess: (data) => {
      setShareToken(data.token);
      setShareDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error generating share link",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
  });

  const toggleCompleteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiRequest("PATCH", `/api/projects/${projectId}/toggle-complete`);
      return await res.json();
    },
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      toast({
        title: data.completed ? "Project marked as complete" : "Project marked as incomplete",
        duration: 2000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating project",
        description: error.message || "Please try again",
        variant: "destructive"
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

  const handleShareProject = (projectId: string) => {
    shareMutation.mutate(projectId);
  };

  const handleToggleComplete = (projectId: string) => {
    toggleCompleteMutation.mutate(projectId);
  };

  const handleCopyShareLink = async () => {
    if (!shareToken) return;
    
    const shareUrl = `${window.location.origin}/shared/${shareToken}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({
        title: "Link copied",
        description: "Share link has been copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Failed to copy link",
        variant: "destructive"
      });
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      const result = await syncManager.syncNow();
      if (result.synced > 0) {
        toast({
          title: '✓ Synced',
          description: `${result.synced} item${result.synced > 1 ? 's' : ''} uploaded`,
          duration: 2000,
        });
        // Refresh projects and photo counts
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      } else if (result.failed > 0) {
        toast({
          title: 'Sync incomplete',
          description: `${result.failed} item${result.failed > 1 ? 's' : ''} failed`,
          variant: 'destructive',
          duration: 2000,
        });
      } else {
        toast({
          title: 'Up to date',
          description: 'All items are already synced',
          duration: 1500,
        });
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const isLoading = projectsLoading;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-black">
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
              <Button 
                size="sm" 
                data-testid="button-create-project"
                onClick={() => {
                  if (!canWrite) {
                    setUpgradeModalOpen(true);
                  } else {
                    setDialogOpen(true);
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Project
              </Button>
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
                <Button size="icon" variant="outline" className="h-8 w-8" data-testid="button-settings-menu">
                  <Settings className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={toggleTheme} data-testid="menu-toggle-theme">
                  {isDark ? (
                    <Sun className="w-4 h-4 mr-2" />
                  ) : (
                    <Moon className="w-4 h-4 mr-2" />
                  )}
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
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 bg-white dark:bg-black">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 m-3 mt-6">
            <Card className="p-8 text-center max-w-md space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <FolderOpen className="w-10 h-10 text-primary" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">Create Your First Project</h2>
                <p className="text-muted-foreground text-lg">
                  Your 7-day free trial starts when you create your first project
                </p>
              </div>
              <Button 
                size="lg" 
                className="w-full"
                onClick={() => {
                  if (!canWrite) {
                    setUpgradeModalOpen(true);
                  } else {
                    setDialogOpen(true);
                  }
                }}
                data-testid="button-create-first-project"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create Project
              </Button>
              <p className="text-sm text-muted-foreground">
                No credit card required • Full access to all features
              </p>
            </Card>
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
              const photoCount = getPhotoCount(project.id);
              const pendingSyncCount = getPendingSyncCount(project.id);
              
              return (
                <SwipeableProjectCard
                  key={project.id}
                  project={project}
                  coverPhoto={undefined}
                  photoCount={photoCount}
                  pendingSyncCount={pendingSyncCount}
                  onClick={() => setLocation(`/projects/${project.id}`)}
                  onDelete={() => handleDeleteProject(project)}
                  onCameraClick={() => setLocation(`/camera?projectId=${project.id}`)}
                  onShare={() => handleShareProject(project.id)}
                  onToggleComplete={() => handleToggleComplete(project.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Search & Sort Bar - Fixed at bottom for thumb reach */}
      <div className="fixed bottom-16 left-0 right-0 bg-background/95 backdrop-blur-md border-t p-4 z-40">
        <div className="relative max-w-screen-sm mx-auto space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
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
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="w-[140px]" data-testid="select-sort">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastActivity">Recent Activity</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="created">Date Created</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 pl-1">
            <Checkbox 
              id="show-completed" 
              checked={showCompleted}
              onCheckedChange={(checked) => setShowCompleted(checked as boolean)}
              data-testid="checkbox-show-completed"
            />
            <label 
              htmlFor="show-completed" 
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              Show Completed Jobs
            </label>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{projectToDelete?.name}"? The project and all {getPhotoCount(projectToDelete?.id || '')} of its photos will be moved to trash for 30 days before permanent deletion.
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

      {/* Share Project Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent data-testid="dialog-share-project">
          <DialogHeader>
            <DialogTitle>Share Project</DialogTitle>
            <DialogDescription>
              Anyone with this link can view all active photos in this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg border flex items-center gap-2">
              <code className="flex-1 text-sm truncate" data-testid="text-share-link">
                {shareToken ? `${window.location.origin}/shared/${shareToken}` : ''}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCopyShareLink}
                data-testid="button-copy-link"
                aria-label="Copy share link"
              >
                {copiedLink ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button 
                onClick={() => setShareDialogOpen(false)}
                data-testid="button-close-share"
              >
                Done
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <UpgradeModal 
        open={upgradeModalOpen} 
        onClose={() => setUpgradeModalOpen(false)}
        reason={isTrialExpired ? 'trial_expired' : isPastDue ? 'past_due' : isCanceled ? 'canceled' : 'trial_expired'}
      />
    </div>
  );
}
