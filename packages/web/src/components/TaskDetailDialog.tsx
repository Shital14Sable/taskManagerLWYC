import { Flame, Zap, Moon, Calendar, FolderOpen, Clock, AlertCircle, Edit, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Task, Project, ScheduledTask } from '@/types'
import { cn } from '@/lib/utils'

interface TaskDetailDialogProps {
  task: Task | null
  scheduledTask?: ScheduledTask | null
  project?: Project | null
  isOpen: boolean
  onClose: () => void
  onEdit: (task: Task) => void
  onComplete?: (taskId: string) => void
  isCompleted?: boolean
}

const energyIcons = {
  high: <Flame className="h-4 w-4 text-orange-500" />,
  medium: <Zap className="h-4 w-4 text-yellow-500" />,
  low: <Moon className="h-4 w-4 text-blue-400" />,
}

const energyLabels = {
  high: 'High Energy',
  medium: 'Medium Energy',
  low: 'Low Energy',
}

const priorityColors = [
  'bg-gray-400',
  'bg-blue-400',
  'bg-yellow-400',
  'bg-orange-400',
  'bg-red-500',
]

const priorityLabels = ['Very Low', 'Low', 'Medium', 'High', 'Critical']

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  return `${hour12}:${minutes} ${ampm}`
}

const formatDeadline = (deadline: string) => {
  const date = new Date(deadline)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadlineDate = new Date(date)
  deadlineDate.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  if (diffDays < 0) {
    return { text: `${dateStr} (${Math.abs(diffDays)} days overdue)`, isOverdue: true }
  } else if (diffDays === 0) {
    return { text: `${dateStr} (Today)`, isOverdue: false, isToday: true }
  } else if (diffDays === 1) {
    return { text: `${dateStr} (Tomorrow)`, isOverdue: false }
  } else if (diffDays <= 7) {
    return { text: `${dateStr} (${diffDays} days)`, isOverdue: false }
  }

  return { text: dateStr, isOverdue: false }
}

export function TaskDetailDialog({
  task,
  scheduledTask,
  project,
  isOpen,
  onClose,
  onEdit,
  onComplete,
  isCompleted,
}: TaskDetailDialogProps) {
  if (!task) return null

  const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted && (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            )}
            <span className={cn(isCompleted && "text-muted-foreground line-through")}>
              {task.title}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            View task details including project, schedule, deadline, priority, and energy level
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Project */}
          {project && (
            <div className="flex items-center gap-2 text-sm">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Project:</span>
              <Badge variant="outline">{project.name}</Badge>
            </div>
          )}

          {/* Scheduled Time */}
          {scheduledTask && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Scheduled:</span>
              <span>
                {formatTime(scheduledTask.start_time)} - {formatTime(scheduledTask.end_time)}
                <span className="text-muted-foreground ml-1">
                  ({scheduledTask.estimated_minutes}m)
                </span>
              </span>
            </div>
          )}

          {/* Deadline */}
          {deadlineInfo && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className={cn(
                "h-4 w-4",
                deadlineInfo.isOverdue ? "text-red-500" : "text-muted-foreground"
              )} />
              <span className="text-muted-foreground">Deadline:</span>
              <span className={cn(
                deadlineInfo.isOverdue && "text-red-500 font-medium",
                deadlineInfo.isToday && "text-orange-500 font-medium"
              )}>
                {deadlineInfo.text}
              </span>
              {deadlineInfo.isOverdue && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          )}

          {/* Priority & Energy */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={cn("w-3 h-3 rounded-full", priorityColors[task.priority - 1])} />
              <span className="text-muted-foreground">Priority:</span>
              <span>{priorityLabels[task.priority - 1]}</span>
            </div>
            <div className="flex items-center gap-2">
              {energyIcons[task.energy_level]}
              <span>{energyLabels[task.energy_level]}</span>
            </div>
          </div>

          {/* Duration & Difficulty */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span>{task.estimated_minutes} minutes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Difficulty:</span>
              <span>{['Trivial', 'Easy', 'Medium', 'Hard', 'Complex'][task.difficulty - 1]}</span>
            </div>
          </div>

          {/* Status & Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
              {task.status.replace('_', ' ')}
            </Badge>
            {task.is_habit && (
              <Badge variant="outline" className="border-purple-500 text-purple-500">
                Habit
              </Badge>
            )}
            {task.is_paused && (
              <Badge variant="outline" className="border-yellow-500 text-yellow-500">
                Paused
              </Badge>
            )}
            {task.is_pinned && (
              <Badge variant="outline" className="border-blue-500 text-blue-500">
                Pinned ({task.pin_type})
              </Badge>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Description:</span>
              <p className="text-sm bg-muted/50 p-3 rounded-md">{task.description}</p>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Tags:</span>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          {onComplete && !isCompleted && (
            <Button
              variant="outline"
              onClick={() => {
                onComplete(task.id)
                onClose()
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Complete
            </Button>
          )}
          <Button onClick={() => {
            onEdit(task)
            onClose()
          }}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
