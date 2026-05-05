import { useMemo, useEffect, useState, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, Minus, CheckCircle2,
  Target, Clock, Briefcase, Calendar, RefreshCw,
  Flame, Award, BarChart3, ChevronDown, ChevronUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useApp } from '@/context/AppContext'
import { cn } from '@/lib/utils'
import { toISODateString, parseISO } from '@trackmind/core'
import type { Task, Project, Schedule, HabitInstance } from '@/types'

// Time period options
type TimePeriod = 'week' | 'month' | 'quarter' | 'year' | 'all'

const PERIOD_DAYS: Record<TimePeriod, number> = {
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
  all: 0, // 0 means all-time
}

const PERIOD_LABELS: Record<TimePeriod, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  all: 'All Time',
}

interface AnalyticsOverview {
  total_tasks: number
  completed_tasks: number
  completion_rate: number
  total_projects: number
  active_projects: number
  total_habits: number
  today_scheduled: number
  today_completed: number
}

interface ProjectStats {
  project_id: string
  name: string
  status: string
  total_tasks: number
  completed_tasks: number
  in_progress_tasks: number
  todo_tasks: number
  total_estimated_minutes: number
  actual_minutes: number
  completion_rate: number
  last_activity: string | null
}

interface DailyStats {
  date: string
  scheduled: number
  completed: number
  completion_rate: number
  habits_scheduled: number
  habits_completed: number
}

interface HabitAnalytics {
  total_habits: number
  total_completions: number
  avg_completion_rate: number
  current_best_streak: number
  habit_of_the_week: { name: string; completions: number } | null
  habits_detail: {
    id: string
    name: string
    completions: number
    scheduled: number
    completion_rate: number
    current_streak: number
  }[]
}

// Check if a habit is scheduled for a specific date
function isScheduledOnDate(recurrence: Task['recurrence'], dateStr: string): boolean {
  if (!recurrence) return false

  const date = parseISO(dateStr)
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase()

  if (recurrence.frequency === 'daily') return true
  if (recurrence.frequency === 'weekly') {
    const daysOfWeek = recurrence.days_of_week || []
    return daysOfWeek.some(d => d.toLowerCase().startsWith(dayOfWeek.substring(0, 2)))
  }
  return false
}

// Compute overview statistics for a specific period
function computeOverview(
  tasks: Task[],
  projects: Project[],
  schedules: Map<string, Schedule>,
  periodDays: number
): AnalyticsOverview {
  const today = new Date()
  const todayStr = toISODateString(today)
  const todaySchedule = schedules.get(todayStr)

  // Calculate cutoff date for period
  const cutoffDate = new Date(today)
  cutoffDate.setDate(cutoffDate.getDate() - periodDays)

  const nonHabitTasks = tasks.filter(t => !t.is_habit)
  const habits = tasks.filter(t => t.is_habit)

  // Filter completed tasks by period (only count tasks completed within the period)
  const completedInPeriod = nonHabitTasks.filter(t => {
    if (t.status !== 'completed') return false
    if (!t.completed_at) return false
    return new Date(t.completed_at) >= cutoffDate
  }).length

  // Count active (non-completed) tasks + tasks completed in period
  const activeTasks = nonHabitTasks.filter(t => t.status !== 'completed').length
  const periodTotalTasks = activeTasks + completedInPeriod

  const activeProjects = projects.filter(p => p.status === 'active').length

  let todayScheduled = 0
  let todayCompleted = 0

  if (todaySchedule?.scheduled_tasks) {
    for (const st of todaySchedule.scheduled_tasks) {
      if (!st.is_buffer) {
        todayScheduled++
        const task = tasks.find(t => t.id === st.task_id)
        if (todaySchedule.completed_tasks?.includes(st.task_id) || task?.status === 'completed') {
          todayCompleted++
        }
      }
    }
  }

  return {
    total_tasks: periodTotalTasks,
    completed_tasks: completedInPeriod,
    completion_rate: periodTotalTasks > 0 ? completedInPeriod / periodTotalTasks : 0,
    total_projects: projects.length,
    active_projects: activeProjects,
    total_habits: habits.length,
    today_scheduled: todayScheduled,
    today_completed: todayCompleted,
  }
}

