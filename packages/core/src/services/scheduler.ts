import {
  Task,
  Schedule,
  ScheduledTask,
  UserPreferences,
  createSchedule,
  createDefaultScheduleConstraints,
  createDefaultScheduleSummary,
  TimeSlot,
} from '../models';
import {
  timeToMinutes,
  minutesToTime,
  getAvailableSlots,
  getDayName,
  toISODateString,
  parseISODate,
  isSameDay,
  today,
} from '../utils/date-utils';

export interface SchedulerConfig {
  preferences: UserPreferences;
  currentTime?: Date;
}

export interface ScheduleGenerationOptions {
  targetDate: string;  // ISO date string
  tasks: Task[];
  existingSchedule: Schedule | null;
  force?: boolean;
  previouslyScheduledIds?: Set<string>;  // Tasks already scheduled on previous days
}

interface HabitCandidate {
  habit: Task;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  duration: number;
}

interface PinnedTaskCandidate {
  task: Task;
  startTime: string;
  endTime: string;
  startMinutes: number;
  endMinutes: number;
  duration: number;
}

interface TaskScore {
  task: Task;
  score: number;
}

export class Scheduler {
  private preferences: UserPreferences;
  private currentTime: Date;

  constructor(config: SchedulerConfig) {
    this.preferences = config.preferences;
    this.currentTime = config.currentTime ?? new Date();
  }

  /**
   * Generate schedule for a specific date
   */
  generateSchedule(options: ScheduleGenerationOptions): Schedule {
    const { targetDate, tasks, existingSchedule, force = false, previouslyScheduledIds = new Set() } = options;
    const targetDateObj = parseISODate(targetDate);

    console.log('[Scheduler] Generating schedule for:', targetDate);
    console.log('[Scheduler] Total tasks:', tasks.length, 'Previously scheduled:', previouslyScheduledIds.size);
    console.log('[Scheduler] Force:', force, 'Existing schedule:', !!existingSchedule);

    // Return existing schedule if not forcing regeneration
    if (existingSchedule && !force) {
      console.log('[Scheduler] Returning existing schedule for', targetDate, '(not regenerating - use force:true to regenerate)');
      return existingSchedule;
    }
    console.log('[Scheduler] REGENERATING schedule for', targetDate, '(force:', force, ')');

    // Filter tasks
    const habits = tasks.filter(t =>
      t.is_habit &&
      !this.isHabitPaused(t, targetDateObj)
    );
    console.log('[Scheduler] Habits (not paused):', habits.length, habits.map(h => h.title));

    const regularTasks = tasks.filter(t =>
      !t.is_habit &&
      !this.isTaskPaused(t, targetDateObj) &&
      (t.status === 'todo' || t.status === 'in_progress')
    );
    console.log('[Scheduler] Regular tasks:', regularTasks.length);

    // DEBUG: Log ALL regular tasks with their pinned properties
    console.log('[Scheduler] All regular tasks with pinned info:',
      regularTasks.map(t => ({
        title: t.title,
        is_pinned: t.is_pinned,
        pin_type: t.pin_type,
        scheduled_for: t.scheduled_for,
        // Check the actual type of these values
        is_pinned_type: typeof t.is_pinned,
        pin_type_type: typeof t.pin_type,
      })));

    // DEBUG: Log hard-pinned tasks info
    const hardPinnedInRegular = regularTasks.filter(t => t.is_pinned && t.pin_type === 'hard' && t.scheduled_for);
    console.log('[Scheduler] Hard-pinned tasks in regular tasks:', hardPinnedInRegular.length,
      hardPinnedInRegular.map(t => ({ title: t.title, is_pinned: t.is_pinned, pin_type: t.pin_type, scheduled_for: t.scheduled_for })));

    // Build task map for dependency resolution
    const allTasksMap = new Map<string, Task>();
    for (const task of tasks) {
      allTasksMap.set(task.id, task);
    }

    return this.doGenerateSchedule(
      targetDateObj,
      habits,
      regularTasks,
      allTasksMap,
      previouslyScheduledIds,
      existingSchedule?.completed_tasks ?? []
    );
  }

