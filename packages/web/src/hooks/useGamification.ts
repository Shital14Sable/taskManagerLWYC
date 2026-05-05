import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { xpProgressInLevel, BADGE_DEFINITIONS, type Badge, type LevelProgress } from '@trackmind/core';

export function useGamification() {
  const { stats, loadStats } = useApp();

  // Calculate level progress using the core package's quadratic formula
  const levelProgress = useMemo((): LevelProgress | null => {
    if (!stats) return null;

    const currentLevel = stats.level;
    const totalXP = stats.total_xp;

    // Use the core package's xpProgressInLevel function which correctly
    // calculates XP progress using the quadratic formula: 10 * level^1.5
    const [currentXPInLevel, xpNeededForLevel] = xpProgressInLevel(totalXP);
    const progressPercent = xpNeededForLevel > 0
      ? Math.min(100, (currentXPInLevel / xpNeededForLevel) * 100)
      : 100;

    return {
      level: currentLevel,
      current_xp: currentXPInLevel,
      xp_needed: xpNeededForLevel,
      progress_percent: progressPercent,
      total_xp: totalXP,
    };
  }, [stats]);

  // Build badges list with earned status
  const badges = useMemo((): Badge[] => {
    const earnedSet = new Set(stats?.earned_badges ?? []);

    return Object.values(BADGE_DEFINITIONS).map(def => ({
      type: def.type,
      name: def.name,
      description: def.description,
      icon: def.icon,
      earned: earnedSet.has(def.type),
      earned_at: undefined, // Would need to track this in storage
    }));
  }, [stats]);

  const earnedBadges = useMemo(() => badges.filter(b => b.earned), [badges]);
  const unearnedBadges = useMemo(() => badges.filter(b => !b.earned), [badges]);

  return {
    stats,
    levelProgress,
    badges,
    earnedBadges,
    unearnedBadges,
    loading: false,
    error: null,
    refetch: loadStats,
  };
}
