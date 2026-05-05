import { useState } from 'react'
import { ChevronRight, ChevronDown, FolderOpen, FolderPlus, Plus, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Folder item type for the selector
export type FolderItem = {
  name: string
  path: string
  subfolders: FolderItem[]
  count?: number
}

interface FolderSelectorProps {
  folders: FolderItem[]
  value: string
  onChange: (path: string) => void
  placeholder?: string
  allowCreate?: boolean
  className?: string
}

export function FolderSelector({
  folders,
  value,
  onChange,
  placeholder = 'Select folder...',
  allowCreate = true,
  className,
}: FolderSelectorProps) {
  const [open, setOpen] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderParent, setNewFolderParent] = useState<string | null>(null)

  const toggleExpanded = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleSelect = (path: string) => {
    onChange(path)
    setOpen(false)
  }

  const handleCreateFolder = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!newFolderName.trim()) return
    const newPath = newFolderParent
      ? `${newFolderParent}/${newFolderName.trim()}`
      : newFolderName.trim()
    onChange(newPath)
    setNewFolderName('')
    setNewFolderParent(null)
    setShowNewFolder(false)
    setOpen(false)
  }

  const startCreateSubfolder = (parentPath: string, e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setNewFolderParent(parentPath)
    setShowNewFolder(true)
  }

  const renderFolder = (folder: FolderItem, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.path)
    const isSelected = value === folder.path
    const hasSubfolders = folder.subfolders.length > 0

    return (
      <div key={folder.path}>
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer hover:bg-accent group",
            isSelected && "bg-primary/10 text-primary",
            depth > 0 && "ml-4"
          )}
          onClick={() => handleSelect(folder.path)}
        >
          {hasSubfolders ? (
            <button
              onClick={(e) => toggleExpanded(folder.path, e)}
              className="p-0.5 hover:bg-accent-foreground/10 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <span className="flex-1 truncate text-sm">{folder.name}</span>
          {isSelected && <Check className="h-4 w-4 text-primary" />}
          {allowCreate && (
            <button
              onClick={(e) => startCreateSubfolder(folder.path, e)}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-accent-foreground/10 rounded"
              title="Add subfolder"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>
        {isExpanded && hasSubfolders && (
          <div>
            {folder.subfolders.map(sub => renderFolder(sub, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between font-normal", className)}
        >
          <div className="flex items-center gap-2 truncate">
            {value ? (
              <>
                <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="truncate">{value}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[280px] p-2" align="start">
        {/* Root option */}
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent",
            !value && "bg-primary/10 text-primary"
          )}
          onClick={() => handleSelect('')}
        >
          <span className="w-4" />
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground italic">No folder (root)</span>
          {!value && <Check className="h-4 w-4 text-primary" />}
        </div>

        {/* Existing folders */}
        {folders.length > 0 && (
          <div className="mt-1 border-t pt-1 max-h-[200px] overflow-y-auto">
            {folders.map(folder => renderFolder(folder))}
          </div>
        )}

        {/* Create new folder section */}
        {allowCreate && (
          <div className="mt-2 border-t pt-2">
            {showNewFolder ? (
              <div className="space-y-2" onClick={e => e.stopPropagation()}>
                <div className="text-xs text-muted-foreground">
                  {newFolderParent ? `Creating in: ${newFolderParent}` : 'Creating root folder'}
                </div>
                <div className="flex gap-1">
                  <Input
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="h-8 text-sm"
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleCreateFolder(e as unknown as React.MouseEvent)
                      }
                      if (e.key === 'Escape') {
                        setShowNewFolder(false)
                        setNewFolderName('')
                        setNewFolderParent(null)
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                  >
                    Add
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowNewFolder(false)
                    setNewFolderName('')
                    setNewFolderParent(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-accent text-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setNewFolderParent(null)
                  setShowNewFolder(true)
                }}
              >
                <FolderPlus className="h-4 w-4" />
                Create new folder
              </div>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