  /**
   * Core scheduling logic
   */
  private doGenerateSchedule(
    targetDate: Date,
    habits: Task[],
    regularTasks: Task[],
    allTasksMap: Map<string, Task>,
    previouslyScheduledIds: Set<string>,
    preserveCompletedTasks: string[]
  ): Schedule {
    const targetDateStr = toISODateString(targetDate);

    // DEBUG: Log the actual preference values being used
    console.log('[Scheduler] Preferences being used:', {
      min_duration: this.preferences.task_defaults?.min_duration,
      max_deep_work_stretch: this.preferences.scheduling_preferences?.max_deep_work_stretch,
      task_defaults: this.preferences.task_defaults,
      scheduling_preferences: this.preferences.scheduling_preferences,
    });

    // Get work hours for this day
    let { workStart, workEnd } = this.getWorkHoursForDate(targetDate);

    // If scheduling today and current time is past work start, adjust
    if (isSameDay(targetDate, this.currentTime)) {
      const currentMinutes = this.currentTime.getHours() * 60 + this.currentTime.getMinutes();
      const workStartMinutes = timeToMinutes(workStart);

      if (currentMinutes > workStartMinutes) {
        // Round up to next 15-minute interval
        const roundedMinutes = Math.ceil(currentMinutes / 15) * 15;
        workStart = minutesToTime(roundedMinutes);
      }
    }

    // Build blocked slots from habits and hard-pinned tasks
    const blockedSlots: Array<[string, string]> = [];
    const fixedScheduledTasks: ScheduledTask[] = [];
    const flexibleHabits: Task[] = [];
    const habitCandidates: HabitCandidate[] = [];
    const pinnedCandidates: PinnedTaskCandidate[] = [];
    const hardPinnedTaskIds = new Set<string>();

    // Collect hard-pinned tasks scheduled for this date
    for (const task of regularTasks) {
      if (task.is_pinned && task.pin_type === 'hard' && task.scheduled_for) {
        // Check if scheduled_for date matches target date
        const scheduledDate = task.scheduled_for.split('T')[0];
        if (scheduledDate === targetDateStr) {
          // Extract time from scheduled_for (format: "2025-01-15T10:00:00" or "2025-01-15T10:00")
          const timePart = task.scheduled_for.split('T')[1];
          if (timePart) {
            const startTime = timePart.substring(0, 5); // "HH:MM"
            const startMinutes = timeToMinutes(startTime);
            const duration = task.estimated_minutes;
            const endMinutes = startMinutes + duration;
            const endTime = minutesToTime(endMinutes);

            pinnedCandidates.push({
              task,
              startTime,
              endTime,
              startMinutes,
              endMinutes,
              duration,
            });
            hardPinnedTaskIds.add(task.id);
          }
        }
      }
    }

    console.log('[Scheduler] Hard-pinned tasks:', pinnedCandidates.length, pinnedCandidates.map(p => p.task.title));

    // Collect habit time slots
    for (const habit of habits) {
      const occursToday = this.habitOccursOnDate(habit, targetDate);
      console.log('[Scheduler] Habit', habit.title, 'occurs on', getDayName(targetDate), '?', occursToday, 'recurrence:', habit.recurrence);
      if (occursToday) {
        const habitTime = this.getHabitTime(habit);
        if (habitTime) {
          const [startTime, duration] = habitTime;
          const startMinutes = timeToMinutes(startTime);
          const endMinutes = startMinutes + duration;
          const endTime = minutesToTime(endMinutes);

          habitCandidates.push({
            habit,
            startTime,
            endTime,
            startMinutes,
            endMinutes,
            duration,
          });
        } else {
          // Habit without time_of_day - schedule flexibly
          flexibleHabits.push(habit);
        }
      }
    }

    // Sort by start time, then by priority
    habitCandidates.sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }
      return a.habit.priority - b.habit.priority;
    });

    // Detect and resolve overlaps
    const scheduledHabitRanges: Array<[number, number, string]> = [];

    for (const hc of habitCandidates) {
      let hasOverlap = false;

      for (const [scheduledStart, scheduledEnd] of scheduledHabitRanges) {
        if (hc.startMinutes < scheduledEnd && hc.endMinutes > scheduledStart) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        continue; // Skip overlapping habit
      }

      blockedSlots.push([hc.startTime, hc.endTime]);
      fixedScheduledTasks.push({
        task_id: hc.habit.id,
        start_time: hc.startTime,
        end_time: hc.endTime,
        estimated_minutes: hc.duration,
        is_buffer: false,
        auto_scheduled: true,
      });
      scheduledHabitRanges.push([hc.startMinutes, hc.endMinutes, hc.habit.title]);
    }

    // Sort hard-pinned tasks by start time
    pinnedCandidates.sort((a, b) => a.startMinutes - b.startMinutes);

    // Add hard-pinned tasks to blocked slots (they take priority, similar to habits)
    for (const pc of pinnedCandidates) {
      // Check for overlap with already scheduled ranges
      let hasOverlap = false;
      for (const [scheduledStart, scheduledEnd] of scheduledHabitRanges) {
        if (pc.startMinutes < scheduledEnd && pc.endMinutes > scheduledStart) {
          hasOverlap = true;
          console.log('[Scheduler] Hard-pinned task', pc.task.title, 'overlaps with existing slot');
          break;
        }
      }

      if (!hasOverlap) {
        blockedSlots.push([pc.startTime, pc.endTime]);
        fixedScheduledTasks.push({
          task_id: pc.task.id,
          start_time: pc.startTime,
          end_time: pc.endTime,
          estimated_minutes: pc.duration,
          is_buffer: false,
          auto_scheduled: false, // Not auto-scheduled, user pinned it
        });
        scheduledHabitRanges.push([pc.startMinutes, pc.endMinutes, pc.task.title]);
      }
    }

    // Get available slots after blocking habits and hard-pinned tasks
    let availableSlots = getAvailableSlots(
      workStart,
      workEnd,
      blockedSlots,
      this.preferences.task_defaults?.min_duration ?? 15
    );

    // For today's schedule, filter out time slots that have already passed
    if (isSameDay(targetDate, this.currentTime)) {
      const currentMinutes = this.currentTime.getHours() * 60 + this.currentTime.getMinutes();
      const workEndMinutes = timeToMinutes(workEnd);
      const workStartMinutes = timeToMinutes(workStart);

      // Check if this is an overnight schedule (workEnd <= original workStart)
      // Note: workStart may have been adjusted to current time, so we check workEnd vs current
      const isOvernightSchedule = workEndMinutes < 720 && workStartMinutes >= 720;

      availableSlots = availableSlots.filter(([slotStart, slotEnd]) => {
        if (isOvernightSchedule) {
          // For overnight schedules:
          // - Period 1 slots have start >= workStart (evening, e.g., >= 780)
          // - Period 2 slots have end <= workEnd (early morning, e.g., <= 240)
          const isPeriod2Slot = slotEnd <= workEndMinutes && slotStart < 720;

          if (currentMinutes >= workStartMinutes) {
            // We're in Period 1 (evening): filter out Period 2 slots (they're in the past)
            return !isPeriod2Slot;
          } else if (currentMinutes < workEndMinutes) {
            // We're in Period 2 (early morning): keep Period 2 slots that haven't ended
            return isPeriod2Slot && slotEnd > currentMinutes;
          }
        }
        // Normal schedule or in-between time: keep slots that end after current time
        return slotEnd > currentMinutes;
      });
    }

    // Schedule flexible habits first, then regular tasks
    // IMPORTANT: Exclude ALL hard-pinned tasks from flexible scheduling, not just those for today
    // Hard-pinned tasks should ONLY appear on their scheduled date at their scheduled time
    // Also exclude tasks below minimum duration or above maximum duration setting
    const minDuration = this.preferences.task_defaults?.min_duration ?? 15;
    const maxDuration = this.preferences.scheduling_preferences?.max_deep_work_stretch ?? 120;
    const flexibleRegularTasks = regularTasks.filter(t =>
      !(t.is_pinned && t.pin_type === 'hard' && t.scheduled_for) &&
      t.estimated_minutes >= minDuration &&
      t.estimated_minutes <= maxDuration
    );

    // DEBUG: Log filtering results
    const excludedHardPinned = regularTasks.filter(t => t.is_pinned && t.pin_type === 'hard' && t.scheduled_for);
    const excludedTooShort = regularTasks.filter(t => t.estimated_minutes < minDuration);
    const excludedTooLong = regularTasks.filter(t => t.estimated_minutes > maxDuration);
    console.log('[Scheduler] Filtering for', targetDateStr, '- minDuration:', minDuration, 'maxDuration:', maxDuration);
    console.log('[Scheduler] Filtering for', targetDateStr, '- Excluding hard-pinned:', excludedHardPinned.length,
      excludedHardPinned.map(t => t.title));
    console.log('[Scheduler] Filtering for', targetDateStr, '- Excluding too short (<' + minDuration + 'min):', excludedTooShort.length,
      excludedTooShort.map(t => `${t.title} (${t.estimated_minutes}min)`));
    console.log('[Scheduler] Filtering for', targetDateStr, '- Excluding too long (>' + maxDuration + 'min):', excludedTooLong.length,
      excludedTooLong.map(t => `${t.title} (${t.estimated_minutes}min)`));
    console.log('[Scheduler] Flexible regular tasks to schedule:', flexibleRegularTasks.length,
      flexibleRegularTasks.map(t => t.title));

    // Note: Habits are NOT filtered by minimum duration - they can be short (e.g., 5-min daily check-in)
    // Only regular tasks are filtered by min_duration
    const tasksToSchedule = [...flexibleHabits, ...flexibleRegularTasks];
    const scheduledTasks = this.scheduleTasksInSlots(
      tasksToSchedule,
      availableSlots,
      targetDate,
      allTasksMap,
      previouslyScheduledIds
    );

    // Combine and sort by time
    const allScheduled = [...fixedScheduledTasks, ...scheduledTasks];
    allScheduled.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

    // Calculate summary
    const totalMinutes = allScheduled
      .filter(t => !t.is_buffer)
      .reduce((sum, t) => sum + t.estimated_minutes, 0);

    // Count tasks (excluding buffers/breaks)
    const allTaskIds = allScheduled.filter(t => !t.is_buffer).map(t => t.task_id);
    const completedTaskIds = new Set(preserveCompletedTasks);
    const tasksCompleted = allTaskIds.filter(id => completedTaskIds.has(id)).length;
    const tasksRemaining = allTaskIds.length - tasksCompleted;
    const completionRate = allTaskIds.length > 0 ? (tasksCompleted / allTaskIds.length) * 100 : 0;

    const schedule: Schedule = {
      date: targetDateStr,
      user_id: this.preferences.user_id,
      constraints: {
        work_start: workStart,
        work_end: workEnd,
        blocked_slots: blockedSlots.map(([start, end]) => ({
          start,
          end,
          label: 'Habit',
        })),
        preferences: this.preferences.scheduling_preferences as any,
      },
      scheduled_tasks: allScheduled,
      completed_tasks: preserveCompletedTasks,
      summary: {
        total_scheduled_minutes: totalMinutes,
        total_completed_minutes: 0,
        completion_rate: completionRate,
        tasks_completed: tasksCompleted,
        tasks_remaining: tasksRemaining,
        tasks_behind_schedule: 0,
      },
      generated_at: new Date().toISOString(),
      last_rescheduled_at: null,
    };

    return schedule;
  }

  /**
   * Schedule tasks into available slots
   */
  private scheduleTasksInSlots(
    tasks: Task[],
    availableSlots: Array<[number, number]>,
    targetDate: Date,
    allTasksMap: Map<string, Task>,
    previouslyScheduledIds: Set<string>
  ): ScheduledTask[] {
    const scheduledTasks: ScheduledTask[] = [];
    const scheduledTaskIds = new Set<string>();
    const maxDeepWork = this.preferences.scheduling_preferences?.max_deep_work_stretch ?? 120;
    const energyBonus = this.preferences.scheduling_preferences?.energy_match_bonus ?? 0.15;

    for (const [slotStart, slotEnd] of availableSlots) {
      let currentTime = slotStart;
      let continuousWork = 0;

      while (currentTime < slotEnd) {
        // Get available tasks (not yet scheduled today AND not scheduled on previous days)
        // Note: Habits (is_habit=true) can repeat daily, so don't exclude them
        const availableTasks = tasks.filter(t =>
          !scheduledTaskIds.has(t.id) &&
          (t.is_habit || !previouslyScheduledIds.has(t.id))
        );
        if (availableTasks.length === 0) break;

        // Score tasks for this time slot
        const scoredTasks = this.scoreTasksForTime(
          availableTasks,
          targetDate,
          currentTime,
          energyBonus
        );

        let taskScheduled = false;

        for (const { task, score } of scoredTasks) {
          const taskDuration = task.estimated_minutes;
          const remaining = slotEnd - currentTime;

          if (taskDuration > remaining) continue; // Doesn't fit

          // Check if we need a break
          if (continuousWork > 0 && continuousWork + taskDuration > maxDeepWork) {
            const breakDuration = 15;
            if (currentTime + breakDuration <= slotEnd) {
              scheduledTasks.push({
                task_id: '',
                start_time: minutesToTime(currentTime),
                end_time: minutesToTime(currentTime + breakDuration),
                estimated_minutes: breakDuration,
                is_buffer: true,
                auto_scheduled: true,
              });
              currentTime += breakDuration;
              continuousWork = 0;

              if (taskDuration > slotEnd - currentTime) continue;
            }
          }

          // Check dependencies
          if (!this.dependenciesMet(task, scheduledTasks, allTasksMap, previouslyScheduledIds)) {
            continue;
          }

          // Schedule the task
          const taskEnd = currentTime + taskDuration;
          scheduledTasks.push({
            task_id: task.id,
            start_time: minutesToTime(currentTime),
            end_time: minutesToTime(taskEnd),
            estimated_minutes: taskDuration,
            is_buffer: false,
            auto_scheduled: true,
          });
          scheduledTaskIds.add(task.id);

          currentTime = taskEnd;
          continuousWork += taskDuration;
          taskScheduled = true;

          // Force break if needed
          if (continuousWork >= maxDeepWork) {
            const breakDuration = 15;
            if (currentTime + breakDuration <= slotEnd) {
              scheduledTasks.push({
                task_id: '',
                start_time: minutesToTime(currentTime),
                end_time: minutesToTime(currentTime + breakDuration),
                estimated_minutes: breakDuration,
                is_buffer: true,
                auto_scheduled: true,
              });
              currentTime += breakDuration;
              continuousWork = 0;
            }
          }

          break;
        }

        if (!taskScheduled) break;
      }
    }

    return scheduledTasks;
  }

  /**
   * Score tasks for a specific time slot with energy matching
   */
  private scoreTasksForTime(
    tasks: Task[],
    targetDate: Date,
    timeMinutes: number,
    energyBonus: number
  ): TaskScore[] {
    const currentEnergy = this.getEnergyLevelAtTime(targetDate, timeMinutes);
    const scored: TaskScore[] = [];
    const targetDateStr = toISODateString(targetDate);

    for (const task of tasks) {
      let score = 0;

      // Priority (35%)
      score += (6 - task.priority) * 0.35;

      // Deadline urgency (35%)
      if (task.deadline) {
        const deadlineDate = parseISODate(task.deadline.split('T')[0]);
        const daysUntil = Math.floor((deadlineDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntil < 0) {
          score += 1.0 * 0.35; // Overdue
        } else if (daysUntil === 0) {
          score += 0.95 * 0.35; // Due today
        } else if (daysUntil <= 3) {
          score += 0.7 * 0.35; // Due soon
        } else {
          score += 0.3 * 0.35; // Future
        }
      } else {
        score += 0.2 * 0.35; // No deadline
      }

      // Energy matching (15%)
      if (currentEnergy && this.preferences.scheduling_preferences.respect_energy_patterns) {
        const taskEnergy = task.energy_level || 'medium';
        if (taskEnergy === currentEnergy) {
          score += energyBonus;
        } else if (
          (currentEnergy === 'high' && taskEnergy === 'medium') ||
          (currentEnergy === 'medium' && (taskEnergy === 'high' || taskEnergy === 'low')) ||
          (currentEnergy === 'low' && taskEnergy === 'medium')
        ) {
          score += energyBonus * 0.5;
        }
      }

      // Duration (15%) - prefer shorter tasks
      if (task.estimated_minutes <= 30) {
        score += 0.15;
      } else if (task.estimated_minutes <= 90) {
        score += 0.10;
      } else {
        score += 0.05;
      }

      scored.push({ task, score });
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    return scored;
  }

  /**
   * Check if all dependencies are met
   */
  private dependenciesMet(
    task: Task,
    scheduledTasks: ScheduledTask[],
    allTasksMap: Map<string, Task>,
    previouslyScheduledIds: Set<string>
  ): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }

    const scheduledIds = new Set<string>([
      ...scheduledTasks.map(st => st.task_id),
      ...previouslyScheduledIds,
    ]);

    for (const depId of task.dependencies) {
      if (scheduledIds.has(depId)) continue;

      // Check if dependency is completed or doesn't exist in active tasks
      // (if not in map, it means it was filtered out - likely completed)
      const depTask = allTasksMap.get(depId);
      if (!depTask || depTask.status === 'completed') continue;

      // Dependency not met
      return false;
    }

    return true;
  }

  /**
   * Check if habit is paused for the given date
   */
  private isHabitPaused(habit: Task, targetDate: Date): boolean {
    if (!habit.is_paused) return false;
    if (!habit.paused_until) return true;

    const pausedUntil = parseISODate(habit.paused_until);
    return targetDate <= pausedUntil;
  }

  /**
   * Check if task is paused for the given date
   */
  private isTaskPaused(task: Task, targetDate: Date): boolean {
    if (!task.is_paused) return false;
    if (!task.paused_until) return true;

    const pausedUntil = parseISODate(task.paused_until);
    return targetDate <= pausedUntil;
  }

  /**
   * Check if habit occurs on the given date
   */
  private habitOccursOnDate(habit: Task, targetDate: Date): boolean {
    if (!habit.recurrence || !habit.recurrence.frequency) {
      return false;
    }

    // Check end date
    if (habit.recurrence.end_date) {
      const endDate = parseISODate(habit.recurrence.end_date);
      if (targetDate > endDate) return false;
    }

    const dayName = getDayName(targetDate);

    if (habit.recurrence.frequency === 'daily') {
      return true;
    } else if (habit.recurrence.frequency === 'weekly') {
      return habit.recurrence.days_of_week
        .map(d => d.toLowerCase())
        .includes(dayName);
    }

    return false;
  }

  /**
   * Get habit scheduled time
   */
  private getHabitTime(habit: Task): [string, number] | null {
    if (!habit.recurrence || !habit.recurrence.time_of_day) {
      return null;
    }
    return [habit.recurrence.time_of_day, habit.estimated_minutes];
  }

  /**
   * Get work hours for a specific date
   */
  private getWorkHoursForDate(targetDate: Date): { workStart: string; workEnd: string } {
    const dayName = getDayName(targetDate);
    const dayHours = this.preferences.work_hours[dayName] ?? { start: '08:00', end: '22:00' };
    return { workStart: dayHours.start, workEnd: dayHours.end };
  }

  /**
   * Get energy level at a specific time (handles overnight blocks)
   */
  private getEnergyLevelAtTime(targetDate: Date, timeMinutes: number): string | null {
    const dayName = getDayName(targetDate);
    const patterns = this.preferences.energy_patterns[dayName] ?? [];

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

  /**
   * Reschedule incomplete tasks
   */
  reschedule(options: ScheduleGenerationOptions): Schedule {
    return this.generateSchedule({ ...options, force: true });
  }
}
