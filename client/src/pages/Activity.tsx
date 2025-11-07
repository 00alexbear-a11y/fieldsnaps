import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, FolderPlus, CheckSquare, Share2, User, Activity as ActivityIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { formatDistanceToNow, startOfToday, startOfWeek, startOfMonth } from "date-fns";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ActivitySidebar, ActivityFilter, DateRangeFilter } from "@/components/ActivitySidebar";

interface ActivityLog {
  id: string;
  userId: string;
  companyId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, any>;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}


const actionConfig = {
  photo_uploaded: {
    icon: Camera,
    color: 'text-sky-500',
    bgColor: 'bg-sky-50 dark:bg-sky-950',
    label: 'uploaded a photo',
  },
  project_created: {
    icon: FolderPlus,
    color: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-950',
    label: 'created a project',
  },
  todo_created: {
    icon: CheckSquare,
    color: 'text-orange-500',
    bgColor: 'bg-orange-50 dark:bg-orange-950',
    label: 'created a task',
  },
  share_created: {
    icon: Share2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    label: 'created a share link',
  },
  default: {
    icon: ActivityIcon,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    label: 'performed an action',
  },
};

function ActivityItem({ activity }: { activity: ActivityLog }) {
  const config = actionConfig[activity.action as keyof typeof actionConfig] || actionConfig.default;

  const Icon = config.icon;
  const userName = activity.user.firstName && activity.user.lastName
    ? `${activity.user.firstName} ${activity.user.lastName}`
    : activity.user.email;

  const getMetadataText = () => {
    switch (activity.action) {
      case 'photo_uploaded':
        return activity.metadata.projectName 
          ? `to ${activity.metadata.projectName}` 
          : '';
      case 'project_created':
        return activity.metadata.projectName || '';
      case 'todo_created':
        return activity.metadata.todoTitle 
          ? `"${activity.metadata.todoTitle}"${activity.metadata.assigneeName ? ` for ${activity.metadata.assigneeName}` : ''}`
          : '';
      case 'share_created':
        return activity.metadata.projectName
          ? `for ${activity.metadata.projectName}${activity.metadata.photoCount ? ` (${activity.metadata.photoCount} photos)` : ''}`
          : '';
      default:
        return '';
    }
  };

  return (
    <div className="flex gap-3 p-4" data-testid={`activity-${activity.id}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-medium" data-testid={`activity-user-${activity.id}`}>{userName}</span>{' '}
          <span className="text-muted-foreground">{config.label}</span>
          {getMetadataText() && (
            <span className="font-medium ml-1" data-testid={`activity-metadata-${activity.id}`}>
              {getMetadataText()}
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-1" data-testid={`activity-time-${activity.id}`}>
          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <User className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No activity yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Team activity will appear here as members upload photos, create projects, and assign tasks.
      </p>
    </div>
  );
}

export default function Activity() {
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');

  const { data: allActivities = [], isLoading, error } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity-logs', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('action', filter);
      }
      const url = `/api/activity-logs${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
  });

  // Client-side date filtering
  const activities = allActivities.filter((activity) => {
    if (dateRange === 'all') return true;
    
    const activityDate = new Date(activity.createdAt);
    const now = new Date();
    
    switch (dateRange) {
      case 'today':
        return activityDate >= startOfToday();
      case 'this-week':
        return activityDate >= startOfWeek(now, { weekStartsOn: 1 });
      case 'this-month':
        return activityDate >= startOfMonth(now);
      default:
        return true;
    }
  });

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <ActivitySidebar
          currentFilter={filter}
          onFilterChange={setFilter}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          activityCount={activities.length}
        />
        <SidebarInset className="flex flex-col">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center gap-2 px-4 py-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-2xl font-semibold text-foreground" data-testid="heading-activity">
                Team Activity
              </h1>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {error ? (
              <Alert variant="destructive" data-testid="error-activity">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to load activity. Please try again later.
                </AlertDescription>
              </Alert>
            ) : isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : activities.length === 0 ? (
              <EmptyState />
            ) : (
              <Card className="divide-y divide-border max-w-3xl mx-auto">
                {activities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </Card>
            )}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
