import type { CyclePreferences, CycleSeason, EnergyLevel, UserPreferences, EnergyBlock } from '@trackmind/core';
import type { Task } from '@trackmind/core';

export type { CycleSeason };

export interface CyclePhaseInfo {
  season: CycleSeason;
  name: string;
  phase: string;
  dayRange: string;
  cycleDay: number;
  daysInPhase: number;
  daysRemainingInPhase: number;
  energyLevel: EnergyLevel;
  emoji: string;
  colorClass: string;
  invitation: string;
  bestFor: string[];
  howYouMightFeel: string[];
  isOverride: boolean;
}

const PHASES: Array<{
  season: CycleSeason;
  name: string;
  phase: string;
  startDay: number;
  endDay: number;
  dayRange: string;
  energyLevel: EnergyLevel;
  emoji: string;
  colorClass: string;
  invitation: string;
  bestFor: string[];
  howYouMightFeel: string[];
}> = [
  {
    season: 'winter',
    name: 'Winter',
    phase: 'Menstruation',
    startDay: 1,
    endDay: 5,
    dayRange: 'Days 1–5',
    energyLevel: 'low',
    emoji: '❄️',
    colorClass: 'blue',
    invitation: 'Rest. Release. Reflect.',
    bestFor: [
      'Emotional clearing & journaling',
      'Strategic reflection — review what worked',
      'Visionary planning & big-picture thinking',
      'Solo deep work: editing, proofreading, analysis',
      'Planning your next cycle',
    ],
    howYouMightFeel: [
      'Low energy, craving rest and solitude',
      'Intuitive and reflective',
      'Sensitive to your environment',
      'Wisdom and clarity available beneath the surface',
    ],
  },
  {
    season: 'spring',
    name: 'Spring',
    phase: 'Follicular',
    startDay: 6,
    endDay: 13,
    dayRange: 'Days 6–13',
    energyLevel: 'high',
    emoji: '🌱',
    colorClass: 'green',
    invitation: 'Plan. Create. Initiate.',
    bestFor: [
      'Launch new projects',
      'Deep learning & research',
      'Creative work: writing, brainstorming, designing',
      'Collaborative meetings & strategic planning',
      'Tackle demanding, complex tasks',
    ],
    howYouMightFeel: [
      'Optimistic and motivated',
      'Creative ideas flowing',
      'Ready to learn and take on challenges',
      'Skin glowing, body feeling lighter',
    ],
  },
  {
    season: 'summer',
    name: 'Summer',
    phase: 'Ovulation',
    startDay: 14,
    endDay: 16,
    dayRange: 'Days 14–16',
    energyLevel: 'high',
    emoji: '☀️',
    colorClass: 'yellow',
    invitation: 'Connect. Express. Lead.',
    bestFor: [
      'High-stakes presentations',
      'Negotiations & salary conversations',
      'Networking & relationship building',
      'Lead teams & facilitate meetings',
      'Pitch new ideas',
    ],
    howYouMightFeel: [
      'Confident and radiant',
      'Communicative and expressive',
      'Socially energized and collaborative',
      'Bold, daring, ready to take risks',
    ],
  },
  {
    season: 'autumn',
    name: 'Autumn',
    phase: 'Luteal',
    startDay: 17,
    endDay: 28,
    dayRange: 'Days 17–28',
    energyLevel: 'medium',
    emoji: '🍂',
    colorClass: 'orange',
    invitation: 'Assess. Complete. Edit.',
    bestFor: [
      'Complete projects & cross things off',
      'Administrative tasks & organizing systems',
      'Edit & refine — proofreading, quality control',
      'Set boundaries & clarify what needs to change',
      'Follow up & close open loops',
    ],
    howYouMightFeel: [
      'More inward and sensitive',
      "Clear about boundaries and what's not working",
      'Energy beginning to wane',
      'Desire for completion and nesting',
    ],
  },
];

/**
 * Compute a rolling average cycle length from period start date history.
 * Returns null if fewer than 2 entries (not enough data).
 */