// Compute enhanced project statistics for a specific period
function computeProjectStats(tasks: Task[], projects: Project[], period: TimePeriod): ProjectStats[] {
  const stats: ProjectStats[] = []
  const cutoffDate = period === 'all' ? null : new Date()
  if (cutoffDate && period !== 'all') {
    cutoffDate.setDate(cutoffDate.getDate() - PERIOD_DAYS[period])
  }

  for (const project of projects) {
    const projectTasks = tasks.filter(t => t.project_id === project.id && !t.is_habit)

    // Count tasks completed within the period
    const completedInPeriod = cutoffDate
      ? projectTasks.filter(t => {
          if (t.status !== 'completed') return false
          if (!t.completed_at) return false
          return new Date(t.completed_at) >= cutoffDate
        }).length
      : projectTasks.filter(t => t.status === 'completed').length

    // Current state counts (not period-filtered - these show current status)
    const inProgressTasks = projectTasks.filter(t => t.status === 'in_progress').length
    const todoTasks = projectTasks.filter(t => t.status === 'todo').length

    // Period-aware total: active tasks + completed in period
    const activeTasks = inProgressTasks + todoTasks
    const periodTotalTasks = activeTasks + completedInPeriod

    // Time estimates for period tasks
    const periodTasksForTime = cutoffDate
      ? projectTasks.filter(t => {
          const taskDate = t.completed_at || t.updated_at
          return taskDate && new Date(taskDate) >= cutoffDate
        })
      : projectTasks

    const totalMinutes = periodTasksForTime.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
    const actualMinutes = periodTasksForTime.reduce((sum, t) => sum + (t.actual_minutes || 0), 0)

    // Find last activity within period
    const lastActivity = projectTasks.reduce((latest, t) => {
      const date = t.completed_at || t.updated_at
      if (!date) return latest
      if (cutoffDate && new Date(date) < cutoffDate) return latest
      if (!latest) return date
      return new Date(date) > new Date(latest) ? date : latest
    }, null as string | null)

    stats.push({
      project_id: project.id,
      name: project.name,
      status: project.status,
      total_tasks: periodTotalTasks,
      completed_tasks: completedInPeriod,
      in_progress_tasks: inProgressTasks,
      todo_tasks: todoTasks,
      total_estimated_minutes: totalMinutes,
      actual_minutes: actualMinutes,
      completion_rate: periodTotalTasks > 0 ? completedInPeriod / periodTotalTasks : 0,
      last_activity: lastActivity,
    })
  }

  // Sort by recent activity, then by total tasks
  return stats.sort((a, b) => {
    if (a.last_activity && b.last_activity) {
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
    }
    if (a.last_activity) return -1
    if (b.last_activity) return 1
    return b.total_tasks - a.total_tasks
  })
}

