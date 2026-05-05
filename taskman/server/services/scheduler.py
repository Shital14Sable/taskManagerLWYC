"""
Smart Scheduler - FIXED VERSION
- Respects current time (doesn't schedule in the past)
- Properly blocks habit times
- Handles dependencies
- Inserts breaks
- Per-day work hours and energy patterns
"""
from datetime import date, datetime, timedelta
from typing import List, Tuple, Optional, Dict
import logging

from taskman.server.models.schedule import (
    Schedule, ScheduledTask, ScheduleConstraints, ScheduleSummary, TimeSlot
)
from taskman.server.models.task import Task
from taskman.server.models.user_preferences import UserPreferences
from taskman.server.services.storage import StorageManager
from taskman.server.utils.time_utils import (
    time_to_minutes, minutes_to_time, get_available_slots
)
from taskman.server.utils.dependency_resolver import DependencyResolver
from taskman.shared.constants import ProjectStatus, TaskStatus

logger = logging.getLogger(__name__)


class Scheduler:
    def __init__(self, storage: StorageManager):
        self.storage = storage
        self.dep_resolver = DependencyResolver()

    def _get_day_name(self, target_date: date) -> str:
        """Get lowercase day name for a date."""
        return target_date.strftime("%A").lower()

    def _get_work_hours_for_date(self, target_date: date, preferences: UserPreferences) -> Tuple[str, str]:
        """Get work start and end times for a specific date."""
        day_name = self._get_day_name(target_date)
        day_hours = preferences.get_work_hours_for_day(day_name)
        return day_hours.start, day_hours.end

    def _get_energy_level_at_time(self, target_date: date, time_minutes: int,
                                   preferences: UserPreferences) -> Optional[str]:
        """Get the energy level for a specific date and time."""
        day_name = self._get_day_name(target_date)
        time_str = minutes_to_time(time_minutes)
        return preferences.get_energy_level_at_time(day_name, time_str)

    def generate_schedule(self, target_date: date, preferences: UserPreferences,
                         force: bool = False) -> Schedule:
        """
        Generate schedule for a specific date

        FIXES:
        - Starts from current time if scheduling today
        - Properly blocks habit times
        - Inserts breaks every max_deep_work_stretch minutes
        - Uses per-day work hours
        """
        # Check if schedule already exists
        existing = self.storage.get_schedule(target_date)
        if existing and not force:
            return existing

        # Get all incomplete tasks
        all_tasks = self.storage.list_tasks(status="todo")
        all_tasks += self.storage.list_tasks(status="in_progress")

        # Auto-fix habits stuck in "completed" status
        # Habits should never stay completed - they reset to "todo" after each completion
        # EXCEPTION: Habits that have passed their end_date can stay completed (they're done forever)
        completed_tasks_all = self.storage.list_tasks(status="completed")
        stuck_habits = []
        for t in completed_tasks_all:
            if t.is_habit:
                # Check if habit has passed its end_date - if so, it's legitimately done
                if t.recurrence and t.recurrence.end_date and date.today() > t.recurrence.end_date:
                    logger.info(f"Habit '{t.title}' is past its end_date ({t.recurrence.end_date}), leaving as completed")
                    continue
                stuck_habits.append(t)

        if stuck_habits:
            for habit in stuck_habits:
                logger.warning(f"Auto-fixing stuck habit '{habit.title}' - resetting status from 'completed' to 'todo'")
                habit.status = TaskStatus.TODO
                habit.completed_at = None
                self.storage.save_task(habit)
            all_tasks += stuck_habits

        # Separate habits from regular tasks
        # Filter out paused habits (unless paused_until date has passed)
        habits = [t for t in all_tasks if t.is_habit and not self._is_habit_paused(t, target_date)]
        # Filter out tasks from paused/completed/archived projects AND paused tasks
        regular_tasks = [
            t for t in all_tasks
            if not t.is_habit
            and not self._is_task_in_paused_project(t)
            and not self._is_task_paused(t, target_date)
        ]

        # FIX: Exclude regular tasks already scheduled on OTHER days to prevent duplicates
        # Check existing schedules within a reasonable window (30 days before and after)
        already_scheduled_ids = self._get_tasks_scheduled_on_other_days(target_date, days_window=30)
        if already_scheduled_ids:
            original_count = len(regular_tasks)
            regular_tasks = [t for t in regular_tasks if t.id not in already_scheduled_ids]
            excluded_count = original_count - len(regular_tasks)
            if excluded_count > 0:
                logger.info(f"Excluded {excluded_count} tasks already scheduled on other days")

        # Build task map for dependency resolution (includes all tasks + completed for lookups)
        all_tasks_map = {t.id: t for t in all_tasks}
        # Also add completed tasks to the map for dependency checking
        completed_tasks = self.storage.list_tasks(status="completed")
        for ct in completed_tasks:
            all_tasks_map[ct.id] = ct

        # Determine work window for this specific day
        work_start, work_end = self._get_work_hours_for_date(target_date, preferences)

        # FIX 1: If scheduling today and current time is after work start,
        # start from current time rounded to next 15-min interval
        if target_date == date.today():
            now = datetime.now()
            current_minutes = now.hour * 60 + now.minute
            work_start_minutes = time_to_minutes(work_start)

            if current_minutes > work_start_minutes:
                # Round up to next 15-minute interval
                rounded_minutes = ((current_minutes + 14) // 15) * 15
                work_start = minutes_to_time(rounded_minutes)
                logger.info(f"Today's schedule starts at current time: {work_start}")

        target_date_str = target_date.isoformat()

        # FIX 2: Build blocked slots from habits and hard-pinned tasks that occur on this day
        blocked_slots = []
        habit_scheduled_tasks = []
        pinned_scheduled_tasks = []  # Hard-pinned tasks (meetings, appointments)
        hard_pinned_task_ids = set()  # Track IDs to exclude from flexible scheduling

        # Get current time in minutes for comparison (only relevant for today)
        current_time_minutes = None
        if target_date == date.today():
            now = datetime.now()
            current_time_minutes = now.hour * 60 + now.minute

        # Collect hard-pinned tasks scheduled for this date
        pinned_candidates = []
        for task in regular_tasks:
            if task.is_pinned and task.pin_type == 'hard' and task.scheduled_for:
                # Check if scheduled_for date matches target date
                # scheduled_for format: "2025-01-15T10:00:00" or datetime object
                scheduled_for_str = task.scheduled_for
                if isinstance(task.scheduled_for, datetime):
                    scheduled_for_str = task.scheduled_for.isoformat()

                scheduled_date = scheduled_for_str.split('T')[0]
                if scheduled_date == target_date_str:
                    # Extract time from scheduled_for
                    time_part = scheduled_for_str.split('T')[1] if 'T' in scheduled_for_str else None
                    if time_part:
                        start_time = time_part[:5]  # "HH:MM"
                        start_minutes = time_to_minutes(start_time)
                        duration = task.estimated_minutes
                        end_minutes = start_minutes + duration
                        end_time = minutes_to_time(end_minutes)

                        pinned_candidates.append({
                            'task': task,
                            'start_time': start_time,
                            'end_time': end_time,
                            'start_minutes': start_minutes,
                            'end_minutes': end_minutes,
                            'duration': duration
                        })
                        hard_pinned_task_ids.add(task.id)

        logger.info(f"Hard-pinned tasks for {target_date}: {len(pinned_candidates)} "
                   f"[{', '.join(pc['task'].title for pc in pinned_candidates)}]")

        # First, collect all habit time slots for overlap detection
        # Also track habits without time_of_day - they'll be scheduled like regular tasks
        habit_candidates = []
        flexible_habits = []  # Habits without specific time_of_day
        for habit in habits:
            if self._habit_occurs_on_date(habit, target_date):
                habit_time = self._get_habit_time(habit, target_date)
                if habit_time:
                    start_time, duration = habit_time
                    start_minutes = time_to_minutes(start_time)
                    end_minutes = start_minutes + duration
                    end_time = minutes_to_time(end_minutes)

                    # NOTE: We do NOT skip past habits - they should always show for the day
                    # so users can mark them complete even if the scheduled time has passed

                    habit_candidates.append({
                        'habit': habit,
                        'start_time': start_time,
                        'end_time': end_time,
                        'start_minutes': start_minutes,
                        'end_minutes': end_minutes,
                        'duration': duration
                    })
                else:
                    # Habit without time_of_day - schedule flexibly
                    flexible_habits.append(habit)
                    logger.info(f"Habit '{habit.title}' has no time_of_day, will schedule flexibly")

        # Sort by start time, then by priority (lower priority number = higher priority)
        habit_candidates.sort(key=lambda x: (x['start_minutes'], x['habit'].priority))

        # Detect and resolve overlaps - keep track of scheduled time ranges
        scheduled_ranges = []  # List of (start_min, end_min, title) - includes habits AND pinned tasks

        for hc in habit_candidates:
            has_overlap = False
            conflicting_item = None
            for scheduled_start, scheduled_end, scheduled_title in scheduled_ranges:
                if hc['start_minutes'] < scheduled_end and hc['end_minutes'] > scheduled_start:
                    has_overlap = True
                    conflicting_item = scheduled_title
                    break

            if has_overlap:
                logger.warning(f"Habit '{hc['habit'].title}' ({hc['start_time']}-{hc['end_time']}) "
                             f"overlaps with '{conflicting_item}', skipping")
                continue

            blocked_slots.append((hc['start_time'], hc['end_time']))
            habit_scheduled_tasks.append(ScheduledTask(
                task_id=hc['habit'].id,
                start_time=hc['start_time'],
                end_time=hc['end_time'],
                estimated_minutes=hc['duration'],
                is_buffer=False,
                auto_scheduled=True
            ))
            scheduled_ranges.append((hc['start_minutes'], hc['end_minutes'], hc['habit'].title))
            logger.info(f"Blocked habit '{hc['habit'].title}' at {hc['start_time']}-{hc['end_time']}")

        # Sort hard-pinned tasks by start time
        pinned_candidates.sort(key=lambda x: x['start_minutes'])

        # Add hard-pinned tasks to blocked slots (they take priority, similar to habits)
        for pc in pinned_candidates:
            # Check for overlap with already scheduled ranges (habits and other pinned tasks)
            has_overlap = False
            conflicting_item = None
            for scheduled_start, scheduled_end, scheduled_title in scheduled_ranges:
                if pc['start_minutes'] < scheduled_end and pc['end_minutes'] > scheduled_start:
                    has_overlap = True
                    conflicting_item = scheduled_title
                    break

            if has_overlap:
                logger.warning(f"Hard-pinned task '{pc['task'].title}' ({pc['start_time']}-{pc['end_time']}) "
                             f"overlaps with '{conflicting_item}', skipping")
                continue

            # No overlap, schedule this pinned task
            blocked_slots.append((pc['start_time'], pc['end_time']))
            pinned_scheduled_tasks.append(ScheduledTask(
                task_id=pc['task'].id,
                start_time=pc['start_time'],
                end_time=pc['end_time'],
                estimated_minutes=pc['duration'],
                is_buffer=False,
                auto_scheduled=False  # Not auto-scheduled, user pinned it
            ))
            scheduled_ranges.append((pc['start_minutes'], pc['end_minutes'], pc['task'].title))
            logger.info(f"Blocked hard-pinned task '{pc['task'].title}' at {pc['start_time']}-{pc['end_time']}")

        # Get available slots after blocking habits and hard-pinned tasks
        available_slots = get_available_slots(
            work_start,
            work_end,
            blocked_slots,
            min_slot_size=preferences.task_defaults.min_duration
        )

        logger.info(f"Available slots after blocking habits and pinned tasks: {len(available_slots)} slots")
        for slot in available_slots:
            logger.info(f"  {minutes_to_time(slot[0])} - {minutes_to_time(slot[1])} "
                       f"({slot[1] - slot[0]} minutes)")

        # Schedule flexible habits first (they're recurring so higher priority)
        # Then schedule regular tasks in remaining slots (excluding hard-pinned tasks)
        flexible_regular_tasks = [t for t in regular_tasks if t.id not in hard_pinned_task_ids]
        tasks_to_schedule = flexible_habits + flexible_regular_tasks
        scheduled_tasks = self._schedule_tasks_in_slots(
            tasks_to_schedule, available_slots, target_date, preferences, all_tasks_map
        )

        # Combine habit, hard-pinned, and regular task schedules, then sort by time
        all_scheduled = habit_scheduled_tasks + pinned_scheduled_tasks + scheduled_tasks
        all_scheduled.sort(key=lambda t: time_to_minutes(t.start_time))

        # Calculate summary
        total_minutes = sum(t.estimated_minutes for t in all_scheduled if not t.is_buffer)

        summary = ScheduleSummary(
            total_scheduled_minutes=total_minutes,
            tasks_remaining=len([t for t in all_scheduled if not t.is_buffer])
        )

        # Create schedule
        constraints = ScheduleConstraints(
            work_start=work_start,
            work_end=work_end,
            blocked_slots=[TimeSlot(start=s, end=e, label="Habit")
                          for s, e in blocked_slots]
        )

        schedule = Schedule(
            date=target_date,
            constraints=constraints,
            scheduled_tasks=all_scheduled,
            summary=summary,
            generated_at=datetime.now()
        )

        self.storage.save_schedule(schedule)
        logger.info(f"Generated schedule for {target_date}: "
                   f"{len(all_scheduled)} tasks ({len(habit_scheduled_tasks)} habits, "
                   f"{len(pinned_scheduled_tasks)} pinned, {len(scheduled_tasks)} work tasks)")

        return schedule

    def _schedule_tasks_in_slots(
        self,
        tasks: List[Task],
        available_slots: List[Tuple[int, int]],
        target_date: date,
        preferences: UserPreferences,
        all_tasks_map: Optional[Dict[str, Task]] = None,
        previously_scheduled_ids: Optional[set] = None
    ) -> List[ScheduledTask]:
        """
        Schedule tasks into available slots with energy-aware scoring.
        Energy is a soft preference - tasks always get scheduled, but
        energy-matching tasks are preferred for each time slot.

        Args:
            all_tasks_map: Optional map of all tasks for dependency resolution.
                           If provided, paused tasks will be bypassed in dependency chains.
            previously_scheduled_ids: Task IDs scheduled on previous days (for multi-day scheduling).
        """
        scheduled_tasks = []
        scheduled_task_ids = set()
        max_deep_work = preferences.scheduling_preferences.max_deep_work_stretch
        energy_bonus = preferences.scheduling_preferences.energy_match_bonus

        for slot_start, slot_end in available_slots:
            current_time = slot_start
            continuous_work = 0

            while current_time < slot_end:
                # Score tasks for THIS specific time slot (energy-aware)
                available_tasks = [t for t in tasks if t.id not in scheduled_task_ids]
                if not available_tasks:
                    break

                scored_tasks = self._score_tasks_for_time(
                    available_tasks, target_date, current_time, preferences, energy_bonus
                )

                # Try to schedule the best task that fits
                task_scheduled = False
                for task, score in scored_tasks:
                    task_duration = task.estimated_minutes
                    remaining = slot_end - current_time

                    if task_duration > remaining:
                        continue  # Doesn't fit

                    # Check if we need a break before this task
                    if continuous_work > 0 and continuous_work + task_duration > max_deep_work:
                        break_duration = 15
                        if current_time + break_duration <= slot_end:
                            scheduled_tasks.append(ScheduledTask(
                                task_id="",
                                start_time=minutes_to_time(current_time),
                                end_time=minutes_to_time(current_time + break_duration),
                                estimated_minutes=break_duration,
                                is_buffer=True,
                                auto_scheduled=True
                            ))
                            current_time += break_duration
                            continuous_work = 0
                            remaining = slot_end - current_time

                            if task_duration > remaining:
                                continue  # No longer fits after break

                    # Check dependencies (using effective deps that bypass paused tasks)
                    # Also check against previously scheduled tasks for multi-day scheduling
                    if not self._dependencies_met(task, scheduled_tasks, target_date, all_tasks_map, previously_scheduled_ids):
                        continue

                    # Schedule the task
                    task_end = current_time + task_duration
                    scheduled_tasks.append(ScheduledTask(
                        task_id=task.id,
                        start_time=minutes_to_time(current_time),
                        end_time=minutes_to_time(task_end),
                        estimated_minutes=task_duration,
                        is_buffer=False,
                        auto_scheduled=True
                    ))
                    scheduled_task_ids.add(task.id)

                    current_time = task_end
                    continuous_work += task_duration
                    task_scheduled = True

                    # If we've worked max_deep_work, force a break
                    if continuous_work >= max_deep_work:
                        break_duration = 15
                        if current_time + break_duration <= slot_end:
                            scheduled_tasks.append(ScheduledTask(
                                task_id="",
                                start_time=minutes_to_time(current_time),
                                end_time=minutes_to_time(current_time + break_duration),
                                estimated_minutes=break_duration,
                                is_buffer=True,
                                auto_scheduled=True
                            ))
                            current_time += break_duration
                            continuous_work = 0

                    break  # Move to next iteration after scheduling a task

                if not task_scheduled:
                    # No task could be scheduled in this slot, move on
                    break

        return scheduled_tasks

    def _is_habit_paused(self, habit: Task, target_date: date) -> bool:
        """Check if a habit is paused for the given date.

        Returns True if the habit should be excluded from scheduling.
        Handles paused_until date - if target_date is past paused_until, habit is active.
        """
        if not habit.is_paused:
            return False

        # If paused indefinitely (no paused_until), habit is paused
        if not habit.paused_until:
            return True

        # If target_date is before or on paused_until, habit is still paused
        return target_date <= habit.paused_until

    def _is_task_in_paused_project(self, task: Task) -> bool:
        """Check if a task belongs to a paused (or non-active) project.

        Returns True if the task should be excluded from scheduling because
        its project is paused, completed, or archived.
        """
        try:
            project = self.storage.get_project(task.project_id)
            # Only include tasks from active projects
            return project.status != ProjectStatus.ACTIVE
        except Exception:
            # If project not found, don't exclude the task
            logger.warning(f"Could not find project {task.project_id} for task {task.id}")
            return False

    def _is_task_paused(self, task: Task, target_date: date) -> bool:
        """Check if a task (not habit) is paused for the given date.

        Returns True if the task should be excluded from scheduling.
        Handles paused_until date - if target_date is past paused_until, task is active.
        """
        if not task.is_paused:
            return False

        # If paused indefinitely (no paused_until), task is paused
        if not task.paused_until:
            return True

        # If target_date is before or on paused_until, task is still paused
        return target_date <= task.paused_until

    def _get_tasks_scheduled_on_other_days(self, target_date: date, days_window: int = 30) -> set:
        """Get task IDs that are already scheduled on FUTURE days.

        This prevents duplicate scheduling of regular tasks across multiple days.
        Only considers non-habit tasks (habits are meant to recur).

        IMPORTANT: Only checks FUTURE days, not past days!
        Tasks from past days that weren't completed should be rescheduled.

        Args:
            target_date: The date we're generating a schedule for
            days_window: Number of days FORWARD to check

        Returns:
            Set of task IDs already scheduled on future days
        """
        scheduled_ids = set()

        # ONLY check FUTURE days (day_offset > 0), NOT past days
        # Tasks from past days should be rescheduled if not completed
        for day_offset in range(1, days_window + 1):
            check_date = target_date + timedelta(days=day_offset)
            schedule = self.storage.get_schedule(check_date)

            if schedule:
                for st in schedule.scheduled_tasks:
                    if not st.is_buffer and st.task_id:
                        # Get the task to check if it's a habit
                        task = self._get_task_safe(st.task_id)
                        # Only exclude regular tasks, not habits (habits are meant to recur)
                        if task and not task.is_habit:
                            scheduled_ids.add(st.task_id)

        return scheduled_ids

    def _get_effective_dependencies(self, task: Task, target_date: date, all_tasks_map: Dict[str, Task]) -> List[str]:
        """Get effective dependencies, bypassing paused tasks.

        If a dependency is paused, we look at its dependencies instead (transitive).
        This allows dependent tasks to still be scheduled when intermediate tasks are paused.
        """
        if not task.dependencies:
            return []

        effective_deps = []
        visited = set()  # Prevent infinite loops

        def resolve_deps(dep_ids: List[str]):
            for dep_id in dep_ids:
                if dep_id in visited:
                    continue
                visited.add(dep_id)

                dep_task = all_tasks_map.get(dep_id)
                if dep_task is None:
                    # Dependency not found (maybe deleted), skip it
                    continue

                # Check if this dependency is paused
                is_paused = (
                    (dep_task.is_habit and self._is_habit_paused(dep_task, target_date)) or
                    (not dep_task.is_habit and self._is_task_paused(dep_task, target_date))
                )

                if is_paused:
                    # Bypass: look at this task's dependencies instead
                    resolve_deps(dep_task.dependencies)
                else:
                    # Not paused, this is an effective dependency
                    effective_deps.append(dep_id)

        resolve_deps(task.dependencies)
        return effective_deps

    def _habit_occurs_on_date(self, habit: Task, target_date: date) -> bool:
        """Check if a habit occurs on the given date"""
        if not habit.recurrence or not habit.recurrence.frequency:
            return False

        # Check if habit has passed its end_date
        if habit.recurrence.end_date and target_date > habit.recurrence.end_date:
            return False

        day_name = target_date.strftime("%A").lower()

        if habit.recurrence.frequency == "daily":
            return True
        elif habit.recurrence.frequency == "weekly":
            return day_name in [d.lower() for d in habit.recurrence.days_of_week]

        return False

    def _get_habit_time(self, habit: Task, target_date: date) -> Optional[Tuple[str, int]]:
        """Get the scheduled time for a habit on a given date"""
        if not habit.recurrence or not habit.recurrence.time_of_day:
            return None

        return (habit.recurrence.time_of_day, habit.estimated_minutes)

    def _score_tasks_for_time(
        self,
        tasks: List[Task],
        target_date: date,
        time_minutes: int,
        preferences: UserPreferences,
        energy_bonus: float
    ) -> List[Tuple[Task, float]]:
        """
        Score tasks for a specific time slot, including energy matching bonus.
        Deadline urgency still takes precedence over energy matching.
        """
        current_energy = self._get_energy_level_at_time(target_date, time_minutes, preferences)
        scored = []

        for task in tasks:
            score = 0.0

            # Priority (35%)
            score += (6 - task.priority) * 0.35

            # Deadline urgency (35%) - highest weight to ensure deadlines take precedence
            if task.deadline:
                days_until = (task.deadline.date() - target_date).days
                if days_until < 0:
                    score += 1.0 * 0.35  # Overdue - highest urgency
                elif days_until == 0:
                    score += 0.95 * 0.35  # Due today
                elif days_until <= 3:
                    score += 0.7 * 0.35  # Due soon
                else:
                    score += 0.3 * 0.35  # Future
            else:
                score += 0.2 * 0.35  # No deadline

            # Energy matching (15%) - soft preference
            if current_energy and preferences.scheduling_preferences.respect_energy_patterns:
                task_energy = task.energy_level or "medium"
                if task_energy == current_energy:
                    score += energy_bonus  # Full bonus for exact match
                elif (current_energy == "high" and task_energy == "medium") or \
                     (current_energy == "medium" and task_energy in ["high", "low"]) or \
                     (current_energy == "low" and task_energy == "medium"):
                    score += energy_bonus * 0.5  # Partial bonus for adjacent levels

            # Duration (15%) - prefer shorter tasks to build momentum
            if task.estimated_minutes <= 30:
                score += 0.15
            elif task.estimated_minutes <= 90:
                score += 0.10
            else:
                score += 0.05

            scored.append((task, score))

        # Sort by score descending
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    def _score_tasks(self, tasks: List[Task], target_date: date,
                     preferences: UserPreferences) -> List[Tuple[Task, float]]:
        """Score and sort tasks by priority, deadline, etc. (without time context)"""
        # Use morning time as default for general scoring
        work_start, _ = self._get_work_hours_for_date(target_date, preferences)
        start_minutes = time_to_minutes(work_start)
        energy_bonus = preferences.scheduling_preferences.energy_match_bonus
        return self._score_tasks_for_time(tasks, target_date, start_minutes, preferences, energy_bonus)

    def _dependencies_met(
        self,
        task: Task,
        scheduled_tasks: List[ScheduledTask],
        target_date: Optional[date] = None,
        all_tasks_map: Optional[Dict[str, Task]] = None,
        previously_scheduled_ids: Optional[set] = None
    ) -> bool:
        """Check if all dependencies are scheduled or completed.

        If target_date and all_tasks_map are provided, paused tasks are bypassed
        in the dependency chain (their dependencies become effective dependencies).

        Args:
            scheduled_tasks: Tasks scheduled on the current day
            previously_scheduled_ids: Task IDs scheduled on previous days (for multi-day scheduling)
        """
        if not task.dependencies:
            return True

        # Get effective dependencies (bypassing paused tasks if map is provided)
        if target_date and all_tasks_map:
            deps_to_check = self._get_effective_dependencies(task, target_date, all_tasks_map)
        else:
            deps_to_check = task.dependencies

        # If all effective dependencies are paused/missing, task can proceed
        if not deps_to_check:
            return True

        # Combine current day scheduled tasks with previously scheduled task IDs
        scheduled_ids = {st.task_id for st in scheduled_tasks}
        if previously_scheduled_ids:
            scheduled_ids = scheduled_ids | previously_scheduled_ids

        # Check each dependency
        for dep_id in deps_to_check:
            if dep_id in scheduled_ids:
                continue  # Dependency is scheduled, OK

            # Check if dependency is completed (completed tasks count as met)
            if all_tasks_map:
                dep_task = all_tasks_map.get(dep_id)
                if dep_task and dep_task.status == 'completed':
                    continue  # Dependency is completed, OK
            else:
                # Fallback: try to get the task from storage
                try:
                    dep_task = self.storage.get_task(dep_id)
                    if dep_task and dep_task.status == 'completed':
                        continue  # Dependency is completed, OK
                except:
                    pass  # Task not found, dependency not met

            # Dependency not met
            return False

        return True

    def reschedule(self, target_date: date, preferences: UserPreferences) -> Schedule:
        """Reschedule incomplete tasks for a single date"""
        return self.generate_schedule(target_date, preferences, force=True)

    def generate_multi_day_schedule(
        self,
        start_date: date,
        preferences: UserPreferences,
        force: bool = False,
        max_days: int = 60,
        min_days: int = 7,
        exclude_task_ids: set = None
    ) -> List[Schedule]:
        """
        Generate schedules for multiple days until ALL tasks are scheduled.

        Args:
            exclude_task_ids: Optional set of task IDs to exclude from scheduling
                             (e.g., tasks already scheduled on a previous day)
        """
        # Get total count of tasks to schedule
        all_tasks = self.storage.list_tasks(status="todo")
        all_tasks += self.storage.list_tasks(status="in_progress")
        # Filter out tasks from paused/completed/archived projects AND paused tasks
        schedulable_tasks = [
            t for t in all_tasks
            if not t.is_habit
            and not self._is_task_in_paused_project(t)
            and not self._is_task_paused(t, start_date)
        ]
        total_regular_tasks = len(schedulable_tasks)

        print(f"\n{'='*60}")
        print(f"MULTI-DAY SCHEDULING DEBUG")
        print(f"{'='*60}")
        print(f"Start date: {start_date}")
        print(f"Force: {force}")
        print(f"Total tasks (todo+in_progress): {len(all_tasks)}")
        print(f"Schedulable tasks (non-habit, active projects): {total_regular_tasks}")
        print(f"Min days: {min_days}, Max days: {max_days}")
        if exclude_task_ids:
            print(f"Excluding {len(exclude_task_ids)} tasks already scheduled elsewhere")

        schedules = []
        # Initialize with any tasks we should exclude (e.g., already scheduled today)
        already_scheduled_task_ids: set = set(exclude_task_ids) if exclude_task_ids else set()
        day_index = 0

        while day_index < max_days:
            current_date = start_date + timedelta(days=day_index)

            # Get available tasks (excluding already scheduled)
            available_count = len([t for t in schedulable_tasks if t.id not in already_scheduled_task_ids])
            print(f"\nDay {day_index+1} ({current_date}): {available_count} tasks available")

            schedule = self._generate_schedule_excluding(
                current_date,
                preferences,
                already_scheduled_task_ids,
                force=force
            )
            schedules.append(schedule)

            # Track which non-habit tasks were scheduled on this day
            tasks_scheduled_today = 0
            for st in schedule.scheduled_tasks:
                if not st.is_buffer and st.task_id:
                    task = self._get_task_safe(st.task_id)
                    if task is None:
                        print(f"  WARNING: Could not load task {st.task_id}")
                    elif not task.is_habit:
                        if st.task_id not in already_scheduled_task_ids:
                            already_scheduled_task_ids.add(st.task_id)
                            tasks_scheduled_today += 1

            day_index += 1
            remaining_tasks = total_regular_tasks - len(already_scheduled_task_ids)

            print(f"  Scheduled today: {tasks_scheduled_today}")
            print(f"  Total scheduled so far: {len(already_scheduled_task_ids)}")
            print(f"  Remaining: {remaining_tasks}")

            # Only stop when ALL tasks are scheduled (and we've hit minimum days)
            if day_index >= min_days and len(already_scheduled_task_ids) >= total_regular_tasks:
                print(f"\n✓ All {total_regular_tasks} tasks scheduled in {day_index} days!")
                break

        if len(already_scheduled_task_ids) < total_regular_tasks:
            unscheduled_count = total_regular_tasks - len(already_scheduled_task_ids)
            print(f"\n⚠ Hit max_days={max_days} with {unscheduled_count} tasks unscheduled")
            # Identify which tasks weren't scheduled and why
            unscheduled_tasks = [t for t in schedulable_tasks if t.id not in already_scheduled_task_ids]
            print(f"\n--- UNSCHEDULED TASKS DEBUG ---")
            for task in unscheduled_tasks:
                print(f"\nTask: {task.title} (ID: {task.id})")
                print(f"  Priority: {task.priority}, Duration: {task.estimated_minutes}min")
                print(f"  Dependencies: {task.dependencies}")
                if task.dependencies:
                    for dep_id in task.dependencies:
                        dep_task = self._get_task_safe(dep_id)
                        if dep_task:
                            print(f"    - {dep_id}: {dep_task.title} (status: {dep_task.status}, scheduled: {dep_id in already_scheduled_task_ids})")
                        else:
                            print(f"    - {dep_id}: NOT FOUND (deleted?)")
            print(f"--- END UNSCHEDULED TASKS DEBUG ---\n")

        print(f"\n{'='*60}")
        print(f"RESULT: {len(schedules)} days, {len(already_scheduled_task_ids)}/{total_regular_tasks} tasks")
        print(f"{'='*60}\n")

        return schedules

    def _get_task_safe(self, task_id: str) -> Optional[Task]:
        """Safely get a task by ID, returning None if not found"""
        try:
            return self.storage.get_task(task_id)
        except:
            return None

    def _generate_schedule_excluding(
        self,
        target_date: date,
        preferences: UserPreferences,
        exclude_task_ids: set,
        force: bool = False
    ) -> Schedule:
        """
        Generate schedule for a specific date, excluding already-scheduled tasks.
        """
        # Check if schedule already exists
        existing = self.storage.get_schedule(target_date)
        if existing and not force:
            return existing

        # Get all incomplete tasks
        all_tasks = self.storage.list_tasks(status="todo")
        all_tasks += self.storage.list_tasks(status="in_progress")

        # Auto-fix habits stuck in "completed" status
        # Habits should never stay completed - they reset to "todo" after each completion
        # EXCEPTION: Habits that have passed their end_date can stay completed (they're done forever)
        completed_tasks_all = self.storage.list_tasks(status="completed")
        stuck_habits = []
        for t in completed_tasks_all:
            if t.is_habit:
                # Check if habit has passed its end_date - if so, it's legitimately done
                if t.recurrence and t.recurrence.end_date and date.today() > t.recurrence.end_date:
                    logger.info(f"Habit '{t.title}' is past its end_date ({t.recurrence.end_date}), leaving as completed")
                    continue
                stuck_habits.append(t)

        if stuck_habits:
            for habit in stuck_habits:
                logger.warning(f"Auto-fixing stuck habit '{habit.title}' - resetting status from 'completed' to 'todo'")
                habit.status = TaskStatus.TODO
                habit.completed_at = None
                self.storage.save_task(habit)
            all_tasks += stuck_habits

        # Separate habits from regular tasks
        # Filter out paused habits (unless paused_until date has passed)
        habits = [t for t in all_tasks if t.is_habit and not self._is_habit_paused(t, target_date)]
        # Exclude already-scheduled tasks, tasks from paused projects, and paused tasks
        regular_tasks = [
            t for t in all_tasks
            if not t.is_habit
            and t.id not in exclude_task_ids
            and not self._is_task_in_paused_project(t)
            and not self._is_task_paused(t, target_date)
        ]

        # Build task map for dependency resolution (includes completed tasks for lookups)
        all_tasks_map = {t.id: t for t in all_tasks}
        # Also add completed tasks to the map for dependency checking
        completed_tasks = self.storage.list_tasks(status="completed")
        for ct in completed_tasks:
            all_tasks_map[ct.id] = ct

        logger.info(f"Scheduling for {target_date}: {len(regular_tasks)} tasks available "
                   f"({len(exclude_task_ids)} already scheduled on previous days)")

        # Now use the core scheduling logic
        # Pass exclude_task_ids as previously_scheduled_ids so dependencies can be checked correctly
        return self._do_generate_schedule(target_date, preferences, habits, regular_tasks, all_tasks_map, exclude_task_ids)

    def _do_generate_schedule(
        self,
        target_date: date,
        preferences: UserPreferences,
        habits: List[Task],
        regular_tasks: List[Task],
        all_tasks_map: Optional[Dict[str, Task]] = None,
        previously_scheduled_ids: Optional[set] = None
    ) -> Schedule:
        """Core scheduling logic - extracted for reuse

        Args:
            all_tasks_map: Optional map of all tasks for dependency resolution.
            previously_scheduled_ids: Task IDs scheduled on previous days (for multi-day scheduling).
        """
        target_date_str = target_date.isoformat()

        # Determine work window for this specific day
        work_start, work_end = self._get_work_hours_for_date(target_date, preferences)

        # If scheduling today and current time is after work start,
        # start from current time rounded to next 15-min interval
        if target_date == date.today():
            now = datetime.now()
            current_minutes = now.hour * 60 + now.minute
            work_start_minutes = time_to_minutes(work_start)

            if current_minutes > work_start_minutes:
                rounded_minutes = ((current_minutes + 14) // 15) * 15
                work_start = minutes_to_time(rounded_minutes)

        # Build blocked slots from habits and hard-pinned tasks that occur on this day
        blocked_slots = []
        habit_scheduled_tasks = []
        pinned_scheduled_tasks = []  # Hard-pinned tasks (meetings, appointments)
        hard_pinned_task_ids = set()  # Track IDs to exclude from flexible scheduling

        # Get current time in minutes for comparison (only relevant for today)
        current_time_minutes = None
        if target_date == date.today():
            now = datetime.now()
            current_time_minutes = now.hour * 60 + now.minute

        # Collect hard-pinned tasks scheduled for this date
        pinned_candidates = []
        for task in regular_tasks:
            if task.is_pinned and task.pin_type == 'hard' and task.scheduled_for:
                # Check if scheduled_for date matches target date
                # scheduled_for format: "2025-01-15T10:00:00" or datetime object
                scheduled_for_str = task.scheduled_for
                if isinstance(task.scheduled_for, datetime):
                    scheduled_for_str = task.scheduled_for.isoformat()

                scheduled_date = scheduled_for_str.split('T')[0]
                if scheduled_date == target_date_str:
                    # Extract time from scheduled_for
                    time_part = scheduled_for_str.split('T')[1] if 'T' in scheduled_for_str else None
                    if time_part:
                        start_time = time_part[:5]  # "HH:MM"
                        start_minutes = time_to_minutes(start_time)
                        duration = task.estimated_minutes
                        end_minutes = start_minutes + duration
                        end_time = minutes_to_time(end_minutes)

                        pinned_candidates.append({
                            'task': task,
                            'start_time': start_time,
                            'end_time': end_time,
                            'start_minutes': start_minutes,
                            'end_minutes': end_minutes,
                            'duration': duration
                        })
                        hard_pinned_task_ids.add(task.id)

        logger.info(f"Hard-pinned tasks for {target_date}: {len(pinned_candidates)} "
                   f"[{', '.join(pc['task'].title for pc in pinned_candidates)}]")

        # First, collect all habit time slots for overlap detection
        # Also track habits without time_of_day - they'll be scheduled like regular tasks
        habit_candidates = []
        flexible_habits = []  # Habits without specific time_of_day
        for habit in habits:
            if self._habit_occurs_on_date(habit, target_date):
                habit_time = self._get_habit_time(habit, target_date)
                if habit_time:
                    start_time, duration = habit_time
                    start_minutes = time_to_minutes(start_time)
                    end_minutes = start_minutes + duration
                    end_time = minutes_to_time(end_minutes)

                    # NOTE: We do NOT skip past habits - they should always show for the day
                    # so users can mark them complete even if the scheduled time has passed

                    habit_candidates.append({
                        'habit': habit,
                        'start_time': start_time,
                        'end_time': end_time,
                        'start_minutes': start_minutes,
                        'end_minutes': end_minutes,
                        'duration': duration
                    })
                else:
                    # Habit without time_of_day - schedule flexibly
                    flexible_habits.append(habit)

        # Sort by start time, then by priority
        habit_candidates.sort(key=lambda x: (x['start_minutes'], x['habit'].priority))

        # Detect and resolve overlaps - keep track of scheduled time ranges
        scheduled_ranges = []  # List of (start_min, end_min, title) - includes habits AND pinned tasks
        unscheduled_habits = []  # Track habits that couldn't be scheduled due to overlap

        for hc in habit_candidates:
            # Check if this habit overlaps with any already scheduled item
            has_overlap = False
            conflicting_item = None
            for scheduled_start, scheduled_end, scheduled_title in scheduled_ranges:
                # Check for overlap: two ranges overlap if one starts before the other ends
                if hc['start_minutes'] < scheduled_end and hc['end_minutes'] > scheduled_start:
                    has_overlap = True
                    conflicting_item = scheduled_title
                    break

            if has_overlap:
                # Skip this habit due to overlap
                unscheduled_habits.append({
                    'habit': hc['habit'],
                    'reason': f"Overlaps with '{conflicting_item}'"
                })
                logger.warning(f"Habit '{hc['habit'].title}' ({hc['start_time']}-{hc['end_time']}) "
                             f"overlaps with '{conflicting_item}', skipping")
                continue

            # No overlap, schedule this habit
            blocked_slots.append((hc['start_time'], hc['end_time']))
            habit_scheduled_tasks.append(ScheduledTask(
                task_id=hc['habit'].id,
                start_time=hc['start_time'],
                end_time=hc['end_time'],
                estimated_minutes=hc['duration'],
                is_buffer=False,
                auto_scheduled=True
            ))
            scheduled_ranges.append((hc['start_minutes'], hc['end_minutes'], hc['habit'].title))

        # Sort hard-pinned tasks by start time
        pinned_candidates.sort(key=lambda x: x['start_minutes'])

        # Add hard-pinned tasks to blocked slots (they take priority, similar to habits)
        for pc in pinned_candidates:
            # Check for overlap with already scheduled ranges (habits and other pinned tasks)
            has_overlap = False
            conflicting_item = None
            for scheduled_start, scheduled_end, scheduled_title in scheduled_ranges:
                if pc['start_minutes'] < scheduled_end and pc['end_minutes'] > scheduled_start:
                    has_overlap = True
                    conflicting_item = scheduled_title
                    break

            if has_overlap:
                logger.warning(f"Hard-pinned task '{pc['task'].title}' ({pc['start_time']}-{pc['end_time']}) "
                             f"overlaps with '{conflicting_item}', skipping")
                continue

            # No overlap, schedule this pinned task
            blocked_slots.append((pc['start_time'], pc['end_time']))
            pinned_scheduled_tasks.append(ScheduledTask(
                task_id=pc['task'].id,
                start_time=pc['start_time'],
                end_time=pc['end_time'],
                estimated_minutes=pc['duration'],
                is_buffer=False,
                auto_scheduled=False  # Not auto-scheduled, user pinned it
            ))
            scheduled_ranges.append((pc['start_minutes'], pc['end_minutes'], pc['task'].title))
            logger.info(f"Blocked hard-pinned task '{pc['task'].title}' at {pc['start_time']}-{pc['end_time']}")

        # Get available slots after blocking habits and hard-pinned tasks
        available_slots = get_available_slots(
            work_start,
            work_end,
            blocked_slots,
            min_slot_size=preferences.task_defaults.min_duration
        )

        # Schedule flexible habits first (they're recurring so higher priority)
        # Then schedule regular tasks in remaining slots (excluding hard-pinned tasks)
        flexible_regular_tasks = [t for t in regular_tasks if t.id not in hard_pinned_task_ids]
        tasks_to_schedule = flexible_habits + flexible_regular_tasks
        scheduled_tasks = self._schedule_tasks_in_slots(
            tasks_to_schedule, available_slots, target_date, preferences, all_tasks_map, previously_scheduled_ids
        )

        # Combine and sort (habits, hard-pinned tasks, and auto-scheduled tasks)
        all_scheduled = habit_scheduled_tasks + pinned_scheduled_tasks + scheduled_tasks
        all_scheduled.sort(key=lambda t: time_to_minutes(t.start_time))

        total_minutes = sum(t.estimated_minutes for t in all_scheduled if not t.is_buffer)

        summary = ScheduleSummary(
            total_scheduled_minutes=total_minutes,
            tasks_remaining=len([t for t in all_scheduled if not t.is_buffer])
        )

        constraints = ScheduleConstraints(
            work_start=work_start,
            work_end=work_end,
            blocked_slots=[TimeSlot(start=s, end=e, label="Habit")
                          for s, e in blocked_slots]
        )

        schedule = Schedule(
            date=target_date,
            constraints=constraints,
            scheduled_tasks=all_scheduled,
            summary=summary,
            generated_at=datetime.now()
        )

        self.storage.save_schedule(schedule)
        return schedule