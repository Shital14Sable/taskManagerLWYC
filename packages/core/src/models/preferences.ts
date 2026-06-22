import { TimeSlot } from './schedule';

export type EnergyLevelType = 'high' | 'medium' | 'low';

export interface DayWorkHours {
  start: string;  // HH:MM
  end: string;    // HH:MM
}

export interface EnergyBlock {
  start: string;  // HH:MM
  end: string;    // HH:MM
  level: EnergyLevelType;
}

export interface TaskDefaults {
  min_duration: number;
  default_duration: number;
  buffer_percentage: number;
}

export interface SchedulingPreferences {
  batch_similar_tasks: boolean;
  auto_reschedule_daily: boolean;
  days_to_schedule_ahead: number;
  respect_energy_patterns: boolean;
  energy_match_bonus: number;  // Score bonus for energy match
  max_deep_work_stretch: number;
}

export interface DisplayPreferences {
  time_format: string;  // "24h" or "12h"
  date_format: string;
  color_scheme: string;  // "dark" or "light"
  show_completed_tasks: boolean;
}

export interface OnboardingState {
  completed: boolean;
  skippedAt?: string;
  completedAt?: string;
  sampleDataAdded: boolean;
}

export interface MoodBlock {
  id: string;
  name: string;
  start: string;  // HH:MM
  end: string;    // HH:MM
}

export type CycleSeason = 'winter' | 'spring' | 'summer' | 'autumn';

export interface OfficeHoursDay {
  enabled: boolean;
  start: string;  // HH:MM
  end: string;    // HH:MM
}

export interface OfficeHoursPreferences {
  enabled: boolean;
  // Standard per-weekday schedule (keys: 'monday' … 'sunday')
  schedule: Record<string, OfficeHoursDay>;
  // One-off date overrides: YYYY-MM-DD → custom hours or null (office closed that day)
  date_overrides: Record<string, OfficeHoursDay | null>;
  // ID of the project whose tasks are restricted to these hours
  project_id: string | null;
}

export interface CyclePreferences {
  enabled: boolean;
  // History of period start dates (YYYY-MM-DD), sorted ascending; last entry = most recent period
  period_history: string[];
  // Fallback average when < 2 history entries; ignored once history has 2+ dates (rolling avg used instead)
  average_cycle_length: number;
  // null = auto-detect from history; set to a season to manually pin the current phase
  phase_override: CycleSeason | null;
  // Date (YYYY-MM-DD) when the override was set. When set, today is treated as the START of
  // phase_override, and all future dates are recalculated from that anchor point.
  phase_override_start?: string | null;
  // Deprecated — kept for migration from v1.1.x data; prefer period_history
  last_period_start?: string | null;
}

export interface SidebarPreferences {
  visible: boolean;
  collapsedWidgets: string[];  // IDs of collapsed widgets
}

export type WidgetId = 'calendar' | 'goals' | 'deadlines' | 'habits' | 'review' | 'mood';

export interface UserPreferences {
  user_id: string;
  work_hours: Record<string, DayWorkHours>;
  energy_patterns: Record<string, EnergyBlock[]>;
  default_breaks: TimeSlot[];
  task_defaults: TaskDefaults;
  scheduling_preferences: SchedulingPreferences;
  display_preferences: DisplayPreferences;
  auto_reschedule_time: string;  // HH:MM
  auto_backup_time: string;  // HH:MM
  onboarding?: OnboardingState;
  sidebar?: SidebarPreferences;
  mood_blocks?: MoodBlock[];
  cycle?: CyclePreferences;
  office_hours?: OfficeHoursPreferences;
  additional_projects_hours?: OfficeHoursPreferences;
  financial_buckets?: FinancialBucket[];
  // "YYYY-MM" of the currently open financial month; used to detect month rollovers
  financial_current_month?: string;
}

export type FinancialFeeling = 'happy' | 'neutral' | 'sad';

export interface FinancialEntry {
  id: string;
  description: string;
  // Positive amount for happy/neutral, negative for sad.
  // Legacy entries without a feeling use the sign of amount directly.
  amount: number;
  feeling?: FinancialFeeling;
  date: string;     // YYYY-MM-DD
  created_at: string;
}

export interface FinancialBucket {
  id: string;
  name: string;
  color: string;
  entries: FinancialEntry[];
  // Kept for backward-compat with v1.x data that had a plain amount
  amount?: number;
  created_at: string;
  updated_at: string;
}

export function createDefaultWorkHours(): Record<string, DayWorkHours> {
  return {
    monday: { start: '08:00', end: '22:00' },
    tuesday: { start: '08:00', end: '22:00' },
    wednesday: { start: '08:00', end: '22:00' },
    thursday: { start: '08:00', end: '22:00' },
    friday: { start: '08:00', end: '22:00' },
    saturday: { start: '08:00', end: '22:00' },
    sunday: { start: '10:00', end: '24:00' },
  };
}

