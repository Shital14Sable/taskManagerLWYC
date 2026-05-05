import { v4 as uuidv4 } from 'uuid';

export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'blocked';
export type EnergyLevel = 'low' | 'medium' | 'high';
export type PinType = 'soft' | 'hard';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface Recurrence {
  frequency: RecurrenceFrequency | null;
  days_of_week: string[];  // ["Monday", "Wednesday"]
  time_of_day: string | null;  // "14:00"
  end_date: string | null;  // ISO date string
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  priority: number;  // 1-5
  difficulty: number;  // 1-5
  energy_level: EnergyLevel;
  estimated_minutes: number;
  actual_minutes: number | null;
  status: TaskStatus;
  dependencies: string[];
  tags: string[];
  deadline: string | null;  // ISO datetime string
  scheduled_for: string | null;  // ISO date string
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
  completed_at: string | null;  // ISO datetime string

  // Habit-specific fields
  is_habit: boolean;
  recurrence: Recurrence;
  is_paused: boolean;
  paused_until: string | null;  // ISO date string

  // Quick capture / inbox fields
  needs_review: boolean;

  // Pinning for drag & drop scheduling
  is_pinned: boolean;
  pin_type: PinType;
}

export interface TaskCreate {
  project_id: string;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  priority?: number;
  difficulty?: number;
  energy_level?: EnergyLevel;
  estimated_minutes?: number;
  dependencies?: string[];
  tags?: string[];
  deadline?: string | null;
  scheduled_for?: string | null;
  is_habit?: boolean;
  recurrence?: Partial<Recurrence>;
  needs_review?: boolean;
  // Fixed time scheduling (meetings, appointments)
  is_pinned?: boolean;
  pin_type?: PinType;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  priority?: number;
  difficulty?: number;
  energy_level?: EnergyLevel;
  estimated_minutes?: number;
  actual_minutes?: number | null;
  status?: TaskStatus;
  dependencies?: string[];
  tags?: string[];
  deadline?: string | null;
  scheduled_for?: string | null;
  needs_review?: boolean;
  is_pinned?: boolean;
  pin_type?: PinType;
  is_paused?: boolean;
  paused_until?: string | null;
  recurrence?: Partial<Recurrence>;
}

export function createDefaultRecurrence(): Recurrence {
  return {
    frequency: null,
    days_of_week: [],
    time_of_day: null,
    end_date: null,
  };
}

export function createTask(data: TaskCreate): Task {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    project_id: data.project_id,
    parent_task_id: data.parent_task_id ?? null,
    title: data.title,
    description: data.description ?? null,
    priority: data.priority ?? 3,
    difficulty: data.difficulty ?? 3,
    energy_level: data.energy_level ?? 'medium',
    estimated_minutes: data.estimated_minutes ?? 60,
    actual_minutes: null,
    status: 'todo',
    dependencies: data.dependencies ?? [],
    tags: data.tags ?? [],
    deadline: data.deadline ?? null,
    scheduled_for: data.scheduled_for ?? null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    is_habit: data.is_habit ?? false,
    recurrence: {
      ...createDefaultRecurrence(),
      ...data.recurrence,
    },
    is_paused: false,
    paused_until: null,
    needs_review: data.needs_review ?? false,
    is_pinned: data.is_pinned ?? false,
    pin_type: data.pin_type ?? 'soft',
  };
}
