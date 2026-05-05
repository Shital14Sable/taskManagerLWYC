import { Task, Schedule, Project } from '../models';
import { parseISODate, toISODateString, daysBetween } from '../utils/date-utils';

export interface ProductivityMetrics {
  tasksCompleted: number;
  tasksCompletedThisWeek: number;
  averageCompletionRate: number;
  estimationAccuracy: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
}

export interface BurnoutAssessment {
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  recommendations: string[];
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  tasksCompleted: number;
  habitsCompleted: number;
  totalTimeSpent: number;
  averageEstimationAccuracy: number;
  topProjects: Array<{ projectId: string; name: string; tasksCompleted: number }>;
  dailyBreakdown: Array<{
    date: string;
    tasksCompleted: number;
    scheduledMinutes: number;
    completedMinutes: number;
  }>;
}

export interface TaskStats {
  byStatus: Record<string, number>;
  byPriority: Record<number, number>;
  byProject: Record<string, number>;
  overdueCount: number;
  upcomingDeadlines: number;
}

export class AnalyticsService {
  /**
   * Get productivity metrics for a date range
   */
  getProductivityMetrics(
    tasks: Task[],
    schedules: Schedule[],
    dateRange: { start: string; end: string }
  ): ProductivityMetrics {
    const startDate = parseISODate(dateRange.start);
    const endDate = parseISODate(dateRange.end);

    // Filter completed tasks in range
    const completedTasks = tasks.filter(t => {
      if (t.status !== 'completed' || !t.completed_at) return false;
      const completedDate = parseISODate(t.completed_at.split('T')[0]);
      return completedDate >= startDate && completedDate <= endDate;
    });

    // Calculate week tasks
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const tasksCompletedThisWeek = completedTasks.filter(t => {
      const completedDate = parseISODate(t.completed_at!.split('T')[0]);
      return completedDate >= weekStart;
    }).length;

    // Calculate completion rate from schedules
    let totalScheduled = 0;
    let totalCompleted = 0;
    for (const schedule of schedules) {
      totalScheduled += (schedule.scheduled_tasks || []).filter(st => !st.is_buffer).length;
      totalCompleted += (schedule.completed_tasks || []).length;
    }
    const averageCompletionRate = totalScheduled > 0
      ? (totalCompleted / totalScheduled) * 100
      : 0;

    // Calculate estimation accuracy
    const estimationAccuracy = this.getEstimationAccuracy(completedTasks);

    // Find most productive day/hour
    const dayCount: Record<string, number> = {};
    const hourCount: Record<number, number> = {};

    for (const task of completedTasks) {
      if (task.completed_at) {
        const date = new Date(task.completed_at);
        const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
        dayCount[dayName] = (dayCount[dayName] || 0) + 1;
        hourCount[date.getHours()] = (hourCount[date.getHours()] || 0) + 1;
      }
    }

    const mostProductiveDay = Object.entries(dayCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Monday';
    const mostProductiveHour = Object.entries(hourCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 9;

    return {
      tasksCompleted: completedTasks.length,
      tasksCompletedThisWeek,
      averageCompletionRate,
      estimationAccuracy,
      mostProductiveDay,
      mostProductiveHour: Number(mostProductiveHour),
    };
  }

  /**
   * Assess burnout risk
   */
  assessBurnoutRisk(
    recentTasks: Task[],
    recentSchedules: Schedule[]
  ): BurnoutAssessment {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let riskScore = 0;

    // Check for high workload
    const totalScheduledMinutes = recentSchedules.reduce((sum, s) =>
      sum + s.summary.total_scheduled_minutes, 0
    );
    const avgDailyMinutes = totalScheduledMinutes / Math.max(recentSchedules.length, 1);

    if (avgDailyMinutes > 480) { // More than 8 hours
      factors.push('High daily workload (8+ hours scheduled)');
      recommendations.push('Consider reducing daily commitments');
      riskScore += 2;
    } else if (avgDailyMinutes > 360) { // More than 6 hours
      factors.push('Moderate daily workload');
      riskScore += 1;
    }

    // Check for low completion rate
    const avgCompletionRate = recentSchedules.reduce((sum, s) =>
      sum + s.summary.completion_rate, 0
    ) / Math.max(recentSchedules.length, 1);

    if (avgCompletionRate < 50) {
      factors.push('Low task completion rate');
      recommendations.push('Review and prioritize your task list');
      riskScore += 2;
    } else if (avgCompletionRate < 70) {
      factors.push('Moderate completion rate');
      riskScore += 1;
    }

    // Check for many high-priority tasks
    const highPriorityCount = recentTasks.filter(t =>
      t.priority <= 2 && (t.status === 'todo' || t.status === 'in_progress')
    ).length;

    if (highPriorityCount > 10) {
      factors.push('Many high-priority tasks pending');
      recommendations.push('Delegate or reschedule some high-priority items');
      riskScore += 2;
    }

    // Check for overdue tasks
    const now = new Date();
    const overdueCount = recentTasks.filter(t =>
      t.deadline &&
      parseISODate(t.deadline.split('T')[0]) < now &&
      t.status !== 'completed'
    ).length;

    if (overdueCount > 5) {
      factors.push('Multiple overdue tasks');
      recommendations.push('Address overdue items or adjust deadlines');
      riskScore += 2;
    }

    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore >= 5) {
      riskLevel = 'high';
      recommendations.push('Consider taking a break and reassessing priorities');
    } else if (riskScore >= 3) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'low';
    }

    if (recommendations.length === 0) {
      recommendations.push('Workload appears manageable - keep it up!');
    }

    return { riskLevel, factors, recommendations };
  }

