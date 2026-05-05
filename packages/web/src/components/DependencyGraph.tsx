import { useState, useMemo, useEffect } from 'react'
import { GitBranch, CheckCircle, Clock, ChevronRight, ChevronDown, Lock, Circle, Expand, Minimize2, ArrowDown, ArrowUp, Target, X, LayoutGrid, List } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Task } from '@/types'
import { cn } from '@/lib/utils'

interface DependencyGraphProps {
  tasks: Task[]
  onSelectTask?: (task: Task) => void
}

interface TaskNode {
  task: Task
  depth: number
  dependents: string[] // Tasks that depend on this task
  blockedBy: Task[] // Tasks that block this task (dependencies)
  isBlocked: boolean
}

export function DependencyGraph({ tasks, onSelectTask }: DependencyGraphProps) {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'tree' | 'chains' | 'blocked' | 'focus'>('tree')
  const [focusedTask, setFocusedTask] = useState<Task | null>(null)
  const [focusViewStyle, setFocusViewStyle] = useState<'list' | 'diagram'>('list')

  // Build dependency graph
  const { nodes, rootNodes, blockedTasks, blockingTasks, dependencyChains } = useMemo(() => {
    const nodeMap = new Map<string, TaskNode>()
    const roots: string[] = []
    const blocked: Task[] = []
    const blocking: Task[] = []

    // Initialize nodes
    tasks.forEach((task) => {
      const dependents = tasks
        .filter((t) => t.dependencies?.includes(task.id))
        .map((t) => t.id)

      const blockedByTasks = (task.dependencies || [])
        .map((depId) => tasks.find((t) => t.id === depId))
        .filter((t): t is Task => !!t)

      const isBlocked = blockedByTasks.some((t) => t.status !== 'completed')

      nodeMap.set(task.id, {
        task,
        depth: 0,
        dependents,
        blockedBy: blockedByTasks,
        isBlocked,
      })

      // Root = task with no dependencies but has dependents (or has dependencies itself)
      if (!task.dependencies || task.dependencies.length === 0) {
        if (dependents.length > 0) {
          roots.push(task.id)
        }
      }

      if (isBlocked && task.status !== 'completed') {
        blocked.push(task)
      }

      if (dependents.length > 0 && task.status !== 'completed') {
        blocking.push(task)
      }
    })

    // Calculate depths using BFS
    const visited = new Set<string>()
    const queue: { id: string; depth: number }[] = roots.map((id) => ({ id, depth: 0 }))

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)

      const node = nodeMap.get(id)
      if (node) {
        node.depth = depth
        node.dependents.forEach((depId) => {
          queue.push({ id: depId, depth: depth + 1 })
        })
      }
    }

    // Build dependency chains (for chain view)
    const chains: Task[][] = []
    const usedInChain = new Set<string>()

    // Find all leaf nodes (tasks with dependencies but no dependents)
    const leafNodes = tasks.filter(
      (t) => t.dependencies && t.dependencies.length > 0 && !nodeMap.get(t.id)?.dependents.length
    )

    // Build chains from leaves back to roots
    leafNodes.forEach((leaf) => {
      const chain: Task[] = [leaf]
      let current = leaf

      while (current.dependencies && current.dependencies.length > 0) {
        // Follow the first dependency (for linear chains)
        const parentId = current.dependencies[0]
        const parent = tasks.find((t) => t.id === parentId)
        if (parent && !chain.includes(parent)) {
          chain.unshift(parent)
          current = parent
        } else {
          break
        }
      }

      // Only add chains with more than 1 task
      if (chain.length > 1) {
        chain.forEach((t) => usedInChain.add(t.id))
        chains.push(chain)
      }
    })

    return {
      nodes: nodeMap,
      rootNodes: roots.map((id) => nodeMap.get(id)!).filter(Boolean),
      blockedTasks: blocked,
      blockingTasks: blocking,
      dependencyChains: chains,
    }
  }, [tasks])

  const tasksWithDependencies = tasks.filter(
    (t) => (t.dependencies && t.dependencies.length > 0) || nodes.get(t.id)?.dependents.length
  )

  // Auto-expand all root nodes on mount
  useEffect(() => {
    if (rootNodes.length > 0 && expandedTasks.size === 0) {
      const allIds = new Set<string>()
      const collectAll = (nodeId: string) => {
        allIds.add(nodeId)
        const node = nodes.get(nodeId)
        if (node) {
          node.dependents.forEach(collectAll)
        }
      }
      rootNodes.forEach((node) => collectAll(node.task.id))
      setExpandedTasks(allIds)
    }
  }, [rootNodes, nodes])

  const toggleExpand = (taskId: string) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const expandAll = () => {
    const allIds = new Set<string>()
    tasksWithDependencies.forEach((t) => allIds.add(t.id))
    setExpandedTasks(allIds)
  }

  const collapseAll = () => {
    setExpandedTasks(new Set())
  }

  // Get all dependencies recursively (what this task needs to be done first)
  const getAllDependencies = (taskId: string, visited = new Set<string>()): Task[] => {
    if (visited.has(taskId)) return []
    visited.add(taskId)

    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.dependencies) return []

    const deps: Task[] = []
    for (const depId of task.dependencies) {
      const depTask = tasks.find(t => t.id === depId)
      if (depTask) {
        deps.push(depTask)
        deps.push(...getAllDependencies(depId, visited))
      }
    }
    return deps
  }

  // Get all dependents recursively (what tasks need this to be done)
  const getAllDependents = (taskId: string, visited = new Set<string>()): Task[] => {
    if (visited.has(taskId)) return []
    visited.add(taskId)

    const node = nodes.get(taskId)
    if (!node) return []

    const deps: Task[] = []
    for (const depId of node.dependents) {
      const depTask = tasks.find(t => t.id === depId)
      if (depTask) {
        deps.push(depTask)
        deps.push(...getAllDependents(depId, visited))
      }
    }
    return deps
  }

  const handleFocusTask = (task: Task) => {
    setFocusedTask(task)
    setViewMode('focus')
  }

  const getStatusIcon = (task: Task, isBlocked: boolean, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
    if (task.status === 'completed') {
      return <CheckCircle className={cn(sizeClass, "text-green-500")} />
    }
    if (isBlocked) {
      return <Lock className={cn(sizeClass, "text-amber-500")} />
    }
    if (task.status === 'in_progress') {
      return <Clock className={cn(sizeClass, "text-blue-500")} />
    }
    return <Circle className={cn(sizeClass, "text-muted-foreground")} />
  }

  const getStatusBadge = (task: Task, isBlocked: boolean) => {
    if (task.status === 'completed') {
      return <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Done</Badge>
    }
    if (isBlocked) {
      return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Blocked</Badge>
    }
    if (task.status === 'in_progress') {
      return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>
    }
    return <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Ready</Badge>
  }

  const renderTaskNode = (node: TaskNode, depth: number = 0, isLast: boolean = true, parentLines: boolean[] = []) => {
    const isExpanded = expandedTasks.has(node.task.id)
    const hasChildren = node.dependents.length > 0

    return (
      <div key={node.task.id} className="relative">
        {/* Tree lines */}
        <div className="flex">
          {/* Vertical lines from parents */}
          {parentLines.map((showLine, i) => (
            <div key={i} className="w-6 flex-shrink-0 relative">
              {showLine && (
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
              )}
            </div>
          ))}

          {/* Current level connector */}
          {depth > 0 && (
            <div className="w-6 flex-shrink-0 relative">
              <div className={cn(
                "absolute left-3 w-3 border-l border-b border-border rounded-bl",
                isLast ? "top-0 h-4" : "top-0 bottom-0"
              )} />
              {!isLast && (
                <div className="absolute left-3 top-4 bottom-0 w-px bg-border" />
              )}
            </div>
          )}

          {/* Task content */}
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg border transition-all cursor-pointer group",
                "hover:shadow-md hover:border-primary/50",
                node.isBlocked && node.task.status !== 'completed'
                  ? "border-amber-300 bg-gradient-to-r from-amber-50 to-transparent dark:border-amber-800 dark:from-amber-950/50"
                  : "hover:bg-accent/50",
                node.task.status === 'completed' && "opacity-60"
              )}
              onClick={() => onSelectTask?.(node.task)}
            >
              {hasChildren ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(node.task.id)
                  }}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <span className="w-6" />
              )}

              {getStatusIcon(node.task, node.isBlocked)}

              <span className={cn(
                "flex-1 text-sm font-medium truncate",
                node.task.status === 'completed' && "line-through text-muted-foreground"
              )}>
                {node.task.title}
              </span>

              {getStatusBadge(node.task, node.isBlocked)}

              {hasChildren && (
                <Badge variant="outline" className="text-xs font-normal">
                  → {node.dependents.length}
                </Badge>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleFocusTask(node.task)
                }}
                className="p-1 hover:bg-accent rounded-md transition-colors opacity-0 group-hover:opacity-100"
                title="Focus on this task"
              >
                <Target className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
              </button>
            </div>

            {/* Show what this task is blocked by */}
            {node.blockedBy.length > 0 && node.isBlocked && node.task.status !== 'completed' && (
              <div className="ml-8 mt-1 text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                <Lock className="h-3 w-3 text-amber-500" />
                <span>Needs:</span>
                {node.blockedBy.filter(d => d.status !== 'completed').map((dep, idx, arr) => (
                  <span key={dep.id}>
                    <span
                      className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectTask?.(dep)
                      }}
                    >
                      {dep.title}
                    </span>
                    {idx < arr.length - 1 && <span className="text-muted-foreground">, </span>}
                  </span>
                ))}
              </div>
            )}

            {/* Render children */}
            {hasChildren && isExpanded && (
              <div className="mt-1">
                {node.dependents.map((depId, idx) => {
                  const childNode = nodes.get(depId)
                  if (!childNode) return null
                  const isLastChild = idx === node.dependents.length - 1
                  return renderTaskNode(
                    childNode,
                    depth + 1,
                    isLastChild,
                    [...parentLines, !isLast]
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderChainView = () => {
    if (dependencyChains.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No dependency chains found</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {dependencyChains.map((chain, chainIdx) => (
          <div key={chainIdx} className="relative">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
              <GitBranch className="h-3 w-3" />
              Chain {chainIdx + 1} ({chain.length} tasks)
            </div>
            <div className="flex flex-col items-stretch">
              {chain.map((task, idx) => {
                const node = nodes.get(task.id)
                const isBlocked = node?.isBlocked || false

                return (
                  <div key={task.id} className="relative">
                    {/* Connector line */}
                    {idx > 0 && (
                      <div className="flex justify-center py-1">
                        <div className="flex flex-col items-center">
                          <ArrowDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    )}

                    {/* Task card */}
                    <div
                      className={cn(
                        "p-3 rounded-lg border-2 transition-all cursor-pointer",
                        "hover:shadow-lg hover:border-primary",
                        task.status === 'completed'
                          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                          : isBlocked
                            ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700"
                            : "bg-card border-border hover:bg-accent/30"
                      )}
                      onClick={() => onSelectTask?.(task)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full",
                          task.status === 'completed'
                            ? "bg-green-100 dark:bg-green-900"
                            : isBlocked
                              ? "bg-amber-100 dark:bg-amber-900"
                              : "bg-primary/10"
                        )}>
                          {getStatusIcon(task, isBlocked, 'md')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            "font-medium truncate",
                            task.status === 'completed' && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Step {idx + 1} of {chain.length}
                          </div>
                        </div>
                        {getStatusBadge(task, isBlocked)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderFocusView = () => {
    if (!focusedTask) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Click on any task to see its dependencies</p>
          <p className="text-sm mt-2">Select a task from Tree or Blocked view</p>
        </div>
      )
    }

    const dependencies = getAllDependencies(focusedTask.id)
    const dependents = getAllDependents(focusedTask.id)
    const node = nodes.get(focusedTask.id)
    const isBlocked = node?.isBlocked || false

    // Organize dependencies by depth (direct vs indirect)
    const directDeps = (focusedTask.dependencies || [])
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => !!t)
    const indirectDeps = dependencies.filter(t => !directDeps.some(d => d.id === t.id))

    // Organize dependents by depth
    const directDependents = (node?.dependents || [])
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => !!t)
    const indirectDependents = dependents.filter(t => !directDependents.some(d => d.id === t.id))

    const renderTaskPill = (task: Task, showStatus = true) => {
      const taskNode = nodes.get(task.id)
      const taskBlocked = taskNode?.isBlocked || false
      return (
        <div
          key={task.id}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all",
            "hover:shadow-md hover:border-primary/50",
            task.status === 'completed'
              ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800 opacity-70"
              : taskBlocked
                ? "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-700"
                : "bg-card border-border hover:bg-accent/30"
          )}
          onClick={() => {
            setFocusedTask(task)
          }}
        >
          {getStatusIcon(task, taskBlocked)}
          <span className={cn(
            "text-sm font-medium truncate flex-1",
            task.status === 'completed' && "line-through text-muted-foreground"
          )}>
            {task.title}
          </span>
          {showStatus && getStatusBadge(task, taskBlocked)}
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Focused Task Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFocusedTask(null)
              setViewMode('tree')
            }}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Close Focus View
          </Button>
          <div className="flex border rounded-md">
            <Button
              variant={focusViewStyle === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFocusViewStyle('list')}
              className="rounded-r-none h-7 px-2 text-xs"
            >
              <List className="h-3 w-3 mr-1" />
              List
            </Button>
            <Button
              variant={focusViewStyle === 'diagram' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFocusViewStyle('diagram')}
              className="rounded-l-none h-7 px-2 text-xs"
            >
              <LayoutGrid className="h-3 w-3 mr-1" />
              Diagram
            </Button>
          </div>
        </div>

        {/* Diagram View */}
        {focusViewStyle === 'diagram' ? (
          <div className="flex flex-col items-center space-y-4 py-4">
            {/* Dependencies Section (Top) */}
            {dependencies.length > 0 && (
              <div className="w-full max-w-2xl">
                <div className="text-xs text-muted-foreground text-center mb-3 flex items-center justify-center gap-2">
                  <ArrowUp className="h-3 w-3" />
                  Dependencies (must complete first)
                </div>

                {/* Indirect Dependencies */}
                {indirectDeps.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    {indirectDeps.map(task => {
                      const taskNode = nodes.get(task.id)
                      const taskBlocked = taskNode?.isBlocked || false
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm",
                            "hover:shadow-md hover:scale-105",
                            task.status === 'completed'
                              ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700 opacity-70"
                              : taskBlocked
                                ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-600"
                                : "bg-card border-gray-300 dark:border-gray-600"
                          )}
                          onClick={() => setFocusedTask(task)}
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task, taskBlocked)}
                            <span className={cn(
                              "truncate max-w-32",
                              task.status === 'completed' && "line-through"
                            )}>{task.title}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Connector line */}
                {indirectDeps.length > 0 && directDeps.length > 0 && (
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-amber-400 dark:bg-amber-600" />
                      <ArrowDown className="h-4 w-4 text-amber-400 dark:text-amber-600" />
                    </div>
                  </div>
                )}

                {/* Direct Dependencies */}
                {directDeps.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {directDeps.map(task => {
                      const taskNode = nodes.get(task.id)
                      const taskBlocked = taskNode?.isBlocked || false
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all",
                            "hover:shadow-lg hover:scale-105 font-medium",
                            task.status === 'completed'
                              ? "bg-green-100 border-green-400 dark:bg-green-900/50 dark:border-green-600"
                              : taskBlocked
                                ? "bg-amber-100 border-amber-400 dark:bg-amber-900/50 dark:border-amber-500"
                                : "bg-emerald-50 border-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-600"
                          )}
                          onClick={() => setFocusedTask(task)}
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task, taskBlocked, 'md')}
                            <span className={cn(
                              task.status === 'completed' && "line-through"
                            )}>{task.title}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Arrow down to focused task */}
                <div className="flex justify-center py-3">
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-amber-400 dark:bg-amber-600" />
                    <ArrowDown className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                  </div>
                </div>
              </div>
            )}

            {/* Focused Task (Center) */}
            <div className={cn(
              "px-6 py-4 rounded-2xl border-4 shadow-xl cursor-pointer transition-all",
              "hover:shadow-2xl min-w-64 max-w-md",
              isBlocked
                ? "border-amber-500 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/50"
                : focusedTask.status === 'completed'
                  ? "border-green-500 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50"
                  : "border-primary bg-gradient-to-br from-primary/10 to-primary/20 dark:from-primary/20 dark:to-primary/30"
            )}
            onClick={() => onSelectTask?.(focusedTask)}
            >
              <div className="flex items-center gap-3 justify-center">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full",
                  isBlocked
                    ? "bg-amber-200 dark:bg-amber-800"
                    : focusedTask.status === 'completed'
                      ? "bg-green-200 dark:bg-green-800"
                      : "bg-primary/20"
                )}>
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <div className={cn(
                    "font-bold text-lg",
                    focusedTask.status === 'completed' && "line-through text-muted-foreground"
                  )}>
                    {focusedTask.title}
                  </div>
                  <div className="mt-1">
                    {getStatusBadge(focusedTask, isBlocked)}
                  </div>
                </div>
              </div>
            </div>

            {/* Dependents Section (Bottom) */}
            {dependents.length > 0 && (
              <div className="w-full max-w-2xl">
                {/* Arrow down from focused task */}
                <div className="flex justify-center py-3">
                  <div className="flex flex-col items-center">
                    <ArrowDown className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                    <div className="w-px h-6 bg-blue-400 dark:bg-blue-600" />
                  </div>
                </div>

                {/* Direct Dependents */}
                {directDependents.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2">
                    {directDependents.map(task => {
                      const taskNode = nodes.get(task.id)
                      const taskBlocked = taskNode?.isBlocked || false
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all",
                            "hover:shadow-lg hover:scale-105 font-medium",
                            task.status === 'completed'
                              ? "bg-green-100 border-green-400 dark:bg-green-900/50 dark:border-green-600"
                              : taskBlocked
                                ? "bg-amber-100 border-amber-400 dark:bg-amber-900/50 dark:border-amber-500"
                                : "bg-blue-50 border-blue-400 dark:bg-blue-900/30 dark:border-blue-600"
                          )}
                          onClick={() => setFocusedTask(task)}
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task, taskBlocked, 'md')}
                            <span className={cn(
                              task.status === 'completed' && "line-through"
                            )}>{task.title}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Connector line */}
                {directDependents.length > 0 && indirectDependents.length > 0 && (
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center">
                      <ArrowDown className="h-4 w-4 text-blue-400 dark:text-blue-600" />
                      <div className="w-px h-4 bg-blue-400 dark:bg-blue-600" />
                    </div>
                  </div>
                )}

                {/* Indirect Dependents */}
                {indirectDependents.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-3">
                    {indirectDependents.map(task => {
                      const taskNode = nodes.get(task.id)
                      const taskBlocked = taskNode?.isBlocked || false
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm",
                            "hover:shadow-md hover:scale-105",
                            task.status === 'completed'
                              ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700 opacity-70"
                              : taskBlocked
                                ? "bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-600"
                                : "bg-card border-gray-300 dark:border-gray-600"
                          )}
                          onClick={() => setFocusedTask(task)}
                        >
                          <div className="flex items-center gap-2">
                            {getStatusIcon(task, taskBlocked)}
                            <span className={cn(
                              "truncate max-w-32",
                              task.status === 'completed' && "line-through"
                            )}>{task.title}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-2">
                  <ArrowDown className="h-3 w-3" />
                  Dependents (waiting for this)
                </div>
              </div>
            )}

            {/* No dependencies or dependents */}
            {dependencies.length === 0 && dependents.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                This task has no dependencies and nothing depends on it.
              </div>
            )}
          </div>
        ) : (
          /* List View (Original) */
          <>
            {/* Focused Task */}
            <div className="relative">
              <div className={cn(
                "p-4 rounded-xl border-2 shadow-lg",
                isBlocked
                  ? "border-amber-400 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950/50 dark:via-background dark:to-amber-950/50"
                  : focusedTask.status === 'completed'
                    ? "border-green-400 bg-gradient-to-r from-green-50 via-white to-green-50 dark:from-green-950/50 dark:via-background dark:to-green-950/50"
                    : "border-primary bg-gradient-to-r from-primary/5 via-white to-primary/5 dark:via-background"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-12 h-12 rounded-full",
                    isBlocked
                      ? "bg-amber-100 dark:bg-amber-900"
                      : focusedTask.status === 'completed'
                        ? "bg-green-100 dark:bg-green-900"
                        : "bg-primary/10"
                  )}>
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-semibold text-lg",
                      focusedTask.status === 'completed' && "line-through text-muted-foreground"
                    )}>
                      {focusedTask.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(focusedTask, isBlocked)}
                      {dependencies.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Needs {dependencies.length} task{dependencies.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {dependents.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Blocks {dependents.length} task{dependents.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectTask?.(focusedTask)}
                  >
                    Edit Task
                  </Button>
                </div>
              </div>
            </div>

            {/* Dependencies (What this task needs) */}
            {dependencies.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <ArrowUp className="h-4 w-4" />
                  <span>Dependencies (must complete first)</span>
                </div>

                {directDeps.length > 0 && (
                  <div className="space-y-2 ml-6">
                    <div className="text-xs text-muted-foreground font-medium">Direct dependencies:</div>
                    <div className="grid gap-2">
                      {directDeps.map(task => renderTaskPill(task))}
                    </div>
                  </div>
                )}

                {indirectDeps.length > 0 && (
                  <div className="space-y-2 ml-6">
                    <div className="text-xs text-muted-foreground font-medium">Indirect dependencies:</div>
                    <div className="grid gap-2">
                      {indirectDeps.map(task => renderTaskPill(task))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dependents (What needs this task) */}
            {dependents.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                  <ArrowDown className="h-4 w-4" />
                  <span>Dependents (waiting for this)</span>
                </div>

                {directDependents.length > 0 && (
                  <div className="space-y-2 ml-6">
                    <div className="text-xs text-muted-foreground font-medium">Direct dependents:</div>
                    <div className="grid gap-2">
                      {directDependents.map(task => renderTaskPill(task))}
                    </div>
                  </div>
                )}

                {indirectDependents.length > 0 && (
                  <div className="space-y-2 ml-6">
                    <div className="text-xs text-muted-foreground font-medium">Indirect dependents:</div>
                    <div className="grid gap-2">
                      {indirectDependents.map(task => renderTaskPill(task))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No dependencies or dependents */}
            {dependencies.length === 0 && dependents.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                This task has no dependencies and nothing depends on it.
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  if (tasksWithDependencies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            Task Dependencies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No task dependencies defined</p>
            <p className="text-sm mt-2">
              Add dependencies when creating tasks to see the dependency graph
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Task Dependencies
          </CardTitle>
          <div className="flex items-center gap-2">
            {viewMode === 'tree' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={expandAll}
                  className="h-7 px-2 text-xs"
                >
                  <Expand className="h-3 w-3 mr-1" />
                  Expand
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={collapseAll}
                  className="h-7 px-2 text-xs"
                >
                  <Minimize2 className="h-3 w-3 mr-1" />
                  Collapse
                </Button>
              </>
            )}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('tree')}
                className="rounded-r-none h-7 px-2 text-xs"
              >
                Tree
              </Button>
              <Button
                variant={viewMode === 'chains' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('chains')}
                className="rounded-none border-x h-7 px-2 text-xs"
              >
                Chains
              </Button>
              <Button
                variant={viewMode === 'blocked' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('blocked')}
                className="rounded-none border-r h-7 px-2 text-xs"
              >
                Blocked ({blockedTasks.length})
              </Button>
              <Button
                variant={viewMode === 'focus' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('focus')}
                className="rounded-l-none h-7 px-2 text-xs"
              >
                <Target className="h-3 w-3 mr-1" />
                Focus
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'tree' ? (
          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pb-3 border-b">
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                {blockingTasks.filter((t) => t.status === 'completed').length} completed
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                {blockedTasks.length} blocked
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                {tasksWithDependencies.filter(t => !nodes.get(t.id)?.isBlocked && t.status !== 'completed').length} ready
              </span>
            </div>

            {/* Tree */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {rootNodes.length > 0 ? (
                rootNodes.map((node, idx) => renderTaskNode(node, 0, idx === rootNodes.length - 1, []))
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No root tasks found. All tasks with dependencies have parents.
                </div>
              )}
            </div>
          </div>
        ) : viewMode === 'chains' ? (
          <div className="max-h-[500px] overflow-y-auto pr-2">
            {renderChainView()}
          </div>
        ) : viewMode === 'focus' ? (
          <div className="max-h-[500px] overflow-y-auto pr-2">
            {renderFocusView()}
          </div>
        ) : (
          <div className="space-y-2">
            {blockedTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                <p>No blocked tasks!</p>
                <p className="text-sm mt-2">All dependencies are satisfied</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {blockedTasks.map((task) => {
                  const node = nodes.get(task.id)
                  if (!node) return null

                  const pendingDeps = node.blockedBy.filter(d => d.status !== 'completed')
                  const completedDeps = node.blockedBy.filter(d => d.status === 'completed')

                  return (
                    <div
                      key={task.id}
                      className="p-4 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-transparent dark:border-amber-700 dark:from-amber-950/50 cursor-pointer hover:shadow-md hover:border-amber-400 transition-all"
                      onClick={() => onSelectTask?.(task)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900">
                          <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{task.title}</div>
                          <div className="text-sm text-muted-foreground">
                            Waiting for {pendingDeps.length} task{pendingDeps.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                          Blocked
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleFocusTask(task)
                          }}
                          className="h-7 px-2"
                        >
                          <Target className="h-3 w-3 mr-1" />
                          Focus
                        </Button>
                      </div>

                      <div className="mt-3 space-y-2">
                        {pendingDeps.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {pendingDeps.map((dep) => (
                              <span
                                key={dep.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectTask?.(dep)
                                }}
                              >
                                <Clock className="h-3 w-3" />
                                {dep.title}
                              </span>
                            ))}
                          </div>
                        )}
                        {completedDeps.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {completedDeps.map((dep) => (
                              <span
                                key={dep.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-medium line-through opacity-60"
                              >
                                <CheckCircle className="h-3 w-3" />
                                {dep.title}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
