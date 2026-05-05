import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Inbox, Loader2, Calendar, Flag, Clock, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Project, CreateTaskInput } from '@/types'
import { parseTaskInput, hasParsableContent, type ParsedTask } from '@/utils/nlpParser'

interface QuickCaptureProps {
  projects: Project[]
  onCapture: (data: CreateTaskInput) => Promise<void>
  defaultProjectId?: string
}

export function QuickCapture({ projects, onCapture, defaultProjectId }: QuickCaptureProps) {
  const [rawInput, setRawInput] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Parse the input as user types
  const parsed: ParsedTask | null = useMemo(() => {
    if (!rawInput.trim()) return null
    return parseTaskInput(rawInput)
  }, [rawInput])

  // Check if input contains parseable content (for showing preview)
  const showPreview = useMemo(() => {
    return rawInput.trim() && hasParsableContent(rawInput)
  }, [rawInput])

  // Set default project if not set
  useEffect(() => {
    if (!projectId && projects.length > 0) {
      // Try to find a default or first active project
      const activeProjects = projects.filter(p => p.status === 'active')
      if (activeProjects.length > 0) {
        setProjectId(activeProjects[0].id)
      }
    }
  }, [projects, projectId])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if (!rawInput.trim() || !projectId || !parsed) return

    setIsSubmitting(true)
    try {
      await onCapture({
        project_id: projectId,
        title: parsed.title || rawInput.trim(),
        priority: parsed.priority ?? 4, // Use parsed or default to high
        difficulty: 3,
        energy_level: parsed.energyLevel ?? 'medium',
        estimated_minutes: parsed.estimatedMinutes ?? 30, // Use parsed or default 30 min
        deadline: parsed.deadline ? parsed.deadline.toISOString() : undefined,
        needs_review: true, // Mark as needing review
      })
      setRawInput('')
      // Keep expanded if user just submitted
    } catch (error) {
      console.error('Failed to create task:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      setIsExpanded(false)
      setRawInput('')
    }
  }

  // Format date for display
  const formatDate = (date: Date): string => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow'
    } else {
      return date.toLocaleDateString()
    }
  }

  // Get priority label
  const getPriorityLabel = (priority: number): string => {
    const labels: Record<number, string> = {
      1: 'Very Low',
      2: 'Low',
      3: 'Medium',
      4: 'High',
      5: 'Critical',
    }
    return labels[priority] || 'Medium'
  }

  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start text-muted-foreground gap-2 h-10"
        onClick={() => {
          setIsExpanded(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
      >
        <Plus className="h-4 w-4" />
        Quick capture...
      </Button>
    )
  }

  return (
    <Card className="border-primary/50">
      <CardContent className="p-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder='Try: "Meeting tomorrow 2h high priority"'
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSubmitting}
                className="h-9"
                autoFocus
              />
            </div>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Project" />
              </SelectTrigger>
              <SelectContent>
                {projects.filter(p => p.status === 'active').map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              size="sm"
              className="h-9"
              disabled={isSubmitting || !rawInput.trim() || !projectId}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Natural Language Preview */}
          {showPreview && parsed && (
            <div className="flex flex-wrap gap-2 text-xs">
              {parsed.title && parsed.title !== rawInput.trim() && (
                <span className="px-2 py-1 bg-muted rounded-md text-foreground font-medium">
                  "{parsed.title}"
                </span>
              )}
              {parsed.deadline && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-md">
                  <Calendar className="h-3 w-3" />
                  {formatDate(parsed.deadline)}
                </span>
              )}
              {parsed.priority && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
                  parsed.priority >= 4
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : parsed.priority >= 3
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  <Flag className="h-3 w-3" />
                  {getPriorityLabel(parsed.priority)}
                </span>
              )}
              {parsed.estimatedMinutes && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-md">
                  <Clock className="h-3 w-3" />
                  {parsed.estimatedMinutes >= 60
                    ? `${Math.floor(parsed.estimatedMinutes / 60)}h${parsed.estimatedMinutes % 60 > 0 ? ` ${parsed.estimatedMinutes % 60}m` : ''}`
                    : `${parsed.estimatedMinutes}m`}
                </span>
              )}
              {parsed.energyLevel && (
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${
                  parsed.energyLevel === 'high'
                    ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    : parsed.energyLevel === 'medium'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                }`}>
                  <Zap className="h-3 w-3" />
                  {parsed.energyLevel}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Inbox className="h-3 w-3" />
              Task will be added to inbox for review
            </span>
            <button
              type="button"
              className="hover:text-foreground"
              onClick={() => {
                setIsExpanded(false)
                setRawInput('')
              }}
            >
              Cancel (Esc)
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default QuickCapture
