import { Link, useLocation } from 'wouter';
import { Camera, FolderOpen, Settings } from 'lucide-react';

export default function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderOpen,
      path: '/',
    },
    {
      id: 'camera',
      label: 'Camera',
      icon: Camera,
      path: '/camera',
    },
  ];

  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

  // Hide bottom nav when on Camera page, project detail page, or share pages
  const isOnCamera = location.startsWith('/camera');
  const isOnProjectDetail = /^\/projects\/[^/]+$/.test(location);
  const isOnSharePage = location.startsWith('/share/');
  const shouldHideNav = isOnCamera || isOnProjectDetail || isOnSharePage;

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-inset-bottom transition-transform duration-300 ease-in-out ${
        shouldHideNav ? 'translate-y-full' : 'translate-y-0'
      }`}
      data-testid="nav-bottom"
    >
      <div className="flex items-center justify-around h-16 max-w-screen-sm mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);

          return (
            <Link key={tab.id} href={tab.path}>
              <button
                className="flex flex-col items-center justify-center min-w-[88px] h-full space-y-0.5 transition-colors"
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
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
