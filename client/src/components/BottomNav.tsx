import { Link, useLocation } from 'wouter';
import { Camera, Home, CheckSquare, MapPin, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
};

export default function BottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();
  
  // Fetch notifications to show unread count on To-Do tab
  // Only fetch when authenticated to prevent 401 errors
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
    enabled: isAuthenticated, // Only fetch when user is authenticated
    refetchInterval: 60000, // Refresh every 60 seconds
  });

  const unreadCount = notifications.filter((n: Notification) => !n.read).length;

  const tabs = [
    {
      id: 'projects',
      label: 'Projects',
      icon: Home,
      path: '/projects',
    },
    {
      id: 'todos',
      label: 'To-Do',
      icon: CheckSquare,
      path: '/todos',
    },
    {
      id: 'map',
      label: 'Locations',
      icon: MapPin,
      path: '/map',
    },
    {
      id: 'time',
      label: 'Time',
      icon: Clock,
      path: '/time',
    },
    {
      id: 'camera',
      label: 'Camera',
      icon: Camera,
      path: '/camera',
    },
  ];

  const isActive = (path: string) => {
    if (path === '/projects' && location === '/projects') return true;
    if (path !== '/projects' && location.startsWith(path)) return true;
    return false;
  };

  // Hide bottom nav when on Camera page, project detail page, photo edit page, or share pages
  const isOnCamera = location.startsWith('/camera');
  const isOnProjectDetail = /^\/projects\/[^/]+$/.test(location);
  const isOnPhotoEdit = location.startsWith('/photo/') && location.endsWith('/edit');
  const isOnSharePage = location.startsWith('/share/');
  const shouldHideNav = isOnCamera || isOnProjectDetail || isOnPhotoEdit || isOnSharePage;

  // Don't render at all if should be hidden
  if (shouldHideNav) {
    return null;
  }

  return (
    <>
      {/* Background fill to prevent content from showing at bottom */}
      <div className="fixed bottom-0 left-0 right-0 h-28 bg-white/80 dark:bg-black/80 backdrop-blur-md z-30 pointer-events-none pb-safe" />
      
      <nav
        className="fixed bottom-4 left-0 right-0 z-[100] bg-transparent pb-safe"
        data-testid="nav-bottom"
      >
        <div className="flex items-center justify-around gap-1 min-h-[44px] max-w-screen-sm mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);

          return (
            <Link key={tab.id} href={tab.path}>
              <button
                className="flex flex-col items-center justify-center min-w-[60px] min-h-[44px] space-y-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                data-testid={`button-tab-${tab.id}`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      active ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  {/* Apple-style notification badge for To-Do tab */}
                  {tab.id === 'todos' && unreadCount > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-semibold text-white rounded-full shadow-sm"
                      style={{
                        background: 'linear-gradient(180deg, #FF3B30 0%, #FF2D23 100%)',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
                      }}
                      data-testid="badge-todo-notifications"
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors whitespace-nowrap ${
                    active ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
    </>
  );
}
