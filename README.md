# TrackMind — Smart Task Manager

> v1.4.0 · Local-first PWA · Energy & cycle-aware scheduling

TrackMind is an offline-capable, privacy-first task manager that schedules work around your natural energy — including your menstrual cycle. All data lives in your browser (IndexedDB) and optionally syncs to your own GitHub repository or Google Drive. No subscription. No central server.

---

## Features at a glance

| Category | What's included |
|---|---|
| **Scheduling** | Priority + deadline + energy matching · Automatic breaks · Cycle-phase task spreading · Office hours time windows |
| **Cycle tracking** | 4 seasonal phases · Rolling average from period history · Manual override · Phase banner in Today view · Calendar overlays (Today, Week, Month) |
| **Projects** | Hierarchical projects · Inline deadline setting · "Distribute by Cycle" one-click spreading · Scheduled date shown per task |
| **Office hours** | Restrict one project to a fixed time window (Mon–Fri 9–5, etc.) · Per-day toggles · Single-day overrides |
| **Additional projects** | Restrict all non-office tasks to a separate time window · Same per-day + override controls |
| **Habits** | Daily / weekly / monthly recurrence · Streak tracking · Pause & resume |
| **Goals** | Yearly / quarterly / monthly · 7 categories · Linked to projects, tasks, habits · Vision board |
| **Mood** | Per-block check-ins · Daily trends · Insights by time-of-day and day-of-week |
| **Journal** | Daily + topic entries · Mood integration · Time-of-day prompts · Folder hierarchy |
| **Notes** | Markdown · Folder hierarchy · Linked to tasks / projects / goals |
| **Lists** | Eternal, template, and quick lists · Rich item metadata (price, rating, URL…) |
| **Analytics** | Completion rates · Productivity trends · Habit heatmaps · Badge progress |
| **Gamification** | XP · Levels · 28 achievement badges · Streaks |
| **Sync** | GitHub (git-based) · Google Drive · Export / import JSON |
| **PWA** | Installable · Offline-capable · Auto-updating service worker |

---

## The four cycle phases

TrackMind maps the menstrual cycle to the four seasons and uses this to automatically schedule the right type of work on the right days.

| Season | Phase | Days | Energy | Best for |
|---|---|---|---|---|
| ❄️ Winter | Menstruation | 1–5 | Low | Rest · Reflection · Editing · Solo deep work · Strategic planning |
| 🌱 Spring | Follicular | 6–13 | High | New projects · Deep learning · Creative work · Brainstorming · Complex tasks |
| ☀️ Summer | Ovulation | 14–16 | High | Presentations · Negotiations · Networking · Leading · Pitching ideas |
| 🍂 Autumn | Luteal | 17–28 | Medium | Completing projects · Admin · Editing · Organizing · Following up |

Phases scale automatically to your actual cycle length (21–60 days). All phase data is calculated locally from your period history — nothing leaves your device.

---

## Quick start

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)

### Install & run

```bash
git clone https://github.com/RajeshDM/task_manager.git
cd task_manager

# Install dependencies
pnpm install

# Build core packages (required before first run)
pnpm run build:packages

# Start the development server
pnpm --filter @trackmind/web dev

# Or build everything for production
pnpm build
```

Open **http://localhost:5173** in your browser.

### First-time setup

The **Setup Wizard** launches automatically and guides you through:

1. **Welcome** — introduction to TrackMind
2. **Work Hours** — configure your working hours per day
3. **Sample Data** — optionally add an example project, tasks, habit, and goal
4. **Done** — tips to get started

---

## Views

| View | Description |
|---|---|
| **Today** | Daily schedule · Cycle phase banner below the date · Habit check-ins · Task finder by time |
| **Week** | 7-column week grid · Tinted phase header per day · Phase name label · Energy icons per task |
| **Month** | Full month grid · Phase background fill per cell · Phase timeline bar · Day detail on click |
| **Projects** | Project list · Status filtering · Sub-project hierarchy |
| **Project detail** | Task list with scheduled date/time · Stats · Quick-add · Set deadline · Distribute by Cycle |
| **Habits** | All habits · Streak heatmap · Pause / resume |
| **Goals** | Goal list + Vision Board · Time horizon filter · Progress bars |
| **Lists** | Eternal, template, and quick lists · Category filtering |
| **Notes** | Markdown notes · Folder tree · Search |
| **Journal** | Daily + topic entries · Mood integration · Folder hierarchy |
| **Reviews** | Daily / weekly / monthly review history · Productivity scores |
| **Analytics** | Completion trends · Time-period filters · Priority breakdown |
| **Badges** | Earned badges · Progress toward next badge |
| **Mood Insights** | Mood analytics · By time-of-day · By day-of-week · Trend chart |

