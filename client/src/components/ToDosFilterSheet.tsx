import { useState, useEffect } from 'react';
import { CalendarDays, Flag, User, ListTodo, CheckCircle2, Check, Calendar, CalendarRange, List, ArrowUpAZ, ArrowDownAZ, Clock, FolderOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { haptics } from '@/lib/nativeHaptics';
import { useAuth } from '@/hooks/useAuth';
import type { Project } from '@shared/schema';

type SmartList = 'today' | 'flagged' | 'assigned-to-me' | 'all' | 'completed';
type ViewMode = 'month' | 'week' | 'day';
type SortOption = 'due-date' | 'created' | 'name-asc' | 'name-desc' | 'priority';

interface ToDosFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: {
    today: number;
    flagged: number;
    assignedToMe: number;
    all: number;
    completed: number;
  };
}

export function ToDosFilterSheet({ open, onOpenChange, counts }: ToDosFilterSheetProps) {
  const { user } = useAuth();
  
  const getUrlParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      currentList: (params.get('list') || 'assigned-to-me') as SmartList,
      currentView: (params.get('view') || 'month') as ViewMode,
      currentSort: (params.get('sort') || 'due-date') as SortOption,
      currentProject: params.get('project') || 'all',
      showCompleted: params.get('showCompleted') === 'true',
    };
  };

  const [urlState, setUrlState] = useState(getUrlParams());
  const { currentList, currentView, currentSort, currentProject, showCompleted } = urlState;

  // Fetch projects for the project filter
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  useEffect(() => {
    if (open) {
      setUrlState(getUrlParams());
    }
  }, [open]);

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

  const smartLists = [
    { id: 'today' as SmartList, label: 'Today', icon: CalendarDays, count: counts.today },
    { id: 'flagged' as SmartList, label: 'Flagged', icon: Flag, count: counts.flagged },
    { id: 'assigned-to-me' as SmartList, label: 'Assigned to Me', icon: User, count: counts.assignedToMe },
    { id: 'all' as SmartList, label: 'All Tasks', icon: ListTodo, count: counts.all },
    { id: 'completed' as SmartList, label: 'Completed', icon: CheckCircle2, count: counts.completed },
  ];

  const viewModes = [
    { id: 'month' as ViewMode, label: 'Month', icon: Calendar },
    { id: 'week' as ViewMode, label: 'Week', icon: CalendarRange },
    { id: 'day' as ViewMode, label: 'Day', icon: List },
  ];

  const sortOptions = [
    { id: 'due-date' as SortOption, label: 'Due Date', icon: Clock },
    { id: 'created' as SortOption, label: 'Date Created', icon: Calendar },
    { id: 'name-asc' as SortOption, label: 'Name (A-Z)', icon: ArrowUpAZ },
    { id: 'name-desc' as SortOption, label: 'Name (Z-A)', icon: ArrowDownAZ },
    { id: 'priority' as SortOption, label: 'Priority', icon: Flag },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Filter & Sort</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-6 overflow-y-auto">
          {/* Smart Lists */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Smart Lists
            </h3>
            <div className="space-y-1">
              {smartLists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => updateQueryParam('list', list.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    currentList === list.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 active:bg-muted'
                  }`}
                  data-testid={`filter-list-${list.id}`}
                >
                  <list.icon className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium">{list.label}</span>
                  {list.count > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {list.count}
                    </Badge>
                  )}
                  {currentList === list.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Calendar View
            </h3>
            <div className="flex gap-2">
              {viewModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => updateQueryParam('view', mode.id)}
                  className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-lg transition-colors ${
                    currentView === mode.id
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'bg-muted/30 hover:bg-muted/50 active:bg-muted border border-transparent'
                  }`}
                  data-testid={`filter-view-${mode.id}`}
                >
                  <mode.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Project Filter */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Project
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              <button
                onClick={() => updateQueryParam('project', 'all')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  currentProject === 'all'
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50 active:bg-muted'
                }`}
                data-testid="filter-project-all"
              >
                <FolderOpen className="w-5 h-5" />
                <span className="flex-1 text-left font-medium">All Projects</span>
                {currentProject === 'all' && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => updateQueryParam('project', project.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    currentProject === project.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50 active:bg-muted'
                  }`}
                  data-testid={`filter-project-${project.id}`}
                >
                  <FolderOpen className="w-5 h-5" />
                  <span className="flex-1 text-left font-medium truncate">{project.name}</span>
                  {currentProject === project.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Options */}
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

          {/* Options */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Options
            </h3>
            <div className="space-y-1">
              <button
                onClick={() => toggleQueryParam('showCompleted', showCompleted)}
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
