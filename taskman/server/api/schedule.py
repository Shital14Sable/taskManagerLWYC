from fastapi import APIRouter, HTTPException, Request
from datetime import date, timedelta
from typing import Optional, List
from pydantic import BaseModel
import json
import copy

from taskman.server.models.schedule import Schedule, ScheduledTask

router = APIRouter()


def filter_schedule_for_current_state(
    schedule: Schedule,
    storage,
    scheduler,
    target_date: date
) -> Schedule:
    """Filter a cached schedule to remove tasks that are now paused or from paused projects.

    This ensures that even if a schedule was generated before a habit/project was paused,
    viewing the schedule won't show those paused items.
    """
    if not schedule or not schedule.scheduled_tasks:
        return schedule

    filtered_tasks: List[ScheduledTask] = []

    for st in schedule.scheduled_tasks:
        # Keep breaks/buffers
        if st.is_buffer:
            filtered_tasks.append(st)
            continue

        # Get the task to check its current state
        try:
            task = storage.get_task(st.task_id)
        except Exception:
            # Task was deleted, skip it
            continue

        if task is None:
            # Task doesn't exist anymore, skip
            continue

        # Check if it's a paused habit
        if task.is_habit and scheduler._is_habit_paused(task, target_date):
            continue  # Skip paused habits

        # Check if it's a task from a paused/inactive project
        if not task.is_habit and scheduler._is_task_in_paused_project(task):
            continue  # Skip tasks from paused projects

        # Check if it's a paused task
        if not task.is_habit and scheduler._is_task_paused(task, target_date):
            continue  # Skip paused tasks

        # Task is valid, keep it
        filtered_tasks.append(st)

    # Create a new schedule with filtered tasks
    # Use model_copy for Pydantic v2 or copy for older versions
    filtered_schedule = schedule.model_copy(deep=True)
    filtered_schedule.scheduled_tasks = filtered_tasks

    # Update summary
    non_buffer_count = len([t for t in filtered_tasks if not t.is_buffer])
    filtered_schedule.summary.tasks_remaining = non_buffer_count
    filtered_schedule.summary.total_scheduled_minutes = sum(
        t.estimated_minutes for t in filtered_tasks if not t.is_buffer
    )

    return filtered_schedule


class GenerateRequest(BaseModel):
    target_date: Optional[str] = None
    force: bool = False
    days: Optional[int] = None  # Ignored - we auto-extend now
    min_days: int = 7
    max_days: int = 60


class RescheduleRequest(BaseModel):
    target_date: Optional[str] = None
    min_days: int = 7
    max_days: int = 60


@router.post("/generate")
async def generate_schedule(request: Request, body: Optional[GenerateRequest] = None):
    """Generate schedules until ALL tasks are scheduled.

    Uses multi-day scheduling to ensure tasks are distributed across days.
    Automatically extends the schedule until all tasks fit.
    """
    storage = request.app.state.storage
    scheduler = request.app.state.scheduler
    preferences = storage.get_preferences()

    # Parse JSON body manually for reliability
    try:
        body_bytes = await request.body()
        if body_bytes:
            body_data = json.loads(body_bytes)
        else:
            body_data = {}
    except:
        body_data = {}

    # Extract parameters with defaults
    target_date = body_data.get("target_date")
    days = body_data.get("days", 7)
    force = body_data.get("force", False)

    if target_date:
        start_date = date.fromisoformat(target_date)
    else:
        start_date = date.today()

    schedules = []
    for i in range(days):
        current_date = start_date + timedelta(days=i)
        schedule = scheduler.generate_schedule(current_date, preferences, force=force)
        schedules.append(schedule)

    return {"schedules": schedules, "count": len(schedules)}

