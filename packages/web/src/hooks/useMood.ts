import { useState, useCallback, useEffect, useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { trackFeatureUse } from '@/lib/analytics';
import type { MoodCheckIn, MoodCheckInCreate, MoodBlock, EnergyBlock } from '@trackmind/core';
import {
  createMoodCheckIn,
  MOOD_EMOJI_CONFIG,
  getLatestMoodForBlock,
  calculateAverageMood,
  calculateMoodTrend,
  groupMoodsByDate,
  createDefaultMoodBlocks,
  getCurrentMoodBlock,
  createDefaultSidebarPreferences,
} from '@trackmind/core';

// Helper to get energy level label
function getEnergyLabel(level: string): string {
  switch (level) {
    case 'high': return 'Peak Energy';
    case 'medium': return 'Moderate';
    case 'low': return 'Wind Down';
    default: return level;
  }
}

// Convert energy patterns to mood blocks
function energyPatternsToMoodBlocks(energyBlocks: EnergyBlock[]): MoodBlock[] {
  return energyBlocks.map((block, index) => ({
    id: `energy-${index}`,
    name: getEnergyLabel(block.level),
    start: block.start,
    end: block.end,
  }));
}

// Sort mood blocks chronologically starting from the first block of the day
function sortMoodBlocksChronologically(blocks: MoodBlock[]): MoodBlock[] {
  // Sort by start time, but handle overnight blocks
  return [...blocks].sort((a, b) => {
    const [aH, aM] = a.start.split(':').map(Number);
    const [bH, bM] = b.start.split(':').map(Number);
    const aMinutes = aH * 60 + aM;
    const bMinutes = bH * 60 + bM;
    return aMinutes - bMinutes;
  });
}

// Add an "Other" block if the defined blocks don't cover 24 hours
function addOtherBlockIfNeeded(blocks: MoodBlock[]): MoodBlock[] {
  if (blocks.length === 0) return blocks;

  // Sort blocks by start time first
  const sorted = sortMoodBlocksChronologically(blocks);

  // Calculate total coverage
  const timeToMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  };

  // Find the gap - check if blocks cover 24 hours
  const firstStart = timeToMinutes(sorted[0].start);
  const lastEnd = timeToMinutes(sorted[sorted.length - 1].end);

  // If last block ends before first block starts (or there's a gap overnight)
  // we need an "Other" block
  const hasGap = lastEnd < firstStart || (lastEnd !== firstStart && lastEnd < 24 * 60);

  if (hasGap && lastEnd !== firstStart) {
    // Add "Other" block for the remaining time
    const otherBlock: MoodBlock = {
      id: 'other',
      name: 'Other',
      start: sorted[sorted.length - 1].end,
      end: sorted[0].start,
    };
    return [...sorted, otherBlock];
  }

  return sorted;
}

export interface MoodBlockStatus {
  block: MoodBlock;
  mood: MoodCheckIn | null;
  isCurrent: boolean;
  isPast: boolean;
}

export interface MoodStats {
  average: number;
  trend: 'improving' | 'declining' | 'stable';
  entryCount: number;
  byDate: Record<string, MoodCheckIn[]>;
}

