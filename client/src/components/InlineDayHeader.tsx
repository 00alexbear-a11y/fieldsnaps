import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from "date-fns";
import { haptics } from "@/lib/nativeHaptics";

interface InlineDayHeaderProps {
  selectedDate: Date;
  taskCount: number;
  onSelectDay: (date: Date) => void;
  onOpenCalendar: () => void;
}

export function InlineDayHeader({
  selectedDate,
  taskCount,
  onSelectDay,
  onOpenCalendar,
}: InlineDayHeaderProps) {
  const handlePreviousDay = () => {
    haptics.light();
    onSelectDay(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    haptics.light();
    onSelectDay(addDays(selectedDate, 1));
  };

  const handleToday = () => {
    haptics.light();
    onSelectDay(new Date());
  };

  const getDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE');
  };

  const isTodayDate = isToday(selectedDate);

  return (
    <div className="bg-card rounded-xl border p-4 mb-4" data-testid="inline-day-header">
      {/* Day Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousDay}
          className="h-10 w-10"
          data-testid="button-day-prev"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold" data-testid="text-day-label">
              {getDateLabel(selectedDate)}
            </span>
            {!isTodayDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-6 text-xs px-2"
                data-testid="button-day-today"
              >
                Today
              </Button>
            )}
          </div>
          <span className="text-sm text-muted-foreground" data-testid="text-day-date">
            {format(selectedDate, 'MMMM d, yyyy')}
          </span>
          <span className="text-xs text-muted-foreground mt-1" data-testid="text-day-task-count">
            {taskCount === 0 ? 'No tasks' : `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}`}
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextDay}
          className="h-10 w-10"
          data-testid="button-day-next"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Calendar Quick Access */}
      <div className="flex justify-center mt-3 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            haptics.light();
            onOpenCalendar();
          }}
          className="gap-2"
          data-testid="button-day-open-calendar"
        >
          <Calendar className="h-4 w-4" />
          Pick a date
        </Button>
      </div>
    </div>
  );
}
