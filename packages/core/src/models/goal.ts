import { v4 as uuidv4 } from 'uuid';

export type TimeHorizon = 'yearly' | 'quarterly' | 'monthly';
export type GoalCategory = 'career' | 'health' | 'personal' | 'learning' | 'financial' | 'relationships' | 'other';
export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  time_horizon: TimeHorizon;
  category: GoalCategory;
  target_date: string | null;  // ISO date string
  linked_project_ids: string[];
  linked_habit_ids: string[];  // Habit task IDs linked to this goal
  linked_task_ids: string[];   // Regular task IDs linked to this goal
  parent_goal_id: string | null;
  status: GoalStatus;
  progress: number;  // 0-100
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
  achieved_at: string | null;  // ISO datetime string
}

export interface GoalCreate {
  title: string;
  description?: string | null;
  time_horizon?: TimeHorizon;
  category?: GoalCategory;
  target_date?: string | null;
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_task_ids?: string[];
  parent_goal_id?: string | null;
}

export interface GoalUpdate {
  title?: string;
  description?: string | null;
  time_horizon?: TimeHorizon;
  category?: GoalCategory;
  target_date?: string | null;
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_task_ids?: string[];
  parent_goal_id?: string | null;
  status?: GoalStatus;
  progress?: number;
}

export function createGoal(data: GoalCreate): Goal {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: data.title,
    description: data.description ?? null,
    time_horizon: data.time_horizon ?? 'yearly',
    category: data.category ?? 'other',
    target_date: data.target_date ?? null,
    linked_project_ids: data.linked_project_ids ?? [],
    linked_habit_ids: data.linked_habit_ids ?? [],
    linked_task_ids: data.linked_task_ids ?? [],
    parent_goal_id: data.parent_goal_id ?? null,
    status: 'active',
    progress: 0,
    created_at: now,
    updated_at: now,
    achieved_at: null,
  };
}
