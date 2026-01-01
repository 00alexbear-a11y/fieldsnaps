import { useState, useEffect, memo, useRef } from 'react';
import { WifiOff } from 'lucide-react';
import { nativeNetwork } from '@/lib/nativeNetwork';
import type { NetworkStatus } from '@/lib/nativeNetwork';

// Memoize to prevent re-renders when parent (App) re-renders
export const OfflineIndicator = memo(function OfflineIndicator() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ 
    connected: navigator.onLine, 
    connectionType: 'unknown' 
  });
  const [isVisible, setIsVisible] = useState(true);
  const lastOnlineRef = useRef(navigator.onLine);

  useEffect(() => {
    nativeNetwork.getStatus().then(setNetworkStatus);

    const cleanup = nativeNetwork.addListener((status) => {
      setNetworkStatus(status);
      
      // Show notification when going offline (transition from online to offline)
      if (!status.connected && lastOnlineRef.current) {
        setIsVisible(true);
      }
      lastOnlineRef.current = status.connected;
    });

    return cleanup;
  }, []);

  // Auto-dismiss after 3 seconds, but re-show on network status change
  useEffect(() => {
    if (!networkStatus.connected && isVisible) {
      const timer = setTimeout(() => setIsVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [networkStatus.connected, isVisible]);

  // Don't show if online or dismissed
  if (networkStatus.connected || !isVisible) return null;

  return (
    <div 
      className="fixed top-[calc(var(--safe-area-top,0px)+8px)] left-1/2 -translate-x-1/2 z-[100] bg-orange-600/95 text-white px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-full shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200"
      data-testid="banner-offline"
    >
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
});
