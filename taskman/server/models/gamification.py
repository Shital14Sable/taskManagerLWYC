"""
Gamification models - XP, Levels, and Badges
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class BadgeType(str, Enum):
    # Task completion badges (tasks only, not habits)
    FIRST_TASK = "first_task"
    CENTURION = "centurion"  # 100 tasks
    TASK_MASTER = "task_master"  # 500 tasks

    # Activity streak badges (any task OR habit counts)
    ACTIVITY_STREAK_3 = "activity_streak_3"
    ACTIVITY_STREAK_7 = "activity_streak_7"
    ACTIVITY_STREAK_30 = "activity_streak_30"

    # Habit completion badges
    HABIT_STARTER = "habit_starter"  # First habit completed
    HABIT_REGULAR = "habit_regular"  # 25 habit completions
    HABIT_DEDICATED = "habit_dedicated"  # 100 habit completions

    # Per-habit streak badges (single habit consecutive completions)
    HABIT_STREAK_7 = "habit_streak_7"  # Any habit 7 days in a row
    HABIT_STREAK_30 = "habit_streak_30"  # Any habit 30 days in a row

    # Perfect day badges (all scheduled habits completed)
    PERFECT_DAY = "perfect_day"  # Complete all habits in a day
    PERFECT_WEEK = "perfect_week"  # 7 consecutive perfect days

    # Time management badges
    EARLY_BIRD = "early_bird"  # Complete task before 9am
    NIGHT_OWL = "night_owl"  # Complete task after 9pm
    TIME_BOXER = "time_boxer"  # Complete task within estimate

    # Level badges
    LEVEL_5 = "level_5"
    LEVEL_10 = "level_10"
    LEVEL_25 = "level_25"
    LEVEL_50 = "level_50"


class Badge(BaseModel):
    type: BadgeType
    name: str
    description: str
    icon: str  # Emoji or icon name
    earned_at: Optional[datetime] = None


class BadgeAchievement(BaseModel):
    """Records each time a badge is earned with context"""
    badge_type: str  # BadgeType value
    earned_at: datetime
    trigger_type: str  # "task", "habit", "streak", "level", "perfect_day"
    trigger_id: Optional[str] = None  # Task/habit ID if applicable
    trigger_name: Optional[str] = None  # Task/habit title
    context: Optional[Dict] = None  # Additional context (streak length, level reached, etc.)


# Badge definitions
BADGE_DEFINITIONS = {
    # Task badges
    BadgeType.FIRST_TASK: Badge(
        type=BadgeType.FIRST_TASK,
        name="First Steps",
        description="Complete your first task",
        icon="star"
    ),
    BadgeType.CENTURION: Badge(
        type=BadgeType.CENTURION,
        name="Centurion",
        description="Complete 100 tasks",
        icon="shield"
    ),
    BadgeType.TASK_MASTER: Badge(
        type=BadgeType.TASK_MASTER,
        name="Task Master",
        description="Complete 500 tasks",
        icon="award"
    ),

    # Activity streak badges
    BadgeType.ACTIVITY_STREAK_3: Badge(
        type=BadgeType.ACTIVITY_STREAK_3,
        name="On a Roll",
        description="Be active 3 days in a row",
        icon="fire"
    ),
    BadgeType.ACTIVITY_STREAK_7: Badge(
        type=BadgeType.ACTIVITY_STREAK_7,
        name="Week Warrior",
        description="Be active 7 days in a row",
        icon="zap"
    ),
    BadgeType.ACTIVITY_STREAK_30: Badge(
        type=BadgeType.ACTIVITY_STREAK_30,
        name="Monthly Master",
        description="Be active 30 days in a row",
        icon="crown"
    ),

    # Habit completion badges
    BadgeType.HABIT_STARTER: Badge(
        type=BadgeType.HABIT_STARTER,
        name="Habit Builder",
        description="Complete your first habit",
        icon="repeat"
    ),
    BadgeType.HABIT_REGULAR: Badge(
        type=BadgeType.HABIT_REGULAR,
        name="Habit Regular",
        description="Complete 25 habit instances",
        icon="check-circle"
    ),
    BadgeType.HABIT_DEDICATED: Badge(
        type=BadgeType.HABIT_DEDICATED,
        name="Habit Dedicated",
        description="Complete 100 habit instances",
        icon="heart"
    ),

    # Per-habit streak badges
    BadgeType.HABIT_STREAK_7: Badge(
        type=BadgeType.HABIT_STREAK_7,
        name="Creature of Habit",
        description="Complete any habit 7 scheduled days in a row",
        icon="calendar"
    ),
    BadgeType.HABIT_STREAK_30: Badge(
        type=BadgeType.HABIT_STREAK_30,
        name="Habit Champion",
        description="Complete any habit 30 scheduled days in a row",
        icon="trophy"
    ),

    # Perfect day badges
    BadgeType.PERFECT_DAY: Badge(
        type=BadgeType.PERFECT_DAY,
        name="Perfect Day",
        description="Complete all scheduled habits in a day",
        icon="sun"
    ),
    BadgeType.PERFECT_WEEK: Badge(
        type=BadgeType.PERFECT_WEEK,
        name="Perfect Week",
        description="Have 7 consecutive perfect days",
        icon="calendar-check"
    ),

    # Time management badges
    BadgeType.EARLY_BIRD: Badge(
        type=BadgeType.EARLY_BIRD,
        name="Early Bird",
        description="Complete a task before 9 AM",
        icon="sunrise"
    ),
    BadgeType.NIGHT_OWL: Badge(
        type=BadgeType.NIGHT_OWL,
        name="Night Owl",
        description="Complete a task after 9 PM",
        icon="moon"
    ),
    BadgeType.TIME_BOXER: Badge(
        type=BadgeType.TIME_BOXER,
        name="Time Boxer",
        description="Complete a task within its estimated time",
        icon="clock"
    ),

    # Level badges
    BadgeType.LEVEL_5: Badge(
        type=BadgeType.LEVEL_5,
        name="Rising Star",
        description="Reach level 5",
        icon="trending-up"
    ),
    BadgeType.LEVEL_10: Badge(
        type=BadgeType.LEVEL_10,
        name="Achiever",
        description="Reach level 10",
        icon="target"
    ),
    BadgeType.LEVEL_25: Badge(
        type=BadgeType.LEVEL_25,
        name="Expert",
        description="Reach level 25",
        icon="medal"
    ),
    BadgeType.LEVEL_50: Badge(
        type=BadgeType.LEVEL_50,
        name="Legendary",
        description="Reach level 50",
        icon="gem"
    ),
}


class UserStats(BaseModel):
    """User gamification statistics"""
    total_xp: int = 0
    level: int = 1
    tasks_completed: int = 0
    habits_completed: int = 0
    current_streak: int = 0  # Activity streak (any task or habit)
    longest_streak: int = 0
    perfect_day_streak: int = 0  # Consecutive days with all habits done
    best_perfect_day_streak: int = 0
    best_habit_streak: int = 0  # Best streak on any single habit
    last_completion_date: Optional[str] = None
    last_perfect_day: Optional[str] = None
    earned_badges: List[str] = Field(default_factory=list)  # List of BadgeType values
    # Full history of badge achievements with context
    badge_history: List[Dict] = Field(default_factory=list)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


def calculate_xp(difficulty: int, estimated_minutes: int, is_habit: bool = False) -> int:
    """
    Calculate XP for completing a task.
    Formula: base(1) x difficulty(1-5) x time_factor

    Time factor scales with duration:
    - Linear scaling: minutes / 30 (so 1h = 2, 2h = 4, 3h = 6)
    - Capped at 10 (5 hours max contribution)
    - Minimum 0.5 for very short tasks

    Habits get a 1.5x multiplier
    Minimum 1 XP for any completion

    Examples (difficulty 3):
    - 30 min task: 1 × 3 × 1.0 = 3 XP
    - 1h task:     1 × 3 × 2.0 = 6 XP
    - 2h task:     1 × 3 × 4.0 = 12 XP
    - 3h task:     1 × 3 × 6.0 = 18 XP
    - 4h task:     1 × 3 × 8.0 = 24 XP
    """
    base_xp = 1
    difficulty_factor = max(1, min(5, difficulty))  # Clamp to 1-5
    time_factor = min(10, estimated_minutes / 30)  # Cap at 10 (5 hours)
    time_factor = max(0.5, time_factor)  # Minimum 0.5 (15 min tasks)

    xp = int(base_xp * difficulty_factor * time_factor)

    if is_habit:
        xp = int(xp * 1.5)

    # Ensure minimum 1 XP for any completion
    return max(1, xp)


def calculate_level(total_xp: int) -> int:
    """
    Calculate level from total XP.
    Uses a simple quadratic formula: XP needed for level n = 10 * n^1.5
    """
    level = 1
    xp_for_next_level = 10
    remaining_xp = total_xp

    while remaining_xp >= xp_for_next_level:
        remaining_xp -= xp_for_next_level
        level += 1
        xp_for_next_level = int(10 * (level ** 1.5))

    return level


def xp_for_next_level(current_level: int) -> int:
    """Get XP required to reach the next level"""
    return int(10 * ((current_level + 1) ** 1.5))


def xp_progress_in_level(total_xp: int) -> tuple[int, int]:
    """
    Get current XP progress within current level.
    Returns (current_xp_in_level, xp_needed_for_level)
    """
    level = 1
    xp_for_next = 10
    remaining_xp = total_xp

    while remaining_xp >= xp_for_next:
        remaining_xp -= xp_for_next
        level += 1
        xp_for_next = int(10 * (level ** 1.5))

    return remaining_xp, xp_for_next
