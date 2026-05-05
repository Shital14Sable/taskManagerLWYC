// Models
export * from './models';

// Services
export { Scheduler, type SchedulerConfig, type ScheduleGenerationOptions } from './services/scheduler';
export { GamificationService, type XPCalculation, type LevelProgress } from './services/gamification';
export { AnalyticsService, type ProductivityMetrics, type BurnoutAssessment, type WeeklyReport, type TaskStats } from './services/analytics';
export { AutoTagger } from './services/auto-tagger';
export { SearchService, type SearchResult, type SearchOptions } from './services/search';
export { ReviewService, type ReviewGenerationOptions } from './services/reviews';

// Utils - export specific functions to avoid conflicts with models/preferences
// (timeToMinutes and minutesToTime are already exported from models/preferences)
export {
  parseTimeRange,
  isTimeInRange,
  getAvailableSlots,
  calculateBufferTime,
  roundToInterval,
  formatDuration,
  addMinutesToTime,
  calculateTimeOverlap,
  getDayName,
  toISODateString,
  parseISODate,
  isSameDay,
  isBeforeDay,
  isAfterDay,
  today,
  daysBetween,
  format,
  parseISO,
  addDays,
  addMinutes,
  isAfter,
  isBefore,
  startOfDay,
  getDay,
} from './utils/date-utils';
export * from './utils/validation';
