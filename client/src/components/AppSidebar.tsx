import { Moon, Sun, Activity as ActivityIcon, Settings as SettingsIcon, HelpCircle, LogOut, User } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { haptics } from '@/lib/nativeHaptics';

export function AppSidebar() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setOpenMobile } = useSidebar();

  const handleLogout = async () => {
    try {
      await haptics.light();
      await apiRequest('POST', '/api/auth/logout');
      setLocation('/');
      toast({
        title: 'Logged out',
        description: 'You have been logged out successfully',
      });
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to log out',
        variant: 'destructive',
      });
    }
  };

  const handleThemeToggle = () => {
    haptics.light();
    toggleTheme();
  };

  // Close mobile sidebar when navigating
  const handleNavClick = () => {
    setOpenMobile(false);
  };

  // Get user initials for avatar fallback
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : 'U';

  // Menu items
  const menuItems = [
    {
      title: 'Activity',
      icon: ActivityIcon,
      href: '/activity',
    },
    {
      title: 'Settings',
      icon: SettingsIcon,
      href: '/settings',
    },
    {
      title: 'Help',
      icon: HelpCircle,
      href: '/help',
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" data-testid="app-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-4">
          {user && (
            <>
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.profileImageUrl || undefined} alt={`${user.firstName} ${user.lastName}`} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid="sidebar-user-name">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="sidebar-user-email">
                  {user.email}
                </p>
              </div>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    data-testid={`sidebar-link-${item.title.toLowerCase()}`}
                  >
                    <Link href={item.href} onClick={handleNavClick}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <Separator className="my-2" />

              {/* Theme Toggle */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleThemeToggle}
                  data-testid="sidebar-theme-toggle"
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              data-testid="sidebar-logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
