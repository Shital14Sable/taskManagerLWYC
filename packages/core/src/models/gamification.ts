export type BadgeType =
  // Task completion badges
  | 'first_task'
  | 'centurion'
  | 'task_master'
  // Activity streak badges
  | 'activity_streak_3'
  | 'activity_streak_7'
  | 'activity_streak_30'
  // Habit completion badges
  | 'habit_starter'
  | 'habit_regular'
  | 'habit_dedicated'
  // Per-habit streak badges
  | 'habit_streak_7'
  | 'habit_streak_30'
  // Perfect day badges
  | 'perfect_day'
  | 'perfect_week'
  // Time management badges
  | 'early_bird'
  | 'night_owl'
  | 'time_boxer'
  // Level badges
  | 'level_5'
  | 'level_10'
  | 'level_25'
  | 'level_50';

export interface Badge {
  type: BadgeType;
  name: string;
  description: string;
  icon: string;
  earned_at: string | null;  // ISO datetime string
}

export interface BadgeAchievement {
  badge_type: BadgeType;
  earned_at: string;  // ISO datetime string
  trigger_type: string;  // "task", "habit", "streak", "level", "perfect_day"
  trigger_id: string | null;
  trigger_name: string | null;
  context: Record<string, unknown> | null;
}

export interface UserStats {
  total_xp: number;
  level: number;
  tasks_completed: number;
  habits_completed: number;
  current_streak: number;
  longest_streak: number;
  perfect_day_streak: number;
  best_perfect_day_streak: number;
  best_habit_streak: number;
  last_completion_date: string | null;  // ISO date string
  last_perfect_day: string | null;  // ISO date string
  earned_badges: BadgeType[];
  badge_history: BadgeAchievement[];
}

export const BADGE_DEFINITIONS: Record<BadgeType, Badge> = {
  // Task badges
  first_task: {
    type: 'first_task',
    name: 'First Steps',
    description: 'Complete your first task',
    icon: 'star',
    earned_at: null,
  },
  centurion: {
    type: 'centurion',
    name: 'Centurion',
    description: 'Complete 100 tasks',
    icon: 'shield',
    earned_at: null,
  },
  task_master: {
    type: 'task_master',
    name: 'Task Master',
    description: 'Complete 500 tasks',
    icon: 'award',
    earned_at: null,
  },
  // Activity streak badges
  activity_streak_3: {
    type: 'activity_streak_3',
    name: 'On a Roll',
    description: 'Be active 3 days in a row',
    icon: 'fire',
    earned_at: null,
  },
  activity_streak_7: {
    type: 'activity_streak_7',
    name: 'Week Warrior',
    description: 'Be active 7 days in a row',
    icon: 'zap',
    earned_at: null,
  },
  activity_streak_30: {
    type: 'activity_streak_30',
    name: 'Monthly Master',
    description: 'Be active 30 days in a row',
    icon: 'crown',
    earned_at: null,
  },
  // Habit completion badges
  habit_starter: {
    type: 'habit_starter',
    name: 'Habit Builder',
    description: 'Complete your first habit',
    icon: 'repeat',
    earned_at: null,
  },
  habit_regular: {
    type: 'habit_regular',
    name: 'Habit Regular',
    description: 'Complete 25 habit instances',
    icon: 'check-circle',
    earned_at: null,
  },
  habit_dedicated: {
    type: 'habit_dedicated',
    name: 'Habit Dedicated',
    description: 'Complete 100 habit instances',
    icon: 'heart',
    earned_at: null,
  },
  // Per-habit streak badges
  habit_streak_7: {
    type: 'habit_streak_7',
    name: 'Creature of Habit',
    description: 'Complete any habit 7 scheduled days in a row',
    icon: 'calendar',
    earned_at: null,
  },
  habit_streak_30: {
    type: 'habit_streak_30',
    name: 'Habit Champion',
    description: 'Complete any habit 30 scheduled days in a row',
    icon: 'trophy',
    earned_at: null,
  },
  // Perfect day badges
  perfect_day: {
    type: 'perfect_day',
    name: 'Perfect Day',
    description: 'Complete all scheduled habits in a day',
    icon: 'sun',
    earned_at: null,
  },
  perfect_week: {
    type: 'perfect_week',
    name: 'Perfect Week',
    description: 'Have 7 consecutive perfect days',
    icon: 'calendar-check',
    earned_at: null,
  },
  // Time management badges
  early_bird: {
    type: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a task before 9 AM',
    icon: 'sunrise',
    earned_at: null,
  },
  night_owl: {
    type: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a task after 9 PM',
    icon: 'moon',
    earned_at: null,
  },
  time_boxer: {
    type: 'time_boxer',
    name: 'Time Boxer',
    description: 'Complete a task within its estimated time',
    icon: 'clock',
    earned_at: null,
  },
  // Level badges
  level_5: {
    type: 'level_5',
    name: 'Rising Star',
    description: 'Reach level 5',
    icon: 'trending-up',
    earned_at: null,
  },
  level_10: {
    type: 'level_10',
    name: 'Achiever',
    description: 'Reach level 10',
    icon: 'target',
    earned_at: null,
  },
  level_25: {
    type: 'level_25',
    name: 'Expert',
    description: 'Reach level 25',
    icon: 'medal',
    earned_at: null,
  },
  level_50: {
    type: 'level_50',
    name: 'Legendary',
    description: 'Reach level 50',
    icon: 'gem',
    earned_at: null,
  },
};

