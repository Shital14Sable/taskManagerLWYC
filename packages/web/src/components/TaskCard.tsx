import { useState } from 'react'
import { Clock, Flame, Zap, Moon, Trash2, Edit, ChevronDown, ChevronRight, AlertCircle, Link2, Lock, PauseCircle, CalendarClock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  subtasks?: Task[]
  allTasks?: Task[]  // For resolving dependency names
  scheduledDate?: string | null  // When this task is scheduled
}

const energyIcons = {
  high: <Flame className="h-4 w-4 text-orange-500" />,
  medium: <Zap className="h-4 w-4 text-yellow-500" />,
  low: <Moon className="h-4 w-4 text-blue-400" />,
}

const priorityColors: Record<number, string> = {
  1: 'bg-gray-500',
  2: 'bg-blue-500',
  3: 'bg-yellow-500',
  4: 'bg-orange-500',
  5: 'bg-red-500',
}

// Get color for tag based on its category
const getTagColor = (tag: string): string => {
  if (tag.startsWith('Projects/')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  if (tag.startsWith('Work/')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
  if (tag.startsWith('Personal/')) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  if (tag.startsWith('Finance')) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  if (tag === 'urgent') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}

// Get display name for tag (last part of hierarchical tag)
const getTagDisplayName = (tag: string): string => {
  const parts = tag.split('/')
  return parts[parts.length - 1]
}

export function TaskCard({ task, onComplete, onEdit, onDelete, subtasks = [], allTasks = [], scheduledDate }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isCompleted = task.status === 'completed'

  // Filter out project tags for cleaner display (project is usually shown elsewhere)
  const displayTags = task.tags?.filter(t => !t.startsWith('Projects/')) || []

  // Get dependency tasks info
  const dependencyTasks = task.dependencies
    ?.map(depId => allTasks.find(t => t.id === depId))
    .filter((t): t is Task => t !== undefined) || []

  // Format scheduled date for display
  const formatScheduledDate = (dateStr: string): string => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Check if task is blocked (has incomplete dependencies)
  const blockedByTasks = dependencyTasks.filter(t => t.status !== 'completed')
  const isBlocked = blockedByTasks.length > 0

  return (
    <Card className={cn(
      "transition-all hover:shadow-md",
      isCompleted && "opacity-60",
      task.needs_review && "border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20",
      isBlocked && !isCompleted && "border-red-300/50 bg-red-50/20 dark:bg-red-950/10"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={() => !isCompleted && onComplete(task.id)}
            className="mt-1"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {subtasks.length > 0 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="p-0.5 hover:bg-accent rounded"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}

              <h3 className={cn(
                "font-medium truncate",
                isCompleted && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h3>

              {task.is_habit && (
                <Badge variant="secondary" className="text-xs">Habit</Badge>
              )}

              {task.is_paused && (
                <Badge variant="outline" className="text-xs text-gray-500 border-gray-400">
                  <PauseCircle className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              )}

              {task.needs_review && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Review
                </Badge>
              )}

              {isBlocked && !isCompleted && (
                <Badge variant="outline" className="text-xs text-red-600 border-red-400">
                  <Lock className="h-3 w-3 mr-1" />
                  Blocked
                </Badge>
              )}

              {dependencyTasks.length > 0 && !isBlocked && (
                <Badge variant="outline" className="text-xs text-gray-500">
                  <Link2 className="h-3 w-3 mr-1" />
                  {dependencyTasks.length} dep
                </Badge>
              )}

              {/* Scheduled date - only show for non-completed tasks */}
              {scheduledDate && !isCompleted && !task.is_habit && (
                <Badge variant="outline" className="text-xs text-blue-600 border-blue-400">
                  <CalendarClock className="h-3 w-3 mr-1" />
                  {formatScheduledDate(scheduledDate)}
                </Badge>
              )}

              {/* Unscheduled indicator */}
              {!scheduledDate && !isCompleted && !task.is_habit && !task.is_paused && (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Unscheduled
                </Badge>
              )}
            </div>

            {/* Tags display */}
            {displayTags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {displayTags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                      getTagColor(tag)
                    )}
                    title={tag}
                  >
                    {getTagDisplayName(tag)}
                  </span>
                ))}
                {displayTags.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{displayTags.length - 3} more
                  </span>
                )}
              </div>
            )}

            {task.description && (
              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Blocked by info */}
            {blockedByTasks.length > 0 && !isCompleted && (
              <div className="flex items-center gap-1 mb-2 text-xs text-red-600 dark:text-red-400">
                <Lock className="h-3 w-3" />
                <span>Blocked by: </span>
                {blockedByTasks.slice(0, 2).map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ', '}
                    <span className="font-medium">{t.title}</span>
                  </span>
                ))}
                {blockedByTasks.length > 2 && (
                  <span className="text-muted-foreground">+{blockedByTasks.length - 2} more</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.estimated_minutes}m
              </span>

              <span className="flex items-center gap-1">
                {energyIcons[task.energy_level]}
                {task.energy_level}
              </span>

              <span className={cn(
                "w-2 h-2 rounded-full",
                priorityColors[task.priority]
              )} title={`Priority ${task.priority}`} />

              {task.deadline && (
                <span className="text-orange-500">
                  Due: {new Date(task.deadline).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(task)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {expanded && subtasks.length > 0 && (
          <div className="mt-3 ml-8 pl-3 border-l-2 border-muted space-y-2">
            {subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={subtask.status === 'completed'}
                  onCheckedChange={() => subtask.status !== 'completed' && onComplete(subtask.id)}
                  className="h-3 w-3"
                />
                <span className={cn(
                  subtask.status === 'completed' && "line-through text-muted-foreground"
                )}>
                  {subtask.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
