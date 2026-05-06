import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Clock, Check, Flame, Zap, Moon, RefreshCw, ListTodo, Repeat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DayScheduleDetail } from '@/components/DayScheduleDetail'
import { useApp } from '@/context/AppContext'
import { getCyclePhaseForDate } from '@/utils/cycle'
import type { CycleSeason } from '@/utils/cycle'
import { cn } from '@/lib/utils'
import { toISODateString } from '@trackmind/core'
import type { Task, Schedule } from '@/types'

const phaseStripColor: Record<CycleSeason, string> = {
  winter: '#60a5fa',
  spring: '#4ade80',
  summer: '#facc15',
  autumn: '#fb923c',
}

const phaseTextColor: Record<CycleSeason, string> = {
  winter: 'text-blue-400',
  spring: 'text-green-400',
  summer: 'text-yellow-400',
  autumn: 'text-orange-400',
}

const phaseInfo: Record<CycleSeason, { emoji: string; short: string }> = {
  winter: { emoji: '❄️', short: 'Menstruation' },
  spring: { emoji: '🌱', short: 'Follicular' },
  summer: { emoji: '☀️', short: 'Ovulation' },
  autumn: { emoji: '🍂', short: 'Luteal' },
}

interface WeekDayTask {
  id: string
  title: string
  start_time: string
  end_time: string
  duration: number
  priority: number
  energy_level: string
  is_habit: boolean
  is_completed: boolean
  project_id: string
}

interface WeekDay {
  date: string
  day_name: string
  day_short: string
  is_today: boolean
  is_weekend: boolean
  tasks: WeekDayTask[]
  summary: {
    total: number
    completed: number
    completion_rate: number
  }
}

interface WeekViewData {
  start_date: string
  end_date: string
  days: WeekDay[]
  summary: {
    total_scheduled: number
    total_completed: number
    completion_rate: number
  }
}

const energyIcons = {
  high: <Flame className="h-3 w-3 text-orange-500" />,
  medium: <Zap className="h-3 w-3 text-yellow-500" />,
  low: <Moon className="h-3 w-3 text-blue-400" />,
}

const priorityColors: Record<number, string> = {
  1: 'border-l-gray-400',
  2: 'border-l-blue-400',
  3: 'border-l-yellow-400',
  4: 'border-l-orange-400',
  5: 'border-l-red-500',
}

function TaskItem({ task }: { task: WeekDayTask }) {
  return (
    <div
      className={cn(
        "p-2 rounded-md bg-card border-l-4 text-xs",
        priorityColors[task.priority] || 'border-l-gray-400',
        task.is_completed && "opacity-50"
      )}
    >
      <div className="flex items-center gap-1 mb-1">
        {task.is_completed && <Check className="h-3 w-3 text-green-500" />}
        <span className={cn(
          "font-medium truncate",
          task.is_completed && "line-through"
        )}>
          {task.title}
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <Clock className="h-2.5 w-2.5" />
          {task.start_time} - {task.end_time}
        </span>
        {energyIcons[task.energy_level as keyof typeof energyIcons]}
        {task.is_habit && (
          <Badge variant="secondary" className="text-[10px] px-1 py-0">Habit</Badge>
        )}
      </div>
    </div>
  )
}

// Helper to get the start of the week (Monday) for a given date
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday is start of week
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// Build week view data from local tasks and schedules
function buildWeekViewData(
  startDate: Date,
  tasks: Task[],
  schedules: Map<string, Schedule>
): WeekViewData {
  const days: WeekDay[] = []
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayShorts = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const today = toISODateString(new Date())

  let totalScheduled = 0
  let totalCompleted = 0

  // Create a task lookup map
  const taskMap = new Map<string, Task>()
  for (const task of tasks) {
    taskMap.set(task.id, task)
  }

  // Generate 7 days starting from startDate
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    const dateStr = toISODateString(currentDate)
    const dayOfWeek = currentDate.getDay()

    const schedule = schedules.get(dateStr)
    const dayTasks: WeekDayTask[] = []

    if (schedule?.scheduled_tasks) {
      for (const st of schedule.scheduled_tasks) {
        if (st.is_buffer) continue

        const task = taskMap.get(st.task_id)
        if (!task) continue

        const isCompleted = schedule.completed_tasks?.includes(st.task_id) ||
                           task.status === 'completed'

        dayTasks.push({
          id: st.task_id,
          title: task.title,
          start_time: st.start_time,
          end_time: st.end_time,
          duration: st.estimated_minutes,
          priority: task.priority,
          energy_level: task.energy_level,
          is_habit: task.is_habit,
          is_completed: isCompleted,
          project_id: task.project_id,
        })

        totalScheduled++
        if (isCompleted) totalCompleted++
      }
    }

    const dayCompleted = dayTasks.filter(t => t.is_completed).length
    const dayTotal = dayTasks.length

    days.push({
      date: dateStr,
      day_name: dayNames[dayOfWeek],
      day_short: dayShorts[dayOfWeek],
      is_today: dateStr === today,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      tasks: dayTasks,
      summary: {
        total: dayTotal,
        completed: dayCompleted,
        completion_rate: dayTotal > 0 ? (dayCompleted / dayTotal) * 100 : 0,
      },
    })
  }

  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)

  return {
    start_date: toISODateString(startDate),
    end_date: toISODateString(endDate),
    days,
    summary: {
      total_scheduled: totalScheduled,
      total_completed: totalCompleted,
      completion_rate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
    },
  }
}