// Compute daily stats for the specified period
function computeDailyStats(
  tasks: Task[],
  schedules: Map<string, Schedule>,
  habitInstances: HabitInstance[],
  habits: Task[],
  days: number
): DailyStats[] {
  const stats: DailyStats[] = []
  const taskMap = new Map<string, Task>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

  // Create a set of completed habit dates
  const habitCompletionsByDate = new Map<string, Set<string>>()
  for (const instance of habitInstances) {
    if (!habitCompletionsByDate.has(instance.date)) {
      habitCompletionsByDate.set(instance.date, new Set())
    }
    habitCompletionsByDate.get(instance.date)!.add(instance.habit_id)
  }

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = toISODateString(date)

    const schedule = schedules.get(dateStr)
    let scheduled = 0
    let completed = 0
    let habitsScheduled = 0
    let habitsCompleted = 0

    if (schedule?.scheduled_tasks) {
      for (const st of schedule.scheduled_tasks) {
        if (!st.is_buffer) {
          const task = taskMap.get(st.task_id)
          if (task?.is_habit) {
            habitsScheduled++
            if (habitCompletionsByDate.get(dateStr)?.has(st.task_id)) {
              habitsCompleted++
            }
          } else {
            scheduled++
            if (schedule.completed_tasks?.includes(st.task_id) || task?.status === 'completed') {
              completed++
            }
          }
        }
      }
    }

    // Also count habits not in schedule but due on this day
    for (const habit of habits) {
      if (isScheduledOnDate(habit.recurrence, dateStr)) {
        const alreadyCounted = schedule?.scheduled_tasks?.some(st => st.task_id === habit.id) || false
        if (!alreadyCounted) {
          habitsScheduled++
          if (habitCompletionsByDate.get(dateStr)?.has(habit.id)) {
            habitsCompleted++
          }
        }
      }
    }

    const totalScheduled = scheduled + habitsScheduled
    const totalCompleted = completed + habitsCompleted

    stats.push({
      date: dateStr,
      scheduled,
      completed,
      completion_rate: totalScheduled > 0 ? totalCompleted / totalScheduled : 0,
      habits_scheduled: habitsScheduled,
      habits_completed: habitsCompleted,
    })
  }

  return stats
}

// Compute habit-specific analytics
function computeHabitAnalytics(
  habits: Task[],
  habitInstances: HabitInstance[],
  days: number
): HabitAnalytics {
  if (habits.length === 0) {
    return {
      total_habits: 0,
      total_completions: 0,
      avg_completion_rate: 0,
      current_best_streak: 0,
      habit_of_the_week: null,
      habits_detail: [],
    }
  }

  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - days)

  // Filter instances to period
  const periodInstances = habitInstances.filter(hi => {
    const instanceDate = new Date(hi.date)
    return instanceDate >= startDate && instanceDate <= today
  })

  // Group instances by habit
  const instancesByHabit = new Map<string, HabitInstance[]>()
  for (const instance of periodInstances) {
    if (!instancesByHabit.has(instance.habit_id)) {
      instancesByHabit.set(instance.habit_id, [])
    }
    instancesByHabit.get(instance.habit_id)!.push(instance)
  }

  // Calculate per-habit stats
  const habitsDetail: HabitAnalytics['habits_detail'] = []
  let bestStreak = 0
  let bestHabit: { name: string; completions: number } | null = null

  for (const habit of habits) {
    const instances = instancesByHabit.get(habit.id) || []
    const completedDates = new Set(instances.map(i => i.date))

    // Count scheduled days
    let scheduledDays = 0
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      if (isScheduledOnDate(habit.recurrence, toISODateString(d))) {
        scheduledDays++
      }
    }

    // Calculate streak
    let currentStreak = 0
    let tempStreak = 0
    for (let d = new Date(today); d >= startDate; d.setDate(d.getDate() - 1)) {
      const dateStr = toISODateString(d)
      if (isScheduledOnDate(habit.recurrence, dateStr)) {
        if (completedDates.has(dateStr)) {
          tempStreak++
          currentStreak = Math.max(currentStreak, tempStreak)
        } else {
          if (d.getTime() !== today.getTime()) { // Don't break streak if today is incomplete
            tempStreak = 0
          }
        }
      }
    }

    const completionRate = scheduledDays > 0 ? instances.length / scheduledDays : 0

    habitsDetail.push({
      id: habit.id,
      name: habit.title,
      completions: instances.length,
      scheduled: scheduledDays,
      completion_rate: completionRate,
      current_streak: currentStreak,
    })

    if (currentStreak > bestStreak) {
      bestStreak = currentStreak
    }

    // Track best habit of the period
    if (!bestHabit || instances.length > bestHabit.completions) {
      bestHabit = { name: habit.title, completions: instances.length }
    }
  }

  // Sort by completion rate
  habitsDetail.sort((a, b) => b.completion_rate - a.completion_rate)

  const totalCompletions = periodInstances.length
  const avgRate = habitsDetail.length > 0
    ? habitsDetail.reduce((sum, h) => sum + h.completion_rate, 0) / habitsDetail.length
    : 0

  return {
    total_habits: habits.length,
    total_completions: totalCompletions,
    avg_completion_rate: avgRate,
    current_best_streak: bestStreak,
    habit_of_the_week: bestHabit,
    habits_detail: habitsDetail,
  }
}

