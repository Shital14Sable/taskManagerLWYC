from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from taskman.shared.constants import ProjectStatus

class Project(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    priority: int = Field(ge=1, le=5, default=3)
    status: ProjectStatus = ProjectStatus.ACTIVE
    tags: List[str] = Field(default_factory=list)
    parent_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    priority: int = Field(ge=1, le=5, default=3)
    tags: List[str] = Field(default_factory=list)
    parent_id: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    status: Optional[ProjectStatus] = None
    tags: Optional[List[str]] = None
    parent_id: Optional[str] = None