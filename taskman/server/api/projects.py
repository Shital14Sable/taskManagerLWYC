from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
import uuid
from datetime import datetime

from taskman.server.models.project import Project, ProjectCreate, ProjectUpdate
from taskman.shared.constants import SHORT_ID_LENGTH
from taskman.shared.exceptions import ProjectNotFoundException

router = APIRouter()

def generate_short_id() -> str:
    """Generate 8-character short ID"""
    return str(uuid.uuid4())[:SHORT_ID_LENGTH]

@router.post("/", response_model=Project)
def create_project(project: ProjectCreate, request: Request):
    """Create a new project"""
    storage = request.app.state.storage
    
    new_project = Project(
        id=generate_short_id(),
        name=project.name,
        description=project.description,
        priority=project.priority,
        tags=project.tags,
        parent_id=project.parent_id,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    storage.save_project(new_project)
    return new_project

@router.get("/", response_model=List[Project])
def list_projects(request: Request, status: Optional[str] = None):
    """List all projects"""
    storage = request.app.state.storage
    return storage.list_projects(status=status)

@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str, request: Request):
    """Get a specific project"""
    storage = request.app.state.storage
    try:
        return storage.get_project(project_id)
    except ProjectNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.put("/{project_id}", response_model=Project)
def update_project(project_id: str, update: ProjectUpdate, request: Request):
    """Update a project"""
    storage = request.app.state.storage
    
    try:
        project = storage.get_project(project_id)
    except ProjectNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    # Update fields
    if update.name is not None:
        project.name = update.name
    if update.description is not None:
        project.description = update.description
    if update.priority is not None:
        project.priority = update.priority
    if update.status is not None:
        project.status = update.status
        if update.status.value == "completed":
            project.completed_at = datetime.now()
    if update.tags is not None:
        project.tags = update.tags
    if update.parent_id is not None:
        project.parent_id = update.parent_id
    
    project.updated_at = datetime.now()
    storage.save_project(project)
    
    return project

@router.delete("/{project_id}")
def delete_project(project_id: str, request: Request):
    """Delete a project"""
    storage = request.app.state.storage
    
    try:
        storage.delete_project(project_id)
    except ProjectNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    return {"message": f"Project {project_id} deleted"}