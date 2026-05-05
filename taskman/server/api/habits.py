"""
Habit Instance API endpoints.

Allows setting specific details for habit instances (e.g., meal planning).
For example, "Lunch" habit can have instances like:
- Monday: "Fried Rice"
- Tuesday: "Pasta"
"""
from fastapi import APIRouter, Request, HTTPException
from datetime import date, datetime
from typing import List, Optional

from taskman.server.models.habit_instance import (
    HabitInstance,
    HabitInstanceCreate,
    HabitInstanceUpdate
)

router = APIRouter()


@router.get("/{habit_id}/instances")
def list_habit_instances(
    request: Request,
    habit_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """List all instances for a habit, optionally filtered by date range."""
    storage = request.app.state.storage

    # Verify habit exists
    try:
        task = storage.get_task(habit_id)
        if not task.is_habit:
            raise HTTPException(status_code=400, detail="Task is not a habit")
    except Exception:
        raise HTTPException(status_code=404, detail="Habit not found")

    # Parse dates
    start = date.fromisoformat(start_date) if start_date else None
    end = date.fromisoformat(end_date) if end_date else None

    instances = storage.list_habit_instances(habit_id, start, end)
    return [inst.dict() for inst in instances]


@router.get("/{habit_id}/instances/{instance_date}")
def get_habit_instance(request: Request, habit_id: str, instance_date: str):
    """Get a specific habit instance. Returns null if not found (not 404)."""
    storage = request.app.state.storage

    try:
        inst_date = date.fromisoformat(instance_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    instance = storage.get_habit_instance(habit_id, inst_date)
    if not instance:
        # Return null instead of 404 - this is expected for unplanned days
        return None

    return instance.dict()


@router.put("/{habit_id}/instances/{instance_date}")
def create_or_update_habit_instance(
    request: Request,
    habit_id: str,
    instance_date: str,
    data: HabitInstanceCreate
):
    """Create or update a habit instance for a specific date."""
    storage = request.app.state.storage

    # Verify habit exists
    try:
        task = storage.get_task(habit_id)
        if not task.is_habit:
            raise HTTPException(status_code=400, detail="Task is not a habit")
    except Exception:
        raise HTTPException(status_code=404, detail="Habit not found")

    try:
        inst_date = date.fromisoformat(instance_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Check if instance already exists
    existing = storage.get_habit_instance(habit_id, inst_date)

    if existing:
        # Update existing instance
        existing.instance_detail = data.instance_detail
        if data.notes is not None:
            existing.notes = data.notes
        existing.updated_at = datetime.now()
        storage.save_habit_instance(existing)
        return existing.dict()
    else:
        # Create new instance
        instance = HabitInstance(
            habit_id=habit_id,
            date=inst_date,
            instance_detail=data.instance_detail,
            notes=data.notes
        )
        storage.save_habit_instance(instance)
        return instance.dict()


@router.patch("/{habit_id}/instances/{instance_date}")
def update_habit_instance(
    request: Request,
    habit_id: str,
    instance_date: str,
    data: HabitInstanceUpdate
):
    """Update an existing habit instance."""
    storage = request.app.state.storage

    try:
        inst_date = date.fromisoformat(instance_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    instance = storage.get_habit_instance(habit_id, inst_date)
    if not instance:
        raise HTTPException(status_code=404, detail="Habit instance not found")

    # Update fields
    if data.instance_detail is not None:
        instance.instance_detail = data.instance_detail
    if data.notes is not None:
        instance.notes = data.notes
    instance.updated_at = datetime.now()

    storage.save_habit_instance(instance)
    return instance.dict()


@router.delete("/{habit_id}/instances/{instance_date}")
def delete_habit_instance(request: Request, habit_id: str, instance_date: str):
    """Delete a habit instance."""
    storage = request.app.state.storage

    try:
        inst_date = date.fromisoformat(instance_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    deleted = storage.delete_habit_instance(habit_id, inst_date)
    if not deleted:
        raise HTTPException(status_code=404, detail="Habit instance not found")

    return {"message": "Habit instance deleted"}


@router.get("/instances/date/{instance_date}")
def list_instances_for_date(request: Request, instance_date: str):
    """List all habit instances for a specific date (useful for daily view)."""
    storage = request.app.state.storage

    try:
        inst_date = date.fromisoformat(instance_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    instances = storage.list_habit_instances_for_date(inst_date)
    return [inst.dict() for inst in instances]
