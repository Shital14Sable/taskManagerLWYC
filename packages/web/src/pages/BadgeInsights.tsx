import { useMemo, useState } from 'react'
import {
  Award, Trophy, Star, Flame, Zap, Crown, Repeat, CheckCircle,
  Heart, Calendar, Sun, Moon, Clock, TrendingUp, Target, Medal,
  Gem, Sunrise, RefreshCw, Shield, CalendarCheck
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useApp } from '@/context/AppContext'
import { cn } from '@/lib/utils'
import type { Task, UserStats } from '@/types'

// Badge definitions
interface BadgeDefinition {
  type: string
  name: string
  description: string
  icon: string
  category: string
  threshold?: number
  isRepeatable: boolean
}

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Task achievements
  { type: 'first_task', name: 'First Steps', description: 'Complete your first task', icon: 'star', category: 'tasks', threshold: 1, isRepeatable: false },
  { type: 'centurion', name: 'Centurion', description: 'Complete 100 tasks', icon: 'shield', category: 'tasks', threshold: 100, isRepeatable: false },
  { type: 'task_master', name: 'Task Master', description: 'Complete 500 tasks', icon: 'crown', category: 'tasks', threshold: 500, isRepeatable: false },

  // Activity streaks
  { type: 'activity_streak_3', name: '3 Day Streak', description: 'Maintain a 3-day activity streak', icon: 'fire', category: 'activity', threshold: 3, isRepeatable: true },
  { type: 'activity_streak_7', name: 'Week Warrior', description: 'Maintain a 7-day activity streak', icon: 'fire', category: 'activity', threshold: 7, isRepeatable: true },
  { type: 'activity_streak_30', name: 'Month Master', description: 'Maintain a 30-day activity streak', icon: 'fire', category: 'activity', threshold: 30, isRepeatable: true },

  // Habit achievements
  { type: 'habit_starter', name: 'Habit Starter', description: 'Complete 10 habit instances', icon: 'repeat', category: 'habits', threshold: 10, isRepeatable: false },
  { type: 'habit_regular', name: 'Habit Regular', description: 'Complete 50 habit instances', icon: 'repeat', category: 'habits', threshold: 50, isRepeatable: false },
  { type: 'habit_dedicated', name: 'Habit Dedicated', description: 'Complete 200 habit instances', icon: 'heart', category: 'habits', threshold: 200, isRepeatable: false },

  // Level milestones
  { type: 'level_5', name: 'Rising Star', description: 'Reach level 5', icon: 'star', category: 'levels', threshold: 5, isRepeatable: false },
  { type: 'level_10', name: 'Dedicated', description: 'Reach level 10', icon: 'medal', category: 'levels', threshold: 10, isRepeatable: false },
  { type: 'level_25', name: 'Expert', description: 'Reach level 25', icon: 'gem', category: 'levels', threshold: 25, isRepeatable: false },
  { type: 'level_50', name: 'Master', description: 'Reach level 50', icon: 'crown', category: 'levels', threshold: 50, isRepeatable: false },
]

// Badge icon mapping
const BADGE_ICONS: Record<string, React.ElementType> = {
  star: Star,
  shield: Shield,
  award: Award,
  fire: Flame,
  zap: Zap,
  crown: Crown,
  repeat: Repeat,
  'check-circle': CheckCircle,
  heart: Heart,
  calendar: Calendar,
  trophy: Trophy,
  sun: Sun,
  'calendar-check': CalendarCheck,
  sunrise: Sunrise,
  moon: Moon,
  clock: Clock,
  'trending-up': TrendingUp,
  target: Target,
  medal: Medal,
  gem: Gem,
}

// Badge category mapping
const BADGE_CATEGORIES: Record<string, { name: string; types: string[] }> = {
  tasks: {
    name: 'Task Achievements',
    types: ['first_task', 'centurion', 'task_master'],
  },
  activity: {
    name: 'Activity Streaks',
    types: ['activity_streak_3', 'activity_streak_7', 'activity_streak_30'],
  },
  habits: {
    name: 'Habit Achievements',
    types: ['habit_starter', 'habit_regular', 'habit_dedicated'],
  },
  levels: {
    name: 'Level Milestones',
    types: ['level_5', 'level_10', 'level_25', 'level_50'],
  },
}

interface BadgeSummary {
  badge: BadgeDefinition
  earned: boolean
  earnedCount: number
  progress: number
  maxProgress: number
}

