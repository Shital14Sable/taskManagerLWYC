import { v4 as uuidv4 } from 'uuid';

/**
 * Mood levels (1-5 scale)
 */
export type MoodLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Mood emoji and label configuration
 */
export const MOOD_EMOJI_CONFIG: Record<MoodLevel, { emoji: string; label: string; color: string }> = {
  1: { emoji: '😢', label: 'Very Low', color: '#ef4444' },
  2: { emoji: '😔', label: 'Low', color: '#f97316' },
  3: { emoji: '😐', label: 'Neutral', color: '#eab308' },
  4: { emoji: '🙂', label: 'Good', color: '#22c55e' },
  5: { emoji: '😄', label: 'Great', color: '#10b981' },
};

/**
 * A standalone mood check-in entry
 * Decoupled from Journal for independent tracking per time block
 */
export interface MoodCheckIn {
  id: string;
  date: string;           // YYYY-MM-DD
  timestamp: string;      // ISO datetime - actual time logged
  level: MoodLevel;
  emoji: string;
  label: string;
  note?: string;          // Optional note about the mood
  created_at: string;
  updated_at: string;
}

export interface MoodCheckInCreate {
  date?: string;
  timestamp?: string;
  level: MoodLevel;
  note?: string;
}

export interface MoodCheckInUpdate {
  level?: MoodLevel;
  note?: string;
}

/**
 * Create a new mood check-in
 */
export function createMoodCheckIn(data: MoodCheckInCreate): MoodCheckIn {
  const now = new Date();
  const nowISO = now.toISOString();
  const dateStr = data.date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const config = MOOD_EMOJI_CONFIG[data.level];

  return {
    id: uuidv4(),
    date: dateStr,
    timestamp: data.timestamp ?? nowISO,
    level: data.level,
    emoji: config.emoji,
    label: config.label,
    note: data.note,
    created_at: nowISO,
    updated_at: nowISO,
  };
}

/**
 * Get mood check-ins for a specific time range on a date
 */
export function filterMoodsByTimeRange(
  moods: MoodCheckIn[],
  date: string,
  startTime: string,  // HH:MM
  endTime: string     // HH:MM
): MoodCheckIn[] {
  return moods.filter(mood => {
    if (mood.date !== date) return false;

    const moodTime = new Date(mood.timestamp);
    const moodMinutes = moodTime.getHours() * 60 + moodTime.getMinutes();

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    // Handle overnight ranges (e.g., 21:00-06:00)
    if (endMinutes <= startMinutes) {
      // Block spans midnight
      return moodMinutes >= startMinutes || moodMinutes < endMinutes;
    }

    return moodMinutes >= startMinutes && moodMinutes < endMinutes;
  });
}

/**
 * Get the most recent mood for a time block on a date
 */
export function getLatestMoodForBlock(
  moods: MoodCheckIn[],
  date: string,
  startTime: string,
  endTime: string
): MoodCheckIn | null {
  const blockMoods = filterMoodsByTimeRange(moods, date, startTime, endTime);
  if (blockMoods.length === 0) return null;

  // Sort by timestamp descending and return the most recent
  return blockMoods.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
}

/**
 * Calculate average mood for a date range
 */
export function calculateAverageMood(moods: MoodCheckIn[]): number {
  if (moods.length === 0) return 0;
  const sum = moods.reduce((acc, mood) => acc + mood.level, 0);
  return sum / moods.length;
}

/**
 * Calculate mood trend (improving, declining, or stable)
 */
export function calculateMoodTrend(moods: MoodCheckIn[]): 'improving' | 'declining' | 'stable' {
  if (moods.length < 4) return 'stable';

  // Sort by timestamp
  const sorted = [...moods].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const midpoint = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, midpoint);
  const secondHalf = sorted.slice(midpoint);

  const firstAvg = calculateAverageMood(firstHalf);
  const secondAvg = calculateAverageMood(secondHalf);

  if (secondAvg - firstAvg > 0.3) return 'improving';
  if (firstAvg - secondAvg > 0.3) return 'declining';
  return 'stable';
}

/**
 * Group moods by date
 */
export function groupMoodsByDate(moods: MoodCheckIn[]): Record<string, MoodCheckIn[]> {
  return moods.reduce((acc, mood) => {
    if (!acc[mood.date]) {
      acc[mood.date] = [];
    }
    acc[mood.date].push(mood);
    return acc;
  }, {} as Record<string, MoodCheckIn[]>);
}
