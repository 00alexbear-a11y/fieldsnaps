import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useOfflineFirstProjects } from "@/hooks/useOfflineFirstProjects";
import { Plus, Home, Camera, Search, ArrowUpDown, RefreshCw, Copy, Check } from "lucide-react";
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
import { useKeyboardManager } from "@/hooks/useKeyboardManager";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import SwipeableProjectCard from "@/components/SwipeableProjectCard";
import type { Project, Photo } from "../../../shared/schema";
import { syncManager } from "@/lib/syncManager";
import { nativeClipboard } from "@/lib/nativeClipboard";
import { haptics } from "@/lib/nativeHaptics";
import { nativeDialogs } from "@/lib/nativeDialogs";
import { Capacitor } from "@capacitor/core";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";

type ViewFilter = 'all' | 'recent' | 'favorites';
type SortOption = 'name-asc' | 'name-desc' | 'photos' | 'last-activity' | 'created';

export default function Projects() {
  const [, setLocation] = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { canWrite, isTrialExpired, isPastDue, isCanceled } = useSubscriptionAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  
  // Enable keyboard management for form inputs
  useKeyboardManager();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('last-activity');
  
  // Debounce search query for better mobile performance (300ms delay)
  useEffect(() => {
    const isMounted = { current: true };
    const timer = setTimeout(() => {
      if (isMounted.current) {
        setDebouncedSearchQuery(searchQuery);
      }
    }, 300);
    
    return () => {
      isMounted.current = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);
  
  // Sync debounced value on mount to prevent stale searches
  useEffect(() => {
    setDebouncedSearchQuery(searchQuery);
  }, []);
  const [showCompleted, setShowCompleted] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [unitCount, setUnitCount] = useState(1);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editUnitCount, setEditUnitCount] = useState(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    projects: number;
    photos: number;
  } | null>(null);
  const { toast } = useToast();

  // Offline-first: load from IndexedDB immediately, fetch from server in background
  const { projects: projectsWithCounts, isLoading: projectsLoading, isOnline, hasLocalData } = useOfflineFirstProjects();

  // Fetch user's favorite project IDs (Phase 3.4)
  const { data: favoriteProjectIds = [] } = useQuery<string[]>({
    queryKey: ['/api/user/favorite-projects'],
    enabled: isOnline,
  });

  // Fetch user's recent project IDs (Phase 3.4)
  const { data: recentProjectIds = [] } = useQuery<string[]>({
    queryKey: ['/api/user/recent-projects'],
    enabled: isOnline,
  });

  // Load sync status on mount and when online status changes
  useEffect(() => {
    const loadSyncStatus = async () => {
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);
    };
    loadSyncStatus();
  }, [isOnline]);

  // For backward compatibility, extract projects
  const projects = useMemo(() => 
    projectsWithCounts.map(({ photoCount, coverPhoto, ...project }) => project),
    [projectsWithCounts]
  );

  // Get photo count for a project from the bulk query
  const getPhotoCount = (projectId: string): number => {
    const project = projectsWithCounts.find(p => p.id === projectId);
    return project?.photoCount || 0;
  };
  
  // Get cover photo for a project from the bulk query
  const getCoverPhoto = (projectId: string): Photo | undefined => {
    const project = projectsWithCounts.find(p => p.id === projectId);
    return project?.coverPhoto;
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
    
    // Apply view filter
    if (viewFilter === 'recent') {
      // Show only recent projects
      filtered = filtered.filter(project => recentProjectIds.includes(project.id));
    } else if (viewFilter === 'favorites') {
      // Show only favorite projects
      filtered = filtered.filter(project => favoriteProjectIds.includes(project.id));
    }
    // 'all' view shows all projects (no additional filtering)
    
    // Apply search filter (uses debounced value for better performance)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(query) ||
        (project.address?.toLowerCase()?.includes(query) ?? false) ||
        (project.description?.toLowerCase()?.includes(query) ?? false)
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          // Alphabetical A-Z
          return a.name.localeCompare(b.name);
        case 'name-desc':
          // Alphabetical Z-A
          return b.name.localeCompare(a.name);
        case 'photos':
          // Most photos first
          const aCount = getPhotoCount(a.id);
          const bCount = getPhotoCount(b.id);
          return bCount - aCount;
        case 'last-activity':
          // Most recent activity first
          return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
        case 'created':
          // Oldest first (ascending)
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });
    
    return sorted;
  }, [projects, debouncedSearchQuery, viewFilter, sortBy, showCompleted, favoriteProjectIds, recentProjectIds, getPhotoCount]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; address?: string; unitCount?: number }) => {
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
      setUnitCount(1);
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

  const editMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; description?: string; address?: string; unitCount?: number }) => {
      const { id, ...updateData } = data;
      const res = await apiRequest("PATCH", `/api/projects/${id}`, updateData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/with-counts"] });
      setEditDialogOpen(false);
      setProjectToEdit(null);
      setEditName("");
      setEditDescription("");
      setEditAddress("");
      setEditUnitCount(1);
      toast({ title: "Project updated successfully" });
    },
    onError: (error: any) => {
      console.error('Project update error:', error);
      toast({ 
        title: "Error updating project", 
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

  // Toggle favorite with optimistic updates - Phase 3.4
  const toggleFavoriteMutation = useMutation({
    mutationFn: async ({ projectId, isFavorite }: { projectId: string; isFavorite: boolean }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/favorite`, { isFavorite });
      return await res.json();
    },
    onMutate: async ({ projectId, isFavorite }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['/api/user/favorite-projects'] });
      
      // Snapshot previous value for rollback
      const previousFavorites = queryClient.getQueryData<string[]>(['/api/user/favorite-projects']);
      
      // Optimistically update the favorites list
      queryClient.setQueryData<string[]>(['/api/user/favorite-projects'], (old = []) => {
        if (isFavorite) {
          return [...old, projectId];
        } else {
          return old.filter(id => id !== projectId);
        }
      });
      
      // Haptic feedback for instant feel
      haptics.light();
      
      return { previousFavorites };
    },
    onError: (error: any, variables, context) => {
      // Rollback on error
      if (context?.previousFavorites) {
        queryClient.setQueryData(['/api/user/favorite-projects'], context.previousFavorites);
      }
      toast({
        title: "Error updating favorite",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/user/favorite-projects'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name, description, address, unitCount });
  };

  const handleDeleteProject = async (project: Project) => {
    // On iOS: use native confirmation dialog
    if (Capacitor.isNativePlatform()) {
      const photoCount = getPhotoCount(project.id);
      const confirmed = await nativeDialogs.confirm({
        title: "Delete Project?",
        message: `Are you sure you want to delete "${project.name}"? The project and all ${photoCount} of its photos will be moved to trash for 30 days before permanent deletion.`,
        okButtonTitle: "Delete",
        cancelButtonTitle: "Cancel"
      });
      
      if (confirmed) {
        deleteMutation.mutate(project.id);
      }
    } else {
      // On web: use AlertDialog component
      setProjectToDelete(project);
      setDeleteDialogOpen(true);
    }
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

  const handleToggleFavorite = (projectId: string) => {
    const isFavorite = favoriteProjectIds.includes(projectId);
    toggleFavoriteMutation.mutate({ projectId, isFavorite: !isFavorite });
  };

  const handleEditProject = (project: Project) => {
    setProjectToEdit(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditAddress(project.address || "");
    setEditUnitCount(project.unitCount || 1);
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectToEdit || !editName.trim()) return;
    editMutation.mutate({
      id: projectToEdit.id,
      name: editName,
      description: editDescription,
      address: editAddress,
      unitCount: editUnitCount,
    });
  };

  const handleCopyShareLink = async () => {
    if (!shareToken) return;
    
    const shareUrl = `${window.location.origin}/shared/${shareToken}`;
    try {
      await nativeClipboard.write(shareUrl);
      haptics.light();
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({
        title: "Link copied",
        description: "Share link has been copied to clipboard"
      });
    } catch (error) {
      haptics.error();
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

  // Calculate counts for sidebar badges
  const totalProjectsCount = projects.filter(p => showCompleted || !p.completed).length;
  const recentProjectsCount = recentProjectIds.length;
  const favoriteProjectsCount = favoriteProjectIds.length;

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <ProjectsSidebar
          currentView={viewFilter}
          onViewChange={setViewFilter}
          currentSort={sortBy}
          onSortChange={setSortBy}
          showCompleted={showCompleted}
          onShowCompletedChange={setShowCompleted}
          totalProjects={totalProjectsCount}
          recentCount={recentProjectsCount}
          favoritesCount={favoriteProjectsCount}
        />
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          {/* Top Navigation Bar */}
          <div className="flex items-center gap-2 p-3 border-b">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-9 w-auto object-contain"
              data-testid="img-fieldsnaps-logo"
            />
            <div className="flex-1" />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <Button 
                className="h-9"
                data-testid="button-create-project"
                onClick={() => {
                  if (!canWrite) {
                    setUpgradeModalOpen(true);
                  } else {
                    setDialogOpen(true);
                  }
                }}
              >
                <Plus className="w-5 h-5 mr-2" />
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
                    <Label htmlFor="unitCount">Number of Units</Label>
                    <Input
                      id="unitCount"
                      type="number"
                      min="1"
                      max="999"
                      value={unitCount}
                      onChange={(e) => setUnitCount(parseInt(e.target.value) || 1)}
                      placeholder="1 for single-site projects"
                      data-testid="input-project-unit-count"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Set to 1 for single-site projects. For multi-unit buildings, specify the number of units to enable unit labels in camera.
                    </p>
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
          {syncStatus && syncStatus.pending > 0 && (
            <div className="px-4 py-2 border-b">
              <p className="text-xs text-muted-foreground">
                {syncStatus.pending} pending upload{syncStatus.pending > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Search Bar */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9"
                data-testid="input-search-projects"
              />
            </div>
          </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-52 bg-white dark:bg-black">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 m-3 mt-6">
            <Card className="p-8 text-center max-w-md space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Home className="w-10 h-10 text-primary" />
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
              const coverPhoto = getCoverPhoto(project.id);
              
              return (
                <SwipeableProjectCard
                  key={project.id}
                  project={project}
                  coverPhoto={coverPhoto}
                  photoCount={photoCount}
                  pendingSyncCount={pendingSyncCount}
                  isFavorite={favoriteProjectIds.includes(project.id)}
                  onClick={() => setLocation(`/projects/${project.id}`)}
                  onDelete={() => handleDeleteProject(project)}
                  onCameraClick={() => setLocation(`/camera?projectId=${project.id}`)}
                  onShare={() => handleShareProject(project.id)}
                  onToggleComplete={() => handleToggleComplete(project.id)}
                  onToggleFavorite={() => handleToggleFavorite(project.id)}
                  onEdit={() => handleEditProject(project)}
                />
              );
            })}
          </div>
        )}
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

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-project">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter project name"
                data-testid="input-edit-project-name"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                placeholder="Job site address"
                data-testid="input-edit-project-address"
              />
            </div>
            <div>
              <Label htmlFor="edit-unitCount">Number of Units</Label>
              <Input
                id="edit-unitCount"
                type="number"
                min="1"
                max="999"
                value={editUnitCount}
                onChange={(e) => setEditUnitCount(parseInt(e.target.value) || 1)}
                placeholder="1 for single-site projects"
                data-testid="input-edit-project-unit-count"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Set to 1 for single-site projects. For multi-unit buildings, specify the number of units to enable unit labels in camera.
              </p>
            </div>
            <div>
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Enter project description"
                rows={3}
                data-testid="input-edit-project-description"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button 
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editMutation.isPending}
                data-testid="button-submit-edit"
              >
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Share Project Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md w-[90vw]" data-testid="dialog-share-project">
          <DialogHeader>
            <DialogTitle>Share Project</DialogTitle>
            <DialogDescription>
              Anyone with this link can view all active photos in this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg border flex items-center gap-2 min-w-0">
              <code className="flex-1 text-xs sm:text-sm min-w-0 break-all whitespace-pre-wrap" data-testid="text-share-link">
                {shareToken ? `${window.location.origin}/shared/${shareToken}` : ''}
              </code>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCopyShareLink}
                className="flex-shrink-0"
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
                className="w-full"
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
      </div>
    </SidebarProvider>
  );
}
