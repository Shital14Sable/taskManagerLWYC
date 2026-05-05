/**
 * Natural Language Parser for Task Input
 * Parses dates, priorities, and time estimates from natural language text
 */
import * as chrono from 'chrono-node'

export interface ParsedTask {
  title: string
  deadline?: Date
  priority?: number
  estimatedMinutes?: number
  energyLevel?: 'low' | 'medium' | 'high'
}

// Priority keywords and their values
const PRIORITY_PATTERNS: Array<{ pattern: RegExp; priority: number; energyLevel?: 'low' | 'medium' | 'high' }> = [
  { pattern: /\b(critical|urgent|asap|emergency)\b/i, priority: 5, energyLevel: 'high' },
  { pattern: /\bhigh\s*(?:priority|prio)?\b/i, priority: 4, energyLevel: 'high' },
  { pattern: /\bimportant\b/i, priority: 4 },
  { pattern: /\bmedium\s*(?:priority|prio)?\b/i, priority: 3, energyLevel: 'medium' },
  { pattern: /\bnormal\s*(?:priority|prio)?\b/i, priority: 3 },
  { pattern: /\blow\s*(?:priority|prio)?\b/i, priority: 2, energyLevel: 'low' },
  { pattern: /\bwhenever\b/i, priority: 1, energyLevel: 'low' },
  { pattern: /\boptional\b/i, priority: 1, energyLevel: 'low' },
]

// Time estimate patterns
const TIME_PATTERNS: Array<{ pattern: RegExp; getMinutes: (match: RegExpMatchArray) => number }> = [
  // "2 hours", "2h", "2hrs"
  {
    pattern: /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i,
    getMinutes: (match) => Math.round(parseFloat(match[1]) * 60)
  },
  // "30 minutes", "30min", "30m", "30 mins"
  {
    pattern: /\b(\d+)\s*(?:minutes?|mins?|m)\b/i,
    getMinutes: (match) => parseInt(match[1])
  },
  // "1.5 hours" - handled by first pattern
  // "90 min" - handled by second pattern
]

// Energy level patterns
const ENERGY_PATTERNS: Array<{ pattern: RegExp; level: 'low' | 'medium' | 'high' }> = [
  { pattern: /\b(?:high\s*energy|intense|challenging|hard)\b/i, level: 'high' },
  { pattern: /\b(?:medium\s*energy|moderate)\b/i, level: 'medium' },
  { pattern: /\b(?:low\s*energy|easy|simple|quick)\b/i, level: 'low' },
]

/**
 * Parse natural language task input
 * @param input - Natural language task description
 * @returns Parsed task fields
 */
export function parseTaskInput(input: string): ParsedTask {
  let title = input.trim()
  let deadline: Date | undefined
  let priority: number | undefined
  let estimatedMinutes: number | undefined
  let energyLevel: 'low' | 'medium' | 'high' | undefined

  // Parse date using chrono
  const dateResults = chrono.parse(input)
  if (dateResults.length > 0) {
    const result = dateResults[0]
    deadline = result.start.date()

    // Remove the date text from the title
    const dateText = input.substring(result.index, result.index + result.text.length)
    title = title.replace(dateText, '').trim()

    // Clean up common date prefixes that might be left
    title = title.replace(/\b(?:by|on|due|until|before)\s*$/i, '').trim()
    title = title.replace(/^\s*(?:by|on|due|until|before)\b/i, '').trim()
  }

  // Parse priority
  for (const { pattern, priority: prio, energyLevel: energy } of PRIORITY_PATTERNS) {
    const match = title.match(pattern)
    if (match) {
      priority = prio
      if (energy && !energyLevel) {
        energyLevel = energy
      }
      // Remove the priority text from the title
      title = title.replace(pattern, '').trim()
      break
    }
  }

  // Parse time estimate
  for (const { pattern, getMinutes } of TIME_PATTERNS) {
    const match = title.match(pattern)
    if (match) {
      estimatedMinutes = getMinutes(match)
      // Remove the time text from the title
      title = title.replace(pattern, '').trim()
      break
    }
  }

  // Parse energy level (if not already set by priority)
  if (!energyLevel) {
    for (const { pattern, level } of ENERGY_PATTERNS) {
      const match = title.match(pattern)
      if (match) {
        energyLevel = level
        // Remove the energy text from the title
        title = title.replace(pattern, '').trim()
        break
      }
    }
  }

  // Clean up the title
  title = title
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/^[\s,\-–—]+/, '') // Leading punctuation
    .replace(/[\s,\-–—]+$/, '') // Trailing punctuation
    .trim()

  return {
    title,
    deadline,
    priority,
    estimatedMinutes,
    energyLevel,
  }
}

/**
 * Format a parsed result preview for the user
 * @param parsed - Parsed task result
 * @returns Human-readable preview string
 */
export function formatParsedPreview(parsed: ParsedTask): string {
  const parts: string[] = []

  if (parsed.deadline) {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (parsed.deadline.toDateString() === today.toDateString()) {
      parts.push('Due: Today')
    } else if (parsed.deadline.toDateString() === tomorrow.toDateString()) {
      parts.push('Due: Tomorrow')
    } else {
      parts.push(`Due: ${parsed.deadline.toLocaleDateString()}`)
    }
  }

  if (parsed.priority) {
    const priorityLabels: Record<number, string> = {
      1: 'Very Low',
      2: 'Low',
      3: 'Medium',
      4: 'High',
      5: 'Critical',
    }
    parts.push(`Priority: ${priorityLabels[parsed.priority]}`)
  }

  if (parsed.estimatedMinutes) {
    if (parsed.estimatedMinutes >= 60) {
      const hours = Math.floor(parsed.estimatedMinutes / 60)
      const mins = parsed.estimatedMinutes % 60
      parts.push(`Time: ${hours}h${mins > 0 ? ` ${mins}m` : ''}`)
    } else {
      parts.push(`Time: ${parsed.estimatedMinutes}m`)
    }
  }

  if (parsed.energyLevel) {
    parts.push(`Energy: ${parsed.energyLevel}`)
  }

  return parts.join(' • ')
}

/**
 * Check if input contains any parseable patterns
 * @param input - Input text to check
 * @returns True if input contains parseable patterns
 */
export function hasParsableContent(input: string): boolean {
  // Check for dates
  const dateResults = chrono.parse(input)
  if (dateResults.length > 0) return true

  // Check for priority keywords
  for (const { pattern } of PRIORITY_PATTERNS) {
    if (pattern.test(input)) return true
  }

  // Check for time estimates
  for (const { pattern } of TIME_PATTERNS) {
    if (pattern.test(input)) return true
  }

  // Check for energy level
  for (const { pattern } of ENERGY_PATTERNS) {
    if (pattern.test(input)) return true
  }

  return false
}
