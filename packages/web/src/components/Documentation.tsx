import { useState } from 'react'
import {
  Rocket, Zap, Calendar, ListTodo, Repeat, Target, FileText,
  ListChecks, BarChart3, Keyboard, HelpCircle, RefreshCw,
  Flame, Moon, ChevronRight, Eye, Smile, BookOpen
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type DocSection =
  | 'overview'
  | 'quick-start'
  | 'tasks'
  | 'projects'
  | 'habits'
  | 'energy'
  | 'scheduling'
  | 'goals'
  | 'mood'
  | 'journal'
  | 'notes'
  | 'lists'
  | 'analytics'
  | 'keyboard'
  | 'help-mode'
  | 'faq'

interface DocNavItem {
  id: DocSection
  label: string
  icon: React.ReactNode
}

const navItems: DocNavItem[] = [
  { id: 'overview', label: 'Overview', icon: <Rocket className="h-4 w-4" /> },
  { id: 'quick-start', label: 'Quick Start', icon: <Zap className="h-4 w-4" /> },
  { id: 'tasks', label: 'Tasks', icon: <ListTodo className="h-4 w-4" /> },
  { id: 'projects', label: 'Projects', icon: <Calendar className="h-4 w-4" /> },
  { id: 'habits', label: 'Habits', icon: <Repeat className="h-4 w-4" /> },
  { id: 'energy', label: 'Energy Patterns', icon: <Flame className="h-4 w-4" /> },
  { id: 'scheduling', label: 'Smart Scheduling', icon: <RefreshCw className="h-4 w-4" /> },
  { id: 'goals', label: 'Goals', icon: <Target className="h-4 w-4" /> },
  { id: 'mood', label: 'Mood Tracking', icon: <Smile className="h-4 w-4" /> },
  { id: 'journal', label: 'Journal', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'notes', label: 'Notes', icon: <FileText className="h-4 w-4" /> },
  { id: 'lists', label: 'Lists', icon: <ListChecks className="h-4 w-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'keyboard', label: 'Keyboard Shortcuts', icon: <Keyboard className="h-4 w-4" /> },
  { id: 'help-mode', label: 'Help Mode', icon: <Eye className="h-4 w-4" /> },
  { id: 'faq', label: 'FAQ', icon: <HelpCircle className="h-4 w-4" /> },
]

export function Documentation() {
  const [activeSection, setActiveSection] = useState<DocSection>('overview')

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Welcome to TrackMind</h2>
            <p className="text-muted-foreground">
              TrackMind is a smart task manager that schedules your work based on your energy
              patterns. Unlike traditional to-do lists, TrackMind understands that your
              productivity varies throughout the day.
            </p>
            <div className="space-y-3">
              <h3 className="font-semibold">Key Features:</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Zap className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Energy-Based Scheduling:</strong> Tasks are scheduled when your energy matches their difficulty</span>
                </li>
                <li className="flex items-start gap-2">
                  <RefreshCw className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Smart Planning:</strong> Automatic scheduling based on priorities, deadlines, and dependencies</span>
                </li>
                <li className="flex items-start gap-2">
                  <Repeat className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Habit Tracking:</strong> Build routines with recurring tasks and streak tracking</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Goal Management:</strong> Set yearly, quarterly, and monthly goals with Vision Board visualization</span>
                </li>
                <li className="flex items-start gap-2">
                  <Smile className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Mood Tracking:</strong> Log your mood throughout the day and discover patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <BookOpen className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Journal:</strong> Daily journaling with prompts, mood integration, and reflection</span>
                </li>
                <li className="flex items-start gap-2">
                  <BarChart3 className="h-4 w-4 mt-0.5 text-primary" />
                  <span><strong>Analytics:</strong> Track your productivity patterns and earn achievements</span>
                </li>
              </ul>
            </div>
          </div>
        )

      case 'quick-start':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Quick Start Guide</h2>
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">1. Set Your Energy Patterns</h3>
                <p className="text-sm text-muted-foreground">
                  Go to Settings → Energy Patterns and configure when you're most productive.
                  Morning person? Set mornings to "High Energy". This helps TrackMind schedule
                  demanding tasks at the right time.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">2. Create a Project</h3>
                <p className="text-sm text-muted-foreground">
                  Click "New Project" to create your first project. Projects help organize
                  related tasks together.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">3. Add Tasks</h3>
                <p className="text-sm text-muted-foreground">
                  Use Quick Capture for fast entry with natural language, or click "New Task"
                  for detailed task creation. Set priority, energy level, and time estimate.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">4. Click Reschedule</h3>
                <p className="text-sm text-muted-foreground">
                  In the Today view, click "Reschedule" to have TrackMind automatically plan
                  your day based on all your tasks and energy patterns.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">5. Complete Tasks & Earn XP</h3>
                <p className="text-sm text-muted-foreground">
                  Check off tasks as you complete them. You'll earn XP and can unlock badges!
                </p>
              </div>
            </div>
          </div>
        )

      case 'tasks':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Tasks</h2>
            <p className="text-muted-foreground">
              Tasks are the core of TrackMind. Each task can have:
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium">Priority (1-5)</h4>
                <p className="text-muted-foreground">1 = Low, 5 = Critical. Higher priority tasks are scheduled first.</p>
              </div>
              <div>
                <h4 className="font-medium">Energy Level</h4>
                <p className="text-muted-foreground">
                  <Flame className="inline h-3 w-3 text-orange-500" /> High: Complex, demanding work<br />
                  <Zap className="inline h-3 w-3 text-yellow-500" /> Medium: Regular tasks<br />
                  <Moon className="inline h-3 w-3 text-blue-400" /> Low: Routine, easy tasks
                </p>
              </div>
              <div>
                <h4 className="font-medium">Time Estimate</h4>
                <p className="text-muted-foreground">How long you expect the task to take. Used for scheduling.</p>
              </div>
              <div>
                <h4 className="font-medium">Dependencies</h4>
                <p className="text-muted-foreground">Link tasks that must be completed first. Dependent tasks won't be scheduled until prerequisites are done.</p>
              </div>
              <div>
                <h4 className="font-medium">Deadline</h4>
                <p className="text-muted-foreground">Optional due date. Tasks with closer deadlines get priority.</p>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-1">Quick Capture</h4>
              <p className="text-sm text-muted-foreground">
                Use natural language like: "Review report tomorrow 2h high priority"<br />
                Parsed as: Due tomorrow, 2 hours, Priority: High
              </p>
            </div>
          </div>
        )

      case 'projects':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Projects</h2>
            <p className="text-muted-foreground">
              Projects help you organize related tasks together. They can be in different statuses:
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs">Active</span>
                <span className="text-muted-foreground">Currently being worked on</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-500/20 text-gray-600 rounded text-xs">Paused</span>
                <span className="text-muted-foreground">Temporarily on hold</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-500/20 text-blue-600 rounded text-xs">Completed</span>
                <span className="text-muted-foreground">All tasks done</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-300/20 text-gray-400 rounded text-xs">Archived</span>
                <span className="text-muted-foreground">No longer relevant</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Projects can be linked to Goals to track progress toward larger objectives.
            </p>
          </div>
        )

      case 'habits':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Habits</h2>
            <p className="text-muted-foreground">
              Habits are recurring tasks that help build routines. They:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Automatically reset after completion</li>
              <li>• Track your completion streaks</li>
              <li>• Are scheduled at the same time each day/week</li>
              <li>• Earn 1.5x XP bonus when completed</li>
            </ul>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-1">Creating a Habit</h4>
              <p className="text-sm text-muted-foreground">
                When creating a task, check "Recurring" and set the frequency (daily, weekly, etc.)
                and which days it should repeat.
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-1">Pausing Habits</h4>
              <p className="text-sm text-muted-foreground">
                Need a break? Pause habits temporarily. They'll be excluded from scheduling
                until you resume them.
              </p>
            </div>
          </div>
        )

      case 'energy':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Energy Patterns</h2>
            <p className="text-muted-foreground">
              Energy patterns tell TrackMind when you're most productive. This is the key
              to smart scheduling!
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg">
                <Flame className="h-5 w-5 text-orange-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">High Energy</h4>
                  <p className="text-muted-foreground">
                    Schedule complex, creative, or challenging work here. This is when you can
                    tackle difficult problems effectively.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Medium Energy</h4>
                  <p className="text-muted-foreground">
                    Regular work that requires focus but isn't extremely demanding.
                    Meetings, reviews, and moderate tasks fit here.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 rounded-lg">
                <Moon className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <h4 className="font-medium">Low Energy</h4>
                  <p className="text-muted-foreground">
                    Routine tasks, email, administrative work, or anything that doesn't
                    require deep focus.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure your patterns in Settings → Energy Patterns. You can set different
              patterns for each day of the week.
            </p>
          </div>
        )

      case 'scheduling':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Smart Scheduling</h2>
            <p className="text-muted-foreground">
              When you click "Reschedule", TrackMind automatically plans your tasks using:
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">35%</span>
                <span>Deadline urgency (closer deadlines = higher priority)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">25%</span>
                <span>Task priority (1-5 scale)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">15%</span>
                <span>Energy matching (high-energy tasks in high-energy slots)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">15%</span>
                <span>Difficulty weighting</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">10%</span>
                <span>Time fit (task fits available slot)</span>
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-1">Automatic Breaks</h4>
              <p className="text-sm text-muted-foreground">
                TrackMind adds 15-minute breaks every 2 hours of work to prevent burnout.
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-1">Habit Protection</h4>
              <p className="text-sm text-muted-foreground">
                Habits block their scheduled time slots so regular tasks don't overlap.
              </p>
            </div>
          </div>
        )

      case 'goals':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Goals</h2>
            <p className="text-muted-foreground">
              Goals help you track long-term objectives and connect your daily tasks to bigger purposes.
            </p>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Time Horizons</h4>
                <p className="text-muted-foreground">
                  <strong>Yearly:</strong> Big-picture objectives for the year<br />
                  <strong>Quarterly:</strong> 3-month milestones<br />
                  <strong>Monthly:</strong> Actionable monthly targets
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Categories</h4>
                <p className="text-muted-foreground">
                  Career, Health, Personal, Learning, Financial, Relationships, or Other -
                  each with a distinct color for easy identification.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Linking Items</h4>
                <p className="text-muted-foreground">
                  Link projects, tasks, and habits to your goals. Progress is automatically
                  calculated based on linked item completion.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Vision Board</h4>
                <p className="text-muted-foreground">
                  Click "Vision Board" on any goal to see a beautiful visualization of how
                  your projects, habits, and tasks connect to achieve the goal.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Hierarchical Goals</h4>
                <p className="text-muted-foreground">
                  Create sub-goals under parent goals to break down large objectives into
                  manageable pieces. Sub-goal progress contributes to parent goal progress.
                </p>
              </div>
            </div>
          </div>
        )

      case 'mood':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Mood Tracking</h2>
            <p className="text-muted-foreground">
              Track your emotional wellbeing throughout the day to discover patterns and improve
              your mental health awareness.
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Mood Check-In Widget</h4>
                <p className="text-sm text-muted-foreground">
                  Use the Mood widget in the sidebar to quickly log how you're feeling.
                  Select from 5 mood levels (1-5) and optionally add a note about why you feel that way.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Time Blocks</h4>
                <p className="text-sm text-muted-foreground">
                  Mood is tracked by time blocks based on your energy patterns: Morning, Afternoon,
                  Evening, and Night. Log mood for any current or past time block.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Mood Insights Page</h4>
                <p className="text-sm text-muted-foreground">
                  Visit the Mood Insights page to see analytics including:
                </p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  <li>• Average mood and trend (improving/stable/declining)</li>
                  <li>• Mood by time of day - when you feel best</li>
                  <li>• Mood by day of week - your best/worst days</li>
                  <li>• Distribution chart showing mood frequency</li>
                  <li>• Calendar heatmap for visual history</li>
                  <li>• Recent notes with your reflections</li>
                </ul>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Mood Levels</h4>
                <p className="text-sm text-muted-foreground">
                  😢 1 - Struggling | 😔 2 - Low | 😐 3 - Neutral | 🙂 4 - Good | 😄 5 - Great
                </p>
              </div>
            </div>
          </div>
        )

      case 'journal':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Journal</h2>
            <p className="text-muted-foreground">
              Capture your thoughts, reflect on your day, and build self-awareness with daily journaling.
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Creating Entries</h4>
                <p className="text-sm text-muted-foreground">
                  Click "New Entry" to create a journal entry. Entries are organized by date and
                  time of day (morning, afternoon, evening, night).
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Guided Prompts</h4>
                <p className="text-sm text-muted-foreground">
                  Each entry includes prompts based on time of day to guide your reflection:
                </p>
                <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                  <li>• <strong>Morning:</strong> Gratitude, intentions, feelings</li>
                  <li>• <strong>Afternoon:</strong> Progress, accomplishments, blockers</li>
                  <li>• <strong>Evening:</strong> What went well, learnings, tomorrow</li>
                  <li>• <strong>Night:</strong> Day reflection, highlight, outlook</li>
                </ul>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Mood Integration</h4>
                <p className="text-sm text-muted-foreground">
                  Set your mood on each journal entry. View mood statistics in the Stats tab
                  to see patterns in your journaling.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">Import Completed Items</h4>
                <p className="text-sm text-muted-foreground">
                  Click "Import Completed" to automatically add your completed tasks and habits
                  for the day to your journal entry.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">View Modes</h4>
                <p className="text-sm text-muted-foreground">
                  <strong>Calendar:</strong> Browse entries by date with mood indicators<br />
                  <strong>Timeline:</strong> Scroll through all entries chronologically<br />
                  <strong>Stats:</strong> See mood overview, distribution, and best times
                </p>
              </div>
            </div>
          </div>
        )

      case 'notes':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Notes</h2>
            <p className="text-muted-foreground">
              Notes are for capturing ideas, meeting notes, or any information you want
              to save. Features:
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Full Markdown support</li>
              <li>• Folder organization</li>
              <li>• Link notes to tasks, projects, or goals</li>
              <li>• Daily notes feature for journaling</li>
              <li>• Compatible with Obsidian/Evernote exports</li>
            </ul>
          </div>
        )

      case 'lists':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Lists</h2>
            <p className="text-muted-foreground">
              Lists are for tracking items outside of your task workflow. Three types:
            </p>
            <div className="space-y-3 text-sm">
              <div>
                <h4 className="font-medium">Running Lists (Eternal)</h4>
                <p className="text-muted-foreground">Ongoing lists like "Books to Read" or "Movies to Watch"</p>
              </div>
              <div>
                <h4 className="font-medium">Quick Lists</h4>
                <p className="text-muted-foreground">Temporary lists like shopping or packing lists</p>
              </div>
              <div>
                <h4 className="font-medium">Templates</h4>
                <p className="text-muted-foreground">Reusable checklists you can duplicate</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              List items can have categories, prices, ratings, due dates, and URLs.
            </p>
          </div>
        )

      case 'analytics':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Analytics & Gamification</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Analytics</h3>
                <p className="text-sm text-muted-foreground">
                  Track productivity patterns by time of day, habit streaks, task completion
                  trends, and burnout risk assessment.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">XP System</h3>
                <p className="text-sm text-muted-foreground">
                  Earn XP by completing tasks. Formula: base × difficulty × time_factor.
                  Habits earn 1.5x bonus XP!
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Badges</h3>
                <p className="text-sm text-muted-foreground">
                  Unlock 16 different achievement badges for streaks, task milestones,
                  time management, and level progression.
                </p>
              </div>
            </div>
          </div>
        )

      case 'keyboard':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Keyboard Shortcuts</h2>
            <div className="space-y-2">
              {[
                { keys: '⌘/Ctrl + K', action: 'Open Global Search' },
                { keys: 'Shift + ?', action: 'Toggle Help Mode' },
                { keys: 'Esc', action: 'Close dialogs / Exit help mode' },
              ].map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{shortcut.action}</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{shortcut.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        )

      case 'help-mode':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Help Mode</h2>
            <p className="text-muted-foreground">
              Help Mode provides interactive guidance by highlighting UI elements and
              showing explanations.
            </p>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">How to Activate</h4>
                <p className="text-muted-foreground">
                  Click the <Eye className="inline h-4 w-4" /> button in the bottom-right corner,
                  or press <kbd className="px-1 bg-muted rounded text-xs">Shift + ?</kbd>
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">What It Shows</h4>
                <p className="text-muted-foreground">
                  Key UI elements are highlighted with explanations. You can still interact
                  with the app while in Help Mode.
                </p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-1">How to Exit</h4>
                <p className="text-muted-foreground">
                  Click anywhere, press <kbd className="px-1 bg-muted rounded text-xs">Esc</kbd>,
                  or click the eye button again.
                </p>
              </div>
            </div>
          </div>
        )

      case 'faq':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">FAQ</h2>
            <div className="space-y-4">
              {[
                {
                  q: 'Why aren\'t my tasks being scheduled?',
                  a: 'Check that: 1) Tasks have time estimates, 2) Energy patterns are configured, 3) Work hours are set in Settings, 4) Dependencies are satisfied.'
                },
                {
                  q: 'How do I sync across devices?',
                  a: 'Go to Settings → Sync and sign in with GitHub. Your data will sync automatically across all your devices.'
                },
                {
                  q: 'Can I change the energy pattern for just one day?',
                  a: 'Yes! In Settings → Energy Patterns, each day can have different energy blocks.'
                },
                {
                  q: 'What happens if I miss a habit?',
                  a: 'Your streak resets, but don\'t worry - just complete it tomorrow to start building again!'
                },
                {
                  q: 'How do I pause a project without deleting it?',
                  a: 'Edit the project and change its status to "Paused". Tasks in paused projects won\'t be scheduled.'
                },
              ].map((item, index) => (
                <div key={index} className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-1">{item.q}</h4>
                  <p className="text-sm text-muted-foreground">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="flex h-[400px]">
      {/* Navigation */}
      <div className="w-48 border-r pr-2">
        <ScrollArea className="h-full">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                  activeSection === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                {activeSection === item.id && (
                  <ChevronRight className="h-3 w-3 ml-auto" />
                )}
              </button>
            ))}
          </nav>
        </ScrollArea>
      </div>

      {/* Content */}
      <div className="flex-1 pl-4">
        <ScrollArea className="h-full pr-2">
          {renderContent()}
        </ScrollArea>
      </div>
    </div>
  )
}
