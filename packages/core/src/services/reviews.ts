import {
  Task,
  Goal,
  TaskList,
  Schedule,
  Review,
  ReviewType,
  ReviewContent,
  createReview,
  createDefaultReviewContent,
  getReviewPeriodKey,
} from '../models';
import { parseISODate, toISODateString, daysBetween } from '../utils/date-utils';

export interface ReviewGenerationOptions {
  reviewType: ReviewType;
  targetDate: Date;
  tasks: Task[];
  goals: Goal[];
  lists: TaskList[];
  schedules: Schedule[];
}

export class ReviewService {
  /**
   * Generate a review for the given period
   */
  generateReview(options: ReviewGenerationOptions): Review {
    const { reviewType, targetDate, tasks, goals, lists, schedules } = options;

    // Calculate period dates
    const { periodStart, periodEnd } = this.getPeriodDates(reviewType, targetDate);

    // Create base review
    const review = createReview(
      reviewType,
      toISODateString(targetDate),
      periodStart,
      periodEnd
    );

    // Generate content
    review.content = this.generateContent(options, periodStart, periodEnd);

    return review;
  }

  /**
   * Get period start and end dates based on review type
   */
  private getPeriodDates(
    reviewType: ReviewType,
    targetDate: Date
  ): { periodStart: string; periodEnd: string } {
    let periodStart: Date;
    let periodEnd: Date;

    switch (reviewType) {
      case 'daily':
        periodStart = targetDate;
        periodEnd = targetDate;
        break;

      case 'weekly':
        // Get start of week (Sunday)
        periodStart = new Date(targetDate);
        periodStart.setDate(targetDate.getDate() - targetDate.getDay());
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodStart.getDate() + 6);
        break;

      case 'monthly':
        periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
        periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0);
        break;

