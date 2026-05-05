from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import List, Optional

class TimeSlot(BaseModel):
    start: str  # HH:MM format
    end: str    # HH:MM format
    label: str

class SchedulePreferences(BaseModel):
    hard_tasks_hours: List[str] = Field(default_factory=lambda: ["08:00-12:00"])
    easy_tasks_hours: List[str] = Field(default_factory=lambda: ["17:00-22:00"])
    break_preferred_hours: List[str] = Field(default_factory=lambda: ["14:00-16:00"])
    min_task_duration: int = 15
    buffer_between_tasks: int = 10
    max_deep_work_stretch: int = 120
    batch_similar_tasks: bool = True

class ScheduleConstraints(BaseModel):
    work_start: str = "08:00"
    work_end: str = "22:00"
    blocked_slots: List[TimeSlot] = Field(default_factory=list)
    preferences: SchedulePreferences = Field(default_factory=SchedulePreferences)

class ScheduledTask(BaseModel):
    task_id: str
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    estimated_minutes: int
    is_buffer: bool = False
    auto_scheduled: bool = True

class ScheduleSummary(BaseModel):
    total_scheduled_minutes: int = 0
    total_completed_minutes: int = 0
    completion_rate: float = 0.0
    tasks_completed: int = 0
    tasks_remaining: int = 0
    tasks_behind_schedule: int = 0

class Schedule(BaseModel):
    date: date
    user_id: str = "default"
    constraints: ScheduleConstraints = Field(default_factory=ScheduleConstraints)
    scheduled_tasks: List[ScheduledTask] = Field(default_factory=list)
    completed_tasks: List[str] = Field(default_factory=list)
    summary: ScheduleSummary = Field(default_factory=ScheduleSummary)
    generated_at: datetime = Field(default_factory=datetime.now)
    last_rescheduled_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }