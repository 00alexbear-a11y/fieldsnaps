import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday, isSameWeek } from "date-fns";
import { haptics } from "@/lib/nativeHaptics";

interface InlineWeekCalendarProps {
  selectedDate?: Date;
  taskCountByDate: Map<string, number>;
  onSelectDay: (date: Date | undefined) => void;
}

export function InlineWeekCalendar({
  selectedDate,
  taskCountByDate,
  onSelectDay,
}: InlineWeekCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(selectedDate || new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  // Sync currentWeek when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      if (!isSameWeek(currentWeek, selectedDate, { weekStartsOn: 0 })) {
        setCurrentWeek(selectedDate);
      }
    }
  }, [selectedDate]);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handlePreviousWeek = () => {
    haptics.light();
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const handleNextWeek = () => {
    haptics.light();
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const handleDayClick = (date: Date) => {
    haptics.light();
    if (selectedDate && isSameDay(date, selectedDate)) {
      onSelectDay(undefined);
    } else {
      onSelectDay(date);
    }
  };

  const getTaskCount = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return taskCountByDate.get(dateKey) || 0;
  };

  // Swipe gesture handling for week navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // Only consider horizontal swipes (prevent vertical scrolling interference)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwiping.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 50;

    if (deltaX > threshold) {
      handlePreviousWeek();
    } else if (deltaX < -threshold) {
      handleNextWeek();
    }
    
    isSwiping.current = false;
  };

  const isCurrentWeek = isSameWeek(currentWeek, new Date(), { weekStartsOn: 0 });

  return (
    <div 
      className="bg-card rounded-xl border p-3 mb-4" 
      data-testid="inline-week-calendar"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousWeek}
          className="h-8 w-8"
          data-testid="button-week-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" data-testid="text-week-range">
            {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </span>
          {!isCurrentWeek && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                haptics.light();
                setCurrentWeek(new Date());
              }}
              className="h-6 text-xs px-2"
              data-testid="button-week-today"
            >
              Today
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextWeek}
          className="h-8 w-8"
          data-testid="button-week-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Horizontal Day Strip */}
      <div className="flex gap-1 justify-between">
        {weekDays.map((day) => {
          const taskCount = getTaskCount(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`
                flex-1 flex flex-col items-center py-2 px-1 rounded-lg
                transition-all duration-150
                ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/50 active:bg-muted'}
                ${isTodayDate && !isSelected ? 'ring-1.5 ring-primary ring-inset' : ''}
              `}
              data-testid={`week-day-${format(day, 'yyyy-MM-dd')}`}
            >
              {/* Day abbreviation */}
              <span className={`text-[10px] uppercase font-medium mb-0.5 ${
                isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
              }`}>
                {format(day, 'EEE')}
              </span>
              {/* Day number */}
              <span className={`text-lg font-semibold leading-none ${
                isTodayDate && !isSelected ? 'text-primary' : ''
              }`}>
                {format(day, 'd')}
              </span>
              {/* Task count indicator */}
              {taskCount > 0 && (
                <div className={`mt-1 text-[10px] font-medium ${
                  isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                }`}>
                  {taskCount > 9 ? '9+' : taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Date Indicator */}
      {selectedDate && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-muted-foreground">
            Showing tasks for {format(selectedDate, 'EEEE, MMM d')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              haptics.light();
              onSelectDay(undefined);
            }}
            className="h-6 text-xs px-2"
            data-testid="button-clear-week-date"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
