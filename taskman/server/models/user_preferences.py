from pydantic import BaseModel, Field
from typing import List, Dict, Literal, Optional
from taskman.server.models.schedule import TimeSlot


class DayWorkHours(BaseModel):
    """Work hours for a single day."""
    start: str = "08:00"
    end: str = "22:00"


class EnergyBlock(BaseModel):
    """A time block with an energy level."""
    start: str
    end: str
    level: Literal["high", "medium", "low"]


# Default work hours for each day
def default_work_hours() -> Dict[str, DayWorkHours]:
    return {
        "monday": DayWorkHours(start="08:00", end="22:00"),
        "tuesday": DayWorkHours(start="08:00", end="22:00"),
        "wednesday": DayWorkHours(start="08:00", end="22:00"),
        "thursday": DayWorkHours(start="08:00", end="22:00"),
        "friday": DayWorkHours(start="08:00", end="22:00"),
        "saturday": DayWorkHours(start="08:00", end="22:00"),
        "sunday": DayWorkHours(start="10:00", end="24:00"),
    }


# Default energy patterns for each day
def default_energy_patterns() -> Dict[str, List[EnergyBlock]]:
    weekday_pattern = [
        EnergyBlock(start="08:00", end="12:00", level="high"),
        EnergyBlock(start="12:00", end="17:00", level="medium"),
        EnergyBlock(start="17:00", end="22:00", level="high"),
    ]
    sunday_pattern = [
        EnergyBlock(start="10:00", end="15:00", level="medium"),
        EnergyBlock(start="15:00", end="20:00", level="medium"),
        EnergyBlock(start="20:00", end="24:00", level="low"),
    ]
    return {
        "monday": weekday_pattern.copy(),
        "tuesday": weekday_pattern.copy(),
        "wednesday": weekday_pattern.copy(),
        "thursday": weekday_pattern.copy(),
        "friday": weekday_pattern.copy(),
        "saturday": weekday_pattern.copy(),
        "sunday": sunday_pattern,
    }


class TaskDefaults(BaseModel):
    min_duration: int = 15
    default_duration: int = 60
    buffer_percentage: int = 10


class SchedulingPreferences(BaseModel):
    batch_similar_tasks: bool = True
    auto_reschedule_daily: bool = True
    days_to_schedule_ahead: int = 7
    respect_energy_patterns: bool = True
    energy_match_bonus: float = 0.15  # Score bonus for energy match (15%)
    max_deep_work_stretch: int = 120


class DisplayPreferences(BaseModel):
    time_format: str = "24h"
    date_format: str = "YYYY-MM-DD"
    color_scheme: str = "dark"
    show_completed_tasks: bool = False


class UserPreferences(BaseModel):
    user_id: str = "default"
    work_hours: Dict[str, DayWorkHours] = Field(default_factory=default_work_hours)
    energy_patterns: Dict[str, List[EnergyBlock]] = Field(default_factory=default_energy_patterns)
    default_breaks: List[TimeSlot] = Field(default_factory=list)
    task_defaults: TaskDefaults = Field(default_factory=TaskDefaults)
    scheduling_preferences: SchedulingPreferences = Field(default_factory=SchedulingPreferences)
    display_preferences: DisplayPreferences = Field(default_factory=DisplayPreferences)
    auto_reschedule_time: str = "22:00"
    auto_backup_time: str = "02:00"

    def get_work_hours_for_day(self, day_name: str) -> DayWorkHours:
        """Get work hours for a specific day (lowercase day name)."""
        return self.work_hours.get(day_name.lower(), DayWorkHours())

    def get_energy_patterns_for_day(self, day_name: str) -> List[EnergyBlock]:
        """Get energy patterns for a specific day (lowercase day name)."""
        return self.energy_patterns.get(day_name.lower(), [])

    def get_energy_level_at_time(self, day_name: str, time_str: str) -> Optional[str]:
        """Get the energy level for a specific day and time."""
        patterns = self.get_energy_patterns_for_day(day_name)
        time_minutes = self._time_to_minutes(time_str)

        for block in patterns:
            block_start = self._time_to_minutes(block.start)
            block_end = self._time_to_minutes(block.end)
            if block_start <= time_minutes < block_end:
                return block.level
        return None

    @staticmethod
    def _time_to_minutes(time_str: str) -> int:
        """Convert HH:MM to minutes since midnight."""
        parts = time_str.split(":")
        return int(parts[0]) * 60 + int(parts[1])
