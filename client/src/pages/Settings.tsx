import { Settings as SettingsIcon, Moon, Sun, Wifi, WifiOff, User, LogIn, LogOut, Fingerprint, HardDrive, ChevronRight, Trash2, Tag as TagIcon, Plus, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { syncManager } from '@/lib/syncManager';
import { indexedDB as indexedDBService } from '@/lib/indexeddb';
import { useAuth } from '@/hooks/useAuth';
import { useWebAuthn } from '@/hooks/useWebAuthn';
import { useTheme } from '@/hooks/useTheme';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Tag } from '@shared/schema';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

const TAG_COLORS = [
  { value: 'red', label: 'Red' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'blue', label: 'Blue' },
  { value: 'gray', label: 'Gray' },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { registerBiometric, authenticateWithBiometric, checkBiometricSupport, isLoading: isWebAuthnLoading } = useWebAuthn();
  const { isDark, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    projects: number;
    photos: number;
  } | null>(null);
  const [storageUsage, setStorageUsage] = useState<{
    mb: number;
    photoCount: number;
  } | null>(null);
  
  // Tag management state
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('blue');

  useEffect(() => {
    // Load sync status and storage usage
    loadSyncStatus();
    calculateStorageUsage();

    // Check biometric support
    checkBiometricSupport().then(setBiometricSupported);

    // Update online status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadSyncStatus = async () => {
    const status = await syncManager.getSyncStatus();
    setSyncStatus(status);
  };

  const calculateStorageUsage = async () => {
    try {
      // Get all projects first
      const projects = await indexedDBService.getAllProjects();
      
      // Get photos for all projects
      let totalBytes = 0;
      let totalPhotoCount = 0;
      
      for (const project of projects) {
        const photos = await indexedDBService.getProjectPhotos(project.id);
        totalPhotoCount += photos.length;
        
        photos.forEach((photo) => {
          if (photo.blob) {
            totalBytes += photo.blob.size;
          }
        });
      }
      
      const totalMB = totalBytes / (1024 * 1024);
      setStorageUsage({
        mb: parseFloat(totalMB.toFixed(2)),
        photoCount: totalPhotoCount
      });
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      setStorageUsage({ mb: 0, photoCount: 0 });
    }
  };

  const handleSync = async () => {
    await syncManager.syncNow();
    await loadSyncStatus();
  };

  // Load tags
  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await apiRequest('POST', '/api/tags', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      setIsTagDialogOpen(false);
      setTagName('');
      setTagColor('blue');
      toast({
        title: 'Tag created',
        description: 'New tag has been added',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create tag',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; color?: string } }) => {
      const res = await apiRequest('PUT', `/api/tags/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      setIsTagDialogOpen(false);
      setEditingTag(null);
      setTagName('');
      setTagColor('blue');
      toast({
        title: 'Tag updated',
        description: 'Tag has been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update tag',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
      toast({
        title: 'Tag deleted',
        description: 'Tag has been removed',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to delete tag',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleOpenTagDialog = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag);
      setTagName(tag.name);
      setTagColor(tag.color);
    } else {
      setEditingTag(null);
      setTagName('');
      setTagColor('blue');
    }
    setIsTagDialogOpen(true);
  };

  const handleSaveTag = () => {
    if (!tagName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a tag name',
        variant: 'destructive',
      });
      return;
    }

    if (editingTag) {
      updateTagMutation.mutate({
        id: editingTag.id,
        data: { name: tagName, color: tagColor },
      });
    } else {
      createTagMutation.mutate({ name: tagName, color: tagColor });
    }
  };

  return (
    <div className="p-4 pb-24 space-y-6 max-w-screen-sm mx-auto">
      <div className="flex flex-col items-center space-y-4 pb-2">
        <img 
          src={logoPath} 
          alt="FieldSnaps" 
          className="h-12 w-auto object-contain"
          data-testid="img-fieldsnaps-logo"
        />
        <h1 className="text-xl font-semibold text-muted-foreground" data-testid="text-settings-title">
          Settings
        </h1>
      </div>

      {/* Appearance */}
      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Appearance</h2>
        
        <label
          htmlFor="dark-mode"
          className="flex items-center justify-between min-h-11 cursor-pointer"
        >
          <div className="flex items-center space-x-3">
            {isDark ? (
              <Moon className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Sun className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="font-medium">
              Dark Mode
            </span>
          </div>
          <Switch
            id="dark-mode"
            checked={isDark}
            onCheckedChange={toggleTheme}
            data-testid="switch-dark-mode"
          />
        </label>
      </Card>

      {/* Tags Management */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Photo Tags</h2>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleOpenTagDialog()}
            data-testid="button-create-tag"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Tag
          </Button>
        </div>

        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No tags yet. Create one to categorize your photos.
          </p>
        ) : (
          <div className="space-y-2">
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate transition-colors"
                data-testid={`tag-item-${tag.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-4 h-4 rounded-full`}
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="font-medium">{tag.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenTagDialog(tag)}
                    data-testid={`button-edit-tag-${tag.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteTagMutation.mutate(tag.id)}
                    disabled={deleteTagMutation.isPending}
                    data-testid={`button-delete-tag-${tag.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Account */}
      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Account</h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Avatar className="w-12 h-12" data-testid="avatar-user">
              <AvatarImage 
                src={user?.profileImageUrl || undefined} 
                alt={user?.email || 'User'} 
                className="object-cover"
              />
              <AvatarFallback>
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate" data-testid="text-user-name">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.email || 'User'}
              </p>
              {user?.email && (
                <p className="text-sm text-muted-foreground truncate" data-testid="text-user-email">
                  {user.email}
                </p>
              )}
            </div>
          </div>
          
          {biometricSupported && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Fingerprint className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Biometric Login</span>
                </div>
              </div>
              <Button
                variant="outline"
                size="default"
                className="w-full"
                onClick={registerBiometric}
                disabled={isWebAuthnLoading}
                data-testid="button-register-biometric"
              >
                <Fingerprint className="w-4 h-4 mr-2" />
                {isWebAuthnLoading ? 'Setting up...' : 'Enable Biometric Login'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Use Touch ID, Face ID, or Windows Hello to sign in
              </p>
            </div>
          )}
          
          <Button
            variant="outline"
            size="default"
            className="w-full"
            onClick={() => window.location.href = '/api/logout'}
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </Card>

      {/* Sync Status */}
      <Card 
        className="p-4 space-y-4 cursor-pointer hover-elevate active-elevate-2 transition-colors" 
        onClick={() => setLocation('/sync-status')}
        data-testid="card-sync-status"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sync Status</h2>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
        
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <>
              <Wifi className="w-5 h-5 text-green-500" />
              <span className="text-sm text-muted-foreground" data-testid="text-online-status">
                Online
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-destructive" />
              <span className="text-sm text-muted-foreground" data-testid="text-offline-status">
                Offline
              </span>
            </>
          )}
        </div>

        {syncStatus && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending Items:</span>
              <span className="font-medium" data-testid="text-pending-count">
                {syncStatus.pending}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Projects:</span>
              <span className="font-medium" data-testid="text-pending-projects">
                {syncStatus.projects}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Photos:</span>
              <span className="font-medium" data-testid="text-pending-photos">
                {syncStatus.photos}
              </span>
            </div>
          </div>
        )}

        <Button
          variant="default"
          size="default"
          className="w-full"
          onClick={(e) => {
            e.stopPropagation();
            handleSync();
          }}
          disabled={!isOnline || (syncStatus?.pending === 0)}
          data-testid="button-sync-now"
        >
          Sync Now
        </Button>
      </Card>

      {/* Trash */}
      <Card 
        className="p-4 cursor-pointer hover-elevate active-elevate-2 transition-colors" 
        onClick={() => setLocation('/trash')}
        data-testid="card-trash"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Trash2 className="w-5 h-5 text-muted-foreground" />
            <div>
              <h2 className="text-lg font-semibold">Trash</h2>
              <p className="text-sm text-muted-foreground">
                Deleted items kept for 30 days
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>
      </Card>

      {/* Storage */}
      <Card className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Offline Storage</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Photos captured on this device for offline access
          </p>
        </div>
        
        {storageUsage ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Used:</span>
              <span className="font-medium text-lg" data-testid="text-storage-mb">
                {storageUsage.mb} MB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Local Photos:</span>
              <span className="font-medium" data-testid="text-storage-photo-count">
                {storageUsage.photoCount}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-2">
            <div className="animate-spin rounded-full w-5 h-5 border-b-2 border-primary"></div>
          </div>
        )}
      </Card>

      {/* About */}
      <Card className="p-4 space-y-2">
        <h2 className="text-lg font-semibold">About</h2>
        <p className="text-sm text-muted-foreground" data-testid="text-app-version">
          Construction Photo PWA v1.0.0
        </p>
        <p className="text-sm text-muted-foreground">
          Offline-first photo documentation for construction sites
        </p>
      </Card>

      {/* Tag Edit Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent data-testid="dialog-tag-edit">
          <DialogHeader>
            <DialogTitle>
              {editingTag ? 'Edit Tag' : 'Create Tag'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input
                id="tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g., Electrician, HVAC, Plumber"
                data-testid="input-tag-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag-color">Color</Label>
              <Select value={tagColor} onValueChange={setTagColor}>
                <SelectTrigger id="tag-color" data-testid="select-tag-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  position="popper"
                  sideOffset={5}
                  className="z-[100]"
                >
                  {TAG_COLORS.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsTagDialogOpen(false)}
              data-testid="button-cancel-tag"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTag}
              disabled={createTagMutation.isPending || updateTagMutation.isPending}
              data-testid="button-save-tag"
            >
              {editingTag ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
