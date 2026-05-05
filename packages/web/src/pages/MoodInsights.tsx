import { useMemo, useState } from 'react'
import {
  Smile, TrendingUp, TrendingDown, Minus, Calendar, Clock, BarChart3,
  Sun, Moon, Sunrise, Sunset, ChevronLeft, ChevronRight, MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useMood } from '@/hooks/useMood'
import type { MoodCheckIn, MoodLevel } from '@trackmind/core'
import { MOOD_EMOJI_CONFIG } from '@trackmind/core'
import { cn } from '@/lib/utils'

// Day of week labels
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Time period options
type TimePeriod = '7d' | '30d' | '90d' | 'all'

export function MoodInsights() {
  const { moodCheckIns, moodBlocks, loading, MOOD_EMOJI_CONFIG: moodConfig } = useMood()
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')
  const [calendarMonth, setCalendarMonth] = useState(new Date())

  // Filter moods by time period
  const filteredMoods = useMemo(() => {
    if (timePeriod === 'all') return moodCheckIns

    const now = new Date()
    const cutoff = new Date()

    switch (timePeriod) {
      case '7d':
        cutoff.setDate(now.getDate() - 7)
        break
      case '30d':
        cutoff.setDate(now.getDate() - 30)
        break
      case '90d':
        cutoff.setDate(now.getDate() - 90)
        break
    }

    return moodCheckIns.filter(m => new Date(m.date) >= cutoff)
  }, [moodCheckIns, timePeriod])

  // Calculate overall stats
  const overallStats = useMemo(() => {
    if (filteredMoods.length === 0) {
      return { average: 0, trend: 'stable' as const, totalEntries: 0, streak: 0, bestLevel: null, worstLevel: null }
    }

    const sum = filteredMoods.reduce((acc, m) => acc + m.level, 0)
    const average = sum / filteredMoods.length

    // Calculate trend
    const sorted = [...filteredMoods].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (sorted.length >= 4) {
      const midpoint = Math.floor(sorted.length / 2)
      const firstHalf = sorted.slice(0, midpoint)
      const secondHalf = sorted.slice(midpoint)
      const firstAvg = firstHalf.reduce((acc, m) => acc + m.level, 0) / firstHalf.length
      const secondAvg = secondHalf.reduce((acc, m) => acc + m.level, 0) / secondHalf.length

      if (secondAvg - firstAvg > 0.3) trend = 'improving'
      else if (firstAvg - secondAvg > 0.3) trend = 'declining'
    }

    // Calculate streak (consecutive days with mood logged)
    const uniqueDates = [...new Set(filteredMoods.map(m => m.date))].sort().reverse()
    let streak = 0
    const today = new Date()
    for (let i = 0; i < uniqueDates.length; i++) {
      const expectedDate = new Date(today)
      expectedDate.setDate(today.getDate() - i)
      const expectedStr = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`
      if (uniqueDates.includes(expectedStr)) {
        streak++
      } else {
        break
      }
    }

    // Find best and worst levels
    const levelCounts: Record<MoodLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    filteredMoods.forEach(m => levelCounts[m.level]++)

    const levels = Object.entries(levelCounts).filter(([, count]) => count > 0)
    const bestLevel = levels.length > 0 ? Number(levels.sort((a, b) => b[1] - a[1])[0][0]) as MoodLevel : null
    const worstLevel = levels.length > 0 ? Number(levels.sort((a, b) => a[1] - b[1])[0][0]) as MoodLevel : null

    return { average, trend, totalEntries: filteredMoods.length, streak, bestLevel, worstLevel }
  }, [filteredMoods])

  // Calculate time block stats
  const blockStats = useMemo(() => {
    const stats: Record<string, { name: string; count: number; sum: number; average: number }> = {}

    moodBlocks.forEach(block => {
      stats[block.id] = { name: block.name, count: 0, sum: 0, average: 0 }
    })

    // Helper to check if time falls within a block
    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    }

    filteredMoods.forEach(mood => {
      const moodTime = new Date(mood.timestamp)
      const moodMinutes = moodTime.getHours() * 60 + moodTime.getMinutes()

      for (const block of moodBlocks) {
        const startMinutes = timeToMinutes(block.start)
        const endMinutes = timeToMinutes(block.end)

        const isOvernight = endMinutes <= startMinutes
        let inBlock = false

        if (isOvernight) {
          inBlock = moodMinutes >= startMinutes || moodMinutes < endMinutes
        } else {
          inBlock = moodMinutes >= startMinutes && moodMinutes < endMinutes
        }

        if (inBlock && stats[block.id]) {
          stats[block.id].count++
          stats[block.id].sum += mood.level
          break
        }
      }
    })

    // Calculate averages
    Object.values(stats).forEach(stat => {
      if (stat.count > 0) {
        stat.average = stat.sum / stat.count
      }
    })

    return Object.entries(stats)
      .map(([id, stat]) => ({ id, ...stat }))
      .filter(s => s.count > 0)
      .sort((a, b) => b.average - a.average)
  }, [filteredMoods, moodBlocks])

  // Calculate day of week stats
  const dayOfWeekStats = useMemo(() => {
    const stats: { day: string; dayFull: string; count: number; sum: number; average: number }[] =
      WEEKDAYS.map((day, i) => ({ day, dayFull: WEEKDAY_FULL[i], count: 0, sum: 0, average: 0 }))

    filteredMoods.forEach(mood => {
      const dayIndex = new Date(mood.date).getDay()
      stats[dayIndex].count++
      stats[dayIndex].sum += mood.level
    })

    stats.forEach(stat => {
      if (stat.count > 0) {
        stat.average = stat.sum / stat.count
      }
    })

    return stats
  }, [filteredMoods])

  // Calculate mood distribution
  const moodDistribution = useMemo(() => {
    const distribution: { level: MoodLevel; count: number; percentage: number }[] = []
    const total = filteredMoods.length

    for (let level = 1; level <= 5; level++) {
      const count = filteredMoods.filter(m => m.level === level).length
      distribution.push({
        level: level as MoodLevel,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      })
    }

    return distribution
  }, [filteredMoods])

  // Calendar data for current month
  const calendarData = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()

    const days: { date: Date | null; mood: MoodCheckIn | null; average: number | null }[] = []

    // Padding for start of month
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, mood: null, average: null })
    }

    // Days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayMoods = moodCheckIns.filter(m => m.date === dateStr)

      let average: number | null = null
      if (dayMoods.length > 0) {
        average = dayMoods.reduce((acc, m) => acc + m.level, 0) / dayMoods.length
      }

      days.push({
        date,
        mood: dayMoods[dayMoods.length - 1] || null,
        average
      })
    }

    return days
  }, [calendarMonth, moodCheckIns])

  // Recent entries with notes
  const recentEntriesWithNotes = useMemo(() => {
    return [...filteredMoods]
      .filter(m => m.note && m.note.trim())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10)
  }, [filteredMoods])

  // Get color for mood level
  const getMoodColor = (level: number) => {
    if (level >= 4.5) return 'bg-emerald-500'
    if (level >= 3.5) return 'bg-green-500'
    if (level >= 2.5) return 'bg-yellow-500'
    if (level >= 1.5) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getMoodBgColor = (level: number) => {
    if (level >= 4.5) return 'bg-emerald-100 dark:bg-emerald-900/30'
    if (level >= 3.5) return 'bg-green-100 dark:bg-green-900/30'
    if (level >= 2.5) return 'bg-yellow-100 dark:bg-yellow-900/30'
    if (level >= 1.5) return 'bg-orange-100 dark:bg-orange-900/30'
    return 'bg-red-100 dark:bg-red-900/30'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Smile className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Mood Insights</h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="animate-pulse text-muted-foreground">Loading mood data...</div>
        </div>
      </div>
    )
  }

  if (moodCheckIns.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Smile className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Mood Insights</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <Smile className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No mood data yet</h3>
            <p className="text-muted-foreground">
              Start logging your mood using the Mood widget in the sidebar to see insights here.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smile className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Mood Insights</h1>
        </div>
        <div className="flex gap-1">
          {(['7d', '30d', '90d', 'all'] as TimePeriod[]).map((period) => (
            <Button
              key={period}
              variant={timePeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimePeriod(period)}
            >
              {period === 'all' ? 'All Time' : period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : '90 Days'}
            </Button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Average Mood</p>
                <p className="text-3xl font-bold">{overallStats.average.toFixed(1)}</p>
              </div>
              <div className="text-4xl">
                {overallStats.average >= 4 ? '😄' : overallStats.average >= 3 ? '🙂' : overallStats.average >= 2 ? '😐' : '😔'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Trend</p>
                <p className="text-xl font-bold capitalize flex items-center gap-1">
                  {overallStats.trend === 'improving' && <TrendingUp className="h-5 w-5 text-green-500" />}
                  {overallStats.trend === 'declining' && <TrendingDown className="h-5 w-5 text-red-500" />}
                  {overallStats.trend === 'stable' && <Minus className="h-5 w-5 text-yellow-500" />}
                  {overallStats.trend}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-3xl font-bold">{overallStats.totalEntries}</p>
              </div>
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Streak</p>
                <p className="text-3xl font-bold">{overallStats.streak} days</p>
              </div>
              <div className="text-2xl">🔥</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Time Block Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Mood by Time of Day
            </CardTitle>
            <CardDescription>Your average mood during different time blocks</CardDescription>
          </CardHeader>
          <CardContent>
            {blockStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Not enough data yet</p>
            ) : (
              <div className="space-y-4">
                {blockStats.map((block, index) => (
                  <div key={block.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {index === 0 && <Badge variant="outline" className="text-xs">Best</Badge>}
                        <span className="font-medium">{block.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{block.count} entries</span>
                        <span className="font-bold">{block.average.toFixed(1)}</span>
                        <span>{MOOD_EMOJI_CONFIG[Math.round(block.average) as MoodLevel]?.emoji}</span>
                      </div>
                    </div>
                    <Progress
                      value={(block.average / 5) * 100}
                      className={cn("h-2", getMoodBgColor(block.average))}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Day of Week Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Mood by Day of Week
            </CardTitle>
            <CardDescription>How your mood varies throughout the week</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dayOfWeekStats.map((stat, index) => {
                const bestDay = dayOfWeekStats.reduce((best, curr) =>
                  curr.average > best.average && curr.count > 0 ? curr : best
                )
                const isBest = stat.day === bestDay.day && stat.count > 0

                return (
                  <div key={stat.day} className="flex items-center gap-3">
                    <span className={cn(
                      "w-12 text-sm font-medium",
                      isBest && "text-green-600 dark:text-green-400"
                    )}>
                      {stat.day}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        {stat.count > 0 && (
                          <div
                            className={cn("h-full rounded-full transition-all", getMoodColor(stat.average))}
                            style={{ width: `${(stat.average / 5) * 100}%` }}
                          />
                        )}
                      </div>
                      <span className="w-8 text-sm text-right">
                        {stat.count > 0 ? stat.average.toFixed(1) : '-'}
                      </span>
                      <span className="w-6 text-center">
                        {stat.count > 0 ? MOOD_EMOJI_CONFIG[Math.round(stat.average) as MoodLevel]?.emoji : ''}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mood Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Mood Distribution
          </CardTitle>
          <CardDescription>How often you experience each mood level</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-around h-40 gap-2">
            {moodDistribution.map((item) => (
              <div key={item.level} className="flex flex-col items-center gap-2 flex-1">
                <div className="relative w-full flex justify-center">
                  <div
                    className={cn(
                      "w-12 rounded-t transition-all",
                      getMoodColor(item.level)
                    )}
                    style={{ height: `${Math.max(item.percentage * 1.2, 4)}px` }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-2xl">{MOOD_EMOJI_CONFIG[item.level].emoji}</div>
                  <div className="text-xs text-muted-foreground">{item.count}</div>
                  <div className="text-xs font-medium">{item.percentage.toFixed(0)}%</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Heatmap */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Mood Calendar
              </CardTitle>
              <CardDescription>Your mood history at a glance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium w-32 text-center">
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {/* Weekday headers */}
            {WEEKDAYS.map(day => (
              <div key={day} className="text-center text-xs text-muted-foreground py-2 font-medium">
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarData.map((day, index) => (
              <div
                key={index}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded text-sm",
                  day.date ? (
                    day.average !== null
                      ? getMoodBgColor(day.average)
                      : "bg-muted/30"
                  ) : ""
                )}
                title={day.date && day.average !== null ? `Avg: ${day.average.toFixed(1)}` : undefined}
              >
                {day.date && (
                  <>
                    <span className={cn(
                      "text-xs",
                      day.average === null && "text-muted-foreground"
                    )}>
                      {day.date.getDate()}
                    </span>
                    {day.mood && (
                      <span className="text-xs">{day.mood.emoji}</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <span>Mood level:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>1</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-orange-500" />
              <span>2</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span>3</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>4</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-emerald-500" />
              <span>5</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Entries with Notes */}
      {recentEntriesWithNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Recent Notes
            </CardTitle>
            <CardDescription>Your mood entries with reflections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentEntriesWithNotes.map((entry) => (
                <div key={entry.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="text-2xl">{entry.emoji}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{entry.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{entry.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default MoodInsights
