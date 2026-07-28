import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw, Circle, CheckCircle2, ListTodo, Repeat, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DayScheduleDetail } from '@/components/DayScheduleDetail'
import { useApp } from '@/context/AppContext'
import { getCyclePhaseForDate } from '@/utils/cycle'
import type { CycleSeason } from '@/utils/cycle'
import { cn } from '@/lib/utils'
import { toISODateString } from '@trackmind/core'
import { buildICSForMonth, buildICSForDateRange, downloadICS } from '@/lib/ics'
import type { Task, Schedule } from '@/types'

const phaseStripColor: Record<CycleSeason, string> = {
  winter: '#60a5fa',
  spring: '#4ade80',
  summer: '#facc15',
  autumn: '#fb923c',
}

const phaseFillColor: Record<CycleSeason, string> = {
  winter: 'rgba(96,165,250,0.15)',
  spring: 'rgba(74,222,128,0.15)',
  summer: 'rgba(250,204,21,0.15)',
  autumn: 'rgba(251,146,60,0.15)',
}

const phaseLabel: Record<CycleSeason, { emoji: string; name: string; short: string }> = {
  winter: { emoji: '❄️', name: 'Menstruation', short: 'Mens.' },
  spring: { emoji: '🌱', name: 'Follicular',   short: 'Foll.' },
  summer: { emoji: '☀️', name: 'Ovulation',    short: 'Ovul.' },
  autumn: { emoji: '🍂', name: 'Luteal',       short: 'Lut.'  },
}

interface MonthDayTask {
  id: string
  title: string
  is_habit: boolean
  is_completed: boolean
  priority: number
}

interface MonthDay {
  date: string
  day: number
  day_of_week: number
  is_today: boolean
  is_weekend: boolean
  has_schedule: boolean
  task_count: number
  completed_count: number
  habit_count: number
  high_priority_count: number
  tasks: MonthDayTask[]
}

interface PeriodViewData {
  year: number
  month: number
  month_name: string  // calendar label; use display_label in cycle mode
  display_label: string  // shown in header
  first_weekday: number
  days_in_month: number
  days: MonthDay[]
  summary: {
    total_scheduled: number
    total_completed: number
    completion_rate: number
  }
}

