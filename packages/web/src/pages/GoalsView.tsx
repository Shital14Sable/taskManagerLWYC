import { useState, useEffect } from 'react'
import { Target, Plus, ChevronRight, ChevronDown, Calendar, Briefcase, Heart, User, BookOpen, DollarSign, Users, MoreHorizontal, Edit, Trash2, Link2, ArrowLeft, TrendingUp, Repeat, CheckSquare, FolderKanban, Eye, Flame, Circle, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useGoals } from '@/hooks/useGoals'
import { useProjects } from '@/hooks/useProjects'
import { useTasks } from '@/hooks/useTasks'
import { useApp } from '@/context/AppContext'
import type { Goal, CreateGoalInput, TimeHorizon, GoalCategory, GoalStatus } from '@/types'
import type { GoalProgress } from '@/hooks/useGoals'
import type { HabitInstance } from '@trackmind/core'
import { cn } from '@/lib/utils'

interface GoalsViewProps {
  onBack?: () => void
}

const CATEGORY_ICONS: Record<GoalCategory, typeof Briefcase> = {
  career: Briefcase,
  health: Heart,
  personal: User,
  learning: BookOpen,
  financial: DollarSign,
  relationships: Users,
  other: MoreHorizontal,
}

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  career: 'text-blue-500',
  health: 'text-green-500',
  personal: 'text-purple-500',
  learning: 'text-amber-500',
  financial: 'text-emerald-500',
  relationships: 'text-pink-500',
  other: 'text-gray-500',
}

const HORIZON_LABELS: Record<TimeHorizon, string> = {
  yearly: 'Yearly',
  quarterly: 'Quarterly',
  monthly: 'Monthly',
}

