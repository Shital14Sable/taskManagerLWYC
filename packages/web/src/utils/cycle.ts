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
 * Build a CyclePhaseInfo from raw calculation inputs. Internal helper.
 */
function buildPhaseInfo(
  p: typeof PHASES[number],
  cycleDay: number,
  scaledStart: number,
  scaledEnd: number,
  isOverride: boolean,
): CyclePhaseInfo {
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
    isOverride,
  };
}

/**
 * Compute phase from a known period-start reference date and cycle length.
 */
function phaseFromReference(
  targetDate: Date,
  periodStart: Date,
  cycleLength: number,
  isOverride: boolean,
): CyclePhaseInfo | null {
  const days = Math.floor((targetDate.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  const cycleDay = (days % cycleLength) + 1;
  const scale = cycleLength / 28;
  for (const p of PHASES) {
    const scaledStart = Math.max(1, Math.round(p.startDay * scale));
    const scaledEnd = Math.round(p.endDay * scale);
    if (cycleDay >= scaledStart && cycleDay <= scaledEnd) {
      return buildPhaseInfo(p, cycleDay, scaledStart, scaledEnd, isOverride);
    }
  }
  return null;
}

/**
 * Compute the cycle phase for an arbitrary calendar date.
 *
 * Override anchor behaviour:
 * When the user sets a manual phase_override and phase_override_start is recorded,
 * that start date is treated as cycle day 1 of the override phase's nominal start.
 * All dates on/after the anchor are recalculated from that anchor, so future phases
 * flow correctly rather than staying frozen at the override value.
 */
export function getCyclePhaseForDate(date: Date, prefs: CyclePreferences): CyclePhaseInfo | null {
  if (!prefs.enabled) return null;

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isToday = targetDate.getTime() === today.getTime();

  // For today, delegate to getCyclePhase (which handles phase_override display)
  if (isToday) return getCyclePhase(prefs);

  const history = prefs.period_history ?? [];
  const computed = computeAverageCycleLength(history);
  const cycleLength = Math.max(21, Math.min(60, computed ?? prefs.average_cycle_length ?? 28));
  const scale = cycleLength / 28;

  // If the user set a manual override with an anchor date, recalculate from that anchor
  // for all dates on/after the anchor.
  if (prefs.phase_override && prefs.phase_override_start) {
    const overrideStart = new Date(prefs.phase_override_start + 'T00:00:00');
    overrideStart.setHours(0, 0, 0, 0);

    if (targetDate.getTime() >= overrideStart.getTime()) {
      // Back-calculate an effective period-start date so that overrideStart
      // corresponds to the nominal first day of the override phase.
      const overridePhase = PHASES.find(p => p.season === prefs.phase_override);
      if (overridePhase) {
        const nominalPhaseStartDay = Math.max(1, Math.round(overridePhase.startDay * scale));
        const effectivePeriodStart = new Date(overrideStart);
        effectivePeriodStart.setDate(effectivePeriodStart.getDate() - (nominalPhaseStartDay - 1));
        return phaseFromReference(targetDate, effectivePeriodStart, cycleLength, false);
      }
    }
  }

  // For past dates or when no override anchor: use period history
  const lastPeriodStart = getLastPeriodStart(history) ?? prefs.last_period_start ?? null;
  if (!lastPeriodStart) return null;
  const refDate = new Date(lastPeriodStart + 'T00:00:00');
  return phaseFromReference(targetDate, refDate, cycleLength, false);
}

export { PHASES as CYCLE_PHASES };

const WEEK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * When cycle tracking is enabled, override energy_patterns so the scheduler
 * sees a single flat energy block per day matching the current cycle phase energy.
 * Falls back to the stored energy_patterns when cycle is disabled or not configured.
 */
// ─── Topological sort ────────────────────────────────────────────────────────

/**
 * Return tasks ordered so every dependency appears before the task that
 * depends on it.  Only edges within the supplied task set are considered;
 * external dependencies (tasks from other projects) are ignored.
 * Tasks at the same dependency depth are ordered by priority descending.
 */
function topoSort(tasks: Task[]): Task[] {
  const taskSet = new Set(tasks.map(t => t.id));

  // adjacency: dep → [tasks that wait for dep]
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const t of tasks) {
    inDeg.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const t of tasks) {
    const localDeps = (t.dependencies ?? []).filter(d => taskSet.has(d));
    inDeg.set(t.id, localDeps.length);
    for (const dep of localDeps) {
      adj.get(dep)!.push(t.id);
    }
  }

  // Start with all tasks that have no local dependencies
  const queue = tasks.filter(t => (inDeg.get(t.id) ?? 0) === 0)
    .sort((a, b) => b.priority - a.priority);

  const result: Task[] = [];
  const processed = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => b.priority - a.priority);
    const t = queue.shift()!;
    result.push(t);
    processed.add(t.id);

    for (const waiterId of adj.get(t.id) ?? []) {
      const deg = (inDeg.get(waiterId) ?? 1) - 1;
      inDeg.set(waiterId, deg);
      if (deg === 0) {
        const waiterTask = tasks.find(x => x.id === waiterId);
        if (waiterTask) queue.push(waiterTask);
      }
    }
  }

  // Append any tasks not yet processed (cycle in deps — treat as independent)
  for (const t of tasks) {
    if (!processed.has(t.id)) result.push(t);
  }

  return result;
}

