# TrackMind - Smart Task Manager

A smart task manager with energy-based scheduling, habit tracking, mood monitoring, journaling, and goal management - all through a beautiful web UI.

## Key Features

### Productivity
- **Energy-Based Scheduling**: Tasks are scheduled when your energy matches their difficulty
- **Smart Planning**: Automatic scheduling based on priorities, deadlines, and dependencies
- **Per-Day Work Hours**: Configure different work hours for each day of the week
- **Automatic Breaks**: 15-minute breaks every 2 hours to prevent burnout

### Habits & Wellbeing
- **Habit Tracking**: Build routines with recurring habits and streak tracking
- **Mood Tracking**: Log your mood throughout the day and discover patterns
- **Journal**: Daily journaling with prompts, mood integration, and reflection
- **Mood Insights**: Analytics showing mood by time of day, day of week, and trends

### Goals & Organization
- **Goals**: Set yearly, quarterly, and monthly goals linked to projects, tasks, and habits
- **Vision Board**: Visualize how your work connects to your goals
- **Projects**: Organize related tasks together with status tracking
- **Notes**: Hierarchical markdown notes with Obsidian/Evernote compatibility
- **Lists**: Running lists, quick lists, and templates for flexible item management

### Gamification
- **XP System**: Earn XP by completing tasks (habits earn 1.5x bonus!)
- **Levels & Badges**: Track progress with 16 achievement badges
- **Streaks**: Build consistency with streak tracking

### Sync & Access
- **Multi-Device Sync**: Git-based sync across machines (GitHub/Gists support)
- **Calendar Export**: Export schedules to ICS format
- **Data Export**: Export all data to JSON for backup or analysis

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+ (for backend server)
- GitHub CLI (`gh`) for multi-device sync (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/RajeshDM/task_manager.git
cd task_manager

# Run the setup script (recommended)
./setup.sh

# Or manual setup:
pip install -e .
cd packages/web && npm install && npm run build && cd ../..
```

### Start the Application

```bash
# Start the server
task-server
```

Open http://localhost:3000 in your browser to access the Web UI.

## Web UI Guide

### First Time Setup

When you first open TrackMind, the **Setup Wizard** will guide you through:

1. **Welcome** - Introduction to TrackMind features
2. **Energy Patterns** - Set your morning/afternoon/evening energy levels
3. **Sample Data** - Option to add example project, tasks, habit, and goal
4. **Done** - Quick tips to get started

### Navigation

The left sidebar provides access to all features:

- **Today** - Your scheduled tasks and habits for today
- **Projects** - Manage projects and their tasks
- **Habits** - View and manage recurring habits
- **Goals** - Set and track long-term objectives
- **Journal** - Daily journaling with prompts
- **Mood Insights** - Mood analytics and patterns
- **Notes** - Markdown notes organization
- **Lists** - Running lists and quick lists
- **Analytics** - Productivity trends and patterns
- **Dependencies** - Task dependency visualization

### Key Actions

#### Creating Tasks
- Click **"New Task"** button in any view
- Use **Quick Capture** for natural language input (e.g., "Review report tomorrow 2h high priority")
- Press **Cmd/Ctrl + K** for global search

#### Managing Habits
- Navigate to **Habits** view
- Click **"New Habit"** to create recurring routines
- Set frequency (daily/weekly), specific days, and time of day
- Track streaks and pause/resume habits as needed

#### Setting Goals
- Navigate to **Goals** view
- Click **"New Goal"** to create objectives
- Choose time horizon (Yearly/Quarterly/Monthly) and category
- Link projects, tasks, and habits to automatically track progress
- Use **Vision Board** to visualize goal connections

#### Mood Tracking
- Use the **Mood Check-In Widget** in the sidebar
- Select your current mood level (1-5)
- Add optional notes about how you're feeling
- View insights in **Mood Insights** page

#### Journaling
- Navigate to **Journal** view
- Click **"New Entry"** to create a journal entry
- Use guided prompts based on time of day
- Set mood on entries and import completed items

#### Scheduling
- Click **"Reschedule"** in Today view to auto-schedule tasks
- Tasks are scheduled based on:
  - Deadline urgency (35%)
  - Task priority (25%)
  - Energy matching (15%)
  - Difficulty weighting (15%)
  - Time fit (10%)

### Settings

Access Settings via the gear icon in the header:

- **Energy Patterns** - Configure high/medium/low energy blocks per day
- **Work Hours** - Set different work hours for each day
- **Sync** - Configure GitHub/Google Drive sync
- **Export** - Export data to JSON
- **Help** - Restart setup wizard, access documentation

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + K | Open Global Search |
| Shift + ? | Toggle Help Mode |
| Esc | Close dialogs / Exit help mode |

### Help Mode

Press **Shift + ?** or click the eye button in the bottom-right corner to activate interactive Help Mode. UI elements are highlighted with explanations.

## Energy Patterns

Energy patterns are the key to smart scheduling. Configure when you're most productive:

| Energy Level | Best For | Examples |
|--------------|----------|----------|
| **High** | Complex problem-solving, learning | Deep coding, architecture, writing |
| **Medium** | Standard work, reviews | Meetings, testing, refactoring |
| **Low** | Simple tasks, admin | Documentation, emails, planning |

Configure in **Settings > Energy Patterns**. You can set different patterns for each day of the week.

Energy matching is a **soft preference** (15% score bonus) - tasks won't be skipped if energy doesn't match, but they get a bonus when they do.

## Multi-Device Sync

### GitHub Sync Setup

1. Install GitHub CLI: `brew install gh` (Mac) or see [gh docs](https://github.com/cli/cli)
2. Authenticate: `gh auth login`
3. Create private data repo: `gh repo create taskman-data --private`
4. Configure in **Settings > Sync**

Sync happens automatically:
- Pull on startup
- Sync every 2 minutes
- Final sync on shutdown

## Development

### Running in Development Mode

```bash
# Terminal 1: Start backend
task-server

# Terminal 2: Start frontend dev server (hot reload)
cd packages/web
npm run dev
```

The dev frontend runs at http://localhost:5173 and proxies API calls to the backend.

### Running Tests

```bash
pip install -e ".[dev]"
pytest
```

### Project Structure

```
packages/
├── web/          # React frontend (TypeScript, Tailwind, Shadcn UI)
├── core/         # Shared models and types
└── storage/      # Storage adapters (IndexedDB, SQLite, Memory)
```

## Troubleshooting

### Server won't start

Make sure port 3000 is not in use:
```bash
lsof -i :3000  # Mac/Linux
```

### Tasks not scheduling

Check that:
1. Tasks have time estimates
2. Energy patterns are configured in Settings
3. Work hours are set in Settings
4. Dependencies are satisfied

### Sync not working

1. Check GitHub authentication: `gh auth status`
2. Verify data repository exists
3. Check Settings > Sync for errors

### Reset everything

To start fresh:
```bash
rm -rf $TASKMAN_DATA_DIR/*  # Or check config for data location
```

Then restart the server.

## Getting Help

- Press **Shift + ?** for interactive Help Mode
- Click the help button in the bottom-right corner
- Access Documentation via Settings > Help
- Open an issue on GitHub for bugs or feature requests

---

**TrackMind** - Smart task management that works with your energy, not against it.
