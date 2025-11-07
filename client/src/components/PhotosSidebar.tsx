import { Calendar, Clock, Filter, SortAsc, User, Tag as TagIcon, Camera as CameraIcon } from "lucide-react";
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

export type DateFilter = 'all' | 'today' | 'this-week' | 'this-month';
export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';

interface PhotosSidebarProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  photoCount: number;
}

export function PhotosSidebar({
  dateFilter,
  onDateFilterChange,
  sortOption,
  onSortChange,
  photoCount,
}: PhotosSidebarProps) {
  const smartViews = [
    { id: 'all', label: 'All Photos', icon: CameraIcon, filter: 'all' as DateFilter },
    { id: 'today', label: 'Today', icon: Clock, filter: 'today' as DateFilter },
    { id: 'this-week', label: 'This Week', icon: Calendar, filter: 'this-week' as DateFilter },
    { id: 'this-month', label: 'This Month', icon: Calendar, filter: 'this-month' as DateFilter },
  ];

  const sortOptions = [
    { id: 'date-desc', label: 'Newest First', icon: SortAsc },
    { id: 'date-asc', label: 'Oldest First', icon: SortAsc },
    { id: 'name-asc', label: 'Name (A-Z)', icon: SortAsc },
    { id: 'name-desc', label: 'Name (Z-A)', icon: SortAsc },
  ];

  return (
    <Sidebar collapsible="icon" data-testid="photos-sidebar">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-3 py-4">
          <CameraIcon className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold">Photos</h2>
            <p className="text-xs text-muted-foreground">{photoCount} total</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Smart Views */}
        <SidebarGroup>
          <SidebarGroupLabel>Smart Views</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {smartViews.map((view) => (
                <SidebarMenuItem key={view.id}>
                  <SidebarMenuButton
                    onClick={() => onDateFilterChange(view.filter)}
                    isActive={dateFilter === view.filter}
                    data-testid={`filter-view-${view.id}`}
                  >
                    <view.icon className="w-4 h-4" />
                    <span>{view.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sort Options */}
        <SidebarGroup>
          <SidebarGroupLabel>Sort By</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sortOptions.map((option) => (
                <SidebarMenuItem key={option.id}>
                  <SidebarMenuButton
                    onClick={() => onSortChange(option.id as SortOption)}
                    isActive={sortOption === option.id}
                    data-testid={`sort-${option.id}`}
                  >
                    <option.icon className="w-4 h-4" />
                    <span>{option.label}</span>
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
