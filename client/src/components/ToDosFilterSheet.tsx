import { useState, useEffect } from 'react';
import { CalendarDays, Flag, User, ListTodo, CheckCircle2, Check, Clock } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { haptics } from '@/lib/nativeHaptics';
import { useAuth } from '@/hooks/useAuth';

type SmartList = 'today' | 'flagged' | 'assigned-to-me' | 'all' | 'completed';

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
    };
  };

  const [urlState, setUrlState] = useState(getUrlParams());
  const { currentList } = urlState;

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

  const smartLists = [
    { id: 'today' as SmartList, label: 'Today', icon: CalendarDays, count: counts.today },
    { id: 'flagged' as SmartList, label: 'Flagged', icon: Flag, count: counts.flagged },
    { id: 'assigned-to-me' as SmartList, label: 'Assigned to Me', icon: User, count: counts.assignedToMe },
    { id: 'all' as SmartList, label: 'All Tasks', icon: ListTodo, count: counts.all },
    { id: 'completed' as SmartList, label: 'Completed', icon: CheckCircle2, count: counts.completed },
  ];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Filter Tasks</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-8 space-y-6 overflow-y-auto">
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
        </div>
      </DrawerContent>
    </Drawer>
  );
}