@router.get("/upcoming")
def get_upcoming_schedules(request: Request, days: int = 60):
    """Get all upcoming schedules and identify unscheduled tasks.

    Returns:
        - schedules: List of Schedule objects for the next N days
        - task_schedule_map: Dict mapping task_id to scheduled date
        - unscheduled_tasks: List of task IDs that couldn't be scheduled
    """
    storage = request.app.state.storage

    schedules = []
    task_schedule_map = {}  # task_id -> scheduled_date
    scheduled_task_ids = set()

    today = date.today()
    for i in range(days):
        current_date = today + timedelta(days=i)
        schedule = storage.get_schedule(current_date)
        if schedule:
            schedules.append(schedule)
            for task in schedule.scheduled_tasks:
                if not task.is_buffer and task.task_id:
                    if task.task_id not in task_schedule_map:
                        task_schedule_map[task.task_id] = str(current_date)
                    scheduled_task_ids.add(task.task_id)

    # Find unscheduled tasks
    all_tasks = storage.list_tasks(status="todo")
    all_tasks += storage.list_tasks(status="in_progress")
    regular_tasks = [t for t in all_tasks if not t.is_habit]
    habits = [t for t in all_tasks if t.is_habit]

    unscheduled_task_ids = [t.id for t in regular_tasks if t.id not in scheduled_task_ids]

    # Find habits that should occur on any scheduled day but weren't scheduled
    # (due to time conflicts, overlaps with other habits, etc.)
    from taskman.server.services.scheduler import Scheduler
    from taskman.server.utils.time_utils import time_to_minutes
    from datetime import datetime

    scheduler = Scheduler(storage)
    preferences = storage.get_preferences()

    # Get current time for filtering past habits on today
    now = datetime.now()
    current_time_minutes = now.hour * 60 + now.minute

    # Track which habits are scheduled on ANY day (habit_id -> set of dates scheduled)
    habits_scheduled_dates = {h.id: set() for h in habits}
    # Track which dates each habit SHOULD occur on
    habits_should_occur_dates = {h.id: set() for h in habits}

    # First pass: collect all scheduled habits and their occurrence dates
    for i in range(days):
        check_date = today + timedelta(days=i)
        day_schedule = storage.get_schedule(check_date)

        # Get scheduled task IDs for this day
        if day_schedule:
            for st in day_schedule.scheduled_tasks:
                if not st.is_buffer and st.task_id in habits_scheduled_dates:
                    habits_scheduled_dates[st.task_id].add(check_date)

        # Track which habits should occur on this date
        for habit in habits:
            if scheduler._is_habit_paused(habit, check_date):
                continue
            if scheduler._habit_occurs_on_date(habit, check_date):
                # For today: skip habits that have already passed
                if check_date == today:
                    habit_time = scheduler._get_habit_time(habit, check_date)
                    if habit_time:
                        start_time, duration = habit_time
                        habit_end_minutes = time_to_minutes(start_time) + duration
                        if habit_end_minutes <= current_time_minutes:
                            continue
                habits_should_occur_dates[habit.id].add(check_date)

    # Second pass: mark habits as unscheduled if they should occur on any day
    # but are NOT scheduled on ANY of those days
    unscheduled_habit_ids = set()
    for habit in habits:
        should_occur = habits_should_occur_dates[habit.id]
        scheduled_on = habits_scheduled_dates[habit.id]

        # If habit should occur on some dates but isn't scheduled on ANY of them
        if should_occur and not scheduled_on:
            unscheduled_habit_ids.add(habit.id)
            unscheduled_task_ids.append(habit.id)

    return {
        "schedules": schedules,
        "task_schedule_map": task_schedule_map,
        "unscheduled_task_ids": unscheduled_task_ids,
        "total_tasks": len(regular_tasks) + len(habits),
        "scheduled_count": len(scheduled_task_ids),
        "unscheduled_count": len(unscheduled_task_ids)
    }

@router.get("/today", response_model=Schedule)
def get_today_schedule(request: Request):
    """Get today's schedule"""
    storage = request.app.state.storage
    scheduler = request.app.state.scheduler
    preferences = storage.get_preferences()

    today = date.today()
    schedule = storage.get_schedule(today)

    if not schedule:
        schedule = scheduler.generate_schedule(today, preferences)
    else:
        # Filter out paused habits and tasks from paused projects
        schedule = filter_schedule_for_current_state(schedule, storage, scheduler, today)

    return schedule

@router.get("/{schedule_date}", response_model=Schedule)
def get_schedule(schedule_date: str, request: Request):
    """Get schedule for a specific date"""
    storage = request.app.state.storage
    scheduler = request.app.state.scheduler
    preferences = storage.get_preferences()

    target_date = date.fromisoformat(schedule_date)
    schedule = storage.get_schedule(target_date)

    if not schedule:
        schedule = scheduler.generate_schedule(target_date, preferences)
    else:
        # Filter out paused habits and tasks from paused projects
        schedule = filter_schedule_for_current_state(schedule, storage, scheduler, target_date)

    return schedule

