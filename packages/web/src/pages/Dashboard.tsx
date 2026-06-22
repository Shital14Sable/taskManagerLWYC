import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, FolderPlus, RefreshCw, GitBranch, CalendarDays, Calendar, BarChart3, ListTodo, Target, ChevronRight, FolderOpen, Repeat, Flame, Inbox, ChevronDown, Edit, ListChecks, FileText, ClipboardCheck, TrendingUp, PauseCircle, CheckCircle2, AlertCircle, LogIn, X, BookOpen, Smile, LayoutGrid, Network, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { TaskCard } from '@/components/TaskCard'
import { TaskForm } from '@/components/TaskForm'
import { ProjectForm } from '@/components/ProjectForm'
import { ProjectTree } from '@/components/ProjectTree'
import { QuickCapture } from '@/components/QuickCapture'
import { TodayView } from '@/components/TodayView'
import { WeekView } from '@/pages/WeekView'
import { MonthView } from '@/pages/MonthView'
import { Analytics } from '@/pages/Analytics'
import { BadgeInsights } from '@/pages/BadgeInsights'
import { ProjectView } from '@/pages/ProjectView'
import { HabitView } from '@/pages/HabitView'
import { ListsView } from '@/pages/ListsView'
import { ListView } from '@/pages/ListView'
import { NotesView } from '@/pages/NotesView'
import { GoalsView } from '@/pages/GoalsView'
import { ReviewsView } from '@/pages/ReviewsView'
import { FinancialView } from '@/pages/FinancialView'
import { JournalView } from '@/pages/JournalView'
import { MoodInsights } from '@/pages/MoodInsights'
import { UserStats } from '@/components/UserStats'
import { XPNotification } from '@/components/XPNotification'
import { CompletedTasksView } from '@/components/CompletedTasksView'
import { GlobalSearch } from '@/components/GlobalSearch'
import { SettingsDialog } from '@/components/SettingsDialog'
import { DependencyGraph } from '@/components/DependencyGraph'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { generateSampleData } from '@/utils/sampleData'
import { EmptyState, emptyStateConfigs } from '@/components/EmptyState'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { useSchedule } from '@/hooks/useSchedule'
import { useGamification } from '@/hooks/useGamification'
import { useLists } from '@/hooks/useLists'
import { useGoals } from '@/hooks/useGoals'
import { useNotes } from '@/hooks/useNotes'
import { useApp } from '@/context/AppContext'
import type { Task, Project, CreateTaskInput, CreateProjectInput } from '@/types'
import { cn } from '@/lib/utils'

type ViewType = 'today' | 'tasks' | 'week' | 'month' | 'analytics' | 'badges' | 'mood' | 'project' | 'projects' | 'habits' | 'habit' | 'inbox' | 'lists' | 'list' | 'notes' | 'goals' | 'reviews' | 'paused' | 'journal' | 'financial'

