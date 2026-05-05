"""
Time calculation utilities
"""
from datetime import datetime, time, timedelta
from typing import List, Tuple

def time_to_minutes(time_str: str) -> int:
    """Convert HH:MM to minutes since midnight"""
    hours, minutes = map(int, time_str.split(':'))
    return hours * 60 + minutes

def minutes_to_time(minutes: int) -> str:
    """Convert minutes since midnight to HH:MM"""
    hours = minutes // 60
    mins = minutes % 60
    return f"{hours:02d}:{mins:02d}"

def parse_time_range(range_str: str) -> Tuple[int, int]:
    """Parse time range string like '08:00-12:00' to (start_minutes, end_minutes)"""
    start, end = range_str.split('-')
    return time_to_minutes(start.strip()), time_to_minutes(end.strip())

def is_time_in_range(time_minutes: int, start_minutes: int, end_minutes: int) -> bool:
    """Check if time falls within range"""
    return start_minutes <= time_minutes < end_minutes

def get_available_slots(
    work_start: str,
    work_end: str,
    blocked_slots: List[Tuple[str, str]],
    min_slot_size: int = 15
) -> List[Tuple[int, int]]:
    """
    Calculate available time slots given work hours and blocked times
    
    Args:
        work_start: Work start time (HH:MM)
        work_end: Work end time (HH:MM)
        blocked_slots: List of (start, end) blocked time ranges
        min_slot_size: Minimum slot size in minutes
    
    Returns:
        List of (start_minutes, end_minutes) available slots
    """
    work_start_min = time_to_minutes(work_start)
    work_end_min = time_to_minutes(work_end)
    
    # Convert blocked slots to minutes
    blocked_ranges = []
    for start, end in blocked_slots:
        blocked_ranges.append((time_to_minutes(start), time_to_minutes(end)))
    
    # Sort blocked ranges
    blocked_ranges.sort()
    
    # Find available slots
    available = []
    current = work_start_min
    
    for blocked_start, blocked_end in blocked_ranges:
        if current < blocked_start:
            # There's available time before this blocked slot
            if blocked_start - current >= min_slot_size:
                available.append((current, blocked_start))
        current = max(current, blocked_end)
    
    # Add remaining time after last blocked slot
    if current < work_end_min:
        if work_end_min - current >= min_slot_size:
            available.append((current, work_end_min))
    
    return available

def calculate_buffer_time(estimated_minutes: int, buffer_percentage: int) -> int:
    """Calculate buffer time based on percentage"""
    return int(estimated_minutes * buffer_percentage / 100)

def round_to_interval(minutes: int, interval: int = 5) -> int:
    """Round minutes to nearest interval"""
    return round(minutes / interval) * interval

def format_duration(minutes: int) -> str:
    """Format duration in human-readable format"""
    if minutes < 60:
        return f"{minutes}m"
    
    hours = minutes // 60
    mins = minutes % 60
    
    if mins == 0:
        return f"{hours}h"
    
    return f"{hours}h {mins}m"

def add_minutes_to_time(time_str: str, minutes: int) -> str:
    """Add minutes to a time string"""
    time_minutes = time_to_minutes(time_str)
    new_minutes = time_minutes + minutes
    
    # Handle overflow past midnight
    if new_minutes >= 24 * 60:
        new_minutes = new_minutes % (24 * 60)
    
    return minutes_to_time(new_minutes)

def calculate_time_overlap(
    start1: str, end1: str,
    start2: str, end2: str
) -> int:
    """Calculate overlap in minutes between two time ranges"""
    start1_min = time_to_minutes(start1)
    end1_min = time_to_minutes(end1)
    start2_min = time_to_minutes(start2)
    end2_min = time_to_minutes(end2)
    
    overlap_start = max(start1_min, start2_min)
    overlap_end = min(end1_min, end2_min)
    
    if overlap_start >= overlap_end:
        return 0
    
    return overlap_end - overlap_start