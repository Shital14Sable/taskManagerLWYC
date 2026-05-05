import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

// Help annotation data - can be extended for tooltip mode later
export interface HelpAnnotation {
  id: string
  selector: string // CSS selector for the element
  title: string
  description: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

// Registry of help annotations for different views
export const helpAnnotations: Record<string, HelpAnnotation[]> = {
  global: [
    {
      id: 'quick-capture',
      selector: '[data-help="quick-capture"]',
      title: 'Quick Capture',
      description: 'Type natural language like "Meeting tomorrow 2h high priority" to quickly add tasks. Supports dates, times, priority, and energy levels.',
      position: 'bottom',
    },
    {
      id: 'today-view',
      selector: '[data-help="today-view"]',
      title: 'Today View',
      description: 'Your daily schedule showing tasks organized by time blocks based on your energy patterns.',
      position: 'bottom',
    },
    {
      id: 'inbox',
      selector: '[data-help="inbox"]',
      title: 'Inbox',
      description: 'Tasks captured quickly that need to be reviewed and organized into projects.',
      position: 'bottom',
    },
    {
      id: 'reschedule',
      selector: '[data-help="reschedule"]',
      title: 'Reschedule',
      description: 'Automatically plans your tasks based on priority, deadlines, and your configured energy patterns.',
      position: 'bottom',
    },
    {
      id: 'sync',
      selector: '[data-help="sync"]',
      title: 'Sync',
      description: 'Sync your data across devices using GitHub or Google Drive.',
      position: 'bottom',
    },
    {
      id: 'settings',
      selector: '[data-help="settings"]',
      title: 'Settings',
      description: 'Configure work hours, energy patterns, sync, and access documentation.',
      position: 'left',
    },
    {
      id: 'global-search',
      selector: '[data-help="global-search"]',
      title: 'Global Search (Cmd/Ctrl+K)',
      description: 'Quickly find any task, project, or habit. Use keyboard shortcut for faster access.',
      position: 'bottom',
    },
    {
      id: 'user-stats',
      selector: '[data-help="user-stats"]',
      title: 'Your Progress',
      description: 'Track your level, XP, and earned badges. Complete tasks to earn XP and unlock achievements!',
      position: 'bottom',
    },
    {
      id: 'energy-indicator',
      selector: '[data-help="energy-indicator"]',
      title: 'Energy Level',
      description: 'High energy (🔥) tasks are scheduled when you\'re most productive. Low energy (💤) tasks are for when you need lighter work.',
      position: 'right',
    },
  ],
  todayView: [
    {
      id: 'timeline',
      selector: '[data-help="timeline"]',
      title: 'Daily Timeline',
      description: 'Tasks are arranged by time blocks. The blue line shows current time. Tasks are color-coded by project.',
      position: 'right',
    },
  ],
  projects: [
    {
      id: 'project-card',
      selector: '[data-help="project-card"]',
      title: 'Project Card',
      description: 'Click to view project details, tasks, and analytics. The progress bar shows completion percentage.',
      position: 'right',
    },
  ],
}

interface HelpModeContextValue {
  isHelpModeActive: boolean
  toggleHelpMode: () => void
  enableHelpMode: () => void
  disableHelpMode: () => void
  currentView: string
  setCurrentView: (view: string) => void
  getAnnotationsForView: (view: string) => HelpAnnotation[]
}

const HelpModeContext = createContext<HelpModeContextValue | null>(null)

export function HelpModeProvider({ children }: { children: React.ReactNode }) {
  const [isHelpModeActive, setIsHelpModeActive] = useState(false)
  const [currentView, setCurrentView] = useState('global')

  const toggleHelpMode = useCallback(() => {
    setIsHelpModeActive(prev => !prev)
  }, [])

  const enableHelpMode = useCallback(() => {
    setIsHelpModeActive(true)
  }, [])

  const disableHelpMode = useCallback(() => {
    setIsHelpModeActive(false)
  }, [])

  const getAnnotationsForView = useCallback((view: string): HelpAnnotation[] => {
    const globalAnnotations = helpAnnotations.global || []
    const viewAnnotations = helpAnnotations[view] || []
    return [...globalAnnotations, ...viewAnnotations]
  }, [])

  // Keyboard shortcut for help mode (Shift + ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger help mode when typing in input fields
      const target = e.target as HTMLElement
      const isTyping = target.tagName === 'INPUT' ||
                       target.tagName === 'TEXTAREA' ||
                       target.isContentEditable ||
                       target.closest('[contenteditable="true"]')

      // Check for Shift + ? (which is Shift + /)
      if (e.shiftKey && e.key === '?' && !isTyping) {
        e.preventDefault()
        toggleHelpMode()
      }
      // Escape to close help mode
      if (e.key === 'Escape' && isHelpModeActive) {
        disableHelpMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isHelpModeActive, toggleHelpMode, disableHelpMode])

  const value: HelpModeContextValue = {
    isHelpModeActive,
    toggleHelpMode,
    enableHelpMode,
    disableHelpMode,
    currentView,
    setCurrentView,
    getAnnotationsForView,
  }

  return (
    <HelpModeContext.Provider value={value}>
      {children}
    </HelpModeContext.Provider>
  )
}

export function useHelpMode() {
  const context = useContext(HelpModeContext)
  if (!context) {
    throw new Error('useHelpMode must be used within a HelpModeProvider')
  }
  return context
}
