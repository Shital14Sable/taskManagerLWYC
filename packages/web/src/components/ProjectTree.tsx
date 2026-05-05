import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  FolderClosed,
  PauseCircle,
  Play,
  Edit,
  Trash2,
  Plus,
  AlertTriangle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjects } from '@/hooks/useProjects'
import type { Project, Task } from '@/types'
import { cn } from '@/lib/utils'

interface ProjectTreeProps {
  tasks: Task[]
  onSelectProject: (projectId: string) => void
  onEditProject: (project: Project) => void
  onCreateSubproject: (parentId: string) => void
}

interface ProjectNodeProps {
  project: Project
  tasks: Task[]
  level: number
  isExpanded: boolean
  onToggle: () => void
  onSelect: () => void
  onEdit: () => void
  onDelete: () => Promise<void>
  onCreateSubproject: () => void
  onUnpauseSubprojects: () => Promise<void>
  childProjects: Project[]
  isParentPaused: boolean
  hasChildProjects: boolean
  hasPausedSubprojects: boolean
}

function ProjectNode({
  project,
  tasks,
  level,
  isExpanded,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onCreateSubproject,
  onUnpauseSubprojects,
  childProjects,
  isParentPaused,
  hasChildProjects,
  hasPausedSubprojects,
}: ProjectNodeProps) {
  const [deleting, setDeleting] = useState(false)
  const [unpausingAll, setUnpausingAll] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const projectTasks = tasks.filter((t) => t.project_id === project.id)
  const completedCount = projectTasks.filter((t) => t.status === 'completed').length
  const totalCount = projectTasks.length
  const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  const isPaused = project.status === 'paused'
  const isEffectivelyPaused = isPaused || isParentPaused

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete()
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleUnpauseSubprojects = async () => {
    setUnpausingAll(true)
    try {
      await onUnpauseSubprojects()
    } finally {
      setUnpausingAll(false)
    }
  }

  return (
    <div className={cn("group", level > 0 && "ml-6 border-l-2 border-muted pl-4")}>
      <div
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-lg transition-all cursor-pointer",
          "hover:bg-accent/50",
          isEffectivelyPaused && "opacity-70"
        )}
      >
        {/* Expand/Collapse button */}
        {hasChildProjects ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            className="p-0.5 hover:bg-accent rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Folder icon */}
        {isExpanded && hasChildProjects ? (
          <FolderOpen className="h-5 w-5 text-amber-500" />
        ) : (
          <FolderClosed className="h-5 w-5 text-amber-500" />
        )}

        {/* Project name and info */}
        <div className="flex-1 min-w-0" onClick={onSelect}>
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{project.name}</span>

            {/* Status badges */}
            {isPaused && (
              <Badge variant="outline" className="text-gray-500 border-gray-400 text-xs">
                <PauseCircle className="h-3 w-3 mr-1" />
                paused
              </Badge>
            )}
            {isParentPaused && !isPaused && (
              <Badge
                variant="outline"
                className="text-orange-500 border-orange-400 text-xs cursor-help"
                title="Paused because parent project is paused"
              >
                <AlertTriangle className="h-3 w-3 mr-1" />
                inherited
              </Badge>
            )}
            {project.status === 'active' && !isParentPaused && (
              <Badge variant="outline" className="text-green-600 border-green-500 text-xs">
                active
              </Badge>
            )}

            {/* Task count */}
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {completedCount}/{totalCount} tasks
              </span>
            )}

            {/* Sub-project count */}
            {childProjects.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {childProjects.length} sub-project{childProjects.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mt-1 max-w-xs">
              <Progress value={completionRate} className="h-1" />
            </div>
          )}
        </div>

        {/* Action buttons (visible on hover) */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Unpause all sub-projects button */}
          {hasPausedSubprojects && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                handleUnpauseSubprojects()
              }}
              disabled={unpausingAll}
              title="Unpause all sub-projects"
            >
              <Play className="h-4 w-4 text-green-600" />
            </Button>
          )}

          {/* Add sub-project button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onCreateSubproject()
            }}
            title="Create sub-project"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Edit button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation()
              onEdit()
            }}
          >
            <Edit className="h-4 w-4" />
          </Button>

          {/* Delete button with confirmation */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              setShowDeleteConfirm(true)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Delete confirmation dialog */}
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Project</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete "{project.name}"?
                  {childProjects.length > 0 && (
                    <span className="block mt-2 text-destructive font-medium">
                      This will also delete {childProjects.length} sub-project{childProjects.length !== 1 ? 's' : ''} and all their tasks.
                    </span>
                  )}
                  {totalCount > 0 && (
                    <span className="block mt-1">
                      {totalCount} task{totalCount !== 1 ? 's' : ''} will be deleted.
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  )
}

export function ProjectTree({
  tasks,
  onSelectProject,
  onEditProject,
  onCreateSubproject,
}: ProjectTreeProps) {
  const {
    projects,
    topLevelProjects,
    isParentPaused,
    getChildProjects,
    deleteProject,
    unpauseAllSubprojects,
  } = useProjects()

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Build tree structure
  const buildTree = (parentId: string | null = null, level: number = 0): JSX.Element[] => {
    const projectsAtLevel = parentId === null
      ? topLevelProjects
      : getChildProjects(parentId)

    return projectsAtLevel.map((project) => {
      const childProjects = getChildProjects(project.id)
      const hasChildren = childProjects.length > 0
      const isExpanded = expandedIds.has(project.id)
      const parentPaused = isParentPaused(project.id)

      // Check if any sub-project is paused
      const hasPausedSubprojects = childProjects.some(
        (child) => child.status === 'paused'
      ) || childProjects.some((child) =>
        getChildProjects(child.id).some((grandchild) => grandchild.status === 'paused')
      )

      return (
        <div key={project.id}>
          <ProjectNode
            project={project}
            tasks={tasks}
            level={level}
            isExpanded={isExpanded}
            onToggle={() => {
              setExpandedIds((prev) => {
                const next = new Set(prev)
                if (next.has(project.id)) {
                  next.delete(project.id)
                } else {
                  next.add(project.id)
                }
                return next
              })
            }}
            onSelect={() => onSelectProject(project.id)}
            onEdit={() => onEditProject(project)}
            onDelete={() => deleteProject(project.id)}
            onCreateSubproject={() => onCreateSubproject(project.id)}
            onUnpauseSubprojects={() => unpauseAllSubprojects(project.id)}
            childProjects={childProjects}
            isParentPaused={parentPaused}
            hasChildProjects={hasChildren}
            hasPausedSubprojects={hasPausedSubprojects}
          />

          {/* Render children if expanded */}
          {isExpanded && hasChildren && (
            <div className="mt-1">
              {buildTree(project.id, level + 1)}
            </div>
          )}
        </div>
      )
    })
  }

  // Expand/collapse all
  const expandAll = () => {
    const allIds = new Set(projects.map((p) => p.id))
    setExpandedIds(allIds)
  }

  const collapseAll = () => {
    setExpandedIds(new Set())
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Project Tree
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="ghost" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No projects yet. Create your first project to get started.
          </p>
        ) : (
          <div className="space-y-1">
            {buildTree()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
