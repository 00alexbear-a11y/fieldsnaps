import { Calendar, Clock, Filter, SortAsc, User, Tag as TagIcon, Camera as CameraIcon, FolderOpen } from "lucide-react";
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

interface ProjectOption {
  id: string;
  name: string;
  photoCount: number;
}

interface UploaderOption {
  id: string;
  name: string;
  count: number;
}

interface SessionOption {
  id: string;
  label: string;
  count: number;
}

interface PhotosSidebarProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  photoCount: number;
  projects: ProjectOption[];
  currentProjectId: string | null;
  onProjectChange: (projectId: string) => void;
  uploaders: UploaderOption[];
  selectedUploaderId: string | null;
  onUploaderChange: (uploaderId: string | null) => void;
  sessions: SessionOption[];
  selectedSessionId: string | null;
  onSessionChange: (sessionId: string | null) => void;
}

export function PhotosSidebar({
  dateFilter,
  onDateFilterChange,
  sortOption,
  onSortChange,
  photoCount,
  projects,
  currentProjectId,
  onProjectChange,
  uploaders,
  selectedUploaderId,
  onUploaderChange,
  sessions,
  selectedSessionId,
  onSessionChange,
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
        {/* Projects */}
        {projects.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Projects</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {projects.map((project) => (
                  <SidebarMenuItem key={project.id}>
                    <SidebarMenuButton
                      onClick={() => onProjectChange(project.id)}
                      isActive={currentProjectId === project.id}
                      data-testid={`filter-project-${project.id}`}
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>{project.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {project.photoCount}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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

        {/* Filter by Uploader */}
        {uploaders.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Filter by Uploader</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onUploaderChange(null)}
                    isActive={selectedUploaderId === null}
                    data-testid="filter-uploader-all"
                  >
                    <User className="w-4 h-4" />
                    <span>All Uploaders</span>
                    <Badge variant="secondary" className="ml-auto">
                      {photoCount}
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {uploaders.map((uploader) => (
                  <SidebarMenuItem key={uploader.id}>
                    <SidebarMenuButton
                      onClick={() => onUploaderChange(uploader.id)}
                      isActive={selectedUploaderId === uploader.id}
                      data-testid={`filter-uploader-${uploader.id}`}
                    >
                      <User className="w-4 h-4" />
                      <span>{uploader.name}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {uploader.count}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Filter by Session */}
        {sessions.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Filter by Session</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onSessionChange(null)}
                    isActive={selectedSessionId === null}
                    data-testid="filter-session-all"
                  >
                    <CameraIcon className="w-4 h-4" />
                    <span>All Sessions</span>
                    <Badge variant="secondary" className="ml-auto">
                      {photoCount}
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {sessions.map((session) => (
                  <SidebarMenuItem key={session.id}>
                    <SidebarMenuButton
                      onClick={() => onSessionChange(session.id)}
                      isActive={selectedSessionId === session.id}
                      data-testid={`filter-session-${session.id}`}
                    >
                      <CameraIcon className="w-4 h-4" />
                      <span>{session.label}</span>
                      <Badge variant="secondary" className="ml-auto">
                        {session.count}
                      </Badge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
