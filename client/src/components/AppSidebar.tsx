import { useState, useEffect } from 'react';
import { Moon, Sun, Activity as ActivityIcon, Settings as SettingsIcon, HelpCircle, LogOut, User, Clock, Star, FolderOpen, ArrowUpAZ, ArrowDownAZ, Camera, Calendar, CheckCircle2, Flag, ListTodo, MapPin, Radio, FileText } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { haptics } from '@/lib/nativeHaptics';
import { useQuery } from '@tanstack/react-query';

export function AppSidebar() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { setOpenMobile } = useSidebar();

  // Parse URL query params for filters - use state to trigger re-renders
  const getUrlParams = () => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      currentView: (searchParams.get('view') || 'all') as 'all' | 'recent' | 'favorites',
      currentSort: (searchParams.get('sort') || 'last-activity') as 'name-asc' | 'name-desc' | 'photos' | 'last-activity' | 'created',
      showCompleted: searchParams.get('completed') === 'true',
      todoList: (searchParams.get('list') || 'assigned-to-me') as 'today' | 'flagged' | 'assigned-to-me' | 'all' | 'completed',
    };
  };

  const [urlState, setUrlState] = useState(getUrlParams());
  const { currentView, currentSort, showCompleted, todoList } = urlState;

  // Listen for URL changes (browser back/forward and custom filterChange)
  useEffect(() => {
    const handleUrlChange = () => {
      setUrlState(getUrlParams());
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('filterChange', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('filterChange', handleUrlChange);
    };
  }, []);

  // Determine current page from pathname (ignore query params)
  const currentPath = window.location.pathname;
  const isProjectsPage = currentPath === '/projects';
  const isToDosPage = currentPath === '/todos';

  // Fetch project counts for badges (only on /projects)
  const { data: projects } = useQuery({
    queryKey: ['/api/projects'],
    enabled: isProjectsPage,
  });

  // Fetch todo counts for badges (only on /todos)
  const { data: todos } = useQuery({
    queryKey: ['/api/todos'],
    enabled: isToDosPage,
  });

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

  // Update URL query params
  const updateQueryParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    // Trigger a custom event so the page can react to filter changes
    window.dispatchEvent(new CustomEvent('filterChange'));
  };

  const toggleQueryParam = (key: string, currentValue: boolean) => {
    const params = new URLSearchParams(window.location.search);
    if (currentValue) {
      params.delete(key);
    } else {
      params.set(key, 'true');
    }
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.pushState({}, '', newUrl);
    window.dispatchEvent(new CustomEvent('filterChange'));
  };

  // Get user initials for avatar fallback
  const userInitials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'
    : 'U';

  // Calculate counts for Projects page
  const totalProjects = Array.isArray(projects) ? projects.length : 0;
  const recentCount = Array.isArray(projects) ? projects.filter((p: any) => p.isRecent).length : 0;
  const favoritesCount = Array.isArray(projects) ? projects.filter((p: any) => p.isFavorite).length : 0;

  // Calculate counts for ToDos page
  const todayCount = Array.isArray(todos) ? todos.filter((t: any) => !t.completed && t.dueDate && new Date(t.dueDate).toDateString() === new Date().toDateString()).length : 0;
  const flaggedCount = Array.isArray(todos) ? todos.filter((t: any) => !t.completed && t.flag).length : 0;
  const assignedToMeCount = Array.isArray(todos) ? todos.filter((t: any) => !t.completed && t.assignedTo === user?.id).length : 0;
  const allCount = Array.isArray(todos) ? todos.filter((t: any) => !t.completed).length : 0;
  const completedCount = Array.isArray(todos) ? todos.filter((t: any) => t.completed).length : 0;

  // Admin-only menu items
  const adminMenuItems = user?.role === 'owner' ? [
    {
      title: 'Geofences',
      icon: MapPin,
      href: '/admin/geofences',
    },
    {
      title: 'Live Tracking',
      icon: Radio,
      href: '/admin/locations',
    },
    {
      title: 'Timesheets',
      icon: FileText,
      href: '/admin/timesheets',
    },
  ] : [];

  // Menu items (always visible)
  const menuItems = [
    ...adminMenuItems,
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
    <Sidebar collapsible="icon" data-testid="app-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-3 pb-4 safe-area-pt-4">
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
        {/* Projects Page: Smart Views */}
        {isProjectsPage && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Smart Views</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('view', 'all')}
                      isActive={currentView === 'all'}
                      data-testid="view-all-projects"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>All Projects</span>
                      <Badge variant="secondary" className="ml-auto" data-testid="badge-all-projects-count">
                        {totalProjects}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('view', 'recent')}
                      isActive={currentView === 'recent'}
                      data-testid="view-recent-projects"
                    >
                      <Clock className="w-4 h-4" />
                      <span>Recent</span>
                      {recentCount > 0 && (
                        <Badge variant="secondary" className="ml-auto" data-testid="badge-recent-count">
                          {recentCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('view', 'favorites')}
                      isActive={currentView === 'favorites'}
                      data-testid="view-favorites"
                    >
                      <Star className="w-4 h-4" />
                      <span>Favorites</span>
                      {favoritesCount > 0 && (
                        <Badge variant="secondary" className="ml-auto" data-testid="badge-favorites-count">
                          {favoritesCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            {/* Projects Page: Sort Options */}
            <SidebarGroup>
              <SidebarGroupLabel>Sort By</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('sort', 'name-asc')}
                      isActive={currentSort === 'name-asc'}
                      data-testid="sort-name-asc"
                    >
                      <ArrowUpAZ className="w-4 h-4" />
                      <span>Name (A-Z)</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('sort', 'name-desc')}
                      isActive={currentSort === 'name-desc'}
                      data-testid="sort-name-desc"
                    >
                      <ArrowDownAZ className="w-4 h-4" />
                      <span>Name (Z-A)</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('sort', 'photos')}
                      isActive={currentSort === 'photos'}
                      data-testid="sort-most-photos"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Most Photos</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('sort', 'last-activity')}
                      isActive={currentSort === 'last-activity'}
                      data-testid="sort-last-activity"
                    >
                      <ActivityIcon className="w-4 h-4" />
                      <span>Last Activity</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('sort', 'created')}
                      isActive={currentSort === 'created'}
                      data-testid="sort-date-created"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>Date Created</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            {/* Projects Page: Options */}
            <SidebarGroup>
              <SidebarGroupLabel>Options</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => toggleQueryParam('completed', showCompleted)}
                      isActive={showCompleted}
                      data-testid="toggle-show-completed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Show Completed</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
          </>
        )}

        {/* ToDos Page: Smart Lists */}
        {isToDosPage && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Smart Lists</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('list', 'today')}
                      isActive={todoList === 'today'}
                      data-testid="sidebar-today"
                    >
                      <ListTodo className="w-4 h-4" />
                      <span>Today</span>
                      {todayCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {todayCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('list', 'flagged')}
                      isActive={todoList === 'flagged'}
                      data-testid="sidebar-flagged"
                    >
                      <Flag className="w-4 h-4" />
                      <span>Flagged</span>
                      {flaggedCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {flaggedCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('list', 'assigned-to-me')}
                      isActive={todoList === 'assigned-to-me'}
                      data-testid="sidebar-assigned-to-me"
                    >
                      <User className="w-4 h-4" />
                      <span>Assigned to Me</span>
                      {assignedToMeCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {assignedToMeCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('list', 'all')}
                      isActive={todoList === 'all'}
                      data-testid="sidebar-all"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>All</span>
                      {allCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {allCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => updateQueryParam('list', 'completed')}
                      isActive={todoList === 'completed'}
                      data-testid="sidebar-completed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Completed</span>
                      {completedCount > 0 && (
                        <Badge variant="secondary" className="ml-auto">
                          {completedCount}
                        </Badge>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
          </>
        )}

        {/* Always visible: Navigation menu */}
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
