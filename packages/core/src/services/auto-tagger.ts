/**
 * Auto-tagger service - suggests tags based on task content
 */

interface TagPattern {
  pattern: RegExp;
  tags: string[];
}

const TAG_PATTERNS: TagPattern[] = [
  // Meeting-related
  { pattern: /\b(meeting|call|sync|standup|1:1|1-on-1)\b/i, tags: ['meeting'] },
  { pattern: /\b(zoom|teams|google meet|video call)\b/i, tags: ['meeting', 'video'] },

  // Communication
  { pattern: /\b(email|reply|respond|follow.?up)\b/i, tags: ['communication'] },
  { pattern: /\b(slack|message|chat)\b/i, tags: ['communication', 'quick'] },

  // Development
  { pattern: /\b(code|develop|implement|build|debug|fix bug)\b/i, tags: ['dev'] },
  { pattern: /\b(review|PR|pull request|code review)\b/i, tags: ['dev', 'review'] },
  { pattern: /\b(deploy|release|launch)\b/i, tags: ['dev', 'deploy'] },
  { pattern: /\b(test|testing|QA)\b/i, tags: ['dev', 'testing'] },

  // Documentation
  { pattern: /\b(document|doc|write.?up|readme)\b/i, tags: ['docs'] },
  { pattern: /\b(spec|specification|design doc)\b/i, tags: ['docs', 'design'] },

  // Planning
  { pattern: /\b(plan|planning|roadmap|strategy)\b/i, tags: ['planning'] },
  { pattern: /\b(brainstorm|ideate|explore)\b/i, tags: ['planning', 'creative'] },

  // Research
  { pattern: /\b(research|investigate|analyze|study)\b/i, tags: ['research'] },
  { pattern: /\b(learn|course|tutorial|training)\b/i, tags: ['learning'] },

  // Administrative
  { pattern: /\b(admin|expense|invoice|report)\b/i, tags: ['admin'] },
  { pattern: /\b(schedule|calendar|organize)\b/i, tags: ['admin', 'organize'] },

  // Health
  { pattern: /\b(exercise|workout|gym|run|yoga)\b/i, tags: ['health', 'exercise'] },
  { pattern: /\b(meditat|mindful|relax)\b/i, tags: ['health', 'mental'] },
  { pattern: /\b(doctor|appointment|checkup)\b/i, tags: ['health', 'medical'] },

  // Personal
  { pattern: /\b(grocery|shopping|buy|purchase)\b/i, tags: ['personal', 'shopping'] },
  { pattern: /\b(clean|organize|declutter)\b/i, tags: ['personal', 'home'] },
  { pattern: /\b(birthday|anniversary|gift)\b/i, tags: ['personal', 'event'] },

  // Finance
  { pattern: /\b(budget|finance|money|payment|pay)\b/i, tags: ['finance'] },
  { pattern: /\b(tax|taxes|accounting)\b/i, tags: ['finance', 'taxes'] },

  // Priority indicators
  { pattern: /\b(urgent|asap|critical|important)\b/i, tags: ['priority/high'] },
  { pattern: /\b(whenever|low priority|when free)\b/i, tags: ['priority/low'] },

  // Time-related
  { pattern: /\b(daily|every day|recurring)\b/i, tags: ['recurring'] },
  { pattern: /\b(weekly|every week)\b/i, tags: ['recurring', 'weekly'] },
  { pattern: /\b(quick|fast|short|5 min|10 min)\b/i, tags: ['quick'] },
  { pattern: /\b(deep work|focus|concentrate)\b/i, tags: ['deep-work'] },
];

export class AutoTagger {
  /**
   * Suggest tags based on task title and description
   */
  suggestTags(title: string, description?: string | null): string[] {
    const text = `${title} ${description || ''}`.toLowerCase();
    const suggestedTags = new Set<string>();

    for (const { pattern, tags } of TAG_PATTERNS) {
      if (pattern.test(text)) {
        for (const tag of tags) {
          suggestedTags.add(tag);
        }
      }
    }

    return Array.from(suggestedTags);
  }

  /**
   * Get tag suggestions with confidence scores
   */
  suggestTagsWithConfidence(
    title: string,
    description?: string | null
  ): Array<{ tag: string; confidence: number }> {
    const text = `${title} ${description || ''}`.toLowerCase();
    const tagScores = new Map<string, number>();

    for (const { pattern, tags } of TAG_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        // Higher confidence for title matches
        const inTitle = title.toLowerCase().match(pattern);
        const score = inTitle ? 1.0 : 0.7;

        for (const tag of tags) {
          const current = tagScores.get(tag) || 0;
          tagScores.set(tag, Math.max(current, score));
        }
      }
    }

    return Array.from(tagScores.entries())
      .map(([tag, confidence]) => ({ tag, confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Suggest energy level based on task content
   */
  suggestEnergyLevel(title: string, description?: string | null): 'low' | 'medium' | 'high' {
    const text = `${title} ${description || ''}`.toLowerCase();

    // High energy indicators
    const highEnergyPatterns = [
      /\b(code|develop|implement|build|debug|design|create|write|analyze|research)\b/,
      /\b(deep work|focus|concentrate|complex|difficult)\b/,
      /\b(meeting|presentation|call)\b/,
    ];

    // Low energy indicators
    const lowEnergyPatterns = [
      /\b(email|reply|respond|review|check|organize|file|clean)\b/,
      /\b(admin|routine|simple|easy|quick)\b/,
      /\b(read|watch|listen)\b/,
    ];

    let highScore = 0;
    let lowScore = 0;

    for (const pattern of highEnergyPatterns) {
      if (pattern.test(text)) highScore++;
    }

    for (const pattern of lowEnergyPatterns) {
      if (pattern.test(text)) lowScore++;
    }

    if (highScore > lowScore) return 'high';
    if (lowScore > highScore) return 'low';
    return 'medium';
  }

  /**
   * Estimate task duration based on content
   */
  suggestDuration(title: string, description?: string | null): number {
    const text = `${title} ${description || ''}`.toLowerCase();

    // Quick tasks (15-30 min)
    const quickPatterns = [
      /\b(quick|fast|short|5 min|10 min|15 min)\b/,
      /\b(email|reply|respond|check|review)\b/,
    ];

    // Long tasks (90+ min)
    const longPatterns = [
      /\b(deep work|focus session|full|complete|thorough)\b/,
      /\b(document|write|develop|implement|build|create)\b/,
      /\b(2 hour|3 hour|half day|all day)\b/,
    ];

    for (const pattern of quickPatterns) {
      if (pattern.test(text)) return 30;
    }

    for (const pattern of longPatterns) {
      if (pattern.test(text)) return 120;
    }

    // Default to 60 minutes
    return 60;
  }
}
