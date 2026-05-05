import { format, parseISO, addDays, addMinutes, isAfter, isBefore, startOfDay, getDay, differenceInDays } from 'date-fns';

/**
 * Convert HH:MM to minutes since midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to HH:MM
 * Handles overflow past midnight (e.g., 1440 -> 00:00)
 */
export function minutesToTime(minutes: number): string {
  // Normalize to 0-1439 range (handles times >= 24:00)
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = normalizedMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Parse time range string like '08:00-12:00' to [startMinutes, endMinutes]
 */
export function parseTimeRange(rangeStr: string): [number, number] {
  const [start, end] = rangeStr.split('-');
  return [timeToMinutes(start.trim()), timeToMinutes(end.trim())];
}

/**
 * Check if time falls within range (handles overnight ranges where end < start)
 */
export function isTimeInRange(timeMinutes: number, startMinutes: number, endMinutes: number): boolean {
  // Handle overnight ranges (e.g., 13:00-04:00 where end < start)
  if (endMinutes <= startMinutes) {
    // Range spans midnight: time is in range if >= start OR < end
    return timeMinutes >= startMinutes || timeMinutes < endMinutes;
  }
  // Normal range
  return startMinutes <= timeMinutes && timeMinutes < endMinutes;
}

/**
 * Calculate available time slots given work hours and blocked times
 * Handles overnight work hours (e.g., 13:00 to 04:00) where end < start
 */
export function getAvailableSlots(
  workStart: string,
  workEnd: string,
  blockedSlots: Array<[string, string]>,
  minSlotSize: number = 15
): Array<[number, number]> {
  const workStartMin = timeToMinutes(workStart);
  const workEndMin = timeToMinutes(workEnd);
  const MINUTES_IN_DAY = 24 * 60; // 1440

  // Handle overnight work hours (e.g., 13:00 to 04:00)
  const isOvernight = workEndMin <= workStartMin;

  // Convert blocked slots to minutes
  const blockedRanges: Array<[number, number]> = blockedSlots.map(([start, end]) => [
    timeToMinutes(start),
    timeToMinutes(end),
  ]);

  // For overnight schedules, we have two work periods:
  // 1. From workStart to midnight (1440)
  // 2. From midnight (0) to workEnd
  // We calculate available slots in each period separately

  const available: Array<[number, number]> = [];

  if (isOvernight) {
    // For overnight schedules (e.g., 11 AM to 4 AM), we have two periods:
    // - Period 2: 00:00 to workEnd (early morning, e.g., 00:00-04:00)
    // - Period 1: workStart to midnight (evening, e.g., 11:00-24:00)
    // We generate Period 2 first so that tasks fill the early morning slots first,
    // then overflow to the evening slots. This makes the schedule appear in
    // chronological calendar order (00:00 first, then 11:00).

    // Period 2: midnight to workEnd (early morning hours)
    const period2Blocks = blockedRanges.filter(([s, e]) => s < workEndMin || e <= workEndMin);
    const period2Available = calculateSlotsInPeriod(0, workEndMin, period2Blocks, minSlotSize);
    available.push(...period2Available);

    // Period 1: workStart to midnight (evening hours)
    const period1Blocks = blockedRanges.filter(([s, e]) => s >= workStartMin || e > workStartMin);
    const period1Available = calculateSlotsInPeriod(workStartMin, MINUTES_IN_DAY, period1Blocks, minSlotSize);
    available.push(...period1Available);
  } else {
    // Normal daytime work hours
    const normalAvailable = calculateSlotsInPeriod(workStartMin, workEndMin, blockedRanges, minSlotSize);
    available.push(...normalAvailable);
  }

  return available;
}

/**
 * Helper function to calculate available slots within a single continuous period
 */
function calculateSlotsInPeriod(
  periodStart: number,
  periodEnd: number,
  blockedRanges: Array<[number, number]>,
  minSlotSize: number
): Array<[number, number]> {
  // Filter blocked ranges to only those that overlap with this period
  const relevantBlocks = blockedRanges
    .filter(([s, e]) => s < periodEnd && e > periodStart)
    .map(([s, e]) => [Math.max(s, periodStart), Math.min(e, periodEnd)] as [number, number]);

  // Sort blocked ranges by start time
  relevantBlocks.sort((a, b) => a[0] - b[0]);

  const available: Array<[number, number]> = [];
  let current = periodStart;

  for (const [blockedStart, blockedEnd] of relevantBlocks) {
    if (current < blockedStart) {
      // There's available time before this blocked slot
      if (blockedStart - current >= minSlotSize) {
        available.push([current, blockedStart]);
      }
    }
    current = Math.max(current, blockedEnd);
  }

  // Add remaining time after last blocked slot
  if (current < periodEnd) {
    if (periodEnd - current >= minSlotSize) {
      available.push([current, periodEnd]);
    }
  }

  return available;
}

/**
 * Calculate buffer time based on percentage
 */
export function calculateBufferTime(estimatedMinutes: number, bufferPercentage: number): number {
  return Math.floor(estimatedMinutes * bufferPercentage / 100);
}

/**
 * Round minutes to nearest interval
 */
export function roundToInterval(minutes: number, interval: number = 5): number {
  return Math.round(minutes / interval) * interval;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(timeStr: string, minutes: number): string {
  let timeMinutes = timeToMinutes(timeStr);
  let newMinutes = timeMinutes + minutes;

  // Handle overflow past midnight
  if (newMinutes >= 24 * 60) {
    newMinutes = newMinutes % (24 * 60);
  }

  return minutesToTime(newMinutes);
}

/**
 * Calculate overlap in minutes between two time ranges
 */
export function calculateTimeOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): number {
  const start1Min = timeToMinutes(start1);
  const end1Min = timeToMinutes(end1);
  const start2Min = timeToMinutes(start2);
  const end2Min = timeToMinutes(end2);

  const overlapStart = Math.max(start1Min, start2Min);
  const overlapEnd = Math.min(end1Min, end2Min);

  if (overlapStart >= overlapEnd) {
    return 0;
  }

  return overlapEnd - overlapStart;
}

/**
 * Get lowercase day name from a date
 */
export function getDayName(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Get ISO date string (YYYY-MM-DD) from Date
 */
export function toISODateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parse ISO date string to Date
 */
export function parseISODate(dateStr: string): Date {
  return parseISO(dateStr);
}

/**
 * Check if two dates are the same day
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return toISODateString(date1) === toISODateString(date2);
}

/**
 * Check if date1 is before date2 (comparing days only)
 */
export function isBeforeDay(date1: Date, date2: Date): boolean {
  return startOfDay(date1) < startOfDay(date2);
}

/**
 * Check if date1 is after date2 (comparing days only)
 */
export function isAfterDay(date1: Date, date2: Date): boolean {
  return startOfDay(date1) > startOfDay(date2);
}

/**
 * Get start of today
 */
export function today(): Date {
  return startOfDay(new Date());
}

/**
 * Days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  return differenceInDays(date1, date2);
}

export { format, parseISO, addDays, addMinutes, isAfter, isBefore, startOfDay, getDay };
