import { RefreshCw, Calendar, CheckCircle, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Schedule, Task, Project } from '@/types'
import { cn } from '@/lib/utils'

interface ScheduleViewProps {
  schedule: Schedule | null
  tasks: Task[]
  projects: Project[]
  loading: boolean
  onReschedule: () => Promise<void>
  onCompleteTask: (id: string) => void
}

export function ScheduleView({
  schedule,
  tasks,
  projects,
  loading,
  onReschedule,
  onCompleteTask,
}: ScheduleViewProps) {
  const getTaskById = (id: string) => tasks.find((t) => t.id === id)
  const getProjectColor = (projectId: string) => projects.find((p) => p.id === projectId)?.color

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

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <CardTitle>Today's Schedule</CardTitle>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onReschedule}
          disabled={loading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Reschedule
        </Button>
      </CardHeader>

      <CardContent>
        {!schedule ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No schedule generated for today.</p>
            <p className="text-sm mt-1">Click Reschedule to generate one.</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {schedule.summary?.tasks_completed ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {schedule.summary?.tasks_remaining ?? 0}
                </div>
                <div className="text-xs text-muted-foreground">Remaining</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-500">
                  {Math.round(schedule.summary?.completion_rate ?? 0)}%
                </div>
                <div className="text-xs text-muted-foreground">Progress</div>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-2">
              {(schedule.scheduled_tasks || []).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No tasks scheduled for today.
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
                        <span>Break</span>
                      </div>
                    )
                  }

                  const projectColor = task ? getProjectColor(task.project_id) : null

                  return (
                    <div
                      key={scheduled.task_id}
                      className={cn(
                        "flex items-center gap-3 py-3 px-4 rounded-lg border transition-colors overflow-hidden",
                        completed ? "bg-green-500/10 border-green-500/30" : "hover:bg-accent"
                      )}
                      style={{
                        borderLeftWidth: projectColor ? '4px' : undefined,
                        borderLeftColor: projectColor || undefined,
                      }}
                    >
                      <button
                        onClick={() => !completed && onCompleteTask(scheduled.task_id)}
                        className={cn(
                          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                          completed
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-muted-foreground hover:border-primary"
                        )}
                      >
                        {completed && <CheckCircle className="h-4 w-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className={cn(
                          "font-medium truncate",
                          completed && "line-through text-muted-foreground"
                        )}>
                          {task?.title || 'Unknown Task'}
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
                      {task?.is_pinned && task?.pin_type === 'hard' && (
                        <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">
                          Fixed Time
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
