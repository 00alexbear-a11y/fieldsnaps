import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

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
