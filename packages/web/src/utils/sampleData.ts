import { v4 as uuidv4 } from 'uuid'
import type { Project, Task, Goal } from '@/types'

interface SampleDataResult {
  project: Project
  tasks: Task[]
  habit: Task
  goal: Goal
}

export function generateSampleData(): SampleDataResult {
  const now = new Date().toISOString()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString()

  // End of quarter for goal target date
  const endOfQuarter = new Date()
  const currentQuarter = Math.floor(endOfQuarter.getMonth() / 3)
  endOfQuarter.setMonth((currentQuarter + 1) * 3, 0)
  const endOfQuarterStr = endOfQuarter.toISOString().split('T')[0]

  const projectId = uuidv4()
  const habitId = uuidv4()
  const goalId = uuidv4()

  const project: Project = {
    id: projectId,
    name: 'Getting Started with TrackMind',
    description: 'Learn how to use TrackMind effectively. Complete these tasks to understand the key features!',
    status: 'active',
    priority: 3,
    created_at: now,
    updated_at: now,
  }

  const tasks: Task[] = [
    {
      id: uuidv4(),
      project_id: projectId,
      title: 'Explore the Today view and click Reschedule',
      description: 'The Today view shows your scheduled tasks. Click the "Reschedule" button to see how TrackMind automatically organizes your day based on task priority and your energy levels.',
      status: 'todo',
      priority: 5, // Critical - first thing to do
      difficulty: 1,
      energy_level: 'high',
      estimated_minutes: 15,
      actual_minutes: 0,
      tags: ['tutorial', 'getting-started'],
      dependencies: [],
      is_habit: false,
      is_paused: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      project_id: projectId,
      title: 'Try the Quick Capture feature',
      description: 'Type something like "Review report tomorrow 2h high priority" in the Quick Capture input to see how natural language parsing works.',
      status: 'todo',
      priority: 4, // High
      difficulty: 2,
      energy_level: 'medium',
      estimated_minutes: 15,
      actual_minutes: 0,
      tags: ['tutorial', 'quick-capture'],
      dependencies: [],
      is_habit: false,
      is_paused: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      project_id: projectId,
      title: 'Configure your energy patterns in Settings',
      description: 'Go to Settings → Energy Patterns to fine-tune when you\'re most productive. This helps TrackMind schedule demanding tasks at the right time.',
      status: 'todo',
      priority: 3, // Medium
      difficulty: 2,
      energy_level: 'medium',
      estimated_minutes: 20,
      actual_minutes: 0,
      tags: ['tutorial', 'settings'],
      dependencies: [],
      is_habit: false,
      is_paused: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      project_id: projectId,
      title: 'Check out the Analytics view',
      description: 'Visit the Analytics page to see productivity insights, patterns, and track your progress over time.',
      status: 'todo',
      priority: 2, // Low
      difficulty: 1,
      energy_level: 'low',
      estimated_minutes: 15,
      actual_minutes: 0,
      tags: ['tutorial', 'analytics'],
      dependencies: [],
      deadline: tomorrowStr, // Has a deadline
      is_habit: false,
      is_paused: false,
      created_at: now,
      updated_at: now,
    },
  ]

  const habit: Task = {
    id: habitId,
    project_id: projectId,
    title: 'Daily Planning Review',
    description: 'Take 15 minutes each morning to review your scheduled tasks and adjust priorities if needed. This is an example habit to show you how habit tracking works.',
    status: 'todo',
    priority: 3,
    difficulty: 1,
    energy_level: 'medium',
    estimated_minutes: 15,
    actual_minutes: 0,
    tags: ['habit', 'planning', 'example'],
    dependencies: [],
    is_habit: true,
    recurrence: {
      frequency: 'daily',
      days_of_week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      time_of_day: '09:00',
      end_date: null,
    },
    is_paused: false,
    created_at: now,
    updated_at: now,
  }

  // Sample goal connected to the project and habit
  const goal: Goal = {
    id: goalId,
    title: 'Master TrackMind & Build Productive Habits',
    description: 'Learn to use TrackMind effectively and establish a daily planning routine to boost productivity.',
    time_horizon: 'quarterly',
    category: 'personal',
    target_date: endOfQuarterStr,
    linked_project_ids: [projectId],
    linked_habit_ids: [habitId],
    linked_task_ids: tasks.map(t => t.id),
    parent_goal_id: null,
    status: 'active',
    progress: 0,
    created_at: now,
    updated_at: now,
    achieved_at: null,
  }

  return { project, tasks, habit, goal }
}