const STATUS_COLORS: Record<GoalStatus, string> = {
  active: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  achieved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  abandoned: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

export function GoalsView({ onBack }: GoalsViewProps) {
  const { goals, yearlyGoals, quarterlyGoals, monthlyGoals, activeGoals, loading, createGoal, updateGoal, deleteGoal, linkProject, unlinkProject, linkHabit, unlinkHabit, linkTask, unlinkTask, getProgress, refetch } = useGoals()
  const { activeProjects } = useProjects()
  const { habits, regularTasks } = useTasks()

  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [goalProgress, setGoalProgress] = useState<GoalProgress | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showVisionBoard, setShowVisionBoard] = useState(false)
  const [linkDialogTab, setLinkDialogTab] = useState<'projects' | 'habits' | 'tasks'>('projects')
  const [expandedHorizons, setExpandedHorizons] = useState<Set<TimeHorizon>>(new Set(['yearly', 'quarterly', 'monthly']))
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set())

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formHorizon, setFormHorizon] = useState<TimeHorizon>('quarterly')
  const [formCategory, setFormCategory] = useState<GoalCategory>('personal')
  const [formTargetDate, setFormTargetDate] = useState('')
  const [formParentId, setFormParentId] = useState<string>('__none__')
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  useEffect(() => {
    if (selectedGoal) {
      loadProgress(selectedGoal.id)
    }
  }, [selectedGoal])

  const loadProgress = async (goalId: string) => {
    try {
      const progress = await getProgress(goalId)
      setGoalProgress(progress)
    } catch (err) {
      console.error('Failed to load progress:', err)
    }
  }

  const handleCreateGoal = async () => {
    if (!formTitle.trim()) return
    const data: CreateGoalInput = {
      title: formTitle,
      description: formDescription || undefined,
      time_horizon: formHorizon,
      category: formCategory,
      target_date: formTargetDate || undefined,
      parent_goal_id: formParentId && formParentId !== '__none__' ? formParentId : undefined,
    }
    await createGoal(data)
    resetForm()
    setShowCreateDialog(false)
  }

  const handleUpdateGoal = async () => {
    if (!editingGoal || !formTitle.trim()) return
    await updateGoal(editingGoal.id, {
      title: formTitle,
      description: formDescription || undefined,
      time_horizon: formHorizon,
      category: formCategory,
      target_date: formTargetDate || undefined,
      parent_goal_id: formParentId && formParentId !== '__none__' ? formParentId : undefined,
    })
    resetForm()
    setEditingGoal(null)
    if (selectedGoal?.id === editingGoal.id) {
      refetch()
    }
  }

  const handleDeleteGoal = async (goal: Goal) => {
    if (!confirm(`Delete goal "${goal.title}"?`)) return
    await deleteGoal(goal.id)
    if (selectedGoal?.id === goal.id) {
      setSelectedGoal(null)
    }
  }

  const handleLinkProject = async (projectId: string) => {
    if (!selectedGoal) return
    await linkProject(selectedGoal.id, projectId)
    await loadProgress(selectedGoal.id)
  }

  const handleUnlinkProject = async (projectId: string) => {
    if (!selectedGoal) return
    await unlinkProject(selectedGoal.id, projectId)
    await loadProgress(selectedGoal.id)
  }

  const handleLinkHabit = async (habitId: string) => {
    if (!selectedGoal) return
    await linkHabit(selectedGoal.id, habitId)
    await loadProgress(selectedGoal.id)
  }

  const handleUnlinkHabit = async (habitId: string) => {
    if (!selectedGoal) return
    await unlinkHabit(selectedGoal.id, habitId)
    await loadProgress(selectedGoal.id)
  }

  const handleLinkTask = async (taskId: string) => {
    if (!selectedGoal) return
    await linkTask(selectedGoal.id, taskId)
    await loadProgress(selectedGoal.id)
  }

  const handleUnlinkTask = async (taskId: string) => {
    if (!selectedGoal) return
    await unlinkTask(selectedGoal.id, taskId)
    await loadProgress(selectedGoal.id)
  }

  const handleStatusChange = async (goal: Goal, status: GoalStatus) => {
    await updateGoal(goal.id, { status })
    refetch()
  }

  const startEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setFormTitle(goal.title)
    setFormDescription(goal.description || '')
    setFormHorizon(goal.time_horizon)
    setFormCategory(goal.category)
    setFormTargetDate(goal.target_date || '')
    setFormParentId(goal.parent_goal_id || '__none__')
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormHorizon('quarterly')
    setFormCategory('personal')
    setFormTargetDate('')
    setFormParentId('__none__')
    setEditingGoal(null)
  }

  const toggleHorizon = (horizon: TimeHorizon) => {
    setExpandedHorizons((prev) => {
      const next = new Set(prev)
      if (next.has(horizon)) {
        next.delete(horizon)
      } else {
        next.add(horizon)
      }
      return next
    })
  }

  const toggleGoalExpand = (goalId: string) => {
    setExpandedGoals((prev) => {
      const next = new Set(prev)
      if (next.has(goalId)) {
        next.delete(goalId)
      } else {
        next.add(goalId)
      }
      return next
    })
  }

  const getChildGoals = (parentId: string) => goals.filter((g) => g.parent_goal_id === parentId)

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const renderGoalCard = (goal: Goal, depth: number = 0) => {
    const CategoryIcon = CATEGORY_ICONS[goal.category]
    const childGoals = getChildGoals(goal.id)
    const hasChildren = childGoals.length > 0
    const isExpanded = expandedGoals.has(goal.id)

    return (
      <div key={goal.id} className={cn("space-y-2", depth > 0 && "ml-6 mt-2")}>
        <Card
          className={cn(
            "cursor-pointer hover:shadow-md transition-all hover:border-primary/50",
            selectedGoal?.id === goal.id && "border-primary ring-1 ring-primary"
          )}
          onClick={() => setSelectedGoal(goal)}
        >
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleGoalExpand(goal.id)
                  }}
                  className="mt-1"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              )}
              {!hasChildren && <span className="w-4" />}

              <CategoryIcon className={cn("h-5 w-5 mt-0.5", CATEGORY_COLORS[goal.category])} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium truncate">{goal.title}</h4>
                  <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[goal.status])}>
                    {goal.status}
                  </Badge>
                </div>

                {goal.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                    {goal.description}
                  </p>
                )}

                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1 max-w-[200px]">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-1.5" />
                  </div>

                  {goal.target_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(goal.target_date)}
                    </span>
                  )}

                  {goal.linked_project_ids.length > 0 && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Link2 className="h-3 w-3" />
                      {goal.linked_project_ids.length} project(s)
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); startEdit(goal) }}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  {goal.status === 'active' && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(goal, 'achieved') }}>
                      <Target className="h-4 w-4 mr-2" />
                      Mark Achieved
                    </DropdownMenuItem>
                  )}
                  {goal.status === 'active' && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(goal, 'abandoned') }}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Abandon
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal) }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {hasChildren && isExpanded && (
          <div className="border-l-2 border-muted pl-2">
            {childGoals.map((child) => renderGoalCard(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderHorizonSection = (horizon: TimeHorizon, goalsInHorizon: Goal[]) => {
    const isExpanded = expandedHorizons.has(horizon)
    const topLevelGoals = goalsInHorizon.filter((g) => !g.parent_goal_id)

    return (
      <div key={horizon} className="space-y-3">
        <button
          onClick={() => toggleHorizon(horizon)}
          className="flex items-center gap-2 w-full text-left group"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <h3 className="text-lg font-semibold">{HORIZON_LABELS[horizon]} Goals</h3>
          <Badge variant="secondary" className="ml-2">{goalsInHorizon.length}</Badge>
        </button>

        {isExpanded && (
          <div className="space-y-2 ml-6">
            {topLevelGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No {horizon} goals yet. Create one to get started!
              </p>
            ) : (
              topLevelGoals.map((goal) => renderGoalCard(goal))
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading goals...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6" />
              Goals
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeGoals.length} active goals across {goals.length} total
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Goals List */}
        <div className="col-span-7 space-y-6">
          {renderHorizonSection('yearly', yearlyGoals)}
          {renderHorizonSection('quarterly', quarterlyGoals)}
          {renderHorizonSection('monthly', monthlyGoals)}
        </div>

        {/* Goal Details */}
        <div className="col-span-5">
          {selectedGoal ? (
            <Card className="sticky top-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const CategoryIcon = CATEGORY_ICONS[selectedGoal.category]
                      return <CategoryIcon className={cn("h-5 w-5", CATEGORY_COLORS[selectedGoal.category])} />
                    })()}
                    <CardTitle>{selectedGoal.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className={cn(STATUS_COLORS[selectedGoal.status])}>
                    {selectedGoal.status}
                  </Badge>
                </div>
                {selectedGoal.description && (
                  <p className="text-sm text-muted-foreground">{selectedGoal.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress Breakdown */}
                <div>
                  <span className="text-sm font-medium">Overall Progress</span>
                  {goalProgress ? (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {goalProgress.total_tasks > 0 && (
                        <div className="flex items-center justify-between text-sm p-2 bg-accent/30 rounded">
                          <span className="text-muted-foreground">Tasks</span>
                          <span className="font-medium">{goalProgress.completed_tasks}/{goalProgress.total_tasks}</span>
                        </div>
                      )}
                      {goalProgress.projects.length > 0 && (
                        <div className="flex items-center justify-between text-sm p-2 bg-accent/30 rounded">
                          <span className="text-muted-foreground">Projects</span>
                          <span className="font-medium">{goalProgress.projects.filter(p => p.progress === 100).length}/{goalProgress.projects.length}</span>
                        </div>
                      )}
                      {goalProgress.habits.length > 0 && (
                        <div className="flex items-center justify-between text-sm p-2 bg-green-500/10 rounded">
                          <span className="text-muted-foreground">Habits</span>
                          <span className="font-medium text-green-500">{goalProgress.habits.reduce((sum, h) => sum + h.completion_count, 0)}x completed</span>
                        </div>
                      )}
                      {goalProgress.subGoals.length > 0 && (
                        <div className="flex items-center justify-between text-sm p-2 bg-accent/30 rounded">
                          <span className="text-muted-foreground">Sub-goals</span>
                          <span className="font-medium">{goalProgress.subGoals.filter(g => g.status === 'achieved').length}/{goalProgress.subGoals.length}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-2">Loading progress...</div>
                  )}
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Time Horizon</span>
                    <p className="font-medium">{HORIZON_LABELS[selectedGoal.time_horizon]}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium capitalize">{selectedGoal.category}</p>
                  </div>
                  {selectedGoal.target_date && (
                    <div>
                      <span className="text-muted-foreground">Target Date</span>
                      <p className="font-medium">{formatDate(selectedGoal.target_date)}</p>
                    </div>
                  )}
                </div>

                {/* Linked Items Section with Tabs */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Linked Items</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setShowVisionBoard(true)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Vision Board
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowLinkDialog(true)}>
                        <Link2 className="h-4 w-4 mr-1" />
                        Link
                      </Button>
                    </div>
                  </div>

                  {/* Sub-goals */}
                  {goalProgress && goalProgress.subGoals.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span>Sub-goals ({goalProgress.subGoals.length})</span>
                      </div>
                      <div className="space-y-1">
                        {goalProgress.subGoals.map((sg) => (
                          <div key={sg.goal_id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex-1">
                              <p className="text-sm">{sg.goal_title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={sg.progress} className="h-1 flex-1 max-w-[80px]" />
                                <Badge variant="outline" className="text-xs">{sg.status}</Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Projects */}
                  {goalProgress && goalProgress.projects.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderKanban className="h-3 w-3" />
                        <span>Projects ({goalProgress.projects.length})</span>
                      </div>
                      <div className="space-y-1">
                        {goalProgress.projects.map((proj) => (
                          <div key={proj.project_id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex-1">
                              <p className="text-sm">{proj.project_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={proj.progress} className="h-1 flex-1 max-w-[80px]" />
                                <span className="text-xs text-muted-foreground">
                                  {proj.completed_tasks}/{proj.total_tasks}
                                </span>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => handleUnlinkProject(proj.project_id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Habits */}
                  {goalProgress && goalProgress.habits.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Repeat className="h-3 w-3" />
                        <span>Habits ({goalProgress.habits.length})</span>
                      </div>
                      <div className="space-y-1">
                        {goalProgress.habits.map((habit) => (
                          <div key={habit.habit_id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex-1">
                              <p className="text-sm">{habit.habit_title}</p>
                              <span className="text-xs text-muted-foreground capitalize">{habit.frequency}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={habit.is_active ? "default" : "secondary"} className="text-xs">
                                {habit.is_active ? 'Active' : 'Paused'}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => handleUnlinkHabit(habit.habit_id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Direct Tasks */}
                  {goalProgress && goalProgress.directTasks.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckSquare className="h-3 w-3" />
                        <span>Tasks ({goalProgress.directTasks.length})</span>
                      </div>
                      <div className="space-y-1">
                        {goalProgress.directTasks.map((task) => (
                          <div key={task.task_id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                            <div className="flex-1">
                              <p className="text-sm">{task.task_title}</p>
                              {task.project_name && (
                                <span className="text-xs text-muted-foreground">{task.project_name}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant={task.status === 'completed' ? "default" : "secondary"} className="text-xs">
                                {task.status}
                              </Badge>
                              <Button variant="ghost" size="sm" onClick={() => handleUnlinkTask(task.task_id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {goalProgress && goalProgress.projects.length === 0 && goalProgress.habits.length === 0 && goalProgress.directTasks.length === 0 && goalProgress.subGoals.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No items linked yet. Link projects, habits, or tasks to track progress toward this goal.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button variant="outline" size="sm" onClick={() => startEdit(selectedGoal)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  {selectedGoal.status === 'active' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStatusChange(selectedGoal, 'achieved')}
                    >
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Mark Achieved
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a goal to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create/Edit Goal Dialog */}
      <Dialog open={showCreateDialog || !!editingGoal} onOpenChange={(open) => {
        if (!open) {
          resetForm()
          setShowCreateDialog(false)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
            <DialogDescription className="sr-only">
              {editingGoal ? 'Edit the goal details' : 'Create a new goal with title, description, time horizon, and category'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Goal title..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What do you want to achieve?"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Time Horizon</Label>
                <Select value={formHorizon} onValueChange={(v) => setFormHorizon(v as TimeHorizon)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yearly">Yearly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={(v) => setFormCategory(v as GoalCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="career">Career</SelectItem>
                    <SelectItem value="health">Health</SelectItem>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="learning">Learning</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="relationships">Relationships</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Target Date (optional)</Label>
              <Input
                type="date"
                value={formTargetDate}
                onChange={(e) => setFormTargetDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Goal (optional)</Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="No parent (top-level goal)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No parent</SelectItem>
                  {goals
                    .filter((g) => g.id !== editingGoal?.id)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false) }}>
              Cancel
            </Button>
            <Button onClick={editingGoal ? handleUpdateGoal : handleCreateGoal} disabled={!formTitle.trim()}>
              {editingGoal ? 'Save Changes' : 'Create Goal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Items Dialog with Tabs */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link Items to Goal</DialogTitle>
            <DialogDescription className="sr-only">
              Link projects, habits, or tasks to track progress toward this goal
            </DialogDescription>
          </DialogHeader>
          <Tabs value={linkDialogTab} onValueChange={(v) => setLinkDialogTab(v as typeof linkDialogTab)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="projects" className="flex items-center gap-1">
                <FolderKanban className="h-4 w-4" />
                Projects
              </TabsTrigger>
              <TabsTrigger value="habits" className="flex items-center gap-1">
                <Repeat className="h-4 w-4" />
                Habits
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1">
                <CheckSquare className="h-4 w-4" />
                Tasks
              </TabsTrigger>
            </TabsList>

            {/* Projects Tab */}
            <TabsContent value="projects" className="mt-4">
              {activeProjects.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No active projects available
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {activeProjects.map((project) => {
                    const isLinked = selectedGoal?.linked_project_ids.includes(project.id)
                    return (
                      <button
                        key={project.id}
                        onClick={() => {
                          if (isLinked) {
                            handleUnlinkProject(project.id)
                          } else {
                            handleLinkProject(project.id)
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded border transition-colors",
                          isLinked ? "bg-primary/10 border-primary" : "hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{project.name}</span>
                          {isLinked && <Badge variant="secondary">Linked</Badge>}
                        </div>
                        {project.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {project.description}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Habits Tab */}
            <TabsContent value="habits" className="mt-4">
              {habits.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No habits available
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {habits.map((habit) => {
                    const linkedHabitIds = selectedGoal?.linked_habit_ids ?? []
                    const isLinked = linkedHabitIds.includes(habit.id)
                    return (
                      <button
                        key={habit.id}
                        onClick={() => {
                          if (isLinked) {
                            handleUnlinkHabit(habit.id)
                          } else {
                            handleLinkHabit(habit.id)
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded border transition-colors",
                          isLinked ? "bg-primary/10 border-primary" : "hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{habit.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs capitalize">
                              {habit.recurrence?.frequency || 'daily'}
                            </Badge>
                            {isLinked && <Badge variant="secondary">Linked</Badge>}
                          </div>
                        </div>
                        {habit.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {habit.description}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="mt-4">
              {regularTasks.filter(t => t.status !== 'completed').length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No active tasks available
                </p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {regularTasks.filter(t => t.status !== 'completed').map((task) => {
                    const linkedTaskIds = selectedGoal?.linked_task_ids ?? []
                    const isLinked = linkedTaskIds.includes(task.id)
                    return (
                      <button
                        key={task.id}
                        onClick={() => {
                          if (isLinked) {
                            handleUnlinkTask(task.id)
                          } else {
                            handleLinkTask(task.id)
                          }
                        }}
                        className={cn(
                          "w-full text-left p-3 rounded border transition-colors",
                          isLinked ? "bg-primary/10 border-primary" : "hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{task.title}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {task.status}
                            </Badge>
                            {isLinked && <Badge variant="secondary">Linked</Badge>}
                          </div>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                            {task.description}
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vision Board Dialog */}
      <Dialog open={showVisionBoard} onOpenChange={setShowVisionBoard}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Vision Board: {selectedGoal?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View goal progress breakdown including projects, habits, and tasks
            </DialogDescription>
          </DialogHeader>
          {selectedGoal && goalProgress && (
            <GoalVisionBoard goal={selectedGoal} progress={goalProgress} goals={goals} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisionBoard(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Vision Board Component - exported for use in sidebar widget
export interface GoalVisionBoardProps {
  goal: Goal
  progress: GoalProgress
  goals: Goal[]
}

type FilterType = 'all' | 'subgoals' | 'projects' | 'habits' | 'tasks'

interface HabitCompletionData {
  habit_id: string
  completions: HabitInstance[]
  streak: number
}

export { HORIZON_LABELS, STATUS_COLORS }

export function GoalVisionBoard({ goal, progress, goals }: GoalVisionBoardProps) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [habitCompletions, setHabitCompletions] = useState<Record<string, HabitCompletionData>>({})
  const { getHabitInstancesByHabit } = useApp()

  // Helper to format date as local YYYY-MM-DD (not UTC)
  const formatLocalDate = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  // Calculate date range based on goal's time horizon
  const getDateRange = () => {
    const now = new Date()
    let startDate: Date

    switch (goal.time_horizon) {
      case 'yearly':
        startDate = new Date(now.getFullYear(), 0, 1)
        break
      case 'quarterly':
        const quarter = Math.floor(now.getMonth() / 3)
        startDate = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'monthly':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
    }

    return {
      start: formatLocalDate(startDate),
      end: formatLocalDate(now)
    }
  }

  // Load habit completions
  useEffect(() => {
    const loadCompletions = async () => {
      const { start, end } = getDateRange()
      const completionsMap: Record<string, HabitCompletionData> = {}

      for (const habit of progress.habits) {
        const instances = await getHabitInstancesByHabit(habit.habit_id, start, end)

        // Calculate streak
        let streak = 0
        const sortedDates = instances.map(i => i.date).sort().reverse()

        for (let i = 0; i < sortedDates.length; i++) {
          const expectedDate = new Date()
          expectedDate.setDate(expectedDate.getDate() - i)
          const expected = formatLocalDate(expectedDate)

          if (sortedDates.includes(expected)) {
            streak++
          } else if (i > 0) {
            break
          }
        }

        completionsMap[habit.habit_id] = {
          habit_id: habit.habit_id,
          completions: instances,
          streak
        }
      }

      setHabitCompletions(completionsMap)
    }

    if (progress.habits.length > 0) {
      loadCompletions()
    }
  }, [progress.habits, getHabitInstancesByHabit, goal.time_horizon])

  // Get parent goal chain
  const getParentChain = (goalId: string): Goal[] => {
    const result: Goal[] = []
    let currentGoal = goals.find(g => g.id === goalId)
    while (currentGoal?.parent_goal_id) {
      const parent = goals.find(g => g.id === currentGoal!.parent_goal_id)
      if (parent) {
        result.unshift(parent)
        currentGoal = parent
      } else {
        break
      }
    }
    return result
  }

  const parentChain = getParentChain(goal.id)
  const hasSubGoals = progress.subGoals.length > 0
  const hasProjects = progress.projects.length > 0
  const hasHabits = progress.habits.length > 0
  const hasTasks = progress.directTasks.length > 0
  const hasAnyItems = hasSubGoals || hasProjects || hasHabits || hasTasks

  const showSubGoals = filter === 'all' || filter === 'subgoals'
  const showProjects = filter === 'all' || filter === 'projects'
  const showHabits = filter === 'all' || filter === 'habits'
  const showTasks = filter === 'all' || filter === 'tasks'

  const horizonLabel = HORIZON_LABELS[goal.time_horizon]

  // Count visible columns for grid layout
  const visibleColumns = [
    showSubGoals && hasSubGoals,
    showProjects && hasProjects,
    showHabits && hasHabits,
    showTasks && hasTasks,
  ].filter(Boolean).length

  return (
    <div className="space-y-6 py-4">
      {/* Central Goal Card */}
      <div className="flex justify-center">
        <div className="relative">
          {/* Connecting lines radiating down */}
          {hasAnyItems && (
            <div className="absolute left-1/2 top-full w-px h-8 bg-gradient-to-b from-primary/50 to-transparent" />
          )}

          {/* Main Goal Card */}
          <div className="relative p-6 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-lg shadow-primary/10 min-w-[320px] max-w-md">
            {/* Parent breadcrumb */}
            {parentChain.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                {parentChain.map((parent, idx) => (
                  <span key={parent.id} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight className="h-3 w-3" />}
                    <span className="truncate max-w-[100px]">{parent.title}</span>
                  </span>
                ))}
                <ChevronRight className="h-3 w-3" />
              </div>
            )}

            {/* Goal icon and title */}
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/20 shrink-0">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold mb-1">{goal.title}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-semibold text-primary">{Math.round(progress.overall_progress)}%</span>
                  <span>•</span>
                  <span>{progress.completed_tasks}/{progress.total_tasks} tasks</span>
                  <span>•</span>
                  <span>{horizonLabel}</span>
                </div>
              </div>
              <Badge className={cn(STATUS_COLORS[goal.status], "shrink-0")}>{goal.status}</Badge>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <Progress value={progress.overall_progress} className="h-2" />
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
                className="rounded-full h-7 text-xs"
              >
                All
              </Button>
              {hasSubGoals && (
                <Button
                  variant={filter === 'subgoals' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('subgoals')}
                  className="rounded-full h-7 text-xs bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-500"
                >
                  <Target className="h-3 w-3 mr-1" />
                  {progress.subGoals.length}
                </Button>
              )}
              {hasProjects && (
                <Button
                  variant={filter === 'projects' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('projects')}
                  className="rounded-full h-7 text-xs bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-500"
                >
                  <FolderKanban className="h-3 w-3 mr-1" />
                  {progress.projects.length}
                </Button>
              )}
              {hasHabits && (
                <Button
                  variant={filter === 'habits' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('habits')}
                  className="rounded-full h-7 text-xs bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-500"
                >
                  <Repeat className="h-3 w-3 mr-1" />
                  {progress.habits.length}
                </Button>
              )}
              {hasTasks && (
                <Button
                  variant={filter === 'tasks' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('tasks')}
                  className="rounded-full h-7 text-xs bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20 text-amber-500"
                >
                  <CheckSquare className="h-3 w-3 mr-1" />
                  {progress.directTasks.length}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Vertical columns for each category */}
      {hasAnyItems ? (
        <div className={cn(
          "grid gap-4",
          visibleColumns === 1 && "grid-cols-1 max-w-sm mx-auto",
          visibleColumns === 2 && "grid-cols-2",
          visibleColumns === 3 && "grid-cols-3",
          visibleColumns >= 4 && "grid-cols-4"
        )}>
          {/* Sub-goals Column */}
          {showSubGoals && hasSubGoals && (
            <div className="space-y-3">
              {/* Column header with connecting line */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gradient-to-b from-primary/30 to-purple-500/50" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/30">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-semibold text-purple-500">Sub-goals</span>
                </div>
              </div>
              {/* Cards */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {progress.subGoals.map((sg) => (
                  <div
                    key={sg.goal_id}
                    className="p-3 rounded-lg border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5 hover:border-purple-500/50 transition-all hover:shadow-md hover:shadow-purple-500/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-full bg-purple-500/20">
                        <Target className="h-3.5 w-3.5 text-purple-500" />
                      </div>
                      <span className="text-sm font-medium truncate flex-1">{sg.goal_title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={sg.progress} className="h-1.5 flex-1" />
                      <span className="text-xs font-bold text-purple-500">{Math.round(sg.progress)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects Column */}
          {showProjects && hasProjects && (
            <div className="space-y-3">
              {/* Column header with connecting line */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gradient-to-b from-primary/30 to-blue-500/50" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/20 border border-blue-500/30">
                  <FolderKanban className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-semibold text-blue-500">Projects</span>
                </div>
              </div>
              {/* Cards */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {progress.projects.map((proj) => (
                  <div
                    key={proj.project_id}
                    className="p-3 rounded-lg border-2 border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:border-blue-500/50 transition-all hover:shadow-md hover:shadow-blue-500/10"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1.5 rounded-md bg-blue-500/20">
                        <FolderKanban className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm font-semibold truncate flex-1">{proj.project_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={proj.progress} className="h-1.5 flex-1" />
                      <span className="text-xs font-bold text-blue-500">{Math.round(proj.progress)}%</span>
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <CheckSquare className="h-3 w-3" />
                      <span>{proj.completed_tasks}/{proj.total_tasks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Habits Column */}
          {showHabits && hasHabits && (
            <div className="space-y-3">
              {/* Column header with connecting line */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gradient-to-b from-primary/30 to-green-500/50" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 border border-green-500/30">
                  <Repeat className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-semibold text-green-500">Habits</span>
                </div>
              </div>
              {/* Cards */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {progress.habits.map((habit) => {
                  const completionData = habitCompletions[habit.habit_id]
                  const completionCount = completionData?.completions.length ?? 0
                  const streak = completionData?.streak ?? 0

                  return (
                    <div
                      key={habit.habit_id}
                      className="p-3 rounded-lg border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-500/5 hover:border-green-500/50 transition-all hover:shadow-md hover:shadow-green-500/10"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-full bg-green-500/20">
                          <Repeat className="h-3.5 w-3.5 text-green-500" />
                        </div>
                        <span className="text-sm font-medium truncate flex-1">{habit.habit_title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-green-500/30">{habit.frequency}</Badge>
                        <Badge variant={habit.is_active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 h-5">
                          {habit.is_active ? 'Active' : 'Paused'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-green-600">
                          <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                          <span className="font-medium">{completionCount}×</span>
                        </div>
                        {streak > 0 && (
                          <div className="flex items-center gap-1 text-orange-500">
                            <Flame className="h-3 w-3" />
                            <span className="font-medium">{streak}d streak</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tasks Column */}
          {showTasks && hasTasks && (
            <div className="space-y-3">
              {/* Column header with connecting line */}
              <div className="flex flex-col items-center">
                <div className="w-px h-4 bg-gradient-to-b from-primary/30 to-amber-500/50" />
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                  <CheckSquare className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-500">Tasks</span>
                </div>
              </div>
              {/* Cards */}
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {progress.directTasks.map((task) => (
                  <div
                    key={task.task_id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                      task.status === 'completed'
                        ? "bg-green-500/10 text-green-600 border border-green-500/30 line-through opacity-60"
                        : task.status === 'in_progress'
                        ? "bg-amber-500/15 text-foreground border-2 border-amber-500/40 shadow-sm"
                        : "bg-amber-500/5 text-foreground border border-amber-500/20 hover:border-amber-500/40"
                    )}
                  >
                    <CheckSquare className={cn(
                      "h-4 w-4 shrink-0",
                      task.status === 'completed' ? "text-green-500" : "text-amber-500"
                    )} />
                    <span className="truncate">{task.task_title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
            <Target className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground">No items linked to this goal yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Link projects, habits, or tasks to track progress</p>
        </div>
      )}
    </div>
  )
}
