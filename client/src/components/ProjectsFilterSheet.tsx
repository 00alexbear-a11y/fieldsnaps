import { useState, useEffect } from 'react';
import { FolderOpen, Clock, Star, ArrowUpAZ, ArrowDownAZ, Camera, Calendar, CheckCircle2, Activity as ActivityIcon, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { haptics } from '@/lib/nativeHaptics';

type ViewFilter = 'all' | 'recent' | 'favorites';
type SortOption = 'name-asc' | 'name-desc' | 'photos' | 'last-activity' | 'created';

interface ProjectsFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectsFilterSheet({ open, onOpenChange }: ProjectsFilterSheetProps) {
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      currentView: (params.get('view') || 'all') as ViewFilter,
      currentSort: (params.get('sort') || 'last-activity') as SortOption,
      showCompleted: params.get('completed') === 'true',
    };
  };

  const [urlState, setUrlState] = useState(getUrlParams());
  const { currentView, currentSort, showCompleted } = urlState;

  useEffect(() => {
    if (open) {
      setUrlState(getUrlParams());
    }
  }, [open]);

  const { data: projects } = useQuery({
    queryKey: ['/api/projects'],
  });

  const totalProjects = Array.isArray(projects) ? projects.length : 0;
  const recentCount = Array.isArray(projects) ? projects.filter((p: any) => p.isRecent).length : 0;
  const favoritesCount = Array.isArray(projects) ? projects.filter((p: any) => p.isFavorite).length : 0;

  const updateQueryParam = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
    window.dispatchEvent(new CustomEvent('filterChange'));
    setUrlState(getUrlParams());
    haptics.light();
    onOpenChange(false);
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
    setUrlState(getUrlParams());
    haptics.light();
    onOpenChange(false);
  };

  const smartViews = [
    { id: 'all' as ViewFilter, label: 'All Projects', icon: FolderOpen, count: totalProjects },
    { id: 'recent' as ViewFilter, label: 'Recent', icon: Clock, count: recentCount },
    { id: 'favorites' as ViewFilter, label: 'Favorites', icon: Star, count: favoritesCount },
  ];

  const sortOptions = [
    { id: 'name-asc' as SortOption, label: 'Name (A-Z)', icon: ArrowUpAZ },
    { id: 'name-desc' as SortOption, label: 'Name (Z-A)', icon: ArrowDownAZ },
    { id: 'photos' as SortOption, label: 'Most Photos', icon: Camera },
    { id: 'last-activity' as SortOption, label: 'Last Activity', icon: ActivityIcon },
    { id: 'created' as SortOption, label: 'Date Created', icon: Calendar },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Filter & Sort</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Smart Views
            </h3>
            <div className="space-y-1">
              {smartViews.map((view) => (
                <button
                  key={view.id}
                  onClick={() => updateQueryParam('view', view.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    currentView === view.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 active:bg-muted'
                  }`}
                  data-testid={`filter-view-${view.id}`}
                >
                  <view.icon className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">{view.label}</span>
                  {view.count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {view.count}
                    </Badge>
                  )}
                  {currentView === view.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Sort By
            </h3>
            <div className="space-y-1">
              {sortOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => updateQueryParam('sort', option.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    currentSort === option.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 active:bg-muted'
                  }`}
                  data-testid={`filter-sort-${option.id}`}
                >
                  <option.icon className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">{option.label}</span>
                  {currentSort === option.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Options
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => toggleQueryParam('completed', showCompleted)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  showCompleted
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50 active:bg-muted'
                }`}
                data-testid="filter-show-completed"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span className="flex-1 text-left font-medium">Show Completed</span>
                {showCompleted && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