// Determine trend from daily stats
function determineTrend(dailyStats: DailyStats[]): 'improving' | 'declining' | 'stable' | 'insufficient_data' {
  if (dailyStats.length < 7) return 'insufficient_data'

  const recentWeek = dailyStats.slice(-7)
  const previousWeek = dailyStats.slice(-14, -7)

  if (previousWeek.length < 7) return 'insufficient_data'

  const recentAvg = recentWeek.reduce((sum, d) => sum + d.completion_rate, 0) / 7
  const previousAvg = previousWeek.reduce((sum, d) => sum + d.completion_rate, 0) / 7

  const diff = recentAvg - previousAvg
  if (diff > 0.1) return 'improving'
  if (diff < -0.1) return 'declining'
  return 'stable'
}

// Stat Card Component
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && (
            trend === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> :
            trend === 'down' ? <TrendingDown className="h-4 w-4 text-red-500" /> :
            <Minus className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// Time Period Selector
function PeriodSelector({ period, onChange }: { period: TimePeriod; onChange: (p: TimePeriod) => void }) {
  const periods: TimePeriod[] = ['week', 'month', 'quarter', 'year', 'all']

  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {periods.map(p => (
        <Button
          key={p}
          variant={period === p ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onChange(p)}
          className="text-xs"
        >
          {PERIOD_LABELS[p]}
        </Button>
      ))}
    </div>
  )
}