  /**
   * Get estimation accuracy for completed tasks
   */
  getEstimationAccuracy(completedTasks: Task[]): number {
    const tasksWithActual = completedTasks.filter(t =>
      t.actual_minutes !== null && t.actual_minutes !== undefined
    );

    if (tasksWithActual.length === 0) return 0;

    let accuracySum = 0;
    for (const task of tasksWithActual) {
      const ratio = task.actual_minutes! / task.estimated_minutes;
      // Calculate accuracy as percentage within range
      const accuracy = ratio <= 1
        ? 100
        : Math.max(0, 100 - ((ratio - 1) * 100));
      accuracySum += accuracy;
    }

    return accuracySum / tasksWithActual.length;
  }

  /**
   * Generate weekly report
   */
  generateWeeklyReport(
    tasks: Task[],
    schedules: Schedule[],
    projects: Project[],
    weekStart: string
  ): WeeklyReport {
    const startDate = parseISODate(weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const projectMap = new Map(projects.map(p => [p.id, p.name]));

    // Filter tasks completed this week
    const weekTasks = tasks.filter(t => {
      if (t.status !== 'completed' || !t.completed_at) return false;
      const completedDate = parseISODate(t.completed_at.split('T')[0]);
      return completedDate >= startDate && completedDate <= endDate;
    });

    const tasksCompleted = weekTasks.filter(t => !t.is_habit).length;
    const habitsCompleted = weekTasks.filter(t => t.is_habit).length;

    const totalTimeSpent = weekTasks.reduce((sum, t) =>
      sum + (t.actual_minutes ?? t.estimated_minutes), 0
    );

    // Project breakdown
    const projectCounts: Record<string, number> = {};
    for (const task of weekTasks) {
      if (!task.is_habit && task.project_id) {
        projectCounts[task.project_id] = (projectCounts[task.project_id] || 0) + 1;
      }
    }

    const topProjects = Object.entries(projectCounts)
      .map(([projectId, count]) => ({
        projectId,
        name: projectMap.get(projectId) ?? 'Unknown',
        tasksCompleted: count,
      }))
      .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
      .slice(0, 5);

    // Daily breakdown
    const dailyBreakdown: WeeklyReport['dailyBreakdown'] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = toISODateString(date);

      const daySchedule = schedules.find(s => s.date === dateStr);
      const dayTasks = weekTasks.filter(t =>
        t.completed_at?.startsWith(dateStr)
      );

      dailyBreakdown.push({
        date: dateStr,
        tasksCompleted: dayTasks.length,
        scheduledMinutes: daySchedule?.summary.total_scheduled_minutes ?? 0,
        completedMinutes: dayTasks.reduce((sum, t) =>
          sum + (t.actual_minutes ?? t.estimated_minutes), 0
        ),
      });
    }

    return {
      weekStart,
      weekEnd: toISODateString(endDate),
      tasksCompleted,
      habitsCompleted,
      totalTimeSpent,
      averageEstimationAccuracy: this.getEstimationAccuracy(weekTasks),
      topProjects,
      dailyBreakdown,
    };
  }

  /**
   * Get task statistics
   */
  getTaskStats(tasks: Task[]): TaskStats {
    const byStatus: Record<string, number> = {};
    const byPriority: Record<number, number> = {};
    const byProject: Record<string, number> = {};
    let overdueCount = 0;
    let upcomingDeadlines = 0;

    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    for (const task of tasks) {
      // By status
      byStatus[task.status] = (byStatus[task.status] || 0) + 1;

      // By priority
      byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;

      // By project
      if (task.project_id) {
        byProject[task.project_id] = (byProject[task.project_id] || 0) + 1;
      }

      // Overdue
      if (task.deadline && task.status !== 'completed') {
        const deadline = parseISODate(task.deadline.split('T')[0]);
        if (deadline < now) {
          overdueCount++;
        } else if (deadline <= nextWeek) {
          upcomingDeadlines++;
        }
      }
    }

    return {
      byStatus,
      byPriority,
      byProject,
      overdueCount,
      upcomingDeadlines,
    };
  }
}
