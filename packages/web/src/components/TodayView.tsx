import { useState, useMemo, useRef, useEffect } from 'react'
import { RefreshCw, Calendar, CheckCircle, Clock, Flame, Zap, Moon, Target, UtensilsCrossed, ChevronLeft, ChevronRight, FolderOpen, ListTodo, Repeat, Edit2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { TaskFinder } from '@/components/TaskFinder'
import { HabitInstanceEditor, HabitInstanceBadge } from '@/components/HabitInstanceEditor'
import { TaskDetailDialog } from '@/components/TaskDetailDialog'
import { EmptyState, emptyStateConfigs } from '@/components/EmptyState'
import { TodaySidebar } from '@/components/sidebar'
import { useApp } from '@/context/AppContext'
import { getCyclePhaseForDate } from '@/utils/cycle'
import type { Schedule, Task, ScheduledTask, Project } from '@/types'
import { cn } from '@/lib/utils'

const phaseColors = {
  winter: { text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  spring: { text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  summer: { text: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
  autumn: { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
} as const

// Inline editable actual time component for completed tasks
function ActualTimeEditor({ task, estimatedMinutes }: { task: Task; estimatedMinutes: number }) {
  const { saveTask } = useApp()
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(task.actual_minutes?.toString() || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = async () => {
    const minutes = parseInt(value, 10)
    if (!isNaN(minutes) && minutes >= 0) {
      await saveTask({
        ...task,
        actual_minutes: minutes,
        updated_at: new Date().toISOString(),
      })
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setValue(task.actual_minutes?.toString() || '')
      setIsEditing(false)
    }
  }

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  if (isEditing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-6 w-16 text-xs px-1"
          placeholder={estimatedMinutes.toString()}
        />
        <span className="text-xs text-muted-foreground">min</span>
      </div>
    )
  }

  const hasActual = task.actual_minutes !== null && task.actual_minutes !== undefined
  const actualDisplay = hasActual ? formatDuration(task.actual_minutes!) : null
  const estimatedDisplay = formatDuration(estimatedMinutes)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setValue(task.actual_minutes?.toString() || estimatedMinutes.toString())
        setIsEditing(true)
      }}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground group"
      title="Click to log actual time"
    >
      {hasActual ? (
        <>
          <span className="line-through text-xs">{estimatedDisplay}</span>
          <span className="text-green-600 font-medium">{actualDisplay}</span>
        </>
      ) : (
        <>
          <span>{estimatedDisplay}</span>
          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-50" />
        </>
      )}
    </button>
  )
}

interface TodayViewProps {
  schedule: Schedule | null
  tasks: Task[]
  projects: Project[]
  loading: boolean
  onReschedule: () => Promise<void>
  onCompleteTask: (id: string, forDate?: string) => void
  onEditTask: (task: Task) => void
  selectedDate?: string // YYYY-MM-DD format
  onDateChange?: (date: string) => void
}

const energyIcons = {
  high: <Flame className="h-4 w-4 text-orange-500" />,
  medium: <Zap className="h-4 w-4 text-yellow-500" />,
  low: <Moon className="h-4 w-4 text-blue-400" />,
}

export function TodayView({
  schedule,
  tasks,
  projects,
  loading,
  onReschedule,
  onCompleteTask,
  onEditTask,
  selectedDate,
  onDateChange,
}: TodayViewProps) {
  const { preferences } = useApp()
  const [editingHabit, setEditingHabit] = useState<Task | null>(null)
  const [instanceRefreshKey, setInstanceRefreshKey] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedScheduledTask, setSelectedScheduledTask] = useState<ScheduledTask | null>(null)
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'tasks' | 'habits'>('all')

  const getTaskById = (id: string) => tasks.find((t) => t.id === id)
  const getProjectById = (id: string) => projects.find((p) => p.id === id)

  // Get today's date in local timezone (not UTC)
  const today = new Date()
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const currentDate = selectedDate || todayDateStr

  const handleTaskClick = (scheduled: ScheduledTask) => {
    setSelectedTaskId(scheduled.task_id)
    setSelectedScheduledTask(scheduled)
  }

  const handleCloseDetail = () => {
    setSelectedTaskId(null)
    setSelectedScheduledTask(null)
  }

  const selectedTask = selectedTaskId ? getTaskById(selectedTaskId) : null
  const selectedProject = selectedTask ? getProjectById(selectedTask.project_id) : null
  const isToday = currentDate === todayDateStr

  // Cycle phase for the currently-viewed date
  const cyclePhase = useMemo(() => {
    if (!preferences?.cycle?.enabled) return null
    const [y, m, d] = currentDate.split('-').map(Number)
    return getCyclePhaseForDate(new Date(y, m - 1, d), preferences.cycle)
  }, [preferences, currentDate])

  // Navigate to previous/next day
  const navigateDay = (direction: 'prev' | 'next') => {
    if (!onDateChange) return
    // Parse currentDate as local date (not UTC)
    const [year, month, day] = currentDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    if (direction === 'prev') {
      date.setDate(date.getDate() - 1)
    } else {
      date.setDate(date.getDate() + 1)
    }
    // Format as local date string
    const newDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    onDateChange(newDateStr)
  }

  const goToToday = () => {
    if (onDateChange) {
      onDateChange(todayDateStr)
    }
  }

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    let h = parseInt(hours)
    // Handle "24:00" as midnight (00:00)
    if (h >= 24) h = h - 24
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const isTaskCompleted = (taskId: string) => {
    const task = getTaskById(taskId)

    // For habits: ONLY check the day-specific completed_tasks list
    // Habits are recurring, so completion is per-day, not global
    if (task?.is_habit) {
      return (schedule?.completed_tasks || []).includes(taskId)
    }

    // For regular tasks: check both day-specific completion AND global status
    // Once a regular task is completed, it stays completed
    return (schedule?.completed_tasks || []).includes(taskId) ||
           task?.status === 'completed'
  }

  // Helper to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const [h, m] = timeStr.split(':').map(Number)
    return h * 60 + m
  }

  // Check if a scheduled task's time slot is in the past (only for today)
  const isTaskInPast = (scheduled: ScheduledTask): boolean => {
    if (!isToday) return false
    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const taskStartMinutes = timeToMinutes(scheduled.start_time)
    let taskEndMinutes = timeToMinutes(scheduled.end_time)

    // Handle midnight end time: "00:00" at end of day should be 1440, not 0
    // A task ending at "00:00" that starts in the evening (like 23:45-00:00) ends at midnight
    if (taskEndMinutes === 0 && taskStartMinutes > 720) {
      taskEndMinutes = 1440  // Treat as end of day
    }

    // For overnight schedules, we need to handle wrap-around
    const tasks = schedule?.scheduled_tasks || []
    const { isOvernight } = detectOvernightSchedule(tasks)

    if (isOvernight && tasks.length > 0) {
      const scheduleStartMin = timeToMinutes(tasks[0].start_time)
      const normCurrent = normalizeTime(currentMinutes, isOvernight, scheduleStartMin)
      const normTaskEnd = normalizeTime(taskEndMinutes, isOvernight, scheduleStartMin)
      return normTaskEnd < normCurrent
    }

    return taskEndMinutes < currentMinutes
  }

  // Helper to check if current time is within a time range (handles overnight)
  const isTimeInRange = (currentMin: number, startMin: number, endMin: number): boolean => {
    if (endMin <= startMin) {
      // Overnight range (e.g., 23:00 to 01:00)
      return currentMin >= startMin || currentMin < endMin
    }
    return currentMin >= startMin && currentMin <= endMin
  }

  // Detect if the schedule spans overnight (has tasks both before and after midnight)
  const detectOvernightSchedule = (tasks: ScheduledTask[]): { isOvernight: boolean; pivotIndex: number } => {
    if (tasks.length < 2) return { isOvernight: false, pivotIndex: -1 }

    // Find where times "wrap around" - where a task starts at a much smaller time than previous ended
    for (let i = 1; i < tasks.length; i++) {
      const prevEnd = timeToMinutes(tasks[i - 1].end_time)
      const currStart = timeToMinutes(tasks[i].start_time)
      // If current start is much smaller than previous end (e.g., 00:00 after 23:00), it's the pivot
      if (prevEnd > 720 && currStart < 720 && prevEnd - currStart > 720) {
        return { isOvernight: true, pivotIndex: i }
      }
    }
    return { isOvernight: false, pivotIndex: -1 }
  }

  // Normalize time for overnight schedule comparisons
  // Times after midnight in an overnight schedule are treated as 1440+ for ordering
  const normalizeTime = (minutes: number, isOvernight: boolean, scheduleStartMin: number): number => {
    if (!isOvernight) return minutes
    // If the schedule starts in PM (after noon) and this time is in AM (before noon),
    // add 1440 to treat it as "next day"
    if (scheduleStartMin >= 720 && minutes < 720) {
      return minutes + 1440
    }
    return minutes
  }

  // Calculate current time indicator position
  // Returns { taskIndex, progressPercent, remainingMinutes, elapsedMinutes, totalMinutes }
  // where taskIndex is which row and progressPercent is how far through that task
  const getCurrentTimeIndicator = () => {
    const tasks = schedule?.scheduled_tasks || []
    if (!schedule || tasks.length === 0 || !isToday) return null

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const { isOvernight } = detectOvernightSchedule(tasks)
    const scheduleStartMin = timeToMinutes(tasks[0].start_time)
    const normalizedCurrent = normalizeTime(currentMinutes, isOvernight, scheduleStartMin)

    // Find which task the current time falls within
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      const taskStart = timeToMinutes(task.start_time)
      const taskEnd = timeToMinutes(task.end_time)

      // Normalize for overnight comparison
      const normStart = normalizeTime(taskStart, isOvernight, scheduleStartMin)
      const normEnd = normalizeTime(taskEnd, isOvernight, scheduleStartMin)
      const totalMinutes = normEnd - normStart

      if (normalizedCurrent >= normStart && normalizedCurrent <= normEnd) {
        // Current time is within this task
        const elapsedMinutes = normalizedCurrent - normStart
        const remainingMinutes = normEnd - normalizedCurrent
        const progressPercent = totalMinutes > 0 ? (elapsedMinutes / totalMinutes) * 100 : 0
        return { taskIndex: i, progressPercent, remainingMinutes, elapsedMinutes, totalMinutes }
      }
    }

    // Check if current time is before first task or after last task
    const firstTask = tasks[0]
    const lastTask = tasks[tasks.length - 1]
    const scheduleStart = normalizeTime(timeToMinutes(firstTask.start_time), isOvernight, scheduleStartMin)
    const scheduleEnd = normalizeTime(timeToMinutes(lastTask.end_time), isOvernight, scheduleStartMin)

    if (normalizedCurrent < scheduleStart || normalizedCurrent > scheduleEnd) return null

    // Current time is between tasks - find the gap
    for (let i = 0; i < tasks.length - 1; i++) {
      const currentTask = tasks[i]
      const nextTask = tasks[i + 1]
      const currEnd = normalizeTime(timeToMinutes(currentTask.end_time), isOvernight, scheduleStartMin)
      const nextStart = normalizeTime(timeToMinutes(nextTask.start_time), isOvernight, scheduleStartMin)

      if (normalizedCurrent > currEnd && normalizedCurrent < nextStart) {
        // We're in a gap between tasks, show at end of current task
        return { taskIndex: i, progressPercent: 100, remainingMinutes: 0, elapsedMinutes: 0, totalMinutes: 0 }
      }
    }

    return null
  }

  const currentTimeIndicator = getCurrentTimeIndicator()

  // Calculate overall day progress (across the entire schedule)
  // Handles overnight schedules where end time < start time
  const getDayProgress = () => {
    const tasks = schedule?.scheduled_tasks || []
    if (!schedule || tasks.length === 0 || !isToday) return null

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const firstTask = tasks[0]
    const lastTask = tasks[tasks.length - 1]

    const scheduleStartMin = timeToMinutes(firstTask.start_time)
    let scheduleEndMin = timeToMinutes(lastTask.end_time)

    // Handle midnight end time: "00:00" should be 1440 when schedule starts earlier in the day
    if (scheduleEndMin === 0 && scheduleStartMin > 0) {
      scheduleEndMin = 1440  // Treat as end of day (midnight)
    }

    const { isOvernight } = detectOvernightSchedule(tasks)

    // Normalize times for overnight schedules
    const normStart = scheduleStartMin
    const normEnd = normalizeTime(scheduleEndMin, isOvernight, scheduleStartMin)
    const normCurrent = normalizeTime(currentMinutes, isOvernight, scheduleStartMin)

    const totalScheduleMinutes = normEnd - normStart

    if (normCurrent < normStart) {
      return { percent: 0, elapsed: 0, remaining: totalScheduleMinutes, total: totalScheduleMinutes, startTime: firstTask.start_time, endTime: lastTask.end_time }
    }
    if (normCurrent > normEnd) {
      return { percent: 100, elapsed: totalScheduleMinutes, remaining: 0, total: totalScheduleMinutes, startTime: firstTask.start_time, endTime: lastTask.end_time }
    }

    const elapsed = normCurrent - normStart
    const remaining = normEnd - normCurrent
    const percent = totalScheduleMinutes > 0 ? (elapsed / totalScheduleMinutes) * 100 : 0

    return { percent, elapsed, remaining, total: totalScheduleMinutes, startTime: firstTask.start_time, endTime: lastTask.end_time }
  }

  const dayProgress = getDayProgress()

  // Calculate vertical progress position based on task rows (not time)
  // Accounts for varying row heights (task rows are taller than break rows)
  const getVerticalProgressPositions = () => {
    const tasks = schedule?.scheduled_tasks || []
    if (!currentTimeIndicator || !schedule || tasks.length === 0) return null

    const currentRowIndex = currentTimeIndicator.taskIndex
    const progressWithinRow = currentTimeIndicator.progressPercent / 100

    // Calculate row weights based on type (tasks are taller than breaks)
    // Task rows: ~65px (py-3 + content + project info)
    // Break rows: ~40px (py-2 + simple content)
    const TASK_WEIGHT = 1.0
    const BREAK_WEIGHT = 0.6

    // Calculate the weight for each row
    const rowWeights = tasks.map(st => st.is_buffer ? BREAK_WEIGHT : TASK_WEIGHT)
    const totalWeight = rowWeights.reduce((sum, w) => sum + w, 0)

    // Calculate cumulative position up to current row
    let cumulativeWeight = 0
    for (let i = 0; i < currentRowIndex; i++) {
      cumulativeWeight += rowWeights[i]
    }

    const rowStartPercent = (cumulativeWeight / totalWeight) * 100
    const currentRowWeight = rowWeights[currentRowIndex]
    const rowHeightPercent = (currentRowWeight / totalWeight) * 100

    // Dot position is within the current row based on progress
    const dotPosition = rowStartPercent + (progressWithinRow * rowHeightPercent)

    return {
      fillPosition: Math.min(100, Math.max(0, rowStartPercent)),
      dotPosition: Math.min(100, Math.max(0, dotPosition))
    }
  }

  const verticalProgress = getVerticalProgressPositions()

  // Format duration to show hours when >= 60 minutes
  const formatDuration = (minutes: number) => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60)
      const mins = minutes % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    return `${minutes}m`
  }

  // Count habits for display
  const habitTasks = (schedule?.scheduled_tasks || []).filter(st => {
    const task = getTaskById(st.task_id)
    return task?.is_habit && !st.is_buffer
  })

  // Filter scheduled tasks based on filter selection
  const filteredScheduledTasks = useMemo(() => {
    const allTasks = schedule?.scheduled_tasks || []
    if (scheduleFilter === 'all') return allTasks

    return allTasks.filter(st => {
      // Always include buffers in filtered view
      if (st.is_buffer) return true

      const task = getTaskById(st.task_id)
      if (!task) return false

      if (scheduleFilter === 'habits') {
        return task.is_habit
      } else {
        // 'tasks' - only non-habit tasks
        return !task.is_habit
      }
    })
  }, [schedule?.scheduled_tasks, scheduleFilter, tasks])

  // Find next upcoming task (handles overnight schedules)
  const findNextTask = (): ScheduledTask | null => {
    if (!schedule) return null

    const tasks = schedule.scheduled_tasks || []
    if (tasks.length === 0) return null

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const { isOvernight } = detectOvernightSchedule(tasks)
    const scheduleStartMin = timeToMinutes(tasks[0].start_time)
    const normCurrent = normalizeTime(currentMinutes, isOvernight, scheduleStartMin)

    for (const st of tasks) {
      if (st.is_buffer) continue
      const taskStartMin = timeToMinutes(st.start_time)
      const normTaskStart = normalizeTime(taskStartMin, isOvernight, scheduleStartMin)

      if (normTaskStart > normCurrent && !isTaskCompleted(st.task_id)) {
        return st
      }
    }
    return null
  }

  const nextTask = findNextTask()
  const nextTaskDetails = nextTask ? getTaskById(nextTask.task_id) : null

  // Convert date string to Date object for sidebar
  const selectedDateObj = useMemo(() => {
    const [year, month, day] = currentDate.split('-').map(Number)
    return new Date(year, month - 1, day)
  }, [currentDate])

  // Handle date selection from sidebar calendar
  const handleSidebarDateSelect = (date: Date) => {
    if (!onDateChange) return
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    onDateChange(dateStr)
  }

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header with summary stats */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              {isToday ? "Today's Focus" : "Schedule"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {onDateChange && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <p className="text-muted-foreground min-w-[180px] text-center">
                {new Date(currentDate + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              {onDateChange && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateDay('next')}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {onDateChange && !isToday && (
                <Button variant="outline" size="sm" className="ml-2" onClick={goToToday}>
                  Today
                </Button>
              )}
            </div>

            {/* Cycle phase banner */}
            {cyclePhase && (() => {
              const c = phaseColors[cyclePhase.season]
              return (
                <div className={cn(
                  'mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm',
                  c.bg, c.border
                )}>
                  <span>{cyclePhase.emoji}</span>
                  <span className={cn('font-medium', c.text)}>
                    {cyclePhase.name}: {cyclePhase.phase}
                  </span>
                  {!cyclePhase.isOverride && cyclePhase.cycleDay > 0 && (
                    <span className="text-muted-foreground text-xs">Day {cyclePhase.cycleDay}</span>
                  )}
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className="text-muted-foreground text-xs capitalize">{cyclePhase.energyLevel} energy</span>
                  <span className="text-muted-foreground text-xs">·</span>
                  <span className={cn('text-xs italic', c.text)}>{cyclePhase.invitation}</span>
                </div>
              )
            })()}
          </div>
          <div className="flex items-center gap-3">
            {/* Schedule Filter Toggle */}
            <div className="flex items-center gap-1 border rounded-lg p-1">
              <Button
                variant={scheduleFilter === 'all' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setScheduleFilter('all')}
                className="h-7 px-2"
              >
                All
              </Button>
              <Button
                variant={scheduleFilter === 'tasks' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setScheduleFilter('tasks')}
                className="h-7 px-2 gap-1"
              >
                <ListTodo className="h-3 w-3" />
                Tasks
              </Button>
              <Button
                variant={scheduleFilter === 'habits' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setScheduleFilter('habits')}
                className="h-7 px-2 gap-1"
              >
                <Repeat className="h-3 w-3" />
                Habits
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={onReschedule}
              disabled={loading}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Reschedule All
            </Button>
          </div>
        </div>

      {!schedule ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-16 w-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No Schedule Generated</h3>
            <p className="text-muted-foreground mb-4">
              Click "Reschedule All" to generate your schedule for today.
            </p>
            <Button onClick={onReschedule} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              Generate Schedule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">
                  {schedule.summary?.tasks_completed ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">
                  {schedule.summary?.tasks_remaining ?? 0}
                </div>
                <div className="text-sm text-muted-foreground">Remaining</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-500">
                  {Math.round(schedule.summary?.completion_rate ?? 0)}%
                </div>
                <div className="text-sm text-muted-foreground">Progress</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold">
                  {habitTasks.length}
                </div>
                <div className="text-sm text-muted-foreground">Habits</div>
              </CardContent>
            </Card>
          </div>

          {/* Next Task Highlight */}
          {nextTask && nextTaskDetails && (
            <Card
              className="border-primary bg-primary/5"
              style={{
                borderLeftWidth: getProjectById(nextTaskDetails.project_id)?.color ? '4px' : undefined,
                borderLeftColor: getProjectById(nextTaskDetails.project_id)?.color || undefined,
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Up Next
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{nextTaskDetails.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatTime(nextTask.start_time)} - {formatTime(nextTask.end_time)}
                      </span>
                      <span className="flex items-center gap-1">
                        {energyIcons[nextTaskDetails.energy_level as keyof typeof energyIcons]}
                        {nextTaskDetails.energy_level}
                      </span>
                      {nextTaskDetails.is_habit && (
                        <Badge variant="secondary">Habit</Badge>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => onCompleteTask(nextTask.task_id, nextTaskDetails.is_habit ? currentDate : undefined)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Schedule Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Schedule
                <Badge variant="secondary" className="ml-2">
                  {filteredScheduledTasks.filter(st => !st.is_buffer).length} {scheduleFilter === 'all' ? 'tasks' : scheduleFilter}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Overall Day Progress Bar */}
              {dayProgress && (
                <div className="mb-4 pb-4 border-b">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span className="font-mono">{formatTime(dayProgress.startTime)}</span>
                    <div className="flex flex-col items-center">
                      <span className="text-sm font-bold text-red-500">
                        {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDuration(dayProgress.elapsed)} elapsed · {formatDuration(dayProgress.remaining)} remaining
                      </span>
                    </div>
                    <span className="font-mono">{formatTime(dayProgress.endTime)}</span>
                  </div>
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    {/* Progress fill */}
                    <div
                      className="absolute inset-y-0 left-0 bg-red-500/30 transition-all duration-1000"
                      style={{ width: `${dayProgress.percent}%` }}
                    />
                    {/* Current position indicator */}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow-md transition-all duration-1000"
                      style={{ left: `${dayProgress.percent}%`, marginLeft: '-6px' }}
                    />
                  </div>
                  <div className="text-center text-xs text-muted-foreground mt-1">
                    {Math.round(dayProgress.percent)}% of scheduled day complete
                  </div>
                </div>
              )}

              {/* Task list with vertical day progress indicator */}
              <div className="flex gap-3">
                {/* Vertical day progress track */}
                {verticalProgress !== null && filteredScheduledTasks.length > 0 && (
                  <div className="relative w-2 flex-shrink-0">
                    {/* Track background */}
                    <div className="absolute inset-0 bg-muted rounded-full" />
                    {/* Progress fill - fills completed rows */}
                    <div
                      className="absolute top-0 left-0 right-0 bg-red-500/40 rounded-full transition-all duration-1000"
                      style={{ height: `${verticalProgress.dotPosition}%` }}
                    />
                    {/* Current position marker */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded-full shadow-lg border-2 border-background z-10 transition-all duration-1000"
                      style={{ top: `${verticalProgress.dotPosition}%`, marginTop: '-8px' }}
                    >
                      {/* Pulse animation */}
                      <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30" />
                    </div>
                  </div>
                )}

                {/* Task list */}
                <div className="flex-1 space-y-2">
                  {filteredScheduledTasks.length === 0 ? (
                    <EmptyState
                      icon={Calendar}
                      title={scheduleFilter === 'all' ? emptyStateConfigs.schedule.title : `No ${scheduleFilter} scheduled`}
                      description={scheduleFilter === 'all' ? emptyStateConfigs.schedule.description : `No ${scheduleFilter} are scheduled for today. Try selecting "All" to see the full schedule.`}
                      action={scheduleFilter === 'all' ? {
                        label: 'Reschedule Now',
                        onClick: onReschedule,
                        icon: RefreshCw,
                      } : undefined}
                      compact
                    />
                  ) : (
                    filteredScheduledTasks.map((scheduled, index) => {
                    const task = getTaskById(scheduled.task_id)
                    const completed = isTaskCompleted(scheduled.task_id)
                    const isPast = !completed && isTaskInPast(scheduled)
                    const isCurrentTaskRow = currentTimeIndicator?.taskIndex === index

                    if (scheduled.is_buffer) {
                      return (
                        <div key={`buffer-${scheduled.start_time}`} className="relative overflow-hidden rounded-lg">
                          {/* Progress fill background for current task */}
                          {isCurrentTaskRow && (
                            <div
                              className="absolute inset-0 bg-red-500/10 pointer-events-none transition-all duration-1000"
                              style={{ clipPath: `inset(0 ${100 - currentTimeIndicator.progressPercent}% 0 0)` }}
                            />
                          )}
                          {/* Current time indicator line for this row */}
                          {isCurrentTaskRow && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                              style={{ left: `${currentTimeIndicator.progressPercent}%` }}
                            >
                              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500" />
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-red-500 font-medium whitespace-nowrap">Now</span>
                            </div>
                          )}
                          <div className="relative flex items-center gap-4 py-2 px-4 bg-muted/50 text-sm text-muted-foreground">
                            <div className="w-20 text-right font-mono text-xs">
                              {formatTime(scheduled.start_time)}
                            </div>
                            <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/30 flex-shrink-0" />
                            <div className="flex-1">
                              <span>Break</span>
                            </div>
                            <div className="text-xs flex items-center gap-2">
                              <span>{formatDuration(scheduled.estimated_minutes)}</span>
                              {isCurrentTaskRow && currentTimeIndicator.remainingMinutes > 0 && (
                                <span className="text-red-500 font-medium">
                                  ({formatDuration(currentTimeIndicator.remainingMinutes)} left)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }

                    const project = task ? getProjectById(task.project_id) : null
                    const hasDeadline = task?.deadline
                    const deadlineDate = hasDeadline ? new Date(task.deadline!) : null
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const isOverdue = deadlineDate && deadlineDate < today
                    const isDeadlineToday = deadlineDate && deadlineDate.toDateString() === today.toDateString()

                    return (
                      <div key={scheduled.task_id} className="relative overflow-hidden rounded-lg">
                        {/* Progress fill background for current task */}
                        {isCurrentTaskRow && !completed && (
                          <div
                            className="absolute inset-0 bg-red-500/10 pointer-events-none transition-all duration-1000"
                            style={{ clipPath: `inset(0 ${100 - currentTimeIndicator.progressPercent}% 0 0)` }}
                          />
                        )}
                        {/* Current time indicator line for this row */}
                        {isCurrentTaskRow && !completed && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
                            style={{ left: `${currentTimeIndicator.progressPercent}%` }}
                          >
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-red-500" />
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-red-500 font-medium whitespace-nowrap">Now</span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "relative flex items-center gap-4 py-3 px-4 border transition-all cursor-pointer",
                            completed
                              ? "bg-green-500/10 border-green-500/30"
                              : isPast
                              ? "bg-orange-500/5 border-orange-500/20 opacity-70"
                              : "hover:bg-accent hover:shadow-sm"
                          )}
                          style={{
                            borderLeftWidth: project?.color ? '4px' : undefined,
                            borderLeftColor: project?.color || undefined,
                          }}
                          onClick={() => handleTaskClick(scheduled)}
                        >
                          {/* Time */}
                          <div className="w-20 text-right font-mono text-xs text-muted-foreground">
                            {formatTime(scheduled.start_time)}
                          </div>

                          {/* Completion checkbox */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              !completed && onCompleteTask(scheduled.task_id, task?.is_habit ? currentDate : undefined)
                            }}
                            className={cn(
                              "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                              completed
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-muted-foreground hover:border-primary hover:bg-primary/10"
                            )}
                          >
                            {completed && <CheckCircle className="h-4 w-4" />}
                          </button>

                          {/* Task info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "font-medium",
                                completed && "line-through text-muted-foreground"
                              )}>
                                {task?.title || 'Unknown Task'}
                              </span>
                              {/* Show habit instance detail (e.g., "Lunch - Fried Rice") */}
                              {task?.is_habit && (
                                <HabitInstanceBadge
                                  key={instanceRefreshKey}
                                  habitId={task.id}
                                  date={currentDate}
                                  onEdit={() => setEditingHabit(task)}
                                />
                              )}
                              {task && energyIcons[task.energy_level as keyof typeof energyIcons]}
                              {task?.is_habit && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs cursor-pointer hover:bg-secondary/80"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    task && setEditingHabit(task)
                                  }}
                                >
                                  <UtensilsCrossed className="h-3 w-3 mr-1" />
                                  Habit
                                </Badge>
                              )}
                              {isPast && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-orange-500 border-orange-500/50"
                                >
                                  <Clock className="h-3 w-3 mr-1" />
                                  Missed
                                </Badge>
                              )}
                            </div>
                            {/* Project and Deadline info */}
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {project && (
                                <span className="flex items-center gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  {project.name}
                                </span>
                              )}
                              {hasDeadline && (
                                <span className={cn(
                                  "flex items-center gap-1",
                                  isOverdue && "text-red-500",
                                  isDeadlineToday && "text-orange-500"
                                )}>
                                  <Calendar className="h-3 w-3" />
                                  {deadlineDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  {isOverdue && " (overdue)"}
                                  {isDeadlineToday && " (today)"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Duration and remaining time */}
                          <div className="text-sm text-muted-foreground flex flex-col items-end">
                            {completed && task ? (
                              <ActualTimeEditor task={task} estimatedMinutes={scheduled.estimated_minutes} />
                            ) : (
                              <span>{formatDuration(scheduled.estimated_minutes)}</span>
                            )}
                            {isCurrentTaskRow && !completed && currentTimeIndicator.remainingMinutes > 0 && (
                              <span className="text-xs text-red-500 font-medium">
                                {formatDuration(currentTimeIndicator.remainingMinutes)} left
                              </span>
                            )}
                          </div>

                          {/* End time */}
                          <div className="w-20 font-mono text-xs text-muted-foreground">
                            {formatTime(scheduled.end_time)}
                          </div>
                        </div>
                      </div>
                    )
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Finder */}
          <TaskFinder
            tasks={tasks}
            projects={projects}
            scheduledTasks={schedule.scheduled_tasks || []}
            onSelectTask={(task) => {
              // Could add functionality to highlight/scroll to task
              console.log('Selected task:', task)
            }}
          />
        </>
      )}

      {/* Habit Instance Editor Dialog */}
      {editingHabit && (
        <HabitInstanceEditor
          habit={editingHabit}
          date={currentDate}
          isOpen={!!editingHabit}
          onClose={() => setEditingHabit(null)}
          onSave={() => setInstanceRefreshKey(k => k + 1)}
        />
      )}

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask || null}
        scheduledTask={selectedScheduledTask}
        project={selectedProject}
        isOpen={!!selectedTaskId}
        onClose={handleCloseDetail}
        onEdit={onEditTask}
        onComplete={(taskId) => onCompleteTask(taskId, selectedTask?.is_habit ? currentDate : undefined)}
        isCompleted={selectedTaskId ? isTaskCompleted(selectedTaskId) : false}
      />
      </div>

      {/* Right Sidebar */}
      <TodaySidebar
        selectedDate={selectedDateObj}
        onDateSelect={handleSidebarDateSelect}
      />
    </div>
  )
}
