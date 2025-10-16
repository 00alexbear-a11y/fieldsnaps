import { Settings as SettingsIcon, Moon, Sun, Wifi, WifiOff, User, LogIn, LogOut, Fingerprint, HardDrive, ChevronRight, Trash2, Tag as TagIcon, Plus, Pencil, X, CreditCard, Sparkles, Camera } from 'lucide-react';
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
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
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
  
  // Camera quality settings
  const [cameraQuality, setCameraQuality] = useState<'quick' | 'standard' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camera-quality');
      return (saved as 'quick' | 'standard' | 'detailed') || 'standard';
    }
    return 'standard';
  });

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

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/create-checkout-session');
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: 'Checkout failed',
        description: error.message || 'Unable to start checkout process',
        variant: 'destructive',
      });
    },
  });

  const handleUpgradeClick = () => {
    checkoutMutation.mutate();
  };

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
  
  const handleQualityChange = (quality: 'quick' | 'standard' | 'detailed') => {
    setCameraQuality(quality);
    if (typeof window !== 'undefined') {
      localStorage.setItem('camera-quality', quality);
    }
    toast({
      title: 'Quality updated',
      description: 'New photos will use this quality setting',
      duration: 2000,
    });
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

      {/* Camera Quality */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Camera className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Camera Quality</h2>
        </div>
        
        <p className="text-sm text-muted-foreground">
          Choose default quality for new photos
        </p>

        <div className="space-y-3">
          <label
            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
              cameraQuality === 'quick' ? 'border-primary bg-primary/5' : 'border-border hover-elevate'
            }`}
            data-testid="option-quality-quick"
          >
            <div className="flex-1">
              <div className="font-medium">Quick (S)</div>
              <div className="text-sm text-muted-foreground">~200 KB per photo</div>
              <div className="text-xs text-muted-foreground mt-1">Fast upload, good for previews</div>
            </div>
            <input
              type="radio"
              name="camera-quality"
              value="quick"
              checked={cameraQuality === 'quick'}
              onChange={() => handleQualityChange('quick')}
              className="w-4 h-4 text-primary"
            />
          </label>

          <label
            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
              cameraQuality === 'standard' ? 'border-primary bg-primary/5' : 'border-border hover-elevate'
            }`}
            data-testid="option-quality-standard"
          >
            <div className="flex-1">
              <div className="font-medium">Standard (M)</div>
              <div className="text-sm text-muted-foreground">~500 KB per photo</div>
              <div className="text-xs text-muted-foreground mt-1">Balanced quality and size</div>
            </div>
            <input
              type="radio"
              name="camera-quality"
              value="standard"
              checked={cameraQuality === 'standard'}
              onChange={() => handleQualityChange('standard')}
              className="w-4 h-4 text-primary"
            />
          </label>

          <label
            className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
              cameraQuality === 'detailed' ? 'border-primary bg-primary/5' : 'border-border hover-elevate'
            }`}
            data-testid="option-quality-detailed"
          >
            <div className="flex-1">
              <div className="font-medium">Detailed (L)</div>
              <div className="text-sm text-muted-foreground">~1 MB per photo</div>
              <div className="text-xs text-muted-foreground mt-1">High quality for important shots</div>
            </div>
            <input
              type="radio"
              name="camera-quality"
              value="detailed"
              checked={cameraQuality === 'detailed'}
              onChange={() => handleQualityChange('detailed')}
              className="w-4 h-4 text-primary"
            />
          </label>
        </div>
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

      {/* Subscription Status */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">Subscription</h2>
        </div>
        
        <div className="space-y-3">
          {/* Trial Status */}
          {user?.subscriptionStatus === 'trial' && user?.trialStartDate && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="font-medium text-sm">Free Trial</span>
              </div>
              {user?.trialEndDate && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Trial ends</span>
                    <span className="font-medium text-sm">
                      {new Date(user.trialEndDate).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                      {' '}
                      ({Math.max(0, Math.ceil((new Date(user.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days remaining)
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full"
                    onClick={handleUpgradeClick}
                    disabled={checkoutMutation.isPending}
                    data-testid="button-upgrade-trial"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Trial Not Started */}
          {user?.subscriptionStatus === 'trial' && !user?.trialStartDate && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="font-medium text-sm">Trial Ready</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your 7-day free trial starts when you create your first project
              </p>
            </div>
          )}

          {/* Active Subscription */}
          {user?.subscriptionStatus === 'active' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="font-medium text-sm text-green-600 dark:text-green-500">
                  FieldSnaps Pro - Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Billing</span>
                <span className="font-medium text-sm">$19.99/month</span>
              </div>
              <Button
                variant="outline"
                size="default"
                className="w-full"
                onClick={() => window.open(process.env.VITE_STRIPE_CUSTOMER_PORTAL_URL || '#', '_blank')}
                data-testid="button-manage-subscription"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Manage Subscription
              </Button>
            </div>
          )}

          {/* Past Due */}
          {user?.subscriptionStatus === 'past_due' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="font-medium text-sm text-amber-600 dark:text-amber-500">
                  Payment Issue
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Please update your payment method to continue using FieldSnaps
              </p>
              <Button
                variant="default"
                size="default"
                className="w-full"
                onClick={() => window.open(process.env.VITE_STRIPE_CUSTOMER_PORTAL_URL || '#', '_blank')}
                data-testid="button-update-payment"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Update Payment Method
              </Button>
            </div>
          )}

          {/* Trial Ended */}
          {(!user?.subscriptionStatus || user?.subscriptionStatus === 'canceled' || 
            (user?.subscriptionStatus === 'trial' && user?.trialEndDate && new Date(user.trialEndDate) < new Date())) && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="font-medium text-sm">Trial Ended</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Upgrade to FieldSnaps Pro to continue using all features
              </p>
              <Button
                variant="default"
                size="default"
                className="w-full"
                onClick={handleUpgradeClick}
                disabled={checkoutMutation.isPending}
                data-testid="button-upgrade-expired"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
              </Button>
            </div>
          )}
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
