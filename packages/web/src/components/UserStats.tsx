import { useState } from 'react'
import { useGamification } from '@/hooks/useGamification'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  Star,
  Trophy,
  Flame,
  Target,
  Award,
  Zap,
  Clock,
  Calendar,
  Shield,
  Crown,
  Medal,
  Gem,
  Sunrise,
  Moon,
  TrendingUp,
  Repeat,
  Lock,
} from 'lucide-react'
import type { Badge, UserStats as UserStatsType, LevelProgress } from '@/types'

// Map icon names to components
const ICON_MAP: Record<string, React.ElementType> = {
  star: Star,
  fire: Flame,
  zap: Zap,
  crown: Crown,
  shield: Shield,
  award: Award,
  repeat: Repeat,
  calendar: Calendar,
  trophy: Trophy,
  sunrise: Sunrise,
  moon: Moon,
  clock: Clock,
  'trending-up': TrendingUp,
  target: Target,
  medal: Medal,
  gem: Gem,
}

function BadgeIcon({ icon, className }: { icon: string; className?: string }) {
  const IconComponent = ICON_MAP[icon] || Star
  return <IconComponent className={className} />
}

interface UserStatsProps {
  compact?: boolean
  stats?: UserStatsType | null
  levelProgress?: LevelProgress | null
  earnedBadges?: Badge[]
  unearnedBadges?: Badge[]
  loading?: boolean
}

