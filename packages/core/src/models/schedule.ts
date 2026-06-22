export interface TimeSlot {
  start: string;  // HH:MM format
  end: string;    // HH:MM format
  label: string;
}

export interface SchedulePreferences {
  hard_tasks_hours: string[];
  easy_tasks_hours: string[];
  break_preferred_hours: string[];
  min_task_duration: number;
  buffer_between_tasks: number;
  max_deep_work_stretch: number;
  batch_similar_tasks: boolean;
}

export interface ScheduleConstraints {
  work_start: string;
  work_end: string;
  blocked_slots: TimeSlot[];
  preferences: SchedulePreferences;
}

export interface ScheduledTask {
  task_id: string;
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  estimated_minutes: number;
  is_buffer: boolean;
  auto_scheduled: boolean;
  // Conflict tracking: when a fixed-time task/habit/meeting overlaps another one,
  // both are kept (never silently dropped) and tagged with a shared group id so the
  // UI can render them side by side. conflict_rank 0 = highest priority in the group.
  conflict_group?: string;
  conflict_rank?: number;
}

export interface ScheduleSummary {
  total_scheduled_minutes: number;
  total_completed_minutes: number;
  completion_rate: number;
  tasks_completed: number;
  tasks_remaining: number;
  tasks_behind_schedule: number;
}

export interface Schedule {
  date: string;  // ISO date string
  user_id: string;
  constraints: ScheduleConstraints;
  scheduled_tasks: ScheduledTask[];
  completed_tasks: string[];
  // Task/habit IDs explicitly removed from THIS day only (via "Skip for today" in
  // the UI). Persists across regenerations for this date so re-scheduling doesn't
  // bring the item back — it remains eligible on every other day.
  skipped_task_ids?: string[];
  summary: ScheduleSummary;
  generated_at: string;  // ISO datetime string
  last_rescheduled_at: string | null;  // ISO datetime string
}

export function createDefaultSchedulePreferences(): SchedulePreferences {
  return {
    hard_tasks_hours: ['08:00-12:00'],
    easy_tasks_hours: ['17:00-22:00'],
    break_preferred_hours: ['14:00-16:00'],
    min_task_duration: 15,
    buffer_between_tasks: 10,
    max_deep_work_stretch: 120,
    batch_similar_tasks: true,
  };
}

export function createDefaultScheduleConstraints(): ScheduleConstraints {
  return {
    work_start: '08:00',
    work_end: '22:00',
    blocked_slots: [],
    preferences: createDefaultSchedulePreferences(),
  };
}

export function createDefaultScheduleSummary(): ScheduleSummary {
  return {
    total_scheduled_minutes: 0,
    total_completed_minutes: 0,
    completion_rate: 0,
    tasks_completed: 0,
    tasks_remaining: 0,
    tasks_behind_schedule: 0,
  };
}

export function createSchedule(date: string): Schedule {
  return {
    date,
    user_id: 'default',
    constraints: createDefaultScheduleConstraints(),
    scheduled_tasks: [],
    completed_tasks: [],
    skipped_task_ids: [],
    summary: createDefaultScheduleSummary(),
    generated_at: new Date().toISOString(),
    last_rescheduled_at: null,
  };
}
