import {
  Task,
  UserStats,
  Badge,
  BadgeType,
  BadgeAchievement,
  BADGE_DEFINITIONS,
  calculateXP,
  calculateLevel,
  xpProgressInLevel,
  createDefaultStats,
} from '../models';
import { toISODateString, parseISODate } from '../utils/date-utils';

// Badges that can be earned multiple times
const REPEATABLE_BADGES: Set<BadgeType> = new Set([
  'perfect_day',
  'perfect_week',
  'habit_streak_7',
  'habit_streak_30',
  'early_bird',
  'night_owl',
  'time_boxer',
]);

export interface XPCalculation {
  xpEarned: number;
  newLevel: number;
  newBadges: Badge[];
}

export interface LevelProgress {
  level: number;
  currentXP: number;
  xpNeeded: number;
  progressPercent: number;
  totalXP: number;
}

export class GamificationService {
  private stats: UserStats;

  constructor(stats?: UserStats) {
    this.stats = stats ?? createDefaultStats();
  }

  /**
   * Get current stats
   */
  getStats(): UserStats {
    return { ...this.stats };
  }

  /**
   * Set stats (for loading from storage)
   */
  setStats(stats: UserStats): void {
    this.stats = stats;
  }

  /**
   * Award XP for completing a task
   */
  awardXP(task: Task): XPCalculation {
    const oldLevel = this.stats.level;
    const today = toISODateString(new Date());

    // Calculate XP
    const xpEarned = calculateXP(task.difficulty, task.estimated_minutes, task.is_habit);

    // Update stats
    this.stats.total_xp += xpEarned;
    this.stats.level = calculateLevel(this.stats.total_xp);

    if (task.is_habit) {
      this.stats.habits_completed += 1;
    } else {
      this.stats.tasks_completed += 1;
    }

    // Update activity streak
    if (this.stats.last_completion_date) {
      const lastDate = parseISODate(this.stats.last_completion_date);
      const todayDate = new Date();
      const daysDiff = Math.floor(
        (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 0) {
        // Same day, streak continues
      } else if (daysDiff === 1) {
        this.stats.current_streak += 1;
      } else {
        this.stats.current_streak = 1;
      }
    } else {
      this.stats.current_streak = 1;
    }

    this.stats.last_completion_date = today;

    if (this.stats.current_streak > this.stats.longest_streak) {
      this.stats.longest_streak = this.stats.current_streak;
    }

    // Check for new badges
    const newBadges = this.checkBadges(task, oldLevel);

    return {
      xpEarned,
      newLevel: this.stats.level,
      newBadges,
    };
  }

  /**
   * Check and award badges
   */
  private checkBadges(task: Task, oldLevel: number): Badge[] {
    const newBadges: Badge[] = [];

    // Task badges (non-habits only)
    if (!task.is_habit && this.stats.tasks_completed === 1) {
      newBadges.push(...this.awardBadge('first_task', 'task', task.id, task.title));
    }

    if (this.stats.tasks_completed >= 100) {
      newBadges.push(...this.awardBadge('centurion', 'milestone', task.id, task.title));
    }

    if (this.stats.tasks_completed >= 500) {
      newBadges.push(...this.awardBadge('task_master', 'milestone', task.id, task.title));
    }

    // Activity streak badges
    if (this.stats.current_streak >= 3) {
      newBadges.push(...this.awardBadge('activity_streak_3', 'streak', task.id, task.title));
    }

    if (this.stats.current_streak >= 7) {
      newBadges.push(...this.awardBadge('activity_streak_7', 'streak', task.id, task.title));
    }

    if (this.stats.current_streak >= 30) {
      newBadges.push(...this.awardBadge('activity_streak_30', 'streak', task.id, task.title));
    }

    // Habit badges
    if (task.is_habit) {
      if (this.stats.habits_completed === 1) {
        newBadges.push(...this.awardBadge('habit_starter', 'habit', task.id, task.title));
      }

      if (this.stats.habits_completed >= 25) {
        newBadges.push(...this.awardBadge('habit_regular', 'milestone', task.id, task.title));
      }

      if (this.stats.habits_completed >= 100) {
        newBadges.push(...this.awardBadge('habit_dedicated', 'milestone', task.id, task.title));
      }
    }

    // Time management badges
    const now = new Date();
    if (now.getHours() < 9) {
      newBadges.push(...this.awardBadge('early_bird', 'time', task.id, task.title));
    }

    if (now.getHours() >= 21) {
      newBadges.push(...this.awardBadge('night_owl', 'time', task.id, task.title));
    }

    if (task.actual_minutes && task.actual_minutes <= task.estimated_minutes) {
      newBadges.push(...this.awardBadge('time_boxer', 'time', task.id, task.title));
    }

    // Level badges
    if (this.stats.level >= 5 && oldLevel < 5) {
      newBadges.push(...this.awardBadge('level_5', 'level', task.id, task.title));
    }

    if (this.stats.level >= 10 && oldLevel < 10) {
      newBadges.push(...this.awardBadge('level_10', 'level', task.id, task.title));
    }

    if (this.stats.level >= 25 && oldLevel < 25) {
      newBadges.push(...this.awardBadge('level_25', 'level', task.id, task.title));
    }

    if (this.stats.level >= 50 && oldLevel < 50) {
      newBadges.push(...this.awardBadge('level_50', 'level', task.id, task.title));
    }

    return newBadges;
  }

  /**
   * Award a badge
   */
  private awardBadge(
    badgeType: BadgeType,
    triggerType: string,
    triggerId: string | null,
    triggerName: string | null
  ): Badge[] {
    const isRepeatable = REPEATABLE_BADGES.has(badgeType);
    const alreadyEarned = this.stats.earned_badges.includes(badgeType);

    // For non-repeatable badges, skip if already earned
    if (!isRepeatable && alreadyEarned) {
      return [];
    }

    // For repeatable badges, check if already recorded today
    if (isRepeatable) {
      const today = toISODateString(new Date());
      const recentSameBadge = this.stats.badge_history.filter(
        h =>
          h.badge_type === badgeType &&
          h.earned_at.startsWith(today) &&
          h.trigger_id === triggerId
      );
      if (recentSameBadge.length > 0) {
        return [];
      }
    }

    // Record in badge history
    const achievement: BadgeAchievement = {
      badge_type: badgeType,
      earned_at: new Date().toISOString(),
      trigger_type: triggerType,
      trigger_id: triggerId,
      trigger_name: triggerName,
      context: null,
    };
    this.stats.badge_history.push(achievement);

    // Add to earned badges if not already there
    if (!alreadyEarned) {
      this.stats.earned_badges.push(badgeType);
    }

    // Return badge for notification
    const badge = BADGE_DEFINITIONS[badgeType];
    if (badge) {
      return [{ ...badge, earned_at: new Date().toISOString() }];
    }

    return [];
  }

  /**
   * Get level progress info
   */
  getLevelProgress(): LevelProgress {
    const [currentXP, xpNeeded] = xpProgressInLevel(this.stats.total_xp);
    return {
      level: this.stats.level,
      currentXP,
      xpNeeded,
      progressPercent: xpNeeded > 0 ? Math.floor((currentXP / xpNeeded) * 100) : 100,
      totalXP: this.stats.total_xp,
    };
  }

  /**
   * Get all badges with earned status
   */
  getAllBadges(): Array<Badge & { earned: boolean; earnedCount: number }> {
    return (Object.entries(BADGE_DEFINITIONS) as Array<[BadgeType, Badge]>).map(([type, badge]) => ({
      ...badge,
      earned: this.stats.earned_badges.includes(type),
      earnedCount: this.stats.badge_history.filter(h => h.badge_type === type).length,
    }));
  }

  /**
   * Get earned badges
   */
  getEarnedBadges(): Badge[] {
    return this.stats.earned_badges
      .map(type => BADGE_DEFINITIONS[type])
      .filter((b): b is Badge => b !== undefined);
  }
}