export function createDefaultEnergyPatterns(): Record<string, EnergyBlock[]> {
  const weekdayPattern: EnergyBlock[] = [
    { start: '08:00', end: '12:00', level: 'high' },
    { start: '12:00', end: '17:00', level: 'medium' },
    { start: '17:00', end: '22:00', level: 'high' },
  ];
  const sundayPattern: EnergyBlock[] = [
    { start: '10:00', end: '15:00', level: 'medium' },
    { start: '15:00', end: '20:00', level: 'medium' },
    { start: '20:00', end: '24:00', level: 'low' },
  ];
  return {
    monday: [...weekdayPattern],
    tuesday: [...weekdayPattern],
    wednesday: [...weekdayPattern],
    thursday: [...weekdayPattern],
    friday: [...weekdayPattern],
    saturday: [...weekdayPattern],
    sunday: sundayPattern,
  };
}

export function createDefaultTaskDefaults(): TaskDefaults {
  return {
    min_duration: 15,
    default_duration: 60,
    buffer_percentage: 10,
  };
}

export function createDefaultSchedulingPreferences(): SchedulingPreferences {
  return {
    batch_similar_tasks: true,
    auto_reschedule_daily: true,
    days_to_schedule_ahead: 7,
    respect_energy_patterns: true,
    energy_match_bonus: 0.15,
    max_deep_work_stretch: 120,
  };
}

export function createDefaultDisplayPreferences(): DisplayPreferences {
  return {
    time_format: '24h',
    date_format: 'YYYY-MM-DD',
    color_scheme: 'dark',
    show_completed_tasks: false,
  };
}

export function createDefaultPreferences(): UserPreferences {
  return {
    user_id: 'default',
    work_hours: createDefaultWorkHours(),
    energy_patterns: createDefaultEnergyPatterns(),
    default_breaks: [],
    task_defaults: createDefaultTaskDefaults(),
    scheduling_preferences: createDefaultSchedulingPreferences(),
    display_preferences: createDefaultDisplayPreferences(),
    auto_reschedule_time: '22:00',
    auto_backup_time: '02:00',
  };
}

export function getWorkHoursForDay(
  preferences: UserPreferences,
  dayName: string
): DayWorkHours {
  return preferences.work_hours[dayName.toLowerCase()] ?? { start: '08:00', end: '22:00' };
}

export function getEnergyPatternsForDay(
  preferences: UserPreferences,
  dayName: string
): EnergyBlock[] {
  return preferences.energy_patterns[dayName.toLowerCase()] ?? [];
}

export function getEnergyLevelAtTime(
  preferences: UserPreferences,
  dayName: string,
  timeStr: string
): EnergyLevelType | null {
  const patterns = getEnergyPatternsForDay(preferences, dayName);
  const timeMinutes = timeToMinutes(timeStr);

  for (const block of patterns) {
    const blockStart = timeToMinutes(block.start);
    const blockEnd = timeToMinutes(block.end);

    // Handle overnight blocks (e.g., 21:00-06:00)
    if (blockEnd <= blockStart) {
      // Block spans midnight
      if (timeMinutes >= blockStart || timeMinutes < blockEnd) {
        return block.level;
      }
    } else {
      // Normal block
      if (timeMinutes >= blockStart && timeMinutes < blockEnd) {
        return block.level;
      }
    }
  }
  return null;
}

export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function createDefaultSidebarPreferences(): SidebarPreferences {
  return {
    visible: true,
    collapsedWidgets: [],
  };
}

export function createDefaultMoodBlocks(): MoodBlock[] {
  return [
    { id: 'morning', name: 'Morning', start: '06:00', end: '12:00' },
    { id: 'afternoon', name: 'Afternoon', start: '12:00', end: '17:00' },
    { id: 'evening', name: 'Evening', start: '17:00', end: '21:00' },
    { id: 'night', name: 'Night', start: '21:00', end: '06:00' },
  ];
}

export function getCurrentMoodBlock(
  moodBlocks: MoodBlock[],
  timeStr?: string
): MoodBlock | null {
  const now = timeStr ? timeStr : `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
  const currentMinutes = timeToMinutes(now);

  for (const block of moodBlocks) {
    const blockStart = timeToMinutes(block.start);
    let blockEnd = timeToMinutes(block.end);

    // Handle overnight blocks (e.g., 21:00-06:00)
    if (blockEnd <= blockStart) {
      // Block spans midnight
      if (currentMinutes >= blockStart || currentMinutes < blockEnd) {
        return block;
      }
    } else {
      // Normal block
      if (currentMinutes >= blockStart && currentMinutes < blockEnd) {
        return block;
      }
    }
  }
  return null;
}
