import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  suggestions?: string[]
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  suggestions,
  action,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-12 px-6",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted/50 flex items-center justify-center mb-4",
          compact ? "h-12 w-12" : "h-16 w-16"
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground/70",
            compact ? "h-6 w-6" : "h-8 w-8"
          )}
        />
      </div>

      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-base" : "text-lg"
        )}
      >
        {title}
      </h3>

      <p
        className={cn(
          "text-muted-foreground max-w-md mt-1",
          compact ? "text-sm" : "text-base"
        )}
      >
        {description}
      </p>

      {suggestions && suggestions.length > 0 && (
        <div className="mt-4 text-left max-w-sm">
          <p className="text-sm text-muted-foreground mb-2">Try creating:</p>
          <ul className="space-y-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className="text-sm text-muted-foreground flex items-start gap-2"
              >
                <span className="text-primary mt-0.5">•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-6">
          {action && (
            <Button onClick={action.onClick} size={compact ? "sm" : "default"}>
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              size={compact ? "sm" : "default"}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Pre-configured empty states for common scenarios
export const emptyStateConfigs = {
  projects: {
    title: "No projects yet",
    description: "Projects help you organize related tasks together. Create your first project to get started!",
    suggestions: [
      '"Work Tasks" - for your job-related work',
      '"Personal Goals" - for self-improvement',
      '"Home Improvement" - for house projects',
    ],
  },
  tasks: {
    title: "No tasks yet",
    description: "Tasks are individual items you need to complete. Add tasks to stay organized and productive.",
    suggestions: [
      'Break down a project into smaller steps',
      'Add a quick task using the Quick Capture',
      'Set deadlines and priorities for important work',
    ],
  },
  habits: {
    title: "No habits yet",
    description: "Habits are recurring tasks that help build routines. They're automatically scheduled and track your streaks!",
    suggestions: [
      '"Morning Exercise" - Daily at 7am',
      '"Weekly Review" - Every Sunday',
      '"Read for 30 minutes" - Daily',
    ],
  },
  inbox: {
    title: "Inbox is empty",
    description: "Great job! All your captured tasks have been reviewed and organized.",
  },
  goals: {
    title: "No goals yet",
    description: "Goals help you track long-term objectives. Link projects to goals to automatically track progress.",
    suggestions: [
      'Set a yearly goal for career growth',
      'Create quarterly milestones',
      'Break down into monthly actionable goals',
    ],
  },
  notes: {
    title: "No notes yet",
    description: "Notes are for capturing ideas, meeting notes, or any information you want to save. They support Markdown!",
    suggestions: [
      'Create folders to organize by topic',
      'Use daily notes for journaling',
      'Link notes to tasks and projects',
    ],
  },
  lists: {
    title: "No lists yet",
    description: "Lists are for tracking items like movies to watch, books to read, or shopping lists.",
    suggestions: [
      '"Books to Read" - track your reading list',
      '"Movies to Watch" - save recommendations',
      '"Grocery List" - for shopping',
    ],
  },
  schedule: {
    title: "Nothing scheduled for today",
    description: "Click 'Reschedule' to automatically plan your day based on task priorities and your energy levels.",
  },
  paused: {
    title: "No paused items",
    description: "Paused projects, habits, and tasks will appear here. Pause items when you need to focus on other priorities.",
  },
  completed: {
    title: "No completed tasks yet",
    description: "Completed tasks will appear here. Start checking off items to see your progress!",
  },
}
