# TrackMind — Smart Task Manager

> v1.3.2 · Local-first PWA · Energy & cycle-aware scheduling

TrackMind is an offline-capable, privacy-first task manager that schedules work around your natural energy — including your menstrual cycle. All data lives in your browser (IndexedDB) and optionally syncs to your own GitHub repository or Google Drive. No subscription. No central server.

---

## Features at a glance

| Category | What's included |
|---|---|
| **Scheduling** | Priority + deadline + energy matching · Automatic breaks · Cycle-phase spreading across project deadlines |
| **Cycle tracking** | 4 seasonal phases · Rolling average from period history · Manual override · Calendar overlays · Phase-aware task distribution |
| **Projects** | Hierarchical projects · Deadline setting · "Distribute by Cycle" one-click spreading |
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

# Start the development server
pnpm --filter @trackmind/web dev

# Or build for production
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
| **Today** | Daily schedule · Habit check-ins · Task finder by time · Real-time progress |
| **Week** | 7-column week grid · Cycle phase labels on each day · Energy icons per task |
| **Month** | Full month grid · Phase timeline bar · Phase colour strips per day · Day detail on click |
| **Projects** | Project list · Status filtering · Sub-project hierarchy |
| **Project detail** | Task list · Stats · Quick-add · Set deadline · Distribute by Cycle |
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

## Cycle tracking setup

1. Open **Settings → Cycle** (gear icon in the header)
2. Toggle **Enable cycle tracking** on
3. Add your period start dates under **Period start dates** — more history improves accuracy
4. The app computes a rolling average cycle length automatically (shown once you have 2+ dates)
5. Use **Phase override** if your period arrived early or late

Once enabled you'll see:
- **Cycle Phase widget** in the Today sidebar — current season, energy level, best tasks, quick override dropdown
- **Coloured strips** on every day in the MiniCalendar, Week view, and Month view
- **Phase timeline bar** in Month view showing proportional phase segments across the month

---

## Project deadline + cycle distribution

1. Open any project → click **Set deadline** (below the project title)
2. Click **Distribute by Cycle**
3. The app:
   - Scores every task against all four phases using energy level, difficulty, priority, and keyword analysis of the task title and tags
   - Assigns each task an evenly-spaced position across the full deadline window
   - Snaps each task to the nearest phase-appropriate day
4. The result shows a per-phase breakdown (e.g. ❄️ 2 · 🌱 5 · ☀️ 1 · 🍂 4)
5. Go to Today view → **Reschedule All** to apply

To undo the distribution, click **Reset dates** (appears after distributing).

---

## Scheduling

The scheduler runs when you click **Reschedule All** in the Today view. It places tasks into available time slots, optimising for:

- Deadline urgency (35 %)
- Task priority (35 %)
- Energy level match (15 %) — driven by the current cycle phase when tracking is enabled
- Time fit (15 %)

**When cycle tracking is enabled**, the scheduler sees the current cycle phase energy for every time slot instead of the manually configured energy pattern blocks.

Tasks with a `scheduled_for` date (set by Distribute by Cycle) only become visible to the scheduler on or after that date, so they're not front-loaded onto day one.

---

## Sync

### GitHub (recommended)

1. Install GitHub CLI: `brew install gh` (Mac) or see [cli.github.com](https://cli.github.com)
2. Authenticate: `gh auth login`
3. In the app: **Settings → Sync → Connect GitHub**
4. Create or link a private data repo

Sync is debounced (30 s after the last change) and runs automatically every 5 minutes. Manual sync is available in the Sync tab.

### Google Drive

1. **Settings → Sync → Connect Google** — OAuth login
2. Data is saved to your personal Drive

### Export / Import

**Settings → Data** lets you download all data as JSON or restore from a previous export.

---

## Settings tabs

| Tab | Contents |
|---|---|
| **Sync** | GitHub + Google Drive auth · Manual sync / force push / pull · Pending changes |
| **Work Hours** | Per-day start/end times · Copy-to-all-days · Scheduling preferences (max continuous work, min task duration) |
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
│   │       ├── models/    # Task, Project, Goal, Preferences (+ CyclePreferences), etc.
│   │       └── services/  # Scheduler, GamificationService, AnalyticsService
│   ├── storage/       # IndexedDB, SQLite, and in-memory storage adapters
│   ├── sync/          # GitHub and Google Drive sync engines
│   └── web/           # React frontend (PWA)
│       └── src/
│           ├── pages/       # 14 full-page views
│           ├── components/  # UI components + sidebar widgets
│           ├── hooks/       # Data access hooks (useTasks, useSchedule, etc.)
│           ├── context/     # AppContext (global state, storage, sync)
│           └── utils/       # cycle.ts (phase calculation + distribution)
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
After running Distribute by Cycle, you must click **Reschedule All** in the Today view. The scheduler extends its horizon to cover all assigned dates automatically.

**Cycle phases not showing**
Go to Settings → Cycle, enable tracking, and add at least one period start date.

**Phase timeline bar not visible in Month view**
Cycle tracking must be enabled with at least one period date entered.

**PWA showing old version**
The service worker updates automatically. To force it: open DevTools → Application → Service Workers → click **Update**, then refresh.

**Reset everything**
Settings → Data → **Clear All Data** wipes all tasks, projects, schedules, and preferences.

---

## Contributing

1. Fork the repo
2. `pnpm install`
3. `pnpm --filter @trackmind/web dev` — starts the dev server with HMR
4. Changes to `packages/core` or `packages/sync` require `pnpm run build:packages` and a dev server restart

When making changes, follow the guidelines in [CLAUDE.md](CLAUDE.md) — particularly around version bumps, backward-compatible data model changes, and the local-first architecture constraints.

---

**TrackMind** — work with your biology, not against it.