export function UserStats({
  compact = false,
  stats: externalStats,
  levelProgress: externalLevelProgress,
  earnedBadges: externalEarnedBadges,
  unearnedBadges: externalUnearnedBadges,
  loading: externalLoading,
}: UserStatsProps) {
  const internalGamification = useGamification()
  const [showDialog, setShowDialog] = useState(false)

  // Use external data if provided, otherwise use internal hook
  const stats = externalStats !== undefined ? externalStats : internalGamification.stats
  const levelProgress = externalLevelProgress !== undefined ? externalLevelProgress : internalGamification.levelProgress
  const earnedBadges = externalEarnedBadges !== undefined ? externalEarnedBadges : internalGamification.earnedBadges
  const unearnedBadges = externalUnearnedBadges !== undefined ? externalUnearnedBadges : internalGamification.unearnedBadges
  const loading = externalLoading !== undefined ? externalLoading : internalGamification.loading

  if (loading || !stats || !levelProgress) {
    return (
      <Card className={compact ? 'border-0 shadow-none bg-transparent' : ''}>
        <CardContent className={compact ? 'p-0' : 'p-4'}>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-2 bg-muted rounded w-full"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <>
        <button
          onClick={() => setShowDialog(true)}
          className="flex items-center gap-3 hover:bg-accent rounded-lg px-2 py-1 -mx-2 transition-colors cursor-pointer"
          title="Click to view XP & Badges"
        >
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {levelProgress.level}
            </div>
            <div className="text-xs text-left">
              <div className="font-medium">Level {levelProgress.level}</div>
              <div className="text-muted-foreground">{stats.total_xp} XP</div>
            </div>
          </div>
          {stats.current_streak > 0 && (
            <div className="flex items-center gap-1 text-xs text-orange-500">
              <Flame className="h-3 w-3" />
              {stats.current_streak}
            </div>
          )}
        </button>

        {/* Full Gamification Dialog */}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Your Progress & Achievements
              </DialogTitle>
              <DialogDescription className="sr-only">
                View your XP, level progress, streaks, and earned badges
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Level Progress */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl">
                      {levelProgress.level}
                    </div>
                    <div>
                      <div className="font-bold text-lg">Level {levelProgress.level}</div>
                      <div className="text-sm text-muted-foreground">
                        {stats.total_xp.toLocaleString()} total XP
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">{levelProgress.current_xp} / {levelProgress.xp_needed} XP</div>
                    <div className="text-muted-foreground">to next level</div>
                  </div>
                </div>
                <Progress value={levelProgress.progress_percent} className="h-3" />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Target className="h-5 w-5 mx-auto mb-2 text-primary" />
                  <div className="font-bold text-xl">{stats.tasks_completed}</div>
                  <div className="text-xs text-muted-foreground">Tasks Done</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Repeat className="h-5 w-5 mx-auto mb-2 text-green-500" />
                  <div className="font-bold text-xl">{stats.habits_completed}</div>
                  <div className="text-xs text-muted-foreground">Habits Done</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Flame className="h-5 w-5 mx-auto mb-2 text-orange-500" />
                  <div className="font-bold text-xl">{stats.current_streak}</div>
                  <div className="text-xs text-muted-foreground">Day Streak</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <Trophy className="h-5 w-5 mx-auto mb-2 text-yellow-500" />
                  <div className="font-bold text-xl">{stats.longest_streak}</div>
                  <div className="text-xs text-muted-foreground">Best Streak</div>
                </div>
              </div>

              {/* Earned Badges */}
              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Badges Earned ({earnedBadges.length})
                </h4>
                {earnedBadges.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Complete tasks and habits to earn badges!
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {earnedBadges.map((badge) => (
                      <div
                        key={badge.type}
                        className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30"
                      >
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                          <BadgeIcon icon={badge.icon} className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <div className="font-medium text-amber-800 dark:text-amber-300">{badge.name}</div>
                          <div className="text-xs text-amber-700/70 dark:text-amber-400/70">{badge.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Unearned Badges (Locked) */}
              {unearnedBadges.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-5 w-5" />
                    Badges to Unlock ({unearnedBadges.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {unearnedBadges.map((badge) => (
                      <div
                        key={badge.type}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 opacity-60"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <BadgeIcon icon={badge.icon} className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="font-medium text-muted-foreground">{badge.name}</div>
                          <div className="text-xs text-muted-foreground/70">{badge.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Your Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Level Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold">
                {levelProgress.level}
              </div>
              <div>
                <div className="font-semibold">Level {levelProgress.level}</div>
                <div className="text-xs text-muted-foreground">
                  {stats.total_xp.toLocaleString()} total XP
                </div>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              {levelProgress.current_xp} / {levelProgress.xp_needed} XP
            </div>
          </div>
          <Progress value={levelProgress.progress_percent} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Target className="h-3 w-3" />
              Tasks Done
            </div>
            <div className="font-semibold text-lg">{stats.tasks_completed}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Repeat className="h-3 w-3" />
              Habits Done
            </div>
            <div className="font-semibold text-lg">{stats.habits_completed}</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Flame className="h-3 w-3 text-orange-500" />
              Current Streak
            </div>
            <div className="font-semibold text-lg">
              {stats.current_streak} day{stats.current_streak !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Trophy className="h-3 w-3 text-yellow-500" />
              Best Streak
            </div>
            <div className="font-semibold text-lg">
              {stats.longest_streak} day{stats.longest_streak !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Earned Badges */}
        {earnedBadges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4" />
              Badges Earned ({earnedBadges.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((badge) => (
                <BadgeDisplay key={badge.type} badge={badge} earned />
              ))}
            </div>
          </div>
        )}

        {/* Unearned Badges Preview */}
        {unearnedBadges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              Up Next ({unearnedBadges.length} remaining)
            </h4>
            <div className="flex flex-wrap gap-2">
              {unearnedBadges.slice(0, 4).map((badge) => (
                <BadgeDisplay key={badge.type} badge={badge} earned={false} />
              ))}
              {unearnedBadges.length > 4 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{unearnedBadges.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BadgeDisplay({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div
      className={`group relative inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
        earned
          ? 'bg-gradient-to-r from-yellow-100 to-amber-100 text-amber-800 dark:from-yellow-900/30 dark:to-amber-900/30 dark:text-amber-300'
          : 'bg-muted text-muted-foreground opacity-50'
      }`}
      title={badge.description}
    >
      <BadgeIcon icon={badge.icon} className="h-3 w-3" />
      <span>{badge.name}</span>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded shadow-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
        {badge.description}
      </div>
    </div>
  )
}

export default UserStats