      default:
        periodStart = targetDate;
        periodEnd = targetDate;
    }

    return {
      periodStart: toISODateString(periodStart),
      periodEnd: toISODateString(periodEnd),
    };
  }

  /**
   * Generate review content
   */
  private generateContent(
    options: ReviewGenerationOptions,
    periodStart: string,
    periodEnd: string
  ): ReviewContent {
    const { tasks, goals, lists, schedules } = options;
    const content = createDefaultReviewContent();

    const startDate = parseISODate(periodStart);
    const endDate = parseISODate(periodEnd);

    // Task summary
    const completedTasks = tasks.filter(t => {
      if (t.status !== 'completed' || !t.completed_at || t.is_habit) return false;
      const completedDate = parseISODate(t.completed_at.split('T')[0]);
      return completedDate >= startDate && completedDate <= endDate;
    });

    content.tasks_completed = {
      completed_count: completedTasks.length,
      completed_tasks: completedTasks.map(t => ({
        id: t.id,
        title: t.title,
        completed_at: t.completed_at!,
      })),
      stale_count: 0,
      stale_tasks: [],
      upcoming_deadlines: [],
      total_time_spent: completedTasks.reduce(
        (sum, t) => sum + (t.actual_minutes ?? t.estimated_minutes),
        0
      ),
    };

    // Find stale tasks (not updated in 7+ days)
    const staleTasks = tasks.filter(t => {
      if (t.status === 'completed') return false;
      const lastUpdated = parseISODate(t.updated_at.split('T')[0]);
      return daysBetween(new Date(), lastUpdated) >= 7;
    });

    content.tasks_completed.stale_count = staleTasks.length;
    content.tasks_completed.stale_tasks = staleTasks.slice(0, 5).map(t => ({
      id: t.id,
      title: t.title,
      last_updated: t.updated_at,
    }));

    // Find upcoming deadlines
    const upcomingDeadlines = tasks.filter(t => {
      if (t.status === 'completed' || !t.deadline) return false;
      const deadline = parseISODate(t.deadline.split('T')[0]);
      const daysUntil = daysBetween(deadline, new Date());
      return daysUntil >= 0 && daysUntil <= 7;
    });

    content.tasks_completed.upcoming_deadlines = upcomingDeadlines.map(t => ({
      id: t.id,
      title: t.title,
      deadline: t.deadline!,
    }));

    // Goal progress
    content.goals_progress = goals
      .filter(g => g.status === 'active')
      .map(g => ({
        goal_id: g.id,
        title: g.title,
        progress: g.progress,
        status: g.status,
        linked_projects_count: g.linked_project_ids.length,
        tasks_completed_in_period: completedTasks.filter(t =>
          g.linked_project_ids.includes(t.project_id)
        ).length,
      }));

    // Habit summary
    const habits = tasks.filter(t => t.is_habit);
    const habitInstances = tasks.filter(t => {
      if (!t.is_habit || t.status !== 'completed' || !t.completed_at) return false;
      const completedDate = parseISODate(t.completed_at.split('T')[0]);
      return completedDate >= startDate && completedDate <= endDate;
    });

    content.habits_summary = habits.map(habit => {
      const instances = habitInstances.filter(t => t.id === habit.id);
      const scheduledCount = this.countScheduledInstances(habit, startDate, endDate);
      return {
        habit_id: habit.id,
        title: habit.title,
        scheduled_count: scheduledCount,
        completed_count: instances.length,
        completion_rate: scheduledCount > 0 ? (instances.length / scheduledCount) * 100 : 0,
        current_streak: 0, // Would need historical data
      };
    });

    // List summary
    content.lists_summary = lists
      .filter(l => !l.archived)
      .map(l => ({
        list_id: l.id,
        name: l.name,
        pending_count: l.items.filter(i => !i.completed_at).length,
        completed_count: l.items.filter(i => i.completed_at).length,
        recent_additions: l.items
          .filter(i => !i.completed_at)
          .slice(0, 3)
          .map(i => i.text),
      }));

    // Calculate productivity score
    content.productivity_score = this.calculateProductivityScore(content, schedules);

    // Generate highlights and areas for improvement
    content.highlights = this.generateHighlights(content);
    content.areas_for_improvement = this.generateAreasForImprovement(content);

    return content;
  }

  /**
   * Count scheduled instances for a habit in a period
   */
  private countScheduledInstances(habit: Task, startDate: Date, endDate: Date): number {
    if (!habit.recurrence || !habit.recurrence.frequency) return 0;

    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][current.getDay()];

      if (habit.recurrence.frequency === 'daily') {
        count++;
      } else if (habit.recurrence.frequency === 'weekly') {
        if (habit.recurrence.days_of_week.map(d => d.toLowerCase()).includes(dayName)) {
          count++;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  /**
   * Calculate productivity score
   */
  private calculateProductivityScore(content: ReviewContent, schedules: Schedule[]): number {
    let score = 50; // Base score

    // Task completion bonus (up to 25 points)
    if (content.tasks_completed.completed_count > 0) {
      score += Math.min(25, content.tasks_completed.completed_count * 2);
    }

    // Habit completion rate (up to 15 points)
    const avgHabitRate = content.habits_summary.length > 0
      ? content.habits_summary.reduce((sum, h) => sum + h.completion_rate, 0) / content.habits_summary.length
      : 0;
    score += avgHabitRate * 0.15;

    // Goal progress bonus (up to 10 points)
    const avgGoalProgress = content.goals_progress.length > 0
      ? content.goals_progress.reduce((sum, g) => sum + g.progress, 0) / content.goals_progress.length
      : 0;
    score += avgGoalProgress * 0.1;

    // Penalties
    if (content.tasks_completed.stale_count > 5) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Generate highlights
   */
  private generateHighlights(content: ReviewContent): string[] {
    const highlights: string[] = [];

    if (content.tasks_completed.completed_count >= 10) {
      highlights.push(`Completed ${content.tasks_completed.completed_count} tasks!`);
    }

    const highHabitRate = content.habits_summary.filter(h => h.completion_rate >= 80);
    if (highHabitRate.length > 0) {
      highlights.push(`${highHabitRate.length} habits with 80%+ completion rate`);
    }

    const progressingGoals = content.goals_progress.filter(g => g.tasks_completed_in_period > 0);
    if (progressingGoals.length > 0) {
      highlights.push(`Made progress on ${progressingGoals.length} goals`);
    }

    if (content.productivity_score >= 80) {
      highlights.push('Excellent productivity this period!');
    }

    return highlights;
  }

  /**
   * Generate areas for improvement
   */
  private generateAreasForImprovement(content: ReviewContent): string[] {
    const areas: string[] = [];

    if (content.tasks_completed.stale_count > 3) {
      areas.push(`${content.tasks_completed.stale_count} tasks haven't been updated in a week`);
    }

    const lowHabitRate = content.habits_summary.filter(h => h.completion_rate < 50);
    if (lowHabitRate.length > 0) {
      areas.push(`${lowHabitRate.length} habits below 50% completion`);
    }

    if (content.tasks_completed.upcoming_deadlines.length > 3) {
      areas.push(`${content.tasks_completed.upcoming_deadlines.length} tasks due this week`);
    }

    const stuckGoals = content.goals_progress.filter(g => g.tasks_completed_in_period === 0);
    if (stuckGoals.length > 0) {
      areas.push(`${stuckGoals.length} goals with no recent progress`);
    }

    return areas;
  }
}
