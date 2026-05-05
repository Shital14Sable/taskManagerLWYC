import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, X, FileText, FolderOpen, Repeat, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { searchApi } from '@/api/client'
import type { SearchResult } from '@/types'
import { cn } from '@/lib/utils'

interface GlobalSearchProps {
  onSelectTask?: (taskId: string) => void
  onSelectProject?: (projectId: string) => void
  onSelectHabit?: (habitId: string) => void
}

export function GlobalSearch({ onSelectTask, onSelectProject, onSelectHabit }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  // Keyboard shortcut to open search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await searchApi.search(query, { limit: 10 })
        setResults(response.results)
        setSelectedIndex(0)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [query])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        handleSelect(results[selectedIndex])
      }
    },
    [results, selectedIndex]
  )

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'project') {
      onSelectProject?.(result.id)
    } else if (result.type === 'habit') {
      onSelectHabit?.(result.id)
    } else {
      onSelectTask?.(result.id)
    }
    setIsOpen(false)
    setQuery('')
    setResults([])
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <FolderOpen className="h-4 w-4 text-blue-500" />
      case 'habit':
        return <Repeat className="h-4 w-4 text-orange-500" />
      default:
        return <FileText className="h-4 w-4 text-gray-500" />
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 5) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    if (priority >= 4) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    if (priority >= 3) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setIsOpen(true)}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex ml-2 pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={() => {
          setIsOpen(false)
          setQuery('')
          setResults([])
        }}
      />

      {/* Search Dialog */}
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-50">
        <div className="bg-background border rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, projects, habits..."
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => {
                setIsOpen(false)
                setQuery('')
                setResults([])
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Results */}
          <div ref={resultsRef} className="max-h-[300px] overflow-y-auto">
            {query && results.length === 0 && !loading && (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No results found for "{query}"
              </div>
            )}

            {results.map((result, index) => (
              <div
                key={`${result.type}-${result.id}`}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 cursor-pointer',
                  index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/50'
                )}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {getIcon(result.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{result.title}</span>
                    {result.type === 'task' && (
                      <Badge variant="outline" className={cn('text-xs', getPriorityColor(result.priority))}>
                        P{result.priority}
                      </Badge>
                    )}
                  </div>
                  {result.project_name && (
                    <div className="text-xs text-muted-foreground truncate">
                      {result.project_name}
                    </div>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs capitalize shrink-0">
                  {result.type}
                </Badge>
              </div>
            ))}
          </div>

          {/* Footer with keyboard hints */}
          {results.length > 0 && (
            <div className="border-t px-3 py-2 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1 bg-muted rounded">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 bg-muted rounded">↵</kbd> select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 bg-muted rounded">esc</kbd> close
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default GlobalSearch
