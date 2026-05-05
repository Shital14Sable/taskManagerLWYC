import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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
import type { Project, CreateProjectInput } from '@/types'
import { cn } from '@/lib/utils'
import { ChevronRight, PauseCircle, Play } from 'lucide-react'

// Predefined color palette for projects
const PROJECT_COLORS = [
  { name: 'Blue', value: '#3B82F6' },
  { name: 'Green', value: '#22C55E' },
  { name: 'Purple', value: '#A855F7' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Pink', value: '#EC4899' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Red', value: '#EF4444' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Indigo', value: '#6366F1' },
  { name: 'Gray', value: '#6B7280' },
]

interface ProjectFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateProjectInput) => Promise<void>
  onStatusChange?: (project: Project, status: Project['status']) => Promise<void>
  project?: Project | null
  projects?: Project[]  // All projects for parent selection
  initialParentId?: string  // Initial parent when creating a sub-project
}

export function ProjectForm({ open, onClose, onSubmit, onStatusChange, project, projects = [], initialParentId }: ProjectFormProps) {
  const [loading, setLoading] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [formData, setFormData] = useState<CreateProjectInput>({
    name: '',
    description: '',
    priority: 3,
    color: undefined,
    parent_id: undefined,
  })

  const isPaused = project?.status === 'paused'

  const handleTogglePause = async () => {
    if (!project || !onStatusChange) return
    setStatusLoading(true)
    try {
      const newStatus = isPaused ? 'active' : 'paused'
      await onStatusChange(project, newStatus)
    } catch (error) {
      console.error('Failed to toggle pause status:', error)
    } finally {
      setStatusLoading(false)
    }
  }

  // Get all descendant project IDs to prevent circular references
  const getDescendantIds = (projectId: string): string[] => {
    const descendants: string[] = []
    const children = projects.filter(p => p.parent_id === projectId)
    for (const child of children) {
      descendants.push(child.id)
      descendants.push(...getDescendantIds(child.id))
    }
    return descendants
  }

  // Filter valid parent options: exclude self and all descendants
  const validParentOptions = projects.filter(p => {
    if (!project) return p.status === 'active' || p.status === 'paused'
    if (p.id === project.id) return false
    const descendantIds = getDescendantIds(project.id)
    if (descendantIds.includes(p.id)) return false
    return p.status === 'active' || p.status === 'paused'
  })

  // Build project path for display (e.g., "Parent > Child > Grandchild")
  const getProjectPath = (projectId: string): string => {
    const p = projects.find(proj => proj.id === projectId)
    if (!p) return ''
    if (!p.parent_id) return p.name
    return `${getProjectPath(p.parent_id)} > ${p.name}`
  }

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        priority: project.priority,
        color: project.color || undefined,
        parent_id: project.parent_id || undefined,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        priority: 3,
        color: undefined,
        parent_id: initialParentId || undefined,
      })
    }
  }, [project, open, initialParentId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit(formData)
      onClose()
    } catch (error) {
      console.error('Failed to save project:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'Create Project'}</DialogTitle>
          <DialogDescription className="sr-only">
            {project ? 'Edit project details' : 'Create a new project'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Project name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={String(formData.priority)}
              onValueChange={(value) => setFormData({ ...formData, priority: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p} - {['Very Low', 'Low', 'Medium', 'High', 'Critical'][p - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Parent Project Selector */}
          <div className="space-y-2">
            <Label htmlFor="parent">Parent Project (optional)</Label>
            <Select
              value={formData.parent_id || '_none'}
              onValueChange={(value) => setFormData({ ...formData, parent_id: value === '_none' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No parent (top-level project)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">
                  <span className="text-muted-foreground">No parent (top-level project)</span>
                </SelectItem>
                {validParentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-1">
                      {p.parent_id && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                      <span>{getProjectPath(p.id)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Sub-projects inherit pause status from their parent
            </p>
          </div>

          <div className="space-y-2">
            <Label>Color (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {/* No color option */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, color: undefined })}
                className={cn(
                  "h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all",
                  !formData.color
                    ? "border-primary ring-2 ring-primary ring-offset-2"
                    : "border-muted-foreground/30 hover:border-muted-foreground"
                )}
                title="No color"
              >
                <span className="text-xs text-muted-foreground">—</span>
              </button>
              {/* Color options */}
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-all",
                    formData.color === color.value
                      ? "border-primary ring-2 ring-primary ring-offset-2"
                      : "border-transparent hover:scale-110"
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Pause/Unpause toggle - only shown when editing */}
          {project && onStatusChange && project.status !== 'completed' && project.status !== 'archived' && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="pause-toggle" className="flex items-center gap-2">
                    {isPaused ? (
                      <>
                        <PauseCircle className="h-4 w-4 text-yellow-500" />
                        Project Paused
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 text-green-500" />
                        Project Active
                      </>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {isPaused
                      ? 'Tasks in this project won\'t appear in your schedule'
                      : 'Tasks from this project will be scheduled normally'}
                  </p>
                </div>
                <Switch
                  id="pause-toggle"
                  checked={!isPaused}
                  onCheckedChange={handleTogglePause}
                  disabled={statusLoading}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? 'Saving...' : project ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