interface CycleRange {
  start: string   // ISO date
  end: string     // ISO date (inclusive)
  label: string   // display label
  cycleLength: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function getCycleRange(preferences: ReturnType<typeof useApp>['preferences'], offset: number): CycleRange | null {
  if (!preferences?.cycle?.enabled) return null
  const history = [...(preferences.cycle.period_history ?? [])].sort()
  if (history.length === 0) return null
  const cycleLength = preferences.cycle.average_cycle_length ?? 28
  const mostRecent = history[history.length - 1]
  const start = addDaysToDate(mostRecent, offset * cycleLength)
  const end = addDaysToDate(start, cycleLength - 1)
  const startD = new Date(start + 'T00:00:00')
  const endD = new Date(end + 'T00:00:00')
  const startLabel = startD.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = endD.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return { start, end, label: `${startLabel} – ${endLabel}`, cycleLength }
}

function buildDays(
  startDate: string,
  endDate: string,
  tasks: Task[],
  schedules: Map<string, Schedule>
): MonthDay[] {
  const today = toISODateString(new Date())
  const taskMap = new Map<string, Task>()
  for (const task of tasks) taskMap.set(task.id, task)

  const days: MonthDay[] = []
  const cur = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  while (cur <= end) {
    const dateStr = toISODateString(cur)
    const dayOfWeek = cur.getDay()
    const schedule = schedules.get(dateStr)
    const dayTasks: MonthDayTask[] = []
    let habitCount = 0
    let highPriorityCount = 0

    if (schedule?.scheduled_tasks) {
      for (const st of schedule.scheduled_tasks) {
        if (st.is_buffer) continue
        const task = taskMap.get(st.task_id)
        if (!task) continue
        const isCompleted = schedule.completed_tasks?.includes(st.task_id) || task.status === 'completed'
        dayTasks.push({ id: st.task_id, title: task.title, is_habit: task.is_habit, is_completed: isCompleted, priority: task.priority })
        if (task.is_habit) habitCount++
        if (task.priority >= 4) highPriorityCount++
      }
    }

    days.push({
      date: dateStr,
      day: cur.getDate(),
      day_of_week: dayOfWeek,
      is_today: dateStr === today,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      has_schedule: dayTasks.length > 0,
      task_count: dayTasks.length,
      completed_count: dayTasks.filter(t => t.is_completed).length,
      habit_count: habitCount,
      high_priority_count: highPriorityCount,
      tasks: dayTasks,
    })

    cur.setDate(cur.getDate() + 1)
  }

  return days
}

function buildMonthViewData(
  year: number,
  month: number,
  tasks: Task[],
  schedules: Map<string, Schedule>
): PeriodViewData {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const days = buildDays(startDate, endDate, tasks, schedules)
  const totalScheduled = days.reduce((s, d) => s + d.task_count, 0)
  const totalCompleted = days.reduce((s, d) => s + d.completed_count, 0)
  const label = `${MONTH_NAMES[month - 1]} ${year}`
  return {
    year, month,
    month_name: MONTH_NAMES[month - 1],
    display_label: label,
    first_weekday: new Date(year, month - 1, 1).getDay(),
    days_in_month: lastDay,
    days,
    summary: {
      total_scheduled: totalScheduled,
      total_completed: totalCompleted,
      completion_rate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
    },
  }
}

function buildCycleViewData(
  cycleRange: CycleRange,
  tasks: Task[],
  schedules: Map<string, Schedule>
): PeriodViewData {
  const days = buildDays(cycleRange.start, cycleRange.end, tasks, schedules)
  const totalScheduled = days.reduce((s, d) => s + d.task_count, 0)
  const totalCompleted = days.reduce((s, d) => s + d.completed_count, 0)
  const [y, m] = cycleRange.start.split('-').map(Number)
  return {
    year: y, month: m,
    month_name: '',
    display_label: cycleRange.label,
    first_weekday: new Date(cycleRange.start + 'T00:00:00').getDay(),
    days_in_month: days.length,
    days,
    summary: {
      total_scheduled: totalScheduled,
      total_completed: totalCompleted,
      completion_rate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
    },
  }
}

function DayCell({ day, onClick, isSelected, cycleSeason }: {
  day: MonthDay
  onClick: () => void
  isSelected: boolean
  cycleSeason?: CycleSeason
}) {
  const hasHighPriority = day.high_priority_count > 0
  const completionRate = day.task_count > 0
    ? (day.completed_count / day.task_count) * 100
    : 0

  return (
    <button
      onClick={onClick}
      className={cn(
        "h-24 p-2 border rounded-md text-left transition-all hover:shadow-md relative overflow-hidden",
        day.is_today && "ring-2 ring-primary",
        !day.has_schedule && "opacity-50",
        isSelected && "ring-2 ring-primary shadow-lg"
      )}
      style={
        isSelected
          ? undefined
          : cycleSeason
            ? { backgroundColor: phaseFillColor[cycleSeason] }
            : undefined
      }
    >
      {/* Phase top accent stripe */}
      {cycleSeason && (
        <span
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: phaseStripColor[cycleSeason] }}
        />
      )}

      <div className="flex items-center justify-between mb-1 mt-0.5">
        <span className={cn(
          "text-sm font-medium",
          day.is_today && "bg-primary text-primary-foreground px-1.5 py-0.5 rounded"
        )}>
          {day.day}
        </span>
        <div className="flex items-center gap-1">
          {cycleSeason && (
            <span className="text-sm leading-none" title={`${phaseLabel[cycleSeason].name} phase`}>
              {phaseLabel[cycleSeason].emoji}
            </span>
          )}
          {hasHighPriority && (
            <span className="w-2 h-2 rounded-full bg-red-500" title="High priority tasks" />
          )}
        </div>
      </div>

      {day.task_count > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {completionRate === 100 ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <Circle className="h-3 w-3" />
            )}
            <span>{day.completed_count}/{day.task_count}</span>
          </div>

          {day.habit_count > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              {day.habit_count} habits
            </Badge>
          )}

          {/* Task preview dots */}
          <div className="flex flex-wrap gap-0.5 mt-1">
            {day.tasks.slice(0, 6).map((task, idx) => (
              <span
                key={idx}
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  task.is_completed ? "bg-green-500" :
                  task.priority >= 4 ? "bg-red-500" :
                  task.priority >= 3 ? "bg-yellow-500" : "bg-blue-500"
                )}
                title={task.title}
              />
            ))}
            {day.tasks.length > 6 && (
              <span className="text-[10px] text-muted-foreground">+{day.tasks.length - 6}</span>
            )}
          </div>
        </div>
      )}
    </button>
  )
}

