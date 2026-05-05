/**
 * Validation utilities
 */

/**
 * Validate priority is within range 1-5
 */
export function validatePriority(priority: number): boolean {
  return Number.isInteger(priority) && priority >= 1 && priority <= 5;
}

/**
 * Validate difficulty is within range 1-5
 */
export function validateDifficulty(difficulty: number): boolean {
  return Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5;
}

/**
 * Validate estimated minutes is positive
 */
export function validateEstimatedMinutes(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes > 0;
}

/**
 * Validate HH:MM time format
 */
export function validateTimeFormat(time: string): boolean {
  const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return regex.test(time);
}

/**
 * Validate ISO date string format (YYYY-MM-DD)
 */
export function validateISODateFormat(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;

  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Validate ISO datetime string format
 */
export function validateISODateTimeFormat(datetime: string): boolean {
  const d = new Date(datetime);
  return !isNaN(d.getTime());
}

/**
 * Validate energy level
 */
export function validateEnergyLevel(level: string): boolean {
  return ['low', 'medium', 'high'].includes(level);
}

/**
 * Validate task status
 */
export function validateTaskStatus(status: string): boolean {
  return ['todo', 'in_progress', 'completed', 'blocked'].includes(status);
}

/**
 * Validate project status
 */
export function validateProjectStatus(status: string): boolean {
  return ['active', 'paused', 'completed', 'archived'].includes(status);
}

/**
 * Validate goal status
 */
export function validateGoalStatus(status: string): boolean {
  return ['active', 'achieved', 'abandoned'].includes(status);
}

/**
 * Validate recurrence frequency
 */
export function validateRecurrenceFrequency(frequency: string): boolean {
  return ['daily', 'weekly', 'monthly'].includes(frequency);
}

/**
 * Validate list type
 */
export function validateListType(type: string): boolean {
  return ['eternal', 'template', 'quick'].includes(type);
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Sanitize string for use in file names
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}