// Compute badge progress from stats
function computeBadgeSummaries(stats: UserStats, tasks: Task[]): BadgeSummary[] {
  const completedTasks = tasks.filter(t => t.status === 'completed' && !t.is_habit).length
  const level = stats.level || 1
  const currentStreak = stats.streaks?.current || 0
  const longestStreak = stats.streaks?.longest || 0
  const habitsCompleted = tasks.filter(t => t.is_habit && t.status === 'completed').length

  return BADGE_DEFINITIONS.map(badge => {
    let progress = 0
    let maxProgress = badge.threshold || 1
    let earned = false
    let earnedCount = 0

    switch (badge.type) {
      case 'first_task':
        progress = Math.min(completedTasks, 1)
        maxProgress = 1
        earned = completedTasks >= 1
        earnedCount = earned ? 1 : 0
        break
      case 'centurion':
        progress = Math.min(completedTasks, 100)
        maxProgress = 100
        earned = completedTasks >= 100
        earnedCount = earned ? 1 : 0
        break
      case 'task_master':
        progress = Math.min(completedTasks, 500)
        maxProgress = 500
        earned = completedTasks >= 500
        earnedCount = earned ? 1 : 0
        break
      case 'activity_streak_3':
        progress = Math.min(currentStreak, 3)
        maxProgress = 3
        earned = longestStreak >= 3
        earnedCount = Math.floor(longestStreak / 3)
        break
      case 'activity_streak_7':
        progress = Math.min(currentStreak, 7)
        maxProgress = 7
        earned = longestStreak >= 7
        earnedCount = Math.floor(longestStreak / 7)
        break
      case 'activity_streak_30':
        progress = Math.min(currentStreak, 30)
        maxProgress = 30
        earned = longestStreak >= 30
        earnedCount = Math.floor(longestStreak / 30)
        break
      case 'habit_starter':
        progress = Math.min(habitsCompleted, 10)
        maxProgress = 10
        earned = habitsCompleted >= 10
        earnedCount = earned ? 1 : 0
        break
      case 'habit_regular':
        progress = Math.min(habitsCompleted, 50)
        maxProgress = 50
        earned = habitsCompleted >= 50
        earnedCount = earned ? 1 : 0
        break
      case 'habit_dedicated':
        progress = Math.min(habitsCompleted, 200)
        maxProgress = 200
        earned = habitsCompleted >= 200
        earnedCount = earned ? 1 : 0
        break
      case 'level_5':
        progress = Math.min(level, 5)
        maxProgress = 5
        earned = level >= 5
        earnedCount = earned ? 1 : 0
        break
      case 'level_10':
        progress = Math.min(level, 10)
        maxProgress = 10
        earned = level >= 10
        earnedCount = earned ? 1 : 0
        break
      case 'level_25':
        progress = Math.min(level, 25)
        maxProgress = 25
        earned = level >= 25
        earnedCount = earned ? 1 : 0
        break
      case 'level_50':
        progress = Math.min(level, 50)
        maxProgress = 50
        earned = level >= 50
        earnedCount = earned ? 1 : 0
        break
    }

    return {
      badge,
      earned,
      earnedCount,
      progress,
      maxProgress,
    }
  })
}

// Compute level progress
function computeLevelProgress(stats: UserStats): { level: number; currentXp: number; xpNeeded: number; progressPercent: number } {
  const level = stats.level || 1
  const totalXp = stats.total_xp || 0

  // XP formula: each level requires level * 100 XP
  const xpForCurrentLevel = (level * (level - 1) * 50) // Sum of 100 + 200 + ... + (level-1)*100
  const xpNeeded = level * 100
  const currentXp = totalXp - xpForCurrentLevel
  const progressPercent = Math.min((currentXp / xpNeeded) * 100, 100)

  return { level, currentXp: Math.max(0, currentXp), xpNeeded, progressPercent }
}

