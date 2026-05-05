"""
Analytics API endpoints
"""
from fastapi import APIRouter, Request, Query
from datetime import date, timedelta
from typing import Optional

from taskman.server.services.analytics import AnalyticsService

router = APIRouter()


def get_enum_value(obj, default=None):
    """Safely get value from enum or string"""
    if obj is None:
        return default
    return obj.value if hasattr(obj, 'value') else obj


def get_analytics(request: Request) -> AnalyticsService:
    """Get analytics service from app state"""
    return AnalyticsService(request.app.state.storage)


@router.get("/overview")
def get_overview(request: Request):
    """Get overall analytics overview"""
    analytics = get_analytics(request)
    storage = request.app.state.storage

    # Get all projects stats
    projects = storage.list_projects()
    all_tasks = storage.list_tasks()

    total_tasks = len(all_tasks)
    completed_tasks = len([t for t in all_tasks if get_enum_value(t.status) == 'completed'])
    habits = len([t for t in all_tasks if t.is_habit])

    # Get today's schedule
    today = date.today()
    today_schedule = storage.get_schedule(today)

    return {
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "completion_rate": completed_tasks / total_tasks if total_tasks > 0 else 0,
        "total_projects": len(projects),
        "active_projects": len([p for p in projects if get_enum_value(p.status) == 'active']),
        "total_habits": habits,
        "today_scheduled": len(today_schedule.scheduled_tasks) if today_schedule else 0,
        "today_completed": today_schedule.summary.tasks_completed if today_schedule else 0,
        "estimation_accuracy": storage.get_estimation_factors()
    }


@router.get("/project/{project_id}")
def get_project_stats(request: Request, project_id: str):
    """Get statistics for a specific project"""
    analytics = get_analytics(request)
    return analytics.get_project_statistics(project_id)


@router.get("/habit/{habit_id}")
def get_habit_stats(request: Request, habit_id: str, days: int = Query(30, description="Number of days to analyze (0 for all time)")):
    """Get detailed statistics for a specific habit"""
    storage = request.app.state.storage

    # Get the habit task
    habit = storage.get_task(habit_id)
    if not habit or not habit.is_habit:
        return {"error": "Habit not found"}

    # Get schedules for the past N days (or all time if days=0)
    end_date = date.today()
    if days == 0:
        # All time: use a very early start date
        start_date = date(2020, 1, 1)
    else:
        start_date = end_date - timedelta(days=days-1)
    schedules = storage.list_schedules(start_date, end_date)

    # Track completions by day of week and date
    completions_by_day = {i: 0 for i in range(7)}  # 0=Monday, 6=Sunday
    scheduled_by_day = {i: 0 for i in range(7)}
    completion_dates = []
    daily_data = []

    for schedule in schedules:
        day_of_week = schedule.date.weekday()
        was_scheduled = any(st.task_id == habit_id for st in schedule.scheduled_tasks if not st.is_buffer)
        was_completed = habit_id in schedule.completed_tasks

        if was_scheduled:
            scheduled_by_day[day_of_week] += 1
            if was_completed:
                completions_by_day[day_of_week] += 1
                completion_dates.append(schedule.date.isoformat())

        daily_data.append({
            'date': schedule.date.isoformat(),
            'scheduled': was_scheduled,
            'completed': was_completed
        })

    # Calculate overall stats
    total_scheduled = sum(scheduled_by_day.values())
    total_completed = sum(completions_by_day.values())
    completion_rate = total_completed / total_scheduled if total_scheduled > 0 else 0

    # Calculate day-of-week completion rates
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    day_stats = []
    for i in range(7):
        day_stats.append({
            'day': day_names[i],
            'day_short': day_names[i][:3],
            'scheduled': scheduled_by_day[i],
            'completed': completions_by_day[i],
            'rate': completions_by_day[i] / scheduled_by_day[i] if scheduled_by_day[i] > 0 else 0
        })

    # Calculate current streak
    current_streak = 0
    sorted_dates = sorted(completion_dates, reverse=True)
    if sorted_dates:
        expected_date = end_date
        for comp_date in sorted_dates:
            comp_date_obj = date.fromisoformat(comp_date)
            if comp_date_obj == expected_date:
                current_streak += 1
                expected_date = expected_date - timedelta(days=1)
            elif comp_date_obj < expected_date:
                break

    # Calculate longest streak
    longest_streak = 0
    if sorted_dates:
        streak = 1
        dates_asc = sorted([date.fromisoformat(d) for d in completion_dates])
        for i in range(1, len(dates_asc)):
            if (dates_asc[i] - dates_asc[i-1]).days == 1:
                streak += 1
            else:
                longest_streak = max(longest_streak, streak)
                streak = 1
        longest_streak = max(longest_streak, streak)

    # Calculate weekly completion rate (last 4 weeks)
    weekly_stats = []
    for week_offset in range(4):
        week_start = end_date - timedelta(days=end_date.weekday() + 7 * week_offset)
        week_end = week_start + timedelta(days=6)

        week_scheduled = 0
        week_completed = 0
        for d in daily_data:
            d_date = date.fromisoformat(d['date'])
            if week_start <= d_date <= week_end:
                if d['scheduled']:
                    week_scheduled += 1
                    if d['completed']:
                        week_completed += 1

        weekly_stats.append({
            'week_start': week_start.isoformat(),
            'week_end': week_end.isoformat(),
            'scheduled': week_scheduled,
            'completed': week_completed,
            'rate': week_completed / week_scheduled if week_scheduled > 0 else 0
        })

    # Best performing day
    best_day = max(day_stats, key=lambda x: x['rate']) if any(d['scheduled'] > 0 for d in day_stats) else None

    return {
        'habit_id': habit_id,
        'title': habit.title,
        'description': habit.description,
        'recurrence': {
            'frequency': get_enum_value(habit.recurrence.frequency) if habit.recurrence else None,
            'days_of_week': habit.recurrence.days_of_week if habit.recurrence else [],
            'time_of_day': habit.recurrence.time_of_day if habit.recurrence else None
        },
        'period_days': days,
        'total_scheduled': total_scheduled,
        'total_completed': total_completed,
        'completion_rate': completion_rate,
        'current_streak': current_streak,
        'longest_streak': longest_streak,
        'day_of_week_stats': day_stats,
        'weekly_stats': list(reversed(weekly_stats)),
        'best_day': best_day,
        'recent_completions': completion_dates[:10],
        'daily_data': daily_data[-14:]
    }


