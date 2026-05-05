# TrackMind - Complete Feature Guide

## Your Intelligent Task Management System

TrackMind is a complete task management system that learns from your work patterns, prevents burnout, automatically schedules your day based on your energy levels, and helps you maintain healthy habits - all through a beautiful web interface.

## Quick Start (60 Seconds)

```bash
# 1. Install (recommended: use setup.sh)
./setup.sh

# Or manual install:
pip install -e .
cd packages/web && npm install && npm run build && cd ../..

# 2. Start server
task-server

# 3. Open Web UI at http://localhost:3000
```

The Setup Wizard will guide you through:
1. Welcome introduction
2. Energy pattern configuration
3. Optional sample data (project, tasks, habit, and goal)

## Core Concepts

### Energy Levels - The Key to Smart Scheduling

TrackMind schedules your tasks based on **energy levels** to match work to your natural rhythms:

| Energy | Icon | Best For | Examples |
|--------|------|----------|----------|
| **High** | 🔥 | Complex problem-solving, learning | Algorithm design, architecture, deep coding |
| **Medium** | ⚡ | Standard work, reviews | Code reviews, testing, refactoring |
| **Low** | 💤 | Simple tasks, admin | Documentation, emails, planning |

**Per-Day Energy Patterns:**
- Configure different energy blocks for each day of the week
- Set your own high/medium/low periods
- Access via **Settings > Energy Patterns**
- Energy matching is a **soft preference** (15% score bonus) - tasks won't be skipped if energy doesn't match

### Habit Tracking - Build Sustainable Routines

TrackMind distinguishes between **work tasks** and **recurring habits** for holistic productivity:

| Type | Purpose | Scheduling | Tracking |
|------|---------|------------|----------|
| **Tasks** | Work deliverables | Flexible, fills gaps | Time estimation, completion |
| **Habits** | Wellbeing routines | Fixed times, blocks schedule | Streak tracking, consistency |

**Habits automatically block time** so work never conflicts with:
- Meals (lunch, dinner)
- Exercise (gym, running)
- Self-care (meditation, journaling)
- Sleep routines

### Automatic Breaks - Prevent Burnout

TrackMind **automatically inserts 15-minute breaks every 2 hours** to:
- Prevent mental fatigue
- Maintain focus and creativity
- Reduce burnout risk
- Keep you sustainable long-term

### Dependencies - Enforce Task Order

Create task dependencies to ensure proper sequencing:
- **Block tasks** until prerequisites are complete
- **Automatic ordering** in schedules
- **Clear visual indicators** of blocked tasks
- **Prevents scheduling errors**

### Learning System - Gets Smarter Over Time

Every time you complete a task with actual time, the system:
1. Tracks your estimation accuracy
2. Learns project-specific patterns
3. Adjusts future estimates automatically
4. Improves scheduling over time

---

## Web UI Features

### Dashboard (Today View)

The main Today view shows:
- Your scheduled tasks and habits for today
- Quick capture input for fast task entry
- Progress stats and completion rate
- Reschedule button for auto-scheduling

### Projects

Organize related tasks together:
- Create projects with priorities and descriptions
- View all tasks within a project
- Track project status (Active, Paused, Completed, Archived)
- Link projects to goals for progress tracking

### Habits

Build and maintain routines:
- Create habits with specific days and times
- Track streaks and completion history
- Pause/resume habits for vacations or breaks
- View habit analytics and patterns

### Goals

Set and track long-term objectives:

**Time Horizons:**
- **Yearly:** Big-picture objectives for the year
- **Quarterly:** 3-month milestones
- **Monthly:** Actionable monthly targets

**Categories:**
Career, Health, Personal, Learning, Financial, Relationships, Other

**Features:**
- Link projects, tasks, and habits to goals
- Automatic progress calculation
- Vision Board visualization
- Hierarchical goals (sub-goals)

### Mood Tracking

Monitor your emotional wellbeing:

**Mood Check-In Widget:**
- Quick mood logging from sidebar
- 5-level scale (😢 to 😄)
- Optional notes for context
- Time block tracking (Morning/Afternoon/Evening/Night)

**Mood Insights Page:**
- Average mood and trend (improving/stable/declining)
- Mood by time of day analysis
- Mood by day of week patterns
- Distribution chart and calendar heatmap
- Recent notes and reflections

### Journal

Daily journaling with structure:

**Features:**
- Time-of-day prompts (morning/afternoon/evening/night)
- Mood integration on entries
- Import completed tasks and habits
- Calendar and timeline views
- Mood statistics

**Default Prompts:**
- **Morning:** Gratitude, focus intentions, feelings
- **Afternoon:** Progress reflection, accomplishments, blockers
- **Evening:** What went well, learnings, tomorrow
- **Night:** Day reflection, highlight, outlook

### Notes

Hierarchical markdown notes:
- Folder organization
- Link notes to tasks, projects, or goals
- Obsidian/Evernote compatible format
- YAML frontmatter with metadata

### Lists

Flexible item management:

**List Types:**
- **Running Lists (Eternal):** Ongoing lists like "Books to Read"
- **Quick Lists:** Temporary lists like shopping
- **Templates:** Reusable checklists

**Item Features:**
- Categories, prices, ratings
- Due dates and URLs
- Tags and nested children

### Analytics

Productivity insights:
- Task completion trends
- Time-of-day productivity patterns
- Habit streak tracking
- Burnout risk assessment

