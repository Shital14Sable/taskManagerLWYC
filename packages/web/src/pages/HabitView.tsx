import { useState, useEffect, useMemo } from 'react'
import {
  ArrowLeft, RefreshCw, Calendar, CheckCircle2, Target,
  TrendingUp, Flame, Award, Clock, Star, Edit2, CalendarPlus, ChevronDown, ChevronUp,
  PauseCircle, Play, Pencil
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PieChart } from '@/components/charts/PieChart'
import { BarChart } from '@/components/charts/BarChart'
import { useApp } from '@/context/AppContext'
import type { HabitInstance } from '@/types'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { toISODateString } from '@trackmind/core'

interface HabitViewProps {
  habitId: string
  onBack: () => void
  onEdit?: () => void
}

const dayColors: Record<string, string> = {
  Monday: '#3b82f6',
  Tuesday: '#8b5cf6',
  Wednesday: '#ec4899',
  Thursday: '#f97316',
  Friday: '#eab308',
  Saturday: '#22c55e',
  Sunday: '#06b6d4',
}

// Helper to generate next N days
function getNextDays(n: number): string[] {
  const days: string[] = []
  const today = new Date()
  for (let i = 0; i < n; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    days.push(toISODateString(date))
  }
  return days
}

// Helper to check if habit is scheduled on a given date
function isScheduledOnDate(recurrence: { frequency?: string; days_of_week?: string[] } | null, date: string): boolean {
  if (!recurrence) return false
  const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' })
  if (recurrence.days_of_week && recurrence.days_of_week.length > 0) {
    return recurrence.days_of_week.includes(dayOfWeek)
  }
  // If no specific days, assume daily
  return recurrence.frequency === 'Daily' || recurrence.frequency === 'daily'
}

