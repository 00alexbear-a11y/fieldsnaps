import { Activity, Camera, FolderPlus, CheckSquare, Share2, Calendar, User } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

export type ActivityFilter = 'all' | 'photo_uploaded' | 'project_created' | 'todo_created' | 'share_created';
export type DateRangeFilter = 'all' | 'today' | 'this-week' | 'this-month';

interface ActivitySidebarProps {
  currentFilter: ActivityFilter;
  onFilterChange: (filter: ActivityFilter) => void;
  dateRange: DateRangeFilter;
  onDateRangeChange: (range: DateRangeFilter) => void;
  activityCount: number;
}

const activityTypes = [
  { id: 'all' as const, label: 'All Activity', icon: Activity },
  { id: 'photo_uploaded' as const, label: 'Photos', icon: Camera },
  { id: 'project_created' as const, label: 'Projects', icon: FolderPlus },
  { id: 'todo_created' as const, label: 'Tasks', icon: CheckSquare },
  { id: 'share_created' as const, label: 'Shares', icon: Share2 },
];

const dateRanges = [
  { id: 'all' as const, label: 'All Time', icon: Calendar },
  { id: 'today' as const, label: 'Today', icon: Calendar },
  { id: 'this-week' as const, label: 'This Week', icon: Calendar },
  { id: 'this-month' as const, label: 'This Month', icon: Calendar },
];

export function ActivitySidebar({
  currentFilter,
  onFilterChange,
  dateRange,
  onDateRangeChange,
  activityCount,
}: ActivitySidebarProps) {
  return (
    <Sidebar collapsible="icon" data-testid="activity-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-4">
          <Activity className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Team Activity</h2>
            <p className="text-xs text-muted-foreground">{activityCount} events</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Activity Types */}
        <SidebarGroup>
          <SidebarGroupLabel>Activity Type</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {activityTypes.map((type) => (
                <SidebarMenuItem key={type.id}>
                  <SidebarMenuButton
                    onClick={() => onFilterChange(type.id)}
                    isActive={currentFilter === type.id}
                    data-testid={`filter-${type.id}`}
                  >
                    <type.icon className="w-4 h-4" />
                    <span>{type.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Date Range */}
        <SidebarGroup>
          <SidebarGroupLabel>Time Period</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {dateRanges.map((range) => (
                <SidebarMenuItem key={range.id}>
                  <SidebarMenuButton
                    onClick={() => onDateRangeChange(range.id)}
                    isActive={dateRange === range.id}
                    data-testid={`date-range-${range.id}`}
                  >
                    <range.icon className="w-4 h-4" />
                    <span>{range.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
