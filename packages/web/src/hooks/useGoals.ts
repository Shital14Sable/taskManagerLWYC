import { useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/context/AppContext';
import type { Goal, GoalStatus, TimeHorizon, GoalCategory } from '@trackmind/core';

export interface CreateGoalInput {
  title: string;
  description?: string;
  time_horizon?: TimeHorizon;
  category?: GoalCategory;
  target_date?: string;
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_task_ids?: string[];
  parent_goal_id?: string;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  time_horizon?: TimeHorizon;
  category?: GoalCategory;
  target_date?: string;
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_task_ids?: string[];
  parent_goal_id?: string;
  status?: GoalStatus;
}

export interface GoalProgress {
  goal_id: string;
  goal_title: string;
  overall_progress: number;
  total_tasks: number;
  completed_tasks: number;
  linked_projects: number;
  linked_habits: number;
  linked_direct_tasks: number;
  projects: {
    project_id: string;
    project_name: string;
    total_tasks: number;
    completed_tasks: number;
    progress: number;
  }[];
  habits: {
    habit_id: string;
    habit_title: string;
    is_active: boolean;
    frequency: string;
    completion_count: number;
  }[];
  directTasks: {
    task_id: string;
    task_title: string;
    status: string;
    project_name?: string;
  }[];
  subGoals: {
    goal_id: string;
    goal_title: string;
    status: string;
    progress: number;
  }[];
}

export function useGoals(filters?: { status?: GoalStatus; timeHorizon?: TimeHorizon; category?: GoalCategory }) {
  const { goals, saveGoal, deleteGoal: removeGoal, tasks, projects, getHabitInstancesByHabit } = useApp();

  // Apply filters
  const filteredGoals = useMemo(() => {
    let result = goals;
    if (filters?.status) {
      result = result.filter(g => g.status === filters.status);
    }
    if (filters?.timeHorizon) {
      result = result.filter(g => g.time_horizon === filters.timeHorizon);
    }
    if (filters?.category) {
      result = result.filter(g => g.category === filters.category);
    }
    return result;
  }, [goals, filters]);

  const createGoal = useCallback(async (data: CreateGoalInput): Promise<Goal> => {
    const now = new Date().toISOString();
    const newGoal: Goal = {
      id: uuidv4(),
      title: data.title,
      description: data.description,
      time_horizon: data.time_horizon ?? 'quarterly',
      category: data.category ?? 'personal',
      target_date: data.target_date,
      linked_project_ids: data.linked_project_ids ?? [],
      linked_habit_ids: data.linked_habit_ids ?? [],
      linked_task_ids: data.linked_task_ids ?? [],
      parent_goal_id: data.parent_goal_id,
      status: 'active',
      progress: 0,
      created_at: now,
      updated_at: now,
    };
    await saveGoal(newGoal);
    return newGoal;
  }, [saveGoal]);

  const updateGoal = useCallback(async (id: string, data: UpdateGoalInput): Promise<Goal> => {
    const existing = goals.find(g => g.id === id);
    if (!existing) {
      throw new Error(`Goal ${id} not found`);
    }
    const updated: Goal = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await saveGoal(updated);
    return updated;
  }, [goals, saveGoal]);

  const linkProject = useCallback(async (goalId: string, projectId: string): Promise<Goal> => {
    const existing = goals.find(g => g.id === goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }
    if (existing.linked_project_ids.includes(projectId)) {
      return existing;
    }
    return updateGoal(goalId, {
      linked_project_ids: [...existing.linked_project_ids, projectId],
    });
  }, [goals, updateGoal]);

  const unlinkProject = useCallback(async (goalId: string, projectId: string): Promise<Goal> => {
    const existing = goals.find(g => g.id === goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }
    return updateGoal(goalId, {
      linked_project_ids: existing.linked_project_ids.filter(id => id !== projectId),
    });
  }, [goals, updateGoal]);

  const linkHabit = useCallback(async (goalId: string, habitId: string): Promise<Goal> => {
    const existing = goals.find(g => g.id === goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }
    const linkedHabitIds = existing.linked_habit_ids ?? [];
    if (linkedHabitIds.includes(habitId)) {
      return existing;
    }
    return updateGoal(goalId, {
      linked_habit_ids: [...linkedHabitIds, habitId],
    });
  }, [goals, updateGoal]);

  const unlinkHabit = useCallback(async (goalId: string, habitId: string): Promise<Goal> => {
    const existing = goals.find(g => g.id === goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }
    const linkedHabitIds = existing.linked_habit_ids ?? [];
    return updateGoal(goalId, {
      linked_habit_ids: linkedHabitIds.filter(id => id !== habitId),
    });
  }, [goals, updateGoal]);

  const linkTask = useCallback(async (goalId: string, taskId: string): Promise<Goal> => {
    const existing = goals.find(g => g.id === goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }
    const linkedTaskIds = existing.linked_task_ids ?? [];
    if (linkedTaskIds.includes(taskId)) {
      return existing;
    }
    return updateGoal(goalId, {
      linked_task_ids: [...linkedTaskIds, taskId],
    });
  }, [goals, updateGoal]);

  const unlinkTask = useCallback(async (goalId: string, taskId: string): Promise<Goal> => {
    const existing = goals.find(g => g.id === goalId);
    if (!existing) {
      throw new Error(`Goal ${goalId} not found`);
    }
    const linkedTaskIds = existing.linked_task_ids ?? [];
    return updateGoal(goalId, {
      linked_task_ids: linkedTaskIds.filter(id => id !== taskId),
    });
  }, [goals, updateGoal]);

  const getProgress = useCallback(async (goalId: string): Promise<GoalProgress> => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) {
      throw new Error(`Goal ${goalId} not found`);
    }

    // Get linked projects and their progress
    const linkedProjects = projects.filter(p => goal.linked_project_ids.includes(p.id));
    const projectProgress = linkedProjects.map(p => {
      const projectTasks = tasks.filter(t => t.project_id === p.id);
      const completedTasks = projectTasks.filter(t => t.status === 'completed');
      return {
        project_id: p.id,
        project_name: p.name,
        total_tasks: projectTasks.length,
        completed_tasks: completedTasks.length,
        progress: projectTasks.length > 0 ? (completedTasks.length / projectTasks.length) * 100 : 0,
      };
    });

    // Get linked habits with completion counts
    const linkedHabitIds = goal.linked_habit_ids ?? [];
    const linkedHabits = tasks.filter(t => t.is_habit && linkedHabitIds.includes(t.id));

    // Fetch habit completion counts
    const habitsProgress = await Promise.all(linkedHabits.map(async h => {
      const instances = await getHabitInstancesByHabit(h.id);
      return {
        habit_id: h.id,
        habit_title: h.title,
        is_active: !h.is_paused,
        frequency: h.recurrence?.frequency || 'daily',
        completion_count: instances.length,
      };
    }));

    // Get directly linked tasks (non-habit)
    const linkedTaskIds = goal.linked_task_ids ?? [];
    const linkedDirectTasks = tasks.filter(t => !t.is_habit && linkedTaskIds.includes(t.id));
    const directTasksProgress = linkedDirectTasks.map(t => {
      const project = projects.find(p => p.id === t.project_id);
      return {
        task_id: t.id,
        task_title: t.title,
        status: t.status,
        project_name: project?.name,
      };
    });

    // Get sub-goals
    const subGoals = goals.filter(g => g.parent_goal_id === goalId);
    const subGoalsProgress = subGoals.map(g => ({
      goal_id: g.id,
      goal_title: g.title,
      status: g.status,
      progress: g.progress,
    }));

    // Calculate totals
    const projectTasksTotal = projectProgress.reduce((sum, p) => sum + p.total_tasks, 0);
    const projectTasksCompleted = projectProgress.reduce((sum, p) => sum + p.completed_tasks, 0);
    const directTasksCompleted = linkedDirectTasks.filter(t => t.status === 'completed').length;

    const totalTasks = projectTasksTotal + linkedDirectTasks.length;
    const completedTasks = projectTasksCompleted + directTasksCompleted;

    return {
      goal_id: goalId,
      goal_title: goal.title,
      overall_progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      linked_projects: linkedProjects.length,
      linked_habits: linkedHabits.length,
      linked_direct_tasks: linkedDirectTasks.length,
      projects: projectProgress,
      habits: habitsProgress,
      directTasks: directTasksProgress,
      subGoals: subGoalsProgress,
    };
  }, [goals, projects, tasks, getHabitInstancesByHabit]);

  // Organize goals by time horizon
  const yearlyGoals = useMemo(() => filteredGoals.filter(g => g.time_horizon === 'yearly'), [filteredGoals]);
  const quarterlyGoals = useMemo(() => filteredGoals.filter(g => g.time_horizon === 'quarterly'), [filteredGoals]);
  const monthlyGoals = useMemo(() => filteredGoals.filter(g => g.time_horizon === 'monthly'), [filteredGoals]);

  // Active goals
  const activeGoals = useMemo(() => filteredGoals.filter(g => g.status === 'active'), [filteredGoals]);
  const achievedGoals = useMemo(() => filteredGoals.filter(g => g.status === 'achieved'), [filteredGoals]);

  // Build hierarchy tree
  const getChildGoals = useCallback((parentId: string) =>
    filteredGoals.filter(g => g.parent_goal_id === parentId), [filteredGoals]);
  const topLevelGoals = useMemo(() => filteredGoals.filter(g => !g.parent_goal_id), [filteredGoals]);

  return {
    goals: filteredGoals,
    yearlyGoals,
    quarterlyGoals,
    monthlyGoals,
    activeGoals,
    achievedGoals,
    topLevelGoals,
    getChildGoals,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    createGoal,
    updateGoal,
    deleteGoal: removeGoal,
    linkProject,
    unlinkProject,
    linkHabit,
    unlinkHabit,
    linkTask,
    unlinkTask,
    getProgress,
  };
}
