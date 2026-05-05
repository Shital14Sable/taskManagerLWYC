import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sunrise, Sun, CloudSun, Moon, Clock, Lightbulb, TrendingUp, Loader2 } from 'lucide-react'
import { analyticsApi, type ProductivityPatterns as ProductivityPatternsType } from '@/api/client'
import { cn } from '@/lib/utils'

const TIME_BLOCK_ICONS: Record<string, React.ReactNode> = {
  early_morning: <Sunrise className="h-4 w-4 text-orange-400" />,
  morning: <Sun className="h-4 w-4 text-yellow-500" />,
  midday: <Sun className="h-4 w-4 text-amber-500" />,
  afternoon: <CloudSun className="h-4 w-4 text-blue-400" />,
  evening: <Moon className="h-4 w-4 text-indigo-400" />,
  night: <Moon className="h-4 w-4 text-purple-500" />,
}

const TIME_BLOCK_LABELS: Record<string, string> = {
  early_morning: 'Early Morning (5-8 AM)',
  morning: 'Morning (9-11 AM)',
  midday: 'Midday (12-1 PM)',
  afternoon: 'Afternoon (2-5 PM)',
  evening: 'Evening (6-9 PM)',
  night: 'Night (10 PM-4 AM)',
}

export function ProductivityPatterns() {
  const [patterns, setPatterns] = useState<ProductivityPatternsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const data = await analyticsApi.getProductivityPatterns(30)
        setPatterns(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load productivity patterns')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !patterns) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {error || 'No data available'}
        </CardContent>
      </Card>
    )
  }

  // Sort time blocks by completion rate
  const sortedBlocks = Object.entries(patterns.time_blocks)
    .filter(([_, stats]) => stats.scheduled > 0)
    .sort(([, a], [, b]) => b.completion_rate - a.completion_rate)

  // Get peak productive hours (filter to only those with data)
  const activeHours = patterns.hourly_data.filter(h => h.scheduled > 0)

  return (
    <div className="space-y-6">
      {/* Insights */}
      {patterns.insights.length > 0 && (
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Lightbulb className="h-4 w-4" />
              Productivity Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {patterns.insights.map((insight, i) => (
                <li key={i} className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {insight}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Time Blocks Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Performance by Time of Day
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedBlocks.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No data available yet. Complete some scheduled tasks to see your patterns.
            </p>
          ) : (
            sortedBlocks.map(([blockName, stats]) => {
              const isBest = blockName === patterns.best_time_block
              const isWorst = blockName === patterns.worst_time_block

              return (
                <div key={blockName} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {TIME_BLOCK_ICONS[blockName]}
                      <span className="text-sm font-medium">
                        {TIME_BLOCK_LABELS[blockName] || blockName}
                      </span>
                      {isBest && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                          Best
                        </Badge>
                      )}
                      {isWorst && sortedBlocks.length > 1 && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                          Needs work
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {stats.completed}/{stats.scheduled} ({Math.round(stats.completion_rate * 100)}%)
                    </div>
                  </div>
                  <Progress
                    value={stats.completion_rate * 100}
                    className={cn(
                      "h-2",
                      isBest && "[&>div]:bg-green-500",
                      isWorst && sortedBlocks.length > 1 && "[&>div]:bg-red-400"
                    )}
                  />
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Hourly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Hourly Activity (Last 30 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeHours.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hourly data available yet.
            </p>
          ) : (
            <div className="flex items-end justify-between gap-1 h-32">
              {patterns.hourly_data.map((hour) => {
                const maxScheduled = Math.max(...patterns.hourly_data.map(h => h.scheduled))
                const barHeight = maxScheduled > 0 ? (hour.scheduled / maxScheduled) * 100 : 0
                const completionHeight = hour.scheduled > 0 ? (hour.completed / hour.scheduled) * barHeight : 0

                // Only show labels for every 3 hours
                const showLabel = hour.hour % 3 === 0

                return (
                  <div key={hour.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full relative rounded-t group cursor-help"
                      style={{ height: `${barHeight}%`, minHeight: hour.scheduled > 0 ? '4px' : '0' }}
                      title={`${hour.hour_label}: ${hour.completed}/${hour.scheduled} completed (${Math.round(hour.completion_rate * 100)}%)`}
                    >
                      {/* Background (scheduled) */}
                      <div className="absolute inset-0 bg-muted rounded-t" />
                      {/* Foreground (completed) */}
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-primary rounded-t transition-all"
                        style={{ height: `${(completionHeight / barHeight) * 100 || 0}%` }}
                      />
                    </div>
                    {showLabel && (
                      <span className="text-[10px] text-muted-foreground">
                        {hour.hour}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-muted" /> Scheduled
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-primary" /> Completed
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Peak Hours */}
      {patterns.peak_hours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Peak Productivity Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {patterns.peak_hours.map(({ hour, stats }, index) => (
                <div
                  key={hour}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg",
                    index === 0
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                      : "bg-muted"
                  )}
                >
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{hour}:00</span>
                  <span className="text-sm opacity-75">
                    ({stats.completed}/{stats.scheduled})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ProductivityPatterns
