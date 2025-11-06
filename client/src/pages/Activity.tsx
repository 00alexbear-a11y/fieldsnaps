import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, FolderPlus, CheckSquare, Share2, User, Activity as ActivityIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

type ActionFilter = 'all' | 'photo_uploaded' | 'project_created' | 'todo_created' | 'share_created';

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
  const [filter, setFilter] = useState<ActionFilter>('all');

  const { data: activities = [], isLoading, error } = useQuery<ActivityLog[]>({
    queryKey: ['/api/activity', filter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('action', filter);
      }
      const url = `/api/activity${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch activity');
      return response.json();
    },
  });

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto">
        <div className="sticky top-0 z-10 bg-white dark:bg-black border-b border-border">
          <div className="px-4 py-4">
            <h1 className="text-2xl font-semibold text-foreground mb-4" data-testid="heading-activity">
              Activity
            </h1>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as ActionFilter)}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="all" data-testid="filter-all">All</TabsTrigger>
                <TabsTrigger value="photo_uploaded" data-testid="filter-photos">Photos</TabsTrigger>
                <TabsTrigger value="project_created" data-testid="filter-projects">Projects</TabsTrigger>
                <TabsTrigger value="todo_created" data-testid="filter-todos">Tasks</TabsTrigger>
                <TabsTrigger value="share_created" data-testid="filter-shares">Shares</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="px-4 py-4">
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
            <Card className="divide-y divide-border">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
