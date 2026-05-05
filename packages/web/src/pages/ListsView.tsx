import { useState, useMemo } from 'react'
import { Plus, ListChecks, Archive, ChevronRight, Check, MoreVertical, Trash2, Edit, Copy, Zap, Search, X, Filter, FolderKanban, Tag, Pin, Palette, CheckCircle2, ArchiveRestore, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { useLists } from '@/hooks/useLists'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { ListForm } from '@/components/ListForm'
import type { List, ListType } from '@/types'

interface ListsViewProps {
  onOpenList: (listId: string) => void
}

type ViewMode = 'all' | 'by-type' | 'by-project' | 'by-category'

// Available color options for lists
const LIST_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Pink', value: '#ec4899' },
]

export function ListsView({ onOpenList }: ListsViewProps) {
  const { lists, archivedLists, loading, createList, deleteList, archiveList, unarchiveList, completeList, uncompleteList, pinList, setListColor } = useLists()
  const { habits } = useTasks()
  const { projects } = useProjects()
  const [showListForm, setShowListForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('by-type')
  const [selectedTypes, setSelectedTypes] = useState<ListType[]>(['eternal', 'template', 'quick'])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [showArchivedLists, setShowArchivedLists] = useState(false)

  // Get all unique categories across lists
  const allCategories = useMemo(() => {
    const categories = new Set<string>()
    lists.forEach(list => {
      list.categories.forEach(cat => categories.add(cat))
      list.items.forEach(item => {
        if (item.category) categories.add(item.category)
      })
    })
    return Array.from(categories).sort()
  }, [lists])

  // Filter lists based on search and filters
  const filteredLists = useMemo(() => {
    return lists.filter(list => {
      // Type filter
      if (!selectedTypes.includes(list.list_type)) return false

      // Project filter
      if (selectedProjectIds.length > 0) {
        const hasLinkedProject = list.linked_project_ids.some(id => selectedProjectIds.includes(id))
        if (!hasLinkedProject) return false
      }

      // Category filter
      if (selectedCategories.length > 0) {
        const listCategories = new Set([
          ...list.categories,
          ...list.items.map(item => item.category).filter(Boolean)
        ])
        const hasCategory = selectedCategories.some(cat => listCategories.has(cat))
        if (!hasCategory) return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesName = list.name.toLowerCase().includes(query)
        const matchesDescription = list.description?.toLowerCase().includes(query)
        const matchesItems = list.items.some(item =>
          item.text.toLowerCase().includes(query) ||
          item.notes?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query)
        )
        if (!matchesName && !matchesDescription && !matchesItems) return false
      }

      return true
    })
  }, [lists, searchQuery, selectedTypes, selectedProjectIds, selectedCategories])

  // Group lists by category for category view
  const listsByCategory = useMemo(() => {
    const grouped: Record<string, List[]> = { 'Uncategorized': [] }

    filteredLists.forEach(list => {
      const categories = list.categories.length > 0 ? list.categories : ['Uncategorized']
      categories.forEach(cat => {
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(list)
      })
    })

    return grouped
  }, [filteredLists])

  // Group lists by project for project view
  const listsByProject = useMemo(() => {
    const grouped: Record<string, { project: { id: string; name: string } | null; lists: List[] }> = {
      'Unlinked': { project: null, lists: [] }
    }

    filteredLists.forEach(list => {
      if (list.linked_project_ids.length === 0) {
        grouped['Unlinked'].lists.push(list)
      } else {
        list.linked_project_ids.forEach(projectId => {
          const project = projects.find(p => p.id === projectId)
          const key = project?.name || projectId
          if (!grouped[key]) {
            grouped[key] = { project: project || null, lists: [] }
          }
          grouped[key].lists.push(list)
        })
      }
    })

    return grouped
  }, [filteredLists, projects])

  const hasActiveFilters = selectedProjectIds.length > 0 || selectedCategories.length > 0 || selectedTypes.length < 3

  const handleDeleteList = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this list?')) {
      await deleteList(listId)
    }
  }

  const handleArchiveList = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation()
    await archiveList(listId)
  }

  const handleUnarchiveList = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation()
    await unarchiveList(listId)
  }

  const handleCompleteList = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation()
    await completeList(listId)
  }

  const handleUncompleteList = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation()
    await uncompleteList(listId)
  }

  const handlePinList = async (e: React.MouseEvent, listId: string) => {
    e.stopPropagation()
    await pinList(listId)
  }

  const handleSetColor = async (listId: string, color: string | null) => {
    await setListColor(listId, color)
  }

  const getListProgress = (list: List) => {
    if (list.list_type === 'eternal') {
      const total = list.items.length
      const completed = list.items.filter(i => i.completed_at).length
      return { total, completed, percentage: total > 0 ? (completed / total) * 100 : 0 }
    }
    return { total: list.items.length, completed: 0, percentage: 0 }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTypes(['eternal', 'template', 'quick'])
    setSelectedProjectIds([])
    setSelectedCategories([])
  }

  const toggleType = (type: ListType) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const toggleProject = (projectId: string) => {
    setSelectedProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    )
  }

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    )
  }

  // Get filtered lists for each type (for by-type view)
  const filteredEternalLists = filteredLists.filter(l => l.list_type === 'eternal')
  const filteredTemplateLists = filteredLists.filter(l => l.list_type === 'template')
  const filteredQuickLists = filteredLists.filter(l => l.list_type === 'quick')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ListChecks className="h-6 w-6" />
            Lists
          </h2>
          <p className="text-muted-foreground">
            Manage your checklists and running lists
          </p>
        </div>
        <Button onClick={() => setShowListForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New List
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search lists and items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery('')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* View mode selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="shrink-0">
              <FolderKanban className="h-4 w-4 mr-2" />
              View: {viewMode === 'all' ? 'All' : viewMode === 'by-type' ? 'By Type' : viewMode === 'by-project' ? 'By Project' : 'By Category'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>View Mode</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={viewMode === 'by-type'}
              onCheckedChange={() => setViewMode('by-type')}
            >
              By Type
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={viewMode === 'by-project'}
              onCheckedChange={() => setViewMode('by-project')}
            >
              By Project
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={viewMode === 'by-category'}
              onCheckedChange={() => setViewMode('by-category')}
            >
              By Category
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={viewMode === 'all'}
              onCheckedChange={() => setViewMode('all')}
            >
              All Lists
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className={hasActiveFilters ? 'border-primary' : ''}>
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {selectedProjectIds.length + selectedCategories.length + (selectedTypes.length < 3 ? 3 - selectedTypes.length : 0)}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>List Types</DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              checked={selectedTypes.includes('eternal')}
              onCheckedChange={() => toggleType('eternal')}
            >
              <Check className="h-4 w-4 mr-2 text-green-500" />
              Running Lists
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedTypes.includes('template')}
              onCheckedChange={() => toggleType('template')}
            >
              <Copy className="h-4 w-4 mr-2 text-blue-500" />
              Templates
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={selectedTypes.includes('quick')}
              onCheckedChange={() => toggleType('quick')}
            >
              <Zap className="h-4 w-4 mr-2 text-orange-500" />
              Quick Lists
            </DropdownMenuCheckboxItem>

            {projects.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Projects</DropdownMenuLabel>
                <div className="max-h-[200px] overflow-y-auto">
                  {projects.map(project => (
                    <DropdownMenuCheckboxItem
                      key={project.id}
                      checked={selectedProjectIds.includes(project.id)}
                      onCheckedChange={() => toggleProject(project.id)}
                    >
                      {project.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </>
            )}

            {allCategories.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Categories</DropdownMenuLabel>
                <div className="max-h-[200px] overflow-y-auto">
                  {allCategories.map(category => (
                    <DropdownMenuCheckboxItem
                      key={category}
                      checked={selectedCategories.includes(category)}
                      onCheckedChange={() => toggleCategory(category)}
                    >
                      <Tag className="h-3 w-3 mr-2" />
                      {category}
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </>
            )}

            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-primary">
                  <X className="h-4 w-4 mr-2" />
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {selectedTypes.length < 3 && selectedTypes.map(type => (
            <Badge key={type} variant="secondary" className="gap-1">
              {type === 'eternal' ? 'Running' : type === 'template' ? 'Template' : 'Quick'}
              <button onClick={() => toggleType(type)} className="ml-1 hover:bg-muted rounded-full">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedProjectIds.map(id => {
            const project = projects.find(p => p.id === id)
            return (
              <Badge key={id} variant="secondary" className="gap-1">
                <FolderKanban className="h-3 w-3" />
                {project?.name || id}
                <button onClick={() => toggleProject(id)} className="ml-1 hover:bg-muted rounded-full">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
          {selectedCategories.map(cat => (
            <Badge key={cat} variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" />
              {cat}
              <button onClick={() => toggleCategory(cat)} className="ml-1 hover:bg-muted rounded-full">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}

      {/* Search results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {filteredLists.length} list{filteredLists.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </p>
      )}

      {lists.length === 0 && archivedLists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ListChecks className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No lists yet</p>
            <p className="text-sm mb-4">Create lists to track movies, books, groceries, and more!</p>
            <Button onClick={() => setShowListForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First List
            </Button>
          </CardContent>
        </Card>
      ) : filteredLists.length === 0 && archivedLists.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No lists found</p>
            <p className="text-sm mb-4">Try adjusting your search or filters</p>
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      ) : filteredLists.length === 0 && archivedLists.length > 0 ? (
        <div className="space-y-8">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <ListChecks className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">All your lists are archived</p>
              <Button variant="outline" className="mt-3" onClick={() => setShowListForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create New List
              </Button>
            </CardContent>
          </Card>

          {/* Archived Lists Section */}
          <div className="space-y-4 border-t pt-6">
            <button
              className="flex items-center gap-2 text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setShowArchivedLists(!showArchivedLists)}
            >
              <Archive className="h-5 w-5" />
              Archived Lists
              <Badge variant="secondary" className="ml-2">{archivedLists.length}</Badge>
              {showArchivedLists ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
            {showArchivedLists && (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {archivedLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    onOpenList={onOpenList}
                    onDelete={handleDeleteList}
                    onArchive={handleArchiveList}
                    onUnarchive={handleUnarchiveList}
                    onComplete={handleCompleteList}
                    onUncomplete={handleUncompleteList}
                    onPin={handlePinList}
                    onSetColor={handleSetColor}
                    getListProgress={getListProgress}
                    isArchived={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* View: All Lists */}
          {viewMode === 'all' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLists.map((list) => (
                <ListCard
                  key={list.id}
                  list={list}
                  onOpenList={onOpenList}
                  onDelete={handleDeleteList}
                  onArchive={handleArchiveList}
                  onComplete={handleCompleteList}
                  onUncomplete={handleUncompleteList}
                  onPin={handlePinList}
                  onSetColor={handleSetColor}
                  getListProgress={getListProgress}
                />
              ))}
            </div>
          )}

          {/* View: By Type */}
          {viewMode === 'by-type' && (
            <>
              {/* Eternal Lists (Running Lists) */}
              {filteredEternalLists.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    Running Lists
                    <Badge variant="secondary" className="ml-2">{filteredEternalLists.length}</Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Cumulative lists that grow over time - movies to watch, books to read, etc.
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEternalLists.map((list) => (
                      <ListCard
                        key={list.id}
                        list={list}
                        onOpenList={onOpenList}
                        onDelete={handleDeleteList}
                        onArchive={handleArchiveList}
                        onComplete={handleCompleteList}
                        onUncomplete={handleUncompleteList}
                        onPin={handlePinList}
                        onSetColor={handleSetColor}
                        getListProgress={getListProgress}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Template Lists (Checklists) */}
              {filteredTemplateLists.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Copy className="h-5 w-5 text-blue-500" />
                    Checklist Templates
                    <Badge variant="secondary" className="ml-2">{filteredTemplateLists.length}</Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Reusable templates - create a new instance each time you need a fresh checklist
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplateLists.map((list) => (
                      <ListCard
                        key={list.id}
                        list={list}
                        onOpenList={onOpenList}
                        onDelete={handleDeleteList}
                        onArchive={handleArchiveList}
                        onComplete={handleCompleteList}
                        onUncomplete={handleUncompleteList}
                        onPin={handlePinList}
                        onSetColor={handleSetColor}
                        getListProgress={getListProgress}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Lists (One-off) */}
              {filteredQuickLists.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Zap className="h-5 w-5 text-orange-500" />
                    Quick Lists
                    <Badge variant="secondary" className="ml-2">{filteredQuickLists.length}</Badge>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    One-off lists for temporary needs - auto-archives when all items are checked
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQuickLists.map((list) => (
                      <ListCard
                        key={list.id}
                        list={list}
                        onOpenList={onOpenList}
                        onDelete={handleDeleteList}
                        onArchive={handleArchiveList}
                        onComplete={handleCompleteList}
                        onUncomplete={handleUncompleteList}
                        onPin={handlePinList}
                        onSetColor={handleSetColor}
                        getListProgress={getListProgress}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* View: By Project */}
          {viewMode === 'by-project' && (
            <>
              {Object.entries(listsByProject)
                .filter(([_, data]) => data.lists.length > 0)
                .sort(([a], [b]) => a === 'Unlinked' ? 1 : b === 'Unlinked' ? -1 : a.localeCompare(b))
                .map(([projectName, { lists: projectLists }]) => (
                  <div key={projectName} className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FolderKanban className="h-5 w-5 text-purple-500" />
                      {projectName}
                      <Badge variant="secondary" className="ml-2">{projectLists.length}</Badge>
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projectLists.map((list) => (
                        <ListCard
                          key={list.id}
                          list={list}
                          onOpenList={onOpenList}
                          onDelete={handleDeleteList}
                          onArchive={handleArchiveList}
                          onComplete={handleCompleteList}
                          onUncomplete={handleUncompleteList}
                          onPin={handlePinList}
                          onSetColor={handleSetColor}
                          getListProgress={getListProgress}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </>
          )}

          {/* View: By Category */}
          {viewMode === 'by-category' && (
            <>
              {Object.entries(listsByCategory)
                .filter(([_, lists]) => lists.length > 0)
                .sort(([a], [b]) => a === 'Uncategorized' ? 1 : b === 'Uncategorized' ? -1 : a.localeCompare(b))
                .map(([category, categoryLists]) => (
                  <div key={category} className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Tag className="h-5 w-5 text-cyan-500" />
                      {category}
                      <Badge variant="secondary" className="ml-2">{categoryLists.length}</Badge>
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryLists.map((list) => (
                        <ListCard
                          key={list.id}
                          list={list}
                          onOpenList={onOpenList}
                          onDelete={handleDeleteList}
                          onArchive={handleArchiveList}
                          onComplete={handleCompleteList}
                          onUncomplete={handleUncompleteList}
                          onPin={handlePinList}
                          onSetColor={handleSetColor}
                          getListProgress={getListProgress}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </>
          )}

          {/* Archived Lists Section - Always visible */}
          <div className="space-y-4 border-t pt-6">
            <button
              className="flex items-center gap-2 text-lg font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
              onClick={() => setShowArchivedLists(!showArchivedLists)}
            >
              <Archive className="h-5 w-5" />
              Archived Lists
              <Badge variant="secondary" className="ml-2">{archivedLists.length}</Badge>
              {showArchivedLists ? (
                <ChevronUp className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-auto" />
              )}
            </button>
            {showArchivedLists && (
              archivedLists.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archivedLists.map((list) => (
                    <ListCard
                      key={list.id}
                      list={list}
                      onOpenList={onOpenList}
                      onDelete={handleDeleteList}
                      onArchive={handleArchiveList}
                      onUnarchive={handleUnarchiveList}
                      onComplete={handleCompleteList}
                      onUncomplete={handleUncompleteList}
                      onPin={handlePinList}
                      onSetColor={handleSetColor}
                      getListProgress={getListProgress}
                      isArchived={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No archived lists</p>
                  <p className="text-sm">Archive lists from the menu to see them here</p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* List Form Dialog */}
      <ListForm
        open={showListForm}
        onClose={() => setShowListForm(false)}
        onSubmit={async (data) => {
          await createList(data)
          setShowListForm(false)
        }}
        habits={habits}
        projects={projects}
      />
    </div>
  )
}

// Reusable list card component
function ListCard({
  list,
  onOpenList,
  onDelete,
  onArchive,
  onUnarchive,
  onComplete,
  onUncomplete,
  onPin,
  onSetColor,
  getListProgress,
  isArchived = false,
}: {
  list: List
  onOpenList: (listId: string) => void
  onDelete: (e: React.MouseEvent, listId: string) => void
  onArchive: (e: React.MouseEvent, listId: string) => void
  onUnarchive?: (e: React.MouseEvent, listId: string) => void
  onComplete?: (e: React.MouseEvent, listId: string) => void
  onUncomplete?: (e: React.MouseEvent, listId: string) => void
  onPin: (e: React.MouseEvent, listId: string) => void
  onSetColor: (listId: string, color: string | null) => void
  getListProgress: (list: List) => { total: number; completed: number; percentage: number }
  isArchived?: boolean
}) {
  const progress = getListProgress(list)
  const typeLabel = list.list_type === 'eternal' ? 'Running' : list.list_type === 'template' ? 'Template' : 'Quick'
  const typeColor = list.list_type === 'eternal' ? 'text-green-500' : list.list_type === 'template' ? 'text-blue-500' : 'text-orange-500'

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50"
      style={list.color ? { borderLeftColor: list.color, borderLeftWidth: '4px' } : undefined}
      onClick={() => onOpenList(list.id)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg truncate flex items-center gap-2">
            {list.is_pinned && <Pin className="h-4 w-4 text-primary shrink-0" />}
            {list.completed_at && <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />}
            <span className={list.completed_at ? 'text-muted-foreground' : ''}>{list.name}</span>
          </CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onOpenList(list.id) }}>
                <Edit className="h-4 w-4 mr-2" />
                {list.list_type === 'template' ? 'Edit Template' : 'Edit'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => onPin(e, list.id)}>
                <Pin className="h-4 w-4 mr-2" />
                {list.is_pinned ? 'Unpin' : 'Pin to Top'}
              </DropdownMenuItem>
              {/* Complete/Uncomplete for non-template lists */}
              {list.list_type !== 'template' && onComplete && onUncomplete && (
                <DropdownMenuItem onClick={(e) => list.completed_at ? onUncomplete(e, list.id) : onComplete(e, list.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {list.completed_at ? 'Mark as Active' : 'Mark as Completed'}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Color
              </DropdownMenuLabel>
              <div className="px-2 py-1.5 flex flex-wrap gap-1">
                {LIST_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className="h-5 w-5 rounded-full border-2 hover:scale-110 transition-transform"
                    style={{
                      backgroundColor: color.value,
                      borderColor: list.color === color.value ? 'white' : color.value,
                      boxShadow: list.color === color.value ? '0 0 0 2px var(--primary)' : undefined
                    }}
                    onClick={(e) => { e.stopPropagation(); onSetColor(list.id, color.value) }}
                    title={color.name}
                  />
                ))}
                {list.color && (
                  <button
                    className="h-5 w-5 rounded-full border-2 border-muted-foreground flex items-center justify-center hover:bg-muted"
                    onClick={(e) => { e.stopPropagation(); onSetColor(list.id, null) }}
                    title="Remove color"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <DropdownMenuSeparator />
              {isArchived && onUnarchive ? (
                <DropdownMenuItem onClick={(e) => onUnarchive(e, list.id)}>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Restore from Archive
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => onArchive(e, list.id)}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => onDelete(e, list.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {list.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{list.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {list.list_type === 'template' ? (
            <div className="text-sm text-muted-foreground">
              {list.items.length} items in template
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress.completed}/{progress.total} done</span>
              </div>
              <Progress value={progress.percentage} className="h-2" />
            </>
          )}
          {list.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {list.categories.slice(0, 3).map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
              {list.categories.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{list.categories.length - 3}
                </Badge>
              )}
            </div>
          )}
          <div className="flex items-center justify-between pt-2">
            <Badge variant="outline" className={typeColor}>
              {typeLabel}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
