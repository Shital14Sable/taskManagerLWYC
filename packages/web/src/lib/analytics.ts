/**
 * Analytics tracking utilities for Google Analytics
 *
 * Tracks growth metrics:
 * - New sign-ups vs returning logins
 * - Weekly/Daily active users (automatic via GA)
 * - Feature engagement
 * - User retention patterns
 *
 * Cross-device tracking:
 * - Uses User ID to link sessions when users authenticate
 * - Same user on multiple devices = 1 user in reports
 */

// GA4 Measurement ID
const GA_MEASUREMENT_ID = 'G-KCSCJV4WVK';

// Check if gtag is available
function gtag(...args: unknown[]): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args);
  }
}

// Storage key for tracking first-time users
const FIRST_AUTH_KEY = 'trackmind_first_auth';

/**
 * Set User ID for cross-device tracking
 * This links sessions from multiple devices to the same user
 */
export function setUserId(userId: string): void {
  gtag('config', GA_MEASUREMENT_ID, {
    user_id: userId,
  });
  console.log('[Analytics] Set user_id for cross-device tracking');
}

/**
 * Check if this is a first-time user (new sign-up)
 */
function isFirstTimeUser(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(FIRST_AUTH_KEY) === null;
}

/**
 * Mark user as having signed up
 */
function markUserAsSignedUp(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(FIRST_AUTH_KEY, new Date().toISOString());
  }
}

/**
 * Track user authentication (sign-up or login)
 * Automatically distinguishes between new and returning users
 */
export function trackAuth(method: 'google' | 'github'): void {
  const isNewUser = isFirstTimeUser();

  if (isNewUser) {
    // New user sign-up
    gtag('event', 'sign_up', {
      method: method,
    });
    markUserAsSignedUp();
    console.log('[Analytics] Tracked new sign-up via', method);
  } else {
    // Returning user login
    gtag('event', 'login', {
      method: method,
    });
    console.log('[Analytics] Tracked returning login via', method);
  }
}

/**
 * Track session start (when app loads with authenticated user)
 */
export function trackSessionStart(method: 'google' | 'github'): void {
  gtag('event', 'session_start', {
    auth_method: method,
  });
}

/**
 * Track feature usage - helps identify valuable features
 */
export function trackFeatureUse(
  feature:
    | 'task_create'
    | 'task_complete'
    | 'habit_complete'
    | 'project_create'
    | 'goal_create'
    | 'note_create'
    | 'journal_entry'
    | 'mood_log'
    | 'sync_manual'
    | 'list_create'
    | 'schedule_view'
    | 'review_complete',
  metadata?: Record<string, string | number>
): void {
  gtag('event', feature, metadata);
}

/**
 * Track page/view navigation
 */
export function trackPageView(pageName: string): void {
  gtag('event', 'page_view', {
    page_title: pageName,
    page_location: window.location.href,
  });
}

/**
 * Track user engagement metrics
 */
export function trackEngagement(action: string, value?: number): void {
  gtag('event', 'engagement', {
    action: action,
    value: value,
  });
}

/**
 * Track errors for debugging
 */
export function trackError(errorType: string, errorMessage: string): void {
  gtag('event', 'exception', {
    description: `${errorType}: ${errorMessage}`,
    fatal: false,
  });
}