function BadgeCard({
  summary,
  onClick,
}: {
  summary: BadgeSummary
  onClick: () => void
}) {
  const IconComponent = BADGE_ICONS[summary.badge.icon] || Award
  const isEarned = summary.earned

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isEarned
          ? 'hover:border-primary/50'
          : 'opacity-50 hover:opacity-75 bg-muted/30'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'p-2 rounded-lg',
              isEarned
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            )}
          >
            <IconComponent className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={cn('font-medium truncate', !isEarned && 'text-muted-foreground')}>
                {summary.badge.name}
              </h3>
              {summary.badge.isRepeatable && isEarned && summary.earnedCount > 1 && (
                <Badge variant="secondary" className="text-xs">
                  x{summary.earnedCount}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {summary.badge.description}
            </p>
            {!isEarned && (
              <div className="mt-2">
                <Progress value={(summary.progress / summary.maxProgress) * 100} className="h-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.progress} / {summary.maxProgress}
                </p>
              </div>
            )}
          </div>
          {isEarned && (
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function BadgeDetailDialog({
  summary,
  open,
  onClose,
}: {
  summary: BadgeSummary | null
  open: boolean
  onClose: () => void
}) {
  if (!summary) return null

  const IconComponent = BADGE_ICONS[summary.badge.icon] || Award
  const isEarned = summary.earned

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-3 rounded-lg',
                isEarned
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <IconComponent className="h-8 w-8" />
            </div>
            <div>
              <DialogTitle className="text-xl">{summary.badge.name}</DialogTitle>
              <DialogDescription>{summary.badge.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Badge Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm font-medium">Status</span>
            <Badge variant={isEarned ? 'default' : 'secondary'}>
              {isEarned ? 'Earned' : 'Not Earned'}
            </Badge>
          </div>

          {/* Progress */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{summary.progress} / {summary.maxProgress}</span>
            </div>
            <Progress value={(summary.progress / summary.maxProgress) * 100} className="h-2" />
          </div>

          {/* Stats */}
          {isEarned && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <div className="text-2xl font-bold">{summary.earnedCount}</div>
                <div className="text-xs text-muted-foreground">
                  {summary.badge.isRepeatable ? 'Times Earned' : 'Time Earned'}
                </div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <Badge variant="outline">
                  {summary.badge.isRepeatable ? 'Repeatable' : 'One-time'}
                </Badge>
              </div>
            </div>
          )}

          {/* Not earned message */}
          {!isEarned && (
            <div className="p-4 text-center text-muted-foreground bg-muted/30 rounded-lg">
              <Award className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Keep going! Complete the requirements to earn this badge.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function XPOverview({
  stats,
  levelProgress,
  tasks,
}: {
  stats: UserStats
  levelProgress: { level: number; currentXp: number; xpNeeded: number; progressPercent: number }
  tasks: Task[]
}) {
  const completedTasks = tasks.filter(t => t.status === 'completed' && !t.is_habit).length
  const currentStreak = stats.streaks?.current || 0
  const longestStreak = stats.streaks?.longest || 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          XP & Level Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Level Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold">Level {levelProgress.level}</span>
            <span className="text-muted-foreground">
              {levelProgress.currentXp} / {levelProgress.xpNeeded} XP
            </span>
          </div>
          <Progress value={levelProgress.progressPercent} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {Math.max(0, levelProgress.xpNeeded - levelProgress.currentXp)} XP to next level
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{stats.total_xp || 0}</div>
            <div className="text-xs text-muted-foreground">Total XP</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{completedTasks}</div>
            <div className="text-xs text-muted-foreground">Tasks Done</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{currentStreak}</div>
            <div className="text-xs text-muted-foreground">Current Streak</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold">{longestStreak}</div>
            <div className="text-xs text-muted-foreground">Longest Streak</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function BadgeInsights() {
  const { stats, tasks, isInitialized } = useApp()
  const [selectedBadge, setSelectedBadge] = useState<BadgeSummary | null>(null)

  const badgeSummaries = useMemo(() => {
    return computeBadgeSummaries(stats, tasks)
  }, [stats, tasks])

  const levelProgress = useMemo(() => {
    return computeLevelProgress(stats)
  }, [stats])

  const getBadgesByType = (badgeType: string): BadgeSummary | undefined => {
    return badgeSummaries.find(s => s.badge.type === badgeType)
  }

  const earnedCount = badgeSummaries.filter(s => s.earned).length
  const totalCount = badgeSummaries.length

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Badge Insights
          </h1>
          <p className="text-muted-foreground">
            Track your achievements and progress
          </p>
        </div>
        <Badge variant="outline">
          Based on local data
        </Badge>
      </div>

      {/* XP Overview */}
      <XPOverview stats={stats} levelProgress={levelProgress} tasks={tasks} />

      {/* Badge Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Badge Collection
            </span>
            <Badge variant="outline">
              {earnedCount} / {totalCount} earned
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress
            value={(earnedCount / totalCount) * 100}
            className="h-2"
          />
          <p className="text-sm text-muted-foreground mt-2">
            {totalCount - earnedCount} badges remaining to unlock
          </p>
        </CardContent>
      </Card>

      {/* Badge Categories */}
      {Object.entries(BADGE_CATEGORIES).map(([categoryKey, category]) => {
        const categoryBadges = category.types
          .map(badgeType => getBadgesByType(badgeType))
          .filter((b): b is BadgeSummary => b !== undefined)

        if (categoryBadges.length === 0) return null

        const earnedInCategory = categoryBadges.filter(b => b.earned).length

        return (
          <div key={categoryKey} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{category.name}</h2>
              <Badge variant="secondary">
                {earnedInCategory} / {categoryBadges.length}
              </Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryBadges.map(summary => (
                <BadgeCard
                  key={summary.badge.type}
                  summary={summary}
                  onClick={() => setSelectedBadge(summary)}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* Badge Detail Dialog */}
      <BadgeDetailDialog
        summary={selectedBadge}
        open={!!selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </div>
  )
}

export default BadgeInsights
