import { useState, useMemo } from 'react'
import {
  ArrowLeft, Plus, Clock, Target, CheckCircle2, AlertCircle,
  Calendar, TrendingUp, Edit, Trash2, RefreshCw, ListTodo,
  Flame, Zap, Moon, MoreVertical, Play, Pause, Archive, Check,
  FolderOpen, ChevronRight, Shuffle, ChevronDown, Link2, Lock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { distributeCycleTasks } from '@/utils/cycle'
import type { Project, Task } from '@/types'
import { cn } from '@/lib/utils'
import { v4 as uuidv4 } from 'uuid'

interface ProjectViewProps {
  projectId: string
  onBack: () => void
  onEditTask: (task: Task) => void
  onAddSubtask?: (parentTask: Task) => void
  onEditProject?: (project: Project) => void
  onSelectProject?: (projectId: string) => void
}

const priorityColors: Record<number, string> = {
  1: '#6b7280', // gray
  2: '#3b82f6', // blue
  3: '#eab308', // yellow
  4: '#f97316', // orange
  5: '#ef4444', // red
}

const priorityLabels: Record<number, string> = {
  1: 'Very Low',
  2: 'Low',
  3: 'Medium',
  4: 'High',
  5: 'Critical',
}

const statusColors: Record<string, string> = {
  todo: '#6b7280',
  in_progress: '#3b82f6',
  completed: '#22c55e',
  blocked: '#ef4444',
}

const statusLabels: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}

const energyIcons = {
  high: <Flame className="h-4 w-4 text-orange-500" />,
  medium: <Zap className="h-4 w-4 text-yellow-500" />,
  low: <Moon className="h-4 w-4 text-blue-400" />,
}