// ─── Distribution result ──────────────────────────────────────────────────────

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
  maxTasksPerDay = 5,
): TaskDistributionResult[] {
  const today = new Date(startDate);
  today.setHours(0, 0, 0, 0);
  const projectDeadline = new Date(deadlineDate);
  projectDeadline.setHours(0, 0, 0, 0);

  if (projectDeadline <= today || tasks.length === 0) return [];

  // ── Build the full calendar [today, projectDeadline] with cycle seasons ──────
  type DayEntry = { date: string; season: CycleSeason | null };
  const allDays: DayEntry[] = [];
  const cur = new Date(today);
  while (cur <= projectDeadline) {
    const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    let season: CycleSeason | null = null;
    if (prefs.cycle?.enabled) {
      const effectiveCycle =
        (!prefs.cycle.period_history || prefs.cycle.period_history.length === 0) && prefs.cycle.last_period_start
          ? { ...prefs.cycle, period_history: [prefs.cycle.last_period_start] }
          : prefs.cycle;
      season = getCyclePhaseForDate(cur, effectiveCycle)?.season ?? null;
    }
    allDays.push({ date: dateStr, season });
    cur.setDate(cur.getDate() + 1);
  }
  if (allDays.length === 0) return [];

  const projectDeadlineStr = allDays[allDays.length - 1].date;

  // ── 1. Topological sort: schedule dependencies before dependents ──────────────
  const sortedTasks = topoSort(tasks);
  const M = sortedTasks.length;

  // ── 2. Compute phase scores ───────────────────────────────────────────────────
  const phaseScoreMap = new Map<string, PhaseScores>(
    sortedTasks.map(t => [t.id, scoreTaskForPhases(t)])
  );

  // ── 3. Helpers ────────────────────────────────────────────────────────────────
  const dateCount = new Map<string, number>();
  // Track assigned date per task so dependents can use it as their earliest start
  const assignedDate = new Map<string, string>();

  // Get effective deadline for a single task: min(project deadline, task deadline)
  const effectiveDeadlineFor = (t: Task): string => {
    if (!t.deadline) return projectDeadlineStr;
    const td = t.deadline.split('T')[0];
    return td < projectDeadlineStr ? td : projectDeadlineStr;
  };

  // Earliest allowed date for a task = day AFTER the latest dependency's assigned date
  const earliestDateFor = (t: Task, todayStr: string): string => {
    let earliest = todayStr;
    for (const depId of (t.dependencies ?? [])) {
      const depDate = assignedDate.get(depId);
      if (!depDate) continue;
      // Dependent must be assigned AFTER its dependency
      const next = new Date(depDate + 'T00:00:00');
      next.setDate(next.getDate() + 1);
      const nextStr = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`;
      if (nextStr > earliest) earliest = nextStr;
    }
    return earliest;
  };

  // Find the best available day within a filtered window of allDays
  const findBestInWindow = (
    scores: PhaseScores,
    window: DayEntry[],
    idealPos: number,  // position within `window`
  ): { entry: DayEntry; phaseScore: number } | null => {
    const W = window.length;
    if (W === 0) return null;
    const clampedIdeal = Math.max(0, Math.min(W - 1, idealPos));

    let bestScore = -Infinity;
    let bestEntry: DayEntry | null = null;
    let bestPhaseScore = 0;

    for (let radius = 0; radius <= W; radius++) {
      const candidates = radius === 0 ? [clampedIdeal] : [clampedIdeal - radius, clampedIdeal + radius];
      for (const idx of candidates) {
        if (idx < 0 || idx >= W) continue;
        const entry = window[idx];
        const cap = dateCount.get(entry.date) ?? 0;
        if (cap >= maxTasksPerDay) continue;

        const phaseMatch = entry.season !== null ? (scores[entry.season] ?? 0) : 0;
        const score = phaseMatch - radius * 2 + (maxTasksPerDay - cap) * 3;

        if (score > bestScore) {
          bestScore = score;
          bestEntry = entry;
          bestPhaseScore = phaseMatch;
        }
      }
      if (bestEntry !== null && radius >= Math.max(1, Math.ceil(W / M))) break;
    }

    return bestEntry ? { entry: bestEntry, phaseScore: bestPhaseScore } : null;
  };

  // ── 4. Assign each task in dependency order ───────────────────────────────────
  const todayStr = allDays[0].date;
  const result: TaskDistributionResult[] = [];

  for (let orderPos = 0; orderPos < M; orderPos++) {
    const task = sortedTasks[orderPos];
    const scores = phaseScoreMap.get(task.id) ?? scoreTaskForPhases(task);

    const earliest  = earliestDateFor(task, todayStr);
    const effective = effectiveDeadlineFor(task);

    // Build the valid window for this task
    const window = allDays.filter(d => d.date >= earliest && d.date <= effective);

    // Ideal position within the window, proportional to this task's position in the sorted list
    const idealPos = window.length > 1
      ? Math.round(orderPos * (window.length - 1) / Math.max(M - 1, 1))
      : 0;

    const best = findBestInWindow(scores, window, idealPos);

    const chosen = best?.entry ?? window.at(-1) ?? allDays.at(-1)!;
    dateCount.set(chosen.date, (dateCount.get(chosen.date) ?? 0) + 1);
    assignedDate.set(task.id, chosen.date);

    result.push({
      taskId: task.id,
      scheduledFor: chosen.date,
      season: chosen.season ?? 'any',
      phaseScore: Math.round(best?.phaseScore ?? 0),
    });
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