export function WeekView() {
  const { tasks, schedules, loadSchedules, preferences } = useApp()
  const [loading, setLoading] = useState(true)
  const [currentStartDate, setCurrentStartDate] = useState<Date>(() => getWeekStart(new Date()))
  const [selectedDay, setSelectedDay] = useState<WeekDay | null>(null)
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'tasks' | 'habits'>('all')

  // Load schedules for the current week
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      const endDate = new Date(currentStartDate)
      endDate.setDate(currentStartDate.getDate() + 6)

      await loadSchedules(
        toISODateString(currentStartDate),
        toISODateString(endDate)
      )
      setLoading(false)
    }

    fetchSchedules()
  }, [currentStartDate, loadSchedules])

  // Build week view data from local data
  const weekData = useMemo(() => {
    return buildWeekViewData(currentStartDate, tasks, schedules)
  }, [currentStartDate, tasks, schedules])

  // Apply schedule filter to week data
  const filteredWeekData = useMemo(() => {
    if (scheduleFilter === 'all') return weekData

    const filteredDays = weekData.days.map(day => {
      const filteredTasks = day.tasks.filter(task => {
        if (scheduleFilter === 'habits') {
          return task.is_habit
        } else {
          return !task.is_habit
        }
      })
      const completed = filteredTasks.filter(t => t.is_completed).length
      return {
        ...day,
        tasks: filteredTasks,
        summary: {
          total: filteredTasks.length,
          completed,
          completion_rate: filteredTasks.length > 0 ? (completed / filteredTasks.length) * 100 : 0,
        }
      }
    })

    const totalScheduled = filteredDays.reduce((sum, d) => sum + d.summary.total, 0)
    const totalCompleted = filteredDays.reduce((sum, d) => sum + d.summary.completed, 0)

    return {
      ...weekData,
      days: filteredDays,
      summary: {
        total_scheduled: totalScheduled,
        total_completed: totalCompleted,
        completion_rate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
      }
    }
  }, [weekData, scheduleFilter])

  // Precompute cycle phase season per day for this week
  const cyclePhaseByDate = useMemo((): Map<string, CycleSeason> => {
    const map = new Map<string, CycleSeason>()
    if (!preferences?.cycle?.enabled) return map
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentStartDate)
      date.setDate(currentStartDate.getDate() + i)
      const phase = getCyclePhaseForDate(date, preferences.cycle)
      if (phase) map.set(toISODateString(date), phase.season)
    }
    return map
  }, [preferences, currentStartDate])

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDay(null)
    setCurrentStartDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(prev.getDate() + (direction === 'prev' ? -7 : 7))
      return newDate
    })
  }

  const goToToday = () => {
    setSelectedDay(null)
    setCurrentStartDate(getWeekStart(new Date()))
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>

        <h2 className="text-xl font-semibold">
          Week of {new Date(weekData.start_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
        </h2>

        <div className="flex items-center gap-4">
          {/* Schedule filter toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={scheduleFilter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setScheduleFilter('all')}
            >
              All
            </Button>
            <Button
              variant={scheduleFilter === 'tasks' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setScheduleFilter('tasks')}
            >
              <ListTodo className="h-3 w-3 mr-1" />
              Tasks
            </Button>
            <Button
              variant={scheduleFilter === 'habits' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setScheduleFilter('habits')}
            >
              <Repeat className="h-3 w-3 mr-1" />
              Habits
            </Button>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{filteredWeekData.summary.total_completed}/{filteredWeekData.summary.total_scheduled} tasks</span>
            <Badge variant={filteredWeekData.summary.completion_rate >= 70 ? "default" : "secondary"}>
              {filteredWeekData.summary.completion_rate.toFixed(0)}% complete
            </Badge>
          </div>
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {filteredWeekData.days.map((day) => {
          const season = cyclePhaseByDate.get(day.date)
          return (
          <Card
            key={day.date}
            onClick={() => setSelectedDay(day)}
            className={cn(
              "min-h-[300px] cursor-pointer transition-all hover:shadow-md overflow-hidden",
              day.is_today && "ring-2 ring-primary",
              day.is_weekend && "bg-muted/30",
              selectedDay?.date === day.date && "ring-2 ring-primary shadow-lg"
            )}
          >
            {/* Phase color strip at top of card */}
            {season && (
              <div className="h-[3px] w-full" style={{ backgroundColor: phaseStripColor[season] }} />
            )}
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className={cn(
                  "font-medium",
                  day.is_today && "text-primary"
                )}>
                  {day.day_short}
                </span>
                <span className={cn(
                  "text-xs",
                  day.is_today ? "bg-primary text-primary-foreground px-1.5 py-0.5 rounded" : "text-muted-foreground"
                )}>
                  {new Date(day.date + 'T00:00:00').getDate()}
                </span>
              </CardTitle>
              {/* Cycle phase label */}
              {season && (
                <div className={cn("text-[10px] flex items-center gap-0.5 -mt-0.5", phaseTextColor[season])}>
                  <span>{phaseInfo[season].emoji}</span>
                  <span>{phaseInfo[season].short}</span>
                </div>
              )}
              {day.tasks.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {day.summary.completed}/{day.summary.total} done
                </div>
              )}
            </CardHeader>
            <CardContent className="p-2 space-y-1.5 overflow-y-auto max-h-[250px]">
              {day.tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
              ) : (
                day.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))
              )}
            </CardContent>
          </Card>
          )
        })}
      </div>

      {/* Selected day detail panel */}
      {selectedDay && (
        <DayScheduleDetail
          date={selectedDay.date}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}

export default WeekView