export function HabitView({ habitId, onBack, onEdit }: HabitViewProps) {
  const { tasks, getHabitInstancesByHabit, getHabitInstance, saveHabitInstance, saveTask } = useApp()
  const [period, setPeriod] = useState<number>(30)
  const [togglingPause, setTogglingPause] = useState(false)
  const [habitInstances, setHabitInstances] = useState<HabitInstance[]>([])

  // Future week planning state
  const [futureInstances, setFutureInstances] = useState<Record<string, HabitInstance | null>>({})
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [planExpanded, setPlanExpanded] = useState(false)

  // Get habit from local storage
  const habit = useMemo(() => tasks.find(t => t.id === habitId && t.is_habit), [tasks, habitId])
  const isPaused = habit?.is_paused || false
  const pausedUntil = habit?.paused_until || null

  // Load habit instances
  const loadInstances = async () => {
    if (!habit) return
    const today = new Date()
    const startDate = period > 0
      ? new Date(today.getTime() - period * 24 * 60 * 60 * 1000)
      : new Date(habit.created_at)
    const instances = await getHabitInstancesByHabit(habitId, toISODateString(startDate), toISODateString(today))
    setHabitInstances(instances)
  }

  useEffect(() => {
    loadInstances()
  }, [habit, habitId, period, getHabitInstancesByHabit])

  // Calculate stats from local data
  const stats = useMemo(() => {
    if (!habit) return null

    const today = new Date()
    const startDate = period > 0
      ? new Date(today.getTime() - period * 24 * 60 * 60 * 1000)
      : new Date(habit.created_at)

    // Use loaded habit instances
    const instances = habitInstances

    // Calculate days scheduled based on recurrence
    let totalScheduled = 0
    let totalCompleted = instances.length
    const dayOfWeekStats: Record<string, { scheduled: number; completed: number }> = {
      Sunday: { scheduled: 0, completed: 0 },
      Monday: { scheduled: 0, completed: 0 },
      Tuesday: { scheduled: 0, completed: 0 },
      Wednesday: { scheduled: 0, completed: 0 },
      Thursday: { scheduled: 0, completed: 0 },
      Friday: { scheduled: 0, completed: 0 },
      Saturday: { scheduled: 0, completed: 0 },
    }

    // Count scheduled days
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = toISODateString(d)
      const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' })

      if (isScheduledOnDate(habit.recurrence, dateStr)) {
        totalScheduled++
        dayOfWeekStats[dayOfWeek].scheduled++

        // Check if completed
        const instance = instances.find(i => i.date === dateStr)
        if (instance) {
          dayOfWeekStats[dayOfWeek].completed++
        }
      }
    }

    // Calculate streaks
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    const completedDates = new Set(instances.map(i => i.date))

    for (let d = new Date(today); d >= startDate; d.setDate(d.getDate() - 1)) {
      const dateStr = toISODateString(d)
      if (isScheduledOnDate(habit.recurrence, dateStr)) {
        if (completedDates.has(dateStr)) {
          tempStreak++
          if (d.getTime() === today.getTime() || (today.getTime() - d.getTime()) < 2 * 24 * 60 * 60 * 1000) {
            currentStreak = tempStreak
          }
          longestStreak = Math.max(longestStreak, tempStreak)
        } else {
          tempStreak = 0
        }
      }
    }

    // Find best day
    let bestDay = null
    let bestRate = 0
    for (const [day, data] of Object.entries(dayOfWeekStats)) {
      if (data.scheduled > 0) {
        const rate = data.completed / data.scheduled
        if (rate > bestRate) {
          bestRate = rate
          bestDay = { day, rate, completed: data.completed, scheduled: data.scheduled }
        }
      }
    }

    return {
      title: habit.title,
      description: habit.description,
      recurrence: habit.recurrence,
      completion_rate: totalScheduled > 0 ? totalCompleted / totalScheduled : 0,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      total_completed: totalCompleted,
      total_scheduled: totalScheduled,
      best_day: bestDay,
      day_of_week_stats: Object.entries(dayOfWeekStats).map(([day, data]) => ({
        day,
        day_short: day.substring(0, 3),
        scheduled: data.scheduled,
        completed: data.completed,
        rate: data.scheduled > 0 ? data.completed / data.scheduled : 0,
      })),
      weekly_stats: [], // Simplified - could calculate if needed
      daily_data: [], // Simplified - could calculate if needed
      recent_completions: instances.slice(-10).map(i => i.date),
    }
  }, [habit, habitId, period, habitInstances])

  // Fetch future instances on load
  useEffect(() => {
    const loadFutureInstances = async () => {
      const days = getNextDays(7)
      const instances: Record<string, HabitInstance | null> = {}
      for (const date of days) {
        const instance = await getHabitInstance(habitId, date)
        instances[date] = instance
      }
      setFutureInstances(instances)
    }
    loadFutureInstances()
  }, [habitId, getHabitInstance])

  // Toggle pause status
  const handleTogglePause = async () => {
    if (!habit) return
    setTogglingPause(true)
    try {
      const newPausedState = !isPaused
      await saveTask({
        ...habit,
        is_paused: newPausedState,
        paused_until: undefined,
        updated_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Failed to toggle pause:', err)
    } finally {
      setTogglingPause(false)
    }
  }

  const loading = false
  const error = !habit ? 'Habit not found' : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error || 'Habit not found'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate streak color based on length
  const getStreakColor = (streak: number) => {
    if (streak >= 30) return 'text-yellow-500'
    if (streak >= 14) return 'text-orange-500'
    if (streak >= 7) return 'text-blue-500'
    return 'text-muted-foreground'
  }

  // Format frequency display
  const formatFrequency = () => {
    if (!stats.recurrence) return 'Not set'
    const { frequency, days_of_week, time_of_day } = stats.recurrence
    let text = frequency || 'Daily'
    if (days_of_week && days_of_week.length > 0 && days_of_week.length < 7) {
      text += ` (${days_of_week.join(', ')})`
    }
    if (time_of_day) {
      text += ` at ${time_of_day}`
    }
    return text
  }

  // Save habit instance for a date
  const handleSaveInstance = async (date: string) => {
    if (!editValue.trim()) {
      setEditingDate(null)
      return
    }

    setSavingDate(date)
    try {
      const now = new Date().toISOString()
      const instance: HabitInstance = {
        habit_id: habitId,
        date,
        instance_detail: editValue.trim(),
        created_at: futureInstances[date]?.created_at || now,
        updated_at: now,
      }
      await saveHabitInstance(instance)
      setFutureInstances(prev => ({ ...prev, [date]: instance }))
      setEditingDate(null)
      setEditValue('')
    } catch (err) {
      console.error('Failed to save habit instance:', err)
    } finally {
      setSavingDate(null)
    }
  }

  // Delete habit instance for a date - just clear from local state
  const handleDeleteInstance = async (date: string) => {
    setSavingDate(date)
    try {
      // Note: Would need deleteHabitInstance in context for full support
      setFutureInstances(prev => ({ ...prev, [date]: null }))
    } catch (err) {
      console.error('Failed to delete habit instance:', err)
    } finally {
      setSavingDate(null)
    }
  }

  // Get scheduled days for the next week
  const futureDays = getNextDays(7).filter(date =>
    isScheduledOnDate(stats?.recurrence || habit?.recurrence, date)
  )

  // Prepare day of week chart data
  const dayChartData = (stats?.day_of_week_stats || []).map(d => ({
    label: d.day_short,
    value: Math.round(d.rate * 100),
    color: dayColors[d.day] || '#6b7280',
  }))

  // Prepare weekly chart data
  const weeklyChartData = (stats?.weekly_stats || []).map((w, i) => ({
    label: `Week ${i + 1}`,
    value: Math.round(w.rate * 100),
    color: w.rate >= 0.8 ? '#22c55e' : w.rate >= 0.5 ? '#eab308' : '#ef4444',
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{stats.title}</h1>
              <Badge variant="secondary">Habit</Badge>
              {isPaused && (
                <Badge variant="outline" className="text-gray-500 border-gray-400">
                  <PauseCircle className="h-3 w-3 mr-1" />
                  Paused
                  {pausedUntil && (
                    <span className="ml-1">until {new Date(pausedUntil).toLocaleDateString()}</span>
                  )}
                </Badge>
              )}
            </div>
            {stats.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl">{stats.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatFrequency()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit Habit
            </Button>
          )}
          <Button
            variant={isPaused ? "default" : "outline"}
            size="sm"
            onClick={handleTogglePause}
            disabled={togglingPause}
            className={isPaused ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {togglingPause ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : isPaused ? (
              <Play className="h-4 w-4 mr-2" />
            ) : (
              <PauseCircle className="h-4 w-4 mr-2" />
            )}
            {isPaused ? 'Resume Habit' : 'Pause Habit'}
          </Button>
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
              <SelectItem value="0">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadInstances}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(stats.completion_rate * 100)}%</p>
                <p className="text-xs text-muted-foreground">Completion Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Flame className={cn("h-5 w-5", getStreakColor(stats.current_streak))} />
              </div>
              <div>
                <p className={cn("text-2xl font-bold", getStreakColor(stats.current_streak))}>
                  {stats.current_streak}
                </p>
                <p className="text-xs text-muted-foreground">Current Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Award className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.longest_streak}</p>
                <p className="text-xs text-muted-foreground">Longest Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.total_completed}/{stats.total_scheduled}
                </p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Future Week Planning - Compact collapsible */}
      {futureDays.length > 0 && (() => {
        const plannedCount = futureDays.filter(d => futureInstances[d]).length
        const plannedItems = futureDays
          .filter(d => futureInstances[d])
          .map(d => {
            const dateObj = new Date(d)
            return `${dateObj.toLocaleDateString('en-US', { weekday: 'short' })}: ${futureInstances[d]?.instance_detail}`
          })

        return (
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
            <CalendarPlus className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Upcoming Week</span>
                <Badge variant={plannedCount > 0 ? "default" : "secondary"} className="text-xs">
                  {plannedCount}/{futureDays.length} planned
                </Badge>
                {plannedCount > 0 && !planExpanded && (
                  <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                    {plannedItems.slice(0, 2).join(' • ')}{plannedItems.length > 2 ? ' ...' : ''}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPlanExpanded(!planExpanded)}
              className="flex-shrink-0"
            >
              {planExpanded ? (
                <>Hide <ChevronUp className="h-4 w-4 ml-1" /></>
              ) : (
                <>Plan <ChevronDown className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </div>
        )
      })()}

      {/* Expanded Planning Details */}
      {planExpanded && futureDays.length > 0 && (
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="space-y-2">
              {futureDays.map((date) => {
                const instance = futureInstances[date]
                const isEditing = editingDate === date
                const isSaving = savingDate === date
                const dateObj = new Date(date)
                const isToday = date === toISODateString(new Date())

                return (
                  <div
                    key={date}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg transition-colors",
                      isToday ? "bg-primary/10 border border-primary/30" : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div className="w-20 flex-shrink-0 text-sm">
                      <span className="font-medium">{dateObj.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      <span className="text-muted-foreground ml-1">{dateObj.getDate()}</span>
                    </div>

                    {isEditing ? (
                      <div className="flex-1 flex items-center gap-2">
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          placeholder={`What's planned?`}
                          className="flex-1 h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInstance(date)
                            if (e.key === 'Escape') {
                              setEditingDate(null)
                              setEditValue('')
                            }
                          }}
                          disabled={isSaving}
                        />
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => handleSaveInstance(date)} disabled={isSaving}>
                          {isSaving ? '...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingDate(null); setEditValue('') }} disabled={isSaving}>
                          ×
                        </Button>
                      </div>
                    ) : instance ? (
                      <div className="flex-1 flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-xs font-medium">
                          {instance.instance_detail}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setEditingDate(date); setEditValue(instance.instance_detail) }}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleDeleteInstance(date)} disabled={isSaving}>
                            ×
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => { setEditingDate(date); setEditValue('') }}>
                        <Edit2 className="h-3 w-3 mr-1" /> Add
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-1 space-y-6">
          {/* Completion Rate Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Overall Completion</CardTitle>
              <CardDescription>{period === 0 ? 'All time' : `Last ${period} days`}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PieChart
                segments={[
                  { value: stats.total_completed, color: '#22c55e', label: 'Completed' },
                  { value: stats.total_scheduled - stats.total_completed, color: 'hsl(var(--muted))', label: 'Missed' },
                ]}
                size={180}
                innerRadius={55}
                centerValue={`${Math.round(stats.completion_rate * 100)}%`}
                centerLabel="Success"
              />
            </CardContent>
          </Card>

          {/* Best Day */}
          {stats.best_day && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Best Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold" style={{ color: dayColors[stats.best_day.day] }}>
                    {stats.best_day.day}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Math.round(stats.best_day.rate * 100)}% completion rate
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stats.best_day.completed}/{stats.best_day.scheduled} completed
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Streaks Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Streaks
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-muted-foreground">Current Streak</span>
                  <span className={cn("text-xl font-bold", getStreakColor(stats.current_streak))}>
                    {stats.current_streak} days
                  </span>
                </div>
                <Progress
                  value={stats.longest_streak > 0 ? (stats.current_streak / stats.longest_streak) * 100 : 0}
                  className="h-2"
                />
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">Longest Streak</span>
                <span className="text-xl font-bold text-yellow-500">{stats.longest_streak} days</span>
              </div>
              {stats.current_streak > 0 && stats.current_streak < stats.longest_streak && (
                <p className="text-xs text-center text-muted-foreground">
                  {stats.longest_streak - stats.current_streak} more days to beat your record!
                </p>
              )}
              {stats.current_streak >= stats.longest_streak && stats.current_streak > 0 && (
                <p className="text-xs text-center text-yellow-500 font-medium">
                  You're at your best streak! Keep going!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Charts & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Day of Week Performance */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance by Day of Week
              </CardTitle>
              <CardDescription>Which days are you most consistent?</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={dayChartData}
                height={200}
                horizontal={false}
                showValues={true}
              />
              <div className="mt-4 grid grid-cols-7 gap-1 text-center">
                {stats.day_of_week_stats.map(d => (
                  <div key={d.day} className="text-xs">
                    <div className="text-muted-foreground">{d.day_short}</div>
                    <div className="font-medium">{d.completed}/{d.scheduled}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Completion Trend
              </CardTitle>
              <CardDescription>Your progress over the past weeks</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={weeklyChartData}
                height={180}
                horizontal={false}
                showValues={true}
              />
              <div className="mt-4 space-y-2">
                {stats.weekly_stats.map((week) => (
                  <div key={week.week_start} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(week.week_start).toLocaleDateString()} - {new Date(week.week_end).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {week.completed}/{week.scheduled}
                      </span>
                      <Badge variant={week.rate >= 0.8 ? 'default' : week.rate >= 0.5 ? 'secondary' : 'destructive'}>
                        {Math.round(week.rate * 100)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Daily Calendar Heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Last 14 days of activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {stats.daily_data.map((day) => {
                  const date = new Date(day.date)
                  const isCompleted = day.completed
                  const wasScheduled = day.scheduled

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        "aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-colors",
                        !wasScheduled && "bg-muted/30",
                        wasScheduled && !isCompleted && "bg-red-500/20 border border-red-500/30",
                        wasScheduled && isCompleted && "bg-green-500/20 border border-green-500/30"
                      )}
                      title={`${day.date}: ${wasScheduled ? (isCompleted ? 'Completed' : 'Missed') : 'Not scheduled'}`}
                    >
                      <span className="font-medium">{date.getDate()}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      {wasScheduled && (
                        <div className={cn(
                          "mt-1 w-3 h-3 rounded-full",
                          isCompleted ? "bg-green-500" : "bg-red-500"
                        )}>
                          {isCompleted && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500/30" />
                  <span className="text-muted-foreground">Completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/30" />
                  <span className="text-muted-foreground">Missed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-muted/30" />
                  <span className="text-muted-foreground">Not scheduled</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Completions */}
          {stats.recent_completions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  Recent Completions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {stats.recent_completions.map((date) => (
                    <Badge key={date} variant="secondary" className="text-xs">
                      {new Date(date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short'
                      })}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default HabitView
