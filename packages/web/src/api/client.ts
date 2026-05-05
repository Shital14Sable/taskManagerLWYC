import type { Task, Project, Schedule, CreateTaskInput, CreateProjectInput, GitSyncStatus, TagCategory, UserStats, LevelProgress, Badge, BadgeSummary, BadgeAchievement, TaskCompletionResult, SearchResponse, SearchSuggestionsResponse, List, ListItem, ListInstance, CreateListInput, UpdateListInput, CreateListItemInput, UpdateListItemInput, CreateListInstanceInput, Goal, CreateGoalInput, UpdateGoalInput, GoalProgress, Note, NoteFolder, CreateNoteInput, UpdateNoteInput, Review } from '@/types'

const API_BASE = '/api'

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `HTTP ${response.status}`)
  }

  return response.json()
}

// Projects API
export const projectsApi = {
  list: (status?: string) => {
    const params = status ? `?status=${status}` : ''
    return request<Project[]>(`/projects/${params}`)
  },

  get: (id: string) => request<Project>(`/projects/${id}`),

  create: (data: CreateProjectInput) =>
    request<Project>('/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/projects/${id}`, { method: 'DELETE' }),
}

// Tasks API
export const tasksApi = {
  list: (params?: { project_id?: string; status?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.project_id) searchParams.set('project_id', params.project_id)
    if (params?.status) searchParams.set('status', params.status)
    const query = searchParams.toString()
    return request<Task[]>(`/tasks/${query ? `?${query}` : ''}`)
  },

  get: (id: string) => request<Task>(`/tasks/${id}`),

  create: (data: CreateTaskInput) =>
    request<Task>('/tasks/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/tasks/${id}`, { method: 'DELETE' }),

  complete: (id: string, actualMinutes?: number) =>
    request<TaskCompletionResult>(`/tasks/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ actual_minutes: actualMinutes }),
    }),

  getTagCategories: () => request<TagCategory[]>('/tasks/tags/categories'),
}

// Schedule API
export interface UpcomingScheduleData {
  schedules: Schedule[]
  task_schedule_map: Record<string, string>  // task_id -> scheduled_date
  unscheduled_task_ids: string[]
  total_tasks: number
  scheduled_count: number
  unscheduled_count: number
}

export const scheduleApi = {
  getToday: () => request<Schedule>('/schedule/today'),

  getByDate: (date: string) => request<Schedule>(`/schedule/${date}`),

  getUpcoming: (days: number = 60) =>
    request<UpcomingScheduleData>(`/schedule/upcoming?days=${days}`),

  generate: (days: number = 7, force: boolean = false) =>
    request<{ message: string; schedules: Schedule[] }>('/schedule/generate', {
      method: 'POST',
      body: JSON.stringify({ days, force }),
    }),

  reschedule: (options?: { reschedule_all?: boolean; days?: number }) =>
    request<Schedule | { schedules: Schedule[]; count: number }>('/schedule/reschedule', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),
}

// Sync API
export const syncApi = {
  status: () =>
    request<{
      status: string
      server_time: string
      git_sync?: GitSyncStatus
    }>('/sync/status'),

  gitPull: () =>
    request<{ success: boolean; message: string }>('/sync/git/pull', {
      method: 'POST',
    }),

  gitPush: () =>
    request<{ success: boolean; message: string }>('/sync/git/push', {
      method: 'POST',
    }),

  gitSync: () =>
    request<{ success: boolean; message: string }>('/sync/git/sync', {
      method: 'POST',
    }),
}

// Analytics API
export interface AnalyticsOverview {
  total_tasks: number
  completed_tasks: number
  completion_rate: number
  total_projects: number
  active_projects: number
  total_habits: number
  today_scheduled: number
  today_completed: number
  estimation_accuracy: number
}

export interface ProjectStats {
  project_id: string
  name?: string
  status?: string
  total_tasks: number
  completed_tasks: number
  total_estimated_minutes: number
  total_actual_minutes: number
  completion_rate: number
  average_accuracy_ratio: number
}

export interface WeeklyReport {
  week_start: string
  week_end: string
  total_tasks_completed: number
  total_minutes_worked: number
  daily_completion_rates: Record<string, number>
  top_projects: ProjectStats[]
  estimation_accuracy: number
  insights: string[]
}

export interface ProductivityTrends {
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data' | 'unknown'
  daily_completion: [string, number][]
  daily_minutes: [string, number][]
  average_completion: number
  average_daily_minutes: number
}

export interface BurnoutRisk {
  risk_level: 'high' | 'medium' | 'low' | 'unknown'
  message: string
  indicators: string[]
  suggestions: string[]
  metrics?: {
    high_density_days: number
    avg_completion_rate: number
    estimation_accuracy: number
    weekend_work: boolean
  }
}

export interface HabitDayStats {
  day: string
  day_short: string
  scheduled: number
  completed: number
  rate: number
}

export interface HabitWeeklyStats {
  week_start: string
  week_end: string
  scheduled: number
  completed: number
  rate: number
}

export interface HabitStats {
  habit_id: string
  title: string
  description?: string
  recurrence: {
    frequency?: string
    days_of_week?: string[]
    time_of_day?: string
  }
  period_days: number
  total_scheduled: number
  total_completed: number
  completion_rate: number
  current_streak: number
  longest_streak: number
  day_of_week_stats: HabitDayStats[]
  weekly_stats: HabitWeeklyStats[]
  best_day: HabitDayStats | null
  recent_completions: string[]
  daily_data: { date: string; scheduled: boolean; completed: boolean }[]
}

export interface HabitSummary {
  habit_id: string
  title: string
  project_id: string
  completion_rate: number
  current_streak: number
  total_completed: number
  total_scheduled: number
  best_day: HabitDayStats | null
}

export interface HourlyData {
  hour: number
  hour_label: string
  scheduled: number
  completed: number
  total_minutes: number
  completion_rate: number
}

export interface TimeBlockStats {
  scheduled: number
  completed: number
  total_minutes: number
  completion_rate: number
}

export interface ProductivityPatterns {
  period_days: number
  hourly_data: HourlyData[]
  time_blocks: Record<string, TimeBlockStats>
  best_time_block: string | null
  worst_time_block: string | null
  peak_hours: { hour: number; stats: { scheduled: number; completed: number; total_minutes: number } }[]
  insights: string[]
}

export const analyticsApi = {
  getOverview: () => request<AnalyticsOverview>('/analytics/overview'),

  getProjectStats: (projectId: string) =>
    request<ProjectStats>(`/analytics/project/${projectId}`),

  getAllProjectStats: () => request<ProjectStats[]>('/analytics/projects'),

  getHabitStats: (habitId: string, days: number = 30) =>
    request<HabitStats>(`/analytics/habit/${habitId}?days=${days}`),

  getAllHabitsStats: (days: number = 30) =>
    request<HabitSummary[]>(`/analytics/habits?days=${days}`),

  getWeeklyReport: (startDate?: string) => {
    const params = startDate ? `?start_date=${startDate}` : ''
    return request<WeeklyReport>(`/analytics/weekly${params}`)
  },

  getTrends: (days: number = 30) =>
    request<ProductivityTrends>(`/analytics/trends?days=${days}`),

  getBurnoutRisk: () => request<BurnoutRisk>('/analytics/burnout'),

  getProductivityPatterns: (days: number = 30) =>
    request<ProductivityPatterns>(`/analytics/productivity-patterns?days=${days}`),
}

// Calendar API
export interface WeekDayTask {
  id: string
  title: string
  start_time: string
  end_time: string
  duration: number
  priority: number
  energy_level: string
  is_habit: boolean
  is_completed: boolean
  project_id: string
}

export interface WeekDay {
  date: string
  day_name: string
  day_short: string
  is_today: boolean
  is_weekend: boolean
  tasks: WeekDayTask[]
  summary: {
    total: number
    completed: number
    completion_rate: number
  }
}

export interface WeekView {
  start_date: string
  end_date: string
  days: WeekDay[]
  summary: {
    total_scheduled: number
    total_completed: number
    completion_rate: number
  }
}

export interface MonthDayTask {
  id: string
  title: string
  is_habit: boolean
  is_completed: boolean
  priority: number
}

export interface MonthDay {
  date: string
  day: number
  day_of_week: number
  is_today: boolean
  is_weekend: boolean
  has_schedule: boolean
  task_count: number
  completed_count: number
  habit_count: number
  high_priority_count: number
  tasks: MonthDayTask[]
}

export interface MonthView {
  year: number
  month: number
  month_name: string
  first_weekday: number
  days_in_month: number
  days: MonthDay[]
  summary: {
    total_scheduled: number
    total_completed: number
    completion_rate: number
  }
}

export const calendarApi = {
  getWeek: (startDate?: string) => {
    const params = startDate ? `?start_date=${startDate}` : ''
    return request<WeekView>(`/calendar/week${params}`)
  },

  getMonth: (year?: number, month?: number) => {
    const params = new URLSearchParams()
    if (year) params.set('year', String(year))
    if (month) params.set('month', String(month))
    const query = params.toString()
    return request<MonthView>(`/calendar/month${query ? `?${query}` : ''}`)
  },
}

// Gamification API
export const gamificationApi = {
  getStats: () => request<UserStats>('/gamification/stats'),

  getLevelProgress: () => request<LevelProgress>('/gamification/level-progress'),

  getBadges: () => request<Badge[]>('/gamification/badges'),

  getEarnedBadges: () => request<Badge[]>('/gamification/badges/earned'),

  getBadgeSummary: () => request<BadgeSummary[]>('/gamification/badges/summary'),

  getBadgeHistory: (badgeType?: string) => {
    const params = badgeType ? `?badge_type=${encodeURIComponent(badgeType)}` : ''
    return request<BadgeAchievement[]>(`/gamification/badges/history${params}`)
  },
}

// Search API
export const searchApi = {
  search: (query: string, options?: { type?: string; project_id?: string; status?: string; limit?: number }) => {
    const params = new URLSearchParams({ q: query })
    if (options?.type) params.set('type', options.type)
    if (options?.project_id) params.set('project_id', options.project_id)
    if (options?.status) params.set('status', options.status)
    if (options?.limit) params.set('limit', String(options.limit))
    return request<SearchResponse>(`/search/?${params}`)
  },

  suggestions: (query: string, limit?: number) => {
    const params = new URLSearchParams({ q: query })
    if (limit) params.set('limit', String(limit))
    return request<SearchSuggestionsResponse>(`/search/suggestions?${params}`)
  },
}

// Preferences API
export interface DayWorkHours {
  start: string
  end: string
}

export interface EnergyBlock {
  start: string
  end: string
  level: 'high' | 'medium' | 'low'
}

export interface SchedulingPreferences {
  batch_similar_tasks: boolean
  auto_reschedule_daily: boolean
  days_to_schedule_ahead: number
  respect_energy_patterns: boolean
  energy_match_bonus: number
  max_deep_work_stretch: number
}

export interface UserPreferences {
  user_id: string
  work_hours: Record<string, DayWorkHours>
  energy_patterns: Record<string, EnergyBlock[]>
  scheduling_preferences: SchedulingPreferences
}

export interface PreferencesUpdate {
  work_hours?: Record<string, DayWorkHours>
  energy_patterns?: Record<string, EnergyBlock[]>
  scheduling_preferences?: Partial<SchedulingPreferences>
}

export const preferencesApi = {
  get: () => request<UserPreferences>('/preferences/'),

  update: (data: PreferencesUpdate) =>
    request<UserPreferences>('/preferences/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}

// Habit Instances API
export interface HabitInstance {
  habit_id: string
  date: string
  instance_detail: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface HabitInstanceCreate {
  instance_detail: string
  notes?: string
}

export const habitInstancesApi = {
  list: (habitId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    const query = params.toString()
    return request<HabitInstance[]>(`/habits/${habitId}/instances${query ? `?${query}` : ''}`)
  },

  get: (habitId: string, date: string) =>
    request<HabitInstance | null>(`/habits/${habitId}/instances/${date}`),

  createOrUpdate: (habitId: string, date: string, data: HabitInstanceCreate) =>
    request<HabitInstance>(`/habits/${habitId}/instances/${date}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (habitId: string, date: string) =>
    request<{ message: string }>(`/habits/${habitId}/instances/${date}`, {
      method: 'DELETE',
    }),

  listForDate: (date: string) =>
    request<HabitInstance[]>(`/habits/instances/date/${date}`),
}

// Lists API
export const listsApi = {
  // List operations
  list: (includeArchived: boolean = false) => {
    const params = includeArchived ? '?include_archived=true' : ''
    return request<List[]>(`/lists/${params}`)
  },

  get: (id: string) => request<List>(`/lists/${id}`),

  create: (data: CreateListInput) =>
    request<List>('/lists/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateListInput) =>
    request<List>(`/lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/lists/${id}`, { method: 'DELETE' }),

  // List item operations
  addItem: (listId: string, data: CreateListItemInput) =>
    request<List>(`/lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItem: (listId: string, itemId: string, data: UpdateListItemInput) =>
    request<List>(`/lists/${listId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleItem: (listId: string, itemId: string) =>
    request<List>(`/lists/${listId}/items/${itemId}/toggle`, {
      method: 'POST',
    }),

  deleteItem: (listId: string, itemId: string) =>
    request<List>(`/lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    }),

  reorderItems: (listId: string, itemIds: string[]) =>
    request<List>(`/lists/${listId}/items/reorder`, {
      method: 'PUT',
      body: JSON.stringify(itemIds),
    }),

  // Tag operations
  getTagColors: () => request<Record<string, string>>('/lists/tags/colors'),

  getItemsByTag: (listId: string, tag: string) =>
    request<ListItem[]>(`/lists/${listId}/items/by-tag/${encodeURIComponent(tag)}`),

  // List instance operations
  listInstances: (listId: string, includeArchived: boolean = false) => {
    const params = includeArchived ? '?include_archived=true' : ''
    return request<ListInstance[]>(`/lists/${listId}/instances${params}`)
  },

  getInstance: (instanceId: string) =>
    request<ListInstance>(`/lists/instances/${instanceId}`),

  createInstance: (listId: string, data?: Omit<CreateListInstanceInput, 'list_id'>) =>
    request<ListInstance>(`/lists/${listId}/instances`, {
      method: 'POST',
      body: JSON.stringify({ list_id: listId, ...data }),
    }),

  updateInstance: (instanceId: string, data: { name?: string; item_states?: Record<string, boolean>; completed_at?: string; archived_at?: string }) =>
    request<ListInstance>(`/lists/instances/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleInstanceItem: (instanceId: string, itemId: string) =>
    request<ListInstance>(`/lists/instances/${instanceId}/toggle/${itemId}`, {
      method: 'POST',
    }),

  addInstanceItem: (instanceId: string, data: CreateListItemInput) =>
    request<ListInstance>(`/lists/instances/${instanceId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  completeInstance: (instanceId: string) =>
    request<ListInstance>(`/lists/instances/${instanceId}/complete`, {
      method: 'POST',
    }),

  archiveInstance: (instanceId: string) =>
    request<ListInstance>(`/lists/instances/${instanceId}/archive`, {
      method: 'POST',
    }),

  deleteInstance: (instanceId: string) =>
    request<{ message: string }>(`/lists/instances/${instanceId}`, {
      method: 'DELETE',
    }),
}

// Goals API
export const goalsApi = {
  list: (status?: string, timeHorizon?: string, category?: string) => {
    const params = new URLSearchParams()
    if (status) params.append('status', status)
    if (timeHorizon) params.append('time_horizon', timeHorizon)
    if (category) params.append('category', category)
    const queryString = params.toString()
    return request<Goal[]>(`/goals/${queryString ? '?' + queryString : ''}`)
  },

  get: (id: string) => request<Goal>(`/goals/${id}`),

  create: (data: CreateGoalInput) =>
    request<Goal>('/goals/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateGoalInput) =>
    request<Goal>(`/goals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/goals/${id}`, { method: 'DELETE' }),

  linkProject: (goalId: string, projectId: string) =>
    request<Goal>(`/goals/${goalId}/link-project/${projectId}`, {
      method: 'POST',
    }),

  unlinkProject: (goalId: string, projectId: string) =>
    request<Goal>(`/goals/${goalId}/unlink-project/${projectId}`, {
      method: 'DELETE',
    }),

  getProgress: (goalId: string) =>
    request<GoalProgress>(`/goals/${goalId}/progress`),
}

// Notes API
export const notesApi = {
  list: (folder?: string, isDailyNote?: boolean) => {
    const params = new URLSearchParams()
    if (folder) params.set('folder', folder)
    if (isDailyNote !== undefined) params.set('is_daily_note', String(isDailyNote))
    const query = params.toString()
    return request<Note[]>(`/notes/${query ? `?${query}` : ''}`)
  },

  get: (id: string) => request<Note>(`/notes/${id}`),

  create: (data: CreateNoteInput) =>
    request<Note>('/notes/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: UpdateNoteInput) =>
    request<Note>(`/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ message: string }>(`/notes/${id}`, { method: 'DELETE' }),

  search: (query: string) => request<Note[]>(`/notes/search?query=${encodeURIComponent(query)}`),

  getDaily: (date?: string) => {
    const params = date ? `?date_str=${date}` : ''
    return request<Note>(`/notes/daily${params}`)
  },

  getFolders: () => request<NoteFolder[]>('/notes/folders/tree'),

  createFolder: (path: string) =>
    request<{ message: string }>(`/notes/folders/create?folder_path=${encodeURIComponent(path)}`, {
      method: 'POST',
    }),

  linkTask: (noteId: string, taskId: string) =>
    request<Note>(`/notes/${noteId}/link-task/${taskId}`, { method: 'POST' }),

  linkProject: (noteId: string, projectId: string) =>
    request<Note>(`/notes/${noteId}/link-project/${projectId}`, { method: 'POST' }),

  linkGoal: (noteId: string, goalId: string) =>
    request<Note>(`/notes/${noteId}/link-goal/${goalId}`, { method: 'POST' }),
}

// Reviews API
export const reviewsApi = {
  list: (reviewType?: string, limit: number = 50) => {
    const params = new URLSearchParams()
    if (reviewType) params.set('review_type', reviewType)
    params.set('limit', String(limit))
    return request<Review[]>(`/reviews/?${params}`)
  },

  getDaily: (date?: string) => {
    const params = date ? `?date_str=${date}` : ''
    return request<Review>(`/reviews/daily${params}`)
  },

  getWeekly: (date?: string) => {
    const params = date ? `?date_str=${date}` : ''
    return request<Review>(`/reviews/weekly${params}`)
  },

  getMonthly: (date?: string) => {
    const params = date ? `?date_str=${date}` : ''
    return request<Review>(`/reviews/monthly${params}`)
  },

  get: (reviewType: string, periodKey: string) =>
    request<Review>(`/reviews/${reviewType}/${periodKey}`),

  update: (reviewType: string, periodKey: string, notes: string) =>
    request<Review>(`/reviews/${reviewType}/${periodKey}`, {
      method: 'PUT',
      body: JSON.stringify({ notes }),
    }),

  delete: (reviewType: string, periodKey: string) =>
    request<{ message: string }>(`/reviews/${reviewType}/${periodKey}`, { method: 'DELETE' }),
}

// Export API
export interface ExportOptions {
  include_projects?: boolean
  include_tasks?: boolean
  include_habits?: boolean
  include_lists?: boolean
  include_schedules?: boolean
  schedule_days?: number
  include_completed?: boolean
}

export interface ExportData {
  export_date: string
  version: string
  projects?: Array<{
    id: string
    name: string
    description?: string
    status: string
    created_at?: string
  }>
  tasks?: Array<{
    id: string
    project_id: string
    parent_task_id?: string
    title: string
    description?: string
    priority: number
    difficulty: number
    energy_level: string
    estimated_minutes: number
    status: string
    dependencies: string[]
    deadline?: string
    tags: string[]
    is_paused: boolean
    paused_until?: string
  }>
  habits?: Array<{
    id: string
    project_id: string
    title: string
    description?: string
    priority: number
    estimated_minutes: number
    energy_level: string
    status: string
    recurrence?: {
      frequency?: string
      days_of_week: string[]
      time_of_day?: string
    }
    is_paused: boolean
    paused_until?: string
  }>
  schedules?: Array<{
    date: string
    work_start?: string
    work_end?: string
    items: Array<{
      type: 'task' | 'habit' | 'break'
      task_id?: string
      title?: string
      start_time: string
      end_time: string
      duration_minutes: number
    }>
    total_minutes: number
  }>
}

export interface ExportSummary {
  projects_count: number
  tasks: {
    total: number
    todo: number
    in_progress: number
    completed: number
  }
  habits_count: number
  lists_count: number
}

export const exportApi = {
  export: (options?: ExportOptions) =>
    request<ExportData>('/export/', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),

  getSummary: () => request<ExportSummary>('/export/summary'),

  downloadJson: async (options?: ExportOptions) => {
    const data = await exportApi.export(options)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trackmind-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return data
  },
}

// Combined API object
export const api = {
  projects: projectsApi,
  tasks: tasksApi,
  schedule: scheduleApi,
  sync: syncApi,
  analytics: analyticsApi,
  calendar: calendarApi,
  gamification: gamificationApi,
  search: searchApi,
  preferences: preferencesApi,
  habitInstances: habitInstancesApi,
  lists: listsApi,
  goals: goalsApi,
  notes: notesApi,
  reviews: reviewsApi,
  export: exportApi,
}

export default api
