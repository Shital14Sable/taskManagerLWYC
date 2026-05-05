"""
Calendar API endpoints for week and month views
"""
from fastapi import APIRouter, Request, Query
from datetime import date, timedelta
from typing import Optional, List, Dict, Any

router = APIRouter()


def get_enum_value(obj, default=None):
    """Safely get value from enum or string"""
    if obj is None:
        return default
    return obj.value if hasattr(obj, 'value') else obj


@router.get("/week")
def get_week_view(
    request: Request,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD), defaults to current week's Monday")
):
    """Get week view data with tasks for each day"""
    storage = request.app.state.storage

    # Calculate week start (Monday)
    if start_date:
        start = date.fromisoformat(start_date)
    else:
        today = date.today()
        start = today - timedelta(days=today.weekday())  # Monday

    end = start + timedelta(days=6)  # Sunday

    # Get all tasks for reference
    all_tasks = {t.id: t for t in storage.list_tasks()}

    # Build week data
    days = []
    total_scheduled = 0
    total_completed = 0

    for i in range(7):
        day_date = start + timedelta(days=i)
        schedule = storage.get_schedule(day_date)

        day_data: Dict[str, Any] = {
            "date": day_date.isoformat(),
            "day_name": day_date.strftime("%A"),
            "day_short": day_date.strftime("%a"),
            "is_today": day_date == date.today(),
            "is_weekend": day_date.weekday() >= 5,
            "tasks": [],
            "summary": {
                "total": 0,
                "completed": 0,
                "completion_rate": 0
            }
        }

        if schedule:
            for scheduled_task in schedule.scheduled_tasks:
                if scheduled_task.is_buffer:
                    continue

                task = all_tasks.get(scheduled_task.task_id)
                if task:
                    is_completed = (
                        scheduled_task.task_id in schedule.completed_tasks or
                        get_enum_value(task.status) == 'completed'
                    )

                    day_data["tasks"].append({
                        "id": task.id,
                        "title": task.title,
                        "start_time": scheduled_task.start_time,
                        "end_time": scheduled_task.end_time,
                        "duration": scheduled_task.estimated_minutes,
                        "priority": task.priority,
                        "energy_level": get_enum_value(task.energy_level),
                        "is_habit": task.is_habit,
                        "is_completed": is_completed,
                        "project_id": task.project_id
                    })

            day_data["summary"]["total"] = len(schedule.scheduled_tasks)
            day_data["summary"]["completed"] = schedule.summary.tasks_completed
            day_data["summary"]["completion_rate"] = schedule.summary.completion_rate

            total_scheduled += day_data["summary"]["total"]
            total_completed += day_data["summary"]["completed"]

        days.append(day_data)

    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "days": days,
        "summary": {
            "total_scheduled": total_scheduled,
            "total_completed": total_completed,
            "completion_rate": total_completed / total_scheduled if total_scheduled > 0 else 0
        }
    }


@router.get("/month")
def get_month_view(
    request: Request,
    year: Optional[int] = Query(None, description="Year"),
    month: Optional[int] = Query(None, description="Month (1-12)")
):
    """Get month view data with task indicators for each day"""
    storage = request.app.state.storage

    # Default to current month
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    # Calculate month boundaries
    first_day = date(year, month, 1)

    # Calculate last day of month
    if month == 12:
        last_day = date(year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(year, month + 1, 1) - timedelta(days=1)

    # Get all tasks for reference
    all_tasks = {t.id: t for t in storage.list_tasks()}

    # Build month data
    days = []
    total_scheduled = 0
    total_completed = 0

    current = first_day
    while current <= last_day:
        schedule = storage.get_schedule(current)

        day_data: Dict[str, Any] = {
            "date": current.isoformat(),
            "day": current.day,
            "day_of_week": current.weekday(),
            "is_today": current == today,
            "is_weekend": current.weekday() >= 5,
            "has_schedule": schedule is not None,
            "task_count": 0,
            "completed_count": 0,
            "habit_count": 0,
            "high_priority_count": 0,
            "tasks": []  # Brief task info for tooltips
        }

        if schedule:
            tasks_today = []
            for scheduled_task in schedule.scheduled_tasks:
                if scheduled_task.is_buffer:
                    continue

                task = all_tasks.get(scheduled_task.task_id)
                if task:
                    is_completed = (
                        scheduled_task.task_id in schedule.completed_tasks or
                        get_enum_value(task.status) == 'completed'
                    )

                    tasks_today.append({
                        "id": task.id,
                        "title": task.title[:30],
                        "is_habit": task.is_habit,
                        "is_completed": is_completed,
                        "priority": task.priority
                    })

                    day_data["task_count"] += 1
                    if is_completed:
                        day_data["completed_count"] += 1
                    if task.is_habit:
                        day_data["habit_count"] += 1
                    if task.priority >= 4:
                        day_data["high_priority_count"] += 1

            day_data["tasks"] = tasks_today[:5]  # Limit for display
            total_scheduled += day_data["task_count"]
            total_completed += day_data["completed_count"]

        days.append(day_data)
        current += timedelta(days=1)

    # Calculate calendar grid info
    first_weekday = first_day.weekday()  # 0=Monday

    return {
        "year": year,
        "month": month,
        "month_name": first_day.strftime("%B"),
        "first_weekday": first_weekday,
        "days_in_month": last_day.day,
        "days": days,
        "summary": {
            "total_scheduled": total_scheduled,
            "total_completed": total_completed,
            "completion_rate": total_completed / total_scheduled if total_scheduled > 0 else 0
        }
    }
