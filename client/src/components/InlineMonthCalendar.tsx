import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from "date-fns";
import { haptics } from "@/lib/nativeHaptics";

interface InlineMonthCalendarProps {
  selectedDate?: Date;
  taskCountByDate: Map<string, number>;
  onSelectDay: (date: Date | undefined) => void;
}

export function InlineMonthCalendar({
  selectedDate,
  taskCountByDate,
  onSelectDay,
}: InlineMonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());

  // Sync currentMonth when selectedDate changes externally
  useEffect(() => {
    if (selectedDate) {
      // Navigate to the selected date's month if it's different
      if (!isSameMonth(currentMonth, selectedDate)) {
        setCurrentMonth(selectedDate);
      }
    }
  }, [selectedDate]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePreviousMonth = () => {
    haptics.light();
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    haptics.light();
    setCurrentMonth(addMonths(currentMonth, 1));
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

  return (
    <div className="bg-card rounded-xl border p-3 mb-4" data-testid="inline-month-calendar">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousMonth}
          className="h-8 w-8"
          data-testid="button-month-prev"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" data-testid="text-month-year">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          {!isSameMonth(currentMonth, new Date()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                haptics.light();
                setCurrentMonth(new Date());
              }}
              className="h-6 text-xs px-2"
              data-testid="button-month-today"
            >
              Today
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-8 w-8"
          data-testid="button-month-next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
          <div
            key={`${day}-${idx}`}
            className="text-center text-[10px] font-medium text-muted-foreground py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day) => {
          const taskCount = getTaskCount(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isTodayDate = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={`
                relative aspect-square rounded-lg
                flex flex-col items-center justify-center
                transition-all duration-150
                ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'}
                ${isSelected ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted/50 active:bg-muted'}
                ${isTodayDate && !isSelected ? 'ring-1.5 ring-primary ring-inset font-semibold' : ''}
              `}
              data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
            >
              <span className={`text-xs leading-none ${isTodayDate ? 'font-semibold' : ''}`}>
                {format(day, 'd')}
              </span>
              {taskCount > 0 && isCurrentMonth && (
                <div 
                  className={`absolute bottom-0.5 flex items-center justify-center ${
                    isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-[8px] font-medium">{taskCount > 9 ? '9+' : taskCount}</span>
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
            data-testid="button-clear-date"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
