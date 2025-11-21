import { Settings as SettingsIcon, Moon, Sun, Wifi, WifiOff, User, LogIn, LogOut, Fingerprint, HardDrive, ChevronRight, Trash2, Tag as TagIcon, Plus, Pencil, X, CreditCard, Sparkles, Camera, Users, Link as LinkIcon, Copy, Check, UserMinus, Crown, FileText, Upload, Image as ImageIcon, Clock, Info, UserCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { MobileDialog } from '@/components/ui/mobile-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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
import { nativeClipboard } from '@/lib/nativeClipboard';
import { haptics } from '@/lib/nativeHaptics';
import type { Tag, Company, User as UserType } from '@shared/schema';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';
import { ProfilePhotoUpload } from '@/components/ProfilePhotoUpload';
import { ProfileSetupDialog } from '@/components/ProfileSetupDialog';

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
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [cleanupResults, setCleanupResults] = useState<{
    deleted: number;
    photos: Array<{ id: string; projectName?: string; syncStatus: string }>;
  } | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('blue');
  
  const [cameraQuality, setCameraQuality] = useState<'quick' | 'standard' | 'detailed'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('camera-quality');
      return (saved as 'quick' | 'standard' | 'detailed') || 'standard';
    }
    return 'standard';
  });
  
  const { data: userSettings } = useQuery<{ uploadOnWifiOnly: boolean }>({
    queryKey: ['/api/settings'],
    enabled: !!user,
  });
  
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: { uploadOnWifiOnly: boolean }) => {
      const res = await apiRequest('PUT', '/api/settings', data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: 'Settings updated',
        description: 'Your upload preferences have been saved',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [showCancellationWarning, setShowCancellationWarning] = useState(false);
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [showTagsDialog, setShowTagsDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [showCameraDialog, setShowCameraDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showTimeTrackingDialog, setShowTimeTrackingDialog] = useState(false);

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

  const { data: company } = useQuery<Company>({
    queryKey: ['/api/companies/me'],
    enabled: !!user?.companyId,
  });

  const { data: members = [] } = useQuery<UserType[]>({
    queryKey: ['/api/companies/members'],
    enabled: !!user?.companyId,
  });

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
      const res = await apiRequest('POST', '/api/companies/pdf-logo', formData);
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

  const saveTimeTrackingSettingsMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest('PUT', '/api/companies/time-tracking-settings', {
        autoTrackingEnabledByDefault: enabled,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies/me'] });
      setShowTimeTrackingDialog(false);
      toast({
        title: 'Time tracking settings saved',
        description: 'Company default has been updated',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const copyInviteLink = async () => {
    if (company?.inviteLinkToken) {
      const inviteUrl = `${window.location.origin}/api/companies/invite/${company.inviteLinkToken}`;
      try {
        await nativeClipboard.write(inviteUrl);
        haptics.light();
        setInviteLinkCopied(true);
        setTimeout(() => setInviteLinkCopied(false), 2000);
        toast({
          title: 'Invite link copied',
          description: 'Share this link with your team members',
          duration: 2000,
        });
      } catch (error) {
        haptics.error();
        toast({
          title: 'Failed to copy link',
          description: 'Please try again',
          variant: 'destructive',
          duration: 2000,
        });
      }
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
    loadSyncStatus(true);
    calculateStorageUsage();
    checkBiometricSupport().then(setBiometricSupported);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

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

  const loadSyncStatus = async (cleanup = false) => {
    if (cleanup) {
      await syncManager.cleanupSyncQueue();
    }
    const status = await syncManager.getSyncStatus();
    setSyncStatus(status);
  };

  const calculateStorageUsage = async () => {
    try {
      const projects = await indexedDBService.getAllProjects();
      
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

  const handleCleanupOrphans = async () => {
    setIsCleaningUp(true);
    try {
      const results = await indexedDBService.cleanupOrphanedPhotos();
      setCleanupResults(results);
      setShowCleanupDialog(true);
      
      await calculateStorageUsage();
    } catch (error) {
      console.error('Failed to cleanup orphaned photos:', error);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ['/api/tags'],
  });

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

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/billing/create-checkout-session');
      return await res.json();
    },
    onSuccess: (data: { url: string }) => {
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

  const getQualityLabel = () => {
    const labels = {
      quick: 'Quick (S)',
      standard: 'Standard (M)',
      detailed: 'Detailed (L)'
    };
    return labels[cameraQuality];
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-background border-b">
        <div className="px-4 pt-safe-3 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Settings</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pb-24 pt-6 space-y-6 max-w-screen-sm mx-auto">

          {/* Account */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-card">
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
                <p className="font-semibold truncate" data-testid="text-user-name">
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
            
            <Separator />
            <button
              onClick={() => setShowProfileDialog(true)}
              className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
              data-testid="button-edit-profile"
            >
              <div className="flex items-center gap-3">
                <UserCircle className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Edit Profile</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            
            {biometricSupported && (
              <>
                <Separator />
                <button
                  onClick={registerBiometric}
                  disabled={isWebAuthnLoading}
                  className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
                  data-testid="button-register-biometric"
                >
                  <div className="flex items-center gap-3">
                    <Fingerprint className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm">Biometric Login</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </>
            )}
            
            <Separator />
            <button
              onClick={async () => {
                try {
                  const { tokenManager } = await import('@/lib/tokenManager');
                  const { Capacitor } = await import('@capacitor/core');
                  
                  if (Capacitor.isNativePlatform()) {
                    await tokenManager.logout();
                    window.location.href = '/login';
                  } else {
                    window.location.href = '/api/logout';
                  }
                } catch (error) {
                  console.error('Logout failed:', error);
                  window.location.href = '/api/logout';
                }
              }}
              className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
              data-testid="button-logout"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Sign Out</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </Card>

          {/* Appearance */}
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 h-12">
              <div className="flex items-center gap-3">
                {isDark ? <Moon className="w-5 h-5 text-muted-foreground" /> : <Sun className="w-5 h-5 text-muted-foreground" />}
                <span className="text-sm">Dark Mode</span>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={toggleTheme}
                data-testid="switch-dark-mode"
              />
            </div>
          </Card>

          {/* Camera */}
          <Card className="p-0 overflow-hidden">
            <button
              onClick={() => setShowCameraDialog(true)}
              className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
              data-testid="button-camera-quality"
            >
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Photo Quality</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{getQualityLabel()}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
          </Card>

          {/* Data & Storage */}
          <Card className="p-0 overflow-hidden">
            <div 
              className="flex items-center justify-between px-4 h-12 cursor-pointer hover-elevate active-elevate-2"
              onClick={() => setLocation('/location-privacy')}
              data-testid="link-location-privacy"
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Location & Privacy</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between px-4 h-12">
              <div className="flex items-center gap-3">
                <Wifi className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Upload Only on WiFi</span>
              </div>
              <Switch
                checked={userSettings?.uploadOnWifiOnly ?? true}
                onCheckedChange={(checked) => updateSettingsMutation.mutate({ uploadOnWifiOnly: checked })}
                data-testid="switch-upload-wifi-only"
              />
            </div>
            
            <Separator />
            <button
              onClick={() => setLocation('/sync-status')}
              className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
              data-testid="card-sync-status"
            >
              <div className="flex items-center gap-3">
                {isOnline ? (
                  <Wifi className="w-5 h-5 text-green-500" />
                ) : (
                  <WifiOff className="w-5 h-5 text-destructive" />
                )}
                <span className="text-sm">Sync Status</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" data-testid="text-online-status">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
            
            <Separator />
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Local Storage</span>
                </div>
                {storageUsage && (
                  <span className="text-sm font-medium" data-testid="text-storage-mb">
                    {storageUsage.mb} MB
                  </span>
                )}
              </div>
              {storageUsage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanupOrphans}
                  disabled={isCleaningUp}
                  className="w-full mt-2"
                  data-testid="button-cleanup-orphans"
                >
                  {isCleaningUp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2"></div>
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clean Up Storage
                    </>
                  )}
                </Button>
              )}
            </div>
            
            <Separator />
            <button
              onClick={() => setLocation('/trash')}
              className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
              data-testid="card-trash"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">Trash</span>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </Card>

          {/* Team Management */}
          {user?.companyId && (
            <Card className="p-0 overflow-hidden">
              <button
                onClick={() => setShowTagsDialog(true)}
                className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
                data-testid="button-manage-tags"
              >
                <div className="flex items-center gap-3">
                  <TagIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Photo Tags</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{tags.length}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
              
              <Separator />
              <button
                onClick={() => setShowTeamDialog(true)}
                className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
                data-testid="button-manage-team"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm">Team Members</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{members.length}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
              
              {company?.ownerId === user.id && (
                <>
                  <Separator />
                  <button
                    onClick={() => setShowTimeTrackingDialog(true)}
                    className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
                    data-testid="button-time-tracking-settings"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-muted-foreground" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm">Automatic Time Tracking</span>
                        <span className="text-xs text-muted-foreground">
                          {company?.autoTrackingEnabledByDefault ? 'Enabled' : 'Disabled'} for team by default
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                  
                  <Separator />
                  <button
                    onClick={() => setShowPdfDialog(true)}
                    className="w-full flex items-center justify-between px-4 h-12 hover-elevate active-elevate-2"
                    data-testid="button-pdf-settings"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <span className="text-sm">PDF Export Settings</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </Card>
          )}

          {/* Billing */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Subscription</span>
              </div>
              
              {user?.subscriptionStatus === 'trial' && user?.trialStartDate && (
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">Free Trial</span>
                  </div>
                  {user?.trialEndDate && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ends</span>
                        <span className="font-medium">
                          {Math.max(0, Math.ceil((new Date(user.trialEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days
                        </span>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full mt-2"
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

              {user?.subscriptionStatus === 'trial' && !user?.trialStartDate && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">
                    Your 7-day free trial starts when you create your first project
                  </p>
                </div>
              )}

              {user?.subscriptionStatus === 'active' && (
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-green-600 dark:text-green-500">Active</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Plan</span>
                    <span className="font-medium">$19.99/month</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2"
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

              {user?.subscriptionStatus === 'past_due' && (
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-amber-600 dark:text-amber-500">Payment Issue</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Please update your payment method
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-2"
                    onClick={() => window.open(process.env.VITE_STRIPE_CUSTOMER_PORTAL_URL || '#', '_blank')}
                    data-testid="button-update-payment"
                  >
                    <CreditCard className="w-4 h-4 mr-2" />
                    Update Payment
                  </Button>
                </div>
              )}

              {(!user?.subscriptionStatus || user?.subscriptionStatus === 'canceled' || 
                (user?.subscriptionStatus === 'trial' && user?.trialEndDate && new Date(user.trialEndDate) < new Date())) && (
                <div className="space-y-2 mt-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium">Trial Ended</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Upgrade to continue using all features
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full mt-2"
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

          {/* About */}
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <Info className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">About</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2" data-testid="text-app-version">
                FieldSnaps v1.0.0
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Offline-first photo documentation
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Camera Quality Dialog */}
      <Dialog open={showCameraDialog} onOpenChange={setShowCameraDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Photo Quality</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <label
              className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${
                cameraQuality === 'quick' ? 'border-primary bg-primary/5' : 'border-border hover-elevate'
              }`}
              data-testid="option-quality-quick"
            >
              <div className="flex-1">
                <div className="font-medium">Quick (S)</div>
                <div className="text-sm text-muted-foreground">~200 KB • 1280x960 pixels</div>
                <div className="text-xs text-muted-foreground mt-1">Fast upload, good for progress photos</div>
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
                <div className="text-xs text-muted-foreground mt-1">Balanced quality for general use</div>
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
                <div className="text-xs text-muted-foreground mt-1">Maximum quality for documentation</div>
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
        </DialogContent>
      </Dialog>

      {/* Tags Dialog */}
      <Dialog open={showTagsDialog} onOpenChange={setShowTagsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Photo Tags</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No tags yet. Create one to categorize your photos.
              </p>
            ) : (
              <div className="space-y-2">
                {tags.map((tag) => (
                  <div
                    key={tag.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    data-testid={`tag-item-${tag.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
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
            
            <Button
              variant="default"
              className="w-full"
              onClick={() => handleOpenTagDialog()}
              data-testid="button-create-tag"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Tag
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tag Edit Dialog */}
      <MobileDialog
        open={isTagDialogOpen}
        onOpenChange={setIsTagDialogOpen}
        title={editingTag ? 'Edit Tag' : 'Create Tag'}
        showCancel
        onCancel={() => setIsTagDialogOpen(false)}
        footer={
          <Button
            onClick={handleSaveTag}
            disabled={createTagMutation.isPending || updateTagMutation.isPending}
            data-testid="button-save-tag"
            className="w-full"
          >
            {editingTag ? 'Update' : 'Create'}
          </Button>
        }
      >
        <div className="space-y-4" data-testid="dialog-tag-edit">
          <div className="space-y-2">
            <Input
              id="tag-name"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="Name (e.g., Electrician, HVAC)"
              data-testid="input-tag-name"
            />
          </div>

          <div className="space-y-2">
            <Select value={tagColor} onValueChange={setTagColor}>
              <SelectTrigger id="tag-color" data-testid="select-tag-color">
                <SelectValue placeholder="Color" />
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
      </MobileDialog>

      {/* Team Dialog */}
      <MobileDialog 
        open={showTeamDialog} 
        onOpenChange={setShowTeamDialog} 
        title="Team Members"
        showCancel
        onCancel={() => setShowTeamDialog(false)}
      >
        <div className="space-y-4">
              {company?.ownerId === user?.id && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Team Size</span>
                    <span className="font-medium">{members.length}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Monthly Cost</span>
                    <span className="font-semibold">${(members.length * 19.99).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {company?.ownerId === user?.id && (
                <div className="space-y-3">
                  {company?.inviteLinkToken ? (
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Active Invite Link</p>
                      <p className="text-xs text-muted-foreground">
                        {company.inviteLinkUses} / {company.inviteLinkMaxUses} uses
                        {company.inviteLinkExpiresAt && ` • Expires ${new Date(company.inviteLinkExpiresAt).toLocaleDateString()}`}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
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
                          size="sm"
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
                      size="sm"
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

              <div className="space-y-2">
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
                        <p className="font-medium truncate text-sm">
                          {member.firstName && member.lastName 
                            ? `${member.firstName} ${member.lastName}` 
                            : member.email}
                          {member.id === user?.id && (
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

                    {company?.ownerId === user?.id && member.id !== user?.id && (
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
            </div>
      </MobileDialog>

      {/* PDF Settings Dialog */}
      <MobileDialog 
        open={showPdfDialog} 
        onOpenChange={setShowPdfDialog}
        title="PDF Export Settings"
        showCancel
        onCancel={() => setShowPdfDialog(false)}
        footer={
          <Button
            onClick={() => {
              handleSavePdfSettings();
              setShowPdfDialog(false);
            }}
            disabled={savePdfSettingsMutation.isPending}
            data-testid="button-save-pdf-settings"
            className="w-full"
          >
            {savePdfSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        }
      >
        <div className="space-y-6">
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
                    <Input
                      id="pdf-company-name"
                      type="text"
                      className="mt-1.5"
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
                    <Input
                      id="pdf-company-phone"
                      type="tel"
                      className="mt-1.5"
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
                    <Input
                      id="pdf-header-text"
                      type="text"
                      className="mt-1.5"
                      value={pdfSettings.pdfHeaderText}
                      onChange={(e) => setPdfSettings({ ...pdfSettings, pdfHeaderText: e.target.value })}
                      placeholder="Optional header text"
                      data-testid="input-pdf-header-text"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pdf-footer-text">Footer Text</Label>
                    <Input
                      id="pdf-footer-text"
                      type="text"
                      className="mt-1.5"
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
            </div>
      </MobileDialog>

      {/* Cleanup Results Dialog */}
      <AlertDialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <AlertDialogContent data-testid="dialog-cleanup-results">
          <AlertDialogHeader>
            <AlertDialogTitle>Orphaned Photo Cleanup Complete</AlertDialogTitle>
            <AlertDialogDescription>
              {cleanupResults ? (
                <>
                  {cleanupResults.deleted === 0 ? (
                    <p>No orphaned photos found. Your storage is clean!</p>
                  ) : (
                    <>
                      <p className="mb-3">
                        Successfully removed <strong>{cleanupResults.deleted}</strong> orphaned {cleanupResults.deleted === 1 ? 'photo' : 'photos'}.
                      </p>
                      {cleanupResults.photos.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm font-medium mb-2">Deleted photos:</p>
                          <ul className="text-xs space-y-1 max-h-40 overflow-y-auto">
                            {cleanupResults.photos.map((photo) => (
                              <li key={photo.id} className="text-muted-foreground">
                                {photo.projectName || 'Unknown Project'} - Status: {photo.syncStatus}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p>Cleanup completed.</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              onClick={() => setShowCleanupDialog(false)}
              data-testid="button-close-cleanup-results"
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Profile Setup Dialog */}
      <ProfileSetupDialog
        open={showProfileDialog}
        onOpenChange={setShowProfileDialog}
        user={user || null}
        isFirstTime={false}
      />
    </div>
  );
}
