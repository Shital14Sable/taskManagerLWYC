import { useState, useEffect, useRef } from 'react'
import { Settings, Clock, Save, Download, Upload, FileJson, Trash2, AlertTriangle, Github, Cloud, LogOut, RefreshCw, Mail, BookOpen, Rocket, Eye, Moon, X, Plus, Briefcase } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { UserPreferences, OfficeHoursDay } from '@trackmind/core'
import { useApp } from '@/context/AppContext'
import { useHelpMode } from '@/context/HelpModeContext'
import { Documentation } from '@/components/Documentation'
import { getCyclePhaseFromPrefs, computeAverageCycleLength } from '@/utils/cycle'
import type { CycleSeason } from '@/utils/cycle'

interface DayWorkHours {
  start: string
  end: string
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

interface SettingsDialogProps {
  onRestartWizard?: () => void
}

export function SettingsDialog({ onRestartWizard }: SettingsDialogProps) {
  const {
    preferences: storedPreferences,
    savePreferences,
    tasks,
    projects,
    lists,
    exportData,
    importData,
    clearAllData,
    // Auth & Sync
    authProvider,
    authState,
    isGitHubAvailable,
    isGoogleAvailable,
    loginWithGitHub,
    loginWithGoogle,
    logout,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    sync,
    forcePush,
    forcePull,
  } = useApp()

  const { isHelpModeActive, toggleHelpMode } = useHelpMode()

  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [selectedDay, setSelectedDay] = useState('monday')
  const [activeTab, setActiveTab] = useState('sync')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Export/Import state
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [newPeriodDate, setNewPeriodDate] = useState('')
  const [newOverrideDate, setNewOverrideDate] = useState('')
  const [newOverrideDateAdditional, setNewOverrideDateAdditional] = useState('')

  // Sync handlers with error display
  const handleSync = async () => {
    setSyncError(null)
    try {
      const result = await sync()
      if (result && !result.success) {
        setSyncError(result.message || 'Sync failed')
        console.error('[Sync] Error:', result.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error'
      setSyncError(message)
      console.error('[Sync] Exception:', error)
    }
  }

  const handleForcePush = async () => {
    setSyncError(null)
    try {
      const result = await forcePush()
      if (result && !result.success) {
        setSyncError(result.message || 'Force push failed')
        console.error('[Sync] Force push error:', result.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setSyncError(message)
      console.error('[Sync] Force push exception:', error)
    }
  }

  const handleForcePull = async () => {
    setSyncError(null)
    try {
      const result = await forcePull()
      if (result && !result.success) {
        setSyncError(result.message || 'Force pull failed')
        console.error('[Sync] Force pull error:', result.message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setSyncError(message)
      console.error('[Sync] Force pull exception:', error)
    }
  }

  useEffect(() => {
    if (open && storedPreferences) {
      setPreferences(storedPreferences)
    }
  }, [open, storedPreferences])

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await exportData()
      if (data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `trackmind-export-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to export data:', error)
    } finally {
      setExporting(false)
    }
  }

  const handleImportClick = () => {
    setImportError(null)
    setImportSuccess(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setImportError(null)
    setImportSuccess(false)

    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Validate basic structure
      if (!data.version) {
        // Try to convert from old server export format
        const converted = convertOldExportFormat(data)
        await importData(converted)
      } else {
        await importData(data)
      }

      setImportSuccess(true)
    } catch (error) {
      console.error('Failed to import data:', error)
      setImportError(error instanceof Error ? error.message : 'Invalid JSON file')
    } finally {
      setImporting(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Convert old FastAPI server export format to new format
  const convertOldExportFormat = (oldData: Record<string, unknown>) => {
    const now = new Date().toISOString()

    // Helper to convert tasks from old format
    const convertTasks = (oldTasks: Record<string, unknown>[] = [], habits: Record<string, unknown>[] = []) => {
      const allTasks = [...oldTasks, ...habits.map(h => ({ ...h, is_habit: true }))]
      return allTasks.map((t: Record<string, unknown>) => ({
        id: t.id as string,
        project_id: (t.project_id as string) || 'default',
        title: t.title as string,
        description: t.description as string || '',
        status: t.status as string || 'todo',
        priority: t.priority as number || 2,
        difficulty: t.difficulty as number || 2,
        energy_level: t.energy_level as string || 'medium',
        estimated_minutes: t.estimated_minutes as number || 30,
        deadline: t.deadline as string || null,
        tags: t.tags as string[] || [],
        dependencies: t.dependencies as string[] || [],
        is_habit: !!t.is_habit,
        recurrence: t.recurrence || null,
        is_paused: !!t.is_paused,
        paused_until: t.paused_until as string || null,
        parent_task_id: t.parent_task_id as string || null,
        created_at: now,
        updated_at: now,
      }))
    }

    // Helper to convert projects
    const convertProjects = (oldProjects: Record<string, unknown>[] = []) => {
      return oldProjects.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        description: p.description as string || '',
        status: p.status as string || 'active',
        created_at: (p.created_at as string) || now,
        updated_at: now,
      }))
    }

    // Helper to convert lists
    const convertLists = (oldLists: Record<string, unknown>[] = []) => {
      return oldLists.map((l: Record<string, unknown>) => ({
        id: l.id as string,
        name: l.name as string,
        description: l.description as string || '',
        list_type: l.list_type as string || 'checklist',
        items: (l.items as Record<string, unknown>[] || []).map((item: Record<string, unknown>) => ({
          id: item.id as string,
          text: item.text as string,
          completed_at: item.completed_at as string || null,
          quantity: item.quantity as number || null,
          notes: item.notes as string || '',
          category: item.category as string || null,
          url: item.url as string || null,
          tags: item.tags as string[] || [],
          order: item.order as number || 0,
          price: item.price as number || null,
          rating: item.rating as number || null,
          priority: item.priority as string || null,
          location: item.location as string || null,
          due_date: item.due_date as string || null,
          source: item.source as string || null,
        })),
        categories: l.categories as string[] || [],
        is_pinned: !!l.is_pinned,
        is_archived: false,
        color: l.color as string || null,
        icon: l.icon as string || null,
        default_sort: l.default_sort as string || 'order',
        linked_habit_ids: l.linked_habit_ids as string[] || [],
        linked_project_ids: l.linked_project_ids as string[] || [],
        created_at: (l.created_at as string) || now,
        updated_at: now,
      }))
    }

    return {
      version: '1.0',
      exportedAt: now,
      tasks: convertTasks(
        oldData.tasks as Record<string, unknown>[],
        oldData.habits as Record<string, unknown>[]
      ),
      projects: convertProjects(oldData.projects as Record<string, unknown>[]),
      schedules: [],
      goals: [],
      notes: [],
      lists: convertLists(oldData.lists as Record<string, unknown>[]),
      listInstances: [],
      habitInstances: [],
      preferences: storedPreferences,
      stats: { total_xp: 0, level: 1, tasks_completed: 0, streaks: {} },
    }
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await clearAllData()
      setShowClearConfirm(false)
    } catch (error) {
      console.error('Failed to clear data:', error)
    } finally {
      setClearing(false)
    }
  }

  const handleSave = async () => {
    if (!preferences) return
    setSaving(true)
    try {
      await savePreferences(preferences)
      setOpen(false)
    } catch (error) {
      console.error('Failed to save preferences:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateWorkHours = (day: string, field: 'start' | 'end', value: string) => {
    if (!preferences) return
    setPreferences({
      ...preferences,
      work_hours: {
        ...preferences.work_hours,
        [day]: {
          ...preferences.work_hours[day],
          [field]: value,
        },
      },
    })
  }

  const copyToAllDays = (sourceDay: string) => {
    if (!preferences) return
    const sourceWorkHours = preferences.work_hours[sourceDay]
    const newWorkHours: Record<string, DayWorkHours> = {}
    for (const day of DAYS) {
      newWorkHours[day] = { ...sourceWorkHours }
    }
    setPreferences({ ...preferences, work_hours: newWorkHours })
  }

  // Calculate summary
  const habitCount = tasks.filter(t => t.is_habit).length
  const taskCount = tasks.filter(t => !t.is_habit).length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings" data-help="settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure your work hours, energy patterns, cloud sync, and data management
          </DialogDescription>
        </DialogHeader>

        {preferences ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="sync" className="gap-2">
                <Cloud className="h-4 w-4" />
                Sync
              </TabsTrigger>
              <TabsTrigger value="work-hours" className="gap-2">
                <Clock className="h-4 w-4" />
                Work Hours
              </TabsTrigger>
              <TabsTrigger value="cycle" className="gap-2">
                <Moon className="h-4 w-4" />
                Cycle
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2">
                <FileJson className="h-4 w-4" />
                Data
              </TabsTrigger>
              <TabsTrigger value="help" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Help
              </TabsTrigger>
            </TabsList>

            {/* Work Hours Tab */}
            <TabsContent value="work-hours" className="space-y-4">

              {/* Office Hours Card — shown first */}
              {(() => {
                const WEEKDAYS_OFFICE = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
                const WEEKDAY_LABELS: Record<string, string> = {
                  monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu',
                  friday:'Fri', saturday:'Sat', sunday:'Sun',
                }

                const oh = preferences.office_hours
                const defaultSchedule: Record<string, OfficeHoursDay> = {
                  monday:    { enabled: true,  start: '09:00', end: '17:00' },
                  tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
                  wednesday: { enabled: true,  start: '09:00', end: '17:00' },
                  thursday:  { enabled: true,  start: '09:00', end: '17:00' },
                  friday:    { enabled: true,  start: '09:00', end: '17:00' },
                  saturday:  { enabled: false, start: '09:00', end: '17:00' },
                  sunday:    { enabled: false, start: '09:00', end: '17:00' },
                }

                const updateOH = (patch: Partial<typeof oh>) =>
                  setPreferences({
                    ...preferences,
                    office_hours: {
                      enabled: oh?.enabled ?? false,
                      schedule: oh?.schedule ?? defaultSchedule,
                      date_overrides: oh?.date_overrides ?? {},
                      project_id: oh?.project_id ?? null,
                      ...patch,
                    },
                  })

                const updateDay = (day: string, patch: Partial<OfficeHoursDay>) =>
                  updateOH({
                    schedule: {
                      ...(oh?.schedule ?? defaultSchedule),
                      [day]: { ...(oh?.schedule?.[day] ?? defaultSchedule[day]), ...patch },
                    },
                  })

                const addDateOverride = () => {
                  if (!newOverrideDate) return
                  updateOH({
                    date_overrides: {
                      ...(oh?.date_overrides ?? {}),
                      [newOverrideDate]: { enabled: true, start: '09:00', end: '17:00' },
                    },
                  })
                  setNewOverrideDate('')
                }

                const updateDateOverride = (date: string, patch: Partial<OfficeHoursDay> | null) => {
                  const overrides = { ...(oh?.date_overrides ?? {}) }
                  if (patch === null) { delete overrides[date] }
                  else { overrides[date] = { ...(overrides[date] ?? { enabled: true, start: '09:00', end: '17:00' }), ...patch } }
                  updateOH({ date_overrides: overrides })
                }

                const activeProjects = projects.filter(p => p.status === 'active')

                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Office Hours
                      </CardTitle>
                      <CardDescription>
                        Tasks from a designated project will only be scheduled within these hours and on enabled days.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">

                      {/* Enable toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Enable office hours</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Restricts one project's tasks to a fixed work-hours window
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={oh?.enabled ?? false}
                          onClick={() => updateOH({ enabled: !(oh?.enabled ?? false) })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${oh?.enabled ? 'bg-primary' : 'bg-input'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${oh?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {(oh?.enabled) && (
                        <>
                          {/* Project selector */}
                          <div className="space-y-1.5">
                            <Label className="text-sm">Office / Work project</Label>
                            <Select
                              value={oh?.project_id ?? 'none'}
                              onValueChange={v => updateOH({ project_id: v === 'none' ? null : v })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Select a project…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">None selected</SelectItem>
                                {activeProjects.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Tasks from this project are only scheduled within the office window below.
                            </p>
                          </div>

                          {/* Per-day schedule */}
                          <div className="space-y-2">
                            <Label className="text-sm">Weekly schedule</Label>
                            <div className="space-y-2">
                              {WEEKDAYS_OFFICE.map(day => {
                                const cfg = oh?.schedule?.[day] ?? defaultSchedule[day]
                                return (
                                  <div key={day} className="flex items-center gap-3">
                                    {/* Enabled toggle */}
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={cfg.enabled}
                                      onClick={() => updateDay(day, { enabled: !cfg.enabled })}
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${cfg.enabled ? 'bg-primary' : 'bg-input'}`}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${cfg.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                    <span className={`text-sm w-8 shrink-0 ${cfg.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                      {WEEKDAY_LABELS[day]}
                                    </span>
                                    {cfg.enabled ? (
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="time"
                                          value={cfg.start}
                                          onChange={e => updateDay(day, { start: e.target.value })}
                                          className="h-7 w-28 text-xs"
                                        />
                                        <span className="text-xs text-muted-foreground">to</span>
                                        <Input
                                          type="time"
                                          value={cfg.end}
                                          onChange={e => updateDay(day, { end: e.target.value })}
                                          className="h-7 w-28 text-xs"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">Office closed</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* One-day date overrides */}
                          <div className="space-y-2">
                            <Label className="text-sm">Single-day overrides</Label>
                            <p className="text-xs text-muted-foreground">
                              Override hours for a specific date (e.g. a public holiday or early finish).
                            </p>

                            {/* Add override row */}
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={newOverrideDate}
                                onChange={e => setNewOverrideDate(e.target.value)}
                                className="h-8 w-44 text-sm"
                                onKeyDown={e => e.key === 'Enter' && addDateOverride()}
                              />
                              <Button size="sm" variant="outline" onClick={addDateOverride} disabled={!newOverrideDate} className="h-8 gap-1">
                                <Plus className="h-3 w-3" />
                                Add
                              </Button>
                            </div>

                            {/* Existing overrides */}
                            {Object.keys(oh?.date_overrides ?? {}).sort().length > 0 && (
                              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
                                {Object.entries(oh?.date_overrides ?? {}).sort().map(([date, cfg]) => (
                                  <div key={date} className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground w-24 shrink-0 text-xs">
                                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    {/* Closed toggle */}
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={cfg?.enabled ?? true}
                                      onClick={() => updateDateOverride(date, { enabled: !(cfg?.enabled ?? true) })}
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${cfg?.enabled ? 'bg-primary' : 'bg-input'}`}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${cfg?.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                    {cfg?.enabled ? (
                                      <div className="flex items-center gap-1.5">
                                        <Input type="time" value={cfg?.start ?? '09:00'} onChange={e => updateDateOverride(date, { start: e.target.value })} className="h-7 w-24 text-xs" />
                                        <span className="text-xs text-muted-foreground">–</span>
                                        <Input type="time" value={cfg?.end ?? '17:00'} onChange={e => updateDateOverride(date, { end: e.target.value })} className="h-7 w-24 text-xs" />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">Closed</span>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:text-destructive ml-auto" onClick={() => updateDateOverride(date, null)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Additional Projects Card */}
              {(() => {
                const WEEKDAYS_AP = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
                const WEEKDAY_LABELS_AP: Record<string, string> = {
                  monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu',
                  friday:'Fri', saturday:'Sat', sunday:'Sun',
                }

                const ap = preferences.additional_projects_hours
                const defaultSchedule: Record<string, OfficeHoursDay> = {
                  monday:    { enabled: true,  start: '09:00', end: '17:00' },
                  tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
                  wednesday: { enabled: true,  start: '09:00', end: '17:00' },
                  thursday:  { enabled: true,  start: '09:00', end: '17:00' },
                  friday:    { enabled: true,  start: '09:00', end: '17:00' },
                  saturday:  { enabled: false, start: '09:00', end: '17:00' },
                  sunday:    { enabled: false, start: '09:00', end: '17:00' },
                }

                const updateAP = (patch: Partial<typeof ap>) =>
                  setPreferences({
                    ...preferences,
                    additional_projects_hours: {
                      enabled: ap?.enabled ?? false,
                      schedule: ap?.schedule ?? defaultSchedule,
                      date_overrides: ap?.date_overrides ?? {},
                      project_id: ap?.project_id ?? null,
                      ...patch,
                    },
                  })

                const updateDay = (day: string, patch: Partial<OfficeHoursDay>) =>
                  updateAP({
                    schedule: {
                      ...(ap?.schedule ?? defaultSchedule),
                      [day]: { ...(ap?.schedule?.[day] ?? defaultSchedule[day]), ...patch },
                    },
                  })

                const addDateOverride = () => {
                  if (!newOverrideDateAdditional) return
                  updateAP({
                    date_overrides: {
                      ...(ap?.date_overrides ?? {}),
                      [newOverrideDateAdditional]: { enabled: true, start: '09:00', end: '17:00' },
                    },
                  })
                  setNewOverrideDateAdditional('')
                }

                const updateDateOverride = (date: string, patch: Partial<OfficeHoursDay> | null) => {
                  const overrides = { ...(ap?.date_overrides ?? {}) }
                  if (patch === null) { delete overrides[date] }
                  else { overrides[date] = { ...(overrides[date] ?? { enabled: true, start: '09:00', end: '17:00' }), ...patch } }
                  updateAP({ date_overrides: overrides })
                }

                return (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Additional Projects
                      </CardTitle>
                      <CardDescription>
                        Schedule a second project within its own hours window.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">

                      {/* Enable toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-medium">Enable additional project hours</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Restricts a second project's tasks to a separate time window
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={ap?.enabled ?? false}
                          onClick={() => updateAP({ enabled: !(ap?.enabled ?? false) })}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${ap?.enabled ? 'bg-primary' : 'bg-input'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${ap?.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {ap?.enabled && (
                        <>
                          <p className="text-xs text-muted-foreground -mt-2">
                            All tasks not belonging to the Office project will be scheduled within these hours.
                          </p>

                          {/* Per-day schedule */}
                          <div className="space-y-2">
                            <Label className="text-sm">Weekly schedule</Label>
                            <div className="space-y-2">
                              {WEEKDAYS_AP.map(day => {
                                const cfg = ap?.schedule?.[day] ?? defaultSchedule[day]
                                return (
                                  <div key={day} className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={cfg.enabled}
                                      onClick={() => updateDay(day, { enabled: !cfg.enabled })}
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${cfg.enabled ? 'bg-primary' : 'bg-input'}`}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${cfg.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                    <span className={`text-sm w-8 shrink-0 ${cfg.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>
                                      {WEEKDAY_LABELS_AP[day]}
                                    </span>
                                    {cfg.enabled ? (
                                      <div className="flex items-center gap-2">
                                        <Input type="time" value={cfg.start} onChange={e => updateDay(day, { start: e.target.value })} className="h-7 w-28 text-xs" />
                                        <span className="text-xs text-muted-foreground">to</span>
                                        <Input type="time" value={cfg.end} onChange={e => updateDay(day, { end: e.target.value })} className="h-7 w-28 text-xs" />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">Closed</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Single-day date overrides */}
                          <div className="space-y-2">
                            <Label className="text-sm">Single-day overrides</Label>
                            <p className="text-xs text-muted-foreground">
                              Override hours for a specific date.
                            </p>
                            <div className="flex gap-2">
                              <Input
                                type="date"
                                value={newOverrideDateAdditional}
                                onChange={e => setNewOverrideDateAdditional(e.target.value)}
                                className="h-8 w-44 text-sm"
                                onKeyDown={e => e.key === 'Enter' && addDateOverride()}
                              />
                              <Button size="sm" variant="outline" onClick={addDateOverride} disabled={!newOverrideDateAdditional} className="h-8 gap-1">
                                <Plus className="h-3 w-3" />
                                Add
                              </Button>
                            </div>
                            {Object.keys(ap?.date_overrides ?? {}).sort().length > 0 && (
                              <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border p-2">
                                {Object.entries(ap?.date_overrides ?? {}).sort().map(([date, cfg]) => (
                                  <div key={date} className="flex items-center gap-2 text-sm">
                                    <span className="text-muted-foreground w-24 shrink-0 text-xs">
                                      {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                    <button
                                      type="button"
                                      role="switch"
                                      aria-checked={cfg?.enabled ?? true}
                                      onClick={() => updateDateOverride(date, { enabled: !(cfg?.enabled ?? true) })}
                                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${cfg?.enabled ? 'bg-primary' : 'bg-input'}`}
                                    >
                                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform ${cfg?.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </button>
                                    {cfg?.enabled ? (
                                      <div className="flex items-center gap-1.5">
                                        <Input type="time" value={cfg?.start ?? '09:00'} onChange={e => updateDateOverride(date, { start: e.target.value })} className="h-7 w-24 text-xs" />
                                        <span className="text-xs text-muted-foreground">–</span>
                                        <Input type="time" value={cfg?.end ?? '17:00'} onChange={e => updateDateOverride(date, { end: e.target.value })} className="h-7 w-24 text-xs" />
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground italic">Closed</span>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 hover:text-destructive ml-auto" onClick={() => updateDateOverride(date, null)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Scheduling Settings */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Scheduling Settings</CardTitle>
                  <CardDescription>
                    Configure how tasks are scheduled
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Max Continuous Work Time (minutes)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min={30}
                        max={480}
                        step={15}
                        value={preferences.scheduling_preferences?.max_deep_work_stretch ?? 120}
                        onChange={(e) => {
                          const value = Math.max(30, Math.min(480, parseInt(e.target.value) || 120))
                          setPreferences({
                            ...preferences,
                            scheduling_preferences: {
                              ...preferences.scheduling_preferences,
                              max_deep_work_stretch: value,
                            },
                          })
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        = {Math.floor((preferences.scheduling_preferences?.max_deep_work_stretch ?? 120) / 60)}h {(preferences.scheduling_preferences?.max_deep_work_stretch ?? 120) % 60}m
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After this duration, a 15-minute break is automatically inserted. Tasks longer than this won't be scheduled.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Minimum Task Duration (minutes)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        step={5}
                        value={preferences.task_defaults?.min_duration ?? 15}
                        onChange={(e) => {
                          const value = Math.max(5, Math.min(60, parseInt(e.target.value) || 15))
                          setPreferences({
                            ...preferences,
                            task_defaults: {
                              ...preferences.task_defaults,
                              min_duration: value,
                            },
                          })
                        }}
                        className="w-24"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tasks shorter than this won't be scheduled. They'll appear in the unscheduled list.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sync Tab */}
            <TabsContent value="sync" className="space-y-4">
              {/* Connected Account */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Cloud Sync
                  </CardTitle>
                  <CardDescription>
                    Connect to sync your data across devices
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {authState?.isAuthenticated ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        {authState.user?.avatarUrl && (
                          <img
                            src={authState.user.avatarUrl}
                            alt={authState.user.displayName || 'User'}
                            className="h-10 w-10 rounded-full"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{authState.user?.displayName?.split(' ')[0] || authState.user?.email?.split('@')[0]}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            {authProvider === 'google' ? (
                              <>
                                <Mail className="h-3 w-3" />
                                {authState.user?.email}
                              </>
                            ) : (
                              <>
                                <Github className="h-3 w-3" />
                                @{authState.user?.id}
                              </>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Syncing with {authProvider === 'google' ? 'Google Drive' : 'GitHub'}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={logout}>
                          <LogOut className="h-4 w-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Sign in to sync your tasks, projects, and settings across all your devices.
                        Your data will be stored in a private repository on your GitHub account.
                      </p>

                      {/* GitHub Sign-in */}
                      {isGitHubAvailable ? (
                        <div className="space-y-2">
                          <Button onClick={loginWithGitHub} className="w-full" variant="default">
                            <Github className="h-4 w-4 mr-2" />
                            Sign in with GitHub
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Button disabled className="w-full" variant="outline">
                            <Github className="h-4 w-4 mr-2 opacity-50" />
                            GitHub Sign-in Not Configured
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">
                            GitHub OAuth is not set up for this deployment
                          </p>
                        </div>
                      )}

                      {/* Google Sign-in - Coming Soon */}
                      <div className="space-y-2 pt-2">
                        <Button disabled className="w-full" variant="outline">
                          <svg className="h-4 w-4 mr-2 opacity-50" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                          </svg>
                          Google Sign-in - Coming Soon
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                          Want to try the beta? Contact the developer for access.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sync Status */}
              {authState?.isAuthenticated && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Sync Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                      <div>
                        <div className="text-muted-foreground">Status</div>
                        <div className="font-medium capitalize">{syncStatus}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Pending Changes</div>
                        <div className="font-medium">{pendingChanges}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-muted-foreground">Last Synced</div>
                        <div className="font-medium">
                          {lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSync}
                        disabled={syncStatus === 'syncing'}
                        className="flex-1"
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        Sync
                      </Button>
                    </div>
                    {syncError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md">
                        <p className="text-sm text-red-600 dark:text-red-400">{syncError}</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleForcePush}
                        disabled={syncStatus === 'syncing'}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Force Push
                      </Button>
                      <Button
                        onClick={handleForcePull}
                        disabled={syncStatus === 'syncing'}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        Force Pull
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Force Push overwrites remote data with local. Force Pull overwrites local data with remote.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Data Tab (Export/Import) */}
            <TabsContent value="data" className="space-y-4">
              {/* Summary */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Your Data</CardTitle>
                  <CardDescription>Data stored locally in your browser</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 p-3 bg-muted/50 rounded-lg text-sm">
                    <div className="text-center">
                      <div className="text-lg font-bold">{projects.length}</div>
                      <div className="text-muted-foreground">Projects</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{taskCount}</div>
                      <div className="text-muted-foreground">Tasks</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{habitCount}</div>
                      <div className="text-muted-foreground">Habits</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold">{lists.length}</div>
                      <div className="text-muted-foreground">Lists</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Export */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Export Data
                  </CardTitle>
                  <CardDescription>
                    Download all your data as a JSON file for backup
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleExport} disabled={exporting} className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    {exporting ? 'Exporting...' : 'Download JSON Export'}
                  </Button>
                </CardContent>
              </Card>

              {/* Import */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Import Data
                  </CardTitle>
                  <CardDescription>
                    Import data from a JSON export file. This also supports exports from older versions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".json"
                    className="hidden"
                  />
                  <Button
                    onClick={handleImportClick}
                    disabled={importing}
                    variant="outline"
                    className="w-full"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {importing ? 'Importing...' : 'Select JSON File to Import'}
                  </Button>
                  {importError && (
                    <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                      Error: {importError}
                    </div>
                  )}
                  {importSuccess && (
                    <div className="text-sm text-green-600 bg-green-100 dark:bg-green-900/20 p-2 rounded">
                      Data imported successfully!
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Clear Data */}
              <Card className="border-destructive/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Clear All Data
                  </CardTitle>
                  <CardDescription>
                    Permanently delete all local data. This cannot be undone.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!showClearConfirm ? (
                    <Button
                      onClick={() => setShowClearConfirm(true)}
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Data
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                        <p>
                          Are you sure? This will delete all {taskCount + habitCount} tasks, {projects.length} projects,
                          and {lists.length} lists. This action cannot be undone.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleClearAll}
                          disabled={clearing}
                          variant="destructive"
                          className="flex-1"
                        >
                          {clearing ? 'Clearing...' : 'Yes, Delete Everything'}
                        </Button>
                        <Button
                          onClick={() => setShowClearConfirm(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Cycle Tab */}
            <TabsContent value="cycle" className="space-y-4">
              {(() => {
                const history = preferences.cycle?.period_history ?? []
                const sortedHistory = [...history].sort().reverse() // most recent first for display
                const computedAvg = computeAverageCycleLength(history)
                const today = new Date().toISOString().split('T')[0]

                const updateCycle = (patch: Partial<{
                  enabled: boolean
                  period_history: string[]
                  average_cycle_length: number
                  phase_override: CycleSeason | null
                }>) =>
                  setPreferences({
                    ...preferences,
                    cycle: {
                      enabled: preferences.cycle?.enabled ?? false,
                      period_history: history,
                      average_cycle_length: preferences.cycle?.average_cycle_length ?? 28,
                      phase_override: preferences.cycle?.phase_override ?? null,
                      ...patch,
                    },
                  })

                const addPeriodDate = () => {
                  if (!newPeriodDate) return
                  if (history.includes(newPeriodDate)) return
                  updateCycle({ period_history: [...history, newPeriodDate].sort() })
                  setNewPeriodDate('')
                }

                const removePeriodDate = (date: string) =>
                  updateCycle({ period_history: history.filter(d => d !== date) })

                const phase = getCyclePhaseFromPrefs(preferences)
                const phaseColors: Record<string, string> = {
                  winter: 'text-blue-400',
                  spring: 'text-green-400',
                  summer: 'text-yellow-400',
                  autumn: 'text-orange-400',
                }

                return (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          Cycle-Aware Scheduling
                        </CardTitle>
                        <CardDescription>
                          Align your tasks with your menstrual cycle phases to work with your natural energy rhythms.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">

                        {/* Enable toggle */}
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="text-sm font-medium">Enable cycle tracking</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Shows a phase widget in your daily sidebar
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={preferences.cycle?.enabled ?? false}
                            onClick={() => updateCycle({ enabled: !(preferences.cycle?.enabled ?? false) })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              preferences.cycle?.enabled ? 'bg-primary' : 'bg-input'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                                preferences.cycle?.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>

                        {preferences.cycle?.enabled && (
                          <>
                            {/* Period history */}
                            <div className="space-y-2">
                              <div>
                                <Label className="text-sm">Period start dates</Label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Each date you add improves the accuracy of your cycle average. Only stored locally.
                                </p>
                              </div>

                              {/* Add date row */}
                              <div className="flex gap-2">
                                <Input
                                  type="date"
                                  value={newPeriodDate}
                                  onChange={e => setNewPeriodDate(e.target.value)}
                                  max={today}
                                  className="w-44 h-8 text-sm"
                                  onKeyDown={e => e.key === 'Enter' && addPeriodDate()}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={addPeriodDate}
                                  disabled={!newPeriodDate || history.includes(newPeriodDate)}
                                  className="h-8 gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add
                                </Button>
                              </div>

                              {/* History list */}
                              {sortedHistory.length > 0 && (
                                <div className="space-y-1 max-h-36 overflow-y-auto rounded-md border p-2">
                                  {sortedHistory.map((date, i) => (
                                    <div key={date} className="flex items-center justify-between text-sm py-0.5">
                                      <span className="text-muted-foreground">
                                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                                          month: 'short', day: 'numeric', year: 'numeric'
                                        })}
                                        {i === 0 && (
                                          <span className="ml-2 text-xs text-primary font-medium">most recent</span>
                                        )}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 w-5 p-0 hover:text-destructive"
                                        onClick={() => removePeriodDate(date)}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {history.length === 0 && (
                                <p className="text-xs text-muted-foreground italic">
                                  No dates added yet. Add at least one to enable phase detection.
                                </p>
                              )}
                            </div>

                            {/* Average cycle length */}
                            <div className="space-y-1.5">
                              <Label className="text-sm">Average cycle length</Label>
                              {computedAvg !== null ? (
                                <div className="flex items-center gap-2">
                                  <div className="rounded-md border px-3 py-1.5 text-sm font-medium bg-muted/40 w-24 text-center">
                                    {computedAvg} days
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Computed from {history.length} period{history.length !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id="cycle-length"
                                      type="number"
                                      min={21}
                                      max={60}
                                      value={preferences.cycle?.average_cycle_length ?? 28}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10)
                                        if (!isNaN(val) && val >= 21 && val <= 60) {
                                          updateCycle({ average_cycle_length: val })
                                        }
                                      }}
                                      className="w-24 h-8"
                                    />
                                    <span className="text-sm text-muted-foreground">days</span>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Enter manually until you have 2+ logged dates (then it auto-computes).
                                  </p>
                                </>
                              )}
                            </div>

                            {/* Phase override */}
                            <div className="space-y-1.5">
                              <Label className="text-sm">Current phase</Label>
                              <Select
                                value={preferences.cycle?.phase_override ?? 'auto'}
                                onValueChange={(val) =>
                                  updateCycle({ phase_override: val === 'auto' ? null : val as CycleSeason })
                                }
                              >
                                <SelectTrigger className="w-56 h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="auto">Auto-detect from dates</SelectItem>
                                  <SelectItem value="winter">❄️ Winter — Menstruation</SelectItem>
                                  <SelectItem value="spring">🌱 Spring — Follicular</SelectItem>
                                  <SelectItem value="summer">☀️ Summer — Ovulation</SelectItem>
                                  <SelectItem value="autumn">🍂 Autumn — Luteal</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground">
                                Override if you know your current phase or your cycle arrived early/late.
                              </p>
                            </div>

                            {/* Current phase preview */}
                            {phase && (
                              <div className="rounded-lg border p-3 bg-muted/30 space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Current phase
                                  {phase.isOverride && (
                                    <span className="ml-2 text-primary">· manual override</span>
                                  )}
                                </p>
                                <p className={`text-sm font-semibold ${phaseColors[phase.season]}`}>
                                  {phase.emoji} {phase.name}: {phase.phase}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {phase.isOverride
                                    ? phase.invitation
                                    : `Day ${phase.cycleDay} · ${phase.energyLevel} energy · ${phase.invitation}`}
                                </p>
                                {computedAvg !== null && !phase.isOverride && (
                                  <p className="text-xs text-muted-foreground">
                                    Based on {computedAvg}-day average computed from your history
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>

                    {/* Phase overview */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">The four phases</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {[
                          { emoji: '❄️', name: 'Winter (Days 1–5)', phase: 'Menstruation', energy: 'Low energy', color: 'text-blue-400', tip: 'Rest, reflect, journal, solo deep work' },
                          { emoji: '🌱', name: 'Spring (Days 6–13)', phase: 'Follicular', energy: 'Rising energy', color: 'text-green-400', tip: 'New projects, deep learning, creative work' },
                          { emoji: '☀️', name: 'Summer (Days 14–16)', phase: 'Ovulation', energy: 'Peak energy', color: 'text-yellow-400', tip: 'Presentations, negotiations, networking' },
                          { emoji: '🍂', name: 'Autumn (Days 17–28)', phase: 'Luteal', energy: 'Waning energy', color: 'text-orange-400', tip: 'Complete projects, admin tasks, editing' },
                        ].map((p) => (
                          <div key={p.phase} className="flex items-start gap-3">
                            <span className="text-lg">{p.emoji}</span>
                            <div>
                              <p className={`text-xs font-medium ${p.color}`}>{p.name} — {p.energy}</p>
                              <p className="text-xs text-muted-foreground">{p.tip}</p>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </>
                )
              })()}
            </TabsContent>

            {/* Help Tab */}
            <TabsContent value="help" className="space-y-4">
              {/* Documentation */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Documentation
                  </CardTitle>
                  <CardDescription>
                    Learn how to use TrackMind effectively
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Documentation />
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Restart Wizard */}
                  {onRestartWizard && (
                    <Button
                      onClick={() => {
                        setOpen(false)
                        onRestartWizard()
                      }}
                      variant="outline"
                      className="w-full justify-start"
                    >
                      <Rocket className="h-4 w-4 mr-2" />
                      Restart Setup Wizard
                    </Button>
                  )}

                  {/* Toggle Help Mode */}
                  <Button
                    onClick={() => {
                      setOpen(false)
                      toggleHelpMode()
                    }}
                    variant="outline"
                    className="w-full justify-start"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {isHelpModeActive ? 'Exit Help Mode' : 'Enter Help Mode'}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Help Mode highlights UI elements with explanations. You can also toggle it with{' '}
                    <kbd className="px-1 bg-muted rounded text-xs">Shift + ?</kbd> or the{' '}
                    <Eye className="inline h-3 w-3" /> button in the bottom-right corner.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </Tabs>
        ) : (
          <div className="py-8 text-center text-muted-foreground">Loading settings...</div>
        )}
      </DialogContent>
    </Dialog>
  )
}
