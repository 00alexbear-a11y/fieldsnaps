import { Link, useLocation } from 'wouter';
import { Camera, FolderOpen, Bell, MapPin } from 'lucide-react';

export default function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    {
      id: 'map',
      label: 'Map',
      icon: MapPin,
      path: '/map',
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderOpen,
      path: '/projects',
    },
    {
      id: 'inbox',
      label: 'Notifications',
      icon: Bell,
      path: '/inbox',
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

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border safe-area-inset-bottom transition-transform duration-300 ease-in-out ${
        shouldHideNav ? 'translate-y-full' : 'translate-y-0'
      }`}
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-16 max-w-screen-sm mx-auto pb-safe">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);
          const isCamera = tab.id === 'camera';

          return (
            <Link key={tab.id} href={tab.path}>
              {isCamera ? (
                <button
                  className="flex flex-col items-center justify-center min-w-[88px] h-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  data-testid={`button-tab-${tab.id}`}
                >
                  <div className="flex items-center justify-center w-12 h-12 bg-primary rounded-full shadow-lg hover-elevate active-elevate-2 mb-0.5">
                    <Icon className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <span className="text-xs font-medium text-primary">
                    {tab.label}
                  </span>
                </button>
              ) : (
                <button
                  className="flex flex-col items-center justify-center min-w-[88px] h-full space-y-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  data-testid={`button-tab-${tab.id}`}
                >
                  <Icon
                    className={`w-6 h-6 transition-colors ${
                      active ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <span
                    className={`text-xs font-medium transition-colors ${
                      active ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