export function createDefaultStats(): UserStats {
  return {
    total_xp: 0,
    level: 1,
    tasks_completed: 0,
    habits_completed: 0,
    current_streak: 0,
    longest_streak: 0,
    perfect_day_streak: 0,
    best_perfect_day_streak: 0,
    best_habit_streak: 0,
    last_completion_date: null,
    last_perfect_day: null,
    earned_badges: [],
    badge_history: [],
  };
}

/**
 * Calculate XP for completing a task.
 * Formula: base(1) x difficulty(1-5) x time_factor
 *
 * Time factor scales with duration:
 * - Linear scaling: minutes / 30 (so 1h = 2, 2h = 4, 3h = 6)
 * - Capped at 10 (5 hours max contribution)
 * - Minimum 0.5 for very short tasks
 *
 * Habits get a 1.5x multiplier
 */
export function calculateXP(difficulty: number, estimatedMinutes: number, isHabit: boolean = false): number {
  const baseXp = 1;
  const difficultyFactor = Math.max(1, Math.min(5, difficulty));
  let timeFactor = Math.min(10, estimatedMinutes / 30);
  timeFactor = Math.max(0.5, timeFactor);

  let xp = Math.floor(baseXp * difficultyFactor * timeFactor);

  if (isHabit) {
    xp = Math.floor(xp * 1.5);
  }

  return Math.max(1, xp);
}

/**
 * Calculate level from total XP.
 * Uses a simple quadratic formula: XP needed for level n = 10 * n^1.5
 */
export function calculateLevel(totalXP: number): number {
  let level = 1;
  let xpForNextLevel = 10;
  let remainingXP = totalXP;

  while (remainingXP >= xpForNextLevel) {
    remainingXP -= xpForNextLevel;
    level += 1;
    xpForNextLevel = Math.floor(10 * Math.pow(level, 1.5));
  }

  return level;
}

/**
 * Get XP required to reach the next level
 */
export function xpForNextLevel(currentLevel: number): number {
  return Math.floor(10 * Math.pow(currentLevel + 1, 1.5));
}

/**
 * Get current XP progress within current level.
 * Returns [currentXPInLevel, xpNeededForLevel]
 */
export function xpProgressInLevel(totalXP: number): [number, number] {
  let level = 1;
  let xpForNext = 10;
  let remainingXP = totalXP;

  while (remainingXP >= xpForNext) {
    remainingXP -= xpForNext;
    level += 1;
    xpForNext = Math.floor(10 * Math.pow(level, 1.5));
  }

  return [remainingXP, xpForNext];
}

/**
 * Check which new badges should be awarded based on current stats.
 * Returns an array of newly earned badges.
 */
export function checkBadges(stats: UserStats): Badge[] {
  const newBadges: Badge[] = [];
  const now = new Date().toISOString();

  // Check task completion badges
  if (!stats.earned_badges.includes('first_task') && stats.tasks_completed >= 1) {
    newBadges.push({ ...BADGE_DEFINITIONS.first_task, earned_at: now });
  }
  if (!stats.earned_badges.includes('centurion') && stats.tasks_completed >= 100) {
    newBadges.push({ ...BADGE_DEFINITIONS.centurion, earned_at: now });
  }
  if (!stats.earned_badges.includes('task_master') && stats.tasks_completed >= 500) {
    newBadges.push({ ...BADGE_DEFINITIONS.task_master, earned_at: now });
  }

  // Check activity streak badges
  if (!stats.earned_badges.includes('activity_streak_3') && stats.current_streak >= 3) {
    newBadges.push({ ...BADGE_DEFINITIONS.activity_streak_3, earned_at: now });
  }
  if (!stats.earned_badges.includes('activity_streak_7') && stats.current_streak >= 7) {
    newBadges.push({ ...BADGE_DEFINITIONS.activity_streak_7, earned_at: now });
  }
  if (!stats.earned_badges.includes('activity_streak_30') && stats.current_streak >= 30) {
    newBadges.push({ ...BADGE_DEFINITIONS.activity_streak_30, earned_at: now });
  }

  // Check habit badges
  if (!stats.earned_badges.includes('habit_starter') && stats.habits_completed >= 10) {
    newBadges.push({ ...BADGE_DEFINITIONS.habit_starter, earned_at: now });
  }
  if (!stats.earned_badges.includes('habit_regular') && stats.habits_completed >= 50) {
    newBadges.push({ ...BADGE_DEFINITIONS.habit_regular, earned_at: now });
  }
  if (!stats.earned_badges.includes('habit_dedicated') && stats.habits_completed >= 200) {
    newBadges.push({ ...BADGE_DEFINITIONS.habit_dedicated, earned_at: now });
  }

  // Check level badges
  if (!stats.earned_badges.includes('level_5') && stats.level >= 5) {
    newBadges.push({ ...BADGE_DEFINITIONS.level_5, earned_at: now });
  }
  if (!stats.earned_badges.includes('level_10') && stats.level >= 10) {
    newBadges.push({ ...BADGE_DEFINITIONS.level_10, earned_at: now });
  }
  if (!stats.earned_badges.includes('level_25') && stats.level >= 25) {
    newBadges.push({ ...BADGE_DEFINITIONS.level_25, earned_at: now });
  }
  if (!stats.earned_badges.includes('level_50') && stats.level >= 50) {
    newBadges.push({ ...BADGE_DEFINITIONS.level_50, earned_at: now });
  }

  // Check perfect day badges
  if (!stats.earned_badges.includes('perfect_day') && stats.perfect_day_streak >= 1) {
    newBadges.push({ ...BADGE_DEFINITIONS.perfect_day, earned_at: now });
  }
  if (!stats.earned_badges.includes('perfect_week') && stats.perfect_day_streak >= 7) {
    newBadges.push({ ...BADGE_DEFINITIONS.perfect_week, earned_at: now });
  }

  return newBadges;
}