### Dependencies View

Visualize task relationships:
- **Tree View:** Hierarchical dependencies
- **Chain View:** Sequential workflows
- **Blocked View:** Tasks waiting on others
- **Focus View:** Both forward and backward dependencies

---

## Smart Scheduling

### Scheduling Algorithm

When you click "Reschedule", TrackMind uses **weighted scoring**:

| Factor | Weight | Description |
|--------|--------|-------------|
| Deadline Urgency | 35% | Closer deadlines get priority |
| Task Priority | 25% | Higher priority tasks first |
| Energy Matching | 15% | Bonus when task energy matches your energy block |
| Difficulty Weighting | 15% | Balances difficulty across the day |
| Time Fit | 10% | Efficiently fills available slots |

### Additional Scheduling Features

- **Habit Blocking:** Habits protect their time slots
- **Break Insertion:** Every 2 hours of work
- **Dependency Ordering:** Parents before children
- **Work Hours Respect:** Only schedules within configured hours

---

## Gamification

### XP System

Earn XP for completing tasks:

**Formula:** `Base(10) × Difficulty(1-5) × TimeFactor(min/30, max 4)`

Examples:
- 2-hour difficult task: 10 × 4 × 4 = 160 XP
- 30-min easy task: 10 × 1 × 1 = 10 XP
- Habits get 1.5x multiplier

### Badges (16 types)

- 🌟 First Steps - Complete first task
- 🔥 On a Roll - 3-day streak
- ⚡ Week Warrior - 7-day streak
- 👑 Monthly Master - 30-day streak
- 🛡️ Centurion - 100 tasks completed
- 🏆 Task Master - 500 tasks completed
- 🌅 Early Bird - Complete task before 9 AM
- 🌙 Night Owl - Complete task after 9 PM
- ⏱️ Time Boxer - Complete within estimate
- Plus level badges at 5, 10, 25, 50

---

## Settings

Access via the gear icon in the header:

### Energy Patterns

Configure per-day energy blocks:
```
Monday:
  08:00 - 12:00: High energy (deep work)
  12:00 - 17:00: Medium energy (standard work)
  17:00 - 22:00: Low energy (wind down)
```

### Work Hours

Set different work hours for each day:
- Weekdays: 8:00 AM - 10:00 PM
- Saturdays: 9:00 AM - 6:00 PM
- Sundays: 10:00 AM - 4:00 PM

### Sync

Configure multi-device sync:
- GitHub repository sync
- Google Drive backup
- Manual sync controls

### Export

Export data to JSON:
- Projects, tasks, habits
- Schedules and completions
- Goals and progress

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + K | Open Global Search |
| Shift + ? | Toggle Help Mode |
| Esc | Close dialogs / Exit help mode |

---

## Best Practices

### Energy Levels

1. **Be honest** - Don't mark everything "high"
2. **Know yourself** - When are you really at your best?
3. **Trust the system** - It schedules optimally
4. **Adjust as needed** - Energy patterns can change

### Habits

1. **Start with essentials** - Meals, sleep, exercise
2. **Be realistic** - Don't over-commit
3. **Track consistently** - Build those streaks
4. **Adjust freely** - Habits should serve you

### Goals

1. **Link everything** - Connect projects, tasks, and habits
2. **Use hierarchies** - Break big goals into sub-goals
3. **Check Vision Board** - Visualize connections
4. **Review progress** - Check goal completion regularly

### Scheduling

1. **Reschedule freely** - No guilt, just adapt
2. **Trust the system** - It gets smarter over time
3. **Respect blocked time** - Honor your habits
4. **Check ahead** - Plan for upcoming days

---

## Troubleshooting

### Habits Not Showing in Schedule

1. Verify habits have frequency set (daily/weekly)
2. Check days of week are selected
3. Ensure time of day is set
4. Click Reschedule to regenerate schedule

### Tasks Not Scheduling

1. Check tasks have time estimates
2. Verify energy patterns are configured
3. Ensure work hours are set
4. Check dependencies are satisfied

### Sync Issues

1. Check authentication status
2. Verify repository exists
3. Check network connection
4. Review sync settings

---

## Architecture

### Technology Stack

- **Frontend:** React + TypeScript, Tailwind CSS, Shadcn UI
- **Backend:** Python FastAPI
- **Storage:** IndexedDB (browser), SQLite (server)
- **State:** React Context API with custom hooks

### Project Structure

```
packages/
├── web/          # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── pages/        # View components
│   │   ├── hooks/        # Custom React hooks
│   │   └── context/      # App state context
├── core/         # Shared models and types
└── storage/      # Storage adapters
```

---

## Success Tips

### Work Tasks

1. Always set energy levels - Match work to energy
2. Log actual times - Let the system learn
3. Break large tasks - 2-3 hour max
4. Use dependencies - Enforce proper order
5. Review regularly - Weekly check-ins

### Wellbeing

1. Log mood consistently - Build awareness
2. Journal regularly - Reflect and grow
3. Maintain habits - Build sustainable routines
4. Take breaks - Honor the automatic breaks
5. Review insights - Learn from patterns

---

**TrackMind** - Smart task management that works with your energy, not against it.

Remember:
- 🔥⚡💤 Match work to energy
- 🔄 Protect time with habits
- 🎯 Connect work to goals
- 😊 Track your mood
- 📖 Reflect in journal
- 📈 Let the system learn