---

## Cycle tracking

### Setup

1. Open **Settings → Cycle** (gear icon in the header)
2. Toggle **Enable cycle tracking** on
3. Add your period start dates — more history improves accuracy
4. The app computes a rolling average cycle length automatically (shown once you have 2+ dates)
5. Use **Phase override** if your period arrived early or late

### What you'll see

| Where | What |
|---|---|
| **Today view** | Coloured pill badge below the date: season emoji · phase name · cycle day · energy level · invitation |
| **Week view** | Each day card header tinted in the phase colour · phase name label (e.g. 🌱 Follicular) |
| **Month view** | Each day cell filled with a subtle phase tint · phase emoji in the corner · phase timeline bar across the top of the grid |
| **Sidebar calendar** | 3 px coloured strip at the top of each day cell |
| **Sidebar widget** | Full phase card: energy level · best tasks · quick override dropdown |

---

## Project deadline + cycle distribution

1. Open any project → click **Set deadline** below the project title
2. Click **Distribute by Cycle**
3. The app analyses every task using energy level, difficulty, priority, and keywords from the title and tags, then assigns each task an evenly-spaced slot across the full deadline window, snapping each to the nearest phase-appropriate day
4. A per-phase breakdown is shown (e.g. ❄️ 2 · 🌱 5 · ☀️ 1 · 🍂 4)
5. Go to Today view → **Reschedule All** to apply

To undo, click **Reset dates** (appears after distributing).

### Scheduled date in the task list

Every task in the project list shows when it is scheduled:
- **Blue text** — confirmed slot: `Today · 9:00am–10:00am`
- **Muted italic** — date hint set but not yet scheduled: `Jun 15 (pending reschedule)`

---

## Office hours & additional project hours

TrackMind lets you pin specific projects to fixed time windows so they never spill into personal time (or vice versa).

### Office Hours

Settings → Work Hours → **Office Hours** card:

| Setting | Description |
|---|---|
| Enable toggle | Activates office-hours scheduling |
| Project | The one project whose tasks are restricted to these hours |
| Weekly schedule | Per-day enable toggle + start/end time (Mon–Sun, default Mon–Fri 09:00–17:00) |
| Single-day overrides | Add a specific date with custom hours or mark it as closed (e.g. public holidays) |

Tasks from the office project are withheld on closed days and placed only within the configured window during open days.

### Additional Projects

Settings → Work Hours → **Additional Projects** card — same controls but no project selector. When enabled, **all tasks that are not from the office project** are restricted to this window. Useful for separating focused work hours from other commitments.

---

## Scheduling

The scheduler runs when you click **Reschedule All** in the Today view. It places tasks into available time slots, optimising for:

- Deadline urgency (35%)
- Task priority (35%)
- Energy level match (15%) — driven by the current cycle phase when tracking is enabled
- Time fit (15%)

**Cycle energy**: when cycle tracking is enabled, every time slot of the day gets the current phase's energy level (low / medium / high) instead of the manually configured per-hour energy blocks.

**Date spreading**: tasks assigned a `scheduled_for` date (by Distribute by Cycle) are hidden from the scheduler until that date arrives, preventing front-loading.

**Time windows**: tasks from the office project (and optionally all other tasks via Additional Projects) are hard-restricted to their configured hours — the scheduler will not place them outside that window.

---

## Sync

### GitHub (recommended)