@router.get("/habits")
def get_all_habits_stats(request: Request, days: int = Query(30, description="Number of days to analyze")):
    """Get summary statistics for all habits"""
    storage = request.app.state.storage
    all_tasks = storage.list_tasks()
    habits = [t for t in all_tasks if t.is_habit]

    results = []
    for habit in habits:
        stats = get_habit_stats(request, habit.id, days)
        if 'error' not in stats:
            results.append({
                'habit_id': habit.id,
                'title': habit.title,
                'project_id': habit.project_id,
                'completion_rate': stats['completion_rate'],
                'current_streak': stats['current_streak'],
                'total_completed': stats['total_completed'],
                'total_scheduled': stats['total_scheduled'],
                'best_day': stats['best_day']
            })

    results.sort(key=lambda x: x['completion_rate'], reverse=True)
    return results


@router.get("/weekly")
def get_weekly_report(
    request: Request,
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)")
):
    """Get weekly report with completion stats and insights"""
    analytics = get_analytics(request)

    start = None
    if start_date:
        start = date.fromisoformat(start_date)

    return analytics.get_weekly_report(start_date=start)


@router.get("/trends")
def get_productivity_trends(
    request: Request,
    days: int = Query(30, description="Number of days to analyze")
):
    """Get productivity trends over time"""
    analytics = get_analytics(request)
    return analytics.get_productivity_trends(days=days)


@router.get("/burnout")
def get_burnout_risk(request: Request):
    """Get burnout risk assessment"""
    analytics = get_analytics(request)
    return analytics.get_burnout_risk_assessment()


@router.get("/projects")
def get_all_project_stats(request: Request):
    """Get statistics for all projects"""
    analytics = get_analytics(request)
    storage = request.app.state.storage

    projects = storage.list_projects()
    stats = []

    for project in projects:
        project_stats = analytics.get_project_statistics(project.id)
        project_stats['name'] = project.name
        project_stats['status'] = get_enum_value(project.status)
        stats.append(project_stats)

    # Sort by completion rate descending
    stats.sort(key=lambda x: x['completion_rate'], reverse=True)

    return stats


