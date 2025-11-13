import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useOfflineFirstProjects } from "@/hooks/useOfflineFirstProjects";
import { Plus, Home, Camera, Search, ArrowUpDown, RefreshCw, Copy, Check } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { useSubscriptionAccess } from "@/hooks/useSubscriptionAccess";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { MobileDialogForm } from "@/components/ui/mobile-dialog";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import SwipeableProjectCard from "@/components/SwipeableProjectCard";
import type { Project, Photo } from "../../../shared/schema";
import { syncManager } from "@/lib/syncManager";
import { nativeClipboard } from "@/lib/nativeClipboard";
import { haptics } from "@/lib/nativeHaptics";
import { nativeDialogs } from "@/lib/nativeDialogs";
import { Capacitor } from "@capacitor/core";

type ViewFilter = 'all' | 'recent' | 'favorites';
type SortOption = 'name-asc' | 'name-desc' | 'photos' | 'last-activity' | 'created';

export default function Projects() {
  const [, setLocation] = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { canWrite, isTrialExpired, isPastDue, isCanceled } = useSubscriptionAccess();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  
  // Read filter/sort state from URL query params (managed by AppSidebar)
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      viewFilter: (params.get('view') || 'all') as ViewFilter,
      sortBy: (params.get('sort') || 'last-activity') as SortOption,
      showCompleted: params.get('completed') === 'true',
    };
  };

  const [urlParams, setUrlParams] = useState(getUrlParams());
  const { viewFilter, sortBy, showCompleted } = urlParams;
  
  // Listen for filter changes from AppSidebar and browser history navigation
  useEffect(() => {
    const handleFilterChange = () => {
      setUrlParams(getUrlParams());
    };
    
    // Listen for custom filterChange event from AppSidebar
    window.addEventListener('filterChange', handleFilterChange);
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handleFilterChange);
    
    return () => {
      window.removeEventListener('filterChange', handleFilterChange);
      window.removeEventListener('popstate', handleFilterChange);
    };
  }, []);
  
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
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editUnitCount, setEditUnitCount] = useState(1);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
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


  const editMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; description?: string; address?: string; unitCount?: number; customerName?: string; customerPhone?: string; customerEmail?: string }) => {
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
      setEditCustomerName("");
      setEditCustomerPhone("");
      setEditCustomerEmail("");
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
    setEditCustomerName(project.customerName || "");
    setEditCustomerPhone(project.customerPhone || "");
    setEditCustomerEmail(project.customerEmail || "");
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
      customerName: editCustomerName.trim() || undefined,
      customerPhone: editCustomerPhone.trim() || undefined,
      customerEmail: editCustomerEmail.trim() || undefined,
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
                <p className="text-sm text-muted-foreground pt-4">
                  Click the <span className="font-semibold">New</span> button above to get started
                </p>
              </div>
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
      <MobileDialogForm
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Project"
        description="Update your project details"
        onSubmit={handleEditSubmit}
        submitLabel={editMutation.isPending ? "Saving..." : "Save Changes"}
        submitDisabled={editMutation.isPending}
        submitTestId="button-submit-edit"
      >
        <div>
          <Input
            id="edit-name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Project Name"
            data-testid="input-edit-project-name"
            required
          />
        </div>

        <div>
          <Input
            id="edit-address"
            value={editAddress}
            onChange={(e) => setEditAddress(e.target.value)}
            placeholder="Address"
            data-testid="input-edit-project-address"
          />
        </div>

        <div>
          <Input
            id="edit-unitCount"
            type="number"
            min="1"
            max="999"
            value={editUnitCount}
            onChange={(e) => setEditUnitCount(parseInt(e.target.value) || 1)}
            placeholder="Number of Units"
            data-testid="input-edit-project-unit-count"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Set to 1 for single-site. Multi-unit buildings enable unit labels in camera.
          </p>
        </div>

        <div>
          <Textarea
            id="edit-description"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={3}
            data-testid="input-edit-project-description"
          />
        </div>

        {/* Customer Information Section */}
        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-medium text-muted-foreground">Customer Info (optional)</h3>
          <div>
            <Input
              id="edit-customerName"
              value={editCustomerName}
              onChange={(e) => setEditCustomerName(e.target.value)}
              placeholder="Customer Name"
              data-testid="input-edit-customer-name"
            />
          </div>
          <div>
            <Input
              id="edit-customerPhone"
              type="tel"
              value={editCustomerPhone}
              onChange={(e) => setEditCustomerPhone(e.target.value)}
              placeholder="Customer Phone"
              data-testid="input-edit-customer-phone"
            />
          </div>
          <div>
            <Input
              id="edit-customerEmail"
              type="email"
              value={editCustomerEmail}
              onChange={(e) => setEditCustomerEmail(e.target.value)}
              placeholder="Customer Email"
              data-testid="input-edit-customer-email"
            />
          </div>
        </div>
      </MobileDialogForm>

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
    </div>
  );
}
