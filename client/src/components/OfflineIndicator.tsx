import { useState, useEffect } from 'react';
import { WifiOff, Wifi, Signal } from 'lucide-react';
import { nativeNetwork } from '@/lib/nativeNetwork';
import type { NetworkStatus } from '@/lib/nativeNetwork';

export function OfflineIndicator() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ 
    connected: navigator.onLine, 
    connectionType: 'unknown' 
  });

  useEffect(() => {
    nativeNetwork.getStatus().then(setNetworkStatus);

    const cleanup = nativeNetwork.addListener(setNetworkStatus);

    return cleanup;
  }, []);

  if (networkStatus.connected) return null;

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[100] bg-orange-600 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shadow-lg"
      data-testid="banner-offline"
    >
      <WifiOff className="w-4 h-4" />
      <span>You're offline. Changes will sync when you're back online.</span>
    </div>
  );
}
