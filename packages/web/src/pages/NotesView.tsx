import { useState, useMemo } from 'react'
import { FileText, FolderOpen, FolderPlus, Plus, Search, Calendar, ChevronRight, ChevronDown, ArrowLeft, Link, Edit, Trash2, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useNotes } from '@/hooks/useNotes'
import { FolderSelector } from '@/components/FolderSelector'
import type { FolderItem } from '@/components/FolderSelector'
import type { Note, NoteFolder, CreateNoteInput } from '@/types'
import { cn } from '@/lib/utils'

// Convert NoteFolder to FolderItem for the selector
function convertToFolderItems(folders: NoteFolder[]): FolderItem[] {
  return folders.map(f => ({
    name: f.name,
    path: f.path,
    count: f.note_count,
    subfolders: convertToFolderItems(f.subfolders),
  }))
}

interface NotesViewProps {
  onBack?: () => void
}

export function NotesView({ onBack }: NotesViewProps) {
  const { notes, folders, dailyNotes, regularNotes, loading, createNote, updateNote, deleteNote, getDaily, searchNotes, createFolder, refetch } = useNotes()
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editFolderPath, setEditFolderPath] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Note[] | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')
  const [newNoteFolder, setNewNoteFolder] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParent, setNewFolderParent] = useState('')

  // Convert folders for the selector component
  const folderItems = useMemo(() => convertToFolderItems(folders), [folders])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    const results = await searchNotes(searchQuery)
    setSearchResults(results)
  }

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) return
    const data: CreateNoteInput = {
      title: newNoteTitle,
      folder_path: newNoteFolder || undefined,
      content: '',
    }
    const note = await createNote(data)
    setShowCreateDialog(false)
    setNewNoteTitle('')
    setNewNoteFolder('')
    setSelectedNote(note)
    setEditMode(true)
    setEditTitle(note.title)
    setEditContent(note.content)
  }

  const handleGetDaily = async () => {
    const dailyNote = await getDaily()
    setSelectedNote(dailyNote)
    setEditMode(false)
  }

  const handleSelectNote = (note: Note) => {
    setSelectedNote(note)
    setEditMode(false)
    setSearchResults(null)
    setSearchQuery('')
  }

  const handleStartEdit = () => {
    if (!selectedNote) return
    setEditMode(true)
    setEditTitle(selectedNote.title)
    setEditContent(selectedNote.content)
    setEditFolderPath(selectedNote.folder_path || '')
  }

  const handleSaveNote = async () => {
    if (!selectedNote) return
    await updateNote(selectedNote.id, {
      title: editTitle,
      content: editContent,
      folder_path: editFolderPath.trim() || undefined,
    })
    setEditMode(false)
    refetch()
  }

  const handleDeleteNote = async (note: Note) => {
    if (!confirm(`Delete note "${note.title}"?`)) return
    await deleteNote(note.id)
    if (selectedNote?.id === note.id) {
      setSelectedNote(null)
    }
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

  const filterNotesByFolder = (folderPath: string | null) => {
    if (!folderPath) return regularNotes
    return regularNotes.filter((n) => n.folder_path === folderPath || n.folder_path.startsWith(folderPath + '/'))
  }

  const displayedNotes = selectedFolder ? filterNotesByFolder(selectedFolder) : regularNotes

  const renderFolder = (folder: NoteFolder, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.path)
    const isSelected = selectedFolder === folder.path

    return (
      <div key={folder.path}>
        <button
          onClick={() => {
            toggleFolder(folder.path)
            setSelectedFolder(folder.path)
            setSelectedNote(null)
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
          <span className="text-xs text-muted-foreground">{folder.note_count}</span>
        </button>
        {isExpanded && folder.subfolders.map((sub) => renderFolder(sub, depth + 1))}
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading notes...</div>
      </div>
    )
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
              <FileText className="h-6 w-6" />
              Notes
            </h2>
            <p className="text-sm text-muted-foreground">
              {notes.length} notes in {folders.length} folders
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleGetDaily}>
            <Calendar className="h-4 w-4 mr-2" />
            Today's Note
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button variant="secondary" onClick={handleSearch}>
          Search
        </Button>
        {searchResults && (
          <Button variant="ghost" onClick={() => { setSearchResults(null); setSearchQuery('') }}>
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Sidebar - Folders */}
        <div className="col-span-3 space-y-4">
          {/* Daily Notes Section */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                Daily Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              {dailyNotes.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No daily notes yet</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {dailyNotes.slice(0, 7).map((note) => (
                    <button
                      key={note.id}
                      onClick={() => handleSelectNote(note)}
                      className={cn(
                        "w-full text-left text-sm px-2 py-1 rounded hover:bg-accent transition-colors truncate",
                        selectedNote?.id === note.id && "bg-accent"
                      )}
                    >
                      {note.date ? formatDate(note.date) : note.title}
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Folders Section */}
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
                  className="h-7 w-7 p-0 hover:bg-accent"
                  onClick={() => {
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
                  setSelectedFolder(null)
                  setSelectedNote(null)
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left",
                  selectedFolder === null && "bg-accent"
                )}
              >
                <span className="w-3" />
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="flex-1">All Notes</span>
                <span className="text-xs text-muted-foreground">{regularNotes.length}</span>
              </button>
              {folders.map((folder) => renderFolder(folder))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="col-span-9">
          {searchResults ? (
            /* Search Results */
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Search Results ({searchResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {searchResults.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-4 text-center">No notes found</p>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => handleSelectNote(note)}
                        className="w-full text-left p-3 rounded border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{note.title}</span>
                          <span className="text-xs text-muted-foreground">{note.folder_path || 'Root'}</span>
                        </div>
                        {note.content && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {note.content.substring(0, 150)}...
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : selectedNote ? (
            /* Note View/Edit */
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  {editMode ? (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="text-lg font-semibold"
                      placeholder="Note title..."
                    />
                  ) : (
                    <CardTitle className="flex items-center gap-2">
                      {selectedNote.is_daily_note && <Calendar className="h-5 w-5 text-blue-500" />}
                      {selectedNote.title}
                    </CardTitle>
                  )}
                  <div className="flex items-center gap-2">
                    {editMode ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEditMode(false)}>
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveNote}>
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={handleStartEdit}>
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteNote(selectedNote)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
                      {selectedNote.folder_path && (
                        <span className="flex items-center gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {selectedNote.folder_path}
                        </span>
                      )}
                      <span>Updated {formatDate(selectedNote.updated_at)}</span>
                    </>
                  )}
                </div>
                {/* Tags */}
                {selectedNote.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedNote.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                {/* Links */}
                {(selectedNote.linked_project_ids.length > 0 || selectedNote.linked_task_ids.length > 0 || selectedNote.linked_goal_ids.length > 0) && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Link className="h-3 w-3" />
                    {selectedNote.linked_project_ids.length > 0 && (
                      <span>{selectedNote.linked_project_ids.length} project(s)</span>
                    )}
                    {selectedNote.linked_task_ids.length > 0 && (
                      <span>{selectedNote.linked_task_ids.length} task(s)</span>
                    )}
                    {selectedNote.linked_goal_ids.length > 0 && (
                      <span>{selectedNote.linked_goal_ids.length} goal(s)</span>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {editMode ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Write your note in markdown..."
                    className="min-h-[400px] font-mono text-sm"
                  />
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {selectedNote.content ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm">
                        {selectedNote.content}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground italic">
                        No content yet. Click Edit to start writing.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Notes List */
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {selectedFolder ? `Notes in ${selectedFolder}` : 'All Notes'} ({displayedNotes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {displayedNotes.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <p className="text-muted-foreground">No notes yet</p>
                    <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create First Note
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {displayedNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => handleSelectNote(note)}
                        className="w-full text-left p-4 rounded-lg border hover:bg-accent hover:border-primary/50 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{note.title}</h4>
                            {note.content && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {note.content.substring(0, 120)}...
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              {note.folder_path && (
                                <span className="flex items-center gap-1">
                                  <FolderOpen className="h-3 w-3" />
                                  {note.folder_path}
                                </span>
                              )}
                              <span>{formatDate(note.updated_at)}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Create Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Note</DialogTitle>
            <DialogDescription className="sr-only">
              Create a new note with a title and optional folder
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                placeholder="Note title..."
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Folder (optional)</Label>
              <FolderSelector
                folders={folderItems}
                value={newNoteFolder}
                onChange={setNewNoteFolder}
                placeholder="Select or create folder..."
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNote} disabled={!newNoteTitle.trim()}>
              Create Note
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
              Create a new folder or subfolder for organizing notes
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
                // Create folder without creating a note
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
