"""Export API for exporting tasks, projects, habits, lists, and schedules."""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from datetime import date, timedelta
from typing import Optional, List
from pydantic import BaseModel

router = APIRouter()


class ExportRequest(BaseModel):
    """Request body for export."""
    include_projects: bool = True
    include_tasks: bool = True
    include_habits: bool = True
    include_lists: bool = True
    include_schedules: bool = True
    schedule_days: int = 14  # Number of days of schedules to export
    include_completed: bool = False  # Include completed tasks


@router.post("/")
async def export_data(request: Request, body: Optional[ExportRequest] = None):
    """Export data in structured JSON format.

    Returns a comprehensive export of projects, tasks, habits, and schedules
    that can be used for backups, analysis, or AI agent processing.
    """
    storage = request.app.state.storage

    if body is None:
        body = ExportRequest()

    export_data = {
        "export_date": date.today().isoformat(),
        "version": "1.0"
    }

    # Export projects
    if body.include_projects:
        projects = storage.list_projects()
        export_data["projects"] = [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in projects
        ]

    # Export tasks (non-habits)
    if body.include_tasks:
        tasks = storage.list_tasks()
        if not body.include_completed:
            tasks = [t for t in tasks if t.status != "completed"]

        non_habit_tasks = [t for t in tasks if not t.is_habit]
        export_data["tasks"] = [
            {
                "id": t.id,
                "project_id": t.project_id,
                "parent_task_id": t.parent_task_id,
                "title": t.title,
                "description": t.description,
                "priority": t.priority,
                "difficulty": t.difficulty,
                "energy_level": t.energy_level,
                "estimated_minutes": t.estimated_minutes,
                "status": t.status,
                "dependencies": t.dependencies,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "tags": t.tags,
                "is_paused": t.is_paused,
                "paused_until": t.paused_until.isoformat() if t.paused_until else None,
            }
            for t in non_habit_tasks
        ]

    # Export habits
    if body.include_habits:
        tasks = storage.list_tasks()
        habits = [t for t in tasks if t.is_habit]
        if not body.include_completed:
            habits = [h for h in habits if h.status != "completed"]

        export_data["habits"] = [
            {
                "id": h.id,
                "project_id": h.project_id,
                "title": h.title,
                "description": h.description,
                "priority": h.priority,
                "estimated_minutes": h.estimated_minutes,
                "energy_level": h.energy_level,
                "status": h.status,
                "recurrence": {
                    "frequency": h.recurrence.frequency if h.recurrence else None,
                    "days_of_week": h.recurrence.days_of_week if h.recurrence else [],
                    "time_of_day": h.recurrence.time_of_day if h.recurrence else None,
                } if h.recurrence else None,
                "is_paused": h.is_paused,
                "paused_until": h.paused_until.isoformat() if h.paused_until else None,
            }
            for h in habits
        ]

    # Export lists
    if body.include_lists:
        lists = storage.list_lists(include_archived=False)
        export_data["lists"] = [
            {
                "id": lst.id,
                "name": lst.name,
                "description": lst.description,
                "list_type": lst.list_type.value if hasattr(lst.list_type, 'value') else lst.list_type,
                "categories": lst.categories,
                "is_pinned": lst.is_pinned,
                "color": lst.color,
                "icon": lst.icon,
                "default_sort": lst.default_sort,
                "created_at": lst.created_at.isoformat() if lst.created_at else None,
                "updated_at": lst.updated_at.isoformat() if lst.updated_at else None,
                "items": [
                    {
                        "id": item.id,
                        "text": item.text,
                        "quantity": item.quantity,
                        "notes": item.notes,
                        "category": item.category,
                        "url": item.url,
                        "tags": item.tags,
                        "order": item.order,
                        "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                        "price": item.price,
                        "rating": item.rating,
                        "priority": item.priority,
                        "location": item.location,
                        "due_date": item.due_date.isoformat() if item.due_date else None,
                        "source": item.source,
                    }
                    for item in lst.items
                ],
                "linked_habit_ids": lst.linked_habit_ids,
                "linked_project_ids": lst.linked_project_ids,
            }
            for lst in lists
        ]

    # Export schedules
    if body.include_schedules:
        schedules = []
        today = date.today()
        for i in range(body.schedule_days):
            current_date = today + timedelta(days=i)
            schedule = storage.get_schedule(current_date)
            if schedule:
                scheduled_items = []
                for st in schedule.scheduled_tasks:
                    if st.is_buffer:
                        scheduled_items.append({
                            "type": "break",
                            "start_time": st.start_time,
                            "end_time": st.end_time,
                            "duration_minutes": st.estimated_minutes,
                        })
                    else:
                        # Get task details
                        task = None
                        try:
                            task = storage.get_task(st.task_id)
                        except:
                            pass

                        scheduled_items.append({
                            "type": "habit" if (task and task.is_habit) else "task",
                            "task_id": st.task_id,
                            "title": task.title if task else "Unknown",
                            "start_time": st.start_time,
                            "end_time": st.end_time,
                            "duration_minutes": st.estimated_minutes,
                        })

                schedules.append({
                    "date": current_date.isoformat(),
                    "work_start": schedule.constraints.work_start if schedule.constraints else None,
                    "work_end": schedule.constraints.work_end if schedule.constraints else None,
                    "items": scheduled_items,
                    "total_minutes": schedule.summary.total_scheduled_minutes if schedule.summary else 0,
                })

        export_data["schedules"] = schedules

    return JSONResponse(content=export_data)


@router.get("/summary")
async def export_summary(request: Request):
    """Get a quick summary of exportable data."""
    storage = request.app.state.storage

    tasks = storage.list_tasks()
    projects = storage.list_projects()
    lists = storage.list_lists(include_archived=False)

    habits = [t for t in tasks if t.is_habit]
    non_habit_tasks = [t for t in tasks if not t.is_habit]

    todo_tasks = [t for t in non_habit_tasks if t.status == "todo"]
    in_progress_tasks = [t for t in non_habit_tasks if t.status == "in_progress"]
    completed_tasks = [t for t in non_habit_tasks if t.status == "completed"]

    return {
        "projects_count": len(projects),
        "tasks": {
            "total": len(non_habit_tasks),
            "todo": len(todo_tasks),
            "in_progress": len(in_progress_tasks),
            "completed": len(completed_tasks),
        },
        "habits_count": len(habits),
        "lists_count": len(lists),
    }
