import { useState, useEffect } from 'react'
import { ClipboardCheck, Calendar, CalendarDays, CalendarRange, RefreshCw, CheckCircle, AlertCircle, Clock, Target, Repeat, ListChecks, AlertTriangle, ArrowLeft, Star, Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useReviews } from '@/hooks/useReviews'
import type { Review, ReviewType } from '@/types'
import { cn } from '@/lib/utils'

interface ReviewsViewProps {
  onBack?: () => void
}

const REVIEW_TYPE_ICONS: Record<ReviewType, typeof Calendar> = {
  daily: Calendar,
  weekly: CalendarDays,
  monthly: CalendarRange,
}

const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

export function ReviewsView({ onBack }: ReviewsViewProps) {
  const { dailyReviews, weeklyReviews, monthlyReviews, currentReview, loading, getDaily, getWeekly, getMonthly, updateReviewNotes, setCurrentReview, refetch } = useReviews()
  const [activeTab, setActiveTab] = useState<ReviewType>('daily')
  const [generating, setGenerating] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    // Load today's review on mount
    handleGenerateReview('daily')
  }, [])

  const handleGenerateReview = async (type: ReviewType) => {
    setGenerating(true)
    try {
      if (type === 'daily') {
        await getDaily()
      } else if (type === 'weekly') {
        await getWeekly()
      } else {
        await getMonthly()
      }
      refetch()
    } catch (err) {
      console.error('Failed to generate review:', err)
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectReview = (review: Review) => {
    setCurrentReview(review)
    setNotes(review.notes || '')
    setEditingNotes(false)
  }

  const handleSaveNotes = async () => {
    if (!currentReview) return
    const periodKey = currentReview.review_type === 'daily'
      ? currentReview.date
      : currentReview.review_type === 'weekly'
        ? `${currentReview.date.split('-')[0]}-W${Math.ceil(new Date(currentReview.date).getDate() / 7)}`
        : currentReview.date.substring(0, 7)

    await updateReviewNotes(currentReview.review_type, periodKey, notes)
    setEditingNotes(false)
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'text-green-500'
    if (score >= 60) return 'text-amber-500'
    return 'text-red-500'
  }

  const getProductivityBg = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900'
    if (score >= 60) return 'bg-amber-100 dark:bg-amber-900'
    return 'bg-red-100 dark:bg-red-900'
  }

  const renderReviewContent = (review: Review) => {
    const content = review.content

    return (
      <div className="space-y-6">
        {/* Productivity Score */}
        <Card className={cn(getProductivityBg(content.productivity_score))}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Productivity Score</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on task completion and activity
                </p>
              </div>
              <div className={cn("text-4xl font-bold", getProductivityColor(content.productivity_score))}>
                {content.productivity_score}
                <span className="text-lg text-muted-foreground">/100</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          {/* Tasks Completed */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Tasks Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-2xl font-bold">{content.tasks_completed.completed_count}</div>
              {content.tasks_completed.total_time_spent > 0 && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(content.tasks_completed.total_time_spent / 60)}h total
                </p>
              )}
              {content.tasks_completed.completed_tasks.length > 0 && (
                <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                  {content.tasks_completed.completed_tasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {content.tasks_completed.completed_tasks.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      +{content.tasks_completed.completed_tasks.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stale Tasks */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Stale Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="text-2xl font-bold">{content.tasks_completed.stale_count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                No activity in 7+ days
              </p>
              {content.tasks_completed.stale_tasks.length > 0 && (
                <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                  {content.tasks_completed.stale_tasks.slice(0, 5).map((task) => (
                    <div key={task.id} className="text-xs text-muted-foreground flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Deadlines */}
        {content.tasks_completed.upcoming_deadlines.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                {content.tasks_completed.upcoming_deadlines.map((task) => (
                  <div key={task.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{task.title}</span>
                    <Badge variant={task.days_until <= 1 ? 'destructive' : task.days_until <= 3 ? 'default' : 'secondary'}>
                      {task.days_until === 0 ? 'Today' : task.days_until === 1 ? 'Tomorrow' : `${task.days_until} days`}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Goals Progress */}
        {content.goals_progress.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-500" />
                Goals Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-3">
                {content.goals_progress.map((goal) => (
                  <div key={goal.goal_id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="font-medium">{goal.title}</span>
                      <span className="text-muted-foreground">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-1.5" />
                    {goal.tasks_completed_in_period > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        +{goal.tasks_completed_in_period} tasks completed this period
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Habits Summary */}
        {content.habits_summary.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Repeat className="h-4 w-4 text-orange-500" />
                Habits
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                {content.habits_summary.map((habit) => (
                  <div key={habit.habit_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span>{habit.title}</span>
                      {habit.current_streak > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {habit.current_streak} day streak
                        </Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {habit.completed_count}/{habit.scheduled_count} ({Math.round(habit.completion_rate)}%)
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lists Summary */}
        {content.lists_summary.length > 0 && (
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-cyan-500" />
                Lists
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="space-y-2">
                {content.lists_summary.map((list) => (
                  <div key={list.list_id} className="flex items-center justify-between text-sm">
                    <span>{list.name}</span>
                    <span className="text-muted-foreground">
                      {list.pending_count} pending
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Highlights */}
        {content.highlights.length > 0 && (
          <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-green-700 dark:text-green-300">
                <Star className="h-4 w-4" />
                Highlights
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <ul className="space-y-1">
                {content.highlights.map((highlight, idx) => (
                  <li key={idx} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Areas for Improvement */}
        {content.areas_for_improvement.length > 0 && (
          <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Lightbulb className="h-4 w-4" />
                Areas for Improvement
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <ul className="space-y-1">
                {content.areas_for_improvement.map((area, idx) => (
                  <li key={idx} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {area}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Personal Notes */}
        <Card>
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Personal Notes</CardTitle>
              {!editingNotes && (
                <Button variant="ghost" size="sm" onClick={() => { setNotes(review.notes || ''); setEditingNotes(true) }}>
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="py-2">
            {editingNotes ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your reflections..."
                  rows={4}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {review.notes || 'No notes yet. Add your reflections and thoughts.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading && !currentReview) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading reviews...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6" />
              Reviews
            </h2>
            <p className="text-sm text-muted-foreground">
              Reflect on your progress and identify areas for improvement
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReviewType)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="daily" className="gap-2">
              <Calendar className="h-4 w-4" />
              Daily
            </TabsTrigger>
            <TabsTrigger value="weekly" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="gap-2">
              <CalendarRange className="h-4 w-4" />
              Monthly
            </TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleGenerateReview(activeTab)}
            disabled={generating}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", generating && "animate-spin")} />
            Generate {REVIEW_TYPE_LABELS[activeTab]} Review
          </Button>
        </div>

        <div className="grid grid-cols-12 gap-4 mt-4">
          {/* Review History Sidebar */}
          <div className="col-span-3">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm">History</CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <TabsContent value="daily" className="mt-0">
                  {dailyReviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No daily reviews yet
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {dailyReviews.map((review) => (
                        <button
                          key={review.id}
                          onClick={() => handleSelectReview(review)}
                          className={cn(
                            "w-full text-left text-sm p-2 rounded hover:bg-accent transition-colors",
                            currentReview?.id === review.id && "bg-accent"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span>{formatDate(review.date)}</span>
                            <span className={cn("text-xs font-medium", getProductivityColor(review.content.productivity_score))}>
                              {review.content.productivity_score}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="weekly" className="mt-0">
                  {weeklyReviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No weekly reviews yet
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {weeklyReviews.map((review) => (
                        <button
                          key={review.id}
                          onClick={() => handleSelectReview(review)}
                          className={cn(
                            "w-full text-left text-sm p-2 rounded hover:bg-accent transition-colors",
                            currentReview?.id === review.id && "bg-accent"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs">{formatDateRange(review.period_start, review.period_end)}</span>
                            <span className={cn("text-xs font-medium", getProductivityColor(review.content.productivity_score))}>
                              {review.content.productivity_score}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="monthly" className="mt-0">
                  {monthlyReviews.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No monthly reviews yet
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-[400px] overflow-y-auto">
                      {monthlyReviews.map((review) => (
                        <button
                          key={review.id}
                          onClick={() => handleSelectReview(review)}
                          className={cn(
                            "w-full text-left text-sm p-2 rounded hover:bg-accent transition-colors",
                            currentReview?.id === review.id && "bg-accent"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <span>{new Date(review.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                            <span className={cn("text-xs font-medium", getProductivityColor(review.content.productivity_score))}>
                              {review.content.productivity_score}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Card>
          </div>

          {/* Review Content */}
          <div className="col-span-9">
            {currentReview ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  {(() => {
                    const Icon = REVIEW_TYPE_ICONS[currentReview.review_type]
                    return <Icon className="h-5 w-5 text-primary" />
                  })()}
                  <div>
                    <h3 className="font-semibold">
                      {REVIEW_TYPE_LABELS[currentReview.review_type]} Review
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {currentReview.review_type === 'daily'
                        ? formatDate(currentReview.date)
                        : formatDateRange(currentReview.period_start, currentReview.period_end)}
                    </p>
                  </div>
                </div>
                {renderReviewContent(currentReview)}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Generate a review to see your progress</p>
                  <Button
                    className="mt-4"
                    onClick={() => handleGenerateReview(activeTab)}
                    disabled={generating}
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-2", generating && "animate-spin")} />
                    Generate {REVIEW_TYPE_LABELS[activeTab]} Review
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Tabs>
    </div>
  )
}
