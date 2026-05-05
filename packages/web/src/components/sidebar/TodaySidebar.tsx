import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMood } from '@/hooks/useMood';
import { MiniCalendar } from './MiniCalendar';
import { GoalsWidget } from './GoalsWidget';
import { DeadlinesWidget } from './DeadlinesWidget';
import { HabitsWidget } from './HabitsWidget';
import { WeeklyReviewWidget } from './WeeklyReviewWidget';
import { MoodCheckInWidget } from './MoodCheckInWidget';
import { cn } from '@/lib/utils';

interface TodaySidebarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  className?: string;
}

export function TodaySidebar({ selectedDate, onDateSelect, className }: TodaySidebarProps) {
  const { sidebarPreferences, toggleSidebar, toggleWidgetCollapsed, isWidgetCollapsed } = useMood();

  // Memoize toggle callbacks to prevent re-renders
  const toggleCalendar = useCallback(() => toggleWidgetCollapsed('calendar'), [toggleWidgetCollapsed]);
  const toggleGoals = useCallback(() => toggleWidgetCollapsed('goals'), [toggleWidgetCollapsed]);
  const toggleDeadlines = useCallback(() => toggleWidgetCollapsed('deadlines'), [toggleWidgetCollapsed]);
  const toggleHabits = useCallback(() => toggleWidgetCollapsed('habits'), [toggleWidgetCollapsed]);
  const toggleReview = useCallback(() => toggleWidgetCollapsed('review'), [toggleWidgetCollapsed]);
  const toggleMood = useCallback(() => toggleWidgetCollapsed('mood'), [toggleWidgetCollapsed]);

  if (!sidebarPreferences.visible) {
    // Collapsed state - show expand button
    return (
      <div className={cn("flex items-start pt-4", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0 hover:bg-accent"
          title="Expand sidebar"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("w-80 shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]", className)}>
      {/* Collapse button */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="h-8 w-8 p-0 hover:bg-accent"
          title="Collapse sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Mini Calendar */}
      <MiniCalendar
        selectedDate={selectedDate}
        onDateSelect={onDateSelect}
        isCollapsed={isWidgetCollapsed('calendar')}
        onToggleCollapse={toggleCalendar}
      />

      {/* Goals Widget */}
      <GoalsWidget
        isCollapsed={isWidgetCollapsed('goals')}
        onToggleCollapse={toggleGoals}
      />

      {/* Deadlines Widget */}
      <DeadlinesWidget
        isCollapsed={isWidgetCollapsed('deadlines')}
        onToggleCollapse={toggleDeadlines}
      />

      {/* Habits Widget */}
      <HabitsWidget
        isCollapsed={isWidgetCollapsed('habits')}
        onToggleCollapse={toggleHabits}
      />

      {/* Weekly Review Widget */}
      <WeeklyReviewWidget
        isCollapsed={isWidgetCollapsed('review')}
        onToggleCollapse={toggleReview}
      />

      {/* Mood Check-in Widget */}
      <MoodCheckInWidget
        isCollapsed={isWidgetCollapsed('mood')}
        onToggleCollapse={toggleMood}
      />
    </div>
  );
}
