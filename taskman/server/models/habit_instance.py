"""
Habit Instance model for tracking specific details of recurring habits.

For example, a "Lunch" habit can have instances like:
- Monday: "Fried Rice"
- Tuesday: "Pasta"
- Wednesday: "Salad"

This enables meal planning and other habit customization.
"""
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


class HabitInstance(BaseModel):
    """A specific instance of a habit for a particular date."""
    habit_id: str  # Reference to the parent habit task
    date: date  # The date for this instance
    instance_detail: str  # e.g., "Fried Rice" for a Lunch habit
    notes: Optional[str] = None  # Additional notes
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }


class HabitInstanceCreate(BaseModel):
    """Create a habit instance."""
    instance_detail: str
    notes: Optional[str] = None


class HabitInstanceUpdate(BaseModel):
    """Update a habit instance."""
    instance_detail: Optional[str] = None
    notes: Optional[str] = None
