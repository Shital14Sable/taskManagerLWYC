import { useState, useEffect, useRef, useCallback } from 'react';
import { BarChart3, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useReviews } from '@/hooks/useReviews';
import type { Review } from '@trackmind/core';
import { cn } from '@/lib/utils';

interface WeeklyReviewWidgetProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function WeeklyReviewWidget({ isCollapsed, onToggleCollapse }: WeeklyReviewWidgetProps) {
  const { getWeekly } = useReviews();
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasLoadedRef = useRef(false);
  const getWeeklyRef = useRef(getWeekly);

  // Keep ref updated without triggering re-renders
  useEffect(() => {
    getWeeklyRef.current = getWeekly;
  }, [getWeekly]);

  const loadReview = useCallback(async () => {
    setLoading(true);
    try {
      const weeklyReview = await getWeeklyRef.current();
      setReview(weeklyReview);
    } catch (error) {
      console.error('Failed to load weekly review:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load when widget becomes visible
  useEffect(() => {
    if (isCollapsed) return;
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadReview();
    }
  }, [isCollapsed, loadReview]);

  // Periodically refresh to pick up task/habit completions
  useEffect(() => {
    if (isCollapsed) return;

    const interval = setInterval(() => {
      loadReview();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isCollapsed, loadReview]);

  const taskCompletion = review?.content.task_summary
    ? Math.round((review.content.task_summary.completed / Math.max(review.content.task_summary.total, 1)) * 100)
    : 0;

  const habitCompletion = review?.content.habit_summary
    ? Math.round((review.content.habit_summary.filter(h => h.completed).length / Math.max(review.content.habit_summary.length, 1)) * 100)
    : 0;

  const productivityScore = review?.content.productivity_score ?? 0;

  // Determine trend icon
  const getTrendIcon = () => {
    if (!review?.content.productivity_score) return <Minus className="h-3 w-3 text-muted-foreground" />;
    if (productivityScore >= 70) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (productivityScore <= 40) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-yellow-500" />;
  };

  // Get week date range
  const getWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const formatDate = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
    return `${formatDate(monday)} - ${formatDate(sunday)}`;
  };

  return (
    <Card className="bg-card/50">
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Weekly Review
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggleCollapse}>
            {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="py-2 px-3">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-2">Loading...</p>
          ) : !review ? (
            <p className="text-xs text-muted-foreground text-center py-2">No review data</p>
          ) : (
            <div className="space-y-2">
              {/* Collapsed summary view (default) */}
              {!expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full text-left space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{getWeekRange()}</span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon()}
                      <span className={cn(
                        "font-medium",
                        productivityScore >= 70 ? "text-green-500" :
                          productivityScore <= 40 ? "text-red-500" : "text-yellow-500"
                      )}>
                        {productivityScore}/100
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Click to expand
                  </p>
                </button>
              )}

              {/* Expanded view */}
              {expanded && (
                <>
                  <div className="text-xs text-muted-foreground mb-2">{getWeekRange()}</div>

                  {/* Task completion */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Tasks</span>
                      <span className="text-muted-foreground">
                        {review.content.task_summary?.completed ?? 0}/{review.content.task_summary?.total ?? 0}
                      </span>
                    </div>
                    <Progress value={taskCompletion} className="h-1.5" />
                  </div>

                  {/* Habit compliance */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Habits</span>
                      <span className="text-muted-foreground">{habitCompletion}%</span>
                    </div>
                    <Progress value={habitCompletion} className="h-1.5" />
                  </div>

                  {/* Productivity score */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1">
                      Score
                      {getTrendIcon()}
                    </span>
                    <span className={cn(
                      "font-medium",
                      productivityScore >= 70 ? "text-green-500" :
                        productivityScore <= 40 ? "text-red-500" : "text-yellow-500"
                    )}>
                      {productivityScore}/100
                    </span>
                  </div>

                  {/* Highlights */}
                  {review.content.highlights && review.content.highlights.length > 0 && (
                    <div className="pt-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Highlights:</p>
                      <p className="text-xs truncate">{review.content.highlights[0]}</p>
                    </div>
                  )}

                  {/* Notes */}
                  {review.notes && (
                    <div className="pt-1">
                      <p className="text-[10px] text-muted-foreground mb-1">Note:</p>
                      <p className="text-xs line-clamp-2">{review.notes}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setExpanded(false)}
                    className="text-xs text-muted-foreground hover:text-foreground w-full text-left"
                  >
                    ▾ Collapse
                  </button>
                </>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
