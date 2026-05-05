from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict
from taskman.shared.constants import TaskStatus

class Recurrence(BaseModel):
    """Recurrence pattern for habits"""
    frequency: Optional[str] = None  # "daily", "weekly", "monthly"
    days_of_week: List[str] = Field(default_factory=list)  # ["Monday", "Wednesday"]
    time_of_day: Optional[str] = None  # "14:00"
    end_date: Optional[date] = None

class Task(BaseModel):
    id: str
    project_id: str
    parent_task_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: int = Field(ge=1, le=5, default=3)
    difficulty: int = Field(ge=1, le=5, default=3)
    energy_level: str = Field(default="medium")  # low, medium, high
    estimated_minutes: int = 60
    actual_minutes: Optional[int] = None
    status: TaskStatus = TaskStatus.TODO
    dependencies: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)  # Hierarchical tags like ["Work/Meetings", "urgent"]
    deadline: Optional[datetime] = None
    scheduled_for: Optional[datetime] = None  # For hard-pinned tasks, includes date + time
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None

    # Habit-specific fields
    is_habit: bool = False
    recurrence: Recurrence = Field(default_factory=Recurrence)
    is_paused: bool = False  # Whether the habit is paused (excluded from scheduling)
    paused_until: Optional[date] = None  # Auto-resume date (optional)

    # Quick capture / inbox fields
    needs_review: bool = False  # True if task needs user review (quick capture)

    # Pinning for drag & drop scheduling
    is_pinned: bool = False
    pin_type: str = Field(default="soft")  # "soft" or "hard"

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

class TaskCreate(BaseModel):
    project_id: str
    parent_task_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: int = Field(ge=1, le=5, default=3)
    difficulty: int = Field(ge=1, le=5, default=3)
    energy_level: str = "medium"
    estimated_minutes: int = 60
    dependencies: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    deadline: Optional[datetime] = None
    scheduled_for: Optional[datetime] = None  # For hard-pinned tasks, includes date + time

    # Habit fields
    is_habit: bool = False
    recurrence: Optional[Recurrence] = None

    # Quick capture
    needs_review: bool = False

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = Field(None, ge=1, le=5)
    difficulty: Optional[int] = Field(None, ge=1, le=5)
    energy_level: Optional[str] = None
    estimated_minutes: Optional[int] = None
    actual_minutes: Optional[int] = None
    status: Optional[TaskStatus] = None
    dependencies: Optional[List[str]] = None
    tags: Optional[List[str]] = None
    deadline: Optional[datetime] = None
    scheduled_for: Optional[datetime] = None  # For hard-pinned tasks, includes date + time
    needs_review: Optional[bool] = None
    is_pinned: Optional[bool] = None
    pin_type: Optional[str] = None
    is_paused: Optional[bool] = None
    paused_until: Optional[date] = None
    recurrence: Optional[Recurrence] = None  # For updating habit schedule