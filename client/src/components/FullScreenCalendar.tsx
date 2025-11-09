import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday } from "date-fns";

interface FullScreenCalendarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate?: Date;
  taskCountByDate: Map<string, number>;
  onSelectDay: (date: Date) => void;
}

export function FullScreenCalendar({
  open,
  onOpenChange,
  selectedDate,
  taskCountByDate,
  onSelectDay,
}: FullScreenCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDayClick = (date: Date) => {
    onSelectDay(date);
    onOpenChange(false);
  };

  const getTaskCount = (date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return taskCountByDate.get(dateKey) || 0;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full bg-background">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold" data-testid="text-calendar-title">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-calendar"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePreviousMonth}
              data-testid="button-prev-month"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              data-testid="button-today"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              data-testid="button-next-month"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-auto p-4">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
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
                      relative aspect-square p-2 rounded-lg
                      hover-elevate active-elevate-2
                      flex flex-col items-center justify-center
                      transition-colors
                      ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}
                      ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                      ${isTodayDate && !isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                    `}
                    data-testid={`day-${format(day, 'yyyy-MM-dd')}`}
                  >
                    <span className={`text-sm ${isTodayDate && !isSelected ? 'font-bold' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {taskCount > 0 && (
                      <Badge
                        variant="secondary"
                        className="mt-1 text-xs px-1 py-0 h-4 min-w-[1.5rem] no-default-hover-elevate no-default-active-elevate"
                        data-testid={`badge-tasks-${format(day, 'yyyy-MM-dd')}`}
                      >
                        {taskCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          {selectedDate && (
            <div className="border-t p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Filtering: {format(selectedDate, 'MMM d, yyyy')}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSelectDay(undefined as any);
                    onOpenChange(false);
                  }}
                  data-testid="button-clear-filter"
                >
                  Clear Filter
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
