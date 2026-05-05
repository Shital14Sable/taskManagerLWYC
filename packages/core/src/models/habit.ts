import { v4 as uuidv4 } from 'uuid';

export interface HabitInstance {
  habit_id: string;
  date: string;  // ISO date string
  instance_detail: string;
  notes: string | null;
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
}

export interface HabitInstanceCreate {
  instance_detail: string;
  notes?: string | null;
}

export interface HabitInstanceUpdate {
  instance_detail?: string;
  notes?: string | null;
}

export function createHabitInstance(
  habitId: string,
  date: string,
  data: HabitInstanceCreate
): HabitInstance {
  const now = new Date().toISOString();
  return {
    habit_id: habitId,
    date,
    instance_detail: data.instance_detail,
    notes: data.notes ?? null,
    created_at: now,
    updated_at: now,
  };
}

export function getHabitInstanceKey(habitId: string, date: string): string {
  return `${habitId}:${date}`;
}
