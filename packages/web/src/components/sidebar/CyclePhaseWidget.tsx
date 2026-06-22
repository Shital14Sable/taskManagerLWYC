import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { getCyclePhaseFromPrefs, type CyclePhaseInfo } from '@/utils/cycle';
import type { CycleSeason } from '@/utils/cycle';
import { cn } from '@/lib/utils';

interface CyclePhaseWidgetProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const seasonColors: Record<CyclePhaseInfo['season'], { badge: string; border: string; text: string; dot: string }> = {
  winter: {
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  spring: {
    badge: 'bg-green-500/20 text-green-400 border-green-500/30',
    border: 'border-green-500/20',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  summer: {
    badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    border: 'border-yellow-500/20',
    text: 'text-yellow-400',
    dot: 'bg-yellow-400',
  },
  autumn: {
    badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    border: 'border-orange-500/20',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
  },
};

const energyLabels: Record<string, string> = {
  low: 'Low energy',
  medium: 'Medium energy',
  high: 'High energy',
};

export function CyclePhaseWidget({ isCollapsed, onToggleCollapse }: CyclePhaseWidgetProps) {
  const { preferences, savePreferences } = useApp();
  const [showBestFor, setShowBestFor] = useState(false);

  const phase = useMemo(() => {
    if (!preferences) return null;
    return getCyclePhaseFromPrefs(preferences);
  }, [preferences]);

  // Don't render if cycle tracking is disabled or not configured
  if (!preferences?.cycle?.enabled || !phase) return null;

  const colors = seasonColors[phase.season];
  const currentOverride = preferences.cycle.phase_override ?? 'auto';

  const handleOverrideChange = async (val: string) => {
    if (!preferences?.cycle) return;
    const newOverride = val === 'auto' ? null : (val as CycleSeason);
    const today = new Date().toISOString().split('T')[0];
    const updated = {
      ...preferences,
      cycle: {
        ...preferences.cycle,
        phase_override: newOverride,
        // Anchor today as the start of the newly-selected phase so future
        // dates recalculate correctly from this point.
        phase_override_start: newOverride ? today : null,
      },
    };
    await savePreferences(updated);
  };

  return (
    <Card className={cn('border', colors.border)}>
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <span>{phase.emoji}</span>
            <span>Cycle Phase</span>
            {phase.isOverride && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-primary/40 text-primary">
                override
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </Button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Phase name + day */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={cn('text-base font-semibold', colors.text)}>
                {phase.name}: {phase.phase}
              </p>
              <p className="text-xs text-muted-foreground">
                {phase.isOverride
                  ? preferences.cycle?.phase_override_start
                    ? `Manually set · recalculating from ${new Date(preferences.cycle.phase_override_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                    : 'Manually set'
                  : `Day ${phase.cycleDay} · ${
                      phase.daysRemainingInPhase === 0
                        ? 'Last day of this phase'
                        : `${phase.daysRemainingInPhase} day${phase.daysRemainingInPhase !== 1 ? 's' : ''} left`
                    }`}
              </p>
            </div>
            <Badge variant="outline" className={cn('text-xs shrink-0', colors.badge)}>
              {energyLabels[phase.energyLevel]}
            </Badge>
          </div>

          {/* Invitation */}
          <p className="text-xs text-muted-foreground italic border-l-2 pl-2" style={{ borderColor: 'currentColor' }}>
            {phase.invitation}
          </p>

          {/* How you might feel */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">How you might feel</p>
            <ul className="space-y-0.5">
              {phase.howYouMightFeel.slice(0, 2).map((feeling) => (
                <li key={feeling} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className={cn('mt-1.5 h-1 w-1 rounded-full shrink-0', colors.dot)} />
                  {feeling}
                </li>
              ))}
            </ul>
          </div>

          {/* Best for — toggle */}
          <div>
            <button
              className="text-xs font-medium text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={() => setShowBestFor(v => !v)}
            >
              Best tasks for this phase
              {showBestFor ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showBestFor && (
              <ul className="mt-1.5 space-y-0.5">
                {phase.bestFor.map((item) => (
                  <li key={item} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className={cn('mt-1.5 h-1 w-1 rounded-full shrink-0', colors.dot)} />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick phase override */}
          <div className="pt-1 border-t">
            <p className="text-xs text-muted-foreground mb-1.5">Override phase</p>
            <Select value={currentOverride} onValueChange={handleOverrideChange}>
              <SelectTrigger className="h-7 text-xs w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Auto-detect from dates</SelectItem>
                <SelectItem value="winter" className="text-xs">❄️ Winter — Menstruation</SelectItem>
                <SelectItem value="spring" className="text-xs">🌱 Spring — Follicular</SelectItem>
                <SelectItem value="summer" className="text-xs">☀️ Summer — Ovulation</SelectItem>
                <SelectItem value="autumn" className="text-xs">🍂 Autumn — Luteal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