export function ProjectView({ projectId, onBack, onEditTask, onAddSubtask, onEditProject, onSelectProject }: ProjectViewProps) {
  const { projects, tasks: allTasks, saveProject, saveTask, deleteTask, preferences, schedules } = useApp()
  const { completeTask, uncompleteTask } = useTasks(projectId)
  const { getChildProjects, unpauseAllSubprojects } = useProjects()
  const [quickTaskTitle, setQuickTaskTitle] = useState('')
  const [quickTaskPriority, setQuickTaskPriority] = useState(3)
  const [creatingTask, setCreatingTask] = useState(false)
  const [taskFilter, setTaskFilter] = useState<'all' | 'remaining' | 'completed'>('remaining')
  const [unpausingSubprojects, setUnpausingSubprojects] = useState(false)
  const [editingDeadline, setEditingDeadline] = useState(false)
  const [deadlineInput, setDeadlineInput] = useState('')
  const [distributing, setDistributing] = useState(false)
  const [distributeResult, setDistributeResult] = useState<{
    count: number
    days: number
    byPhase: Record<string, number>
  } | null>(null)
  const [clearingDates, setClearingDates] = useState(false)

  // Get project and tasks from local storage
  const project = useMemo(() => projects.find(p => p.id === projectId) || null, [projects, projectId])
  const allProjectItems = useMemo(() => allTasks.filter(t => t.project_id === projectId), [allTasks, projectId])
  // Separate habits and regular tasks
  const tasks = useMemo(() => allProjectItems.filter(t => !t.is_habit), [allProjectItems])
  const habits = useMemo(() => allProjectItems.filter(t => t.is_habit), [allProjectItems])
  const loading = false // Data is already loaded from context

  // Check if project has paused sub-projects
  const childProjects = useMemo(() => getChildProjects(projectId), [projectId, getChildProjects])
  const hasPausedSubprojects = useMemo(() => {
    const checkForPausedChildren = (parentId: string): boolean => {
      const children = getChildProjects(parentId)
      return children.some(child => child.status === 'paused' || checkForPausedChildren(child.id))
    }
    return checkForPausedChildren(projectId)
  }, [projectId, getChildProjects])

  // Handle unpause all sub-projects
  const handleUnpauseSubprojects = async () => {
    setUnpausingSubprojects(true)
    try {
      await unpauseAllSubprojects(projectId)
    } finally {
      setUnpausingSubprojects(false)
    }
  }

  // Compute task statistics (regular tasks only)
  const taskStats = useMemo(() => {
    const total = tasks.length
    const byStatus = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    }
    const byPriority = {
      1: tasks.filter(t => t.status !== 'completed' && t.priority === 1).length,
      2: tasks.filter(t => t.status !== 'completed' && t.priority === 2).length,
      3: tasks.filter(t => t.status !== 'completed' && t.priority === 3).length,
      4: tasks.filter(t => t.status !== 'completed' && t.priority === 4).length,
      5: tasks.filter(t => t.status !== 'completed' && t.priority === 5).length,
    }
    const paused = tasks.filter(t => t.is_paused).length
    const remaining = total - byStatus.completed
    const completionRate = total > 0 ? (byStatus.completed / total) * 100 : 0
    const totalEstimated = tasks.reduce((sum, t) => sum + t.estimated_minutes, 0)
    const remainingEstimated = tasks
      .filter(t => t.status !== 'completed')
      .reduce((sum, t) => sum + t.estimated_minutes, 0)
    const completedActual = tasks
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + (t.actual_minutes || t.estimated_minutes), 0)

    return {
      total,
      byStatus,
      byPriority,
      paused,
      remaining,
      completionRate,
      totalEstimated,
      remainingEstimated,
      completedActual
    }
  }, [tasks])

  // Compute habit statistics
  const habitStats = useMemo(() => {
    const total = habits.length
    const active = habits.filter(h => !h.is_paused).length
    const paused = habits.filter(h => h.is_paused).length
    return { total, active, paused }
  }, [habits])

  // Build a lookup: task_id → { date, startTime, endTime }
  // Scans all loaded schedules so TaskRow can show "Scheduled: Mon Jun 10 · 9:00–10:00"
  const taskScheduleMap = useMemo(() => {
    const map = new Map<string, { date: string; startTime: string; endTime: string }>()
    for (const [date, schedule] of schedules) {
      for (const st of schedule.scheduled_tasks ?? []) {
        if (!st.is_buffer && st.task_id) {
          map.set(st.task_id, { date, startTime: st.start_time, endTime: st.end_time })
        }
      }
    }
    return map
  }, [schedules])

  // Filter tasks for display
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(t => !t.parent_task_id) // Exclude subtasks
    if (taskFilter === 'remaining') {
      filtered = filtered.filter(t => t.status !== 'completed')
    } else if (taskFilter === 'completed') {
      filtered = filtered.filter(t => t.status === 'completed')
    }
    // Sort by priority (high first), then by deadline
    return filtered.sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1
      if (a.status !== 'completed' && b.status === 'completed') return -1
      if (b.priority !== a.priority) return b.priority - a.priority
      if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
      if (a.deadline) return -1
      if (b.deadline) return 1
      return 0
    })
  }, [tasks, taskFilter])

  // Quick task creation
  const handleQuickCreate = async () => {
    if (!quickTaskTitle.trim()) return
    setCreatingTask(true)
    try {
      const now = new Date().toISOString()
      const newTask: Task = {
        id: uuidv4(),
        project_id: projectId,
        title: quickTaskTitle.trim(),
        description: '',
        priority: quickTaskPriority,
        difficulty: 3,
        energy_level: 'medium',
        estimated_minutes: 60,
        actual_minutes: 0,
        status: 'todo',
        tags: [],
        dependencies: [],
        is_habit: false,
        is_paused: false,
        created_at: now,
        updated_at: now,
      }
      await saveTask(newTask)
      setQuickTaskTitle('')
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setCreatingTask(false)
    }
  }

  // Task actions
  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId)
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  const handleUncompleteTask = async (taskId: string) => {
    try {
      await uncompleteTask(taskId)
    } catch (error) {
      console.error('Failed to uncomplete task:', error)
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return
    try {
      await deleteTask(taskId)
    } catch (error) {
      console.error('Failed to delete task:', error)
    }
  }

  // Project actions
  const handleUpdateProjectStatus = async (status: Project['status']) => {
    if (!project) return
    try {
      const updatedProject: Project = {
        ...project,
        status,
        updated_at: new Date().toISOString(),
      }
      await saveProject(updatedProject)
    } catch (error) {
      console.error('Failed to update project:', error)
    }
  }

  const handleSaveDeadline = async () => {
    if (!project) return
    const deadline = deadlineInput || null
    await saveProject({ ...project, deadline, updated_at: new Date().toISOString() })
    setEditingDeadline(false)
  }

  const handleClearDistribution = async () => {
    // Never clear scheduled_for on fixed/hard-pinned tasks — that's their deliberately set time, not a cycle assignment.
    const incompleteTasks = tasks.filter(t =>
      t.status !== 'completed' &&
      !t.is_habit &&
      !t.parent_task_id &&
      t.scheduled_for &&
      !(t.is_pinned && t.pin_type === 'hard')
    )
    if (incompleteTasks.length === 0) return
    setClearingDates(true)
    try {
      const now = new Date().toISOString()
      await Promise.all(
        incompleteTasks.map(task => saveTask({ ...task, scheduled_for: null, updated_at: now }))
      )
      setDistributeResult(null)
    } catch (err) {
      console.error('Failed to clear task dates:', err)
    } finally {
      setClearingDates(false)
    }
  }

  const handleDistributeByCycle = async () => {
    if (!project?.deadline || !preferences) return
    // Include subtasks — they are scheduled as independent tasks.
    // Dependencies (declared on any task or subtask) are respected by the
    // topological sort inside distributeCycleTasks.
    // Exclude habits (covers recurring meetings, which use is_habit + recurrence.time_of_day)
    // and any task with a fixed/hard-pinned time (one-off meetings, appointments) — these
    // already have a deliberately chosen date+time and must not be reassigned.
    const incompleteTasks = tasks.filter(t =>
      t.status !== 'completed' &&
      !t.is_habit &&
      !(t.is_pinned && t.pin_type === 'hard')
    )
    if (incompleteTasks.length === 0) return

    setDistributing(true)
    setDistributeResult(null)
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const deadline = new Date(project.deadline + 'T00:00:00')
      const assignments = distributeCycleTasks(incompleteTasks, today, deadline, preferences)

      const now = new Date().toISOString()
      const uniqueDays = new Set(assignments.map(a => a.scheduledFor))
      const byPhase: Record<string, number> = {}
      for (const a of assignments) {
        byPhase[a.season] = (byPhase[a.season] ?? 0) + 1
      }

      await Promise.all(
        assignments.map(({ taskId, scheduledFor }) => {
          const task = incompleteTasks.find(t => t.id === taskId)
          if (!task) return Promise.resolve()
          return saveTask({ ...task, scheduled_for: scheduledFor, updated_at: now })
        })
      )
      setDistributeResult({ count: assignments.length, days: uniqueDays.size, byPhase })
    } catch (err) {
      console.error('Failed to distribute tasks:', err)
    } finally {
      setDistributing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Project not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusBadgeVariant = {
    active: 'default',
    paused: 'secondary',
    completed: 'outline',
    archived: 'outline',
  } as const

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
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <Badge variant={statusBadgeVariant[project.status]}>
                {project.status}
              </Badge>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((p) => (
                  <div
                    key={p}
                    className={cn(
                      "w-2 h-2 rounded-full",
                      p <= project.priority ? "bg-primary" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
            {project.description && (
              <p className="text-muted-foreground mt-1 max-w-2xl">{project.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <p className="text-xs text-muted-foreground">
                Created {new Date(project.created_at).toLocaleDateString()}
              </p>

              {/* Deadline inline editor */}
              {editingDeadline ? (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={e => setDeadlineInput(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="h-6 text-xs border rounded px-1 bg-background"
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveDeadline(); if (e.key === 'Escape') setEditingDeadline(false) }}
                    autoFocus
                  />
                  <Button size="sm" className="h-6 text-xs px-2" onClick={handleSaveDeadline}>Save</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingDeadline(false)}>Cancel</Button>
                </div>
              ) : (
                <button
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => { setDeadlineInput(project.deadline ?? ''); setEditingDeadline(true) }}
                >
                  <Calendar className="h-3 w-3" />
                  {project.deadline
                    ? <>Deadline: <span className="font-medium text-foreground">{new Date(project.deadline + 'T00:00:00').toLocaleDateString()}</span></>
                    : 'Set deadline'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 shrink-0">
          {/* Cycle distribute button — shown when deadline is set */}
          {project.deadline && (
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Button
                  variant={preferences?.cycle?.enabled ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleDistributeByCycle}
                  disabled={distributing || clearingDates || tasks.filter(t => t.status !== 'completed' && !t.is_habit).length === 0}
                  className="gap-2"
                  title={preferences?.cycle?.enabled ? 'Spread tasks across cycle phases up to deadline' : 'Enable cycle tracking in Settings → Cycle first'}
                >
                  <Shuffle className="h-4 w-4" />
                  {distributing ? 'Distributing…' : 'Distribute by Cycle'}
                </Button>
                {tasks.some(t => t.status !== 'completed' && !t.is_habit && t.scheduled_for) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDistribution}
                    disabled={distributing || clearingDates}
                    className="text-muted-foreground text-xs gap-1"
                    title="Clear all scheduled_for dates on this project's tasks and let the scheduler reschedule freely"
                  >
                    {clearingDates ? 'Clearing…' : 'Reset dates'}
                  </Button>
                )}
              </div>
              {distributeResult && (
                <div className="text-xs text-muted-foreground text-right space-y-0.5">
                  <p className="font-medium text-foreground">
                    {distributeResult.count} task{distributeResult.count !== 1 ? 's' : ''} spread across {distributeResult.days} day{distributeResult.days !== 1 ? 's' : ''}
                  </p>
                  <p className="flex items-center justify-end gap-2 flex-wrap">
                    {Object.entries(distributeResult.byPhase).map(([season, count]) => {
                      const emoji = { winter: '❄️', spring: '🌱', summer: '☀️', autumn: '🍂', any: '📅' }[season] ?? '📅'
                      return (
                        <span key={season}>{emoji} {count}</span>
                      )
                    })}
                  </p>
                  <p className="text-[10px]">Now hit Reschedule All in Today view</p>
                </div>
              )}
              {!preferences?.cycle?.enabled && (
                <p className="text-xs text-muted-foreground">Enable cycle tracking in Settings → Cycle</p>
              )}
            </div>
          )}

          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEditProject && (
              <>
                <DropdownMenuItem onClick={() => onEditProject(project)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => handleUpdateProjectStatus('active')}>
              <Play className="h-4 w-4 mr-2" />
              Set Active
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateProjectStatus('paused')}>
              <Pause className="h-4 w-4 mr-2" />
              Pause Project
            </DropdownMenuItem>
            {hasPausedSubprojects && (
              <DropdownMenuItem
                onClick={handleUnpauseSubprojects}
                disabled={unpausingSubprojects}
              >
                <Play className="h-4 w-4 mr-2 text-green-600" />
                {unpausingSubprojects ? 'Unpausing...' : 'Unpause All Sub-projects'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => handleUpdateProjectStatus('completed')}>
              <Check className="h-4 w-4 mr-2" />
              Mark Complete
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleUpdateProjectStatus('archived')}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ListTodo className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.byStatus.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taskStats.remaining}</p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(taskStats.remainingEstimated / 60)}h</p>
                <p className="text-xs text-muted-foreground">Est. Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-1 space-y-6">
          {/* Completion Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PieChart
                segments={[
                  { value: taskStats.byStatus.completed, color: '#22c55e', label: 'Completed' },
                  { value: taskStats.remaining, color: 'hsl(var(--muted))', label: 'Remaining' },
                ]}
                size={180}
                innerRadius={55}
                centerValue={`${Math.round(taskStats.completionRate)}%`}
                centerLabel="Complete"
              />
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Task Status</CardTitle>
            </CardHeader>
            <CardContent>
              <PieChart
                segments={Object.entries(taskStats.byStatus).map(([status, count]) => ({
                  value: count,
                  color: statusColors[status],
                  label: statusLabels[status],
                }))}
                size={180}
                innerRadius={55}
                showLegend={true}
              />
            </CardContent>
          </Card>

          {/* Priority Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Remaining by Priority</CardTitle>
              <CardDescription>Tasks not yet completed</CardDescription>
            </CardHeader>
            <CardContent>
              <BarChart
                data={[5, 4, 3, 2, 1].map(p => ({
                  label: priorityLabels[p],
                  value: taskStats.byPriority[p as keyof typeof taskStats.byPriority],
                  color: priorityColors[p],
                }))}
                height={150}
                horizontal={true}
              />
            </CardContent>
          </Card>

          {/* Time Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Time Analytics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Estimated</span>
                <span className="font-medium">{Math.round(taskStats.totalEstimated / 60)}h {taskStats.totalEstimated % 60}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Time Completed</span>
                <span className="font-medium">{Math.round(taskStats.completedActual / 60)}h {taskStats.completedActual % 60}m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Time Remaining</span>
                <span className="font-medium">{Math.round(taskStats.remainingEstimated / 60)}h {taskStats.remainingEstimated % 60}m</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Add Task */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Quick Add Task
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter task title..."
                  value={quickTaskTitle}
                  onChange={(e) => setQuickTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQuickCreate()}
                  disabled={creatingTask}
                  className="flex-1"
                />
                <Select
                  value={String(quickTaskPriority)}
                  onValueChange={(v) => setQuickTaskPriority(Number(v))}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map((p) => (
                      <SelectItem key={p} value={String(p)}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: priorityColors[p] }}
                          />
                          {priorityLabels[p]}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleQuickCreate} disabled={creatingTask || !quickTaskTitle.trim()}>
                  {creatingTask ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Task List */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Tasks</CardTitle>
                <div className="flex gap-2">
                  <Tabs value={taskFilter} onValueChange={(v) => setTaskFilter(v as typeof taskFilter)}>
                    <TabsList className="h-8">
                      <TabsTrigger value="remaining" className="text-xs px-2">
                        Remaining ({taskStats.remaining})
                      </TabsTrigger>
                      <TabsTrigger value="completed" className="text-xs px-2">
                        Completed ({taskStats.byStatus.completed})
                      </TabsTrigger>
                      <TabsTrigger value="all" className="text-xs px-2">
                        All ({taskStats.total})
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredTasks.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  {taskFilter === 'remaining'
                    ? 'All tasks completed! Great job!'
                    : taskFilter === 'completed'
                    ? 'No completed tasks yet'
                    : 'No tasks in this project'}
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {filteredTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      subtasks={tasks.filter(t => t.parent_task_id === task.id)}
                      allTasks={tasks}
                      scheduledEntry={taskScheduleMap.get(task.id)}
                      onComplete={handleCompleteTask}
                      onUncomplete={handleUncompleteTask}
                      onEdit={onEditTask}
                      onDelete={handleDeleteTask}
                      onAddSubtask={onAddSubtask}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Habits Section */}
          {habits.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Flame className="h-5 w-5 text-orange-500" />
                    Habits ({habitStats.total})
                  </CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Play className="h-3 w-3 text-green-500" />
                      {habitStats.active} active
                    </span>
                    {habitStats.paused > 0 && (
                      <span className="flex items-center gap-1">
                        <Pause className="h-3 w-3 text-yellow-500" />
                        {habitStats.paused} paused
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {habits.map((habit) => (
                    <div
                      key={habit.id}
                      className={cn(
                        "group flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-accent/50 cursor-pointer",
                        habit.is_paused && "opacity-60"
                      )}
                      onClick={() => onEditTask(habit)}
                    >
                      <Flame className="h-4 w-4 text-orange-500 flex-shrink-0" />

                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: priorityColors[habit.priority] }}
                        title={`Priority: ${priorityLabels[habit.priority]}`}
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{habit.title}</span>
                          {habit.is_paused ? (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500">
                              <Pause className="h-3 w-3 mr-1" />
                              Paused
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                              <Play className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {habit.recurrence && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {habit.recurrence.frequency}
                              {habit.recurrence.days_of_week && habit.recurrence.days_of_week.length > 0 && habit.recurrence.days_of_week.length < 7 && (
                                <span>({habit.recurrence.days_of_week.map(d => d.slice(0, 3)).join(', ')})</span>
                              )}
                            </span>
                          )}
                          {habit.recurrence?.time_of_day && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {habit.recurrence.time_of_day}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            {energyIcons[habit.energy_level]}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditTask(habit)
                          }}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sub-projects Section */}
          {childProjects.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Sub-projects ({childProjects.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {childProjects.map((childProject) => {
                    const childTasks = allTasks.filter(t => t.project_id === childProject.id)
                    const completedTasks = childTasks.filter(t => t.status === 'completed').length
                    const totalTasks = childTasks.length
                    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

                    return (
                      <div
                        key={childProject.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border transition-all hover:bg-accent/50",
                          onSelectProject && "cursor-pointer"
                        )}
                        onClick={() => onSelectProject?.(childProject.id)}
                      >
                        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{childProject.name}</span>
                            <Badge variant={
                              childProject.status === 'active' ? 'default' :
                              childProject.status === 'paused' ? 'secondary' :
                              childProject.status === 'completed' ? 'outline' : 'outline'
                            }>
                              {childProject.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            <span>{totalTasks} tasks</span>
                            {totalTasks > 0 && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                {completionRate}% complete
                              </span>
                            )}
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((p) => (
                                <div
                                  key={p}
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    p <= childProject.priority ? "bg-primary" : "bg-muted"
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        {onSelectProject && (
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Blocked & High Priority Section */}
          {(taskStats.byStatus.blocked > 0 || taskStats.byPriority[5] > 0 || taskStats.byPriority[4] > 0) && (
            <Card className="border-orange-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-orange-500">
                  <AlertCircle className="h-5 w-5" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {taskStats.byStatus.blocked > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-500 mb-2">
                      Blocked Tasks ({taskStats.byStatus.blocked})
                    </h4>
                    <div className="space-y-1">
                      {tasks
                        .filter(t => t.status === 'blocked')
                        .map((task) => (
                          <div key={task.id} className="flex items-center gap-2 text-sm p-2 bg-red-500/10 rounded">
                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                            <span className="truncate">{task.title}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {(taskStats.byPriority[5] > 0 || taskStats.byPriority[4] > 0) && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-500 mb-2">
                      High Priority Tasks ({taskStats.byPriority[5] + taskStats.byPriority[4]})
                    </h4>
                    <div className="space-y-1">
                      {tasks
                        .filter(t => t.status !== 'completed' && (t.priority === 5 || t.priority === 4))
                        .map((task) => (
                          <div key={task.id} className="flex items-center gap-2 text-sm p-2 bg-orange-500/10 rounded">
                            <div
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ backgroundColor: priorityColors[task.priority] }}
                            />
                            <span className="truncate">{task.title}</span>
                            {task.deadline && (
                              <span className="text-xs text-muted-foreground ml-auto">
                                Due: {new Date(task.deadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Upcoming Deadlines */}
          {tasks.filter(t => t.deadline && t.status !== 'completed').length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Upcoming Deadlines
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tasks
                    .filter(t => t.deadline && t.status !== 'completed')
                    .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
                    .slice(0, 5)
                    .map((task) => {
                      const deadline = new Date(task.deadline!)
                      const today = new Date()
                      const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      const isOverdue = daysUntil < 0
                      const isUrgent = daysUntil <= 2 && daysUntil >= 0

                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded",
                            isOverdue && "bg-red-500/10",
                            isUrgent && !isOverdue && "bg-orange-500/10"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: priorityColors[task.priority] }}
                            />
                            <span className="text-sm truncate max-w-[300px]">{task.title}</span>
                          </div>
                          <div className={cn(
                            "text-xs font-medium",
                            isOverdue && "text-red-500",
                            isUrgent && !isOverdue && "text-orange-500"
                          )}>
                            {isOverdue
                              ? `${Math.abs(daysUntil)} days overdue`
                              : daysUntil === 0
                              ? 'Due today'
                              : daysUntil === 1
                              ? 'Due tomorrow'
                              : `${daysUntil} days left`}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Over Time Placeholder */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Progress Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Overall Progress</span>
                    <span className="font-medium">{Math.round(taskStats.completionRate)}%</span>
                  </div>
                  <Progress value={taskStats.completionRate} className="h-3" />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-green-500">{taskStats.byStatus.completed}</p>
                    <p className="text-xs text-muted-foreground">Tasks Done</p>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-500">{taskStats.byStatus.in_progress}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// Task Row Component
type ScheduledEntry = { date: string; startTime: string; endTime: string }

function formatScheduleLabel(entry: ScheduledEntry | undefined, scheduledFor: string | null): string | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const todayStr = today.toISOString().split('T')[0]
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const fmt12 = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const ampm = h < 12 ? 'am' : 'pm'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')}${ampm}`
  }

  if (entry) {
    const dayLabel =
      entry.date === todayStr ? 'Today' :
      entry.date === tomorrowStr ? 'Tomorrow' :
      new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${dayLabel} · ${fmt12(entry.startTime)}–${fmt12(entry.endTime)}`
  }

  if (scheduledFor) {
    const d = scheduledFor.split('T')[0]
    const dayLabel =
      d === todayStr ? 'Today' :
      d === tomorrowStr ? 'Tomorrow' :
      new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${dayLabel} (pending reschedule)`
  }

  return null
}

const rowEnergyIcons: Record<string, React.ReactNode> = {
  high: <Flame className="h-3 w-3 text-orange-500" />,
  medium: <Zap className="h-3 w-3 text-yellow-500" />,
  low: <Moon className="h-3 w-3 text-blue-400" />,
}

function TaskRow({
  task,
  subtasks,
  allTasks = [],
  scheduledEntry,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  onAddSubtask,
}: {
  task: Task
  subtasks: Task[]
  allTasks?: Task[]
  scheduledEntry?: ScheduledEntry
  onComplete: (id: string) => void
  onUncomplete?: (id: string) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onAddSubtask?: (parentTask: Task) => void
}) {
  // Auto-expand when there are fewer than 5 subtasks
  const [expanded, setExpanded] = useState(() => subtasks.length > 0 && subtasks.length < 5)
  const isCompleted = task.status === 'completed'
  const scheduleLabel = isCompleted ? null : formatScheduleLabel(scheduledEntry, task.scheduled_for ?? null)

  const completedSubtasks = subtasks.filter(s => s.status === 'completed').length
  const hasSubtasks = subtasks.length > 0
  const subtaskTotalMinutes = subtasks.reduce((sum, s) => sum + (s.estimated_minutes ?? 0), 0)
  const totalMinutes = task.estimated_minutes + subtaskTotalMinutes

  // Dependency info
  const depTasks = (task.dependencies ?? [])
    .map(id => allTasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined)
  const blockedBy = depTasks.filter(t => t.status !== 'completed')
  const isBlocked = blockedBy.length > 0

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      isCompleted && "opacity-60",
      isBlocked && !isCompleted && "border-red-300/50 bg-red-50/20 dark:bg-red-950/10"
    )}>
      {/* Main task row */}
      <div className="group flex items-center gap-3 p-3 hover:bg-accent/50">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => isCompleted ? onUncomplete?.(task.id) : onComplete(task.id)}
        />

        {/* Expand/collapse button for subtasks */}
        {hasSubtasks ? (
          <button
            className="flex items-center gap-0.5 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setExpanded(e => !e)}
            title={`${subtasks.length} subtask${subtasks.length !== 1 ? 's' : ''}`}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-medium">{completedSubtasks}/{subtasks.length}</span>
          </button>
        ) : (
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: priorityColors[task.priority] }}
            title={`Priority: ${priorityLabels[task.priority]}`}
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "font-medium truncate",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>
            {task.is_habit && <Badge variant="secondary" className="text-xs">Habit</Badge>}
            {task.is_paused && (
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500">
                <Pause className="h-3 w-3 mr-1" />Paused
              </Badge>
            )}
            {isBlocked && !isCompleted && (
              <Badge variant="outline" className="text-xs text-red-600 border-red-400">
                <Lock className="h-3 w-3 mr-1" />Blocked
              </Badge>
            )}
            {depTasks.length > 0 && !isBlocked && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <Link2 className="h-3 w-3 mr-1" />{depTasks.length} dep
              </Badge>
            )}
          </div>

          {/* Blocked-by details */}
          {blockedBy.length > 0 && !isCompleted && (
            <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
              <Lock className="h-3 w-3 shrink-0" />
              Blocked by: {blockedBy.map(t => t.title).join(', ')}
            </p>
          )}

          <div className="flex items-center flex-wrap gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {hasSubtasks ? (
                <>{totalMinutes}m <span className="text-muted-foreground/60">(+{subtaskTotalMinutes}m subtasks)</span></>
              ) : (
                <>{task.estimated_minutes}m</>
              )}
            </span>
            <span className="flex items-center gap-0.5">
              {rowEnergyIcons[task.energy_level]}
            </span>
            {hasSubtasks && (
              <Progress
                value={(completedSubtasks / subtasks.length) * 100}
                className="h-1 w-16"
              />
            )}
            {scheduleLabel && (
              <span className={cn(
                "flex items-center gap-1",
                scheduledEntry ? "text-primary" : "text-muted-foreground italic"
              )}>
                <Calendar className="h-3 w-3 shrink-0" />{scheduleLabel}
              </span>
            )}
            {task.status === 'in_progress' && (
              <Badge variant="default" className="text-xs">In Progress</Badge>
            )}
            {task.deadline && (
              <span className="text-orange-500">
                Due: {new Date(task.deadline).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddSubtask && !task.is_habit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => onAddSubtask(task)}
              title="Add subtask"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(task)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(task.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Subtask list */}
      {hasSubtasks && expanded && (
        <div className="ml-10 mr-3 pb-3 pl-3 border-l-2 border-muted space-y-1">
          {subtasks.map(sub => (
            <div
              key={sub.id}
              className={cn(
                "group/sub flex items-center gap-2 text-sm p-1.5 rounded hover:bg-accent/50",
                sub.status === 'completed' && "opacity-60"
              )}
            >
              <Checkbox
                checked={sub.status === 'completed'}
                onCheckedChange={() => sub.status !== 'completed' && onComplete(sub.id)}
                className="h-3.5 w-3.5 shrink-0"
              />
              <span className={cn("flex-1 truncate", sub.status === 'completed' && "line-through text-muted-foreground")}>
                {sub.title}
              </span>
              <span className="flex items-center gap-1 text-muted-foreground text-xs">
                {rowEnergyIcons[sub.energy_level]}
                {sub.estimated_minutes}m
              </span>
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: priorityColors[sub.priority] }}
                title={priorityLabels[sub.priority]}
              />
              <div className="flex gap-0.5 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(sub)}>
                  <Edit className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          {onAddSubtask && !task.is_habit && (
            <button
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors pl-1 py-1"
              onClick={() => onAddSubtask(task)}
            >
              <Plus className="h-3 w-3" />Add subtask
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ProjectView
