# TaskMan Usage Examples

## Complete Workflows

### Workflow 1: Starting a Research Paper

```bash
# Create the project
task project add "Neural Networks Survey Paper" \
  --priority 1 \
  --tag type=research \
  --tag deadline=2025-12-31 \
  --tag collaborator="Dr. Smith" \
  --description "Comprehensive survey of recent advances"

# Output: ✅ Created project: Neural Networks Survey Paper (ID: a1b2c3d4)

# Add high-priority research tasks
task add a1b2c3d4 "Literature review of 2024-2025 papers" \
  --priority 1 \
  --difficulty 5 \
  --time 240 \
  --energy high \
  --tag type=research \
  --tag phase=background

task add a1b2c3d4 "Identify key trends and gaps" \
  --priority 1 \
  --difficulty 4 \
  --time 120 \
  --energy high \
  --tag type=analysis \
  --tag phase=background

task add a1b2c3d4 "Create paper outline" \
  --priority 2 \
  --difficulty 3 \
  --time 90 \
  --energy medium \
  --tag type=writing \
  --tag phase=planning

# Add writing tasks
task add a1b2c3d4 "Write introduction section" \
  --priority 2 \
  --difficulty 4 \
  --time 180 \
  --energy high \
  --tag type=writing \
  --tag phase=drafting

task add a1b2c3d4 "Write methodology section" \
  --priority 2 \
  --difficulty 4 \
  --time 150 \
  --energy high \
  --tag type=writing \
  --tag phase=drafting

# Add admin tasks
task add a1b2c3d4 "Update bibliography" \
  --priority 3 \
  --difficulty 1 \
  --time 30 \
  --energy low \
  --tag type=admin

task add a1b2c3d4 "Format references" \
  --priority 3 \
  --difficulty 1 \
  --time 45 \
  --energy low \
  --tag type=admin

# Generate schedule
task schedule generate --days 7

# View today's plan
task schedule today
```

### Workflow 2: Client Project with Dependencies

```bash
# Create project
task project add "Acme Corp Website Redesign" \
  --priority 1 \
  --tag type=client_work \
  --tag client="Acme Corp" \
  --tag deadline=2025-11-15

# Note: Save the project ID for next commands
# Let's say it's: b2c3d4e5

# Phase 1: Discovery (no dependencies)
task add b2c3d4e5 "Initial client meeting" \
  --priority 1 \
  --difficulty 2 \
  --time 60 \
  --energy medium \
  --tag type=meeting \
  --tag phase=discovery

# Note task ID: task101

# Phase 2: Planning (depends on discovery)
task add b2c3d4e5 "Create design mockups" \
  --priority 1 \
  --difficulty 3 \
  --time 180 \
  --energy medium \
  --tag type=design \
  --tag phase=planning

# Note task ID: task102
# Add dependency via API (CLI support coming):
# curl -X POST http://localhost:3000/api/tasks/task102/dependencies?dependency_id=task101

# Phase 3: Implementation
task add b2c3d4e5 "Implement frontend" \
  --priority 2 \
  --difficulty 4 \
  --time 360 \
  --energy high \
  --tag type=coding \
  --tag phase=implementation

task add b2c3d4e5 "Integrate backend API" \
  --priority 2 \
  --difficulty 4 \
  --time 240 \
  --energy high \
  --tag type=coding \
  --tag phase=implementation

# Phase 4: Testing
task add b2c3d4e5 "QA and testing" \
  --priority 2 \
  --difficulty 3 \
  --time 120 \
  --energy medium \
  --tag type=testing \
  --tag phase=qa

# Phase 5: Delivery
task add b2c3d4e5 "Client demo and handoff" \
  --priority 1 \
  --difficulty 2 \
  --time 60 \
  --energy medium \
  --tag type=meeting \
  --tag phase=delivery

# Generate schedule
task schedule generate --days 14
```

### Workflow 3: Daily Task Management

```bash
# Morning routine
# ===============

# Check today's schedule
task schedule today

# Review projects
task project list --status active

# Quick capture a random idea
task quick "Check experiment results from yesterday"

# Work on first task
# (After 2.5 hours of work)
task complete task001 --actual-time 150

# System learns: estimated 120min, actual 150min
# Future similar tasks will be adjusted upward


# Afternoon routine
# =================

# Behind schedule? Reschedule remaining tasks
task schedule reschedule

# View updated schedule
task schedule today

# Add urgent task that just came up
task add a1b2c3d4 "Review collaborator's draft" \
  --priority 1 \
  --difficulty 2 \
  --time 45 \
  --energy medium \
  --tag type=review \
  --tag urgent=true

# Regenerate schedule to fit it in
task schedule generate --force


# Evening routine
# ===============

# View daily summary
task summary

# Check what's coming tomorrow
task schedule view 2025-10-18

# Process inbox items
task inbox list
# Convert captured item to task
task inbox convert inbox123 \
  --to-task \
  --project a1b2c3d4 \
  --priority 2 \
  --difficulty 3
```

