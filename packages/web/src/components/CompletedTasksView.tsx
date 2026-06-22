import { useState, useMemo } from 'react'
import {
  Search, Filter, ChevronDown, ChevronRight, FolderOpen,
  Calendar, X, CheckCircle2
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TaskCard } from '@/components/TaskCard'
import type { Task, Project } from '@/types'

interface CompletedTasksViewProps {
  tasks: Task[]
  projects: Project[]
  allTasks: Task[]
  onComplete: (taskId: string, actualMinutes?: number) => Promise<void>
  onUncomplete?: (taskId: string) => Promise<void>
  onEdit: (task: Task) => void
  onDelete: (taskId: string) => Promise<void>
  getSubtasks: (taskId: string) => Task[]
}

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year'

export function CompletedTasksView({
  tasks,
  projects,
  allTasks,
  onComplete,
  onUncomplete,
  onEdit,
  onDelete,
  getSubtasks,
}: CompletedTasksViewProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set(['all']))
  const [showFilters, setShowFilters] = useState(false)

  // Filter completed tasks (excluding subtasks from top level)
  const completedTasks = useMemo(() => {
    return tasks.filter(t => t.status === 'completed' && !t.parent_task_id)
  }, [tasks])

  // Apply filters
  const filteredTasks = useMemo(() => {
    let filtered = completedTasks

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      )
    }

    // Project filter
    if (selectedProject !== 'all') {
      filtered = filtered.filter(t => t.project_id === selectedProject)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      filtered = filtered.filter(t => {
        if (!t.completed_at) return false
        const completedDate = new Date(t.completed_at)

        switch (dateFilter) {
          case 'today':
            return completedDate >= today
          case 'week': {
            const weekAgo = new Date(today)
            weekAgo.setDate(weekAgo.getDate() - 7)
            return completedDate >= weekAgo
          }
          case 'month': {
            const monthAgo = new Date(today)
            monthAgo.setMonth(monthAgo.getMonth() - 1)
            return completedDate >= monthAgo
          }
          case 'quarter': {
            const quarterAgo = new Date(today)
            quarterAgo.setMonth(quarterAgo.getMonth() - 3)
            return completedDate >= quarterAgo
          }
          case 'year': {
            const yearAgo = new Date(today)
            yearAgo.setFullYear(yearAgo.getFullYear() - 1)
            return completedDate >= yearAgo
          }
          default:
            return true
        }
      })
    }

    return filtered
  }, [completedTasks, searchQuery, selectedProject, dateFilter])

  // Group by project
  const groupedByProject = useMemo(() => {
    const groups: Record<string, { project: Project | null; tasks: Task[] }> = {}

    filteredTasks.forEach(task => {
      const projectId = task.project_id || 'no-project'
      if (!groups[projectId]) {
        const project = projects.find(p => p.id === projectId) || null
        groups[projectId] = { project, tasks: [] }
      }
      groups[projectId].tasks.push(task)
    })

    // Sort tasks within each group by completed_at (most recent first)
    Object.values(groups).forEach(group => {
      group.tasks.sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : 0
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : 0
        return dateB - dateA
      })
    })

    // Sort groups by project name, with "No Project" at the end
    return Object.entries(groups).sort(([keyA, groupA], [keyB, groupB]) => {
      if (keyA === 'no-project') return 1
      if (keyB === 'no-project') return -1
      const nameA = groupA.project?.name || ''
      const nameB = groupB.project?.name || ''
      return nameA.localeCompare(nameB)
    })
  }, [filteredTasks, projects])

  const toggleProject = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev)
      if (next.has(projectId)) {
        next.delete(projectId)
      } else {
        next.add(projectId)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedProjects(new Set(groupedByProject.map(([id]) => id)))
  }

  const collapseAll = () => {
    setExpandedProjects(new Set())
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedProject('all')
    setDateFilter('all')
  }

  const hasActiveFilters = searchQuery || selectedProject !== 'all' || dateFilter !== 'all'

  if (completedTasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No completed tasks yet. Get started!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Header */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search completed tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Filter Toggle and Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-accent' : ''}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {(selectedProject !== 'all' ? 1 : 0) + (dateFilter !== 'all' ? 1 : 0)}
                </Badge>
              )}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredTasks.length} of {completedTasks.length} tasks
            </span>
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Expand all
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse all
            </Button>
          </div>
        </div>

        {/* Filter Dropdowns */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Any time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">Past week</SelectItem>
                  <SelectItem value="month">Past month</SelectItem>
                  <SelectItem value="quarter">Past 3 months</SelectItem>
                  <SelectItem value="year">Past year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      {/* Grouped Tasks */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No tasks match your filters</p>
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groupedByProject.map(([projectId, { project, tasks: projectTasks }]) => (
            <Collapsible
              key={projectId}
              open={expandedProjects.has(projectId)}
              onOpenChange={() => toggleProject(projectId)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardContent className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {expandedProjects.has(projectId) ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {project?.name || 'No Project'}
                        </span>
                        <Badge variant="secondary">
                          {projectTasks.length} task{projectTasks.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      {project && (
                        <span className="text-xs text-muted-foreground">
                          {project.description?.substring(0, 50)}
                          {(project.description?.length || 0) > 50 ? '...' : ''}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="border-t px-4 py-3 space-y-2">
                    {projectTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onComplete={onComplete}
                        onUncomplete={onUncomplete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        subtasks={getSubtasks(task.id)}
                        allTasks={allTasks}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  )
}