// Trends Card with expanded metrics
function TrendsCard({ dailyStats, trend, period }: { dailyStats: DailyStats[], trend: string, period: TimePeriod }) {
  const trendLabels: Record<string, { text: string; color: string; icon: React.ElementType }> = {
    improving: { text: 'Improving', color: 'text-green-500', icon: TrendingUp },
    declining: { text: 'Declining', color: 'text-red-500', icon: TrendingDown },
    stable: { text: 'Stable', color: 'text-blue-500', icon: Minus },
    insufficient_data: { text: 'Insufficient Data', color: 'text-gray-400', icon: Minus },
  }

  const trendInfo = trendLabels[trend] || trendLabels.insufficient_data
  const TrendIcon = trendInfo.icon

  const avgCompletion = dailyStats.length > 0
    ? dailyStats.reduce((sum, d) => sum + d.completion_rate, 0) / dailyStats.length
    : 0

  const totalCompleted = dailyStats.reduce((sum, d) => sum + d.completed + d.habits_completed, 0)
  const totalScheduled = dailyStats.reduce((sum, d) => sum + d.scheduled + d.habits_scheduled, 0)
  const totalMinutesWorked = dailyStats.reduce((sum, d) => sum + (d.completed + d.habits_completed) * 30, 0)

  // Best and worst days
  const sortedByRate = [...dailyStats].sort((a, b) => b.completion_rate - a.completion_rate)
  const bestDay = sortedByRate[0]
  const worstDay = sortedByRate[sortedByRate.length - 1]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendIcon className={cn("h-5 w-5", trendInfo.color)} />
          Productivity Trend
        </CardTitle>
        <CardDescription>
          {PERIOD_LABELS[period]} analysis ({dailyStats.length} days)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Trend:</span>
          <Badge variant="outline" className={trendInfo.color}>
            {trendInfo.text}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{(avgCompletion * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Avg completion rate</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <div className="text-xs text-muted-foreground">Total completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(totalMinutesWorked / 60)}h</div>
            <div className="text-xs text-muted-foreground">Est. time worked</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(totalCompleted / Math.max(dailyStats.length, 1) * 10) / 10}</div>
            <div className="text-xs text-muted-foreground">Tasks/day avg</div>
          </div>
        </div>

        {bestDay && worstDay && dailyStats.length > 1 && (
          <div className="pt-2 border-t text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Best day:</span>
              <span className="text-green-500">
                {parseISO(bestDay.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ({(bestDay.completion_rate * 100).toFixed(0)}%)
              </span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-muted-foreground">Worst day:</span>
              <span className="text-red-500">
                {parseISO(worstDay.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ({(worstDay.completion_rate * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
        )}

        {/* Bar chart */}
        {dailyStats.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">Daily Completion (Last {Math.min(dailyStats.length, 14)} days)</h4>
            <div className="flex items-end gap-1 h-16">
              {dailyStats.slice(-14).map((day, idx) => (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center"
                >
                  <div
                    className="w-full bg-primary rounded-t"
                    style={{ height: `${Math.max(day.completion_rate * 100, 4)}%` }}
                    title={`${day.date}: ${(day.completion_rate * 100).toFixed(0)}%`}
                  />
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {parseISO(day.date).getDate()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Enhanced Project Stats Card
function ProjectStatsCard({ projects, showAll }: { projects: ProjectStats[], showAll?: boolean }) {
  const [expanded, setExpanded] = useState(false)

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Project Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No project data available</p>
        </CardContent>
      </Card>
    )
  }

  const displayProjects = expanded || showAll ? projects : projects.slice(0, 5)
  const activeProjects = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const totalTasks = projects.reduce((sum, p) => sum + p.total_tasks, 0)
  const completedTasks = projects.reduce((sum, p) => sum + p.completed_tasks, 0)

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Project Statistics
        </CardTitle>
        <CardDescription>
          {activeProjects.length} active, {completedProjects.length} completed • {completedTasks}/{totalTasks} tasks done
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 pb-4 border-b">
          <div className="text-center">
            <div className="text-xl font-bold">{projects.length}</div>
            <div className="text-xs text-muted-foreground">Total Projects</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-500">{activeProjects.length}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-500">{completedProjects.length}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold">{totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0}%</div>
            <div className="text-xs text-muted-foreground">Overall Progress</div>
          </div>
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {displayProjects.map((project) => (
            <div key={project.project_id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate max-w-[200px]">
                    {project.name || project.project_id}
                  </span>
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                    {project.status}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {project.completed_tasks}/{project.total_tasks} tasks
                </span>
              </div>
              <Progress value={project.completion_rate * 100} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {(project.completion_rate * 100).toFixed(0)}% complete
                  {project.in_progress_tasks > 0 && ` • ${project.in_progress_tasks} in progress`}
                </span>
                <span>
                  {project.total_estimated_minutes > 0 && `${Math.round(project.total_estimated_minutes / 60)}h est`}
                  {project.actual_minutes > 0 && ` • ${Math.round(project.actual_minutes / 60)}h actual`}
                </span>
              </div>
              {project.last_activity && (
                <div className="text-xs text-muted-foreground">
                  Last activity: {parseISO(project.last_activity).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>

        {projects.length > 5 && !showAll && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>Show Less <ChevronUp className="h-4 w-4 ml-1" /></>
            ) : (
              <>Show All {projects.length} Projects <ChevronDown className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Habits Analytics Card
function HabitsAnalyticsCard({ analytics, period }: { analytics: HabitAnalytics, period: TimePeriod }) {
  const [expanded, setExpanded] = useState(false)

  if (analytics.total_habits === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Habits Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No habits created yet. Create a habit to track recurring tasks.
          </p>
        </CardContent>
      </Card>
    )
  }

  const displayHabits = expanded ? analytics.habits_detail : analytics.habits_detail.slice(0, 5)

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Habits Analytics
        </CardTitle>
        <CardDescription>
          {PERIOD_LABELS[period]} habit performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 pb-4 border-b">
          <div className="text-center">
            <div className="text-xl font-bold">{analytics.total_habits}</div>
            <div className="text-xs text-muted-foreground">Active Habits</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-500">{analytics.total_completions}</div>
            <div className="text-xs text-muted-foreground">Completions</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-500">{(analytics.avg_completion_rate * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Avg Rate</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-orange-500 flex items-center justify-center gap-1">
              <Flame className="h-4 w-4" />
              {analytics.current_best_streak}
            </div>
            <div className="text-xs text-muted-foreground">Best Streak</div>
          </div>
        </div>

        {analytics.habit_of_the_week && (
          <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
            <Award className="h-5 w-5 text-yellow-500" />
            <div>
              <span className="font-medium">Top Habit:</span>{' '}
              <span className="text-muted-foreground">
                {analytics.habit_of_the_week.name} ({analytics.habit_of_the_week.completions} completions)
              </span>
            </div>
          </div>
        )}

        {/* Habit list */}
        <div className="space-y-3">
          {displayHabits.map((habit) => (
            <div key={habit.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate max-w-[200px]">{habit.name}</span>
                  {habit.current_streak > 0 && (
                    <Badge variant="outline" className="text-xs text-orange-500">
                      <Flame className="h-3 w-3 mr-1" />{habit.current_streak} streak
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {habit.completions}/{habit.scheduled}
                </span>
              </div>
              <Progress
                value={habit.completion_rate * 100}
                className={cn("h-2", habit.completion_rate >= 0.8 ? "bg-green-100" : habit.completion_rate >= 0.5 ? "bg-yellow-100" : "bg-red-100")}
              />
              <div className="text-xs text-muted-foreground">
                {(habit.completion_rate * 100).toFixed(0)}% completion rate
              </div>
            </div>
          ))}
        </div>

        {analytics.habits_detail.length > 5 && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>Show Less <ChevronUp className="h-4 w-4 ml-1" /></>
            ) : (
              <>Show All {analytics.habits_detail.length} Habits <ChevronDown className="h-4 w-4 ml-1" /></>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Period Summary Card - adapts to selected time period
function PeriodSummaryCard({ dailyStats, period }: { dailyStats: DailyStats[], period: TimePeriod }) {
  // For week, show all 7 days; for longer periods, show last 7 days breakdown
  const displayDays = dailyStats.slice(-7)
  const totalCompleted = dailyStats.reduce((sum, d) => sum + d.completed + d.habits_completed, 0)
  const totalScheduled = dailyStats.reduce((sum, d) => sum + d.scheduled + d.habits_scheduled, 0)
  const avgRate = totalScheduled > 0 ? totalCompleted / totalScheduled : 0

  const periodStart = dailyStats[0]?.date || toISODateString(new Date())
  const periodEnd = dailyStats[dailyStats.length - 1]?.date || toISODateString(new Date())

  // Calculate tasks per day average
  const tasksPerDay = dailyStats.length > 0 ? totalCompleted / dailyStats.length : 0

  // Calculate habits vs tasks breakdown
  const totalHabitsCompleted = dailyStats.reduce((sum, d) => sum + d.habits_completed, 0)
  const totalTasksCompleted = dailyStats.reduce((sum, d) => sum + d.completed, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {PERIOD_LABELS[period]} Summary
        </CardTitle>
        <CardDescription>
          {parseISO(periodStart).toLocaleDateString()} - {parseISO(periodEnd).toLocaleDateString()} ({dailyStats.length} days)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{totalCompleted}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{totalScheduled}</div>
            <div className="text-xs text-muted-foreground">Scheduled</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{(avgRate * 100).toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">Rate</div>
          </div>
        </div>

        {/* Breakdown by type */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t text-center">
          <div>
            <div className="text-lg font-semibold text-blue-500">{totalTasksCompleted}</div>
            <div className="text-xs text-muted-foreground">Tasks Done</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-green-500">{totalHabitsCompleted}</div>
            <div className="text-xs text-muted-foreground">Habits Done</div>
          </div>
        </div>

        <div className="text-sm text-center text-muted-foreground">
          Avg: {tasksPerDay.toFixed(1)} completions/day
        </div>

        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-2">Last 7 Days</h4>
          <div className="space-y-1">
            {displayDays.map((day) => {
              const dayTotal = day.scheduled + day.habits_scheduled
              const dayCompleted = day.completed + day.habits_completed
              return (
                <div key={day.date} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {parseISO(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <span>
                    {dayCompleted}/{dayTotal}
                    {dayTotal > 0 && (
                      <span className={cn(
                        "ml-2 text-xs",
                        day.completion_rate >= 0.8 ? "text-green-500" :
                        day.completion_rate >= 0.5 ? "text-yellow-500" : "text-red-500"
                      )}>
                        ({(day.completion_rate * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Main Analytics Component
export function Analytics() {
  const { tasks, projects, schedules, isInitialized, loadSchedules, getHabitInstancesByHabit } = useApp()
  const [period, setPeriod] = useState<TimePeriod>('month')
  const [schedulesLoading, setSchedulesLoading] = useState(true)
  const [habitInstances, setHabitInstances] = useState<HabitInstance[]>([])

  const habits = useMemo(() => tasks.filter(t => t.is_habit && !t.is_paused), [tasks])
  const periodDays = period === 'all' ? 365 : PERIOD_DAYS[period] // Cap all-time at 1 year for performance

  // Load schedules and habit instances for the selected period
  useEffect(() => {
    async function fetchData() {
      setSchedulesLoading(true)
      const today = new Date()
      const startDate = new Date(today)
      startDate.setDate(startDate.getDate() - periodDays)

      // Load schedules
      await loadSchedules(toISODateString(startDate), toISODateString(today))

      // Load habit instances for all habits
      const allInstances: HabitInstance[] = []
      for (const habit of habits) {
        const instances = await getHabitInstancesByHabit(
          habit.id,
          toISODateString(startDate),
          toISODateString(today)
        )
        allInstances.push(...instances)
      }
      setHabitInstances(allInstances)
      setSchedulesLoading(false)
    }

    if (isInitialized) {
      fetchData()
    }
  }, [isInitialized, loadSchedules, getHabitInstancesByHabit, periodDays, habits])

  // Compute analytics
  const overview = useMemo(() => {
    return computeOverview(tasks, projects, schedules, periodDays)
  }, [tasks, projects, schedules, periodDays])

  const projectStats = useMemo(() => {
    return computeProjectStats(tasks, projects, period)
  }, [tasks, projects, period])

  const dailyStats = useMemo(() => {
    return computeDailyStats(tasks, schedules, habitInstances, habits, periodDays)
  }, [tasks, schedules, habitInstances, habits, periodDays])

  const habitAnalytics = useMemo(() => {
    return computeHabitAnalytics(habits, habitInstances, periodDays)
  }, [habits, habitInstances, periodDays])

  const trend = useMemo(() => {
    return determineTrend(dailyStats)
  }, [dailyStats])

  if (!isInitialized || schedulesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex items-center gap-2">
          <PeriodSelector period={period} onChange={setPeriod} />
          <Badge variant="outline">Based on local data</Badge>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title={`Tasks (${PERIOD_LABELS[period]})`}
          value={overview.total_tasks}
          description={`${overview.completed_tasks} completed in period`}
          icon={Target}
        />
        <StatCard
          title="Period Completion"
          value={`${(overview.completion_rate * 100).toFixed(0)}%`}
          icon={CheckCircle2}
          trend={overview.completion_rate >= 0.7 ? 'up' : overview.completion_rate >= 0.5 ? 'neutral' : 'down'}
        />
        <StatCard
          title="Active Projects"
          value={overview.active_projects}
          description={`${overview.total_projects} total`}
          icon={Briefcase}
        />
        <StatCard
          title="Today's Progress"
          value={`${overview.today_completed}/${overview.today_scheduled}`}
          description="Tasks completed today"
          icon={Clock}
        />
      </div>

      {/* Main content grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <TrendsCard dailyStats={dailyStats} trend={trend} period={period} />
        <PeriodSummaryCard dailyStats={dailyStats} period={period} />
      </div>

      {/* Habits Analytics - Full width */}
      <HabitsAnalyticsCard analytics={habitAnalytics} period={period} />

      {/* Project Stats - Full width */}
      <ProjectStatsCard projects={projectStats} />
    </div>
  )
}

export default Analytics
