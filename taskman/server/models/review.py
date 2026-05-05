"""
Review model for daily, weekly, and monthly reviews.

Reviews aggregate data from tasks, goals, habits, and lists to provide
a summary of activity and progress for a given time period.
"""
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum


class ReviewType(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TaskSummary(BaseModel):
    """Summary of tasks for a review period"""
    completed_count: int = 0
    completed_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    stale_count: int = 0  # Tasks with no activity in 7+ days
    stale_tasks: List[Dict[str, Any]] = Field(default_factory=list)
    upcoming_deadlines: List[Dict[str, Any]] = Field(default_factory=list)
    total_time_spent: int = 0  # In minutes


class GoalProgress(BaseModel):
    """Progress snapshot for a goal"""
    goal_id: str
    title: str
    progress: float
    status: str
    linked_projects_count: int = 0
    tasks_completed_in_period: int = 0


class HabitSummary(BaseModel):
    """Habit completion summary"""
    habit_id: str
    title: str
    scheduled_count: int = 0
    completed_count: int = 0
    completion_rate: float = 0.0
    current_streak: int = 0


class ListSummary(BaseModel):
    """List with pending items summary"""
    list_id: str
    name: str
    pending_count: int = 0
    completed_count: int = 0
    recent_additions: List[str] = Field(default_factory=list)


class ReviewContent(BaseModel):
    """Auto-generated content for a review"""
    # Task summaries
    tasks_completed: TaskSummary = Field(default_factory=TaskSummary)

    # Goal progress
    goals_progress: List[GoalProgress] = Field(default_factory=list)

    # Habit streaks
    habits_summary: List[HabitSummary] = Field(default_factory=list)

    # Lists with pending items
    lists_summary: List[ListSummary] = Field(default_factory=list)

    # Additional insights
    productivity_score: float = 0.0  # 0-100
    highlights: List[str] = Field(default_factory=list)
    areas_for_improvement: List[str] = Field(default_factory=list)


class Review(BaseModel):
    """A review (daily, weekly, or monthly)"""
    id: str
    review_type: ReviewType
    date: str  # ISO date string - the date this review is for
    period_start: str  # ISO date
    period_end: str  # ISO date
    content: ReviewContent = Field(default_factory=ReviewContent)
    notes: str = ""  # User-added notes/reflections
    created_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    @staticmethod
    def get_period_key(review_type: ReviewType, target_date: date) -> str:
        """Generate a unique key for the review file"""
        if review_type == ReviewType.DAILY:
            return target_date.isoformat()
        elif review_type == ReviewType.WEEKLY:
            # Get ISO week number
            year, week, _ = target_date.isocalendar()
            return f"{year}-W{week:02d}"
        elif review_type == ReviewType.MONTHLY:
            return target_date.strftime("%Y-%m")
        return target_date.isoformat()


class ReviewCreate(BaseModel):
    """Schema for creating/generating a review"""
    review_type: ReviewType
    date: Optional[str] = None  # Default: today


class ReviewUpdate(BaseModel):
    """Schema for updating a review (mainly for adding notes)"""
    notes: Optional[str] = None
