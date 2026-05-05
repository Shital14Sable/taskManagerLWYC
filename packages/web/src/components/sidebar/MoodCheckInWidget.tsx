import { useState, useMemo } from 'react';
import { Smile, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useMood } from '@/hooks/useMood';
import type { MoodBlockStatus } from '@/hooks/useMood';
import type { MoodLevel } from '@trackmind/core';
import { cn } from '@/lib/utils';

interface MoodCheckInWidgetProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const MOOD_OPTIONS: { level: MoodLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '😢', label: 'Very Low' },
  { level: 2, emoji: '😔', label: 'Low' },
  { level: 3, emoji: '😐', label: 'Neutral' },
  { level: 4, emoji: '🙂', label: 'Good' },
  { level: 5, emoji: '😄', label: 'Great' },
];

export function MoodCheckInWidget({ isCollapsed, onToggleCollapse }: MoodCheckInWidgetProps) {
  const { moodBlocks, getTodayBlockStatus, logMood, weekStats, loading } = useMood();
  const [showDetails, setShowDetails] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<MoodBlockStatus | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodLevel | null>(null);
  const [moodNote, setMoodNote] = useState('');

  // Use the hook's callback - it's already memoized with useCallback
  const blockStatus = useMemo(() => getTodayBlockStatus(), [getTodayBlockStatus]);

  const handleBlockClick = (block: MoodBlockStatus) => {
    // Allow editing for current and past blocks (not future)
    if (!block.isCurrent && !block.isPast) {
      return; // Future block - can't log
    }
    setSelectedBlock(block);
    // Pre-fill with existing mood if editing
    setSelectedMood(block.mood?.level ?? null);
    setMoodNote(block.mood?.note ?? '');
  };

  const handleMoodSelect = (level: MoodLevel) => {
    setSelectedMood(level);
  };

  const handleSaveMood = async () => {
    if (!selectedBlock || !selectedMood) return;

    // Create a timestamp within the block's time range
    // For past blocks, use a timestamp in the middle of that block
    // For current block, use current time
    let timestamp: string | undefined;

    if (!selectedBlock.isCurrent) {
      // For past blocks, create a timestamp in the middle of the block
      const today = new Date();
      const [startH, startM] = selectedBlock.block.start.split(':').map(Number);
      const [endH, endM] = selectedBlock.block.end.split(':').map(Number);

      // Calculate middle of block
      let startMinutes = startH * 60 + startM;
      let endMinutes = endH * 60 + endM;

      // Handle overnight blocks
      if (endMinutes <= startMinutes) {
        endMinutes += 24 * 60;
      }

      const middleMinutes = Math.floor((startMinutes + endMinutes) / 2);
      const middleH = Math.floor(middleMinutes / 60) % 24;
      const middleM = middleMinutes % 60;

      const blockTime = new Date(today);
      blockTime.setHours(middleH, middleM, 0, 0);
      timestamp = blockTime.toISOString();
    }

    await logMood({
      level: selectedMood,
      note: moodNote || undefined,
      timestamp,
    });

    setSelectedBlock(null);
    setSelectedMood(null);
    setMoodNote('');
  };

  const getTrendIcon = () => {
    if (weekStats.trend === 'improving') return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (weekStats.trend === 'declining') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  return (
    <>
      <Card className="bg-card/50">
        <CardHeader className="py-2 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Smile className="h-4 w-4" />
              Mood
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
            ) : moodBlocks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No mood blocks configured</p>
            ) : (
              <div className="space-y-3">
                {/* Quick mood picker for each block */}
                <div className="space-y-1.5">
                  {blockStatus.map((status, index) => (
                    <button
                      key={status.block.id}
                      onClick={() => handleBlockClick(status)}
                      disabled={!status.isCurrent && !status.isPast && !status.mood}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded text-sm transition-colors",
                        status.isCurrent && "bg-primary/10 border border-primary/30",
                        status.isPast && !status.mood && "bg-accent/30 hover:bg-accent/50",
                        status.mood && "bg-accent/20",
                        !status.isCurrent && !status.isPast && !status.mood && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs",
                          status.isCurrent && "font-medium text-primary"
                        )}>
                          {status.block.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {status.block.start}-{status.block.end}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {status.mood ? (
                          <span className="text-lg" title={`${status.mood.label} - Click to edit`}>
                            {status.mood.emoji}
                          </span>
                        ) : status.isCurrent ? (
                          <span className="text-xs text-primary">Log now</span>
                        ) : status.isPast ? (
                          <span className="text-xs text-muted-foreground">Tap to log</span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Upcoming</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Week summary */}
                {weekStats.entryCount > 0 && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/50">
                    <span className="text-muted-foreground">
                      This week ({weekStats.entryCount} entries)
                    </span>
                    <div className="flex items-center gap-1">
                      {getTrendIcon()}
                      <span>
                        {MOOD_OPTIONS.find(m => m.level === Math.round(weekStats.average))?.emoji || '😐'}
                        <span className="text-muted-foreground ml-1">
                          avg {weekStats.average.toFixed(1)}
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Toggle details */}
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                >
                  {showDetails ? '▾ Hide details' : '▸ Show details'}
                </button>

                {/* Detailed view */}
                {showDetails && (
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    {Object.entries(weekStats.byDate).slice(-7).map(([date, moods]) => {
                      const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
                      const avg = moods.reduce((sum, m) => sum + m.level, 0) / moods.length;
                      return (
                        <div key={date} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{dayName}</span>
                          <div className="flex items-center gap-1">
                            {moods.map((m, i) => (
                              <span key={i} className="text-sm" title={`${m.label}${m.note ? ': ' + m.note : ''}`}>
                                {m.emoji}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {Object.keys(weekStats.byDate).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center">
                        No mood data this week
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Mood picker dialog */}
      <Dialog open={!!selectedBlock} onOpenChange={(open) => !open && setSelectedBlock(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              How are you feeling?
              {selectedBlock && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({selectedBlock.block.name})
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Select your mood level and optionally add a note
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Emoji picker */}
            <div className="flex justify-center gap-2 mb-4">
              {MOOD_OPTIONS.map(option => (
                <button
                  key={option.level}
                  onClick={() => handleMoodSelect(option.level)}
                  className={cn(
                    "p-3 rounded-lg text-3xl transition-all hover:scale-110",
                    selectedMood === option.level
                      ? "bg-primary/20 ring-2 ring-primary scale-110"
                      : "hover:bg-accent"
                  )}
                  title={option.label}
                >
                  {option.emoji}
                </button>
              ))}
            </div>

            {/* Selected mood label */}
            {selectedMood && (
              <p className="text-center text-sm text-muted-foreground mb-4">
                {MOOD_OPTIONS.find(m => m.level === selectedMood)?.label}
              </p>
            )}

            {/* Optional note */}
            <Textarea
              placeholder="Add a note (optional)"
              value={moodNote}
              onChange={(e) => setMoodNote(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBlock(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMood} disabled={!selectedMood}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
