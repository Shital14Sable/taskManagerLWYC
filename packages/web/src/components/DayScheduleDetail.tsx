import { useMemo } from 'react'
import { Calendar, CheckCircle, Clock, X, Flame, Zap, Moon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useApp } from '@/context/AppContext'
import { useTasks } from '@/hooks/useTasks'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface DayScheduleDetailProps {
  date: string
  onClose: () => void
  onCompleteTask?: (id: string, forDate?: string) => void
}

const energyIcons = {
  high: <Flame className="h-3 w-3 text-orange-500" />,
  medium: <Zap className="h-3 w-3 text-yellow-500" />,
  low: <Moon className="h-3 w-3 text-blue-400" />,
}

export function DayScheduleDetail({ date, onClose, onCompleteTask }: DayScheduleDetailProps) {
  const { tasks, schedules } = useApp()
  const { completeTask } = useTasks()

  // Get schedule for this date from local storage
  const schedule = useMemo(() => {
    return schedules.get(date) || null
  }, [schedules, date])

  const getTaskById = (id: string) => tasks.find((t) => t.id === id)

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':')
    const h = parseInt(hours)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 || 12
    return `${hour12}:${minutes} ${ampm}`
  }

  const isTaskCompleted = (taskId: string) => {
    return schedule?.completed_tasks.includes(taskId) ||
           getTaskById(taskId)?.status === 'completed'
  }

  const handleCompleteTask = async (taskId: string) => {
    const task = getTaskById(taskId)
    if (onCompleteTask) {
      // Pass the scheduled date for habits
      onCompleteTask(taskId, task?.is_habit ? date : undefined)
    } else {
      // Complete task using useTasks hook
      // For habits, pass the scheduled date so it's recorded correctly
      try {
        await completeTask(taskId, task?.is_habit ? { forDate: date } : undefined)
      } catch (err) {
        console.error('Failed to complete task:', err)
      }
    }
  }

  // Parse date correctly to avoid timezone issues
  // When parsing YYYY-MM-DD, we need to treat it as local time, not UTC
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
  }

  const dateObj = parseLocalDate(date)
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const isToday = date === todayStr
  const isPast = dateObj < new Date(today.getFullYear(), today.getMonth(), today.getDate())

  return (
    <Card className={cn(
      "border-2",
      isToday && "border-primary"
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle className="text-lg">
            {formattedDate}
            {isToday && (
              <Badge variant="default" className="ml-2">Today</Badge>
            )}
          </CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent>
        {!schedule ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No schedule for this day.</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xl font-bold text-primary">
                  {schedule.summary?.tasks_completed ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xl font-bold">
                  {schedule.summary?.tasks_remaining ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xl font-bold text-green-500">
                  {Math.round(schedule.summary?.completion_rate ?? 0)}%
                </div>
                <div className="text-xs text-muted-foreground">Progress</div>
              </div>
              <div className="text-center p-2 bg-muted rounded-lg">
                <div className="text-xl font-bold">
                  {schedule.summary?.total_scheduled_minutes ||
                   (schedule.scheduled_tasks || []).reduce((sum, t) => sum + t.estimated_minutes, 0)}m
                </div>
                <div className="text-xs text-muted-foreground">Total Time</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {(schedule.scheduled_tasks || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No tasks scheduled for this day.
                </p>
              ) : (
                (schedule.scheduled_tasks || []).map((scheduled) => {
                  const task = getTaskById(scheduled.task_id)
                  const completed = isTaskCompleted(scheduled.task_id)

                  if (scheduled.is_buffer) {
                    return (
                      <div
                        key={`buffer-${scheduled.start_time}`}
                        className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-lg text-sm text-muted-foreground"
                      >
                        <Clock className="h-4 w-4" />
                        <span>{formatTime(scheduled.start_time)} - {formatTime(scheduled.end_time)}</span>
                        <span>Break ({scheduled.estimated_minutes}m)</span>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={scheduled.task_id}
                      className={cn(
                        "flex items-center gap-3 py-3 px-4 rounded-lg border transition-colors",
                        completed ? "bg-green-500/10 border-green-500/30" : "hover:bg-accent"
                      )}
                    >
                      {/* Completion checkbox - only interactive if today or future */}
                      <button
                        onClick={() => !completed && !isPast && handleCompleteTask(scheduled.task_id)}
                        disabled={completed || isPast}
                        className={cn(
                          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          completed
                            ? "bg-green-500 border-green-500 text-white"
                            : isPast
                              ? "border-muted-foreground/30 cursor-not-allowed"
                              : "border-muted-foreground hover:border-primary cursor-pointer"
                        )}
                      >
                        {completed && <CheckCircle className="h-4 w-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-medium truncate",
                            completed && "line-through text-muted-foreground"
                          )}>
                            {task?.title || 'Unknown Task'}
                          </span>
                          {task && energyIcons[task.energy_level as keyof typeof energyIcons]}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(scheduled.start_time)} - {formatTime(scheduled.end_time)}
                          {' '}({scheduled.estimated_minutes}m)
                        </div>
                      </div>

                      {task?.is_habit && (
                        <Badge variant="secondary" className="text-xs">
                          Habit
                        </Badge>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