### Workflow 4: Weekly Review

```bash
# Monday morning review
# =====================

# Review last week's progress
task review week

# Check all incomplete tasks
task list --status todo

# Identify overdue tasks
task list --status todo | grep "2025-10"  # Tasks from last week

# Reschedule overdue tasks
task schedule reschedule --from-date 2025-10-14

# Generate new week's schedule
task schedule generate --days 7 --force


# Check project status
# ====================

# View all projects
task project list

# Deep dive into specific project
task project view a1b2c3d4
task list a1b2c3d4 --status todo

# View project analytics
# (Via API for now)
curl http://localhost:3000/api/analytics/project/a1b2c3d4


# Plan for the week
# =================

# Add this week's priorities
task add a1b2c3d4 "Complete first draft" \
  --priority 1 \
  --difficulty 5 \
  --time 360 \
  --energy high \
  --tag type=writing \
  --tag milestone=true

# Schedule specific time for deep work
# View schedule and block time for focus work
task schedule block 09:00 12:00 --label "Deep work - no interruptions"
```

## Advanced Usage

### Working with Tags

```bash
# Search tasks by tag
task search --tag type=research
task search --tag type=coding --tag ai_tool=Claude

# View tag analytics (via API)
curl http://localhost:3000/api/analytics/tags

# Add multiple tags
task add proj123 "Complex task" \
  --tag type=research \
  --tag context=deep_work \
  --tag ai_tool=Claude \
  --tag phase=analysis \
  --tag collaborator=Jane
```

### Quick Capture Workflows

```bash
# Capture ideas throughout the day
task quick "Follow up with Dr. Smith about results"
task quick "Check if dataset is ready"
task quick "Review latest papers on transformers"
task quick "Schedule team meeting for next week"

# At end of day, process inbox
task inbox list

# Convert to tasks or delete
task inbox convert inbox001 --to-task --project research1
task inbox delete inbox002
task inbox convert inbox003 --to-task --project client1 --priority 1
```

### Recurring Tasks

```bash
# Daily standup
task add proj123 "Daily standup meeting" \
  --time 15 \
  --recur daily \
  --energy low

# Weekly review
task add proj123 "Weekly project review" \
  --time 60 \
  --recur weekly \
  --days mon,fri \
  --energy medium

# Monthly report
task add proj123 "Monthly status report" \
  --time 120 \
  --recur monthly \
  --day 28 \
  --energy medium
```

### Time Boxing

```bash
# Limit time on specific project today
task box research1 --max 4h

# Check time box status
task box status research1

# View all time boxes
task box status

# Remove time box
task box research1 --remove
```

## Integration Examples

### Git Workflow Integration

```bash
#!/bin/bash
# pre-commit hook

# Check if there are tasks related to current branch
BRANCH=$(git branch --show-current)
TASK_ID=$(echo $BRANCH | grep -oE 'task-[a-z0-9]+' | cut -d'-' -f2)

if [ ! -z "$TASK_ID" ]; then
    echo "📋 Updating task $TASK_ID..."
    task update $TASK_ID --tag last_commit="$(git rev-parse HEAD)"
fi
```

### Pomodoro Integration

```bash
#!/bin/bash
# pomodoro.sh - Simple pomodoro timer with task tracking

TASK_ID=$1
DURATION=${2:-25}  # Default 25 minutes

echo "🍅 Starting $DURATION minute pomodoro for task $TASK_ID"
echo "Working..."

# Start timer
sleep $((DURATION * 60))

# Play sound
echo -e '\a'

echo "✅ Pomodoro complete!"
echo "Did you complete the task? (y/n)"
read COMPLETE

if [ "$COMPLETE" = "y" ]; then
    echo "How many minutes did you actually work?"
    read ACTUAL
    task complete $TASK_ID --actual-time $ACTUAL
fi
```

### Notification Script

```bash
#!/bin/bash
# notify-next-task.sh - Notify about next scheduled task

# Get today's schedule
SCHEDULE=$(task schedule today --json)

# Parse next task
NEXT_TASK=$(echo $SCHEDULE | jq -r '.scheduled_tasks[0]')
TASK_ID=$(echo $NEXT_TASK | jq -r '.task_id')
START_TIME=$(echo $NEXT_TASK | jq -r '.start_time')

# Get task details
TASK=$(task view $TASK_ID --json)
TITLE=$(echo $TASK | jq -r '.title')

# Send notification (macOS)
osascript -e "display notification \"$TITLE\" with title \"Next Task at $START_TIME\""

# Or use notify-send on Linux
# notify-send "Next Task at $START_TIME" "$TITLE"
```

