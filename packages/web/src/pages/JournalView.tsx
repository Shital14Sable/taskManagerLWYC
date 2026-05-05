import { useState, useMemo } from 'react'
import {
  BookOpen,
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
  Smile,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
  Save,
  X,
  Download,
  FileText,
  FolderOpen,
  FolderPlus,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useJournal } from '@/hooks/useJournal'
import { FolderSelector } from '@/components/FolderSelector'
import type { FolderItem } from '@/components/FolderSelector'
import type { JournalEntry, MoodLevel, TimeOfDay, JournalEntryType, JournalFolder } from '@trackmind/core'
import { MOOD_CONFIG, DEFAULT_PROMPTS, getCurrentTimeOfDay } from '@trackmind/core'

// Convert JournalFolder to FolderItem for the selector
function convertToFolderItems(folders: JournalFolder[]): FolderItem[] {
  return folders.map(f => ({
    name: f.name,
    path: f.path,
    count: f.entry_count,
    subfolders: convertToFolderItems(f.subfolders),
  }))
}

interface JournalViewProps {
  onBack?: () => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function JournalView({ onBack }: JournalViewProps) {
  const {
    entries,
    entriesByDate,
    moodStats,
    topicEntries,
    topicFolders,
    createEntry,
    updateEntry,
    deleteEntry,
    setMood,
    getTodayEntry,
    importCompletedItems,
    searchTopics,
    getTopicsByFolder,
    createFolder,
  } = useJournal()

  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editFolderPath, setEditFolderPath] = useState('')
  const [editPrompts, setEditPrompts] = useState<Record<string, string>>({})
  const [showMoodPicker, setShowMoodPicker] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'entries' | 'stats'>('calendar')
  const [showNewEntryDialog, setShowNewEntryDialog] = useState(false)
  const [newEntryTitle, setNewEntryTitle] = useState('')
  const [newEntryFolder, setNewEntryFolder] = useState('')
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParent, setNewFolderParent] = useState('')

  // Convert folders for the selector component
  const folderItems = useMemo(() => convertToFolderItems(topicFolders), [topicFolders])

  // Entries organization state
  const [selectedEntriesFolder, setSelectedEntriesFolder] = useState<string | null>(null)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [entriesSearchQuery, setEntriesSearchQuery] = useState('')
  const [entriesSearchResults, setEntriesSearchResults] = useState<JournalEntry[] | null>(null)

  // Filter entries by type
  const dailyEntries = useMemo(() => entries.filter(e => (e.entry_type ?? 'daily') === 'daily'), [entries])

  // Get displayed entries based on folder selection
  const displayedEntries = useMemo(() => {
    if (entriesSearchResults) return entriesSearchResults
    if (selectedEntriesFolder) return getTopicsByFolder(selectedEntriesFolder)
    return topicEntries
  }, [entriesSearchResults, selectedEntriesFolder, topicEntries, getTopicsByFolder])

  // Calendar helpers
  const calendarMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()
    const days: (Date | null)[] = []

    for (let i = 0; i < startPadding; i++) {
      days.push(null)
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }, [currentDate])

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const formatDateKey = (date: Date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const initEditPrompts = (entry: JournalEntry) => {
    const promptResponses: Record<string, string> = {}
    entry.prompts.forEach(p => {
      promptResponses[p.id] = p.response || ''
    })
    setEditPrompts(promptResponses)
  }

  const handleCreateToday = async () => {
    const entry = await getTodayEntry()
    setSelectedEntry(entry)
    setEditMode(true)
    setEditTitle(entry.title)
    setEditContent(entry.content)
    setEditFolderPath(entry.folder_path || '')
    initEditPrompts(entry)
  }

  const handleCreateForDate = async (date: Date) => {
    const dateStr = formatDateKey(date)
    const existing = dailyEntries.find(e => e.date === dateStr)
    if (existing) {
      setSelectedEntry(existing)
      return
    }
    const entry = await createEntry({ date: dateStr, entry_type: 'daily' })
    setSelectedEntry(entry)
    setEditMode(true)
    setEditTitle(entry.title)
    setEditContent(entry.content)
    setEditFolderPath('')
    initEditPrompts(entry)
  }

  const handleCreateJournalEntry = async () => {
    if (!newEntryTitle.trim()) return
    const entry = await createEntry({
      entry_type: 'topic',
      title: newEntryTitle.trim(),
      folder_path: newEntryFolder.trim() || undefined,
    })
    setSelectedEntry(entry)
    setEditMode(true)
    setEditTitle(entry.title)
    setEditContent(entry.content)
    setEditFolderPath(entry.folder_path || '')
    setNewEntryTitle('')
    setNewEntryFolder('')
    setShowNewEntryDialog(false)
  }

  const handleEntriesSearch = () => {
    if (!entriesSearchQuery.trim()) {
      setEntriesSearchResults(null)
      return
    }
    const results = searchTopics(entriesSearchQuery)
    setEntriesSearchResults(results)
  }

  const clearEntriesSearch = () => {
    setEntriesSearchQuery('')
    setEntriesSearchResults(null)
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const renderFolder = (folder: JournalFolder, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.path)
    const isSelected = selectedEntriesFolder === folder.path

    return (
      <div key={folder.path}>
        <button
          onClick={() => {
            toggleFolder(folder.path)
            setSelectedEntriesFolder(folder.path)
            setSelectedEntry(null)
            clearEntriesSearch()
          }}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left",
            isSelected && "bg-accent",
            depth > 0 && "ml-4"
          )}
        >
          {folder.subfolders.length > 0 ? (
            isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
          <FolderOpen className="h-4 w-4 text-amber-500" />
          <span className="flex-1 truncate">{folder.name}</span>
          <span className="text-xs text-muted-foreground">{folder.entry_count}</span>
        </button>
        {isExpanded && folder.subfolders.map((sub) => renderFolder(sub, depth + 1))}
      </div>
    )
  }

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry)
    setEditMode(false)
  }

  const handleSave = async () => {
    if (!selectedEntry) return
    // Update prompts with responses
    const updatedPrompts = selectedEntry.prompts.map(p => ({
      ...p,
      response: editPrompts[p.id] || p.response || '',
    }))
    const newFolderPath = editFolderPath.trim() || ''
    await updateEntry(selectedEntry.id, {
      title: editTitle,
      content: editContent,
      prompts: updatedPrompts,
      folder_path: newFolderPath,
    })
    setSelectedEntry({ ...selectedEntry, title: editTitle, content: editContent, prompts: updatedPrompts, folder_path: newFolderPath })
    setEditMode(false)
  }

  const handleDelete = async () => {
    if (!selectedEntry || !confirm('Delete this journal entry?')) return
    await deleteEntry(selectedEntry.id)
    setSelectedEntry(null)
  }

  const handleSetMood = async (level: MoodLevel) => {
    if (!selectedEntry) return
    const updated = await setMood(selectedEntry.id, level)
    setSelectedEntry(updated)
    setShowMoodPicker(false)
  }

  const handleImportCompleted = async () => {
    if (!selectedEntry) return
    const updated = await importCompletedItems(selectedEntry.id)
    setSelectedEntry(updated)
  }

  const getTimeOfDayLabel = (tod: TimeOfDay) => {
    const labels: Record<TimeOfDay, string> = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      night: 'Night',
    }
    return labels[tod]
  }

  const getMoodEmoji = (entry: JournalEntry) => {
    if (!entry.mood) return null
    return MOOD_CONFIG[entry.mood.level].emoji
  }

  const getEntriesForDate = (date: Date) => {
    const dateKey = formatDateKey(date)
    return entriesByDate.get(dateKey) || []
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
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
              <BookOpen className="h-6 w-6" />
              Journal
            </h2>
            <p className="text-sm text-muted-foreground">
              {entries.length} entries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleCreateToday}>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)}>
        <TabsList>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Clock className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="entries" className="gap-2">
            <FileText className="h-4 w-4" />
            Entries
            {topicEntries.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">{topicEntries.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Stats
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Calendar */}
            <div className="lg:col-span-7">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={prevMonth}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-lg">
                      {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={nextMonth}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {WEEKDAYS.map(day => (
                      <div key={day} className="text-center text-xs text-muted-foreground font-medium py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarMonth.map((date, i) => {
                      if (!date) {
                        return <div key={`empty-${i}`} className="h-12" />
                      }
                      const dayEntries = getEntriesForDate(date)
                      const hasMood = dayEntries.some(e => e.mood)
                      const avgMood = dayEntries.reduce((sum, e) => sum + (e.mood?.level || 0), 0) / (dayEntries.filter(e => e.mood).length || 1)
                      const isToday = formatDateKey(date) === formatDateKey(new Date())

                      return (
                        <button
                          key={date.toISOString()}
                          onClick={() => dayEntries.length > 0 ? handleSelectEntry(dayEntries[0]) : handleCreateForDate(date)}
                          className={cn(
                            "h-12 rounded-lg flex flex-col items-center justify-center text-sm transition-all hover:bg-accent relative",
                            dayEntries.length > 0 && "bg-primary/10",
                            isToday && "ring-2 ring-primary",
                            selectedEntry && formatDateKey(new Date(selectedEntry.date)) === formatDateKey(date) && "bg-primary/20"
                          )}
                        >
                          <span className={cn(isToday && "font-bold")}>{date.getDate()}</span>
                          {hasMood && (
                            <span className="text-xs" style={{ color: MOOD_CONFIG[Math.round(avgMood) as MoodLevel]?.color }}>
                              {MOOD_CONFIG[Math.round(avgMood) as MoodLevel]?.emoji}
                            </span>
                          )}
                          {dayEntries.length > 1 && (
                            <span className="absolute top-1 right-1 text-[10px] text-muted-foreground">
                              +{dayEntries.length - 1}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Entry Detail/Preview */}
            <div className="lg:col-span-5">
              {selectedEntry ? (
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      {editMode ? (
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-lg font-semibold bg-transparent border-b focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <CardTitle className="text-lg">{selectedEntry.title}</CardTitle>
                      )}
                      <div className="flex items-center gap-1">
                        {editMode ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                              <Save className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditMode(true)
                              setEditTitle(selectedEntry.title)
                              setEditContent(selectedEntry.content)
                              setEditFolderPath(selectedEntry.folder_path || '')
                              initEditPrompts(selectedEntry)
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleDelete}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(selectedEntry.date)}</span>
                      <Badge variant="outline">{getTimeOfDayLabel(selectedEntry.timeOfDay)}</Badge>
                    </div>
                    {/* Mood */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowMoodPicker(true)}
                        className="gap-2"
                      >
                        {selectedEntry.mood ? (
                          <>
                            <span>{selectedEntry.mood.emoji}</span>
                            <span>{selectedEntry.mood.label}</span>
                          </>
                        ) : (
                          <>
                            <Smile className="h-4 w-4" />
                            Set Mood
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleImportCompleted}
                        className="gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Import Completed
                      </Button>
                    </div>
                    {/* Completed items count */}
                    {(selectedEntry.completedTaskIds.length > 0 || selectedEntry.completedHabitIds.length > 0) && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{selectedEntry.completedTaskIds.length} tasks</span>
                        <span>{selectedEntry.completedHabitIds.length} habits completed</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* Prompts - visible as inspiration */}
                    {selectedEntry.prompts.length > 0 && (
                      <div className="space-y-2 mb-4 p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompts to consider</p>
                        {selectedEntry.prompts.map((prompt, i) => (
                          <p key={prompt.id || i} className="text-sm text-muted-foreground">• {prompt.text}</p>
                        ))}
                      </div>
                    )}
                    {/* Content */}
                    {editMode ? (
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Write your thoughts..."
                        className="min-h-[200px]"
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {selectedEntry.content || (
                          <span className="text-muted-foreground italic">No content yet. Click edit to write.</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <p className="text-muted-foreground mb-4">Select a date to view or create an entry</p>
                    <Button onClick={handleCreateToday}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Today's Entry
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Timeline View */}
        <TabsContent value="timeline" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Timeline List */}
            <div className="lg:col-span-7">
              <Card>
                <CardContent className="pt-6">
                  {entries.length === 0 ? (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                      <p className="text-muted-foreground mb-4">No journal entries yet</p>
                      <Button onClick={handleCreateToday}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Entry
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[600px] overflow-y-auto">
                      {entries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => handleSelectEntry(entry)}
                          className={cn(
                            "w-full text-left p-4 rounded-lg border hover:bg-accent transition-all",
                            selectedEntry?.id === entry.id && "border-primary bg-accent"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                {entry.mood && (
                                  <span className="text-lg">{entry.mood.emoji}</span>
                                )}
                                <h4 className="font-medium">{entry.title}</h4>
                                <Badge variant="outline" className="text-xs">
                                  {getTimeOfDayLabel(entry.timeOfDay)}
                                </Badge>
                                {entry.entry_type === 'topic' && (
                                  <Badge variant="secondary" className="text-xs">Topic</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {formatDate(entry.date)}
                              </p>
                              {entry.content && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                  {entry.content.substring(0, 150)}{entry.content.length > 150 && '...'}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Entry Detail/Preview */}
            <div className="lg:col-span-5">
              {selectedEntry ? (
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      {editMode ? (
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-lg font-semibold bg-transparent border-b focus:outline-none focus:border-primary"
                        />
                      ) : (
                        <CardTitle className="text-lg">{selectedEntry.title}</CardTitle>
                      )}
                      <div className="flex items-center gap-1">
                        {editMode ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                              <Save className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditMode(true)
                              setEditTitle(selectedEntry.title)
                              setEditContent(selectedEntry.content)
                              setEditFolderPath(selectedEntry.folder_path || '')
                              initEditPrompts(selectedEntry)
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleDelete}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(selectedEntry.date)}</span>
                      <Badge variant="outline">{getTimeOfDayLabel(selectedEntry.timeOfDay)}</Badge>
                      {selectedEntry.entry_type === 'topic' && (
                        <Badge variant="secondary">Topic</Badge>
                      )}
                    </div>
                    {/* Mood */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowMoodPicker(true)}
                        className="gap-2"
                      >
                        {selectedEntry.mood ? (
                          <>
                            <span>{selectedEntry.mood.emoji}</span>
                            <span>{selectedEntry.mood.label}</span>
                          </>
                        ) : (
                          <>
                            <Smile className="h-4 w-4" />
                            Set Mood
                          </>
                        )}
                      </Button>
                      {selectedEntry.entry_type === 'daily' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleImportCompleted}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Import Completed
                        </Button>
                      )}
                    </div>
                    {/* Completed items count */}
                    {(selectedEntry.completedTaskIds.length > 0 || selectedEntry.completedHabitIds.length > 0) && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <span>{selectedEntry.completedTaskIds.length} tasks</span>
                        <span>{selectedEntry.completedHabitIds.length} habits completed</span>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {/* Prompts - visible as inspiration for daily entries */}
                    {selectedEntry.prompts.length > 0 && (
                      <div className="space-y-2 mb-4 p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prompts to consider</p>
                        {selectedEntry.prompts.map((prompt, i) => (
                          <p key={prompt.id || i} className="text-sm text-muted-foreground">• {prompt.text}</p>
                        ))}
                      </div>
                    )}
                    {/* Content */}
                    {editMode ? (
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Write your thoughts..."
                        className="min-h-[200px]"
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {selectedEntry.content || (
                          <span className="text-muted-foreground italic">No content yet. Click edit to write.</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center py-8">
                    <BookOpen className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <p className="text-muted-foreground mb-4">Select an entry to view or edit</p>
                    <Button onClick={handleCreateToday}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Today's Entry
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Entries View */}
        <TabsContent value="entries" className="mt-4">
          {/* Search Bar and Actions */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={entriesSearchQuery}
                onChange={(e) => setEntriesSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEntriesSearch()}
                className="pl-9"
              />
            </div>
            <Button variant="secondary" onClick={handleEntriesSearch}>
              Search
            </Button>
            {entriesSearchResults && (
              <Button variant="ghost" onClick={clearEntriesSearch}>
                Clear
              </Button>
            )}
            <Button size="sm" onClick={() => setShowNewEntryDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Folders Sidebar */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-amber-500" />
                      Folders
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="h-7 w-7 p-0 hover:bg-accent"
                      onClick={(e) => {
                        e.stopPropagation()
                        setNewFolderParent('')
                        setNewFolderName('')
                        setShowNewFolderDialog(true)
                      }}
                      title="New folder"
                    >
                      <FolderPlus className="h-4 w-4 text-amber-500" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <button
                    onClick={() => {
                      setSelectedEntriesFolder(null)
                      setSelectedEntry(null)
                      clearEntriesSearch()
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left",
                      selectedEntriesFolder === null && !entriesSearchResults && "bg-accent"
                    )}
                  >
                    <span className="w-3" />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">All Entries</span>
                    <span className="text-xs text-muted-foreground">{topicEntries.length}</span>
                  </button>
                  {topicFolders.map((folder) => renderFolder(folder))}
                </CardContent>
              </Card>
            </div>

            {/* Entries List */}
            <div className="lg:col-span-5">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">
                    {entriesSearchResults
                      ? `Search Results (${entriesSearchResults.length})`
                      : selectedEntriesFolder
                        ? `Entries in ${selectedEntriesFolder}`
                        : 'All Entries'
                    } ({displayedEntries.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {displayedEntries.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {entriesSearchResults ? 'No entries found' : 'No journal entries yet'}
                      </p>
                      {!entriesSearchResults && (
                        <Button onClick={() => setShowNewEntryDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Entry
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {displayedEntries.map((entry) => (
                        <button
                          key={entry.id}
                          onClick={() => handleSelectEntry(entry)}
                          className={cn(
                            "w-full text-left p-4 rounded-lg border hover:bg-accent transition-all",
                            selectedEntry?.id === entry.id && "border-primary bg-accent"
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <h4 className="font-medium truncate">{entry.title}</h4>
                                {entry.mood && (
                                  <span className="text-lg">{entry.mood.emoji}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {entry.folder_path && (
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <FolderOpen className="h-3 w-3" />
                                    {entry.folder_path}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {new Date(entry.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                              {entry.content && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                  {entry.content.substring(0, 120)}{entry.content.length > 120 && '...'}
                                </p>
                              )}
                              {entry.tags.length > 0 && (
                                <div className="flex gap-1 mt-2 flex-wrap">
                                  {entry.tags.slice(0, 3).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                  ))}
                                  {entry.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">+{entry.tags.length - 3}</Badge>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Entry Detail/Preview */}
            <div className="lg:col-span-4">
              {selectedEntry && selectedEntry.entry_type === 'topic' ? (
                <Card className="h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      {editMode ? (
                        <input
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="text-lg font-semibold bg-transparent border-b focus:outline-none focus:border-primary flex-1"
                        />
                      ) : (
                        <CardTitle className="text-lg">{selectedEntry.title}</CardTitle>
                      )}
                      <div className="flex items-center gap-1">
                        {editMode ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button size="sm" onClick={handleSave}>
                              <Save className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditMode(true)
                              setEditTitle(selectedEntry.title)
                              setEditContent(selectedEntry.content)
                              setEditFolderPath(selectedEntry.folder_path || '')
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleDelete}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {editMode ? (
                        <div className="w-full">
                          <FolderSelector
                            folders={folderItems}
                            value={editFolderPath}
                            onChange={setEditFolderPath}
                            placeholder="Select folder..."
                            className="w-full h-8 text-xs"
                          />
                        </div>
                      ) : (
                        <>
                          {selectedEntry.folder_path && (
                            <span className="flex items-center gap-1">
                              <FolderOpen className="h-3 w-3" />
                              {selectedEntry.folder_path}
                            </span>
                          )}
                          <span>Created {new Date(selectedEntry.created_at).toLocaleDateString()}</span>
                          {selectedEntry.updated_at !== selectedEntry.created_at && (
                            <span>• Updated {new Date(selectedEntry.updated_at).toLocaleDateString()}</span>
                          )}
                        </>
                      )}
                    </div>
                    {/* Mood */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowMoodPicker(true)}
                        className="gap-2"
                      >
                        {selectedEntry.mood ? (
                          <>
                            <span>{selectedEntry.mood.emoji}</span>
                            <span>{selectedEntry.mood.label}</span>
                          </>
                        ) : (
                          <>
                            <Smile className="h-4 w-4" />
                            Set Mood
                          </>
                        )}
                      </Button>
                    </div>
                    {/* Tags */}
                    {selectedEntry.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedEntry.tags.map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {editMode ? (
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Write your thoughts, reflections, ideas..."
                        className="min-h-[300px]"
                      />
                    ) : (
                      <div className="text-sm whitespace-pre-wrap">
                        {selectedEntry.content || (
                          <span className="text-muted-foreground italic">No content yet. Click edit to write.</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-full flex items-center justify-center">
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <p className="text-muted-foreground mb-4">Select an entry to view or edit</p>
                    <Button onClick={() => setShowNewEntryDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Entry
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Stats View */}
        <TabsContent value="stats" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Mood Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smile className="h-4 w-4" />
                  Mood Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {moodStats ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Average Mood</span>
                      <span className="text-2xl">
                        {MOOD_CONFIG[Math.round(moodStats.averageMood) as MoodLevel]?.emoji || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Trend</span>
                      <Badge variant={
                        moodStats.moodTrend === 'improving' ? 'default' :
                        moodStats.moodTrend === 'declining' ? 'destructive' : 'secondary'
                      }>
                        {moodStats.moodTrend}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Entries with Mood</span>
                      <span className="font-medium">{moodStats.entriesWithMood} / {moodStats.totalEntries}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No mood data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Mood Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Mood Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {moodStats ? (
                  <div className="space-y-2">
                    {([5, 4, 3, 2, 1] as MoodLevel[]).map((level) => (
                      <div key={level} className="flex items-center gap-2">
                        <span>{MOOD_CONFIG[level].emoji}</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(moodStats.moodCounts[level] / moodStats.entriesWithMood) * 100}%`,
                              backgroundColor: MOOD_CONFIG[level].color,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-6">
                          {moodStats.moodCounts[level]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </CardContent>
            </Card>

            {/* Best Time of Day */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Best Time of Day</CardTitle>
              </CardHeader>
              <CardContent>
                {moodStats ? (
                  <div className="space-y-2">
                    {(['morning', 'afternoon', 'evening', 'night'] as TimeOfDay[]).map((time) => {
                      const stats = moodStats.byTimeOfDay[time]
                      return (
                        <div key={time} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{time}</span>
                          <div className="flex items-center gap-2">
                            {stats.count > 0 ? (
                              <>
                                <span>{MOOD_CONFIG[Math.round(stats.average) as MoodLevel]?.emoji}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({stats.count})
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No data</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Mood Picker Dialog */}
      <Dialog open={showMoodPicker} onOpenChange={setShowMoodPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How are you feeling?</DialogTitle>
            <DialogDescription className="sr-only">
              Select your current mood level
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-4 py-6">
            {([1, 2, 3, 4, 5] as MoodLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => handleSetMood(level)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-accent transition-all"
              >
                <span className="text-4xl">{MOOD_CONFIG[level].emoji}</span>
                <span className="text-sm">{MOOD_CONFIG[level].label}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoodPicker(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Entry Dialog */}
      <Dialog open={showNewEntryDialog} onOpenChange={setShowNewEntryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Journal Entry</DialogTitle>
            <DialogDescription>
              Create a journal entry that isn't tied to a specific date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                placeholder="Enter title (e.g., 'Thoughts on AI', 'Book Review')"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newEntryTitle.trim()) {
                    handleCreateJournalEntry()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Folder (optional)</Label>
              <FolderSelector
                folders={folderItems}
                value={newEntryFolder}
                onChange={setNewEntryFolder}
                placeholder="Select or create folder..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNewEntryDialog(false)
              setNewEntryTitle('')
              setNewEntryFolder('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateJournalEntry} disabled={!newEntryTitle.trim()}>
              Create Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new folder or subfolder for organizing journal entries
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Parent Folder (optional)</Label>
              <FolderSelector
                folders={folderItems}
                value={newFolderParent}
                onChange={setNewFolderParent}
                placeholder="Root level (no parent)"
                allowCreate={false}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to create at root level, or select a parent for a subfolder
              </p>
            </div>
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!newFolderName.trim()) return
                const folderPath = newFolderParent
                  ? `${newFolderParent}/${newFolderName.trim()}`
                  : newFolderName.trim()
                // Create folder without creating an entry
                createFolder(folderPath)
                setShowNewFolderDialog(false)
                setNewFolderName('')
                setNewFolderParent('')
              }}
              disabled={!newFolderName.trim()}
            >
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