1. Install GitHub CLI: `brew install gh` (Mac) or see [cli.github.com](https://cli.github.com)
2. Authenticate: `gh auth login`
3. In the app: **Settings → Sync → Connect GitHub**
4. Create or link a private data repo

Sync is debounced (30 s after the last change) and runs automatically every 5 minutes. Manual sync is available in the Sync tab.

### Google Drive

**Settings → Sync → Connect Google** — OAuth login. Data is saved to your personal Drive.

### Export / Import

**Settings → Data** lets you download all data as JSON or restore from a previous export.

---

## Settings tabs

| Tab | Contents |
|---|---|
| **Sync** | GitHub + Google Drive auth · Manual sync / force push / pull · Pending changes |
| **Work Hours** | **Office Hours** card (project + per-day schedule + date overrides) · **Additional Projects** card (all other tasks, same controls) · Scheduling preferences (max continuous work, min task duration) |
| **Cycle** | Enable toggle · Period history (add / remove dates) · Auto-computed average cycle length · Phase override |
| **Data** | Export JSON · Import JSON · Clear all data |
| **Help** | Documentation · Restart setup wizard · Help mode toggle |

---

## Gamification

| Mechanic | Details |
|---|---|
| **XP** | Earned on task completion · `difficulty × (minutes/30) × 1.5` for habits |
| **Levels** | Quadratic progression: `10 × level^1.5` XP per level |
| **Badges** | 28 badges across task completion, streaks, habit milestones, time management, and level milestones |
| **Streaks** | Activity streaks (3 / 7 / 30 days) · Habit-specific streaks · Perfect-day streaks |

---

## Tech stack

| Layer | Technology |
|---|---|
| **Framework** | React 19 · TypeScript 5 |
| **Build** | Vite 7 · pnpm workspaces |
| **UI** | Tailwind CSS 3 · Shadcn UI · Radix UI primitives |
| **Icons** | Lucide React |
| **Storage** | IndexedDB (via custom adapter) |
| **NLP** | chrono-node (natural language date/time parsing) |
| **Drag & Drop** | @dnd-kit/core + @dnd-kit/sortable |
| **PWA** | vite-plugin-pwa · Workbox |
| **Sync** | Custom GitHub API + Google Drive API clients |
| **Packages** | `@trackmind/core` (models + scheduler) · `@trackmind/storage` · `@trackmind/sync` |

---

## Project structure

```
taskManagerLWYC/
├── packages/
│   ├── core/          # Data models, scheduler, gamification logic
│   │   └── src/
│   │       ├── models/    # Task, Project, Goal, Preferences (Cycle + OfficeHours), etc.
│   │       └── services/  # Scheduler (time-window aware), GamificationService
│   ├── storage/       # IndexedDB, SQLite, and in-memory storage adapters
│   ├── sync/          # GitHub and Google Drive sync engines
│   └── web/           # React frontend (PWA)
│       └── src/
│           ├── pages/       # 14 full-page views
│           ├── components/  # UI components + sidebar widgets
│           ├── hooks/       # Data access hooks (useTasks, useSchedule, etc.)
│           ├── context/     # AppContext (global state, storage, sync)
│           └── utils/       # cycle.ts (phase calc, distribution, office-hours overlay)
├── CLAUDE.md          # AI coding guidelines for this repo
├── setup.sh           # Installation script
└── pnpm-workspace.yaml
```

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Global search |
| `Shift + ?` | Toggle Help Mode |
| `Esc` | Close dialogs / exit help mode |

---

## Troubleshooting

**Tasks all pile up on day one**
After running Distribute by Cycle, click **Reschedule All** in Today view. The scheduler automatically extends its horizon to cover all assigned dates.

**Cycle phases not showing in the calendar**
Go to Settings → Cycle, enable tracking, and add at least one period start date.

**Office-hours tasks scheduled outside the window**
Check that Office Hours is enabled, a project is selected, and the correct days are toggled on. Then click Reschedule All.

**PWA showing old version**
The service worker updates automatically. To force it: DevTools → Application → Service Workers → click **Update**, then refresh. Or do a hard refresh (`Ctrl+Shift+R`).

**Reset everything**
Settings → Data → **Clear All Data** wipes all tasks, projects, schedules, and preferences.

**Reset just a project's cycle distribution**
Open the project → click **Reset dates** to clear all `scheduled_for` assignments on that project's tasks.

---

## Contributing

1. Fork the repo
2. `pnpm install`
3. `pnpm run build:packages` — compile core packages
4. `pnpm --filter @trackmind/web dev` — start the dev server with HMR
5. Changes to `packages/core` or `packages/sync` require re-running `pnpm run build:packages` and restarting the dev server

Follow the guidelines in [CLAUDE.md](CLAUDE.md) — particularly around version bumps, backward-compatible data model changes, and the local-first architecture constraints.

---

**TrackMind** — work with your biology, not against it.
