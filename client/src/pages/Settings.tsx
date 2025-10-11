import { Settings as SettingsIcon, Moon, Sun, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useState, useEffect } from 'react';
import { syncManager } from '@/lib/syncManager';

export default function Settings() {
  const [isDark, setIsDark] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<{
    pending: number;
    projects: number;
    photos: number;
  } | null>(null);

  useEffect(() => {
    // Check initial theme
    const root = document.documentElement;
    setIsDark(root.classList.contains('dark'));

    // Load sync status
    loadSyncStatus();

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

  const toggleTheme = () => {
    const root = document.documentElement;
    const newIsDark = !isDark;
    
    if (newIsDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    setIsDark(newIsDark);
    localStorage.setItem('theme', newIsDark ? 'dark' : 'light');
  };

  const handleSync = async () => {
    await syncManager.syncNow();
    await loadSyncStatus();
  };

  return (
    <div className="p-4 pb-24 space-y-6 max-w-screen-sm mx-auto">
      <div className="flex items-center space-x-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold" data-testid="text-settings-title">
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

      {/* Sync Status */}
      <Card className="p-4 space-y-4">
        <h2 className="text-lg font-semibold">Sync Status</h2>
        
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
          onClick={handleSync}
          disabled={!isOnline || (syncStatus?.pending === 0)}
          data-testid="button-sync-now"
        >
          Sync Now
        </Button>
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
    </div>
  );
}