export function useMood() {
  const { storage, preferences, savePreferences } = useApp();
  const [moodCheckIns, setMoodCheckIns] = useState<MoodCheckIn[]>([]);
  const [loading, setLoading] = useState(true);

  // Get mood blocks from energy patterns for today, or use defaults
  const moodBlocks = useMemo(() => {
    // Get the current day name
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];

    // Get energy patterns for today
    const todayEnergyPatterns = preferences.energy_patterns?.[today];

    let blocks: MoodBlock[];
    if (todayEnergyPatterns && todayEnergyPatterns.length > 0) {
      // Convert energy patterns to mood blocks
      blocks = energyPatternsToMoodBlocks(todayEnergyPatterns);
    } else {
      // Fall back to explicitly configured mood_blocks or defaults
      blocks = preferences.mood_blocks ?? createDefaultMoodBlocks();
    }

    // Sort chronologically and add "Other" block if there's uncovered time
    return addOtherBlockIfNeeded(blocks);
  }, [preferences.energy_patterns, preferences.mood_blocks]);

  // Get sidebar preferences
  const sidebarPreferences = useMemo(() => {
    return preferences.sidebar ?? createDefaultSidebarPreferences();
  }, [preferences.sidebar]);

  // Load mood check-ins on mount
  useEffect(() => {
    async function loadMoods() {
      if (!storage) {
        return;
      }
      try {
        const moods = await storage.getMoodCheckIns();
        setMoodCheckIns(moods);
      } catch (error) {
        console.warn('[useMood] Failed to load mood check-ins:', error);
      } finally {
        setLoading(false);
      }
    }
    loadMoods();
  }, [storage]);

  // Get today's date string
  const getTodayDateString = useCallback(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // Get moods for a specific date
  const getMoodsForDate = useCallback((date: string): MoodCheckIn[] => {
    return moodCheckIns.filter(m => m.date === date);
  }, [moodCheckIns]);

  // Get moods for a date range
  const getMoodsForDateRange = useCallback(async (startDate: string, endDate: string): Promise<MoodCheckIn[]> => {
    if (!storage) return [];
    return storage.getMoodCheckInsByDateRange(startDate, endDate);
  }, [storage]);

  // Get today's moods
  const todayMoods = useMemo(() => {
    return getMoodsForDate(getTodayDateString());
  }, [getMoodsForDate, getTodayDateString]);

  // Get block status for today
  const getTodayBlockStatus = useCallback((): MoodBlockStatus[] => {
    const today = getTodayDateString();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return moodBlocks.map(block => {
      const [startH, startM] = block.start.split(':').map(Number);
      const [endH, endM] = block.end.split(':').map(Number);
      const blockStartMinutes = startH * 60 + startM;
      const blockEndMinutes = endH * 60 + endM;

      // Determine if this is an overnight block (end time < start time)
      const isOvernightBlock = blockEndMinutes <= blockStartMinutes;

      let isCurrent = false;
      let isPast = false;

      if (isOvernightBlock) {
        // Overnight block (e.g., 21:00-06:00)
        // Current if: time >= start OR time < end
        isCurrent = currentMinutes >= blockStartMinutes || currentMinutes < blockEndMinutes;
        // Past if: time >= end AND time < start (i.e., during daytime after the block ended)
        isPast = currentMinutes >= blockEndMinutes && currentMinutes < blockStartMinutes;
      } else {
        // Normal daytime block
        isCurrent = currentMinutes >= blockStartMinutes && currentMinutes < blockEndMinutes;
        isPast = currentMinutes >= blockEndMinutes;
      }

      // Get the latest mood for this block
      const mood = getLatestMoodForBlock(moodCheckIns, today, block.start, block.end);

      return {
        block,
        mood,
        isCurrent,
        isPast,
      };
    });
  }, [moodBlocks, moodCheckIns, getTodayDateString]);

  // Get current block
  const currentBlock = useMemo(() => {
    return getCurrentMoodBlock(moodBlocks);
  }, [moodBlocks]);

  // Log a mood check-in
  const logMood = useCallback(async (data: MoodCheckInCreate): Promise<MoodCheckIn> => {
    if (!storage) throw new Error('Storage not initialized');

    const moodCheckIn = createMoodCheckIn(data);
    await storage.saveMoodCheckIn(moodCheckIn);

    setMoodCheckIns(prev => [...prev, moodCheckIn]);
    trackFeatureUse('mood_log');

    return moodCheckIn;
  }, [storage]);

  // Update a mood check-in
  const updateMood = useCallback(async (id: string, updates: Partial<MoodCheckInCreate>): Promise<MoodCheckIn> => {
    if (!storage) throw new Error('Storage not initialized');

    const existing = moodCheckIns.find(m => m.id === id);
    if (!existing) throw new Error(`Mood check-in ${id} not found`);

    const config = updates.level ? MOOD_EMOJI_CONFIG[updates.level] : null;

    const updated: MoodCheckIn = {
      ...existing,
      level: updates.level ?? existing.level,
      emoji: config?.emoji ?? existing.emoji,
      label: config?.label ?? existing.label,
      note: updates.note !== undefined ? updates.note : existing.note,
      updated_at: new Date().toISOString(),
    };

    await storage.saveMoodCheckIn(updated);

    setMoodCheckIns(prev => prev.map(m => m.id === id ? updated : m));

    return updated;
  }, [storage, moodCheckIns]);

  // Delete a mood check-in
  const deleteMood = useCallback(async (id: string): Promise<void> => {
    if (!storage) throw new Error('Storage not initialized');

    await storage.deleteMoodCheckIn(id);
    setMoodCheckIns(prev => prev.filter(m => m.id !== id));
  }, [storage]);

  // Calculate mood stats for a date range
  const calculateStats = useCallback((moods: MoodCheckIn[]): MoodStats => {
    return {
      average: calculateAverageMood(moods),
      trend: calculateMoodTrend(moods),
      entryCount: moods.length,
      byDate: groupMoodsByDate(moods),
    };
  }, []);

  // Get week stats
  const weekStats = useMemo((): MoodStats => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekMoods = moodCheckIns.filter(m => {
      const moodDate = new Date(m.date);
      return moodDate >= weekAgo && moodDate <= today;
    });

    return calculateStats(weekMoods);
  }, [moodCheckIns, calculateStats]);

  // Update mood blocks in preferences
  const updateMoodBlocks = useCallback(async (blocks: MoodBlock[]): Promise<void> => {
    const updatedPrefs = {
      ...preferences,
      mood_blocks: blocks,
    };
    await savePreferences(updatedPrefs);
  }, [preferences, savePreferences]);

  // Update sidebar preferences
  const updateSidebarPreferences = useCallback(async (sidebar: { visible?: boolean; collapsedWidgets?: string[] }): Promise<void> => {
    const currentSidebar = preferences.sidebar ?? createDefaultSidebarPreferences();
    const updatedPrefs = {
      ...preferences,
      sidebar: {
        ...currentSidebar,
        ...sidebar,
      },
    };
    await savePreferences(updatedPrefs);
  }, [preferences, savePreferences]);

  // Toggle sidebar visibility
  const toggleSidebar = useCallback(async (): Promise<void> => {
    await updateSidebarPreferences({
      visible: !sidebarPreferences.visible,
    });
  }, [sidebarPreferences.visible, updateSidebarPreferences]);

  // Toggle widget collapsed state
  const toggleWidgetCollapsed = useCallback(async (widgetId: string): Promise<void> => {
    const collapsedWidgets = [...sidebarPreferences.collapsedWidgets];
    const index = collapsedWidgets.indexOf(widgetId);

    if (index >= 0) {
      collapsedWidgets.splice(index, 1);
    } else {
      collapsedWidgets.push(widgetId);
    }

    await updateSidebarPreferences({ collapsedWidgets });
  }, [sidebarPreferences.collapsedWidgets, updateSidebarPreferences]);

  // Check if a widget is collapsed
  const isWidgetCollapsed = useCallback((widgetId: string): boolean => {
    return sidebarPreferences.collapsedWidgets.includes(widgetId);
  }, [sidebarPreferences.collapsedWidgets]);

  return {
    // State
    moodCheckIns,
    loading,
    moodBlocks,
    currentBlock,
    todayMoods,
    weekStats,
    sidebarPreferences,

    // Methods
    logMood,
    updateMood,
    deleteMood,
    getMoodsForDate,
    getMoodsForDateRange,
    getTodayBlockStatus,
    calculateStats,
    updateMoodBlocks,

    // Sidebar methods
    toggleSidebar,
    toggleWidgetCollapsed,
    isWidgetCollapsed,
    updateSidebarPreferences,

    // Config
    MOOD_EMOJI_CONFIG,
  };
}
