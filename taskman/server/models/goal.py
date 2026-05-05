from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class TimeHorizon(str, Enum):
    YEARLY = "yearly"
    QUARTERLY = "quarterly"
    MONTHLY = "monthly"


class GoalCategory(str, Enum):
    CAREER = "career"
    HEALTH = "health"
    PERSONAL = "personal"
    LEARNING = "learning"
    FINANCIAL = "financial"
    RELATIONSHIPS = "relationships"
    OTHER = "other"


class GoalStatus(str, Enum):
    ACTIVE = "active"
    ACHIEVED = "achieved"
    ABANDONED = "abandoned"


class Goal(BaseModel):
    """A goal that can have projects linked to it"""
    id: str
    title: str
    description: Optional[str] = None
    time_horizon: TimeHorizon = TimeHorizon.YEARLY
    category: GoalCategory = GoalCategory.OTHER
    target_date: Optional[str] = None  # ISO date string
    linked_project_ids: List[str] = Field(default_factory=list)
    parent_goal_id: Optional[str] = None  # For goal hierarchy
    status: GoalStatus = GoalStatus.ACTIVE
    progress: float = 0.0  # 0-100, auto-calculated from linked projects
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    achieved_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class GoalCreate(BaseModel):
    """Schema for creating a new goal"""
    title: str
    description: Optional[str] = None
    time_horizon: TimeHorizon = TimeHorizon.YEARLY
    category: GoalCategory = GoalCategory.OTHER
    target_date: Optional[str] = None
    linked_project_ids: List[str] = Field(default_factory=list)
    parent_goal_id: Optional[str] = None


class GoalUpdate(BaseModel):
    """Schema for updating a goal"""
    title: Optional[str] = None
    description: Optional[str] = None
    time_horizon: Optional[TimeHorizon] = None
    category: Optional[GoalCategory] = None
    target_date: Optional[str] = None
    linked_project_ids: Optional[List[str]] = None
    parent_goal_id: Optional[str] = None
    status: Optional[GoalStatus] = None