export function Dashboard() {
  const [selectedScheduleDate, setSelectedScheduleDate] = useState<string | undefined>(undefined)
  const { tasks, habits, regularTasks, inboxTasks, loading: tasksLoading, createTask, updateTask, deleteTask, completeTask, uncompleteTask, refetch: refetchTasks, lastXPGain, clearXPGain } = useTasks()
  const { projects, activeProjects, pausedProjects, topLevelProjects, loading: projectsLoading, createProject, updateProject, deleteProject, isParentPaused, isEffectivelyPaused, getChildProjects, unpauseAllSubprojects, refetch: refetchProjects } = useProjects()
  const { schedule, loading: scheduleLoading, reschedule, refetch: refetchSchedule, taskScheduleMap, unscheduledTaskIds, unscheduledReasons, skipTaskForDate } = useSchedule(selectedScheduleDate)
  const { stats: gamificationStats, levelProgress, earnedBadges, unearnedBadges, loading: gamificationLoading, refetch: refetchGamification } = useGamification()
  const { lists } = useLists()
  const { activeGoals } = useGoals()
  const { notes } = useNotes()
  const { authState, isGoogleAvailable, isGitHubAvailable, loginWithGoogle, loginWithGitHub, sync, syncStatus, syncWarning, dismissSyncWarning, preferences, savePreferences, saveProject, saveTask, saveSchedule, saveGoal } = useApp()

  const [currentView, setCurrentView] = useState<ViewType>('today')
  const [showXPNotification, setShowXPNotification] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [projectViewMode, setProjectViewMode] = useState<'grid' | 'tree'>('grid')
  const [newProjectParentId, setNewProjectParentId] = useState<string | undefined>(undefined)

  // Check if onboarding should be shown
  useEffect(() => {
    // Show onboarding if not completed and not skipped
    if (preferences && !preferences.onboarding?.completed && !preferences.onboarding?.skippedAt) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setShowOnboarding(true), 500)
      return () => clearTimeout(timer)
    }
  }, [preferences])

  // Handle onboarding completion
  const handleOnboardingComplete = useCallback(async (options: { addSampleData: boolean }) => {
    if (options.addSampleData) {
      const { project, tasks: sampleTasks, habit, goal } = generateSampleData()

      // Save sample project
      await saveProject(project)

      // Save sample tasks
      for (const task of sampleTasks) {
        await saveTask(task)
      }

      // Save sample habit
      await saveTask(habit)

      // Save sample goal (connected to project, tasks, and habit)
      await saveGoal(goal)

      // Refresh data
      refetchTasks()
      refetchProjects()
      refetchSchedule()
    }

    setShowOnboarding(false)
  }, [saveProject, saveTask, saveGoal, refetchTasks, refetchProjects, refetchSchedule])

  // Handle restart wizard from settings
  const handleRestartWizard = useCallback(() => {
    setShowOnboarding(true)
  }, [])

  // Show XP notification when earned
  useEffect(() => {
    if (lastXPGain && lastXPGain.xpEarned > 0) {
      setShowXPNotification(true)
    }
  }, [lastXPGain])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null)
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [taskFormOpen, setTaskFormOpen] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [parentTaskId, setParentTaskId] = useState<string | undefined>()
  const [syncing, setSyncing] = useState(false)
  const [tasksFilterProject, setTasksFilterProject] = useState<string | 'all'>('all')
  const [tasksViewMode, setTasksViewMode] = useState<'list' | 'by-project'>('list')
  const [unscheduledFilterProject, setUnscheduledFilterProject] = useState<string | 'all'>('all')
  const [unscheduledViewMode, setUnscheduledViewMode] = useState<'list' | 'by-project'>('list')

  const handleOpenProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    setCurrentView('project')
  }

  const handleBackFromProject = () => {
    setSelectedProjectId(null)
    setCurrentView('projects')
  }

  const handleOpenHabit = (habitId: string) => {
    setSelectedHabitId(habitId)
    setCurrentView('habit')
  }

  const handleBackFromHabit = () => {
    setSelectedHabitId(null)
    setCurrentView('habits')
  }

  const handleOpenList = (listId: string) => {
    setSelectedListId(listId)
    setCurrentView('list')
  }

  const handleBackFromList = () => {
    setSelectedListId(null)
    setCurrentView('lists')
  }

  const handleCreateTask = async (data: CreateTaskInput) => {
    await createTask(data)
    refetchSchedule()
  }

  const handleUpdateTask = async (data: CreateTaskInput) => {
    if (editingTask) {
      await updateTask(editingTask.id, data)
      setEditingTask(null)
      refetchSchedule()
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setParentTaskId(undefined)
    setTaskFormOpen(true)
  }

  const handleAddSubtask = (parentTask: Task) => {
    setEditingTask(null)
    setParentTaskId(parentTask.id)
    setTaskFormOpen(true)
  }

  const handleDeleteTask = async (id: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      await deleteTask(id)
      refetchSchedule()
    }
  }

  const handleCompleteTask = async (id: string, forDate?: string) => {
    // For habits, pass the forDate so the habit instance is recorded for the correct day
    await completeTask(id, forDate ? { forDate } : undefined)

    // Update schedule's completed_tasks array to track completion for the day
    // This is especially important for habits, which don't have a global 'completed' status
    // Note: completeTask in useTasks also updates the schedule, but we refresh here to get latest state
    if (schedule && !schedule.completed_tasks?.includes(id)) {
      const currentCompleted = schedule.summary?.tasks_completed ?? 0
      const currentRemaining = schedule.summary?.tasks_remaining ?? 0
      const totalTasks = currentCompleted + currentRemaining
      const newCompleted = currentCompleted + 1
      const newRemaining = Math.max(0, currentRemaining - 1)

      const updatedSchedule = {
        ...schedule,
        completed_tasks: [...(schedule.completed_tasks || []), id],
        summary: {
          ...schedule.summary,
          tasks_completed: newCompleted,
          tasks_remaining: newRemaining,
          completion_rate: totalTasks > 0 ? (newCompleted / totalTasks) * 100 : 0,
        },
      }
      await saveSchedule(updatedSchedule)
    }

    refetchSchedule()
    refetchTasks()  // Refresh tasks to get updated habit status (reset to 'todo')
    refetchGamification()
  }

  const handleUncompleteTask = async (id: string, forDate?: string) => {
    // Reverse of handleCompleteTask — toggles the checkbox back off
    await uncompleteTask(id, forDate ? { forDate } : undefined)

    if (schedule && schedule.completed_tasks?.includes(id)) {
      const currentCompleted = schedule.summary?.tasks_completed ?? 0
      const currentRemaining = schedule.summary?.tasks_remaining ?? 0
      const totalTasks = currentCompleted + currentRemaining
      const newCompleted = Math.max(0, currentCompleted - 1)
      const newRemaining = currentRemaining + 1

      const updatedSchedule = {
        ...schedule,
        completed_tasks: (schedule.completed_tasks || []).filter(taskId => taskId !== id),
        summary: {
          ...schedule.summary,
          tasks_completed: newCompleted,
          tasks_remaining: newRemaining,
          completion_rate: totalTasks > 0 ? (newCompleted / totalTasks) * 100 : 0,
        },
      }
      await saveSchedule(updatedSchedule)
    }

    refetchSchedule()
    refetchTasks()
    refetchGamification()
  }

  const handleSkipTask = async (taskId: string, date: string) => {
    await skipTaskForDate(taskId, date)
    refetchSchedule()
  }

  const handleCloseXPNotification = () => {
    setShowXPNotification(false)
    clearXPGain()
  }

  const handleCreateProject = async (data: CreateProjectInput) => {
    await createProject(data)
  }

  const handleUpdateProject = async (data: CreateProjectInput) => {
    if (editingProject) {
      await updateProject(editingProject.id, data)
      setEditingProject(null)
    }
  }

  const handleEditProject = (project: Project) => {
    setEditingProject(project)
    setProjectFormOpen(true)
  }

  const handleProjectStatusChange = async (project: Project, status: Project['status']) => {
    const updatedProject: Project = {
      ...project,
      status,
      updated_at: new Date().toISOString(),
    }
    await saveProject(updatedProject)
    // Update the editingProject state to reflect the change immediately
    setEditingProject(updatedProject)
  }

  const handleReschedule = async () => {
    await reschedule({ reschedule_all: true })
    refetchSchedule()  // IMPORTANT: Refetch schedule to show new data
    refetchTasks()
  }

  const handleSyncNow = async () => {
    if (!authState?.isAuthenticated) {
      // Not authenticated - GitHub is default (Google coming soon)
      if (isGitHubAvailable) {
        loginWithGitHub()
      } else {
        alert('Sign-in is not configured. Please contact the administrator.')
      }
      return
    }
    setSyncing(true)
    try {
      await sync()
      refetchTasks()
      refetchProjects()
      refetchSchedule()
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  const isSignedIn = authState?.isAuthenticated

  const getSubtasks = (taskId: string) => tasks.filter((t) => t.parent_task_id === taskId)
  const incompleteTasks = regularTasks.filter((t) => t.status !== 'completed' && !t.parent_task_id)

  // Filtered tasks based on project selection
  const filteredIncompleteTasks = useMemo(() => {
    if (tasksFilterProject === 'all') return incompleteTasks
    return incompleteTasks.filter(t => t.project_id === tasksFilterProject)
  }, [incompleteTasks, tasksFilterProject])

  // Group tasks by project for the by-project view
  const tasksByProject = useMemo(() => {
    const grouped = new Map<string, Task[]>()
    const tasksToGroup = tasksFilterProject === 'all' ? incompleteTasks : filteredIncompleteTasks

    // Group tasks by project
    for (const task of tasksToGroup) {
      const projectId = task.project_id
      if (!grouped.has(projectId)) {
        grouped.set(projectId, [])
      }
      grouped.get(projectId)!.push(task)
    }

    // Sort tasks within each project by priority then deadline
    for (const [, projectTasks] of grouped) {
      projectTasks.sort((a, b) => {
        // Higher priority first
        if (a.priority !== b.priority) return b.priority - a.priority
        // Earlier deadline first
        if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
        if (a.deadline) return -1
        if (b.deadline) return 1
        return 0
      })
    }

    // Convert to array and sort by project priority
    return Array.from(grouped.entries())
      .map(([projectId, projectTasks]) => ({
        project: projects.find(p => p.id === projectId),
        tasks: projectTasks,
      }))
      .sort((a, b) => {
        // Projects with higher priority first
        const aPriority = a.project?.priority ?? 0
        const bPriority = b.project?.priority ?? 0
        return bPriority - aPriority
      })
  }, [incompleteTasks, filteredIncompleteTasks, tasksFilterProject, projects])

  // Paused items for the Paused tab
  const pausedTasks = regularTasks.filter((t) => t.is_paused && !t.parent_task_id)
  const pausedHabits = habits.filter((h) => h.is_paused)
  const activeHabits = habits.filter((h) => !h.is_paused)
  // pausedProjects comes from useProjects hook
  const completedProjects = projects.filter((p) => p.status === 'completed')
  const archivedProjects = projects.filter((p) => p.status === 'archived')
  const totalPausedCount = pausedTasks.length + pausedHabits.length + pausedProjects.length

  const loading = tasksLoading || projectsLoading

  // Standalone nav items
  const standaloneItems = [
    { id: 'today' as ViewType, label: 'Today', icon: Target },
    { id: 'inbox' as ViewType, label: 'Inbox', icon: Inbox, badge: inboxTasks.length, highlight: inboxTasks.length > 0 },
  ]

  // Tasks dropdown items
  const tasksDropdownItems = [
    { id: 'tasks' as ViewType, label: 'All Tasks', icon: ListTodo },
    { id: 'projects' as ViewType, label: 'Projects', icon: FolderOpen, badge: activeProjects.length },
    { id: 'habits' as ViewType, label: 'Habits', icon: Repeat, badge: habits.length },
    { id: 'lists' as ViewType, label: 'Lists', icon: ListChecks },
    { id: 'notes' as ViewType, label: 'Notes', icon: FileText, muted: true },
    { id: 'journal' as ViewType, label: 'Journal', icon: BookOpen },
    { id: 'goals' as ViewType, label: 'Goals', icon: Target, badge: activeGoals.length, muted: true },
    { id: 'financial' as ViewType, label: 'Financial', icon: Wallet },
    { id: 'paused' as ViewType, label: 'Paused', icon: PauseCircle, badge: totalPausedCount > 0 ? totalPausedCount : undefined },
  ]

  // Calendar dropdown items
  const calendarDropdownItems = [
    { id: 'week' as ViewType, label: 'Week', icon: CalendarDays },
    { id: 'month' as ViewType, label: 'Month', icon: Calendar },
  ]

  // Insights dropdown items (Analytics + Reviews + Badges + Mood)
  const insightsDropdownItems = [
    { id: 'analytics' as ViewType, label: 'Analytics', icon: BarChart3 },
    { id: 'badges' as ViewType, label: 'Badges & XP', icon: Flame },
    { id: 'mood' as ViewType, label: 'Mood Insights', icon: Smile },
    { id: 'reviews' as ViewType, label: 'Reviews', icon: ClipboardCheck },
  ]

  // Check if current view is in a dropdown
  const isTasksView = ['tasks', 'projects', 'habits', 'project', 'habit', 'lists', 'list', 'notes', 'journal', 'goals', 'financial', 'paused'].includes(currentView)
  const isCalendarView = ['week', 'month'].includes(currentView)
  const isInsightsView = ['analytics', 'badges', 'mood', 'reviews'].includes(currentView)

  // Get active label for dropdowns
  const getTasksLabel = () => {
    if (currentView === 'project' || currentView === 'projects') return 'Projects'
    if (currentView === 'habit' || currentView === 'habits') return 'Habits'
    if (currentView === 'list' || currentView === 'lists') return 'Lists'
    if (currentView === 'notes') return 'Notes'
    if (currentView === 'journal') return 'Journal'
    if (currentView === 'goals') return 'Goals'
    if (currentView === 'financial') return 'Financial'
    if (currentView === 'paused') return 'Paused'
    if (currentView === 'tasks') return 'All Tasks'
    return 'Tasks'
  }

  const getCalendarLabel = () => {
    if (currentView === 'week') return 'Week'
    if (currentView === 'month') return 'Month'
    return 'Calendar'
  }

  const getInsightsLabel = () => {
    if (currentView === 'analytics') return 'Analytics'
    if (currentView === 'badges') return 'Badges & XP'
    if (currentView === 'mood') return 'Mood Insights'
    if (currentView === 'reviews') return 'Reviews'
    return 'Insights'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold">TrackMind</h1>
              <div data-help="user-stats">
                <UserStats
                  compact
                  stats={gamificationStats}
                  levelProgress={levelProgress}
                  earnedBadges={earnedBadges}
                  unearnedBadges={unearnedBadges}
                  loading={gamificationLoading}
                />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {/* Standalone items: Today, Inbox */}
              {standaloneItems.map((item) => {
                const isActive = currentView === item.id
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setCurrentView(item.id)}
                    data-help={item.id === 'today' ? 'today-view' : item.id === 'inbox' ? 'inbox' : undefined}
                    className={cn(
                      "gap-2",
                      isActive && "bg-primary text-primary-foreground",
                      item.highlight && !isActive && "text-amber-600 hover:text-amber-700"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge
                        variant={item.highlight ? "default" : "secondary"}
                        className={cn(
                          "ml-1 h-5 px-1.5 text-xs",
                          item.highlight && "bg-amber-500 hover:bg-amber-500"
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Button>
                )
              })}

              {/* Tasks Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isTasksView ? 'default' : 'ghost'}
                    size="sm"
                    className={cn("gap-1", isTasksView && "bg-primary text-primary-foreground")}
                  >
                    <ListTodo className="h-4 w-4" />
                    {getTasksLabel()}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {tasksDropdownItems.filter(item => !item.muted).map((item) => {
                    const isActive = currentView === item.id ||
                      (item.id === 'projects' && currentView === 'project') ||
                      (item.id === 'habits' && currentView === 'habit') ||
                      (item.id === 'lists' && currentView === 'list')
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={cn("gap-2 cursor-pointer", isActive && "bg-accent")}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                  <DropdownMenuSeparator />
                  {tasksDropdownItems.filter(item => item.muted).map((item) => {
                    const isActive = currentView === item.id
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={cn("gap-2 cursor-pointer text-muted-foreground", isActive && "bg-accent text-foreground")}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge variant="outline" className="ml-auto h-5 px-1.5 text-xs">
                            {item.badge}
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Calendar Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isCalendarView ? 'default' : 'ghost'}
                    size="sm"
                    className={cn("gap-1", isCalendarView && "bg-primary text-primary-foreground")}
                  >
                    <Calendar className="h-4 w-4" />
                    {getCalendarLabel()}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {calendarDropdownItems.map((item) => {
                    const isActive = currentView === item.id
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={cn("gap-2 cursor-pointer", isActive && "bg-accent")}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Insights Dropdown (Analytics + Reviews) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={isInsightsView ? 'default' : 'ghost'}
                    size="sm"
                    className={cn("gap-1", isInsightsView && "bg-primary text-primary-foreground")}
                  >
                    <TrendingUp className="h-4 w-4" />
                    {getInsightsLabel()}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {insightsDropdownItems.map((item) => {
                    const isActive = currentView === item.id
                    return (
                      <DropdownMenuItem
                        key={item.id}
                        onClick={() => setCurrentView(item.id)}
                        className={cn("gap-2 cursor-pointer", isActive && "bg-accent")}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <div data-help="global-search">
              <GlobalSearch
                onSelectProject={(projectId) => {
                  setSelectedProjectId(projectId)
                  setCurrentView('project')
                }}
                onSelectHabit={(habitId) => {
                  setSelectedHabitId(habitId)
                  setCurrentView('habit')
                }}
                onSelectTask={(taskId) => {
                  const task = tasks.find(t => t.id === taskId)
                  if (task) {
                    handleEditTask(task)
                  }
                }}
              />
            </div>
            <SettingsDialog onRestartWizard={handleRestartWizard} />
            {isSignedIn && authState?.user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncNow}
                disabled={syncing || syncStatus === 'syncing'}
                className="gap-2"
                data-help="sync"
              >
                {authState.user.avatarUrl && (
                  <img
                    src={authState.user.avatarUrl}
                    alt={authState.user.displayName || 'User'}
                    className="h-4 w-4 rounded-full"
                  />
                )}
                <RefreshCw className={`h-4 w-4 ${syncing || syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                {syncing || syncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleSyncNow}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Sign In to Sync
              </Button>
            )}
            {(currentView === 'today' || currentView === 'tasks' || currentView === 'project' || currentView === 'projects' || currentView === 'habits' || currentView === 'habit' || currentView === 'inbox') && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTask(null)
                    setParentTaskId(undefined)
                    setProjectFormOpen(true)
                  }}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingTask(null)
                    setParentTaskId(undefined)
                    setTaskFormOpen(true)
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Sync Warning Banner */}
      {syncWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2">
          <div className="container mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-amber-600 dark:text-amber-400">{syncWarning}</p>
            <Button variant="ghost" size="sm" onClick={dismissSyncWarning} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={cn(
        (currentView === 'today' || currentView === 'tasks' || currentView === 'project' || currentView === 'projects' || currentView === 'habits' || currentView === 'habit' || currentView === 'inbox' || currentView === 'lists' || currentView === 'list' || currentView === 'notes' || currentView === 'journal' || currentView === 'goals' || currentView === 'reviews' || currentView === 'badges' || currentView === 'mood' || currentView === 'paused') ? "container mx-auto px-4 py-6" : ""
      )}>
        {currentView === 'week' && <WeekView />}
        {currentView === 'month' && <MonthView />}
        {currentView === 'analytics' && <Analytics />}
        {currentView === 'badges' && <BadgeInsights />}
        {currentView === 'mood' && <MoodInsights />}
        {currentView === 'notes' && <NotesView />}
        {currentView === 'journal' && <JournalView />}
        {currentView === 'goals' && <GoalsView />}
        {currentView === 'financial' && <FinancialView />}
        {currentView === 'reviews' && <ReviewsView />}

        {/* Paused View */}
        {currentView === 'paused' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <PauseCircle className="h-6 w-6" />
                  Paused Items
                </h1>
                <p className="text-muted-foreground">
                  Manage your paused projects, habits, and tasks
                </p>
              </div>
            </div>

            {totalPausedCount === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <PauseCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No paused items</p>
                  <p className="text-sm mt-2">Paused projects, habits, and tasks will appear here</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {/* Paused Projects */}
                {pausedProjects.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      Paused Projects ({pausedProjects.length})
                    </h2>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {pausedProjects.map((project) => (
                        <Card
                          key={project.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => handleOpenProject(project.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="font-medium">{project.name}</h3>
                              <Badge variant="outline" className="text-gray-500 border-gray-400">
                                <PauseCircle className="h-3 w-3 mr-1" />
                                Paused
                              </Badge>
                            </div>
                            {project.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {project.description}
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paused Habits */}
                {pausedHabits.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Repeat className="h-5 w-5" />
                      Paused Habits ({pausedHabits.length})
                    </h2>
                    <div className="space-y-2">
                      {pausedHabits.map((habit) => (
                        <TaskCard
                          key={habit.id}
                          task={habit}
                          onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                          onEdit={handleEditTask}

                          onAddSubtask={handleAddSubtask}
                          onDelete={handleDeleteTask}
                          subtasks={[]}
                          allTasks={tasks}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Paused Tasks */}
                {pausedTasks.length > 0 && (
                  <div className="space-y-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <ListTodo className="h-5 w-5" />
                      Paused Tasks ({pausedTasks.length})
                    </h2>
                    <div className="space-y-2">
                      {pausedTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                          onEdit={handleEditTask}

                          onAddSubtask={handleAddSubtask}
                          onDelete={handleDeleteTask}
                          subtasks={getSubtasks(task.id)}
                          allTasks={tasks}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Project View (single project) */}
        {currentView === 'project' && selectedProjectId && (
          <ProjectView
            projectId={selectedProjectId}
            onBack={handleBackFromProject}
            onEditTask={handleEditTask}
            onAddSubtask={handleAddSubtask}
            onEditProject={handleEditProject}
            onSelectProject={handleOpenProject}
          />
        )}

        {/* Habit View (single habit) */}
        {currentView === 'habit' && selectedHabitId && (
          <HabitView
            habitId={selectedHabitId}
            onBack={handleBackFromHabit}
            onEdit={() => {
              const habit = tasks.find(t => t.id === selectedHabitId)
              if (habit) {
                handleEditTask(habit)
              }
            }}
          />
        )}

        {/* List View (single list) */}
        {currentView === 'list' && selectedListId && (
          <ListView
            listId={selectedListId}
            onBack={handleBackFromList}
          />
        )}

        {/* Lists View (all lists) */}
        {currentView === 'lists' && (
          <ListsView onOpenList={handleOpenList} />
        )}

        {/* Inbox View */}
        {currentView === 'inbox' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Inbox className="h-6 w-6" />
                  Inbox
                </h2>
                <p className="text-muted-foreground">
                  Tasks that need to be reviewed and organized
                </p>
              </div>
            </div>

            {/* Quick Capture */}
            <div data-help="quick-capture">
              <QuickCapture
                projects={projects}
                onCapture={handleCreateTask}
              />
            </div>

            {/* Inbox Tasks */}
            {inboxTasks.length === 0 ? (
              <Card>
                <CardContent className="py-0">
                  <EmptyState
                    icon={Inbox}
                    title={emptyStateConfigs.inbox.title}
                    description={emptyStateConfigs.inbox.description}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {inboxTasks.length} task{inboxTasks.length !== 1 ? 's' : ''} need{inboxTasks.length === 1 ? 's' : ''} review
                </p>
                {inboxTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleCompleteTask}
                    onUncomplete={handleUncompleteTask}
                    onEdit={handleEditTask}

                    onAddSubtask={handleAddSubtask}
                    onDelete={handleDeleteTask}
                    subtasks={getSubtasks(task.id)}
                    allTasks={tasks}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects List View */}
        {currentView === 'projects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FolderOpen className="h-6 w-6" />
                  Projects
                </h2>
                <p className="text-muted-foreground">
                  View and manage all your projects
                </p>
              </div>
              {/* View mode toggle */}
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={projectViewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setProjectViewMode('grid')}
                  className="gap-1"
                >
                  <LayoutGrid className="h-4 w-4" />
                  Grid
                </Button>
                <Button
                  variant={projectViewMode === 'tree' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setProjectViewMode('tree')}
                  className="gap-1"
                >
                  <Network className="h-4 w-4" />
                  Tree
                </Button>
              </div>
            </div>

            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-0">
                  <EmptyState
                    icon={FolderOpen}
                    title={emptyStateConfigs.projects.title}
                    description={emptyStateConfigs.projects.description}
                    suggestions={emptyStateConfigs.projects.suggestions}
                    action={{
                      label: 'Create Project',
                      onClick: () => {
                        setEditingTask(null)
                        setParentTaskId(undefined)
                        setProjectFormOpen(true)
                      },
                      icon: FolderPlus,
                    }}
                  />
                </CardContent>
              </Card>
            ) : projectViewMode === 'tree' ? (
              /* Tree View */
              <ProjectTree
                tasks={tasks}
                onSelectProject={handleOpenProject}
                onEditProject={handleEditProject}
                onCreateSubproject={(parentId) => {
                  setEditingProject(null)
                  setNewProjectParentId(parentId)
                  setProjectFormOpen(true)
                }}
              />
            ) : (
              /* Grid View */
              <div className="space-y-8">
                {/* Active Projects */}
                {activeProjects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600 border-green-500">Active</Badge>
                      Projects ({activeProjects.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeProjects.map((project) => {
                        const projectTasks = tasks.filter((t) => t.project_id === project.id)
                        const completedCount = projectTasks.filter((t) => t.status === 'completed').length
                        const totalCount = projectTasks.length
                        const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
                        const remainingMinutes = projectTasks
                          .filter(t => t.status !== 'completed')
                          .reduce((sum, t) => sum + t.estimated_minutes, 0)

                        return (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); handleEditProject(project) }}
                                    title="Edit project"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Badge variant="default" className="bg-green-600">active</Badge>
                                </div>
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium">{Math.round(completionRate)}%</span>
                                </div>
                                <Progress value={completionRate} className="h-2" />
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{completedCount}/{totalCount} tasks</span>
                                  <span>{Math.round(remainingMinutes / 60)}h remaining</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Paused Projects */}
                {pausedProjects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <PauseCircle className="h-5 w-5 text-gray-500" />
                      Paused Projects ({pausedProjects.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pausedProjects.map((project) => {
                        const projectTasks = tasks.filter((t) => t.project_id === project.id)
                        const completedCount = projectTasks.filter((t) => t.status === 'completed').length
                        const totalCount = projectTasks.length
                        const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

                        return (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-75 hover:opacity-100"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); handleEditProject(project) }}
                                    title="Edit project"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Badge variant="outline" className="text-gray-500 border-gray-400">
                                    <PauseCircle className="h-3 w-3 mr-1" />
                                    paused
                                  </Badge>
                                </div>
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium">{Math.round(completionRate)}%</span>
                                </div>
                                <Progress value={completionRate} className="h-2" />
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{completedCount}/{totalCount} tasks</span>
                                  <span className="text-xs">Click to view or unpause</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Completed Projects */}
                {completedProjects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Completed Projects ({completedProjects.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {completedProjects.map((project) => {
                        const projectTasks = tasks.filter((t) => t.project_id === project.id)
                        const totalCount = projectTasks.length

                        return (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-60 hover:opacity-100"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg truncate line-through">{project.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); handleEditProject(project) }}
                                    title="Edit project"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Badge variant="secondary">completed</Badge>
                                </div>
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{totalCount} tasks</span>
                                <span>Click to view</span>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Archived Projects */}
                {archivedProjects.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
                      <FolderOpen className="h-5 w-5" />
                      Archived Projects ({archivedProjects.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {archivedProjects.map((project) => {
                        const projectTasks = tasks.filter((t) => t.project_id === project.id)
                        const totalCount = projectTasks.length

                        return (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-50 hover:opacity-100"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg truncate text-muted-foreground">{project.name}</CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); handleEditProject(project) }}
                                    title="Edit project"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Badge variant="outline">archived</Badge>
                                </div>
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>{totalCount} tasks</span>
                                <span>Click to view</span>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Habits List View */}
        {currentView === 'habits' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <Repeat className="h-6 w-6" />
                  Habits
                </h2>
                <p className="text-muted-foreground">
                  Track your recurring habits and routines
                </p>
              </div>
            </div>

            {habits.length === 0 ? (
              <Card>
                <CardContent className="py-0">
                  <EmptyState
                    icon={Repeat}
                    title={emptyStateConfigs.habits.title}
                    description={emptyStateConfigs.habits.description}
                    suggestions={emptyStateConfigs.habits.suggestions}
                    action={{
                      label: 'Create Habit',
                      onClick: () => {
                        setEditingTask(null)
                        setParentTaskId(undefined)
                        setTaskFormOpen(true)
                      },
                      icon: Plus,
                    }}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                {/* Active Habits */}
                {activeHabits.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600 border-green-500">Active</Badge>
                      Habits ({activeHabits.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {activeHabits.map((habit) => {
                        const project = projects.find(p => p.id === habit.project_id)
                        return (
                          <Card
                            key={habit.id}
                            className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                            onClick={() => handleOpenHabit(habit.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg truncate flex items-center gap-2">
                                  <Flame className="h-5 w-5 text-orange-500" />
                                  {habit.title}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); handleEditTask(habit) }}
                                    title="Edit habit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Badge variant="secondary">Habit</Badge>
                                </div>
                              </div>
                              {habit.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{habit.description}</p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {habit.recurrence && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {habit.recurrence.frequency}
                                    {habit.recurrence.days_of_week && habit.recurrence.days_of_week.length > 0 && habit.recurrence.days_of_week.length < 7 && (
                                      <span>({habit.recurrence.days_of_week.join(', ')})</span>
                                    )}
                                  </div>
                                )}
                                {project && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <FolderOpen className="h-3 w-3" />
                                    {project.name}
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-2 border-t">
                                  <span className="text-xs text-muted-foreground">Click to view analytics</span>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Paused Habits */}
                {pausedHabits.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <PauseCircle className="h-5 w-5 text-gray-500" />
                      Paused Habits ({pausedHabits.length})
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {pausedHabits.map((habit) => {
                        const project = projects.find(p => p.id === habit.project_id)
                        return (
                          <Card
                            key={habit.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-75 hover:opacity-100"
                            onClick={() => handleOpenHabit(habit.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg truncate flex items-center gap-2">
                                  <Flame className="h-5 w-5 text-gray-400" />
                                  {habit.title}
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); handleEditTask(habit) }}
                                    title="Edit habit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Badge variant="outline" className="text-gray-500 border-gray-400">
                                    <PauseCircle className="h-3 w-3 mr-1" />
                                    Paused
                                  </Badge>
                                </div>
                              </div>
                              {habit.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">{habit.description}</p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {habit.recurrence && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {habit.recurrence.frequency}
                                    {habit.recurrence.days_of_week && habit.recurrence.days_of_week.length > 0 && habit.recurrence.days_of_week.length < 7 && (
                                      <span>({habit.recurrence.days_of_week.join(', ')})</span>
                                    )}
                                  </div>
                                )}
                                {project && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <FolderOpen className="h-3 w-3" />
                                    {project.name}
                                  </div>
                                )}
                                {habit.paused_until && (
                                  <div className="text-xs text-amber-600 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Resumes: {new Date(habit.paused_until).toLocaleDateString()}
                                  </div>
                                )}
                                <div className="flex items-center justify-between pt-2 border-t">
                                  <span className="text-xs text-muted-foreground">Click to view or unpause</span>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Today View - The Core Experience */}
        {currentView === 'today' && (
          <TodayView
            schedule={schedule}
            tasks={tasks}
            projects={projects}
            loading={scheduleLoading}
            onReschedule={handleReschedule}
            onCompleteTask={handleCompleteTask}
            onUncompleteTask={handleUncompleteTask}
            onSkipTask={handleSkipTask}
            onEditTask={handleEditTask}
            selectedDate={selectedScheduleDate}
            onDateChange={setSelectedScheduleDate}
          />
        )}

        {/* All Tasks View - Secondary */}
        {currentView === 'tasks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <ListTodo className="h-6 w-6" />
                  All Tasks & Projects
                </h2>
                <p className="text-muted-foreground">
                  Manage all your tasks, habits, and projects
                </p>
              </div>
            </div>

            <Tabs defaultValue="tasks" className="space-y-4">
              <TabsList>
                <TabsTrigger value="tasks">
                  Tasks
                  <Badge variant="secondary" className="ml-2">
                    {incompleteTasks.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="dependencies">
                  Dependencies
                  <Badge variant="secondary" className="ml-2">
                    {tasks.filter(t => t.dependencies && t.dependencies.length > 0 && t.status !== 'completed').length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="habits">
                  Habits
                  <Badge variant="secondary" className="ml-2">{habits.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="projects">
                  Projects
                  <Badge variant="secondary" className="ml-2">{activeProjects.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="lists">
                  Lists
                </TabsTrigger>
                <TabsTrigger value="notes">
                  Notes
                </TabsTrigger>
                <TabsTrigger value="goals">
                  Goals
                  <Badge variant="secondary" className="ml-2">{activeGoals.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  Completed
                  <Badge variant="secondary" className="ml-2">
                    {regularTasks.filter(t => t.status === 'completed').length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="paused">
                  <PauseCircle className="h-4 w-4 mr-1" />
                  Paused
                  {totalPausedCount > 0 && (
                    <Badge variant="secondary" className="ml-2">{totalPausedCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="unscheduled">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  Unscheduled
                  {unscheduledTaskIds.length > 0 && (
                    <Badge variant="destructive" className="ml-2">{unscheduledTaskIds.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="space-y-4">
                {/* Filter and View Mode Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <Select
                        value={tasksFilterProject}
                        onValueChange={(value) => setTasksFilterProject(value as string | 'all')}
                      >
                        <SelectTrigger className="w-[200px] h-8">
                          <SelectValue placeholder="Filter by project" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects</SelectItem>
                          {activeProjects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              <div className="flex items-center gap-2">
                                {project.color && (
                                  <div
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: project.color }}
                                  />
                                )}
                                {project.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {tasksFilterProject !== 'all' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setTasksFilterProject('all')}
                        className="h-8 px-2"
                      >
                        <X className="h-4 w-4" />
                        Clear filter
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">View:</span>
                    <div className="flex items-center border rounded-md">
                      <Button
                        variant={tasksViewMode === 'list' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTasksViewMode('list')}
                        className="h-7 px-2 rounded-r-none"
                      >
                        <ListTodo className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={tasksViewMode === 'by-project' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTasksViewMode('by-project')}
                        className="h-7 px-2 rounded-l-none"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Loading tasks...
                  </div>
                ) : filteredIncompleteTasks.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {tasksFilterProject === 'all' ? (
                        <p>No incomplete tasks. Great job!</p>
                      ) : (
                        <p>No tasks in this project.</p>
                      )}
                    </CardContent>
                  </Card>
                ) : tasksViewMode === 'list' ? (
                  /* List View */
                  filteredIncompleteTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleCompleteTask}
                      onUncomplete={handleUncompleteTask}
                      onEdit={handleEditTask}

                      onAddSubtask={handleAddSubtask}
                      onDelete={handleDeleteTask}
                      subtasks={getSubtasks(task.id)}
                      allTasks={tasks}
                      scheduledDate={taskScheduleMap[task.id]}
                    />
                  ))
                ) : (
                  /* By Project View (Todoist-like) */
                  <div className="space-y-6">
                    {tasksByProject.map(({ project, tasks: projectTasks }) => (
                      <Card key={project?.id || 'no-project'} className="overflow-hidden">
                        <CardHeader
                          className="py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => project && handleOpenProject(project.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {project?.color && (
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: project.color }}
                                />
                              )}
                              <CardTitle className="text-base font-semibold">
                                {project?.name || 'No Project'}
                              </CardTitle>
                              <Badge variant="secondary" className="text-xs">
                                {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                              </Badge>
                              {project?.status === 'paused' && (
                                <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                                  <PauseCircle className="h-3 w-3 mr-1" />
                                  Paused
                                </Badge>
                              )}
                            </div>
                            {project && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0 pb-2">
                          <div className="space-y-2">
                            {projectTasks.map((task) => {
                              const scheduledDate = taskScheduleMap[task.id]
                              const isUnscheduled = unscheduledTaskIds.includes(task.id)
                              return (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border transition-all"
                                  onClick={() => handleEditTask(task)}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleCompleteTask(task.id)
                                      }}
                                      className="flex-shrink-0 h-5 w-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary hover:bg-primary/10 transition-colors"
                                    />
                                    <span className="truncate font-medium">{task.title}</span>
                                    {task.is_paused && (
                                      <Badge variant="outline" className="text-yellow-600 border-yellow-500 text-xs">
                                        <PauseCircle className="h-3 w-3 mr-1" />
                                        Paused
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {task.priority >= 4 && (
                                      <Badge variant="destructive" className="text-xs">
                                        P{task.priority}
                                      </Badge>
                                    )}
                                    {task.deadline && (
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(task.deadline).toLocaleDateString()}
                                      </span>
                                    )}
                                    {scheduledDate ? (
                                      <Badge variant="outline" className="text-xs text-green-600 border-green-500">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {scheduledDate === new Date().toISOString().split('T')[0]
                                          ? 'Today'
                                          : new Date(scheduledDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                      </Badge>
                                    ) : isUnscheduled ? (
                                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-500">
                                        <AlertCircle className="h-3 w-3 mr-1" />
                                        Unscheduled
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Dependencies Tab */}
              <TabsContent value="dependencies" className="space-y-4">
                <DependencyGraph
                  tasks={tasks}
                  onSelectTask={handleEditTask}
                />
              </TabsContent>

              {/* Habits Tab */}
              <TabsContent value="habits" className="space-y-4">
                {habits.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <p>No habits yet. Create a recurring habit to track daily routines!</p>
                    </CardContent>
                  </Card>
                ) : (
                  habits.map((habit) => {
                    const project = projects.find(p => p.id === habit.project_id)
                    return (
                      <Card
                        key={habit.id}
                        className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                        onClick={() => handleOpenHabit(habit.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Flame className="h-5 w-5 text-orange-500" />
                              <CardTitle className="text-lg">{habit.title}</CardTitle>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Habit</Badge>
                              {habit.is_paused ? (
                                <Badge variant="outline" className="text-gray-500 border-gray-400">
                                  <PauseCircle className="h-3 w-3 mr-1" />
                                  Paused
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-600 border-green-500">
                                  Active
                                </Badge>
                              )}
                            </div>
                          </div>
                          {habit.description && (
                            <p className="text-sm text-muted-foreground">{habit.description}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {habit.recurrence && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {habit.recurrence.frequency}
                                  {habit.recurrence.days_of_week && habit.recurrence.days_of_week.length > 0 && habit.recurrence.days_of_week.length < 7 && (
                                    <span>({habit.recurrence.days_of_week.join(', ')})</span>
                                  )}
                                </span>
                              )}
                              {project && (
                                <span className="flex items-center gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  {project.name}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditTask(habit)
                                }}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleOpenHabit(habit.id)
                                }}
                              >
                                View Stats
                                <ChevronRight className="h-4 w-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects" className="space-y-6">
                {projects.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <p>No projects yet. Create a project to organize your tasks!</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Active Projects */}
                    {activeProjects.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground">Active Projects ({activeProjects.length})</h3>
                        {activeProjects.map((project) => {
                          const projectTasks = tasks.filter((t) => t.project_id === project.id)
                          const completedCount = projectTasks.filter((t) => t.status === 'completed').length
                          const totalCount = projectTasks.length
                          const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

                          return (
                            <Card
                              key={project.id}
                              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                              onClick={() => handleOpenProject(project.id)}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <CardTitle className="text-lg">{project.name}</CardTitle>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                  <Badge variant="default" className="bg-green-600">active</Badge>
                                </div>
                                {project.description && (
                                  <p className="text-sm text-muted-foreground">{project.description}</p>
                                )}
                              </CardHeader>
                              <CardContent>
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">
                                    {completedCount} / {totalCount} tasks completed ({Math.round(completionRate)}%)
                                  </span>
                                  <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingTask(null); setParentTaskId(undefined); setTaskFormOpen(true) }}>
                                      <Plus className="h-4 w-4 mr-1" />Add Task
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenProject(project.id) }}>
                                      View Details<ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                  </div>
                                </div>
                                {totalCount > 0 && (
                                  <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all" style={{ width: `${completionRate}%` }} />
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}

                    {/* Paused Projects */}
                    {pausedProjects.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <PauseCircle className="h-4 w-4" />
                          Paused Projects ({pausedProjects.length})
                        </h3>
                        {pausedProjects.map((project) => (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-75 hover:opacity-100"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg">{project.name}</CardTitle>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <Badge variant="outline" className="text-gray-500 border-gray-400">
                                  <PauseCircle className="h-3 w-3 mr-1" />paused
                                </Badge>
                              </div>
                              {project.description && (
                                <p className="text-sm text-muted-foreground">{project.description}</p>
                              )}
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Completed Projects */}
                    {completedProjects.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <ClipboardCheck className="h-4 w-4" />
                          Completed Projects ({completedProjects.length})
                        </h3>
                        {completedProjects.map((project) => (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-60 hover:opacity-100"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg line-through">{project.name}</CardTitle>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <Badge variant="secondary">completed</Badge>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* Archived Projects */}
                    {archivedProjects.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          Archived Projects ({archivedProjects.length})
                        </h3>
                        {archivedProjects.map((project) => (
                          <Card
                            key={project.id}
                            className="cursor-pointer hover:shadow-md transition-all opacity-50 hover:opacity-100"
                            onClick={() => handleOpenProject(project.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg text-muted-foreground">{project.name}</CardTitle>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <Badge variant="outline">archived</Badge>
                              </div>
                            </CardHeader>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Lists Tab */}
              <TabsContent value="lists" className="space-y-4">
                {lists.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No lists yet. Create a list to track movies, books, groceries, and more!</p>
                    </CardContent>
                  </Card>
                ) : (
                  lists.map((list) => {
                    const completedCount = list.items.filter((i) => i.completed_at).length
                    const totalCount = list.items.length
                    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
                    const typeLabel = list.list_type === 'eternal' ? 'Running List' : list.list_type === 'quick' ? 'Quick List' : 'Template'

                    return (
                      <Card
                        key={list.id}
                        className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                        onClick={() => handleOpenList(list.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ListChecks className="h-5 w-5 text-primary" />
                              <CardTitle className="text-lg">{list.name}</CardTitle>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Badge variant="secondary">{typeLabel}</Badge>
                          </div>
                          {list.description && (
                            <p className="text-sm text-muted-foreground">{list.description}</p>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              {list.list_type === 'template'
                                ? `${totalCount} items in template`
                                : `${completedCount} / ${totalCount} items done (${Math.round(completionRate)}%)`
                              }
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenList(list.id)
                              }}
                            >
                              View
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                          {list.list_type !== 'template' && totalCount > 0 && (
                            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${completionRate}%` }}
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="space-y-4">
                {notes.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notes yet. Create notes to capture ideas and information!</p>
                      <Button
                        className="mt-4"
                        onClick={() => setCurrentView('notes')}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Go to Notes
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">{notes.length} notes</p>
                      <Button variant="outline" size="sm" onClick={() => setCurrentView('notes')}>
                        View All Notes
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    {notes.slice(0, 10).map((note) => (
                      <Card
                        key={note.id}
                        className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                        onClick={() => setCurrentView('notes')}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{note.title}</div>
                              {note.folder_path && (
                                <div className="text-xs text-muted-foreground">{note.folder_path}</div>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {notes.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground pt-2">
                        +{notes.length - 10} more notes
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Goals Tab */}
              <TabsContent value="goals" className="space-y-4">
                {activeGoals.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No goals yet. Set goals to track your long-term objectives!</p>
                      <Button
                        className="mt-4"
                        onClick={() => setCurrentView('goals')}
                      >
                        <Target className="h-4 w-4 mr-2" />
                        Go to Goals
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-muted-foreground">{activeGoals.length} active goals</p>
                      <Button variant="outline" size="sm" onClick={() => setCurrentView('goals')}>
                        View All Goals
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                    {activeGoals.slice(0, 10).map((goal) => (
                      <Card
                        key={goal.id}
                        className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
                        onClick={() => setCurrentView('goals')}
                      >
                        <CardContent className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Target className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{goal.title}</div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {goal.time_horizon} • {goal.category}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(goal.progress || 0)}%
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {activeGoals.length > 10 && (
                      <p className="text-center text-sm text-muted-foreground pt-2">
                        +{activeGoals.length - 10} more goals
                      </p>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Completed Tab */}
              <TabsContent value="completed" className="space-y-4">
                <CompletedTasksView
                  tasks={regularTasks}
                  projects={projects}
                  allTasks={tasks}
                  onComplete={handleCompleteTask}
                  onUncomplete={handleUncompleteTask}
                  onEdit={handleEditTask}

                  onAddSubtask={handleAddSubtask}
                  onDelete={handleDeleteTask}
                  getSubtasks={getSubtasks}
                />
              </TabsContent>

              {/* Paused Tab */}
              <TabsContent value="paused" className="space-y-6">
                {totalPausedCount === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      <PauseCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No paused items</p>
                      <p className="text-sm mt-2">Paused projects, habits, and tasks will appear here</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {/* Paused Projects */}
                    {pausedProjects.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <FolderOpen className="h-4 w-4" />
                          Paused Projects ({pausedProjects.length})
                        </h3>
                        <div className="grid gap-2">
                          {pausedProjects.map((project) => (
                            <Card
                              key={project.id}
                              className="cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => handleOpenProject(project.id)}
                            >
                              <CardContent className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{project.name}</p>
                                    {project.description && (
                                      <p className="text-sm text-muted-foreground truncate max-w-md">
                                        {project.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-gray-500 border-gray-400">
                                  <PauseCircle className="h-3 w-3 mr-1" />
                                  Paused
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paused Habits */}
                    {pausedHabits.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <Repeat className="h-4 w-4" />
                          Paused Habits ({pausedHabits.length})
                        </h3>
                        <div className="space-y-2">
                          {pausedHabits.map((habit) => (
                            <TaskCard
                              key={habit.id}
                              task={habit}
                              onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                              onEdit={handleEditTask}

                              onAddSubtask={handleAddSubtask}
                              onDelete={handleDeleteTask}
                              subtasks={[]}
                              allTasks={tasks}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Paused Tasks */}
                    {pausedTasks.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                          <ListTodo className="h-4 w-4" />
                          Paused Tasks ({pausedTasks.length})
                        </h3>
                        <div className="space-y-2">
                          {pausedTasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                              onEdit={handleEditTask}

                              onAddSubtask={handleAddSubtask}
                              onDelete={handleDeleteTask}
                              subtasks={getSubtasks(task.id)}
                              allTasks={tasks}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Unscheduled Tab */}
              <TabsContent value="unscheduled" className="space-y-4">
                {(() => {
                  // Include both regular tasks AND habits in unscheduled list
                  const allUnscheduledItems = tasks.filter(t =>
                    unscheduledTaskIds.includes(t.id) &&
                    t.status !== 'completed' &&
                    !t.parent_task_id
                  )

                  // Apply project filter
                  const unscheduledItems = unscheduledFilterProject === 'all'
                    ? allUnscheduledItems
                    : allUnscheduledItems.filter(t => t.project_id === unscheduledFilterProject)

                  const unscheduledRegularTasks = unscheduledItems.filter(t => !t.is_habit)
                  const unscheduledHabits = unscheduledItems.filter(t => t.is_habit)

                  // Group by project for by-project view
                  const unscheduledByProject = (() => {
                    const projectMap = new Map<string, { project: Project | undefined; tasks: Task[] }>()

                    // Initialize with projects that have unscheduled tasks
                    for (const task of unscheduledItems) {
                      const projectId = task.project_id || 'no-project'
                      if (!projectMap.has(projectId)) {
                        projectMap.set(projectId, {
                          project: projects.find(p => p.id === projectId),
                          tasks: [],
                        })
                      }
                      projectMap.get(projectId)!.tasks.push(task)
                    }

                    // Sort: projects with more tasks first, "no project" last
                    return Array.from(projectMap.values())
                      .sort((a, b) => {
                        if (!a.project && b.project) return 1
                        if (a.project && !b.project) return -1
                        return b.tasks.length - a.tasks.length
                      })
                  })()

                  // Helper to get reason label and color
                  const getReasonBadge = (taskId: string) => {
                    const info = unscheduledReasons[taskId]
                    if (!info) return null

                    const reasonLabels: Record<string, { label: string; color: string }> = {
                      paused: { label: 'Paused', color: 'text-gray-500' },
                      project_paused: { label: 'Project Paused', color: 'text-gray-500' },
                      too_short: { label: 'Too Short', color: 'text-blue-500' },
                      too_long: { label: 'Too Long', color: 'text-red-500' },
                      dependencies_unmet: { label: 'Blocked', color: 'text-orange-500' },
                      no_available_slots: { label: 'No Slots', color: 'text-purple-500' },
                      habit_no_occurrence: { label: 'No Occurrence', color: 'text-cyan-500' },
                      unknown: { label: 'Unknown', color: 'text-muted-foreground' },
                    }

                    const { label, color } = reasonLabels[info.reason] || reasonLabels.unknown
                    return (
                      <div className="flex flex-col items-end gap-0.5">
                        <Badge variant="outline" className={cn("text-xs", color)}>
                          {label}
                        </Badge>
                        {info.details && (
                          <span className="text-xs text-muted-foreground text-right whitespace-nowrap">
                            {info.details}
                          </span>
                        )}
                      </div>
                    )
                  }

                  if (allUnscheduledItems.length === 0) {
                    return (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                          <p>All tasks are scheduled!</p>
                          <p className="text-sm mt-2">Every active task has been assigned to a day in your schedule.</p>
                        </CardContent>
                      </Card>
                    )
                  }

                  return (
                    <div className="space-y-4">
                      {/* Filter and View Mode Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="h-4 w-4 text-muted-foreground" />
                            <Select
                              value={unscheduledFilterProject}
                              onValueChange={(value) => setUnscheduledFilterProject(value as string | 'all')}
                            >
                              <SelectTrigger className="w-[200px] h-8">
                                <SelectValue placeholder="Filter by project" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Projects</SelectItem>
                                {projects.map((project) => (
                                  <SelectItem key={project.id} value={project.id}>
                                    <div className="flex items-center gap-2">
                                      {project.color && (
                                        <div
                                          className="w-2 h-2 rounded-full"
                                          style={{ backgroundColor: project.color }}
                                        />
                                      )}
                                      {project.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {unscheduledFilterProject !== 'all' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUnscheduledFilterProject('all')}
                              className="h-8 px-2"
                            >
                              <X className="h-4 w-4" />
                              Clear filter
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">View:</span>
                          <div className="flex items-center border rounded-md">
                            <Button
                              variant={unscheduledViewMode === 'list' ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => setUnscheduledViewMode('list')}
                              className="h-7 px-2 rounded-r-none"
                            >
                              <ListTodo className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={unscheduledViewMode === 'by-project' ? 'secondary' : 'ghost'}
                              size="sm"
                              onClick={() => setUnscheduledViewMode('by-project')}
                              className="h-7 px-2 rounded-l-none"
                            >
                              <FolderOpen className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Summary Banner */}
                      <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-amber-700 dark:text-amber-400">
                              {unscheduledItems.length} item{unscheduledItems.length !== 1 ? 's' : ''} couldn't be scheduled
                              {unscheduledFilterProject !== 'all' && ` (filtered from ${allUnscheduledItems.length} total)`}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Each item shows the specific reason why it wasn't scheduled.
                            </p>
                          </div>
                        </div>
                      </div>

                      {unscheduledItems.length === 0 && unscheduledFilterProject !== 'all' ? (
                        <Card>
                          <CardContent className="py-8 text-center text-muted-foreground">
                            <p>No unscheduled items in this project.</p>
                          </CardContent>
                        </Card>
                      ) : unscheduledViewMode === 'list' ? (
                        /* List View */
                        <div className="space-y-6">
                          {/* Unscheduled Habits */}
                          {unscheduledHabits.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Repeat className="h-4 w-4" />
                                Unscheduled Habits ({unscheduledHabits.length})
                              </h3>
                              <div className="space-y-2">
                                {unscheduledHabits.map((habit) => (
                                  <div key={habit.id} className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <TaskCard
                                        task={habit}
                                        onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                                        onEdit={handleEditTask}

                                        onAddSubtask={handleAddSubtask}
                                        onDelete={handleDeleteTask}
                                        subtasks={[]}
                                        allTasks={tasks}
                                        scheduledDate={null}
                                      />
                                    </div>
                                    <div className="pt-3 flex-shrink-0">
                                      {getReasonBadge(habit.id)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Unscheduled Tasks */}
                          {unscheduledRegularTasks.length > 0 && (
                            <div className="space-y-3">
                              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <ListTodo className="h-4 w-4" />
                                Unscheduled Tasks ({unscheduledRegularTasks.length})
                              </h3>
                              <div className="space-y-2">
                                {unscheduledRegularTasks.map((task) => (
                                  <div key={task.id} className="flex items-start gap-2">
                                    <div className="flex-1">
                                      <TaskCard
                                        task={task}
                                        onComplete={handleCompleteTask}
                          onUncomplete={handleUncompleteTask}
                                        onEdit={handleEditTask}

                                        onAddSubtask={handleAddSubtask}
                                        onDelete={handleDeleteTask}
                                        subtasks={getSubtasks(task.id)}
                                        allTasks={tasks}
                                        scheduledDate={null}
                                      />
                                    </div>
                                    <div className="pt-3 flex-shrink-0">
                                      {getReasonBadge(task.id)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* By Project View */
                        <div className="space-y-6">
                          {unscheduledByProject.map(({ project, tasks: projectTasks }) => (
                            <Card key={project?.id || 'no-project'} className="overflow-hidden">
                              <CardHeader
                                className="py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => project && handleOpenProject(project.id)}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {project?.color && (
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: project.color }}
                                      />
                                    )}
                                    <CardTitle className="text-base font-semibold">
                                      {project?.name || 'No Project'}
                                    </CardTitle>
                                    <Badge variant="secondary" className="text-xs">
                                      {projectTasks.length} item{projectTasks.length !== 1 ? 's' : ''}
                                    </Badge>
                                    {project?.status === 'paused' && (
                                      <Badge variant="outline" className="text-yellow-600 border-yellow-500">
                                        <PauseCircle className="h-3 w-3 mr-1" />
                                        Paused
                                      </Badge>
                                    )}
                                  </div>
                                  {project && (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="pt-0 pb-2">
                                <div className="space-y-2">
                                  {projectTasks.map((task) => {
                                    const reasonInfo = unscheduledReasons[task.id]
                                    return (
                                      <div
                                        key={task.id}
                                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border transition-all"
                                        onClick={() => handleEditTask(task)}
                                      >
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              handleCompleteTask(task.id)
                                            }}
                                            className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-muted-foreground/30 hover:border-primary transition-colors"
                                          />
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                              {task.is_habit && <Repeat className="h-3 w-3 text-purple-500" />}
                                              <span className="font-medium truncate">{task.title}</span>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {task.estimated_minutes}min • {task.energy_level} energy
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          {getReasonBadge(task.id)}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>

      {/* Task Form Dialog */}
      <TaskForm
        open={taskFormOpen}
        onClose={() => {
          setTaskFormOpen(false)
          setEditingTask(null)
          setParentTaskId(undefined)
        }}
        onSubmit={editingTask ? handleUpdateTask : handleCreateTask}
        projects={projects}
        task={editingTask}
        parentTaskId={parentTaskId}
        allTasks={tasks}
      />

      {/* Project Form Dialog */}
      <ProjectForm
        open={projectFormOpen}
        onClose={() => {
          setProjectFormOpen(false)
          setEditingProject(null)
          setNewProjectParentId(undefined)
        }}
        onSubmit={editingProject ? handleUpdateProject : handleCreateProject}
        onStatusChange={handleProjectStatusChange}
        project={editingProject}
        projects={projects}
        initialParentId={newProjectParentId}
      />

      {/* XP Notification */}
      {showXPNotification && lastXPGain && (
        <XPNotification
          xpEarned={lastXPGain.xpEarned}
          newLevel={lastXPGain.newLevel}
          newBadges={lastXPGain.newBadges}
          onClose={handleCloseXPNotification}
        />
      )}

      {/* Onboarding Wizard */}
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={handleOnboardingComplete}
        preferences={preferences}
        onUpdatePreferences={savePreferences}
      />
    </div>
  )
}
