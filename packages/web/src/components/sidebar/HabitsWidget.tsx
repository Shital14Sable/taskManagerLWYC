import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Repeat, ChevronDown, ChevronUp, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useApp } from '@/context/AppContext';
import { useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

interface HabitsWidgetProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface DayHabitData {
  date: string;
  dayName: string;
  completed: number;
  total: number;
  percentage: number;
}

interface HabitDetail {
  id: string;
  title: string;
  streak: number;
  weekCompletion: boolean[];  // [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
  weekScheduled: boolean[];   // [Mon, Tue, Wed, Thu, Fri, Sat, Sun] - whether habit is scheduled for each day
}

// Empty arrays to avoid creating new references on every render
const EMPTY_WEEK_DATA: DayHabitData[] = [];
const EMPTY_HABIT_DETAILS: HabitDetail[] = [];

// Day name mapping for checking habit recurrence
const DAY_NAMES_LOWERCASE = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Check if a habit is scheduled for a specific date based on its recurrence settings
 */
function isHabitScheduledForDate(habit: { recurrence?: { frequency?: string; days_of_week?: string[]; end_date?: string }; is_paused?: boolean }, date: Date): boolean {
  // Paused habits don't count
  if (habit.is_paused) return false;

  // No recurrence means not scheduled
  if (!habit.recurrence || !habit.recurrence.frequency) return false;

  // Check end date
  if (habit.recurrence.end_date) {
    const endDate = new Date(habit.recurrence.end_date);
    if (date > endDate) return false;
  }

  const dayName = DAY_NAMES_LOWERCASE[date.getDay()];

  if (habit.recurrence.frequency === 'daily') {
    return true;
  } else if (habit.recurrence.frequency === 'weekly') {
    const scheduledDays = habit.recurrence.days_of_week || [];
    return scheduledDays.map(d => d.toLowerCase()).includes(dayName);
  }

  return false;
}

export function HabitsWidget({ isCollapsed, onToggleCollapse }: HabitsWidgetProps) {
  const { getHabitInstancesByHabit, getHabitInstances } = useApp();
  const { habits } = useTasks();
  const [weekData, setWeekData] = useState<DayHabitData[]>(EMPTY_WEEK_DATA);
  const [habitDetails, setHabitDetails] = useState<HabitDetail[]>(EMPTY_HABIT_DETAILS);
  const [showDetails, setShowDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const loadedHabitIdsRef = useRef<string>('');
  const loadingRef = useRef(false);

  // Store callbacks in refs to prevent infinite loops
  const getHabitInstancesRef = useRef(getHabitInstances);
  const getHabitInstancesByHabitRef = useRef(getHabitInstancesByHabit);

  useEffect(() => {
    getHabitInstancesRef.current = getHabitInstances;
    getHabitInstancesByHabitRef.current = getHabitInstancesByHabit;
  }, [getHabitInstances, getHabitInstancesByHabit]);

  const activeHabits = useMemo(() => {
    return habits.filter(h => !h.is_paused);
  }, [habits]);

  // Periodically refresh to pick up habit completions
  useEffect(() => {
    if (isCollapsed || activeHabits.length === 0) return;

    const interval = setInterval(() => {
      // Force refresh by incrementing counter and clearing loaded ref
      loadedHabitIdsRef.current = '';
      setRefreshCounter(c => c + 1);
    }, 15000); // Refresh every 15 seconds

    return () => clearInterval(interval);
  }, [isCollapsed, activeHabits.length]);

  // Calculate week data and habit details - only load once per habit list change
  useEffect(() => {
    if (activeHabits.length === 0) {
      // Use functional updates to avoid dependency on current state
      setWeekData(prev => prev.length > 0 ? EMPTY_WEEK_DATA : prev);
      setHabitDetails(prev => prev.length > 0 ? EMPTY_HABIT_DETAILS : prev);
      loadedHabitIdsRef.current = '';
      loadingRef.current = false;
      return;
    }

    // Prevent duplicate loads - only reload when habit list actually changes
    const habitIds = activeHabits.map(h => h.id).sort().join(',');

    if (loadedHabitIdsRef.current === habitIds) {
      return;
    }

    // Prevent concurrent loads
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    loadedHabitIdsRef.current = habitIds;

    async function loadWeekData() {
      const today = new Date();
      const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
      const days: DayHabitData[] = [];

      // Get Monday of current week
      const monday = new Date(today);
      const dayOfWeek = today.getDay();
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const instances = await getHabitInstancesRef.current(dateStr);
        const completed = instances.length;
        // Count only habits that are actually scheduled for this specific day
        const total = activeHabits.filter(h => isHabitScheduledForDate(h, date)).length;

        days.push({
          date: dateStr,
          dayName: dayNames[date.getDay()],
          completed,
          total,
          percentage: total > 0 ? (completed / total) * 100 : 0,
        });
      }

      setWeekData(days);
    }

    async function loadHabitDetails() {
      const today = new Date();
      const monday = new Date(today);
      const dayOfWeek = today.getDay();
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

      const startDate = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
      const endDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const details: HabitDetail[] = [];

      for (const habit of activeHabits) {
        const instances = await getHabitInstancesByHabitRef.current(habit.id, startDate, endDate);
        const completedDates = new Set(instances.map(i => i.date));

        // Calculate streak - only check days within the loaded date range
        let streak = 0;
        let daysChecked = 0;
        const checkDate = new Date(today);
        while (daysChecked < 365) {
          const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
          daysChecked++;

          if (completedDates.has(dateStr)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else if (streak === 0 && daysChecked <= 1) {
            // Allow only today to not be completed yet (give 1 day grace)
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        // Build week completion and scheduled arrays [Mon to Sun]
        const weekCompletion: boolean[] = [];
        const weekScheduled: boolean[] = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + i);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          weekCompletion.push(completedDates.has(dateStr));
          weekScheduled.push(isHabitScheduledForDate(habit, date));
        }

        details.push({
          id: habit.id,
          title: habit.title,
          streak,
          weekCompletion,
          weekScheduled,
        });
      }

      // Sort by streak descending
      details.sort((a, b) => b.streak - a.streak);
      setHabitDetails(details);
    }

    // Load both in parallel and reset loading flag when done
    Promise.all([loadWeekData(), loadHabitDetails()])
      .catch(error => {
        console.error('Failed to load habit data:', error);
      })
      .finally(() => {
        loadingRef.current = false;
      });
  }, [activeHabits, refreshCounter]);

  // Calculate totals
  const weekTotals = useMemo(() => {
    const completed = weekData.reduce((sum, d) => sum + d.completed, 0);
    const total = weekData.reduce((sum, d) => sum + d.total, 0);
    return {
      completed,
      total,
      percentage: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [weekData]);

  // Find longest streak
  const longestStreak = useMemo(() => {
    if (habitDetails.length === 0) return null;
    return habitDetails[0]; // Already sorted by streak
  }, [habitDetails]);

  // Check if today's date is in the week
  const todayIndex = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0 format
  }, []);

  return (
    <Card className="bg-card/50">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Habits
            {activeHabits.length > 0 && (
              <span className="text-xs text-muted-foreground">({activeHabits.length})</span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggleCollapse}>
            {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="py-2 px-3">
          {activeHabits.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No active habits</p>
          ) : (
            <div className="space-y-3">
              {/* Daily progress bars */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  {weekData.map((day, i) => (
                    <span key={day.date} className={cn("w-8 text-center", i === todayIndex && "font-bold text-primary")}>
                      {day.dayName}
                    </span>
                  ))}
                </div>
                <div className="flex justify-between gap-1">
                  {weekData.map((day, i) => (
                    <div key={day.date} className="flex-1">
                      <div className={cn(
                        "h-8 rounded overflow-hidden bg-accent/30 flex flex-col-reverse",
                        i === todayIndex && "ring-1 ring-primary"
                      )}>
                        <div
                          className="bg-green-500/70 transition-all"
                          style={{ height: `${day.percentage}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-center text-muted-foreground mt-0.5">
                        {day.completed}/{day.total}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Week total */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Week</span>
                  <span className="font-medium">{Math.round(weekTotals.percentage)}%</span>
                </div>
                <Progress value={weekTotals.percentage} className="h-1.5" />
              </div>

              {/* Longest streak */}
              {longestStreak && longestStreak.streak > 0 && (
                <div className="flex items-center gap-1 text-xs">
                  <Flame className="h-3 w-3 text-orange-500" />
                  <span className="text-muted-foreground">Longest:</span>
                  <span className="font-medium">{longestStreak.title}</span>
                  <span className="text-orange-500">({longestStreak.streak}d)</span>
                </div>
              )}

              {/* Toggle details */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
              >
                {showDetails ? '▾ Hide details' : '▸ Show details'}
              </button>

              {/* Detailed habit list */}
              {showDetails && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  {habitDetails.slice(0, 5).map(habit => (
                    <div key={habit.id} className="flex items-center gap-2">
                      <span className="text-xs truncate flex-1">{habit.title}</span>
                      {habit.streak > 0 && (
                        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5" />
                          {habit.streak}
                        </span>
                      )}
                      <div className="flex gap-0.5">
                        {habit.weekCompletion.map((done, i) => {
                          const isScheduled = habit.weekScheduled[i];
                          const isFuture = i > todayIndex;
                          // Gray: future days OR not scheduled for this day
                          // Green: scheduled AND completed
                          // Red: scheduled AND not completed (past/today only)
                          return (
                            <span
                              key={i}
                              className={cn(
                                "w-2 h-2 rounded-sm",
                                (isFuture || !isScheduled) ? "bg-muted" : done ? "bg-green-500" : "bg-red-500/50"
                              )}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {habitDetails.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{habitDetails.length - 5} more habits
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
