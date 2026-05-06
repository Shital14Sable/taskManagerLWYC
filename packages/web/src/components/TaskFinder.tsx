import { useState, useMemo } from 'react'
import { Clock, Search, Flame, Zap, Moon, AlertTriangle, Calendar, FolderOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Task, ScheduledTask, Project } from '@/types'
import { useApp } from '@/context/AppContext'
import { getCyclePhaseFromPrefs } from '@/utils/cycle'
import { cn } from '@/lib/utils'

interface TaskFinderProps {
  tasks: Task[]
  scheduledTasks: ScheduledTask[]
  projects: Project[]
  onSelectTask?: (task: Task) => void
}

const energyIcons = {
  high: <Flame className="h-3 w-3 text-orange-500" />,
  medium: <Zap className="h-3 w-3 text-yellow-500" />,
  low: <Moon className="h-3 w-3 text-blue-400" />,
}

const priorityColors: Record<number, string> = {
  1: 'bg-gray-400',
  2: 'bg-blue-400',
  3: 'bg-yellow-400',
  4: 'bg-orange-400',
  5: 'bg-red-500',
}

const PRESET_DURATIONS = [15, 30, 45, 60, 90, 120]

export function TaskFinder({ tasks, scheduledTasks, projects, onSelectTask }: TaskFinderProps) {
  const [targetMinutes, setTargetMinutes] = useState<number>(30)
  const [customMinutes, setCustomMinutes] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all')
  const [isOpen, setIsOpen] = useState(false)

  const { preferences } = useApp()
  const cyclePhase = useMemo(() => preferences ? getCyclePhaseFromPrefs(preferences) : null, [preferences])

  // Get IDs of tasks already scheduled for today
  const scheduledTaskIds = useMemo(
    () => new Set(scheduledTasks.map(st => st.task_id)),
    [scheduledTasks]
  )

  // Get project name by ID
  const getProjectName = (projectId: string) => {
    return projects.find(p => p.id === projectId)?.name || 'Unknown Project'
  }

  // Find tasks that fit the target duration
  const matchingTasks = useMemo(() => {
    const duration = customMinutes ? parseInt(customMinutes) : targetMinutes
    if (isNaN(duration) || duration <= 0) return []

    // Filter tasks that:
    // 1. Are not completed
    // 2. Have estimated_minutes <= target duration
    // 3. Are not habits (habits have fixed times)
    // 4. Match selected project (if not 'all')
    const eligible = tasks.filter(task =>
      task.status !== 'completed' &&
      !task.is_habit &&
      task.estimated_minutes <= duration &&
      task.estimated_minutes > 0 &&
      (selectedProjectId === 'all' || task.project_id === selectedProjectId)
    )

    // Score and sort by priority and urgency
    const scored = eligible.map(task => {
      let score = 0

      // Priority score (higher priority = higher score)
      score += task.priority * 20

      // Urgency: prefer tasks closer to deadline
      if (task.deadline) {
        const daysUntil = Math.floor(
          (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        if (daysUntil < 0) score += 100  // Overdue!
        else if (daysUntil === 0) score += 80  // Due today
        else if (daysUntil <= 3) score += 50  // Due soon
        else if (daysUntil <= 7) score += 30  // This week
      }

      // Bonus for tasks already in today's schedule (user wanted to do them today)
      if (scheduledTaskIds.has(task.id)) {
        score += 25
      }

      // Prefer tasks that better fit the time slot (less wasted time)
      const fitRatio = task.estimated_minutes / duration
      score += fitRatio * 15

      // Cycle phase alignment: boost tasks matching current phase energy
      if (cyclePhase && task.energy_level === cyclePhase.energyLevel) {
        score += 20
      }

      return { task, score }
    })

    // Sort by score descending, take top 10
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(item => item.task)
  }, [tasks, targetMinutes, customMinutes, scheduledTaskIds, selectedProjectId, cyclePhase])

  const activeDuration = customMinutes ? parseInt(customMinutes) : targetMinutes

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Search className="h-4 w-4" />
        Find Task by Time
      </Button>
    )
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Find Task That Fits Your Time
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap gap-4">
          {/* Duration selector */}
          <div className="space-y-2 flex-1 min-w-[200px]">
            <label className="text-sm text-muted-foreground">
              I have this much time:
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESET_DURATIONS.map(mins => (
                <Button
                  key={mins}
                  variant={targetMinutes === mins && !customMinutes ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setTargetMinutes(mins)
                    setCustomMinutes('')
                  }}
                >
                  {mins}m
                </Button>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  placeholder="Custom"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-20 h-8"
                  min={5}
                  max={480}
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            </div>
          </div>

          {/* Project filter */}
          <div className="space-y-2 min-w-[200px]">
            <label className="text-sm text-muted-foreground flex items-center gap-1">
              <FolderOpen className="h-3 w-3" />
              From project:
            </label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="h-8">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cycle phase hint */}
        {cyclePhase && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
            <span>{cyclePhase.emoji}</span>
            <span>
              <span className="font-medium">{cyclePhase.name} phase</span> — {cyclePhase.energyLevel} energy tasks prioritized
            </span>
          </div>
        )}

        {/* Results */}
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {matchingTasks.length > 0 ? (
              <>
                Found {matchingTasks.length} task{matchingTasks.length !== 1 ? 's' : ''} that fit{matchingTasks.length === 1 ? 's' : ''} in {activeDuration} minutes
                {selectedProjectId !== 'all' && (
                  <> in <span className="font-medium text-foreground">{getProjectName(selectedProjectId)}</span></>
                )}:
              </>
            ) : (
              <>
                No tasks found that fit in {activeDuration} minutes
                {selectedProjectId !== 'all' && (
                  <> in <span className="font-medium text-foreground">{getProjectName(selectedProjectId)}</span></>
                )}.
              </>
            )}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {matchingTasks.map((task, index) => (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent",
                  index === 0 && "border-primary bg-primary/5"
                )}
                onClick={() => onSelectTask?.(task)}
              >
                {/* Rank indicator */}
                <div className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                  index === 0 ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {index + 1}
                </div>

                {/* Task info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{task.title}</span>
                    {task.deadline && new Date(task.deadline) <= new Date() && (
                      <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.estimated_minutes}m
                    </span>
                    {energyIcons[task.energy_level as keyof typeof energyIcons]}
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      priorityColors[task.priority]
                    )} />
                    {selectedProjectId === 'all' && (
                      <span className="flex items-center gap-1 text-primary/70">
                        <FolderOpen className="h-3 w-3" />
                        {getProjectName(task.project_id)}
                      </span>
                    )}
                    {task.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.deadline).toLocaleDateString()}
                      </span>
                    )}
                    {scheduledTaskIds.has(task.id) && (
                      <Badge variant="secondary" className="text-[10px]">Scheduled</Badge>
                    )}
                  </div>
                </div>

                {/* Duration fit indicator */}
                <div className="text-xs text-muted-foreground text-right">
                  {Math.round((task.estimated_minutes / activeDuration) * 100)}% fit
                </div>
              </div>
            ))}
          </div>

          {matchingTasks.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Try a longer duration or add shorter tasks.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
