import { useMemo } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface DeadlinesWidgetProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface DeadlineTask {
  id: string;
  title: string;
  deadline: Date;
  daysUntil: number;
  projectName?: string;
  priority: number;
}

export function DeadlinesWidget({ isCollapsed, onToggleCollapse }: DeadlinesWidgetProps) {
  const { tasks, projects } = useApp();

  const upcomingDeadlines = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const deadlines: DeadlineTask[] = [];

    for (const task of tasks) {
      if (!task.deadline || task.status === 'completed') continue;

      const deadline = new Date(task.deadline);
      deadline.setHours(0, 0, 0, 0);

      if (deadline <= threeDaysFromNow) {
        const daysUntil = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const project = projects.find(p => p.id === task.project_id);

        deadlines.push({
          id: task.id,
          title: task.title,
          deadline,
          daysUntil,
          projectName: project?.name,
          priority: task.priority,
        });
      }
    }

    // Sort by deadline (soonest first), then by priority
    return deadlines.sort((a, b) => {
      if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
      return b.priority - a.priority;
    });
  }, [tasks, projects]);

  // Group by days until deadline
  const groupedDeadlines = useMemo(() => {
    const groups: { label: string; color: string; tasks: DeadlineTask[] }[] = [];

    const overdue = upcomingDeadlines.filter(d => d.daysUntil < 0);
    const today = upcomingDeadlines.filter(d => d.daysUntil === 0);
    const tomorrow = upcomingDeadlines.filter(d => d.daysUntil === 1);
    const inTwoDays = upcomingDeadlines.filter(d => d.daysUntil === 2);
    const inThreeDays = upcomingDeadlines.filter(d => d.daysUntil === 3);

    if (overdue.length > 0) groups.push({ label: 'Overdue', color: 'text-red-500', tasks: overdue });
    if (today.length > 0) groups.push({ label: 'Today', color: 'text-orange-500', tasks: today });
    if (tomorrow.length > 0) groups.push({ label: 'Tomorrow', color: 'text-yellow-500', tasks: tomorrow });
    if (inTwoDays.length > 0) groups.push({ label: 'In 2 days', color: 'text-blue-500', tasks: inTwoDays });
    if (inThreeDays.length > 0) groups.push({ label: 'In 3 days', color: 'text-muted-foreground', tasks: inThreeDays });

    return groups;
  }, [upcomingDeadlines]);

  const hasUrgent = upcomingDeadlines.some(d => d.daysUntil <= 1);

  return (
    <Card className={cn("bg-card/50", hasUrgent && "border-red-500/30")}>
      <CardHeader className="py-2 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className={cn("h-4 w-4", hasUrgent && "text-red-500")} />
            Deadlines
            {upcomingDeadlines.length > 0 && (
              <Badge variant={hasUrgent ? "destructive" : "secondary"} className="text-xs px-1.5 py-0 h-5">
                {upcomingDeadlines.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onToggleCollapse}>
            {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="py-2 px-3">
          {upcomingDeadlines.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              No deadlines in the next 3 days
            </p>
          ) : (
            <div className="space-y-3">
              {groupedDeadlines.map(group => (
                <div key={group.label}>
                  <div className={cn("text-xs font-medium mb-1 flex items-center gap-1", group.color)}>
                    {group.label === 'Overdue' && <AlertCircle className="h-3 w-3" />}
                    {group.label}
                    <span className="text-muted-foreground">({group.tasks.length})</span>
                  </div>
                  <div className="space-y-1">
                    {group.tasks.slice(0, 3).map(task => (
                      <div
                        key={task.id}
                        className={cn(
                          "text-sm px-2 py-1 rounded bg-accent/30",
                          group.label === 'Overdue' && "bg-red-500/10 border border-red-500/20"
                        )}
                      >
                        <p className="truncate">{task.title}</p>
                        {task.projectName && (
                          <p className="text-xs text-muted-foreground truncate">{task.projectName}</p>
                        )}
                      </div>
                    ))}
                    {group.tasks.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-2">
                        +{group.tasks.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
