import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Clock, Star, FolderOpen, ArrowUpAZ, ArrowDownAZ, Camera, Activity, Calendar, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ViewFilter = 'all' | 'recent' | 'favorites';
type SortOption = 'name-asc' | 'name-desc' | 'photos' | 'last-activity' | 'created';

interface ProjectsSidebarProps {
  currentView: ViewFilter;
  onViewChange: (view: ViewFilter) => void;
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
  showCompleted: boolean;
  onShowCompletedChange: (show: boolean) => void;
  
  // Counts for badges
  totalProjects: number;
  recentCount: number;
  favoritesCount: number;
}

export function ProjectsSidebar({
  currentView,
  onViewChange,
  currentSort,
  onSortChange,
  showCompleted,
  onShowCompletedChange,
  totalProjects,
  recentCount,
  favoritesCount,
}: ProjectsSidebarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Smart Views */}
        <SidebarGroup>
          <SidebarGroupLabel>Smart Views</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onViewChange('all')}
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
                onClick={() => onViewChange('recent')}
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
                onClick={() => onViewChange('favorites')}
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
        </SidebarGroup>

        <SidebarSeparator />

        {/* Sort Options */}
        <SidebarGroup>
          <SidebarGroupLabel>Sort By</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSortChange('name-asc')}
                isActive={currentSort === 'name-asc'}
                data-testid="sort-name-asc"
              >
                <ArrowUpAZ className="w-4 h-4" />
                <span>Name (A-Z)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSortChange('name-desc')}
                isActive={currentSort === 'name-desc'}
                data-testid="sort-name-desc"
              >
                <ArrowDownAZ className="w-4 h-4" />
                <span>Name (Z-A)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSortChange('photos')}
                isActive={currentSort === 'photos'}
                data-testid="sort-most-photos"
              >
                <Camera className="w-4 h-4" />
                <span>Most Photos</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSortChange('last-activity')}
                isActive={currentSort === 'last-activity'}
                data-testid="sort-last-activity"
              >
                <Activity className="w-4 h-4" />
                <span>Last Activity</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onSortChange('created')}
                isActive={currentSort === 'created'}
                data-testid="sort-date-created"
              >
                <Calendar className="w-4 h-4" />
                <span>Date Created</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Options */}
        <SidebarGroup>
          <SidebarGroupLabel>Options</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onShowCompletedChange(!showCompleted)}
                isActive={showCompleted}
                data-testid="toggle-show-completed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Show Completed</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
