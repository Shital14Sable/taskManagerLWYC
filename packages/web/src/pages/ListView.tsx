import { useState, useEffect, useMemo, useCallback } from 'react'
import { ArrowLeft, Plus, Check, Trash2, Archive, Calendar, Play, GripVertical, ChevronRight, ChevronDown, ExternalLink, Tag, Settings, Pencil, X, Save, Star, DollarSign, MapPin, Info, Clock, Search, Link, ArrowUpDown } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLists, useListInstances } from '@/hooks/useLists'
import { useTasks } from '@/hooks/useTasks'
import { useProjects } from '@/hooks/useProjects'
import { ListForm } from '@/components/ListForm'
import type { List, ListItem, ListInstance, UpdateListInput } from '@/types'
import { getTagColor } from '@/types'
import { cn } from '@/lib/utils'

// Extended properties type for editing
interface ExtendedItemData {
  text?: string
  quantity?: string
  category?: string
  url?: string
  price?: string
  rating?: number
  priority?: 'high' | 'medium' | 'low'
  location?: string
  due_date?: string
  source?: string
  image_url?: string
  notes?: string
}

interface ListViewProps {
  listId: string
  onBack: () => void
}

export function ListView({ listId, onBack }: ListViewProps) {
  const [newItemText, setNewItemText] = useState('')
  const [addingItem, setAddingItem] = useState(false)
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null)
  const [showListForm, setShowListForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [detailItem, setDetailItem] = useState<ListItem | null>(null)
  const [sortMode, setSortMode] = useState<'order' | 'rating' | 'price' | 'priority' | 'due_date'>('order')

  // For fetching habits and projects for list form
  const { habits } = useTasks()
  const { projects } = useProjects()

  // Use local storage hooks
  const {
    lists,
    updateList: updateListHook,
    addItem: addListItem,
    updateItem: updateListItem,
    toggleItem: toggleListItem,
    deleteItem: deleteListItem,
  } = useLists()

  const {
    instances,
    activeInstances,
    createInstance,
    toggleItem: toggleInstanceItem,
    addItem: addInstanceItem,
    archiveInstance,
    deleteInstance,
  } = useListInstances(listId)

  // Get list from local storage (with optional local override for optimistic updates)
  const [localListOverride, setLocalListOverride] = useState<List | null>(null)
  const listFromStorage = useMemo(() => lists.find(l => l.id === listId) || null, [lists, listId])
  const list = localListOverride || listFromStorage
  const loading = false

  // Clear local override when storage updates
  useEffect(() => {
    setLocalListOverride(null)
  }, [listFromStorage])

  // Initialize sortMode from list's default_sort when list loads
  useEffect(() => {
    if (list?.default_sort) {
      setSortMode(list.default_sort)
    }
  }, [list?.default_sort])

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim() || !list) return

    setAddingItem(true)
    try {
      await addListItem(listId, { text: newItemText.trim() })
      setNewItemText('')
    } catch (error) {
      console.error('Failed to add item:', error)
    } finally {
      setAddingItem(false)
    }
  }

  const handleToggleItem = async (itemId: string) => {
    if (!list) return
    try {
      const updatedList = await toggleListItem(listId, itemId)

      // Auto-archive quick lists when all items are completed
      if (updatedList.list_type === 'quick') {
        const allCompleted = updatedList.items.length > 0 &&
          updatedList.items.every(item => item.completed_at)
        if (allCompleted) {
          await updateListHook(listId, { archived: true })
          onBack() // Navigate back after auto-archiving
        }
      }
    } catch (error) {
      console.error('Failed to toggle item:', error)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!list) return
    try {
      await deleteListItem(listId, itemId)
    } catch (error) {
      console.error('Failed to delete item:', error)
    }
  }

  const handleAddChildItem = async (parentId: string, text: string) => {
    if (!list) return
    try {
      await addListItem(listId, {
        text,
        parent_item_id: parentId,
      })
    } catch (error) {
      console.error('Failed to add child item:', error)
    }
  }

  const handleUpdateList = async (data: UpdateListInput) => {
    try {
      await updateListHook(listId, data)
      setShowListForm(false)
    } catch (error) {
      console.error('Failed to update list:', error)
    }
  }

  const handleUpdateItem = async (itemId: string, data: ExtendedItemData) => {
    if (!list) return
    try {
      await updateListItem(listId, itemId, data)
    } catch (error) {
      console.error('Failed to update item:', error)
    }
  }

  const handleCreateInstance = async () => {
    try {
      const instance = await createInstance()
      setActiveInstanceId(instance.id)
    } catch (error) {
      console.error('Failed to create instance:', error)
    }
  }

  const handleToggleInstanceItem = async (itemId: string) => {
    if (!activeInstanceId) return
    try {
      await toggleInstanceItem(activeInstanceId, itemId)
    } catch (error) {
      console.error('Failed to toggle instance item:', error)
    }
  }

  const handleAddInstanceItem = async (text: string) => {
    if (!activeInstanceId) return
    try {
      await addInstanceItem(activeInstanceId, { text })
    } catch (error) {
      console.error('Failed to add instance item:', error)
    }
  }

  const handleArchiveInstance = async (instanceId: string) => {
    try {
      await archiveInstance(instanceId)
      if (activeInstanceId === instanceId) {
        setActiveInstanceId(null)
      }
    } catch (error) {
      console.error('Failed to archive instance:', error)
    }
  }

  const handleDeleteInstance = async (instanceId: string) => {
    if (!confirm('Are you sure you want to delete this checklist? This cannot be undone.')) return
    try {
      await deleteInstance(instanceId)
      if (activeInstanceId === instanceId) {
        setActiveInstanceId(null)
      }
    } catch (error) {
      console.error('Failed to delete instance:', error)
    }
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for reordering
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !list) return

    // Get the current items (use incomplete items for sorting)
    const items = list.items.filter(i => !i.completed_at)
    const oldIndex = items.findIndex(i => i.id === active.id)
    const newIndex = items.findIndex(i => i.id === over.id)

    if (oldIndex === -1 || newIndex === -1) return

    // Optimistically update UI
    const reorderedItems = arrayMove(items, oldIndex, newIndex)
    const completedItems = list.items.filter(i => i.completed_at)
    const newItems = [...reorderedItems, ...completedItems].map((item, idx) => ({
      ...item,
      order: idx
    }))
    setLocalListOverride({ ...list, items: newItems })

    // Persist reordered items using updateList
    try {
      await updateListHook(listId, { items: newItems } as any)
    } catch (error) {
      console.error('Failed to reorder items:', error)
    }
  }, [list, listId, updateListHook])

  // Filter items by search query (including nested children)
  const filterItemsBySearch = (items: ListItem[], query: string): ListItem[] => {
    if (!query.trim()) return items
    const lowerQuery = query.toLowerCase()

    return items.filter(item => {
      // Check if item matches
      const itemMatches =
        item.text.toLowerCase().includes(lowerQuery) ||
        item.notes?.toLowerCase().includes(lowerQuery) ||
        item.category?.toLowerCase().includes(lowerQuery) ||
        item.location?.toLowerCase().includes(lowerQuery) ||
        item.source?.toLowerCase().includes(lowerQuery) ||
        item.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))

      // Check if any children match
      const childrenMatch = item.children && item.children.length > 0 &&
        filterItemsBySearch(item.children, query).length > 0

      return itemMatches || childrenMatch
    })
  }

  // Sort items: incomplete first, then by selected sort mode (must be before early returns for Rules of Hooks)
  const sortedItems = useMemo(() => {
    if (!list) return []
    const filtered = filterItemsBySearch(list.items, searchQuery)
    return [...filtered].sort((a, b) => {
      if (list.list_type === 'eternal') {
        // Incomplete items first
        if (a.completed_at && !b.completed_at) return 1
        if (!a.completed_at && b.completed_at) return -1
      }
      // Sort by selected mode
      switch (sortMode) {
        case 'rating':
          // Higher rating first, unrated items last
          if (!a.rating && !b.rating) return a.order - b.order
          if (!a.rating) return 1
          if (!b.rating) return -1
          return b.rating - a.rating
        case 'price':
          // Parse price strings for comparison, items without price go last
          const priceA = a.price ? parseFloat(a.price.replace(/[^0-9.]/g, '')) : null
          const priceB = b.price ? parseFloat(b.price.replace(/[^0-9.]/g, '')) : null
          if (priceA === null && priceB === null) return a.order - b.order
          if (priceA === null) return 1
          if (priceB === null) return -1
          return priceA - priceB // Lower price first
        case 'priority':
          // High > Medium > Low, items without priority go last
          const priorityOrder = { high: 0, medium: 1, low: 2 }
          const priA = a.priority ? priorityOrder[a.priority] : 999
          const priB = b.priority ? priorityOrder[b.priority] : 999
          if (priA !== priB) return priA - priB
          return a.order - b.order
        case 'due_date':
          // Earlier dates first, items without due_date go last
          if (!a.due_date && !b.due_date) return a.order - b.order
          if (!a.due_date) return 1
          if (!b.due_date) return -1
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        case 'order':
        default:
          return a.order - b.order
      }
    })
  }, [list, searchQuery, sortMode])

  const incompleteItems = sortedItems.filter((i) => !i.completed_at)
  const completedItems = sortedItems.filter((i) => i.completed_at)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">List not found</p>
        <Button variant="outline" className="mt-4" onClick={onBack}>
          Go Back
        </Button>
      </div>
    )
  }

  const activeInstance = activeInstanceId
    ? instances.find((i) => i.id === activeInstanceId)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{list.name}</h2>
          {list.description && (
            <p className="text-muted-foreground">{list.description}</p>
          )}
        </div>
        <Badge variant={list.list_type === 'template' ? 'secondary' : 'default'}>
          {list.list_type === 'eternal' ? 'Running List' : list.list_type === 'quick' ? 'Quick List' : 'Template'}
        </Badge>
        <Button variant="outline" size="sm" onClick={() => setShowListForm(true)}>
          <Settings className="h-4 w-4 mr-2" />
          Edit List
        </Button>
      </div>

      {/* Search and Sort bar */}
      {list.items.length > 0 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items in this list..."
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
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowUpDown className="h-4 w-4" />
                Sort: {sortMode === 'order' ? 'Manual' : sortMode === 'rating' ? 'Rating' : sortMode === 'price' ? 'Price' : sortMode === 'priority' ? 'Priority' : 'Due Date'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortMode('order')}>
                <Check className={cn('h-4 w-4 mr-2', sortMode !== 'order' && 'invisible')} />
                Manual Order
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode('rating')}>
                <Check className={cn('h-4 w-4 mr-2', sortMode !== 'rating' && 'invisible')} />
                By Rating
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode('price')}>
                <Check className={cn('h-4 w-4 mr-2', sortMode !== 'price' && 'invisible')} />
                By Price
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode('priority')}>
                <Check className={cn('h-4 w-4 mr-2', sortMode !== 'priority' && 'invisible')} />
                By Priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortMode('due_date')}>
                <Check className={cn('h-4 w-4 mr-2', sortMode !== 'due_date' && 'invisible')} />
                By Due Date
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Search results count */}
      {searchQuery && (
        <p className="text-sm text-muted-foreground">
          Found {sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </p>
      )}

      {/* Template List: Show instances */}
      {list.list_type === 'template' && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Template Items */}
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  Template Items
                  <Button size="sm" onClick={handleCreateInstance}>
                    <Play className="h-4 w-4 mr-2" />
                    Start New Checklist
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new item */}
                <form onSubmit={handleAddItem} className="flex gap-2">
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    placeholder="Add item to template..."
                    disabled={addingItem}
                  />
                  <Button type="submit" disabled={!newItemText.trim() || addingItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </form>

                {/* Template items list */}
                {list.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No items yet. Add items to your template above.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {list.items.map((item) => (
                      <TemplateItemRow
                        key={item.id}
                        item={item}
                        onEdit={handleUpdateItem}
                        onDelete={handleDeleteItem}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active Instance */}
            {activeInstance && (
              <Card className="border-primary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    {activeInstance.name}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchiveInstance(activeInstance.id)}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteInstance(activeInstance.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <InstanceChecklist
                    list={list}
                    instance={activeInstance}
                    onToggle={handleToggleInstanceItem}
                    onAddItem={handleAddInstanceItem}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Instances Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Recent Checklists</CardTitle>
              </CardHeader>
              <CardContent>
                {activeInstances.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active checklists. Start one to begin!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeInstances.map((instance) => {
                      const checkedCount = Object.values(instance.item_states).filter(Boolean).length
                      const totalCount = list.items.length + instance.extra_items.length
                      const isActive = instance.id === activeInstanceId

                      return (
                        <div
                          key={instance.id}
                          className={cn(
                            'p-3 rounded-lg cursor-pointer transition-colors group relative',
                            isActive ? 'bg-primary/10 border border-primary' : 'hover:bg-muted'
                          )}
                          onClick={() => setActiveInstanceId(instance.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{instance.name}</span>
                            <div className="flex items-center gap-1">
                              {instance.completed_at && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                              <button
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded text-destructive transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteInstance(instance.id)
                                }}
                                title="Delete checklist"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(instance.created_at).toLocaleDateString()}
                            <span>•</span>
                            <span>{checkedCount}/{totalCount}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Eternal/Quick List: Direct checklist */}
      {(list.list_type === 'eternal' || list.list_type === 'quick') && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {incompleteItems.length} items remaining
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new item */}
            <form onSubmit={handleAddItem} className="flex gap-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="Add new item..."
                disabled={addingItem}
              />
              <Button type="submit" disabled={!newItemText.trim() || addingItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>

            {/* Incomplete items with drag-and-drop */}
            {incompleteItems.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={incompleteItems.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {incompleteItems.map((item) => (
                      <SortableListItemRow
                        key={item.id}
                        item={item}
                        onToggle={handleToggleItem}
                        onDelete={handleDeleteItem}
                        onAddChild={handleAddChildItem}
                        onEdit={handleUpdateItem}
                        onViewDetails={setDetailItem}
                        isDragEnabled={sortMode === 'order' && !searchQuery}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Completed items */}
            {completedItems.length > 0 && (
              <div className="space-y-1 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Completed ({completedItems.length})
                </p>
                {completedItems.map((item) => (
                  <ListItemRow
                    key={item.id}
                    item={item}
                    onToggle={handleToggleItem}
                    onDelete={handleDeleteItem}
                    onAddChild={handleAddChildItem}
                    onEdit={handleUpdateItem}
                    onViewDetails={setDetailItem}
                  />
                ))}
              </div>
            )}

            {list.items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items yet. Add your first item above!
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* List Edit Form Dialog */}
      <ListForm
        open={showListForm}
        onClose={() => setShowListForm(false)}
        onSubmit={async (data) => {
          await handleUpdateList(data)
        }}
        list={list}
        habits={habits}
        projects={projects}
      />

      {/* Item Detail Modal (read-only view) */}
      <ItemDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
        onEdit={() => {
          setDetailItem(null)
        }}
      />
    </div>
  )
}

// Helper component for list items with nested children support
function ListItemRow({
  item,
  onToggle,
  onDelete,
  onAddChild,
  onEdit,
  onViewDetails,
  depth = 0,
}: {
  item: ListItem
  onToggle: (itemId: string) => void
  onDelete: (itemId: string) => void
  onAddChild?: (parentId: string, text: string) => void
  onEdit?: (itemId: string, data: ExtendedItemData) => void
  onViewDetails?: (item: ListItem) => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [newChildText, setNewChildText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const [editQuantity, setEditQuantity] = useState(item.quantity || '')
  const [editCategory, setEditCategory] = useState(item.category || '')
  const [editUrl, setEditUrl] = useState(item.url || '')
  const [editPrice, setEditPrice] = useState(item.price || '')
  const [editRating, setEditRating] = useState<number | undefined>(item.rating)
  const [editPriority, setEditPriority] = useState(item.priority || '')
  const [editLocation, setEditLocation] = useState(item.location || '')
  const [editDueDate, setEditDueDate] = useState(item.due_date || '')
  const [editSource, setEditSource] = useState(item.source || '')
  const [editNotes, setEditNotes] = useState(item.notes || '')
  const isCompleted = !!item.completed_at
  const hasChildren = item.children && item.children.length > 0
  const hasExtendedProps = item.price || item.rating || item.priority || item.location || item.due_date || item.source || item.notes

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault()
    if (newChildText.trim() && onAddChild) {
      onAddChild(item.id, newChildText.trim())
      setNewChildText('')
      setShowAddChild(false)
    }
  }

  const handleSaveEdit = () => {
    if (onEdit && editText.trim()) {
      onEdit(item.id, {
        text: editText.trim(),
        quantity: editQuantity.trim() || undefined,
        category: editCategory.trim() || undefined,
        url: editUrl.trim() || undefined,
        price: editPrice.trim() || undefined,
        rating: editRating,
        priority: (editPriority as 'high' | 'medium' | 'low') || undefined,
        location: editLocation.trim() || undefined,
        due_date: editDueDate || undefined,
        source: editSource.trim() || undefined,
        notes: editNotes.trim() || undefined,
      })
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditText(item.text)
    setEditQuantity(item.quantity || '')
    setEditCategory(item.category || '')
    setEditUrl(item.url || '')
    setEditPrice(item.price || '')
    setEditRating(item.rating)
    setEditPriority(item.priority || '')
    setEditLocation(item.location || '')
    setEditDueDate(item.due_date || '')
    setEditSource(item.source || '')
    setEditNotes(item.notes || '')
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className={cn(depth > 0 && 'ml-6 border-l-2 border-muted pl-2')}>
        <div className="p-3 rounded-lg bg-muted/50 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Text</Label>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Item text..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                placeholder="e.g., 2 lbs"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g., Produce"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
              />
            </div>
          </div>
          {/* Extended properties */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Extended Properties</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Price</Label>
                <Input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="e.g., $19.99"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rating (1-5)</Label>
                <div className="flex gap-1 h-8 items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRating(editRating === star ? undefined : star)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          editRating && star <= editRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="h-8 w-full text-sm rounded-md border border-input bg-background px-2"
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Location</Label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Where to find it"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate ? editDueDate.split('T')[0] : ''}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Input
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  placeholder="Where you heard about it"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1 mt-2">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes..."
                className="w-full h-16 text-sm rounded-md border border-input bg-background px-3 py-2 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSaveEdit} disabled={!editText.trim()}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(depth > 0 && 'ml-6 border-l-2 border-muted pl-2')}>
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group',
          isCompleted && 'opacity-60'
        )}
      >
        {/* Expand/collapse for items with children or extended props */}
        {(hasChildren || hasExtendedProps) ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={() => hasChildren ? setExpanded(!expanded) : setShowDetails(!showDetails)}
          >
            {(hasChildren ? expanded : showDetails) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}

        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => onToggle(item.id)}
        />

        <div className="flex-1 min-w-0">
          <div className={cn('flex items-center gap-2', isCompleted && 'line-through')}>
            {/* Clickable text to view details */}
            <span
              className={cn(
                'truncate',
                onViewDetails && 'cursor-pointer hover:text-primary hover:underline'
              )}
              onClick={() => onViewDetails?.(item)}
              title="Click to view details"
            >
              {item.text}
            </span>
            {/* Quick indicators for extended props */}
            {item.rating && (
              <span className="inline-flex items-center gap-0.5 text-yellow-500">
                <Star className="h-3 w-3 fill-current" />
                <span className="text-xs">{item.rating}</span>
              </span>
            )}
            {item.priority && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs px-1.5 py-0',
                  item.priority === 'high' && 'border-red-500 text-red-500',
                  item.priority === 'medium' && 'border-amber-500 text-amber-500',
                  item.priority === 'low' && 'border-gray-500 text-gray-500'
                )}
              >
                {item.priority}
              </Badge>
            )}
          </div>

          {/* URL - always visible when present */}
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
            >
              <Link className="h-3 w-3" />
              <span className="truncate max-w-[200px]">{item.url.replace(/^https?:\/\//, '').split('/')[0]}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: `${getTagColor(tag)}20`,
                    color: getTagColor(tag),
                  }}
                >
                  <Tag className="h-2.5 w-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Price - always visible when present */}
        {item.price && (
          <Badge variant="outline" className="text-sm shrink-0 text-green-600 border-green-600 font-medium">
            <DollarSign className="h-3.5 w-3.5 mr-0.5" />
            {item.price.replace('$', '')}
          </Badge>
        )}
        {item.quantity && (
          <Badge variant="outline" className="text-xs shrink-0">
            {item.quantity}
          </Badge>
        )}
        {item.category && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {item.category}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {hasExtendedProps && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowDetails(!showDetails)}
              title="Show details"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsEditing(true)}
              title="Edit item"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowAddChild(!showAddChild)}
              title="Add sub-item"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Extended properties details panel */}
      {showDetails && hasExtendedProps && (
        <div className="ml-8 p-3 rounded-lg bg-muted/30 text-sm space-y-2 border-l-2 border-primary/20">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {item.price && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Price:</span>
                <span className="font-medium">{item.price}</span>
              </div>
            )}
            {item.rating && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        star <= item.rating!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {item.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{item.location}</span>
              </div>
            )}
            {item.due_date && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">Due:</span>
                <span className="font-medium">{new Date(item.due_date).toLocaleDateString()}</span>
              </div>
            )}
            {item.source && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-purple-500" />
                <span className="text-muted-foreground">Source:</span>
                <span className="font-medium">{item.source}</span>
              </div>
            )}
          </div>
          {item.notes && (
            <div className="pt-2 border-t border-muted">
              <p className="text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Add child form */}
      {showAddChild && (
        <form onSubmit={handleAddChild} className="flex gap-2 ml-8 mt-1 mb-2">
          <Input
            value={newChildText}
            onChange={(e) => setNewChildText(e.target.value)}
            placeholder="Add sub-item..."
            className="h-8 text-sm"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!newChildText.trim()}>
            Add
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAddChild(false)}
          >
            Cancel
          </Button>
        </form>
      )}

      {/* Render children */}
      {expanded && hasChildren && (
        <div className="space-y-1">
          {item.children.map((child) => (
            <ListItemRow
              key={child.id}
              item={child}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onViewDetails={onViewDetails}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Sortable wrapper for ListItemRow
function SortableListItemRow({
  item,
  onToggle,
  onDelete,
  onAddChild,
  onEdit,
  onViewDetails,
  isDragEnabled = true,
}: {
  item: ListItem
  onToggle: (itemId: string) => void
  onDelete: (itemId: string) => void
  onAddChild?: (parentId: string, text: string) => void
  onEdit?: (itemId: string, data: ExtendedItemData) => void
  onViewDetails?: (item: ListItem) => void
  isDragEnabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !isDragEnabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ListItemRowWithDrag
        item={item}
        onToggle={onToggle}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onEdit={onEdit}
        onViewDetails={onViewDetails}
        dragHandleProps={isDragEnabled ? { ...attributes, ...listeners } : undefined}
        isDragging={isDragging}
      />
    </div>
  )
}

// ListItemRow with drag handle support
function ListItemRowWithDrag({
  item,
  onToggle,
  onDelete,
  onAddChild,
  onEdit,
  onViewDetails,
  dragHandleProps,
  isDragging,
  depth = 0,
}: {
  item: ListItem
  onToggle: (itemId: string) => void
  onDelete: (itemId: string) => void
  onAddChild?: (parentId: string, text: string) => void
  onEdit?: (itemId: string, data: ExtendedItemData) => void
  onViewDetails?: (item: ListItem) => void
  dragHandleProps?: Record<string, unknown>
  isDragging?: boolean
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const [showAddChild, setShowAddChild] = useState(false)
  const [newChildText, setNewChildText] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const [editQuantity, setEditQuantity] = useState(item.quantity || '')
  const [editCategory, setEditCategory] = useState(item.category || '')
  const [editUrl, setEditUrl] = useState(item.url || '')
  const [editPrice, setEditPrice] = useState(item.price || '')
  const [editRating, setEditRating] = useState<number | undefined>(item.rating)
  const [editPriority, setEditPriority] = useState(item.priority || '')
  const [editLocation, setEditLocation] = useState(item.location || '')
  const [editDueDate, setEditDueDate] = useState(item.due_date || '')
  const [editSource, setEditSource] = useState(item.source || '')
  const [editNotes, setEditNotes] = useState(item.notes || '')
  const isCompleted = !!item.completed_at
  const hasChildren = item.children && item.children.length > 0
  const hasExtendedProps = item.price || item.rating || item.priority || item.location || item.due_date || item.source || item.notes

  const handleAddChild = (e: React.FormEvent) => {
    e.preventDefault()
    if (newChildText.trim() && onAddChild) {
      onAddChild(item.id, newChildText.trim())
      setNewChildText('')
      setShowAddChild(false)
    }
  }

  const handleSaveEdit = () => {
    if (onEdit && editText.trim()) {
      onEdit(item.id, {
        text: editText.trim(),
        quantity: editQuantity.trim() || undefined,
        category: editCategory.trim() || undefined,
        url: editUrl.trim() || undefined,
        price: editPrice.trim() || undefined,
        rating: editRating,
        priority: (editPriority as 'high' | 'medium' | 'low') || undefined,
        location: editLocation.trim() || undefined,
        due_date: editDueDate || undefined,
        source: editSource.trim() || undefined,
        notes: editNotes.trim() || undefined,
      })
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditText(item.text)
    setEditQuantity(item.quantity || '')
    setEditCategory(item.category || '')
    setEditUrl(item.url || '')
    setEditPrice(item.price || '')
    setEditRating(item.rating)
    setEditPriority(item.priority || '')
    setEditLocation(item.location || '')
    setEditDueDate(item.due_date || '')
    setEditSource(item.source || '')
    setEditNotes(item.notes || '')
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className={cn(depth > 0 && 'ml-6 border-l-2 border-muted pl-2')}>
        <div className="p-3 rounded-lg bg-muted/50 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Text</Label>
            <Input
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Item text..."
              autoFocus
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Quantity</Label>
              <Input
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                placeholder="e.g., 2 lbs"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="e.g., Produce"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://..."
                className="h-8 text-sm"
              />
            </div>
          </div>
          {/* Extended properties */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Extended Properties</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Price</Label>
                <Input
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  placeholder="e.g., $19.99"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Rating (1-5)</Label>
                <div className="flex gap-1 h-8 items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEditRating(editRating === star ? undefined : star)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          editRating && star <= editRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground'
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priority</Label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="h-8 w-full text-sm rounded-md border border-input bg-background px-2"
                >
                  <option value="">None</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="space-y-1">
                <Label className="text-xs">Location</Label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Where to find it"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  value={editDueDate ? editDueDate.split('T')[0] : ''}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Source</Label>
                <Input
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value)}
                  placeholder="Where you heard about it"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1 mt-2">
              <Label className="text-xs">Notes</Label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Additional notes..."
                className="w-full h-16 text-sm rounded-md border border-input bg-background px-3 py-2 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSaveEdit} disabled={!editText.trim()}>
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(depth > 0 && 'ml-6 border-l-2 border-muted pl-2')}>
      <div
        className={cn(
          'flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group',
          isCompleted && 'opacity-60',
          isDragging && 'bg-muted shadow-lg'
        )}
      >
        {/* Drag handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Expand/collapse for items with children or extended props */}
        {(hasChildren || hasExtendedProps) ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={() => hasChildren ? setExpanded(!expanded) : setShowDetails(!showDetails)}
          >
            {(hasChildren ? expanded : showDetails) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}

        <Checkbox
          checked={isCompleted}
          onCheckedChange={() => onToggle(item.id)}
        />

        <div className="flex-1 min-w-0">
          <div className={cn('flex items-center gap-2', isCompleted && 'line-through')}>
            <span
              className={cn(
                'truncate',
                onViewDetails && 'cursor-pointer hover:text-primary hover:underline'
              )}
              onClick={() => onViewDetails?.(item)}
            >
              {item.text}
            </span>
            {item.rating && (
              <span className="inline-flex items-center gap-0.5 text-yellow-500">
                <Star className="h-3 w-3 fill-current" />
                <span className="text-xs">{item.rating}</span>
              </span>
            )}
            {item.priority && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs px-1.5 py-0',
                  item.priority === 'high' && 'border-red-500 text-red-500',
                  item.priority === 'medium' && 'border-amber-500 text-amber-500',
                  item.priority === 'low' && 'border-gray-500 text-gray-500'
                )}
              >
                {item.priority}
              </Badge>
            )}
          </div>
        </div>

        {item.price && (
          <Badge variant="outline" className="text-sm shrink-0 text-green-600 border-green-600 font-medium">
            <DollarSign className="h-3.5 w-3.5 mr-0.5" />
            {item.price.replace('$', '')}
          </Badge>
        )}
        {item.quantity && (
          <Badge variant="outline" className="text-xs shrink-0">
            {item.quantity}
          </Badge>
        )}
        {item.category && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {item.category}
          </Badge>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          {hasExtendedProps && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowDetails(!showDetails)}
              title="Show details"
            >
              <Info className="h-3.5 w-3.5" />
            </Button>
          )}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsEditing(true)}
              title="Edit item"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowAddChild(!showAddChild)}
              title="Add sub-item"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onDelete(item.id)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Extended properties details panel */}
      {showDetails && hasExtendedProps && (
        <div className="ml-8 p-3 rounded-lg bg-muted/30 text-sm space-y-2 border-l-2 border-primary/20">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {item.price && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-muted-foreground">Price:</span>
                <span className="font-medium">{item.price}</span>
              </div>
            )}
            {item.rating && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-4 w-4',
                        star <= item.rating!
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  ))}
                </div>
              </div>
            )}
            {item.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">Location:</span>
                <span className="font-medium">{item.location}</span>
              </div>
            )}
            {item.due_date && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-muted-foreground">Due:</span>
                <span className="font-medium">{new Date(item.due_date).toLocaleDateString()}</span>
              </div>
            )}
            {item.source && (
              <div className="flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-purple-500" />
                <span className="text-muted-foreground">Source:</span>
                <span className="font-medium">{item.source}</span>
              </div>
            )}
          </div>
          {item.notes && (
            <div className="pt-2 border-t border-muted">
              <p className="text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Add child form */}
      {showAddChild && (
        <form onSubmit={handleAddChild} className="flex gap-2 ml-8 mt-1 mb-2">
          <Input
            value={newChildText}
            onChange={(e) => setNewChildText(e.target.value)}
            placeholder="Add sub-item..."
            className="h-8 text-sm"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={!newChildText.trim()}>
            Add
          </Button>
        </form>
      )}

      {/* Render children */}
      {expanded && hasChildren && (
        <div className="space-y-1">
          {item.children.map((child) => (
            <ListItemRowWithDrag
              key={child.id}
              item={child}
              onToggle={onToggle}
              onDelete={onDelete}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onViewDetails={onViewDetails}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Helper component for instance checklist
function InstanceChecklist({
  list,
  instance,
  onToggle,
  onAddItem,
}: {
  list: List
  instance: ListInstance
  onToggle: (itemId: string) => void
  onAddItem: (text: string) => void
}) {
  const [newItemText, setNewItemText] = useState('')

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemText.trim()) return
    onAddItem(newItemText.trim())
    setNewItemText('')
  }

  // Combine template items with extra items
  const allItems = [
    ...list.items.map((item) => ({
      ...item,
      checked: instance.item_states[item.id] || false,
      isExtra: false,
    })),
    ...instance.extra_items.map((item) => ({
      ...item,
      checked: instance.item_states[item.id] || false,
      isExtra: true,
    })),
  ]

  const incompleteItems = allItems.filter((i) => !i.checked)
  const completedItems = allItems.filter((i) => i.checked)

  return (
    <div className="space-y-4">
      {/* Add extra item */}
      <form onSubmit={handleAddItem} className="flex gap-2">
        <Input
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Add item just for this checklist..."
        />
        <Button type="submit" disabled={!newItemText.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>

      {/* Incomplete items */}
      <div className="space-y-2">
        {incompleteItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
          >
            <Checkbox
              checked={item.checked}
              onCheckedChange={() => onToggle(item.id)}
            />
            <span className="flex-1">{item.text}</span>
            {item.quantity && (
              <Badge variant="outline" className="text-xs">
                {item.quantity}
              </Badge>
            )}
            {item.isExtra && (
              <Badge variant="secondary" className="text-xs">
                Extra
              </Badge>
            )}
          </div>
        ))}
      </div>

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div className="space-y-2 pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            Done ({completedItems.length})
          </p>
          {completedItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 opacity-60"
            >
              <Checkbox
                checked={item.checked}
                onCheckedChange={() => onToggle(item.id)}
              />
              <span className="flex-1 line-through">{item.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Helper component for template items (editable)
function TemplateItemRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ListItem
  onEdit: (itemId: string, data: ExtendedItemData) => void
  onDelete: (itemId: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(item.text)
  const [editQuantity, setEditQuantity] = useState(item.quantity || '')
  const [editCategory, setEditCategory] = useState(item.category || '')
  const [editUrl, setEditUrl] = useState(item.url || '')
  const [editPrice, setEditPrice] = useState(item.price || '')
  const [editRating, setEditRating] = useState<number | undefined>(item.rating)
  const [editPriority, setEditPriority] = useState(item.priority || '')
  const [editLocation, setEditLocation] = useState(item.location || '')
  const [editSource, setEditSource] = useState(item.source || '')

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(item.id, {
        text: editText.trim(),
        quantity: editQuantity.trim() || undefined,
        category: editCategory.trim() || undefined,
        url: editUrl.trim() || undefined,
        price: editPrice.trim() || undefined,
        rating: editRating,
        priority: (editPriority as 'high' | 'medium' | 'low') || undefined,
        location: editLocation.trim() || undefined,
        source: editSource.trim() || undefined,
      })
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditText(item.text)
    setEditQuantity(item.quantity || '')
    setEditCategory(item.category || '')
    setEditUrl(item.url || '')
    setEditPrice(item.price || '')
    setEditRating(item.rating)
    setEditPriority(item.priority || '')
    setEditLocation(item.location || '')
    setEditSource(item.source || '')
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <div className="p-3 rounded-lg bg-muted/50 space-y-3">
        <div className="space-y-2">
          <Label className="text-xs">Text</Label>
          <Input
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Item text..."
            autoFocus
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Quantity</Label>
            <Input
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              placeholder="e.g., 2 lbs"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Input
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              placeholder="e.g., Produce"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              placeholder="https://..."
              className="h-8 text-sm"
            />
          </div>
        </div>
        {/* Extended properties for template items */}
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Price</Label>
            <Input
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              placeholder="e.g., $19.99"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rating (1-5)</Label>
            <div className="flex gap-1 h-8 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setEditRating(editRating === star ? undefined : star)}
                  className="p-0.5 hover:scale-110 transition-transform"
                >
                  <Star
                    className={cn(
                      'h-4 w-4',
                      editRating && star <= editRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Priority</Label>
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value)}
              className="h-8 w-full text-sm rounded-md border border-input bg-background px-2"
            >
              <option value="">None</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Location</Label>
            <Input
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              placeholder="Where to find it"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Source</Label>
            <Input
              value={editSource}
              onChange={(e) => setEditSource(e.target.value)}
              placeholder="Where you heard about it"
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSaveEdit} disabled={!editText.trim()}>
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 group">
      <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
      <span className="flex-1">{item.text}</span>
      {item.rating && (
        <span className="inline-flex items-center gap-0.5 text-yellow-500">
          <Star className="h-3 w-3 fill-current" />
          <span className="text-xs">{item.rating}</span>
        </span>
      )}
      {item.price && (
        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
          {item.price}
        </Badge>
      )}
      {item.quantity && (
        <Badge variant="outline" className="text-xs">
          {item.quantity}
        </Badge>
      )}
      {item.category && (
        <Badge variant="secondary" className="text-xs">
          {item.category}
        </Badge>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100"
        onClick={() => setIsEditing(true)}
        title="Edit item"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100"
        onClick={() => onDelete(item.id)}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  )
}

// Read-only item detail modal
function ItemDetailModal({
  item,
  onClose,
}: {
  item: ListItem | null
  onClose: () => void
  onEdit?: () => void
}) {
  if (!item) return null

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.completed_at && <Check className="h-5 w-5 text-green-500" />}
            {item.text}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View and edit list item details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info row */}
          <div className="flex flex-wrap gap-2">
            {item.quantity && (
              <Badge variant="outline">
                Qty: {item.quantity}
              </Badge>
            )}
            {item.category && (
              <Badge variant="secondary">
                {item.category}
              </Badge>
            )}
            {item.priority && (
              <Badge
                variant="outline"
                className={cn(
                  item.priority === 'high' && 'border-red-500 text-red-500 bg-red-50',
                  item.priority === 'medium' && 'border-amber-500 text-amber-500 bg-amber-50',
                  item.priority === 'low' && 'border-gray-500 text-gray-500 bg-gray-50'
                )}
              >
                {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)} Priority
              </Badge>
            )}
          </div>

          {/* URL */}
          {item.url && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Link className="h-4 w-4" />
                Link
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all flex items-center gap-1"
              >
                {item.url}
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            </div>
          )}

          {/* Price */}
          {item.price && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 text-sm text-green-700 mb-1">
                <DollarSign className="h-4 w-4" />
                Price
              </div>
              <p className="text-xl font-bold text-green-700">{item.price}</p>
            </div>
          )}

          {/* Rating */}
          {item.rating && (
            <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-2 text-sm text-yellow-700 mb-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                Rating
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      'h-6 w-6',
                      star <= item.rating!
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Location */}
          {item.location && (
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 text-sm text-blue-700 mb-1">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <p className="font-medium text-blue-900">{item.location}</p>
            </div>
          )}

          {/* Due Date */}
          {item.due_date && (
            <div className="p-3 rounded-lg bg-orange-50 border border-orange-200">
              <div className="flex items-center gap-2 text-sm text-orange-700 mb-1">
                <Clock className="h-4 w-4" />
                Due Date
              </div>
              <p className="font-medium text-orange-900">
                {new Date(item.due_date).toLocaleDateString(undefined, {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          )}

          {/* Source */}
          {item.source && (
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
              <div className="flex items-center gap-2 text-sm text-purple-700 mb-1">
                <Info className="h-4 w-4" />
                Source / Recommendation
              </div>
              <p className="font-medium text-purple-900">{item.source}</p>
            </div>
          )}

          {/* Notes */}
          {item.notes && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                Notes
              </div>
              <p className="whitespace-pre-wrap">{item.notes}</p>
            </div>
          )}

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm"
                  style={{
                    backgroundColor: `${getTagColor(tag)}20`,
                    color: getTagColor(tag),
                  }}
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Children summary */}
          {item.children && item.children.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-sm text-muted-foreground">
                {item.children.length} sub-item{item.children.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
