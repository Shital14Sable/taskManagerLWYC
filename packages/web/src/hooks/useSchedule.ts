import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import type { Schedule } from '@trackmind/core';
import { Scheduler, createDefaultPreferences, createSchedule, toISODateString } from '@trackmind/core';
import type { OfficeHoursDay, OfficeHoursPreferences } from '@trackmind/core';
import { applyEffectiveEnergyToPrefs } from '@/utils/cycle';

/** Return the office hours that apply for a given date, or null if office is closed. */
function getOfficeHoursForDate(
  date: Date,
  officeHours: OfficeHoursPreferences,
): OfficeHoursDay | null {
  if (!officeHours.enabled) return null;

  const dateStr = toISODateString(date);

  // Date-specific override takes priority
  if (Object.prototype.hasOwnProperty.call(officeHours.date_overrides, dateStr)) {
    return officeHours.date_overrides[dateStr]; // may be null → office closed
  }

  // Fall back to the standard weekly schedule
  const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][date.getDay()];
  const dayConfig = officeHours.schedule[dayName];
  if (!dayConfig?.enabled) return null;
  return dayConfig;
}

export type UnscheduledReason =
  | 'paused'
  | 'project_paused'
  | 'too_short'
  | 'too_long'
  | 'dependencies_unmet'
  | 'no_available_slots'
  | 'habit_no_occurrence'
  | 'unknown';

export interface UnscheduledTaskInfo {
  taskId: string;
  reason: UnscheduledReason;
  details?: string;
}

export interface UpcomingScheduleData {
  schedules: Schedule[];
  task_schedule_map: Record<string, string>;
  unscheduled_task_ids: string[];
  unscheduled_reasons: Record<string, UnscheduledTaskInfo>;
  total_tasks: number;
  scheduled_count: number;
  unscheduled_count: number;
}

