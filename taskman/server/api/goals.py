from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
import uuid
from datetime import datetime

from taskman.server.models.goal import Goal, GoalCreate, GoalUpdate, GoalStatus
from taskman.shared.constants import SHORT_ID_LENGTH
from taskman.shared.exceptions import GoalNotFoundException

router = APIRouter()


def generate_short_id() -> str:
    """Generate 8-character short ID"""
    return str(uuid.uuid4())[:SHORT_ID_LENGTH]


@router.post("/", response_model=Goal)
def create_goal(goal_data: GoalCreate, request: Request):
    """Create a new goal"""
    storage = request.app.state.storage

    new_goal = Goal(
        id=generate_short_id(),
        title=goal_data.title,
        description=goal_data.description,
        time_horizon=goal_data.time_horizon,
        category=goal_data.category,
        target_date=goal_data.target_date,
        linked_project_ids=goal_data.linked_project_ids,
        parent_goal_id=goal_data.parent_goal_id,
        status=GoalStatus.ACTIVE,
        progress=0.0,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    storage.save_goal(new_goal)
    return new_goal


@router.get("/", response_model=List[Goal])
def list_goals(
    request: Request,
    status: Optional[str] = None,
    time_horizon: Optional[str] = None,
    category: Optional[str] = None
):
    """List all goals with optional filters"""
    storage = request.app.state.storage
    goals = storage.list_goals(status=status, time_horizon=time_horizon, category=category)

    # Update progress for each goal
    for goal in goals:
        goal.progress = storage.calculate_goal_progress(goal.id)

    return goals


@router.get("/{goal_id}", response_model=Goal)
def get_goal(goal_id: str, request: Request):
    """Get a specific goal"""
    storage = request.app.state.storage
    try:
        goal = storage.get_goal(goal_id)
        goal.progress = storage.calculate_goal_progress(goal_id)
        return goal
    except GoalNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{goal_id}", response_model=Goal)
def update_goal(goal_id: str, update: GoalUpdate, request: Request):
    """Update a goal"""
    storage = request.app.state.storage

    try:
        goal = storage.get_goal(goal_id)
    except GoalNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Update fields
    if update.title is not None:
        goal.title = update.title
    if update.description is not None:
        goal.description = update.description
    if update.time_horizon is not None:
        goal.time_horizon = update.time_horizon
    if update.category is not None:
        goal.category = update.category
    if update.target_date is not None:
        goal.target_date = update.target_date
    if update.linked_project_ids is not None:
        goal.linked_project_ids = update.linked_project_ids
    if update.parent_goal_id is not None:
        goal.parent_goal_id = update.parent_goal_id
    if update.status is not None:
        goal.status = update.status
        if update.status == GoalStatus.ACHIEVED:
            goal.achieved_at = datetime.now()

    goal.updated_at = datetime.now()
    goal.progress = storage.calculate_goal_progress(goal_id)
    storage.save_goal(goal)

    return goal


@router.delete("/{goal_id}")
def delete_goal(goal_id: str, request: Request):
    """Delete a goal"""
    storage = request.app.state.storage

    try:
        storage.delete_goal(goal_id)
    except GoalNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": f"Goal {goal_id} deleted"}


@router.post("/{goal_id}/link-project/{project_id}", response_model=Goal)
def link_project_to_goal(goal_id: str, project_id: str, request: Request):
    """Link a project to a goal"""
    storage = request.app.state.storage

    try:
        goal = storage.get_goal(goal_id)
    except GoalNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Verify project exists
    try:
        storage.get_project(project_id)
    except:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    if project_id not in goal.linked_project_ids:
        goal.linked_project_ids.append(project_id)
        goal.updated_at = datetime.now()
        goal.progress = storage.calculate_goal_progress(goal_id)
        storage.save_goal(goal)

    return goal


@router.delete("/{goal_id}/unlink-project/{project_id}", response_model=Goal)
def unlink_project_from_goal(goal_id: str, project_id: str, request: Request):
    """Unlink a project from a goal"""
    storage = request.app.state.storage

    try:
        goal = storage.get_goal(goal_id)
    except GoalNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if project_id in goal.linked_project_ids:
        goal.linked_project_ids.remove(project_id)
        goal.updated_at = datetime.now()
        goal.progress = storage.calculate_goal_progress(goal_id)
        storage.save_goal(goal)

    return goal


@router.get("/{goal_id}/progress")
def get_goal_progress(goal_id: str, request: Request):
    """Get detailed progress for a goal"""
    storage = request.app.state.storage

    try:
        goal = storage.get_goal(goal_id)
    except GoalNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    projects_progress = []
    total_tasks = 0
    completed_tasks = 0

    for project_id in goal.linked_project_ids:
        try:
            project = storage.get_project(project_id)
            project_tasks = storage.list_tasks(project_id=project_id)
            project_completed = len([t for t in project_tasks if t.status == 'completed'])
            project_total = len(project_tasks)

            total_tasks += project_total
            completed_tasks += project_completed

            projects_progress.append({
                "project_id": project_id,
                "project_name": project.name,
                "total_tasks": project_total,
                "completed_tasks": project_completed,
                "progress": round((project_completed / project_total) * 100, 1) if project_total > 0 else 0
            })
        except:
            continue

    return {
        "goal_id": goal_id,
        "goal_title": goal.title,
        "overall_progress": round((completed_tasks / total_tasks) * 100, 1) if total_tasks > 0 else 0,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "linked_projects": len(goal.linked_project_ids),
        "projects": projects_progress
    }
