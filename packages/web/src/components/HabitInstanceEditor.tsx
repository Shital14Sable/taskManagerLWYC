import { useState, useEffect } from 'react'
import { UtensilsCrossed, Edit2, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useApp } from '@/context/AppContext'
import type { Task, HabitInstance } from '@/types'

interface HabitInstanceEditorProps {
  habit: Task
  date: string  // YYYY-MM-DD format
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

export function HabitInstanceEditor({
  habit,
  date,
  isOpen,
  onClose,
  onSave,
}: HabitInstanceEditorProps) {
  const { getHabitInstance, saveHabitInstance } = useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [instance, setInstance] = useState<HabitInstance | null>(null)
  const [detail, setDetail] = useState('')
  const [notes, setNotes] = useState('')

  // Load existing instance when dialog opens
  useEffect(() => {
    if (isOpen && habit.id && date) {
      loadInstance()
    }
  }, [isOpen, habit.id, date])

  const loadInstance = async () => {
    setLoading(true)
    try {
      const inst = await getHabitInstance(habit.id, date)
      if (inst) {
        setInstance(inst)
        setDetail(inst.instance_detail)
        setNotes(inst.notes || '')
      } else {
        // No instance exists yet
        setInstance(null)
        setDetail('')
        setNotes('')
      }
    } catch (error) {
      console.error('Failed to load habit instance:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!detail.trim()) return

    setSaving(true)
    try {
      const now = new Date().toISOString()
      await saveHabitInstance({
        habit_id: habit.id,
        date,
        instance_detail: detail.trim(),
        notes: notes.trim() || undefined,
        created_at: instance?.created_at || now,
        updated_at: now,
      })
      onSave?.()
      onClose()
    } catch (error) {
      console.error('Failed to save habit instance:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!instance) return

    setSaving(true)
    try {
      // For now, just clear the instance locally (could add deleteHabitInstance to context)
      setInstance(null)
      setDetail('')
      setNotes('')
      onSave?.()
      onClose()
    } catch (error) {
      console.error('Failed to delete habit instance:', error)
    } finally {
      setSaving(false)
    }
  }

  const formattedDate = new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            {habit.title} - {formattedDate}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Plan and track your habit instance for this date
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instance-detail">
                What's planned for this {habit.title.toLowerCase()}?
              </Label>
              <Input
                id="instance-detail"
                placeholder={`e.g., Fried Rice, Pasta, Salad...`}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                This will show in your schedule as "{habit.title} - {detail || '...'}"
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instance-notes">Notes (optional)</Label>
              <Textarea
                id="instance-notes"
                placeholder="Recipe link, ingredients to buy, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <div>
            {instance && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !detail.trim()}>
              {saving ? 'Saving...' : instance ? 'Update' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Compact inline display for habit instance detail in schedule views
interface HabitInstanceBadgeProps {
  habitId: string
  date: string
  onEdit?: () => void
}

export function HabitInstanceBadge({ habitId, date, onEdit }: HabitInstanceBadgeProps) {
  const { getHabitInstance } = useApp()
  const [instance, setInstance] = useState<HabitInstance | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInstance()
  }, [habitId, date])

  const loadInstance = async () => {
    try {
      const inst = await getHabitInstance(habitId, date)
      setInstance(inst)
    } catch (error) {
      console.error('Failed to load habit instance:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return null
  if (!instance) {
    return onEdit ? (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onEdit()
        }}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <Edit2 className="h-3 w-3" />
        Plan this
      </button>
    ) : null
  }

  return (
    <span
      className="text-xs text-primary font-medium cursor-pointer hover:underline"
      onClick={(e) => {
        e.stopPropagation()
        onEdit?.()
      }}
      title={instance.notes || undefined}
    >
      - {instance.instance_detail}
    </span>
  )
}