## API Usage Examples

### Using Python Requests

```python
import requests

# Create project
response = requests.post('http://localhost:3000/api/projects/', json={
    "name": "My Project",
    "priority": 1,
    "tags": {"type": "research"}
})
project = response.json()
print(f"Created project: {project['id']}")

# Create task
response = requests.post('http://localhost:3000/api/tasks/', json={
    "project_id": project['id'],
    "title": "My Task",
    "priority": 1,
    "difficulty": 3,
    "estimated_minutes": 60,
    "energy_level": "medium",
    "tags": {"type": "coding"}
})
task = response.json()

# Generate schedule
response = requests.post('http://localhost:3000/api/schedule/generate', params={
    "days": 7
})
schedules = response.json()

# Get today's schedule
response = requests.get('http://localhost:3000/api/schedule/today')
schedule = response.json()

print(f"Tasks scheduled: {len(schedule['scheduled_tasks'])}")
```

### Using cURL

```bash
# Create project
curl -X POST http://localhost:3000/api/projects/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Project",
    "priority": 1,
    "tags": {"type": "test"}
  }'

# List projects
curl http://localhost:3000/api/projects/

# Create task
curl -X POST http://localhost:3000/api/tasks/ \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "a1b2c3d4",
    "title": "Test Task",
    "priority": 1,
    "difficulty": 3,
    "estimated_minutes": 60,
    "energy_level": "medium"
  }'

# Generate schedule
curl -X POST "http://localhost:3000/api/schedule/generate?days=7"

# Get today's schedule
curl http://localhost:3000/api/schedule/today
```

## Troubleshooting Examples

### Finding Tasks

```bash
# Find all tasks with specific keyword
task list | grep "literature"

# Find tasks by tag
task search --tag type=research

# Find tasks in specific project
task list proj123

# Find incomplete high-priority tasks
task list --status todo | grep "Priority: 1"
```

### Fixing Scheduling Issues

```bash
# Tasks not scheduling? Check status
task list proj123 --status blocked

# Force regenerate schedule
task schedule generate --force

# Reset today's schedule
task schedule reschedule --force
```

### Data Management

```bash
# Export all projects to JSON
curl http://localhost:3000/api/projects/ > projects_backup.json

# Export all tasks
curl http://localhost:3000/api/tasks/ > tasks_backup.json

# View database directly
sqlite3 data/database.db "SELECT * FROM tasks WHERE status='todo';"

# Check schedule history
ls -la data/schedules/
```

## Best Practices

### Estimation Guidelines

```bash
# Break large tasks into smaller ones
# Instead of:
task add proj "Write entire paper" --time 1440  # 24 hours!

# Do this:
task add proj "Write introduction" --time 180
task add proj "Write methodology" --time 150
task add proj "Write results" --time 120
task add proj "Write discussion" --time 150
task add proj "Edit and polish" --time 90
```

### Energy Level Selection

```bash
# High energy (morning):
# - Complex problem solving
# - Deep research
# - Creative writing
# - Strategic planning

# Medium energy (afternoon):
# - Standard coding
# - Meetings
# - Reviews
# - Analysis

# Low energy (evening):
# - Admin tasks
# - Email
# - Documentation
# - Simple updates
```

### Priority Management

```bash
# Priority 1: Must do today, critical impact
task add proj "Fix production bug" --priority 1

# Priority 2: Important, should do soon
task add proj "Implement feature" --priority 2

# Priority 3: Normal work
task add proj "Refactor code" --priority 3

# Priority 4-5: Nice to have, can defer
task add proj "Update docs" --priority 4
```

## Tips & Tricks

### Batch Operations

```bash
# Add multiple similar tasks
for section in intro methods results discussion; do
    task add proj123 "Write $section section" \
      --priority 2 \
      --difficulty 4 \
      --time 150 \
      --energy high \
      --tag type=writing
done
```

### Custom Aliases

```bash
# Add to ~/.bashrc or ~/.zshrc
alias t='task'
alias tp='task project'
alias ta='task add'
alias tl='task list'
alias tc='task complete'
alias ts='task schedule today'
alias tq='task quick'
```

### Keyboard Shortcuts

```bash
# Create function for quick task completion
function tdone() {
    task complete $1 --actual-time ${2:-60}
}

# Usage: tdone task123 90
```

This comprehensive guide should help users get the most out of TaskMan!