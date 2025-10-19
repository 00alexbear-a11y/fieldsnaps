import { Settings as SettingsIcon, Moon, Sun, Wifi, WifiOff, User, LogIn, LogOut, Fingerprint, HardDrive, ChevronRight, Trash2, Tag as TagIcon, Plus, Pencil, X, CreditCard, Sparkles, Camera, Users, Link as LinkIcon, Copy, Check, UserMinus, Crown, FileText, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
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
import type { Tag, Company, User as UserType } from '@shared/schema';
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
  
  // Team management state
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [showCancellationWarning, setShowCancellationWarning] = useState(false);

  // PDF settings state
  const [pdfSettings, setPdfSettings] = useState({
    pdfCompanyName: '',
    pdfCompanyAddress: '',
    pdfCompanyPhone: '',
    pdfHeaderText: '',
    pdfFooterText: '',
    pdfFontFamily: 'Arial' as 'Arial' | 'Helvetica' | 'Times',
    pdfFontSizeTitle: 24,
    pdfFontSizeHeader: 16,
    pdfFontSizeBody: 12,
    pdfFontSizeCaption: 10,
    pdfDefaultGridLayout: 2,
    pdfIncludeTimestamp: true,
    pdfIncludeTags: true,
    pdfIncludeAnnotations: true,
    pdfIncludeSignatureLine: false,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Company data
  const { data: company } = useQuery<Company>({
    queryKey: ['/api/companies/me'],
    enabled: !!user?.companyId,
  });

  // Team members data
  const { data: members = [] } = useQuery<UserType[]>({
    queryKey: ['/api/companies/members'],
    enabled: !!user?.companyId,
  });

  // Generate invite link mutation
  const generateInviteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/companies/invite-link');
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/me'] });
      toast({
        title: 'Invite link generated',
        description: 'Share this link with your team members',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to generate invite link',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Revoke invite link mutation
  const revokeInviteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/companies/invite-link');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/me'] });
      toast({
        title: 'Invite link revoked',
        description: 'Previous link is no longer valid',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to revoke invite link',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('DELETE', `/api/companies/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/members'] });
      toast({
        title: 'Member removed',
        description: 'Team member has been removed from the company',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to remove member',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Promote member mutation
  const promoteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('PUT', `/api/companies/members/${userId}/promote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/members'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies/me'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: 'Ownership transferred',
        description: 'Team member is now the billing owner',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to transfer ownership',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // PDF settings mutations
  const savePdfSettingsMutation = useMutation({
    mutationFn: async (settings: typeof pdfSettings) => {
      const res = await apiRequest('PUT', '/api/companies/pdf-settings', settings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/me'] });
      toast({
        title: 'PDF settings saved',
        description: 'Your PDF export preferences have been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save PDF settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await apiRequest('POST', '/api/companies/pdf-logo', formData, {
        headers: {},
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/me'] });
      setLogoFile(null);
      setLogoPreview(null);
      toast({
        title: 'Logo uploaded',
        description: 'Company logo has been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to upload logo',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyInviteLink = () => {
    if (company?.inviteLinkToken) {
      const inviteUrl = `${window.location.origin}/api/companies/invite/${company.inviteLinkToken}`;
      navigator.clipboard.writeText(inviteUrl);
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
      toast({
        title: 'Invite link copied',
        description: 'Share this link with your team members',
        duration: 2000,
      });
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file',
          variant: 'destructive',
        });
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = () => setLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = () => {
    if (logoFile) {
      uploadLogoMutation.mutate(logoFile);
    }
  };

  const handleSavePdfSettings = () => {
    savePdfSettingsMutation.mutate(pdfSettings);
  };

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

  // Load PDF settings from company
  useEffect(() => {
    if (company) {
      setPdfSettings({
        pdfCompanyName: company.pdfCompanyName || '',
        pdfCompanyAddress: company.pdfCompanyAddress || '',
        pdfCompanyPhone: company.pdfCompanyPhone || '',
        pdfHeaderText: company.pdfHeaderText || '',
        pdfFooterText: company.pdfFooterText || '',
        pdfFontFamily: (company.pdfFontFamily as 'Arial' | 'Helvetica' | 'Times') || 'Arial',
        pdfFontSizeTitle: company.pdfFontSizeTitle || 24,
        pdfFontSizeHeader: company.pdfFontSizeHeader || 16,
        pdfFontSizeBody: company.pdfFontSizeBody || 12,
        pdfFontSizeCaption: company.pdfFontSizeCaption || 10,
        pdfDefaultGridLayout: company.pdfDefaultGridLayout || 2,
        pdfIncludeTimestamp: company.pdfIncludeTimestamp ?? true,
        pdfIncludeTags: company.pdfIncludeTags ?? true,
        pdfIncludeAnnotations: company.pdfIncludeAnnotations ?? true,
        pdfIncludeSignatureLine: company.pdfIncludeSignatureLine ?? false,
      });
      if (company.pdfLogoUrl) {
        setLogoPreview(company.pdfLogoUrl);
      }
    }
  }, [company]);

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
              <div className="text-sm text-muted-foreground">~200 KB • 1280x960 pixels</div>
              <div className="text-xs text-muted-foreground mt-1">Fast upload, good for progress photos and daily documentation</div>
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
              <div className="text-sm text-muted-foreground">~500 KB • 1920x1440 pixels</div>
              <div className="text-xs text-muted-foreground mt-1">Balanced quality and file size for general use and client sharing</div>
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
              <div className="text-sm text-muted-foreground">~1 MB • 2560x1920 pixels</div>
              <div className="text-xs text-muted-foreground mt-1">Maximum quality for defect documentation and project closeout</div>
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
                onClick={() => {
                  if (members.length > 1) {
                    setShowCancellationWarning(true);
                  } else {
                    window.open(process.env.VITE_STRIPE_CUSTOMER_PORTAL_URL || '#', '_blank');
                  }
                }}
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

      {/* PDF Export Settings */}
      {user?.companyId && company?.ownerId === user.id && (
        <div data-testid="section-pdf-settings">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">PDF Export Settings</h2>
          </div>
          
          <Card className="p-6 space-y-6" data-testid="card-pdf-settings">
            {/* Logo Upload */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Company Logo</Label>
              <p className="text-sm text-muted-foreground">Upload a logo to appear on exported PDFs</p>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <div className="w-32 h-32 border rounded-md overflow-hidden flex items-center justify-center bg-muted">
                    <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    id="logo-upload"
                    data-testid="input-logo-file"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('logo-upload')?.click()}
                    data-testid="button-choose-logo"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </Button>
                  {logoFile && (
                    <Button
                      size="sm"
                      onClick={handleLogoUpload}
                      disabled={uploadLogoMutation.isPending}
                      data-testid="button-upload-logo"
                    >
                      {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Company Information */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Company Information</Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pdf-company-name">Company Name</Label>
                  <input
                    id="pdf-company-name"
                    type="text"
                    className="mt-1.5 w-full px-3 py-2 border rounded-md"
                    value={pdfSettings.pdfCompanyName}
                    onChange={(e) => setPdfSettings({ ...pdfSettings, pdfCompanyName: e.target.value })}
                    placeholder="Enter company name"
                    data-testid="input-pdf-company-name"
                  />
                </div>
                <div>
                  <Label htmlFor="pdf-company-address">Company Address</Label>
                  <textarea
                    id="pdf-company-address"
                    className="mt-1.5 w-full px-3 py-2 border rounded-md resize-none"
                    rows={2}
                    value={pdfSettings.pdfCompanyAddress}
                    onChange={(e) => setPdfSettings({ ...pdfSettings, pdfCompanyAddress: e.target.value })}
                    placeholder="Enter company address"
                    data-testid="input-pdf-company-address"
                  />
                </div>
                <div>
                  <Label htmlFor="pdf-company-phone">Company Phone</Label>
                  <input
                    id="pdf-company-phone"
                    type="tel"
                    className="mt-1.5 w-full px-3 py-2 border rounded-md"
                    value={pdfSettings.pdfCompanyPhone}
                    onChange={(e) => setPdfSettings({ ...pdfSettings, pdfCompanyPhone: e.target.value })}
                    placeholder="Enter phone number"
                    data-testid="input-pdf-company-phone"
                  />
                </div>
              </div>
            </div>

            {/* Header/Footer Text */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Default Header & Footer</Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pdf-header-text">Header Text</Label>
                  <input
                    id="pdf-header-text"
                    type="text"
                    className="mt-1.5 w-full px-3 py-2 border rounded-md"
                    value={pdfSettings.pdfHeaderText}
                    onChange={(e) => setPdfSettings({ ...pdfSettings, pdfHeaderText: e.target.value })}
                    placeholder="Optional header text"
                    data-testid="input-pdf-header-text"
                  />
                </div>
                <div>
                  <Label htmlFor="pdf-footer-text">Footer Text</Label>
                  <input
                    id="pdf-footer-text"
                    type="text"
                    className="mt-1.5 w-full px-3 py-2 border rounded-md"
                    value={pdfSettings.pdfFooterText}
                    onChange={(e) => setPdfSettings({ ...pdfSettings, pdfFooterText: e.target.value })}
                    placeholder="Optional footer text"
                    data-testid="input-pdf-footer-text"
                  />
                </div>
              </div>
            </div>

            {/* Font Settings */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Font Settings</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="pdf-font-family">Font Family</Label>
                  <Select
                    value={pdfSettings.pdfFontFamily}
                    onValueChange={(value: 'Arial' | 'Helvetica' | 'Times') => setPdfSettings({ ...pdfSettings, pdfFontFamily: value })}
                  >
                    <SelectTrigger id="pdf-font-family" className="mt-1.5" data-testid="select-pdf-font-family">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Times">Times</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pdf-default-grid">Default Grid Layout</Label>
                  <Select
                    value={pdfSettings.pdfDefaultGridLayout.toString()}
                    onValueChange={(value) => setPdfSettings({ ...pdfSettings, pdfDefaultGridLayout: parseInt(value) })}
                  >
                    <SelectTrigger id="pdf-default-grid" className="mt-1.5" data-testid="select-pdf-default-grid">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 photo per page</SelectItem>
                      <SelectItem value="2">2 photos per page</SelectItem>
                      <SelectItem value="3">3 photos per page</SelectItem>
                      <SelectItem value="4">4 photos per page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Photo Caption Options */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Photo Captions</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pdf-include-timestamp" className="font-normal">Include timestamp</Label>
                  <Switch
                    id="pdf-include-timestamp"
                    checked={pdfSettings.pdfIncludeTimestamp}
                    onCheckedChange={(checked) => setPdfSettings({ ...pdfSettings, pdfIncludeTimestamp: checked })}
                    data-testid="switch-pdf-include-timestamp"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pdf-include-tags" className="font-normal">Include tags</Label>
                  <Switch
                    id="pdf-include-tags"
                    checked={pdfSettings.pdfIncludeTags}
                    onCheckedChange={(checked) => setPdfSettings({ ...pdfSettings, pdfIncludeTags: checked })}
                    data-testid="switch-pdf-include-tags"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pdf-include-annotations" className="font-normal">Include annotations</Label>
                  <Switch
                    id="pdf-include-annotations"
                    checked={pdfSettings.pdfIncludeAnnotations}
                    onCheckedChange={(checked) => setPdfSettings({ ...pdfSettings, pdfIncludeAnnotations: checked })}
                    data-testid="switch-pdf-include-annotations"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pdf-include-signature" className="font-normal">Include signature line</Label>
                  <Switch
                    id="pdf-include-signature"
                    checked={pdfSettings.pdfIncludeSignatureLine}
                    onCheckedChange={(checked) => setPdfSettings({ ...pdfSettings, pdfIncludeSignatureLine: checked })}
                    data-testid="switch-pdf-include-signature"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <Button
                onClick={handleSavePdfSettings}
                disabled={savePdfSettingsMutation.isPending}
                data-testid="button-save-pdf-settings"
              >
                {savePdfSettingsMutation.isPending ? 'Saving...' : 'Save PDF Settings'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Team Management */}
      {user?.companyId && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Team</h2>
          </div>

          {/* Billing Info */}
          {company?.ownerId === user.id && (
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Team Size</span>
                <span className="font-medium">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Cost per user</span>
                <span className="font-medium">$19.99/month</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm font-medium">Total Monthly Cost</span>
                <span className="font-semibold">${(members.length * 19.99).toFixed(2)}/month</span>
              </div>
            </div>
          )}

          {/* Invite Link Section (Owner Only) */}
          {company?.ownerId === user.id && (
            <div className="space-y-3">
              {company?.inviteLinkToken ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Active Invite Link</p>
                      <p className="text-xs text-muted-foreground">
                        {company.inviteLinkUses} / {company.inviteLinkMaxUses} uses
                        {company.inviteLinkExpiresAt && ` • Expires ${new Date(company.inviteLinkExpiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="default"
                      className="flex-1"
                      onClick={copyInviteLink}
                      data-testid="button-copy-invite"
                    >
                      {inviteLinkCopied ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Link
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => revokeInviteMutation.mutate()}
                      disabled={revokeInviteMutation.isPending}
                      data-testid="button-revoke-invite"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="default"
                  className="w-full"
                  onClick={() => generateInviteMutation.mutate()}
                  disabled={generateInviteMutation.isPending}
                  data-testid="button-generate-invite"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  {generateInviteMutation.isPending ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              )}
            </div>
          )}

          {/* Team Members List */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Team Members</p>
            {members.map((member: any) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border"
                data-testid={`member-item-${member.id}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={member.profileImageUrl || undefined} />
                    <AvatarFallback>
                      {member.firstName?.[0] || member.email?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.firstName && member.lastName 
                        ? `${member.firstName} ${member.lastName}` 
                        : member.email}
                      {member.id === user.id && (
                        <span className="text-xs text-muted-foreground ml-2">(You)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  {company?.ownerId === member.id && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10">
                      <Crown className="w-3 h-3 text-primary" />
                      <span className="text-xs font-medium text-primary">Owner</span>
                    </div>
                  )}
                </div>

                {/* Owner Actions */}
                {company?.ownerId === user.id && member.id !== user.id && (
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => promoteMemberMutation.mutate(member.id)}
                      disabled={promoteMemberMutation.isPending}
                      title="Transfer ownership"
                      data-testid={`button-promote-${member.id}`}
                    >
                      <Crown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      disabled={removeMemberMutation.isPending}
                      title="Remove member"
                      data-testid={`button-remove-${member.id}`}
                    >
                      <UserMinus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

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

      {/* Cancellation Warning Dialog */}
      <AlertDialog open={showCancellationWarning} onOpenChange={setShowCancellationWarning}>
        <AlertDialogContent data-testid="dialog-cancellation-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>Important: Team Impact</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You're managing a subscription for <strong>{members.length} team {members.length === 1 ? 'member' : 'members'}</strong>.
              </p>
              <p>
                If you cancel your subscription:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All {members.length - 1} team {members.length - 1 === 1 ? 'member' : 'members'} will lose access</li>
                <li>Projects and photos remain viewable but read-only</li>
                <li>No new content can be created</li>
              </ul>
              <p className="font-medium">
                Continue to Stripe to manage your subscription?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-warning">
              Go Back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowCancellationWarning(false);
                window.open(process.env.VITE_STRIPE_CUSTOMER_PORTAL_URL || '#', '_blank');
              }}
              data-testid="button-continue-to-stripe"
            >
              Continue to Stripe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
