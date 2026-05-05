from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
import uuid
from datetime import datetime

from taskman.server.models.task import Task, TaskCreate, TaskUpdate, Recurrence
from taskman.shared.constants import SHORT_ID_LENGTH, TaskStatus
from taskman.shared.exceptions import TaskNotFoundException, ProjectNotFoundException
from taskman.server.utils.dependency_resolver import DependencyResolver
from taskman.server.services.auto_tagger import auto_tag_task, get_all_tag_categories

router = APIRouter()
dep_resolver = DependencyResolver()

def generate_short_id() -> str:
    """Generate 8-character short ID"""
    return str(uuid.uuid4())[:SHORT_ID_LENGTH]

@router.post("/", response_model=Task)
def create_task(task: TaskCreate, request: Request):
    """Create a new task"""
    storage = request.app.state.storage

    # Verify project exists and get project name for auto-tagging
    try:
        project = storage.get_project(task.project_id)
        project_name = project.name
    except ProjectNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Validate dependencies if provided
    if task.dependencies:
        all_tasks = storage.list_tasks()
        try:
            for dep_id in task.dependencies:
                dep_resolver.validate_dependency(
                    f"temp_{uuid.uuid4()}", dep_id, all_tasks
                )
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    # FIX: Properly handle is_habit and recurrence
    # If recurrence is provided, ensure we have a proper Recurrence object
    if task.recurrence:
        recurrence_obj = task.recurrence
    else:
        recurrence_obj = Recurrence()

    # Auto-tag the task if no tags provided
    if not task.tags:
        auto_tags = auto_tag_task(task.title, task.description, project_name)
    else:
        # If tags provided, still add project tag if not present
        auto_tags = task.tags.copy()
        project_tag = f"Projects/{project_name}"
        if project_tag not in auto_tags:
            auto_tags.insert(0, project_tag)

    # Create new task
    new_task = Task(
        id=generate_short_id(),
        project_id=task.project_id,
        parent_task_id=task.parent_task_id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        difficulty=task.difficulty,
        energy_level=task.energy_level,
        estimated_minutes=task.estimated_minutes,
        dependencies=task.dependencies,
        tags=auto_tags,
        is_habit=task.is_habit,
        recurrence=recurrence_obj,
        needs_review=task.needs_review,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    storage.save_task(new_task)
    return new_task

@router.get("/", response_model=List[Task])
def list_tasks(request: Request, project_id: Optional[str] = None, 
               status: Optional[str] = None):
    """List all tasks"""
    storage = request.app.state.storage
    return storage.list_tasks(project_id=project_id, status=status)

@router.get("/{task_id}", response_model=Task)
def get_task(task_id: str, request: Request):
    """Get a specific task"""
    storage = request.app.state.storage
    try:
        return storage.get_task(task_id)
    except TaskNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{task_id}", response_model=Task)
def update_task(task_id: str, update: TaskUpdate, request: Request):
    """Update a task"""
    storage = request.app.state.storage
    
    try:
        task = storage.get_task(task_id)
    except TaskNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Update fields
    if update.title is not None:
        task.title = update.title
    if update.description is not None:
        task.description = update.description
    if update.priority is not None:
        task.priority = update.priority
    if update.difficulty is not None:
        task.difficulty = update.difficulty
    if update.energy_level is not None:
        task.energy_level = update.energy_level
    if update.estimated_minutes is not None:
        task.estimated_minutes = update.estimated_minutes
    if update.actual_minutes is not None:
        task.actual_minutes = update.actual_minutes
    if update.status is not None:
        task.status = update.status
        if update.status == TaskStatus.COMPLETED:
            task.completed_at = datetime.now()
            # Record completion for analytics
            storage.record_task_completion(task)
            # For habits: reset status to "todo" so they can be scheduled again
            if task.is_habit:
                task.status = TaskStatus.TODO
                task.completed_at = None
    if update.dependencies is not None:
        task.dependencies = update.dependencies
    if update.tags is not None:
        task.tags = update.tags
    if update.scheduled_for is not None:
        task.scheduled_for = update.scheduled_for
    if update.needs_review is not None:
        task.needs_review = update.needs_review
    if update.is_pinned is not None:
        task.is_pinned = update.is_pinned
    if update.pin_type is not None:
        task.pin_type = update.pin_type
    if 'deadline' in (update.model_dump(exclude_unset=True) or {}):
        task.deadline = update.deadline  # Can be None to clear deadline
    if update.is_paused is not None:
        task.is_paused = update.is_paused
    if 'paused_until' in (update.model_dump(exclude_unset=True) or {}):
        task.paused_until = update.paused_until  # Can be None to clear
    if update.recurrence is not None:
        task.recurrence = update.recurrence

    task.updated_at = datetime.now()
    storage.save_task(task)

    return task


@router.get("/tags/categories")
def get_tag_categories():
    """Get all available tag categories with their keywords"""
    return get_all_tag_categories()

@router.delete("/{task_id}")
def delete_task(task_id: str, request: Request):
    """Delete a task"""
    storage = request.app.state.storage
    
    try:
        storage.delete_task(task_id)
    except TaskNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    return {"message": f"Task {task_id} deleted"}

@router.post("/{task_id}/complete")
def complete_task(task_id: str, request: Request, actual_minutes: Optional[int] = None):
    """Mark a task as complete and award XP"""
    from datetime import date
    storage = request.app.state.storage
    gamification = request.app.state.gamification

    try:
        task = storage.get_task(task_id)
    except TaskNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    task.status = TaskStatus.COMPLETED
    task.completed_at = datetime.now()
    if actual_minutes is not None:
        task.actual_minutes = actual_minutes

    task.updated_at = datetime.now()
    storage.save_task(task)

    # Record for analytics
    storage.record_task_completion(task)

    # Update today's schedule to mark this task as completed (for analytics)
    today_schedule = storage.get_schedule(date.today())
    if today_schedule and task_id not in today_schedule.completed_tasks:
        today_schedule.completed_tasks.append(task_id)
        storage.save_schedule(today_schedule)

    # Award XP and check for badges
    xp_earned, new_level, new_badges = gamification.award_xp(task)

    # For habits: reset status to "todo" so they can be scheduled again
    # The completion is already recorded above for analytics/XP
    if task.is_habit:
        task.status = TaskStatus.TODO
        task.completed_at = None  # Clear so it can be completed again
        task.updated_at = datetime.now()
        storage.save_task(task)

        # Delete future schedules so they get regenerated with this habit
        # This ensures the habit appears in future schedules after completion
        from datetime import timedelta
        for i in range(1, 8):  # Delete next 7 days of schedules
            future_date = date.today() + timedelta(days=i)
            try:
                storage.delete_schedule(future_date)
            except Exception:
                pass  # Ignore if schedule doesn't exist

    # Return task with XP info
    task_dict = task.dict()
    task_dict["xp_earned"] = xp_earned
    task_dict["new_level"] = new_level
    task_dict["new_badges"] = [b.dict() for b in new_badges]

    return task_dict

@router.post("/{task_id}/dependencies", response_model=Task)
def add_dependency(task_id: str, dependency_id: str, request: Request):
    """Add a dependency to a task"""
    storage = request.app.state.storage
    
    try:
        task = storage.get_task(task_id)
    except TaskNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Validate dependency
    all_tasks = storage.list_tasks()
    try:
        dep_resolver.validate_dependency(task_id, dependency_id, all_tasks)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if dependency_id not in task.dependencies:
        task.dependencies.append(dependency_id)
        task.updated_at = datetime.now()
        storage.save_task(task)
    
    return task

@router.delete("/{task_id}/dependencies/{dependency_id}", response_model=Task)
def remove_dependency(task_id: str, dependency_id: str, request: Request):
    """Remove a dependency from a task"""
    storage = request.app.state.storage
    
    try:
        task = storage.get_task(task_id)
    except TaskNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    if dependency_id in task.dependencies:
        task.dependencies.remove(dependency_id)
        task.updated_at = datetime.now()
        storage.save_task(task)
    
    return task