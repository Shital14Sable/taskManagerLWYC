"""
Global Search API endpoints
"""
from fastapi import APIRouter, Request, Query
from typing import List, Optional
from datetime import datetime

from taskman.server.models.task import Task
from taskman.server.models.project import Project

router = APIRouter()


@router.get("/")
def global_search(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query"),
    type: Optional[str] = Query(None, description="Filter by type: task, project, habit"),
    project_id: Optional[str] = Query(None, description="Filter by project"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
):
    """
    Global search across tasks and projects.
    Searches titles, descriptions, and tags.
    """
    storage = request.app.state.storage
    query = q.lower().strip()
    results = []

    # Search tasks
    if type is None or type in ("task", "habit"):
        tasks = storage.list_tasks(project_id=project_id, status=status)
        for task in tasks:
            # Skip if filtering by type
            if type == "task" and task.is_habit:
                continue
            if type == "habit" and not task.is_habit:
                continue

            score = 0
            matches = []

            # Title match (highest weight)
            if query in task.title.lower():
                score += 10
                matches.append("title")

            # Description match
            if task.description and query in task.description.lower():
                score += 5
                matches.append("description")

            # Tag match
            for tag in task.tags:
                if query in tag.lower():
                    score += 3
                    matches.append(f"tag:{tag}")
                    break

            if score > 0:
                # Get project name
                try:
                    project = storage.get_project(task.project_id)
                    project_name = project.name
                except Exception:
                    project_name = "Unknown"

                results.append({
                    "type": "habit" if task.is_habit else "task",
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "status": task.status if isinstance(task.status, str) else task.status.value,
                    "project_id": task.project_id,
                    "project_name": project_name,
                    "tags": task.tags,
                    "priority": task.priority,
                    "deadline": task.deadline.isoformat() if task.deadline else None,
                    "is_habit": task.is_habit,
                    "score": score,
                    "matches": matches,
                })

    # Search projects
    if type is None or type == "project":
        projects = storage.list_projects(status=status)
        for project in projects:
            score = 0
            matches = []

            # Name match (highest weight)
            if query in project.name.lower():
                score += 10
                matches.append("name")

            # Description match
            if project.description and query in project.description.lower():
                score += 5
                matches.append("description")

            # Tag match
            for tag in project.tags:
                if query in tag.lower():
                    score += 3
                    matches.append(f"tag:{tag}")
                    break

            if score > 0:
                results.append({
                    "type": "project",
                    "id": project.id,
                    "title": project.name,
                    "description": project.description,
                    "status": project.status if isinstance(project.status, str) else project.status.value,
                    "project_id": None,
                    "project_name": None,
                    "tags": project.tags,
                    "priority": project.priority,
                    "deadline": None,
                    "is_habit": False,
                    "score": score,
                    "matches": matches,
                })

    # Sort by score (descending) then by title
    results.sort(key=lambda x: (-x["score"], x["title"].lower()))

    # Apply limit
    results = results[:limit]

    return {
        "query": q,
        "total": len(results),
        "results": results,
    }


@router.get("/suggestions")
def search_suggestions(
    request: Request,
    q: str = Query(..., min_length=1, description="Partial query for suggestions"),
    limit: int = Query(5, ge=1, le=20, description="Maximum suggestions"),
):
    """
    Get search suggestions based on partial input.
    Returns matching titles and tags.
    """
    storage = request.app.state.storage
    query = q.lower().strip()
    suggestions = set()

    # Get suggestions from task titles
    tasks = storage.list_tasks()
    for task in tasks:
        if query in task.title.lower():
            suggestions.add(task.title)
        for tag in task.tags:
            if query in tag.lower():
                suggestions.add(tag)

    # Get suggestions from project names
    projects = storage.list_projects()
    for project in projects:
        if query in project.name.lower():
            suggestions.add(project.name)

    # Sort and limit
    sorted_suggestions = sorted(suggestions, key=lambda x: (not x.lower().startswith(query), x.lower()))

    return {
        "query": q,
        "suggestions": sorted_suggestions[:limit],
    }
