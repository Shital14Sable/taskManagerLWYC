"""
Gamification Service
Handles XP calculation, level progression, and badge awards
"""
import json
from pathlib import Path
from datetime import datetime, date, timedelta
from typing import List, Optional, Tuple, Dict, Any

from taskman.server.models.gamification import (
    UserStats, Badge, BadgeType, BADGE_DEFINITIONS, BadgeAchievement,
    calculate_xp, calculate_level, xp_progress_in_level
)
from taskman.server.models.task import Task
from taskman.server.models.habit_instance import HabitInstance


# Badges that can be earned multiple times
REPEATABLE_BADGES = {
    BadgeType.PERFECT_DAY,
    BadgeType.PERFECT_WEEK,
    BadgeType.HABIT_STREAK_7,
    BadgeType.HABIT_STREAK_30,
    BadgeType.EARLY_BIRD,
    BadgeType.NIGHT_OWL,
    BadgeType.TIME_BOXER,
}


class GamificationService:
    def __init__(self, data_dir: Path, storage=None):
        self.data_dir = data_dir
        self.storage = storage  # Optional: passed for habit queries
        self.stats_path = data_dir / "user_stats.json"
        self.habit_instances_dir = data_dir / "habit_instances"
        self.stats = self._load_stats()

    def set_storage(self, storage):
        """Set storage reference for habit queries"""
        self.storage = storage

    def _load_stats(self) -> UserStats:
        """Load user stats from file"""
        if self.stats_path.exists():
            with open(self.stats_path, 'r') as f:
                data = json.load(f)
                stats = UserStats(**data)
                # Recalculate level from total_xp to fix any discrepancies
                stats.level = calculate_level(stats.total_xp)
                return stats
        return UserStats()

    def _save_stats(self):
        """Save user stats to file"""
        with open(self.stats_path, 'w') as f:
            json.dump(self.stats.dict(), f, indent=2, default=str)

    def get_stats(self) -> UserStats:
        """Get current user stats"""
        return self.stats

    def get_earned_badges(self) -> List[Badge]:
        """Get list of earned badges with details"""
        badges = []
        for badge_type_str in self.stats.earned_badges:
            try:
                badge_type = BadgeType(badge_type_str)
                badge = BADGE_DEFINITIONS.get(badge_type)
                if badge:
                    badges.append(badge)
            except ValueError:
                # Skip old badge types that no longer exist
                continue
        return badges

    def get_all_badges(self) -> List[dict]:
        """Get all badges with earned status and count"""
        badges = []
        for badge_type, badge in BADGE_DEFINITIONS.items():
            badge_dict = badge.dict()
            badge_dict["earned"] = badge_type.value in self.stats.earned_badges
            # Count how many times this badge was earned
            badge_dict["earned_count"] = sum(
                1 for h in self.stats.badge_history
                if h.get("badge_type") == badge_type.value
            )
            badges.append(badge_dict)
        return badges

    def get_badge_history(self, badge_type: Optional[str] = None) -> List[Dict]:
        """Get badge achievement history, optionally filtered by badge type"""
        history = self.stats.badge_history
        if badge_type:
            history = [h for h in history if h.get("badge_type") == badge_type]
        # Sort by earned_at descending (most recent first)
        return sorted(history, key=lambda x: x.get("earned_at", ""), reverse=True)

    def _get_habit_instances_for_date(self, target_date: date) -> List[HabitInstance]:
        """Get all habit instances completed on a specific date"""
        instances = []
        if not self.habit_instances_dir.exists():
            return instances

        date_str = target_date.isoformat()
        for instance_file in self.habit_instances_dir.glob(f"*_{date_str}.json"):
            try:
                with open(instance_file, 'r') as f:
                    data = json.load(f)
                    instances.append(HabitInstance(**data))
            except (json.JSONDecodeError, Exception):
                continue
        return instances

    def _get_habit_instances(self, habit_id: str, days_back: int = 60) -> List[HabitInstance]:
        """Get habit instances for a specific habit within the last N days"""
        instances = []
        if not self.habit_instances_dir.exists():
            return instances

        for instance_file in self.habit_instances_dir.glob(f"{habit_id}_*.json"):
            try:
                with open(instance_file, 'r') as f:
                    data = json.load(f)
                    instance = HabitInstance(**data)
                    # Filter to recent instances
                    if (date.today() - instance.date).days <= days_back:
                        instances.append(instance)
            except (json.JSONDecodeError, Exception):
                continue
        return sorted(instances, key=lambda x: x.date)

    def _calculate_habit_streak(self, habit_id: str, habit: Optional[Task] = None) -> int:
        """
        Calculate the current streak for a specific habit.
        Counts consecutive scheduled days with completions, going backwards from today.
        """
        instances = self._get_habit_instances(habit_id, days_back=60)
        if not instances:
            return 0

        completed_dates = {inst.date for inst in instances}

        # Get habit frequency info
        is_daily = True
        days_of_week = []
        if habit and habit.recurrence:
            if habit.recurrence.frequency == "weekly" and habit.recurrence.days_of_week:
                is_daily = False
                days_of_week = [d.lower() for d in habit.recurrence.days_of_week]

        streak = 0
        check_date = date.today()

        # Check today and go backwards
        for _ in range(60):  # Max 60 days back
            day_name = check_date.strftime("%A").lower()

            # Is this a scheduled day for this habit?
            is_scheduled = is_daily or (day_name in days_of_week)

            if is_scheduled:
                if check_date in completed_dates:
                    streak += 1
                else:
                    # Streak broken (missed a scheduled day)
                    # But if checking today and it's not done yet, skip it
                    if check_date == date.today():
                        check_date -= timedelta(days=1)
                        continue
                    break

            check_date -= timedelta(days=1)

        return streak

    def _check_perfect_day(self, target_date: date) -> bool:
        """
        Check if all scheduled habits were completed on a given date.
        Returns True if it was a perfect day, False otherwise.
        """
        if not self.storage:
            return False

        # Get all active habits
        habits = [t for t in self.storage.get_all_tasks() if t.is_habit and not t.is_paused]
        if not habits:
            return False  # No habits = not a perfect day (nothing to complete)

        # Get habits scheduled for this date
        day_name = target_date.strftime("%A").lower()
        scheduled_habits = []

        for habit in habits:
            if not habit.recurrence or not habit.recurrence.frequency:
                continue

            is_scheduled = False
            if habit.recurrence.frequency == "daily":
                is_scheduled = True
            elif habit.recurrence.frequency == "weekly":
                if day_name in [d.lower() for d in habit.recurrence.days_of_week]:
                    is_scheduled = True

            if is_scheduled:
                scheduled_habits.append(habit)

        if not scheduled_habits:
            return False  # No habits scheduled = not applicable

        # Check if all scheduled habits have instances for this date
        completed_instances = self._get_habit_instances_for_date(target_date)
        completed_habit_ids = {inst.habit_id for inst in completed_instances}

        for habit in scheduled_habits:
            if habit.id not in completed_habit_ids:
                return False  # At least one scheduled habit not completed

        return True

    def _get_scheduled_habits_for_date(self, target_date: date) -> List[Task]:
        """Get list of habits scheduled for a given date"""
        if not self.storage:
            return []

        habits = [t for t in self.storage.get_all_tasks() if t.is_habit and not t.is_paused]
        day_name = target_date.strftime("%A").lower()
        scheduled = []

        for habit in habits:
            if not habit.recurrence or not habit.recurrence.frequency:
                continue

            is_scheduled = False
            if habit.recurrence.frequency == "daily":
                is_scheduled = True
            elif habit.recurrence.frequency == "weekly":
                if day_name in [d.lower() for d in habit.recurrence.days_of_week]:
                    is_scheduled = True

            if is_scheduled:
                scheduled.append(habit)

        return scheduled

    def _update_perfect_day_streak(self):
        """Update perfect day streak based on recent history"""
        if not self.storage:
            return

        today = date.today()
        streak = 0

        # Check backwards from yesterday (today might not be complete yet)
        check_date = today - timedelta(days=1)

        for _ in range(30):  # Max 30 days back
            if self._check_perfect_day(check_date):
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break

        # Also check if today is perfect (bonus)
        if self._check_perfect_day(today):
            streak += 1
            self.stats.last_perfect_day = today.isoformat()

        self.stats.perfect_day_streak = streak
        if streak > self.stats.best_perfect_day_streak:
            self.stats.best_perfect_day_streak = streak

    def award_xp(self, task: Task) -> Tuple[int, int, List[Badge]]:
        """
        Award XP for completing a task.
        Returns (xp_earned, new_level, new_badges)
        """
        old_level = self.stats.level

        # Calculate XP
        xp_earned = calculate_xp(
            difficulty=task.difficulty,
            estimated_minutes=task.estimated_minutes,
            is_habit=task.is_habit
        )

        # Update stats
        self.stats.total_xp += xp_earned
        self.stats.level = calculate_level(self.stats.total_xp)

        if task.is_habit:
            self.stats.habits_completed += 1
        else:
            self.stats.tasks_completed += 1

        # Update activity streak
        today = date.today().isoformat()
        if self.stats.last_completion_date:
            last_date = date.fromisoformat(self.stats.last_completion_date)
            days_diff = (date.today() - last_date).days

            if days_diff == 0:
                pass  # Same day, streak continues
            elif days_diff == 1:
                self.stats.current_streak += 1
            else:
                self.stats.current_streak = 1
        else:
            self.stats.current_streak = 1

        self.stats.last_completion_date = today

        if self.stats.current_streak > self.stats.longest_streak:
            self.stats.longest_streak = self.stats.current_streak

        # Update habit-specific stats
        habit_streak = 0
        if task.is_habit:
            # Calculate this habit's streak
            habit_streak = self._calculate_habit_streak(task.id, task)
            if habit_streak > self.stats.best_habit_streak:
                self.stats.best_habit_streak = habit_streak

            # Update perfect day streak
            self._update_perfect_day_streak()

        # Check for new badges
        new_badges = self._check_badges(task, old_level, habit_streak)

        # Save stats
        self._save_stats()

        return xp_earned, self.stats.level, new_badges

    def _check_badges(self, task: Task, old_level: int, habit_streak: int = 0) -> List[Badge]:
        """Check and award any new badges"""
        new_badges = []

        # === TASK BADGES (tasks only, not habits) ===
        if not task.is_habit and self.stats.tasks_completed == 1:
            new_badges.extend(self._award_badge(
                BadgeType.FIRST_TASK,
                trigger_type="task",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"tasks_completed": 1}
            ))

        if self.stats.tasks_completed >= 100:
            new_badges.extend(self._award_badge(
                BadgeType.CENTURION,
                trigger_type="milestone",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"tasks_completed": self.stats.tasks_completed}
            ))

        if self.stats.tasks_completed >= 500:
            new_badges.extend(self._award_badge(
                BadgeType.TASK_MASTER,
                trigger_type="milestone",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"tasks_completed": self.stats.tasks_completed}
            ))

        # === ACTIVITY STREAK BADGES (any task or habit) ===
        if self.stats.current_streak >= 3:
            new_badges.extend(self._award_badge(
                BadgeType.ACTIVITY_STREAK_3,
                trigger_type="streak",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"streak_days": self.stats.current_streak}
            ))

        if self.stats.current_streak >= 7:
            new_badges.extend(self._award_badge(
                BadgeType.ACTIVITY_STREAK_7,
                trigger_type="streak",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"streak_days": self.stats.current_streak}
            ))

        if self.stats.current_streak >= 30:
            new_badges.extend(self._award_badge(
                BadgeType.ACTIVITY_STREAK_30,
                trigger_type="streak",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"streak_days": self.stats.current_streak}
            ))

        # === HABIT BADGES ===
        if task.is_habit:
            # First habit
            if self.stats.habits_completed == 1:
                new_badges.extend(self._award_badge(
                    BadgeType.HABIT_STARTER,
                    trigger_type="habit",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={"habits_completed": 1}
                ))

            # Habit completion milestones
            if self.stats.habits_completed >= 25:
                new_badges.extend(self._award_badge(
                    BadgeType.HABIT_REGULAR,
                    trigger_type="milestone",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={"habits_completed": self.stats.habits_completed}
                ))

            if self.stats.habits_completed >= 100:
                new_badges.extend(self._award_badge(
                    BadgeType.HABIT_DEDICATED,
                    trigger_type="milestone",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={"habits_completed": self.stats.habits_completed}
                ))

            # Per-habit streak badges (repeatable for different habits)
            if habit_streak >= 7:
                new_badges.extend(self._award_badge(
                    BadgeType.HABIT_STREAK_7,
                    trigger_type="habit_streak",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={"streak_days": habit_streak, "habit_id": task.id}
                ))

            if habit_streak >= 30:
                new_badges.extend(self._award_badge(
                    BadgeType.HABIT_STREAK_30,
                    trigger_type="habit_streak",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={"streak_days": habit_streak, "habit_id": task.id}
                ))

            # Perfect day badges (repeatable)
            if self._check_perfect_day(date.today()):
                scheduled = self._get_scheduled_habits_for_date(date.today())
                new_badges.extend(self._award_badge(
                    BadgeType.PERFECT_DAY,
                    trigger_type="perfect_day",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={
                        "date": date.today().isoformat(),
                        "habits_completed": len(scheduled),
                        "habit_names": [h.title for h in scheduled]
                    }
                ))

            if self.stats.perfect_day_streak >= 7:
                new_badges.extend(self._award_badge(
                    BadgeType.PERFECT_WEEK,
                    trigger_type="perfect_week",
                    trigger_id=task.id,
                    trigger_name=task.title,
                    context={"perfect_day_streak": self.stats.perfect_day_streak}
                ))

        # === TIME MANAGEMENT BADGES (repeatable) ===
        now = datetime.now()
        if now.hour < 9:
            new_badges.extend(self._award_badge(
                BadgeType.EARLY_BIRD,
                trigger_type="time",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"time": now.strftime("%H:%M"), "is_habit": task.is_habit}
            ))

        if now.hour >= 21:
            new_badges.extend(self._award_badge(
                BadgeType.NIGHT_OWL,
                trigger_type="time",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"time": now.strftime("%H:%M"), "is_habit": task.is_habit}
            ))

        if task.actual_minutes and task.actual_minutes <= task.estimated_minutes:
            new_badges.extend(self._award_badge(
                BadgeType.TIME_BOXER,
                trigger_type="time",
                trigger_id=task.id,
                trigger_name=task.title,
                context={
                    "estimated_minutes": task.estimated_minutes,
                    "actual_minutes": task.actual_minutes
                }
            ))

        # === LEVEL BADGES ===
        if self.stats.level >= 5 and old_level < 5:
            new_badges.extend(self._award_badge(
                BadgeType.LEVEL_5,
                trigger_type="level",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"level": 5, "total_xp": self.stats.total_xp}
            ))

        if self.stats.level >= 10 and old_level < 10:
            new_badges.extend(self._award_badge(
                BadgeType.LEVEL_10,
                trigger_type="level",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"level": 10, "total_xp": self.stats.total_xp}
            ))

        if self.stats.level >= 25 and old_level < 25:
            new_badges.extend(self._award_badge(
                BadgeType.LEVEL_25,
                trigger_type="level",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"level": 25, "total_xp": self.stats.total_xp}
            ))

        if self.stats.level >= 50 and old_level < 50:
            new_badges.extend(self._award_badge(
                BadgeType.LEVEL_50,
                trigger_type="level",
                trigger_id=task.id,
                trigger_name=task.title,
                context={"level": 50, "total_xp": self.stats.total_xp}
            ))

        return new_badges

    def _award_badge(
        self,
        badge_type: BadgeType,
        trigger_type: str,
        trigger_id: Optional[str] = None,
        trigger_name: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> List[Badge]:
        """
        Award a badge and record it in history.

        For repeatable badges: always record in history, only add to earned_badges once
        For one-time badges: only award if not already earned
        """
        is_repeatable = badge_type in REPEATABLE_BADGES
        already_earned = badge_type.value in self.stats.earned_badges

        # For non-repeatable badges, skip if already earned
        if not is_repeatable and already_earned:
            return []

        # For repeatable badges, check if we already recorded this specific achievement today
        # (to avoid duplicate entries for the same completion)
        if is_repeatable:
            today = date.today().isoformat()
            recent_same_badge = [
                h for h in self.stats.badge_history
                if h.get("badge_type") == badge_type.value
                and h.get("earned_at", "").startswith(today)
                and h.get("trigger_id") == trigger_id
            ]
            if recent_same_badge:
                return []  # Already recorded this specific achievement today

        # Record in badge history
        achievement = {
            "badge_type": badge_type.value,
            "earned_at": datetime.now().isoformat(),
            "trigger_type": trigger_type,
            "trigger_id": trigger_id,
            "trigger_name": trigger_name,
            "context": context or {}
        }
        self.stats.badge_history.append(achievement)

        # Add to earned_badges if not already there
        if not already_earned:
            self.stats.earned_badges.append(badge_type.value)

        # Return badge for notification
        badge = BADGE_DEFINITIONS.get(badge_type)
        if badge:
            badge_with_date = badge.copy()
            badge_with_date.earned_at = datetime.now()
            return [badge_with_date]
        return []

    def get_level_progress(self) -> dict:
        """Get detailed level progress info"""
        current_xp, xp_needed = xp_progress_in_level(self.stats.total_xp)
        return {
            "level": self.stats.level,
            "current_xp": current_xp,
            "xp_needed": xp_needed,
            "progress_percent": int((current_xp / xp_needed) * 100) if xp_needed > 0 else 100,
            "total_xp": self.stats.total_xp
        }

    def get_badge_summary(self) -> List[Dict]:
        """Get summary of all badges with earned count and history"""
        summaries = []
        for badge_type, badge in BADGE_DEFINITIONS.items():
            history = [
                h for h in self.stats.badge_history
                if h.get("badge_type") == badge_type.value
            ]
            history.sort(key=lambda x: x.get("earned_at", ""), reverse=True)

            summaries.append({
                "badge": badge.dict(),
                "earned": badge_type.value in self.stats.earned_badges,
                "earned_count": len(history),
                "is_repeatable": badge_type in REPEATABLE_BADGES,
                "first_earned": history[-1] if history else None,
                "last_earned": history[0] if history else None,
                "history": history
            })

        return summaries
