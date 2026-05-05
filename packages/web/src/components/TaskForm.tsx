import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { GitBranch, X, PauseCircle, Clock } from 'lucide-react'
import type { Task, Project, CreateTaskInput, Recurrence } from '@/types'

interface TaskFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateTaskInput) => Promise<void>
  projects: Project[]
  task?: Task | null
  parentTaskId?: string
  allTasks?: Task[]
}

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export function TaskForm({
  open,
  onClose,
  onSubmit,
  projects,
  task,
  parentTaskId,
  allTasks = [],
}: TaskFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<CreateTaskInput>({
    project_id: '',
    title: '',
    description: '',
    priority: 3,
    difficulty: 3,
    energy_level: 'medium',
    estimated_minutes: 60,
    is_habit: false,
  })
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'completed'>(
    'todo'
  )
  const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
  const [dependencySearch, setDependencySearch] = useState('')

  // Available tasks for dependencies (exclude current task and its subtasks)
  const availableForDependency = allTasks.filter(
    (t) =>
      t.id !== task?.id &&
      t.parent_task_id !== task?.id &&
      t.status !== 'completed'
  )

  // Filtered tasks based on search
  const filteredDependencyTasks = availableForDependency.filter((t) => {
    if (!dependencySearch.trim()) return true
    const search = dependencySearch.toLowerCase()
    const projectName =
      projects.find((p) => p.id === t.project_id)?.name?.toLowerCase() || ''
    return (
      t.title.toLowerCase().includes(search) || projectName.includes(search)
    )
  })
  const [recurrence, setRecurrence] = useState<Recurrence>({
    frequency: 'daily',
    days_of_week: [],
    time_of_day: '',
  })
  const [isPaused, setIsPaused] = useState(false)
  const [pausedUntil, setPausedUntil] = useState<string | undefined>(undefined)
  // Fixed time scheduling (meetings, appointments)
  const [isFixedTime, setIsFixedTime] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')

  useEffect(() => {
    if (task) {
      // Parse deadline - handle various formats
      let deadlineValue: string | undefined = undefined
      if (task.deadline) {
        // Handle ISO datetime (2025-01-06T00:00:00) or date string (2025-01-06)
        const dateStr = task.deadline.split('T')[0]
        // Validate it's a valid date format for input type="date" (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          deadlineValue = dateStr
        } else {
          // Try parsing as Date and converting (use local date, not UTC)
          const parsed = new Date(task.deadline)
          if (!isNaN(parsed.getTime())) {
            deadlineValue = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
          }
        }
      }

      setFormData({
        project_id: task.project_id,
        title: task.title,
        description: task.description || '',
        priority: task.priority,
        difficulty: task.difficulty,
        energy_level: task.energy_level,
        estimated_minutes: task.estimated_minutes,
        deadline: deadlineValue,
        is_habit: task.is_habit,
        parent_task_id: task.parent_task_id,
      })
      setStatus(task.status as 'todo' | 'in_progress' | 'completed')
      setSelectedDependencies(task.dependencies || [])
      // Always set recurrence - use task's recurrence or reset to defaults
      setRecurrence(task.recurrence || {
        frequency: 'daily',
        days_of_week: [],
        time_of_day: '',
      })
      // Load pause state for habits
      setIsPaused(task.is_paused || false)
      if (task.paused_until) {
        const pausedDate = task.paused_until.split('T')[0]
        setPausedUntil(pausedDate)
      } else {
        setPausedUntil(undefined)
      }
      // Load fixed time scheduling state
      if (task.is_pinned && task.pin_type === 'hard' && task.scheduled_for) {
        setIsFixedTime(true)
        const [datePart, timePart] = task.scheduled_for.split('T')
        setScheduledDate(datePart || '')
        setScheduledTime(timePart?.substring(0, 5) || '') // "HH:MM"
      } else {
        setIsFixedTime(false)
        setScheduledDate('')
        setScheduledTime('')
      }
    } else {
      setFormData({
        project_id: projects[0]?.id || '',
        title: '',
        description: '',
        priority: 3,
        difficulty: 3,
        energy_level: 'medium',
        estimated_minutes: 60,
        is_habit: false,
        parent_task_id: parentTaskId,
      })
      setStatus('todo')
      setSelectedDependencies([])
      setRecurrence({
        frequency: 'daily',
        days_of_week: [],
        time_of_day: '',
      })
      setIsPaused(false)
      setPausedUntil(undefined)
      setIsFixedTime(false)
      setScheduledDate('')
      setScheduledTime('')
    }
    setDependencySearch('') // Clear search when dialog opens/closes
  }, [task, parentTaskId, projects, open])

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault()
    setLoading(true)
    try {
      // Build the data object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {
        ...formData,
        // Convert date to datetime format for backend (YYYY-MM-DD -> YYYY-MM-DDT00:00:00)
        deadline: formData.deadline
          ? `${formData.deadline}T00:00:00`
          : undefined,
        recurrence: formData.is_habit ? recurrence : undefined,
        dependencies:
          selectedDependencies.length > 0 ? selectedDependencies : undefined,
        // Fixed time scheduling (meetings, appointments)
        is_pinned: isFixedTime,
        pin_type: isFixedTime ? 'hard' : 'soft',
        scheduled_for: isFixedTime && scheduledDate && scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00`
          : undefined,
      }

      // When editing, explicitly include status and deadline
      if (task) {
        data.status = status
        // Use null to clear deadline, ISO datetime string to set it
        // JSON.stringify excludes undefined but includes null
        // Backend expects datetime, so convert YYYY-MM-DD to YYYY-MM-DDT00:00:00
        data.deadline = formData.deadline
          ? `${formData.deadline}T00:00:00`
          : null

        // Include pause state for all tasks (habits and regular tasks)
        data.is_paused = isPaused
        data.paused_until = pausedUntil ? `${pausedUntil}` : null

        // Include fixed time scheduling state
        data.is_pinned = isFixedTime
        data.pin_type = isFixedTime ? 'hard' : 'soft'
        data.scheduled_for = isFixedTime && scheduledDate && scheduledTime
          ? `${scheduledDate}T${scheduledTime}:00`
          : null
      }

      await onSubmit(data)
      onClose()
    } catch (error) {
      console.error('Failed to save task:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleDependency = (taskId: string) => {
    setSelectedDependencies((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    )
  }

  const toggleDay = (day: string) => {
    setRecurrence((prev) => ({
      ...prev,
      days_of_week: prev.days_of_week?.includes(day)
        ? prev.days_of_week.filter((d) => d !== day)
        : [...(prev.days_of_week || []), day],
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {task ? 'Edit Task' : parentTaskId ? 'Add Subtask' : 'Add Task'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {task ? 'Edit task details' : parentTaskId ? 'Create a new subtask' : 'Create a new task'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto pr-2"
        >
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={formData.project_id}
              onValueChange={(value) =>
                setFormData({ ...formData, project_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Task title"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority (1-5)</Label>
              <Select
                value={String(formData.priority)}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p} -{' '}
                      {['Very Low', 'Low', 'Medium', 'High', 'Critical'][p - 1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty (1-5)</Label>
              <Select
                value={String(formData.difficulty)}
                onValueChange={(value) =>
                  setFormData({ ...formData, difficulty: Number(value) })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} -{' '}
                      {['Trivial', 'Easy', 'Medium', 'Hard', 'Complex'][d - 1]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="energy">Energy Level</Label>
              <Select
                value={formData.energy_level}
                onValueChange={(value: 'low' | 'medium' | 'high') =>
                  setFormData({ ...formData, energy_level: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated">Duration (minutes)</Label>
              <Input
                id="estimated"
                type="number"
                min={5}
                step={5}
                value={formData.estimated_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estimated_minutes: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="has_deadline"
                checked={formData.has_deadline}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, has_deadline: checked as boolean })
                }
              />
              <Label htmlFor="has_deadline">This has a deadline</Label>
            </div>
            {formData.has_deadline && (
              <div className="flex gap-2">
                <Input
                  id="deadline"
                  type="date"
                  value={formData.deadline || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deadline: e.target.value || undefined,
                    })
                  }
                  className="flex-1"
                />
              </div>
            )}
          </div>

          {/* Fixed Time Scheduling - only show for non-habits */}
          {!formData.is_habit && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_fixed_time"
                  checked={isFixedTime}
                  onCheckedChange={(checked) => {
                    setIsFixedTime(checked as boolean)
                    // Set defaults when enabling fixed time scheduling
                    if (checked) {
                      if (!scheduledDate) {
                        // Default to today's date (use local date, not UTC)
                        const today = new Date()
                        setScheduledDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`)
                      }
                      if (!scheduledTime) {
                        // Default to 9:00 AM
                        setScheduledTime('09:00')
                      }
                    }
                  }}
                />
                <Label htmlFor="is_fixed_time" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  This has a fixed time (meeting, appointment)
                </Label>
              </div>
              {isFixedTime && (
                <div className="ml-6 grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="scheduled_date" className="text-xs">Date</Label>
                    <Input
                      id="scheduled_date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="scheduled_time" className="text-xs">Time</Label>
                    <Input
                      id="scheduled_time"
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status - only show when editing existing task */}
          {task && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(value: 'todo' | 'in_progress' | 'completed') =>
                  setStatus(value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dependencies */}
          {availableForDependency.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Dependencies (must complete first)
              </Label>

              {/* Selected dependencies */}
              {selectedDependencies.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {selectedDependencies.map((depId) => {
                    const depTask = allTasks.find((t) => t.id === depId)
                    return depTask ? (
                      <Badge
                        key={depId}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {depTask.title}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-destructive"
                          onClick={() => toggleDependency(depId)}
                        />
                      </Badge>
                    ) : null
                  })}
                </div>
              )}

              {/* Search input */}
              <Input
                placeholder="Search tasks by name or project..."
                value={dependencySearch}
                onChange={(e) => setDependencySearch(e.target.value)}
                className="h-8 text-sm"
              />

              {/* Available tasks to add as dependencies */}
              <div className="max-h-32 overflow-y-auto rounded-md border p-2">
                <div className="space-y-1">
                  {filteredDependencyTasks
                    .filter((t) => !selectedDependencies.includes(t.id))
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex cursor-pointer items-center gap-2 rounded p-1.5 text-sm hover:bg-accent"
                        onClick={() => toggleDependency(t.id)}
                      >
                        <Checkbox
                          checked={selectedDependencies.includes(t.id)}
                          onCheckedChange={() => toggleDependency(t.id)}
                        />
                        <span className="flex-1 truncate">{t.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {projects.find((p) => p.id === t.project_id)?.name}
                        </span>
                      </div>
                    ))}
                  {filteredDependencyTasks.filter(
                    (t) => !selectedDependencies.includes(t.id)
                  ).length === 0 && (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      {dependencySearch
                        ? 'No matching tasks found'
                        : 'No available tasks'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_habit"
              checked={formData.is_habit}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, is_habit: checked as boolean })
                // Set default time if enabling habit and no time is set
                if (checked && !recurrence.time_of_day) {
                  setRecurrence({ ...recurrence, time_of_day: '09:00' })
                }
              }}
            />
            <Label htmlFor="is_habit">This is a recurring habit</Label>
          </div>

          {formData.is_habit && (
            <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={recurrence.frequency || 'daily'}
                  onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                    setRecurrence({ ...recurrence, frequency: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day}
                      type="button"
                      variant={
                        recurrence.days_of_week?.includes(day)
                          ? 'default'
                          : 'outline'
                      }
                      size="sm"
                      onClick={() => toggleDay(day)}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_of_day">Time of Day</Label>
                <Input
                  id="time_of_day"
                  type="time"
                  value={recurrence.time_of_day || ''}
                  onChange={(e) =>
                    setRecurrence({
                      ...recurrence,
                      time_of_day: e.target.value,
                    })
                  }
                />
              </div>

            </div>
          )}

          {/* Pause task/habit - only show when editing existing task */}
          {task && (
            <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_paused"
                  checked={isPaused}
                  onCheckedChange={(checked) => {
                    setIsPaused(checked as boolean)
                    if (!checked) {
                      setPausedUntil(undefined)
                    }
                  }}
                />
                <Label
                  htmlFor="is_paused"
                  className="flex items-center gap-2"
                >
                  <PauseCircle className="h-4 w-4" />
                  {formData.is_habit ? 'Pause this habit' : 'Pause this task'}
                </Label>
              </div>
              {isPaused && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="paused_until">Resume on (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="paused_until"
                      type="date"
                      value={pausedUntil || ''}
                      onChange={(e) =>
                        setPausedUntil(e.target.value || undefined)
                      }
                      className="flex-1"
                    />
                    {pausedUntil && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setPausedUntil(undefined)}
                        title="Pause indefinitely"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pausedUntil
                      ? `${formData.is_habit ? 'Habit' : 'Task'} will resume on ${new Date(
                          pausedUntil
                        ).toLocaleDateString()}`
                      : `${formData.is_habit ? 'Habit' : 'Task'} paused indefinitely until manually resumed`}
                  </p>
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={loading || !formData.title || !formData.project_id}
            onClick={handleSubmit}
          >
            {loading ? 'Saving...' : task ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
