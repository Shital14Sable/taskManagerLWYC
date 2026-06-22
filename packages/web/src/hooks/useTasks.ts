import { useMemo, useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/context/AppContext';
import type { Task, Badge, HabitInstance } from '@trackmind/core';
import { calculateXP, calculateLevel, checkBadges } from '@trackmind/core';

export interface XPGain {
  xpEarned: number;
  newLevel?: number;
  newBadges: Badge[];
}

export interface CreateTaskInput {
  project_id: string;
  title: string;
  description?: string;
  priority?: number;
  difficulty?: number;
  energy_level?: 'low' | 'medium' | 'high';
  estimated_minutes?: number;
  has_deadline?: boolean;
  deadline?: string;
  parent_task_id?: string;
  is_habit?: boolean;
  recurrence?: {
    frequency?: 'daily' | 'weekly' | 'monthly';
    days_of_week?: string[];
    time_of_day?: string;
    end_date?: string;
  };
  tags?: string[];
  needs_review?: boolean;
  dependencies?: string[];
  status?: 'todo' | 'in_progress' | 'completed';
  // Fixed time scheduling (meetings, appointments)
  is_pinned?: boolean;
  pin_type?: 'soft' | 'hard';
  scheduled_for?: string;
}

export function useTasks(projectId?: string) {
  const { tasks, saveTask, deleteTask: removeTask, stats, saveStats, saveHabitInstance, deleteHabitInstance, schedules, saveSchedule } = useApp();
  const [lastXPGain, setLastXPGain] = useState<XPGain | null>(null);

  // Filter tasks by project if specified
  const filteredTasks = useMemo(() => {
    if (!projectId) return tasks;
    return tasks.filter(t => t.project_id === projectId);
  }, [tasks, projectId]);

  const createTask = useCallback(async (data: CreateTaskInput): Promise<Task> => {
    const now = new Date().toISOString();
    const newTask: Task = {
      id: uuidv4(),
      project_id: data.project_id,
      parent_task_id: data.parent_task_id,
      title: data.title,
      description: data.description ?? '',
      priority: data.priority ?? 5,
      difficulty: data.difficulty ?? 3,
      energy_level: data.energy_level ?? 'medium',
      estimated_minutes: data.estimated_minutes ?? 60,
      status: data.status ?? 'todo',
      dependencies: data.dependencies ?? [],
      tags: data.tags ?? [],
      deadline: data.has_deadline ? data.deadline : undefined,
      scheduled_for: data.scheduled_for,
      created_at: now,
      updated_at: now,
      is_habit: data.is_habit ?? false,
      recurrence: data.recurrence,
      is_paused: false,
      needs_review: data.needs_review ?? false,
      is_pinned: data.is_pinned ?? false,
      pin_type: data.pin_type ?? 'soft',
    };
    await saveTask(newTask);
    return newTask;
  }, [saveTask]);

  const updateTask = useCallback(async (id: string, data: Partial<Task>): Promise<Task> => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const updated: Task = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    await saveTask(updated);
    return updated;
  }, [tasks, saveTask]);

  /**
   * Complete a task or habit.
   * @param id - Task/habit ID
   * @param options - Optional settings
   * @param options.actualMinutes - Actual time spent on the task
   * @param options.forDate - For habits: the scheduled date to record completion for (defaults to today).
   *                          This allows completing a habit scheduled for a previous day.
   */
  const completeTask = useCallback(async (id: string, options?: { actualMinutes?: number; forDate?: string }): Promise<Task> => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const now = new Date().toISOString();
    // Use local date for habit tracking (not UTC from toISOString)
    const today = new Date();
    const localTodayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // For habits: use the specified date (scheduled date) or fall back to today
    const habitDate = options?.forDate || localTodayDate;

    let completed: Task;

    if (existing.is_habit) {
      // For habits, mark as completed but reset to 'todo' for next occurrence
      completed = {
        ...existing,
        status: 'todo',
        actual_minutes: options?.actualMinutes,
        updated_at: now,
        // Don't set completed_at for habits as they recur
      };

      // Create a habit instance to track this completion for the SCHEDULED date
      const habitInstance: HabitInstance = {
        habit_id: existing.id,
        date: habitDate,
        instance_detail: `Completed`,
        created_at: now,
        updated_at: now,
      };
      await saveHabitInstance(habitInstance);
    } else {
      completed = {
        ...existing,
        status: 'completed',
        actual_minutes: options?.actualMinutes,
        completed_at: now,
        updated_at: now,
      };
    }

    // Calculate XP and check for badges
    const xpEarned = calculateXP(completed.difficulty, completed.estimated_minutes, completed.is_habit);
    const newTotalXP = stats.total_xp + xpEarned;
    const newLevel = calculateLevel(newTotalXP);
    const newBadges = checkBadges({
      ...stats,
      total_xp: newTotalXP,
      tasks_completed: stats.tasks_completed + 1,
      habits_completed: existing.is_habit ? stats.habits_completed + 1 : stats.habits_completed,
    });

    // Update stats
    const newStats = {
      ...stats,
      total_xp: newTotalXP,
      level: newLevel,
      tasks_completed: stats.tasks_completed + 1,
      habits_completed: existing.is_habit ? stats.habits_completed + 1 : stats.habits_completed,
      current_streak: stats.current_streak + 1,
      longest_streak: Math.max(stats.longest_streak, stats.current_streak + 1),
      last_completion_date: localTodayDate,
      earned_badges: [...new Set([...stats.earned_badges, ...newBadges.map(b => b.type)])],
    };

    await saveTask(completed);
    await saveStats(newStats);

    // Update schedule's completed_tasks array to track completion for the day
    // For habits: update the scheduled day's schedule (habitDate), not necessarily today
    // For regular tasks: update today's schedule
    const scheduleDate = existing.is_habit ? habitDate : localTodayDate;
    const targetSchedule = schedules.get(scheduleDate);
    if (targetSchedule && !targetSchedule.completed_tasks?.includes(id)) {
      const currentCompleted = targetSchedule.summary?.tasks_completed ?? 0;
      const currentRemaining = targetSchedule.summary?.tasks_remaining ?? 0;
      const totalTasks = currentCompleted + currentRemaining;
      const newCompleted = currentCompleted + 1;
      const newRemaining = Math.max(0, currentRemaining - 1);

      const updatedSchedule = {
        ...targetSchedule,
        completed_tasks: [...(targetSchedule.completed_tasks || []), id],
        summary: {
          ...targetSchedule.summary,
          tasks_completed: newCompleted,
          tasks_remaining: newRemaining,
          completion_rate: totalTasks > 0 ? (newCompleted / totalTasks) * 100 : 0,
        },
      };
      await saveSchedule(updatedSchedule);
    }

    // Track XP gain for notifications
    if (xpEarned > 0) {
      setLastXPGain({
        xpEarned,
        newLevel: newLevel > stats.level ? newLevel : undefined,
        newBadges,
      });
    }

    return completed;
  }, [tasks, stats, saveTask, saveStats, saveHabitInstance, schedules, saveSchedule]);

  /**
   * Mark a task as incomplete — the reverse of completeTask, used to toggle the
   * completion checkbox back off.
   * @param id - Task ID
   * @param options - Optional settings
   * @param options.forDate - For habits: the scheduled date to remove completion from (defaults to today).
   */
  const uncompleteTask = useCallback(async (id: string, options?: { forDate?: string }): Promise<Task> => {
    const existing = tasks.find(t => t.id === id);
    if (!existing) {
      throw new Error(`Task ${id} not found`);
    }

    const now = new Date().toISOString();
    const today = new Date();
    const localTodayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const habitDate = options?.forDate || localTodayDate;

    let reverted: Task;

    if (existing.is_habit) {
      // Habits stay 'todo' since they recur — undo by removing the day's HabitInstance record.
      reverted = { ...existing, updated_at: now };
      await deleteHabitInstance(existing.id, habitDate);
    } else {
      reverted = {
        ...existing,
        status: 'todo',
        completed_at: null,
        updated_at: now,
      };
    }

    // Reverse only the XP/stats this one completion granted, so toggling the
    // checkbox back and forth can't be used to farm XP. Badges and longest_streak
    // are intentionally left as-is — once earned, they stay earned.
    const xpToRemove = calculateXP(existing.difficulty, existing.estimated_minutes, existing.is_habit);
    const newTotalXP = Math.max(0, stats.total_xp - xpToRemove);
    const newStats = {
      ...stats,
      total_xp: newTotalXP,
      level: calculateLevel(newTotalXP),
      tasks_completed: Math.max(0, stats.tasks_completed - 1),
      habits_completed: existing.is_habit ? Math.max(0, stats.habits_completed - 1) : stats.habits_completed,
      current_streak: Math.max(0, stats.current_streak - 1),
    };

    await saveTask(reverted);
    await saveStats(newStats);

    // Remove the task from the day's schedule completion list
    const scheduleDate = existing.is_habit ? habitDate : localTodayDate;
    const targetSchedule = schedules.get(scheduleDate);
    if (targetSchedule && targetSchedule.completed_tasks?.includes(id)) {
      const currentCompleted = targetSchedule.summary?.tasks_completed ?? 0;
      const currentRemaining = targetSchedule.summary?.tasks_remaining ?? 0;
      const totalTasks = currentCompleted + currentRemaining;
      const newCompleted = Math.max(0, currentCompleted - 1);
      const newRemaining = currentRemaining + 1;

      const updatedSchedule = {
        ...targetSchedule,
        completed_tasks: targetSchedule.completed_tasks.filter(taskId => taskId !== id),
        summary: {
          ...targetSchedule.summary,
          tasks_completed: newCompleted,
          tasks_remaining: newRemaining,
          completion_rate: totalTasks > 0 ? (newCompleted / totalTasks) * 100 : 0,
        },
      };
      await saveSchedule(updatedSchedule);
    }

    return reverted;
  }, [tasks, stats, saveTask, saveStats, deleteHabitInstance, schedules, saveSchedule]);

  const clearXPGain = useCallback(() => {
    setLastXPGain(null);
  }, []);

  // Filter helpers
  const regularTasks = useMemo(() => filteredTasks.filter(t => !t.is_habit), [filteredTasks]);
  const habits = useMemo(() => filteredTasks.filter(t => t.is_habit), [filteredTasks]);
  const todoTasks = useMemo(() => filteredTasks.filter(t => t.status === 'todo'), [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter(t => t.status === 'completed'), [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter(t => t.status === 'in_progress'), [filteredTasks]);
  const inboxTasks = useMemo(() => filteredTasks.filter(t => t.needs_review && t.status !== 'completed'), [filteredTasks]);

  return {
    tasks: filteredTasks,
    regularTasks,
    habits,
    todoTasks,
    completedTasks,
    inProgressTasks,
    inboxTasks,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    createTask,
    updateTask,
    deleteTask: removeTask,
    completeTask,
    uncompleteTask,
    lastXPGain,
    clearXPGain,
  };
}
