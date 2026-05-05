import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import type { Schedule } from '@trackmind/core';
import { Scheduler, createDefaultPreferences, toISODateString } from '@trackmind/core';

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
      const scheduler = new Scheduler({ preferences: prefs });

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

      // Calculate days dynamically based on task count
      // Each day can roughly handle 6-10 tasks, so estimate days needed
      // Use a minimum of 1 day (if tasks exist) and maximum of 90 days
      const nonHabitTasks = activeTasks.filter(t => !t.is_habit);
      const estimatedDaysNeeded = Math.ceil(nonHabitTasks.length / 6); // Assume ~6 non-habit tasks per day
      const days = options?.days ?? Math.min(90, Math.max(1, estimatedDaysNeeded + 3)); // Add small buffer

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
        const generatedSchedule = scheduler.generateSchedule({
          targetDate,
          tasks: activeTasks,
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
  };
}