@router.post("/reschedule")
async def reschedule(request: Request):
    """Reschedule incomplete tasks.

    This endpoint:
    1. Preserves today's completed_tasks list
    2. Cleans up old schedules (older than 7 days)
    3. Deletes only FUTURE schedules (tomorrow onwards) - keeps today intact
    4. Regenerates today's schedule separately to preserve completed_tasks
    5. Regenerates future schedules using multi-day scheduling
    """
    storage = request.app.state.storage
    scheduler = request.app.state.scheduler
    preferences = storage.get_preferences()

    # Parse JSON body manually for reliability
    try:
        body_bytes = await request.body()
        if body_bytes:
            body_data = json.loads(body_bytes)
        else:
            body_data = {}
    except:
        body_data = {}

    # Extract parameters
    target_date_str = body_data.get("target_date")
    days_param = body_data.get("days")
    reschedule_all = body_data.get("reschedule_all", False)

    today = date.today()

    # STEP 1: Preserve today's completed_tasks BEFORE any modifications
    today_schedule = storage.get_schedule(today)
    preserved_completed_tasks = list(today_schedule.completed_tasks) if today_schedule else []
    print(f"Preserved {len(preserved_completed_tasks)} completed tasks from today: {preserved_completed_tasks}")

    # STEP 2: Clean up old schedules (more than 7 days old)
    old_deleted = storage.cleanup_old_schedules(keep_days_past=7)
    if old_deleted > 0:
        print(f"Cleaned up {old_deleted} old schedule files")

    # STEP 3: Delete FUTURE schedules (tomorrow onwards) to start fresh
    # We handle today separately to preserve completed_tasks
    tomorrow = today + timedelta(days=1)
    future_deleted = storage.delete_future_schedules(tomorrow)
    print(f"Deleted {future_deleted} future schedule files (from tomorrow onwards)")

    # Also delete today's schedule so we can regenerate it
    storage.delete_schedule(today)
    print("Deleted today's schedule for regeneration")

    # Determine how many days to reschedule
    if reschedule_all:
        all_tasks = storage.list_tasks(status="todo")
        all_tasks += storage.list_tasks(status="in_progress")
        # Count only regular tasks (not habits) for scheduling calculation
        # Also exclude paused tasks and tasks from paused projects
        regular_tasks = [t for t in all_tasks if not t.is_habit and not t.is_paused]
        total_minutes = sum(t.estimated_minutes for t in regular_tasks)
        # Estimate ~6 hours (360 minutes) of productive work per day
        days_needed = max(1, (total_minutes // 360) + 1)
        # Set max_days high enough to schedule ALL tasks
        days_to_schedule = max(days_needed * 2, 60)
    elif days_param:
        days_to_schedule = days_param
    else:
        days_to_schedule = 7  # Default to 7 days for proper scheduling

    # STEP 4: Generate TODAY's schedule first
    # This ensures habits show for the full day while tasks start from now
    today_new_schedule = scheduler.generate_schedule(today, preferences, force=True)

    # STEP 5: Restore completed_tasks to today's schedule IMMEDIATELY
    # IMPORTANT: Always set completed_tasks explicitly (even if empty list)
    # This ensures we don't lose any completed tasks from before reschedule
    today_new_schedule.completed_tasks = preserved_completed_tasks.copy()
    storage.save_schedule(today_new_schedule)
    print(f"Restored {len(preserved_completed_tasks)} completed tasks to today's new schedule: {preserved_completed_tasks}")

    # STEP 6: Generate FUTURE schedules using multi-day scheduling
    # Start from tomorrow to avoid duplicates with today
    future_schedules = []
    if days_to_schedule > 1:
        # Get task IDs already scheduled today to exclude from future days
        today_task_ids = {st.task_id for st in today_new_schedule.scheduled_tasks if st.task_id and not st.is_buffer}

        future_schedules = scheduler.generate_multi_day_schedule(
            start_date=tomorrow,
            preferences=preferences,
            force=True,
            max_days=days_to_schedule - 1,
            min_days=1,
            exclude_task_ids=today_task_ids  # Don't schedule today's tasks again
        )

    # Combine all schedules
    all_schedules = [today_new_schedule] + future_schedules

    return {
        "schedules": [s.model_dump() for s in all_schedules],
        "count": len(all_schedules),
        "old_schedules_cleaned": old_deleted,
        "future_schedules_deleted": future_deleted,
        "completed_tasks_preserved": len(preserved_completed_tasks)
    }