export function useSchedule(date?: string) {
  const { tasks, projects, schedules, loadSchedule, loadSchedules, saveSchedules, preferences } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get today's date or specified date
  const targetDate = useMemo(() => {
    return date ?? toISODateString(new Date());
  }, [date]);

  // Get the schedule for the target date
  const schedule = useMemo(() => {
    return schedules.get(targetDate) ?? null;
  }, [schedules, targetDate]);

  // Load schedule on mount or date change
  useEffect(() => {
    loadSchedule(targetDate);
  }, [targetDate, loadSchedule]);

  // Calculate upcoming data
  const upcomingData = useMemo((): UpcomingScheduleData => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 60);

    const scheduleList = Array.from(schedules.values())
      .filter(s => s.date >= toISODateString(today) && s.date <= toISODateString(endDate))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build a map of paused task IDs and tasks from paused projects
    // These should appear as unscheduled even if they're in old schedules
    // Include sub-projects whose parent is paused (inherited pause)
    const getEffectivelyPausedProjectIds = (): Set<string> => {
      const paused = new Set<string>();

      // First, add directly paused projects
      for (const p of projects) {
        if (p.status === 'paused') {
          paused.add(p.id);
        }
      }

      // Then, recursively add sub-projects of paused parents
      const addPausedChildren = (parentId: string) => {
        for (const p of projects) {
          if (p.parent_id === parentId && !paused.has(p.id)) {
            paused.add(p.id);
            addPausedChildren(p.id);
          }
        }
      };

      // Process all directly paused projects
      for (const id of Array.from(paused)) {
        addPausedChildren(id);
      }

      return paused;
    };

    const pausedProjectIds = getEffectivelyPausedProjectIds();
    const pausedOrBlockedTaskIds = new Set(
      tasks
        .filter(t => t.is_paused || pausedProjectIds.has(t.project_id))
        .map(t => t.id)
    );

    // Build task schedule map (excluding paused/blocked tasks)
    const taskScheduleMap: Record<string, string> = {};
    for (const sched of scheduleList) {
      for (const st of (sched.scheduled_tasks || [])) {
        if (!taskScheduleMap[st.task_id] && !pausedOrBlockedTaskIds.has(st.task_id)) {
          taskScheduleMap[st.task_id] = sched.date;
        }
      }
    }

    // Find unscheduled tasks and determine reasons
    const scheduledTaskIds = new Set(Object.keys(taskScheduleMap));
    const unscheduledTaskIds: string[] = [];
    const unscheduledReasons: Record<string, UnscheduledTaskInfo> = {};

    // Get scheduling settings
    const minDuration = preferences?.task_defaults?.min_duration ?? 15;
    const maxContinuous = preferences?.scheduling_preferences?.max_deep_work_stretch ?? 120;

    // Build dependency map
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    for (const task of tasks) {
      if (task.status === 'completed') continue;
      if (scheduledTaskIds.has(task.id)) continue;

      unscheduledTaskIds.push(task.id);

      // Determine the reason
      let reason: UnscheduledReason = 'unknown';
      let details: string | undefined;

      if (task.is_paused) {
        reason = 'paused';
        details = task.paused_until
          ? `Paused until ${new Date(task.paused_until).toLocaleDateString()}`
          : 'Task is paused';
      } else if (pausedProjectIds.has(task.project_id)) {
        reason = 'project_paused';
        const project = projects.find(p => p.id === task.project_id);
        details = project ? `Project "${project.name}" is paused` : 'Project is paused';
      } else if (!task.is_habit && task.estimated_minutes < minDuration) {
        // Only regular tasks are filtered by min_duration - habits can be short
        reason = 'too_short';
        details = `${task.estimated_minutes}min < ${minDuration}min min`;
      } else if (task.estimated_minutes > maxContinuous) {
        reason = 'too_long';
        details = `${task.estimated_minutes}min > ${maxContinuous}min max`;
      } else if (task.dependencies && task.dependencies.length > 0) {
        // Check if any dependency is not completed
        const unmetDeps = task.dependencies.filter(depId => {
          const dep = taskMap.get(depId);
          return dep && dep.status !== 'completed';
        });
        if (unmetDeps.length > 0) {
          reason = 'dependencies_unmet';
          const depNames = unmetDeps
            .map(id => taskMap.get(id)?.title)
            .filter(Boolean)
            .slice(0, 2);
          details = depNames.length > 0
            ? `Waiting for: ${depNames.join(', ')}${unmetDeps.length > 2 ? ` +${unmetDeps.length - 2} more` : ''}`
            : `${unmetDeps.length} unmet dependencies`;
        }
      } else if (task.is_habit) {
        // Habits might not occur on scheduled days
        reason = 'habit_no_occurrence';
        details = 'No occurrence in scheduled period';
      } else {
        reason = 'no_available_slots';
        details = 'No available time slots fit this task';
      }

      unscheduledReasons[task.id] = { taskId: task.id, reason, details };
    }

    // Count all non-completed tasks
    const activeTaskCount = tasks.filter(t =>
      t.status !== 'completed'
    ).length;

    return {
      schedules: scheduleList,
      task_schedule_map: taskScheduleMap,
      unscheduled_task_ids: unscheduledTaskIds,
      unscheduled_reasons: unscheduledReasons,
      total_tasks: activeTaskCount,
      scheduled_count: scheduledTaskIds.size,
      unscheduled_count: unscheduledTaskIds.length,
    };
  }, [schedules, tasks, projects, preferences]);

  // Reschedule function
  const reschedule = useCallback(async (options?: { reschedule_all?: boolean; days?: number }) => {
    try {
      setLoading(true);
      setError(null);

      const prefs = preferences ?? createDefaultPreferences();
      // When cycle tracking is enabled, override energy_patterns with the current cycle phase energy
      const effectivePrefs = applyEffectiveEnergyToPrefs(prefs, new Date());
      const scheduler = new Scheduler({ preferences: effectivePrefs });

      // Get effectively paused project IDs (including sub-projects of paused parents)
      const getEffectivelyPausedProjectIds = (): Set<string> => {
        const paused = new Set<string>();

        // First, add directly paused projects
        for (const p of projects) {
          if (p.status === 'paused') {
            paused.add(p.id);
          }
        }

        // Then, recursively add sub-projects of paused parents
        const addPausedChildren = (parentId: string) => {
          for (const p of projects) {
            if (p.parent_id === parentId && !paused.has(p.id)) {
              paused.add(p.id);
              addPausedChildren(p.id);
            }
          }
        };

        // Process all directly paused projects
        for (const id of Array.from(paused)) {
          addPausedChildren(id);
        }

        return paused;
      };

      const pausedProjectIds = getEffectivelyPausedProjectIds();

      // Get active tasks - filter out tasks from paused projects (including inherited pause)
      const activeTasks = tasks.filter(t =>
        t.status !== 'completed' &&
        !t.is_paused &&
        !t.parent_task_id &&
        !pausedProjectIds.has(t.project_id)  // Exclude tasks from paused projects
      );

      // Get active projects
      const activeProjectsList = projects.filter(p => p.status === 'active');

      // Calculate days dynamically:
      // - Base estimate from task count
      // - Extended to cover the furthest scheduled_for date (set by cycle distribution)
      //   so tasks assigned to day 20 or 60 aren't silently dropped.
      // - Extended to cover the furthest task or project deadline, so the schedule
      //   horizon always reaches anything you've actually committed a date to —
      //   even when there are too few tasks for the count-based estimate to reach it.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nonHabitTasks = activeTasks.filter(t => !t.is_habit);
      const estimatedDaysNeeded = Math.ceil(nonHabitTasks.length / 6);

      const daysUntil = (dateStr: string): number => {
        const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
        d.setHours(0, 0, 0, 0);
        return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      };

      const furthestScheduledForDays = activeTasks.reduce((max, t) => {
        if (!t.scheduled_for || (t.is_pinned && t.pin_type === 'hard')) return max;
        return Math.max(max, daysUntil(t.scheduled_for));
      }, 0);

      const furthestTaskDeadlineDays = activeTasks.reduce((max, t) => {
        if (!t.deadline) return max;
        return Math.max(max, daysUntil(t.deadline));
      }, 0);

      const furthestProjectDeadlineDays = projects.reduce((max, p) => {
        if (!p.deadline || p.status !== 'active') return max;
        return Math.max(max, daysUntil(p.deadline));
      }, 0);

      // Habits recur on a weekly/biweekly cadence. If the horizon is shorter than
      // 14 days, a habit whose day-of-week falls late in the window (e.g. a weekly
      // Friday habit when today is Monday) may never be evaluated at all, even
      // though its recurrence is configured correctly. Enforce a floor of 14 days
      // whenever any active habit has a weekly or biweekly recurrence, so every
      // such habit gets at least one full cycle to occur within the horizon.
      const hasWeeklyOrBiweeklyHabit = activeTasks.some(
        t => t.is_habit && (t.recurrence?.frequency === 'weekly' || t.recurrence?.frequency === 'biweekly')
      );
      const habitFloorDays = hasWeeklyOrBiweeklyHabit ? 14 : 0;

      const days = options?.days ?? Math.min(
        180,
        Math.max(
          estimatedDaysNeeded + 3,
          furthestScheduledForDays + 1,
          furthestTaskDeadlineDays + 1,
          furthestProjectDeadlineDays + 1,
          habitFloorDays,
        )
      );

      // Generate schedules for each day, tracking which tasks are already scheduled
      const newSchedules: Schedule[] = [];
      const startDate = new Date();
      const previouslyScheduledIds = new Set<string>();

      for (let i = 0; i < days; i++) {
        const scheduleDate = new Date(startDate);
        scheduleDate.setDate(scheduleDate.getDate() + i);
        const targetDate = toISODateString(scheduleDate);

        // Always pass the existing schedule to preserve completed_tasks,
        // even when reschedule_all is true. The 'force' flag controls regeneration,
        // not whether to preserve completion status.
        const existingSchedule = schedules.get(targetDate) || null;

        // Only surface tasks that have no date hint, or whose scheduled_for date
        // has arrived. This lets distributeCycleTasks() spread tasks across future
        // days by setting scheduled_for — each task becomes visible to the scheduler
        // only on the day it was assigned to.
        const baseTasksForDate = activeTasks.filter(t => {
          if (!t.scheduled_for) return true;
          // Hard-pinned tasks carry a full datetime; the scheduler handles them directly
          if (t.is_pinned && t.pin_type === 'hard') return true;
          // Soft date hints: only expose on/after the assigned date
          return t.scheduled_for.split('T')[0] <= targetDate;
        });

        // Apply office-hours and additional-project-hours constraints.
        // Tasks from designated projects get time_window_start/end set so the scheduler
        // only places them within their configured window. They are withheld on closed days.
        const officeHours = effectivePrefs.office_hours;
        const officeProjectId = officeHours?.project_id ?? null;
        const officeWindowForDay = officeProjectId && officeHours
          ? getOfficeHoursForDate(scheduleDate, officeHours)
          : null;

        // Additional projects hours apply to ALL tasks that are NOT from the office project.
        const additionalHours = effectivePrefs.additional_projects_hours;
        const additionalWindowForDay =
          additionalHours?.enabled ? getOfficeHoursForDate(scheduleDate, additionalHours) : null;

        const tasksForDate = baseTasksForDate
          .filter(t => {
            // Fixed-time tasks (hard-pinned) always override office-hours / additional-hours
            // restrictions — they have an explicit scheduled_for and must never be withheld.
            if (t.is_pinned && t.pin_type === 'hard') return true;
            // Office project: only schedule on open office days
            if (officeProjectId && t.project_id === officeProjectId) return officeWindowForDay !== null;
            // All other tasks: restricted to additional hours window when enabled
            if (additionalHours?.enabled) return additionalWindowForDay !== null;
            return true;
          })
          .map(t => {
            // Fixed-time tasks: never annotate with a time window — they bypass it entirely.
            if (t.is_pinned && t.pin_type === 'hard') return t;
            // Office project: annotate with office window
            if (officeProjectId && t.project_id === officeProjectId && officeWindowForDay) {
              return { ...t, time_window_start: officeWindowForDay.start, time_window_end: officeWindowForDay.end };
            }
            // All other tasks: annotate with additional hours window when enabled
            if (additionalHours?.enabled && additionalWindowForDay) {
              return { ...t, time_window_start: additionalWindowForDay.start, time_window_end: additionalWindowForDay.end };
            }
            return t;
          });

        const generatedSchedule = scheduler.generateSchedule({
          targetDate,
          tasks: tasksForDate,
          existingSchedule,
          force: options?.reschedule_all,
          previouslyScheduledIds,
        });

        // Track non-habit tasks that were scheduled today for future days
        for (const st of (generatedSchedule.scheduled_tasks || [])) {
          if (!st.is_buffer && st.task_id) {
            const task = activeTasks.find(t => t.id === st.task_id);
            if (task && !task.is_habit) {
              previouslyScheduledIds.add(st.task_id);
            }
          }
        }

        newSchedules.push(generatedSchedule);
      }

      await saveSchedules(newSchedules);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [tasks, projects, preferences, schedules, saveSchedules]);

  // Generate schedules function
  const generateSchedules = useCallback(async (days: number = 7, force: boolean = false) => {
    await reschedule({ reschedule_all: force, days });
  }, [reschedule]);

  // Helper to get scheduled date for a task
  const getScheduledDate = useCallback((taskId: string): string | null => {
    return upcomingData.task_schedule_map[taskId] || null;
  }, [upcomingData]);

  /**
   * Remove a task/habit from a single day's schedule without affecting any
   * other day. The item stays fully eligible for every other date — clicking
   * "Reschedule All" again will not bring it back to this specific day, but
   * a regular task remains free to land on a future day, and a habit will
   * still occur normally on its next scheduled day.
   */
  const skipTaskForDate = useCallback(async (taskId: string, dateStr: string) => {
    const existing = schedules.get(dateStr) ?? createSchedule(dateStr);

    if (existing.skipped_task_ids?.includes(taskId)) return; // already skipped

    const removedEntry = existing.scheduled_tasks.find(st => st.task_id === taskId);
    const remainingScheduled = existing.scheduled_tasks.filter(st => st.task_id !== taskId);

    const currentCompleted = existing.summary?.tasks_completed ?? 0;
    const currentRemaining = existing.summary?.tasks_remaining ?? 0;
    // Only adjust "remaining" count — a skipped task was never completed today.
    const newRemaining = removedEntry ? Math.max(0, currentRemaining - 1) : currentRemaining;
    const totalTasks = currentCompleted + newRemaining;

    const updated: Schedule = {
      ...existing,
      scheduled_tasks: remainingScheduled,
      skipped_task_ids: [...(existing.skipped_task_ids ?? []), taskId],
      summary: {
        ...existing.summary,
        tasks_remaining: newRemaining,
        completion_rate: totalTasks > 0 ? (currentCompleted / totalTasks) * 100 : 0,
      },
    };

    await saveSchedules([updated]);
  }, [schedules, saveSchedules]);

  return {
    schedule,
    upcomingData,
    taskScheduleMap: upcomingData.task_schedule_map,
    unscheduledTaskIds: upcomingData.unscheduled_task_ids,
    unscheduledReasons: upcomingData.unscheduled_reasons,
    loading,
    error,
    refetch: () => loadSchedule(targetDate),
    refetchUpcoming: () => {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 60);
      return loadSchedules(toISODateString(today), toISODateString(endDate));
    },
    reschedule,
    generateSchedules,
    getScheduledDate,
    skipTaskForDate,
  };
}
