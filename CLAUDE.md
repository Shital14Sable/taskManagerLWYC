# Claude AI Guidelines for TrackMind

This document contains important guidelines that must be followed when making changes to this codebase.

## Pre-Change Checklist

Before making any changes, ensure you understand:
- This is a **live production application** used by real users
- The app follows a **local-first, serverless architecture**
- User data is stored in their own Google Drive or GitHub repo (not a central database)

## Required Checks for Every Change

### 1. Version Bump
**Location:** `packages/web/vite.config.ts`

```typescript
const APP_VERSION = 'x.x.x';
```

- **Always increment the version** when making changes
- This forces cache invalidation for users running the PWA
- Use semantic versioning: `MAJOR.MINOR.PATCH`
  - PATCH: Bug fixes, small changes
  - MINOR: New features, non-breaking changes
  - MAJOR: Breaking changes

### 2. Code Stability (Don't Break Production)
- **Always run `pnpm build`** before committing to verify no errors
- Test that existing functionality is not broken
- Be careful with:
  - Database schema changes (IndexedDB)
  - Sync format changes (affects data portability)
  - API changes (affects existing user data)

### 3. User Experience
- **Performance**: Changes should not slow down the app
  - Avoid synchronous blocking operations
  - Use async/await for I/O operations
  - Lazy load when possible
- **No regressions**: New features should not break existing workflows
- **Graceful degradation**: If a feature fails, the app should still work

### 4. Scalability & Cost Considerations
This app is designed to be **cost-efficient** through local-first architecture:

- **DO**: Process data locally in the user's browser
- **DO**: Use client-side storage (IndexedDB)
- **DO**: Sync to user's own storage (Google Drive/GitHub)
- **DO**: Use fire-and-forget analytics (GA4)

- **DON'T**: Add server-side processing that costs money per request
- **DON'T**: Add central databases that scale with user count
- **DON'T**: Add features requiring paid third-party APIs per user

If a change requires server-side costs, **discuss with the user first** including:
- Expected cost per user
- Alternative local-first approaches
- Whether the feature justifies the cost

### 5. Data Migration & Backward Compatibility
**Critical: Users have existing data that must not be corrupted.**

When modifying data structures (models, schemas, storage formats):

#### Always Do:
- **Use optional fields** with sensible defaults for new properties
  ```typescript
  // Good: Old data without this field will still work
  interface Task {
    id: string;
    title: string;
    new_field?: string;  // Optional - won't break old data
  }
  ```

- **Provide default values** when reading data
  ```typescript
  // Good: Gracefully handle missing fields
  const priority = task.priority ?? 'medium';
  const tags = task.tags ?? [];
  ```

- **Never assume fields exist** - always use optional chaining or defaults
  ```typescript
  // Good
  const userName = user?.profile?.name ?? 'Unknown';

  // Bad - will crash if profile is undefined
  const userName = user.profile.name;
  ```

- **Handle type migrations gracefully**
  ```typescript
  // If changing a field type, handle both old and new formats
  const date = typeof task.due === 'string'
    ? task.due
    : task.due?.toISOString();
  ```

#### Never Do:
- **Don't rename fields** without migration logic
- **Don't change field types** without handling old format
- **Don't remove fields** that old code might depend on
- **Don't make previously optional fields required**

#### Testing Data Changes:
1. Test with fresh/empty data (new user)
2. Test with existing data (simulate old user)
3. Verify sync still works (data round-trips correctly)
4. Check that old app versions can still read the data if possible

#### If Breaking Changes Are Unavoidable:
1. Discuss with user first
2. Implement migration logic that runs on app load
3. Version the data format if necessary
4. Log migrations for debugging

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │   React     │  │  IndexedDB  │  │  Service Worker │  │
│  │   Frontend  │  │  (Local DB) │  │  (PWA/Offline)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└───────────────────────────┬─────────────────────────────┘
                            │ Sync (user-initiated)
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────────┐
│ Google Drive  │  │    GitHub     │  │  Google Analytics │
│ (User's own)  │  │ (User's repo) │  │   (Free tier)     │
└───────────────┘  └───────────────┘  └───────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/web/vite.config.ts` | App version, build config |
| `packages/web/src/context/AppContext.tsx` | Main app state & logic |
| `packages/sync/src/engine/sync-engine.ts` | Data sync logic |
| `packages/storage/src/adapters/indexeddb.ts` | Local database |
| `packages/web/src/lib/analytics.ts` | GA4 tracking |

## Commit Guidelines

- Write clear, descriptive commit messages
- Reference what was changed and why
- If fixing a bug, describe what was broken

## Testing

Before pushing:
1. `pnpm build` - Verify no build errors
2. `pnpm typecheck` - Verify no TypeScript errors (if available)
3. Manual test critical paths if making significant changes

## Questions?

If unsure about any change:
- Ask the user before implementing
- Discuss cost implications
- Consider alternative approaches
