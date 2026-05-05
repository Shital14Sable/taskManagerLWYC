import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function MiniCalendar({ selectedDate, onDateSelect, isCollapsed, onToggleCollapse }: MiniCalendarProps) {
  const { schedules, tasks } = useApp();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  // Get the first day of the month and total days
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Calculate busy days (days with scheduled tasks)
  const busyDays = useMemo(() => {
    const busy = new Set<number>();
    const deadlines = new Set<number>();

    // Check schedules
    for (const [dateStr, schedule] of schedules) {
      const schedDate = new Date(dateStr);
      if (schedDate.getFullYear() === year && schedDate.getMonth() === month) {
        if (schedule.scheduled_tasks.length > 0) {
          busy.add(schedDate.getDate());
        }
      }
    }

    // Check tasks with deadlines
    for (const task of tasks) {
      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        if (deadlineDate.getFullYear() === year && deadlineDate.getMonth() === month) {
          if (task.status !== 'completed') {
            deadlines.add(deadlineDate.getDate());
          }
        }
      }
    }

    return { busy, deadlines };
  }, [schedules, tasks, year, month]);

  const goToPrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(year, month, day);
    onDateSelect(newDate);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getFullYear() === year &&
      today.getMonth() === month &&
      today.getDate() === day;
  };

  const isSelected = (day: number) => {
    return selectedDate.getFullYear() === year &&
      selectedDate.getMonth() === month &&
      selectedDate.getDate() === day;
  };

  // Generate calendar grid
  const calendarDays = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(day);
  }

  return (
    <Card className="bg-card/50">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {monthNames[month]} {year}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={goToPrevMonth}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={goToNextMonth}>
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1" onClick={onToggleCollapse}>
              {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="py-2 px-3">
          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(day => (
              <div key={day} className="text-center text-[10px] text-muted-foreground font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => (
              <div key={index} className="aspect-square">
                {day && (
                  <button
                    onClick={() => handleDateClick(day)}
                    className={cn(
                      "w-full h-full flex flex-col items-center justify-center rounded text-xs transition-colors relative",
                      isSelected(day) && "bg-primary text-primary-foreground",
                      isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground font-bold",
                      !isSelected(day) && !isToday(day) && "hover:bg-accent/50",
                      busyDays.busy.has(day) && !isSelected(day) && "font-medium"
                    )}
                  >
                    {day}
                    {/* Indicators */}
                    <div className="absolute bottom-0.5 flex gap-0.5">
                      {busyDays.busy.has(day) && !isSelected(day) && (
                        <span className="w-1 h-1 rounded-full bg-blue-500" />
                      )}
                      {busyDays.deadlines.has(day) && !isSelected(day) && (
                        <span className="w-1 h-1 rounded-full bg-red-500" />
                      )}
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Deadline
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
