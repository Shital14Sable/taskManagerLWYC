import { useState, useEffect, useMemo, useRef } from 'react';
import { Target, ChevronDown, ChevronUp, Eye, FolderOpen, Repeat, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useGoals } from '@/hooks/useGoals';
import type { GoalProgress } from '@/hooks/useGoals';
import type { Goal, GoalCategory } from '@trackmind/core';
import { GoalVisionBoard } from '@/pages/GoalsView';
import { cn } from '@/lib/utils';

interface GoalsWidgetProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const CATEGORY_COLORS: Record<GoalCategory, string> = {
  career: 'text-blue-500',
  health: 'text-green-500',
  personal: 'text-purple-500',
  learning: 'text-amber-500',
  financial: 'text-emerald-500',
  relationships: 'text-pink-500',
  other: 'text-gray-500',
};

export function GoalsWidget({ isCollapsed, onToggleCollapse }: GoalsWidgetProps) {
  const { goals, activeGoals, getProgress } = useGoals();
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [goalProgress, setGoalProgress] = useState<GoalProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [goalsProgressMap, setGoalsProgressMap] = useState<Record<string, GoalProgress>>({});
  const loadedGoalIdsRef = useRef<string>('');

  // Get top goals (up to 4) - use stable reference
  const topGoals = useMemo(() => activeGoals.slice(0, 4), [activeGoals]);

  // Load progress for all top goals
  useEffect(() => {
    if (isCollapsed || topGoals.length === 0) return;

    const goalIds = topGoals.map(g => g.id).sort().join(',');
    if (loadedGoalIdsRef.current === goalIds) return;
    loadedGoalIdsRef.current = goalIds;

    async function loadAllProgress() {
      const progressMap: Record<string, GoalProgress> = {};
      for (const goal of topGoals) {
        try {
          progressMap[goal.id] = await getProgress(goal.id);
        } catch (error) {
          console.error(`Failed to load progress for goal ${goal.id}:`, error);
        }
      }
      setGoalsProgressMap(progressMap);
    }

    loadAllProgress();
  }, [isCollapsed, topGoals, getProgress]);

  // Periodically refresh progress
  useEffect(() => {
    if (isCollapsed || topGoals.length === 0) return;

    const interval = setInterval(() => {
      loadedGoalIdsRef.current = ''; // Force refresh
      const goalIds = topGoals.map(g => g.id).sort().join(',');
      loadedGoalIdsRef.current = goalIds;

      async function loadAllProgress() {
        const progressMap: Record<string, GoalProgress> = {};
        for (const goal of topGoals) {
          try {
            progressMap[goal.id] = await getProgress(goal.id);
          } catch (error) {
            console.error(`Failed to load progress for goal ${goal.id}:`, error);
          }
        }
        setGoalsProgressMap(progressMap);
      }

      loadAllProgress();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [isCollapsed, topGoals, getProgress]);

  // Load progress when a goal is selected for Vision Board
  useEffect(() => {
    if (!selectedGoal) {
      setGoalProgress(null);
      return;
    }

    let cancelled = false;
    setLoadingProgress(true);

    getProgress(selectedGoal.id)
      .then(progress => {
        if (!cancelled) {
          setGoalProgress(progress);
        }
      })
      .catch(error => {
        console.error('Failed to load goal progress:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProgress(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedGoal, getProgress]);

  return (
    <>
      <Card className="bg-card/50">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4" />
              Goals
              {activeGoals.length > 0 && (
                <span className="text-xs text-muted-foreground">({activeGoals.length})</span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggleCollapse}>
              {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </Button>
          </div>
        </CardHeader>

        {!isCollapsed && (
          <CardContent className="py-2 px-3">
            {topGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No active goals</p>
            ) : (
              <div className="space-y-2">
                {topGoals.map(goal => {
                  const progress = goalsProgressMap[goal.id];
                  return (
                    <button
                      key={goal.id}
                      onClick={() => setSelectedGoal(goal)}
                      className="w-full text-left p-2 rounded hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-xs font-medium capitalize", CATEGORY_COLORS[goal.category])}>
                          {goal.category}
                        </span>
                        <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-sm font-medium truncate">{goal.title}</p>
                      {/* Show breakdown stats instead of single percentage */}
                      {progress ? (
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          {progress.linked_projects > 0 && (
                            <span className="flex items-center gap-0.5" title="Projects">
                              <FolderOpen className="h-3 w-3" />
                              {progress.projects.filter(p => p.progress === 100).length}/{progress.linked_projects}
                            </span>
                          )}
                          {progress.habits.length > 0 && (
                            <span className="flex items-center gap-0.5 text-green-500" title="Habit completions">
                              <Repeat className="h-3 w-3" />
                              {progress.habits.reduce((sum, h) => sum + h.completion_count, 0)}x
                            </span>
                          )}
                          {(progress.total_tasks > 0) && (
                            <span className="flex items-center gap-0.5" title="Tasks completed">
                              <CheckSquare className="h-3 w-3" />
                              {progress.completed_tasks}/{progress.total_tasks}
                            </span>
                          )}
                          {progress.subGoals.length > 0 && (
                            <span className="flex items-center gap-0.5" title="Sub-goals achieved">
                              <Target className="h-3 w-3" />
                              {progress.subGoals.filter(g => g.status === 'achieved').length}/{progress.subGoals.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground mt-1">Loading...</div>
                      )}
                    </button>
                  );
                })}
                {activeGoals.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{activeGoals.length - 4} more goals
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Vision Board Dialog */}
      <Dialog open={!!selectedGoal} onOpenChange={(open) => !open && setSelectedGoal(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Vision Board: {selectedGoal?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              View goal progress breakdown including projects, habits, and tasks
            </DialogDescription>
          </DialogHeader>
          {selectedGoal && goalProgress ? (
            <GoalVisionBoard goal={selectedGoal} progress={goalProgress} goals={goals} />
          ) : loadingProgress ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedGoal(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
