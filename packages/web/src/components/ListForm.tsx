import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Search, FolderOpen, Repeat } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CreateListInput, ListType, List, Task, Project } from '@/types'

interface ListFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CreateListInput) => Promise<void>
  list?: List | null
  habits?: Task[]
  projects?: Project[]
}

export function ListForm({ open, onClose, onSubmit, list, habits = [], projects = [] }: ListFormProps) {
  const [name, setName] = useState(list?.name || '')
  const [description, setDescription] = useState(list?.description || '')
  const [listType, setListType] = useState<ListType>(list?.list_type || 'eternal')
  const [categories, setCategories] = useState(list?.categories?.join(', ') || '')
  const [linkedHabitIds, setLinkedHabitIds] = useState<string[]>(list?.linked_habit_ids || [])
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>(list?.linked_project_ids || [])
  const [habitSearch, setHabitSearch] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Filter habits and projects based on search
  const filteredHabits = habits.filter(h => {
    if (!habitSearch.trim()) return true
    return h.title.toLowerCase().includes(habitSearch.toLowerCase())
  })

  const filteredProjects = projects.filter(p => {
    if (!projectSearch.trim()) return true
    return p.name.toLowerCase().includes(projectSearch.toLowerCase())
  })

  const toggleHabit = (habitId: string) => {
    setLinkedHabitIds(prev =>
      prev.includes(habitId)
        ? prev.filter(id => id !== habitId)
        : [...prev, habitId]
    )
  }

  const toggleProject = (projectId: string) => {
    setLinkedProjectIds(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        list_type: listType,
        categories: categories
          .split(',')
          .map((c) => c.trim())
          .filter((c) => c.length > 0),
        linked_habit_ids: linkedHabitIds.length > 0 ? linkedHabitIds : undefined,
        linked_project_ids: linkedProjectIds.length > 0 ? linkedProjectIds : undefined,
      })
      // Reset form
      setName('')
      setDescription('')
      setListType('eternal')
      setCategories('')
      setLinkedHabitIds([])
      setLinkedProjectIds([])
      setHabitSearch('')
      setProjectSearch('')
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setName(list?.name || '')
    setDescription(list?.description || '')
    setListType(list?.list_type || 'eternal')
    setCategories(list?.categories?.join(', ') || '')
    setLinkedHabitIds(list?.linked_habit_ids || [])
    setLinkedProjectIds(list?.linked_project_ids || [])
    setHabitSearch('')
    setProjectSearch('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{list ? 'Edit List' : 'Create New List'}</DialogTitle>
          <DialogDescription>
            {list
              ? 'Update your list details'
              : 'Create a new list to track items. Choose between a running list (eternal) or a reusable checklist template.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="grid gap-4 py-4 overflow-y-auto flex-1 px-1">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Movies to Watch, Grocery List"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this list for?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">List Type</Label>
              <Select value={listType} onValueChange={(v) => setListType(v as ListType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="eternal">
                    <div className="flex flex-col items-start">
                      <span>Running List (Eternal)</span>
                      <span className="text-xs text-muted-foreground">
                        Movies, books, restaurants - items stay when checked
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="template">
                    <div className="flex flex-col items-start">
                      <span>Checklist Template</span>
                      <span className="text-xs text-muted-foreground">
                        Grocery, packing - create fresh instances each time
                      </span>
                    </div>
                  </SelectItem>
                  <SelectItem value="quick">
                    <div className="flex flex-col items-start">
                      <span>Quick List (One-off)</span>
                      <span className="text-xs text-muted-foreground">
                        Party supplies, trip items - archives when all done
                      </span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="categories">Categories (optional)</Label>
              <Input
                id="categories"
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="e.g., Produce, Dairy, Meat (comma separated)"
              />
              <p className="text-xs text-muted-foreground">
                Categories help organize items within the list
              </p>
            </div>

            {/* Linked Habits */}
            {habits.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Repeat className="h-4 w-4" />
                  Link to Habits (optional)
                </Label>
                {linkedHabitIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {linkedHabitIds.map(id => {
                      const habit = habits.find(h => h.id === id)
                      return habit ? (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {habit.title}
                          <button
                            type="button"
                            onClick={() => toggleHabit(id)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search habits..."
                    value={habitSearch}
                    onChange={(e) => setHabitSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-md divide-y">
                  {filteredHabits.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      {habitSearch ? 'No habits found' : 'No habits available'}
                    </p>
                  ) : (
                    filteredHabits.slice(0, 10).map(habit => (
                      <label
                        key={habit.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={linkedHabitIds.includes(habit.id)}
                          onCheckedChange={() => toggleHabit(habit.id)}
                        />
                        <span className="text-sm truncate">{habit.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Linked Projects */}
            {projects.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Link to Projects (optional)
                </Label>
                {linkedProjectIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {linkedProjectIds.map(id => {
                      const project = projects.find(p => p.id === id)
                      return project ? (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {project.name}
                          <button
                            type="button"
                            onClick={() => toggleProject(id)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search projects..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="max-h-32 overflow-y-auto border rounded-md divide-y">
                  {filteredProjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground p-2 text-center">
                      {projectSearch ? 'No projects found' : 'No projects available'}
                    </p>
                  ) : (
                    filteredProjects.slice(0, 10).map(project => (
                      <label
                        key={project.id}
                        className="flex items-center gap-2 p-2 hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={linkedProjectIds.includes(project.id)}
                          onCheckedChange={() => toggleProject(project.id)}
                        />
                        <span className="text-sm truncate">{project.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || submitting}>
              {submitting ? 'Saving...' : list ? 'Save Changes' : 'Create List'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