export function computeAverageCycleLength(history: string[]): number | null {
  const sorted = [...history].sort();
  if (sorted.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00');
    const curr = new Date(sorted[i] + 'T00:00:00');
    const days = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (days >= 15 && days <= 60) gaps.push(days); // sanity filter
  }
  if (gaps.length === 0) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

/** Get the most recent period start date from history. */
export function getLastPeriodStart(history: string[]): string | null {
  if (history.length === 0) return null;
  return [...history].sort().at(-1)!;
}

export function getCyclePhase(prefs: CyclePreferences): CyclePhaseInfo | null {
  if (!prefs.enabled) return null;

  // Manual phase override — skip date calculation entirely
  if (prefs.phase_override) {
    const p = PHASES.find(ph => ph.season === prefs.phase_override);
    if (p) {
      return {
        season: p.season,
        name: p.name,
        phase: p.phase,
        dayRange: p.dayRange,
        cycleDay: -1,
        daysInPhase: p.endDay - p.startDay + 1,
        daysRemainingInPhase: -1,
        energyLevel: p.energyLevel,
        emoji: p.emoji,
        colorClass: p.colorClass,
        invitation: p.invitation,
        bestFor: p.bestFor,
        howYouMightFeel: p.howYouMightFeel,
        isOverride: true,
      };
    }
  }

  // Resolve last period start — prefer history, fall back to legacy field
  const history = prefs.period_history ?? [];
  const lastPeriodStart = getLastPeriodStart(history) ?? prefs.last_period_start ?? null;
  if (!lastPeriodStart) return null;

  // Resolve cycle length — use rolling average if enough history, otherwise manual fallback
  const computed = computeAverageCycleLength(history);
  const cycleLength = Math.max(21, Math.min(60, computed ?? prefs.average_cycle_length ?? 28));

  const start = new Date(lastPeriodStart + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceStart < 0) return null;

  // Cycle day 1–cycleLength (wraps after one full cycle)
  const cycleDay = (daysSinceStart % cycleLength) + 1;

  // Scale phase boundaries proportionally to the actual cycle length
  const scale = cycleLength / 28;

  for (const p of PHASES) {
    const scaledStart = Math.max(1, Math.round(p.startDay * scale));
    const scaledEnd = Math.round(p.endDay * scale);
    if (cycleDay >= scaledStart && cycleDay <= scaledEnd) {
      return {
        season: p.season,
        name: p.name,
        phase: p.phase,
        dayRange: p.dayRange,
        cycleDay,
        daysInPhase: scaledEnd - scaledStart + 1,
        daysRemainingInPhase: scaledEnd - cycleDay,
        energyLevel: p.energyLevel,
        emoji: p.emoji,
        colorClass: p.colorClass,
        invitation: p.invitation,
        bestFor: p.bestFor,
        howYouMightFeel: p.howYouMightFeel,
        isOverride: false,
      };
    }
  }

  return null;
}

export function getCyclePhaseFromPrefs(prefs: { cycle?: CyclePreferences }): CyclePhaseInfo | null {
  if (!prefs.cycle) return null;

  // Migrate legacy data: if no period_history but last_period_start exists, treat it as history
  const cycle = prefs.cycle;
  if ((!cycle.period_history || cycle.period_history.length === 0) && cycle.last_period_start) {
    return getCyclePhase({
      ...cycle,
      period_history: [cycle.last_period_start],
    });
  }

  return getCyclePhase(cycle);
}

/**
 * Compute the cycle phase for an arbitrary calendar date.
 * Phase override only applies when the date is today; historical/future dates
 * always use the computed cycle position.
 */
export function getCyclePhaseForDate(date: Date, prefs: CyclePreferences): CyclePhaseInfo | null {
  if (!prefs.enabled) return null;

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = targetDate.getTime() === today.getTime();

  // For today, delegate to getCyclePhase (which handles phase_override)
  if (isToday) return getCyclePhase(prefs);

  // For other dates, compute from history, ignoring override
  const history = prefs.period_history ?? [];
  const lastPeriodStart = getLastPeriodStart(history) ?? prefs.last_period_start ?? null;
  if (!lastPeriodStart) return null;

  const computed = computeAverageCycleLength(history);
  const cycleLength = Math.max(21, Math.min(60, computed ?? prefs.average_cycle_length ?? 28));

  const start = new Date(lastPeriodStart + 'T00:00:00');
  const daysSinceStart = Math.floor((targetDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSinceStart < 0) return null;

  const cycleDay = (daysSinceStart % cycleLength) + 1;
  const scale = cycleLength / 28;

  for (const p of PHASES) {
    const scaledStart = Math.max(1, Math.round(p.startDay * scale));
    const scaledEnd = Math.round(p.endDay * scale);
    if (cycleDay >= scaledStart && cycleDay <= scaledEnd) {
      return {
        season: p.season,
        name: p.name,
        phase: p.phase,
        dayRange: p.dayRange,
        cycleDay,
        daysInPhase: scaledEnd - scaledStart + 1,
        daysRemainingInPhase: scaledEnd - cycleDay,
        energyLevel: p.energyLevel,
        emoji: p.emoji,
        colorClass: p.colorClass,
        invitation: p.invitation,
        bestFor: p.bestFor,
        howYouMightFeel: p.howYouMightFeel,
        isOverride: false,
      };
    }
  }
  return null;
}

export { PHASES as CYCLE_PHASES };

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * When cycle tracking is enabled, override energy_patterns so the scheduler
 * sees a single flat energy block per day matching the current cycle phase energy.
 * Falls back to the stored energy_patterns when cycle is disabled or not configured.
 */
/** Result of distributing project tasks across cycle-phase-appropriate days. */
export interface TaskDistributionResult {
  taskId: string;
  scheduledFor: string;      // YYYY-MM-DD
  season: CycleSeason | 'any';
  phaseScore: number;        // 0–100, how well this task matched its assigned phase
}

// ─── Task ↔ Phase scoring ────────────────────────────────────────────────────

type PhaseScores = Record<CycleSeason, number>;

// Keywords that signal which cycle phase a task is best suited for
const PHASE_KEYWORDS: Record<CycleSeason, string[]> = {
  winter: [
    'review', 'reflect', 'journal', 'plan', 'edit', 'proofread', 'analyze',
    'analysis', 'audit', 'assess', 'read', 'report', 'evaluate', 'retrospect',
    'research', 'document', 'notes', 'summarize', 'draft',
  ],
  spring: [
    'create', 'design', 'brainstorm', 'write', 'learn', 'develop', 'build',
    'explore', 'ideate', 'new', 'start', 'begin', 'launch', 'prototype',
    'code', 'implement', 'feature', 'experiment', 'study', 'course',
  ],
  summer: [
    'present', 'meeting', 'meet', 'negotiate', 'pitch', 'network', 'call',
    'interview', 'lead', 'workshop', 'demo', 'announce', 'collaborate',
    'feedback', 'align', 'discuss', 'propose', 'client', 'stakeholder',
  ],
  autumn: [
    'complete', 'finish', 'organize', 'admin', 'email', 'follow', 'update',
    'document', 'clean', 'archive', 'close', 'wrap', 'tidy', 'file',
    'invoice', 'schedule', 'track', 'log', 'check', 'test', 'qa',
  ],
};

/**
 * Compute how well a task fits each cycle phase (0–100 per phase).
 * Considers energy level, task difficulty, priority, and keyword analysis
 * of the task title, description, and tags.
 */
function scoreTaskForPhases(task: Task): PhaseScores {
  const scores: PhaseScores = { winter: 0, spring: 0, summer: 0, autumn: 0 };

  // 1. Energy level — primary driver
  const energyMap: Record<EnergyLevel, Partial<PhaseScores>> = {
    high:   { spring: 40, summer: 35, autumn: 10, winter:  5 },
    medium: { autumn: 40, spring: 20, summer: 20, winter: 20 },
    low:    { winter: 45, autumn: 30, spring: 15, summer:  5 },
  };
  const eContrib = energyMap[task.energy_level as EnergyLevel] ?? energyMap.medium;
  for (const [phase, pts] of Object.entries(eContrib)) {
    scores[phase as CycleSeason] += pts as number;
  }

  // 2. Difficulty — high-difficulty tasks need the cognitive peak of Spring
  const diff = task.difficulty ?? 3;
  if (diff >= 4) {
    scores.spring += 15;
    scores.summer += 5;
    scores.winter -= 10;
    scores.autumn -= 5;
  } else if (diff <= 2) {
    scores.winter += 10;
    scores.autumn += 8;
    scores.spring -= 5;
  }

  // 3. Priority — critical tasks should land when energy is highest
  if (task.priority >= 4) {
    scores.spring += 8;
    scores.summer += 4;
  } else if (task.priority <= 2) {
    scores.winter += 6;
    scores.autumn += 4;
  }

  // 4. Keyword analysis across title + description + tags
  const text = [
    task.title,
    task.description ?? '',
    ...(task.tags ?? []),
  ].join(' ').toLowerCase();

  for (const [phase, keywords] of Object.entries(PHASE_KEYWORDS)) {
    const hits = keywords.filter(kw => text.includes(kw)).length;
    scores[phase as CycleSeason] += hits * 7;
  }

  // Clamp to [0, 100]
  for (const phase of Object.keys(scores) as CycleSeason[]) {
    scores[phase] = Math.max(0, Math.min(100, scores[phase]));
  }

  return scores;
}

// ─── Main distribution function ──────────────────────────────────────────────

/**
 * Distribute a project's tasks across the full period [today, deadline],
 * aligning each task to its best-matching cycle phase.
 *
 * Algorithm:
 *   1. Score every task against every phase (energy + difficulty + keywords + priority).
 *   2. Assign each task an "ideal slot" — an evenly-spaced position in [0, N-1]
 *      so tasks span the FULL deadline period rather than front-loading.
 *   3. Search outward from each ideal slot for the nearest day whose cycle phase
 *      best matches the task's top-scoring phase.
 *   4. Respect per-day capacity (maxTasksPerDay).
 *
 * Returns assignments callers should persist via saveTask, then reschedule.
 */
export function distributeCycleTasks(
  tasks: Task[],
  startDate: Date,
  deadlineDate: Date,
  prefs: UserPreferences,
  maxTasksPerDay = 3,
): TaskDistributionResult[] {
  const today = new Date(startDate);
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);

  if (deadline <= today || tasks.length === 0) return [];

  // Build every calendar day in [today, deadline] with its cycle season
  type DayEntry = { date: string; season: CycleSeason | null };
  const allDays: DayEntry[] = [];
  const cur = new Date(today);
  while (cur <= deadline) {
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    let season: CycleSeason | null = null;
    if (prefs.cycle?.enabled) {
      const effectiveCycle =
        (!prefs.cycle.period_history || prefs.cycle.period_history.length === 0) && prefs.cycle.last_period_start
          ? { ...prefs.cycle, period_history: [prefs.cycle.last_period_start] }
          : prefs.cycle;
      const phase = getCyclePhaseForDate(cur, effectiveCycle);
      season = phase?.season ?? null;
    }
    allDays.push({ date: dateStr, season });
    cur.setDate(cur.getDate() + 1);
  }

  if (allDays.length === 0) return [];

  const N = allDays.length;
  const M = tasks.length;

  // Compute phase scores for each task
  const phaseScores = tasks.map(t => scoreTaskForPhases(t));

  // Sort tasks so those with the strongest phase preference are placed first
  // (they get first pick of phase-appropriate slots before overflow).
  // Within equal specificity, higher priority wins.
  const taskOrder = tasks
    .map((t, i) => ({
      idx: i,
      maxScore: Math.max(...Object.values(phaseScores[i])),
      priority: t.priority,
    }))
    .sort((a, b) => b.maxScore - a.maxScore || b.priority - a.priority)
    .map(x => x.idx);

  // Ideal slot index for task at sorted position `orderPos` (0-based):
  // Spreads M tasks evenly across N days.
  const idealSlotFor = (orderPos: number) =>
    M === 1 ? 0 : Math.round(orderPos * (N - 1) / (M - 1));

  // Day capacity tracking
  const dateCount = new Map<string, number>();

  // Find the best available day for a task, starting near `idealIdx`
  // and searching outward. Scores a day by phase match - distance penalty.
  const findBestDay = (
    scores: PhaseScores,
    idealIdx: number,
  ): { dayIdx: number; season: CycleSeason | 'any'; phaseScore: number } | null => {
    // Search radius: up to the full timeline
    const maxRadius = N;

    let bestDayIdx = -1;
    let bestDayScore = -Infinity;
    let bestSeason: CycleSeason | 'any' = 'any';
    let bestPhaseScore = 0;

    // Expand outward from ideal position
    for (let radius = 0; radius <= maxRadius; radius++) {
      // Check both directions (skip duplicate at radius=0)
      const candidates =
        radius === 0
          ? [idealIdx]
          : [idealIdx - radius, idealIdx + radius];

      for (const dayIdx of candidates) {
        if (dayIdx < 0 || dayIdx >= N) continue;
        const day = allDays[dayIdx];
        const cap = dateCount.get(day.date) ?? 0;
        if (cap >= maxTasksPerDay) continue;

        const phaseMatch = day.season !== null ? scores[day.season] : 0;
        // Distance penalty: each day away costs 2 points
        const distancePenalty = radius * 2;
        // Prefer days with more remaining capacity (lighter days get a bonus)
        const capacityBonus = (maxTasksPerDay - cap) * 3;

        const totalScore = phaseMatch - distancePenalty + capacityBonus;

        if (totalScore > bestDayScore) {
          bestDayScore = totalScore;
          bestDayIdx = dayIdx;
          bestSeason = day.season ?? 'any';
          bestPhaseScore = phaseMatch;
        }
      }

      // Early exit: stop expanding once we've found a good match and
      // the phase score won't improve further (phase bonus can't overcome distance)
      if (bestDayIdx !== -1 && radius >= Math.ceil(N / M)) break;
    }

    if (bestDayIdx === -1) return null;
    return { dayIdx: bestDayIdx, season: bestSeason, phaseScore: bestPhaseScore };
  };

  const result: TaskDistributionResult[] = [];

  for (let orderPos = 0; orderPos < taskOrder.length; orderPos++) {
    const taskIdx = taskOrder[orderPos];
    const task = tasks[taskIdx];
    const scores = phaseScores[taskIdx];
    const idealIdx = idealSlotFor(orderPos);

    const best = findBestDay(scores, idealIdx);

    if (best) {
      const day = allDays[best.dayIdx];
      dateCount.set(day.date, (dateCount.get(day.date) ?? 0) + 1);
      result.push({
        taskId: task.id,
        scheduledFor: day.date,
        season: best.season,
        phaseScore: Math.round(best.phaseScore),
      });
    } else {
      // Absolute fallback: deadline day
      const fallback = allDays[N - 1];
      dateCount.set(fallback.date, (dateCount.get(fallback.date) ?? 0) + 1);
      result.push({
        taskId: task.id,
        scheduledFor: fallback.date,
        season: fallback.season ?? 'any',
        phaseScore: 0,
      });
    }
  }

  return result;
}

export function applyEffectiveEnergyToPrefs(
  prefs: UserPreferences,
  date: Date
): UserPreferences {
  if (!prefs.cycle?.enabled) return prefs;

  const cycle = prefs.cycle;
  // Handle migration from legacy last_period_start
  const effectiveCycle =
    (!cycle.period_history || cycle.period_history.length === 0) && cycle.last_period_start
      ? { ...cycle, period_history: [cycle.last_period_start] }
      : cycle;

  const phase = getCyclePhaseForDate(date, effectiveCycle);
  if (!phase) return prefs;

  const flatPatterns: Record<string, EnergyBlock[]> = {};
  for (const day of WEEK_DAYS) {
    const workHours = prefs.work_hours[day] ?? { start: '08:00', end: '22:00' };
    flatPatterns[day] = [{ start: workHours.start, end: workHours.end, level: phase.energyLevel }];
  }

  return { ...prefs, energy_patterns: flatPatterns };
}