@router.get("/productivity-patterns")
def get_productivity_patterns(
    request: Request,
    days: int = Query(30, description="Number of days to analyze")
):
    """
    Analyze productivity patterns by time of day.
    Returns task completion stats grouped by hour.
    """
    storage = request.app.state.storage
    all_tasks = storage.list_tasks()

    # Get schedules for the past N days
    end_date = date.today()
    start_date = end_date - timedelta(days=days-1)
    schedules = storage.list_schedules(start_date, end_date)

    # Initialize hourly stats
    hourly_stats = {i: {'scheduled': 0, 'completed': 0, 'total_minutes': 0} for i in range(24)}

    # Track completions by hour
    for schedule in schedules:
        for scheduled_task in schedule.scheduled_tasks:
            if scheduled_task.is_buffer:
                continue

            # Parse start time to get hour
            try:
                hour = int(scheduled_task.start_time.split(':')[0])
            except (ValueError, IndexError, AttributeError):
                continue

            hourly_stats[hour]['scheduled'] += 1
            hourly_stats[hour]['total_minutes'] += scheduled_task.estimated_minutes

            if scheduled_task.task_id in schedule.completed_tasks:
                hourly_stats[hour]['completed'] += 1

    # Calculate rates and identify patterns
    time_blocks = {
        'early_morning': (5, 8),    # 5 AM - 8 AM
        'morning': (9, 11),          # 9 AM - 11 AM
        'midday': (12, 13),          # 12 PM - 1 PM
        'afternoon': (14, 17),       # 2 PM - 5 PM
        'evening': (18, 21),         # 6 PM - 9 PM
        'night': (22, 4),            # 10 PM - 4 AM
    }

    block_stats = {}
    for block_name, (start_hour, end_hour) in time_blocks.items():
        block_scheduled = 0
        block_completed = 0
        block_minutes = 0

        if start_hour <= end_hour:
            hours = range(start_hour, end_hour + 1)
        else:
            hours = list(range(start_hour, 24)) + list(range(0, end_hour + 1))

        for hour in hours:
            block_scheduled += hourly_stats[hour]['scheduled']
            block_completed += hourly_stats[hour]['completed']
            block_minutes += hourly_stats[hour]['total_minutes']

        block_stats[block_name] = {
            'scheduled': block_scheduled,
            'completed': block_completed,
            'total_minutes': block_minutes,
            'completion_rate': block_completed / block_scheduled if block_scheduled > 0 else 0
        }

    # Find best and worst time blocks
    blocks_with_data = [(name, stats) for name, stats in block_stats.items() if stats['scheduled'] > 0]
    best_block = max(blocks_with_data, key=lambda x: x[1]['completion_rate'])[0] if blocks_with_data else None
    worst_block = min(blocks_with_data, key=lambda x: x[1]['completion_rate'])[0] if blocks_with_data else None

    # Find peak productivity hours
    peak_hours = sorted(
        [(hour, stats) for hour, stats in hourly_stats.items() if stats['scheduled'] > 0],
        key=lambda x: x[1]['completed'] / x[1]['scheduled'] if x[1]['scheduled'] > 0 else 0,
        reverse=True
    )[:3]

    # Convert hourly stats to list format for frontend
    hourly_data = []
    for hour in range(24):
        stats = hourly_stats[hour]
        hourly_data.append({
            'hour': hour,
            'hour_label': f"{hour:02d}:00",
            'scheduled': stats['scheduled'],
            'completed': stats['completed'],
            'total_minutes': stats['total_minutes'],
            'completion_rate': stats['completed'] / stats['scheduled'] if stats['scheduled'] > 0 else 0
        })

    # Generate insights
    insights = []
    if best_block:
        block_name_formatted = best_block.replace('_', ' ').title()
        insights.append(f"Your best productivity is during {block_name_formatted}")
    if worst_block and worst_block != best_block:
        block_name_formatted = worst_block.replace('_', ' ').title()
        insights.append(f"Consider rescheduling tasks from {block_name_formatted}")
    if peak_hours:
        peak_hour_labels = [f"{h[0]}:00" for h in peak_hours]
        insights.append(f"Peak hours: {', '.join(peak_hour_labels)}")

    return {
        'period_days': days,
        'hourly_data': hourly_data,
        'time_blocks': block_stats,
        'best_time_block': best_block,
        'worst_time_block': worst_block,
        'peak_hours': [{'hour': h[0], 'stats': h[1]} for h in peak_hours],
        'insights': insights
    }
