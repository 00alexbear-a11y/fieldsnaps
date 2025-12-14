import { useState, useEffect, memo } from 'react';
import { WifiOff } from 'lucide-react';
import { nativeNetwork } from '@/lib/nativeNetwork';
import type { NetworkStatus } from '@/lib/nativeNetwork';

// Memoize to prevent re-renders when parent (App) re-renders
export const OfflineIndicator = memo(function OfflineIndicator() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ 
    connected: navigator.onLine, 
    connectionType: 'unknown' 
  });

  useEffect(() => {
    // Only fetch status once on mount
    nativeNetwork.getStatus().then(setNetworkStatus);

    // Set up listener for network changes
    const cleanup = nativeNetwork.addListener(setNetworkStatus);

    return cleanup;
  }, []); // Empty deps - only run on mount/unmount

  if (networkStatus.connected) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[100] bg-orange-600 text-white px-4 pt-safe-2 pb-2 text-sm font-medium flex items-center justify-center gap-2 shadow-lg"
      data-testid="banner-offline"
    >
      <WifiOff className="w-4 h-4" />
      <span>You're offline. Changes will sync when you're back online.</span>
    </div>
  );
});
