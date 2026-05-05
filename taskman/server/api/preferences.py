from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Dict, List, Optional

router = APIRouter()


class EnergyBlockInput(BaseModel):
    start: str
    end: str
    level: str


class DayWorkHoursInput(BaseModel):
    start: str
    end: str


class SchedulingPreferencesInput(BaseModel):
    batch_similar_tasks: Optional[bool] = None
    auto_reschedule_daily: Optional[bool] = None
    days_to_schedule_ahead: Optional[int] = None
    respect_energy_patterns: Optional[bool] = None
    energy_match_bonus: Optional[float] = None
    max_deep_work_stretch: Optional[int] = None


class PreferencesUpdate(BaseModel):
    work_hours: Optional[Dict[str, DayWorkHoursInput]] = None
    energy_patterns: Optional[Dict[str, List[EnergyBlockInput]]] = None
    scheduling_preferences: Optional[SchedulingPreferencesInput] = None


@router.get("/")
def get_preferences(request: Request):
    """Get user preferences"""
    storage = request.app.state.storage
    prefs = storage.get_preferences()
    return prefs.model_dump()


@router.put("/")
def update_preferences(request: Request, update: PreferencesUpdate):
    """Update user preferences"""
    storage = request.app.state.storage
    prefs = storage.get_preferences()

    # Update work hours if provided
    if update.work_hours:
        for day, hours in update.work_hours.items():
            if day in prefs.work_hours:
                prefs.work_hours[day].start = hours.start
                prefs.work_hours[day].end = hours.end

    # Update energy patterns if provided
    if update.energy_patterns:
        from taskman.server.models.user_preferences import EnergyBlock
        for day, patterns in update.energy_patterns.items():
            prefs.energy_patterns[day] = [
                EnergyBlock(start=p.start, end=p.end, level=p.level)
                for p in patterns
            ]

    # Update scheduling preferences if provided
    if update.scheduling_preferences:
        sp = update.scheduling_preferences
        if sp.batch_similar_tasks is not None:
            prefs.scheduling_preferences.batch_similar_tasks = sp.batch_similar_tasks
        if sp.auto_reschedule_daily is not None:
            prefs.scheduling_preferences.auto_reschedule_daily = sp.auto_reschedule_daily
        if sp.days_to_schedule_ahead is not None:
            prefs.scheduling_preferences.days_to_schedule_ahead = sp.days_to_schedule_ahead
        if sp.respect_energy_patterns is not None:
            prefs.scheduling_preferences.respect_energy_patterns = sp.respect_energy_patterns
        if sp.energy_match_bonus is not None:
            prefs.scheduling_preferences.energy_match_bonus = sp.energy_match_bonus
        if sp.max_deep_work_stretch is not None:
            prefs.scheduling_preferences.max_deep_work_stretch = sp.max_deep_work_stretch

    # Save preferences
    storage.save_preferences(prefs)
    return prefs.model_dump()