export function MonthView() {
  const { tasks, schedules, loadSchedules, preferences } = useApp()
  const [loading, setLoading] = useState(true)
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1)
  const [cycleOffset, setCycleOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState<MonthDay | null>(null)
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'tasks' | 'habits'>('all')

  // Cycle mode: active when cycle tracking is on and has at least one period date
  const isCycleMode = !!(
    preferences?.cycle?.enabled &&
    (preferences.cycle.period_history?.length ?? 0) > 0
  )

  const cycleRange = useMemo(
    () => isCycleMode ? getCycleRange(preferences, cycleOffset) : null,
    [isCycleMode, preferences, cycleOffset]
  )

  // Load schedules for the visible period
  useEffect(() => {
    async function fetchSchedules() {
      setLoading(true)
      if (isCycleMode && cycleRange) {
        await loadSchedules(cycleRange.start, cycleRange.end)
      } else {
        const firstDay = new Date(currentYear, currentMonth - 1, 1)
        const lastDay = new Date(currentYear, currentMonth, 0)
        await loadSchedules(toISODateString(firstDay), toISODateString(lastDay))
      }
      setLoading(false)
    }
    fetchSchedules()
  }, [currentYear, currentMonth, isCycleMode, cycleRange, loadSchedules])

  const monthData = useMemo(() => {
    if (isCycleMode && cycleRange) {
      return buildCycleViewData(cycleRange, tasks, schedules)
    }
    return buildMonthViewData(currentYear, currentMonth, tasks, schedules)
  }, [isCycleMode, cycleRange, currentYear, currentMonth, tasks, schedules])

  // Apply schedule filter
  const filteredMonthData = useMemo(() => {
    if (scheduleFilter === 'all') return monthData

    const filteredDays = monthData.days.map(day => {
      const filteredTasks = day.tasks.filter(task =>
        scheduleFilter === 'habits' ? task.is_habit : !task.is_habit
      )
      return {
        ...day,
        tasks: filteredTasks,
        task_count: filteredTasks.length,
        completed_count: filteredTasks.filter(t => t.is_completed).length,
        habit_count: filteredTasks.filter(t => t.is_habit).length,
        high_priority_count: filteredTasks.filter(t => t.priority >= 4).length,
        has_schedule: filteredTasks.length > 0,
      }
    })

    const totalScheduled = filteredDays.reduce((s, d) => s + d.task_count, 0)
    const totalCompleted = filteredDays.reduce((s, d) => s + d.completed_count, 0)

    return {
      ...monthData,
      days: filteredDays,
      summary: {
        total_scheduled: totalScheduled,
        total_completed: totalCompleted,
        completion_rate: totalScheduled > 0 ? (totalCompleted / totalScheduled) * 100 : 0,
      }
    }
  }, [monthData, scheduleFilter])

  // Cycle phase per day — keyed by ISO date string (works for both calendar and cycle mode)
  const cyclePhaseDays = useMemo((): Map<string, CycleSeason> => {
    const map = new Map<string, CycleSeason>()
    if (!preferences?.cycle?.enabled) return map
    for (const day of monthData.days) {
      const date = new Date(day.date + 'T00:00:00')
      const phase = getCyclePhaseForDate(date, preferences.cycle)
      if (phase) map.set(day.date, phase.season)
    }
    return map
  }, [preferences, monthData.days])

  // Collapse into consecutive phase segments (position-based, works for any period length)
  const cyclePhaseSegments = useMemo(() => {
    if (cyclePhaseDays.size === 0) return []
    const days = monthData.days
    const totalDays = days.length
    const segments: Array<{ season: CycleSeason; startDay: number; endDay: number }> = []
    let current: CycleSeason | null = null
    let segStart = 1

    for (let i = 0; i < days.length; i++) {
      const season = cyclePhaseDays.get(days[i].date) ?? null
      if (season !== current) {
        if (current !== null) segments.push({ season: current, startDay: segStart, endDay: i })
        current = season
        segStart = i + 1
      }
    }
    if (current !== null) segments.push({ season: current, startDay: segStart, endDay: totalDays })
    return segments
  }, [cyclePhaseDays, monthData.days])

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDay(null)
    if (isCycleMode) {
      setCycleOffset(prev => prev + (direction === 'prev' ? -1 : 1))
    } else {
      let newMonth = currentMonth + (direction === 'prev' ? -1 : 1)
      let newYear = currentYear
      if (newMonth < 1) { newMonth = 12; newYear-- }
      else if (newMonth > 12) { newMonth = 1; newYear++ }
      setCurrentMonth(newMonth)
      setCurrentYear(newYear)
    }
  }

  const goToToday = () => {
    setSelectedDay(null)
    if (isCycleMode) {
      setCycleOffset(0)
    } else {
      const now = new Date()
      setCurrentYear(now.getFullYear())
      setCurrentMonth(now.getMonth() + 1)
    }
  }

  const handleDownloadICS = () => {
    if (isCycleMode && cycleRange) {
      const ics = buildICSForDateRange(cycleRange.start, cycleRange.end, schedules, tasks)
      downloadICS(`trackmind-cycle-${cycleRange.start}.ics`, ics)
    } else {
      const ics = buildICSForMonth(currentYear, currentMonth, schedules, tasks)
      const monthStr = String(currentMonth).padStart(2, '0')
      downloadICS(`trackmind-${currentYear}-${monthStr}.ics`, ics)
    }
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
          <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {isCycleMode ? 'Current Cycle' : 'Today'}
          </Button>
        </div>

        <h2 className="text-xl font-semibold">
          {monthData.display_label}
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
            <span>{filteredMonthData.summary.total_completed}/{filteredMonthData.summary.total_scheduled} tasks</span>
            <Badge variant={filteredMonthData.summary.completion_rate >= 70 ? "default" : "secondary"}>
              {filteredMonthData.summary.completion_rate.toFixed(0)}% complete
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadICS}
            disabled={filteredMonthData.summary.total_scheduled === 0}
            title="Download this period's schedule as a calendar file (importable into Google Calendar)"
          >
            <Download className="h-4 w-4 mr-2" />
            Export to Calendar
          </Button>
        </div>
      </div>

      {/* Cycle phase timeline bar */}
      {cyclePhaseSegments.length > 0 && (() => {
        const totalDays = monthData.days_in_month
        return (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">
              {isCycleMode ? 'Cycle phases' : 'Cycle phases this month'}
            </p>
            <div className="flex w-full rounded-lg overflow-hidden border border-border/50 h-10">
              {cyclePhaseSegments.map((seg, i) => {
                const pct = ((seg.endDay - seg.startDay + 1) / totalDays) * 100
                const days = seg.endDay - seg.startDay + 1
                const color = phaseStripColor[seg.season]
                const fill  = phaseFillColor[seg.season]
                const label = phaseLabel[seg.season]
                return (
                  <div
                    key={i}
                    style={{ width: `${pct}%`, backgroundColor: fill, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : undefined }}
                    className="flex flex-col justify-center px-2 overflow-hidden relative"
                    title={`${label.emoji} ${label.name}: days ${seg.startDay}–${seg.endDay}`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ backgroundColor: color }} />
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-xs leading-none">{label.emoji}</span>
                      {pct > 18 && (
                        <span className="text-xs font-medium truncate" style={{ color }}>
                          {pct > 28 ? label.name : label.short}
                        </span>
                      )}
                    </div>
                    {pct > 12 && (
                      <span className="text-[10px] text-muted-foreground leading-tight">
                        {seg.startDay}–{seg.endDay} ({days}d)
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Empty cells for days before the first day of the period */}
        {Array.from({ length: filteredMonthData.first_weekday }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-24" />
        ))}

        {/* Day cells */}
        {filteredMonthData.days.map((day) => (
          <DayCell
            key={day.date}
            day={day}
            onClick={() => setSelectedDay(day)}
            isSelected={selectedDay?.date === day.date}
            cycleSeason={cyclePhaseDays.get(day.date)}
          />
        ))}
      </div>

      {/* Selected day full schedule detail */}
      {selectedDay && (
        <DayScheduleDetail
          date={selectedDay.date}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  )
}

export default MonthView
