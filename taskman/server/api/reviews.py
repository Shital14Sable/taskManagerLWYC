"""
Reviews API - Daily, Weekly, and Monthly reviews with auto-generated content.

Reviews aggregate data from tasks, goals, habits, and lists to provide
a summary of activity and progress for a given time period.
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
import uuid
from datetime import datetime, date, timedelta

from taskman.server.models.review import (
    Review, ReviewType, ReviewCreate, ReviewUpdate,
    ReviewContent, TaskSummary, GoalProgress, HabitSummary, ListSummary
)
from taskman.shared.constants import SHORT_ID_LENGTH
from taskman.shared.exceptions import ReviewNotFoundException

router = APIRouter()


def generate_short_id() -> str:
    """Generate 8-character short ID"""
    return str(uuid.uuid4())[:SHORT_ID_LENGTH]


def get_period_dates(review_type: ReviewType, target_date: date) -> tuple[date, date]:
    """Get the start and end dates for a review period."""
    if review_type == ReviewType.DAILY:
        return target_date, target_date
    elif review_type == ReviewType.WEEKLY:
        # Get start of week (Monday)
        start = target_date - timedelta(days=target_date.weekday())
        end = start + timedelta(days=6)
        return start, end
    elif review_type == ReviewType.MONTHLY:
        # Get start and end of month
        start = target_date.replace(day=1)
        if target_date.month == 12:
            end = target_date.replace(year=target_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            end = target_date.replace(month=target_date.month + 1, day=1) - timedelta(days=1)
        return start, end
    return target_date, target_date


def generate_review_content(storage, review_type: ReviewType, start_date: date, end_date: date) -> ReviewContent:
    """Generate review content from stored data."""
    content = ReviewContent()

    # Get all tasks
    all_tasks = storage.list_tasks()
    tasks_summary = TaskSummary()

    # Find completed tasks in period
    for task in all_tasks:
        if task.completed_at:
            try:
                completed = task.completed_at
                if isinstance(completed, str):
                    completed = datetime.fromisoformat(completed)
                completed_date = completed.date() if hasattr(completed, 'date') else completed

                if start_date <= completed_date <= end_date:
                    tasks_summary.completed_count += 1
                    tasks_summary.completed_tasks.append({
                        "id": task.id,
                        "title": task.title,
                        "project_id": task.project_id,
                        "completed_at": str(completed),
                        "actual_minutes": task.actual_minutes
                    })
                    if task.actual_minutes:
                        tasks_summary.total_time_spent += task.actual_minutes
            except:
                continue

        # Check for stale tasks (no activity in 7+ days)
        if task.status in ['todo', 'in_progress']:
            updated = task.updated_at
            if isinstance(updated, str):
                updated = datetime.fromisoformat(updated)
            updated_date = updated.date() if hasattr(updated, 'date') else updated

            if (date.today() - updated_date).days >= 7:
                tasks_summary.stale_count += 1
                tasks_summary.stale_tasks.append({
                    "id": task.id,
                    "title": task.title,
                    "project_id": task.project_id,
                    "last_updated": str(updated)
                })

        # Check for upcoming deadlines
        if task.deadline and task.status not in ['completed']:
            try:
                deadline = task.deadline
                if isinstance(deadline, str):
                    deadline = datetime.fromisoformat(deadline).date()
                elif hasattr(deadline, 'date'):
                    deadline = deadline.date()

                days_until = (deadline - date.today()).days
                deadline_threshold = 3 if review_type == ReviewType.DAILY else (7 if review_type == ReviewType.WEEKLY else 30)

                if 0 <= days_until <= deadline_threshold:
                    tasks_summary.upcoming_deadlines.append({
                        "id": task.id,
                        "title": task.title,
                        "deadline": str(deadline),
                        "days_until": days_until
                    })
            except:
                continue

    content.tasks_completed = tasks_summary

    # Get goal progress
    try:
        goals = storage.list_goals(status="active")
        for goal in goals:
            progress = storage.calculate_goal_progress(goal.id)
            content.goals_progress.append(GoalProgress(
                goal_id=goal.id,
                title=goal.title,
                progress=progress,
                status=goal.status.value,
                linked_projects_count=len(goal.linked_project_ids)
            ))
    except:
        pass

    # Get habit summaries
    try:
        habits = [t for t in all_tasks if t.is_habit]
        for habit in habits:
            # Count scheduled vs completed in period
            recurrence = habit.recurrence
            if recurrence:
                days_in_period = (end_date - start_date).days + 1
                scheduled_count = 0
                completed_count = 0

                # Simplified: estimate based on frequency
                if recurrence.frequency == 'daily':
                    scheduled_count = days_in_period
                elif recurrence.frequency == 'weekly':
                    scheduled_count = max(1, days_in_period // 7) * len(recurrence.days_of_week or [1])

                # Check habit instances for completions
                try:
                    instances = storage.list_habit_instances(
                        habit.id,
                        start_date=start_date,
                        end_date=end_date
                    )
                    completed_count = len([i for i in instances if i.completed])
                except:
                    completed_count = 0

                completion_rate = (completed_count / scheduled_count * 100) if scheduled_count > 0 else 0

                content.habits_summary.append(HabitSummary(
                    habit_id=habit.id,
                    title=habit.title,
                    scheduled_count=scheduled_count,
                    completed_count=completed_count,
                    completion_rate=round(completion_rate, 1)
                ))
    except:
        pass

    # Get list summaries
    try:
        lists = storage.list_lists()
        for lst in lists:
            pending = len([i for i in lst.items if not i.completed_at])
            completed = len([i for i in lst.items if i.completed_at])

            if pending > 0:  # Only include lists with pending items
                content.lists_summary.append(ListSummary(
                    list_id=lst.id,
                    name=lst.name,
                    pending_count=pending,
                    completed_count=completed
                ))
    except:
        pass

    # Calculate productivity score
    total_possible = tasks_summary.completed_count + tasks_summary.stale_count
    if total_possible > 0:
        content.productivity_score = round((tasks_summary.completed_count / total_possible) * 100, 1)

    # Generate highlights
    if tasks_summary.completed_count >= 5:
        content.highlights.append(f"Completed {tasks_summary.completed_count} tasks!")
    if tasks_summary.total_time_spent >= 480:  # 8 hours
        content.highlights.append(f"Put in {tasks_summary.total_time_spent // 60} hours of focused work")
    if content.productivity_score >= 80:
        content.highlights.append("Maintained high productivity!")

    # Generate areas for improvement
    if tasks_summary.stale_count >= 3:
        content.areas_for_improvement.append(f"{tasks_summary.stale_count} tasks haven't been touched in a week")
    if len(tasks_summary.upcoming_deadlines) >= 3:
        content.areas_for_improvement.append(f"{len(tasks_summary.upcoming_deadlines)} deadlines approaching")

    return content


# ============================================================================
# REVIEW ENDPOINTS
# ============================================================================

@router.post("/generate", response_model=Review)
def generate_review(review_data: ReviewCreate, request: Request):
    """Generate a new review for the specified period"""
    storage = request.app.state.storage

    # Parse date
    if review_data.date:
        target_date = date.fromisoformat(review_data.date)
    else:
        target_date = date.today()

    # Get period dates
    start_date, end_date = get_period_dates(review_data.review_type, target_date)

    # Check if review already exists
    period_key = Review.get_period_key(review_data.review_type, target_date)
    try:
        existing = storage.get_review(review_data.review_type.value, period_key)
        # Update existing review with fresh content
        existing.content = generate_review_content(storage, review_data.review_type, start_date, end_date)
        storage.save_review(existing)
        return existing
    except ReviewNotFoundException:
        pass

    # Generate new review
    content = generate_review_content(storage, review_data.review_type, start_date, end_date)

    new_review = Review(
        id=generate_short_id(),
        review_type=review_data.review_type,
        date=target_date.isoformat(),
        period_start=start_date.isoformat(),
        period_end=end_date.isoformat(),
        content=content,
        created_at=datetime.now()
    )

    storage.save_review(new_review)
    return new_review


@router.get("/daily", response_model=Review)
def get_daily_review(request: Request, date_str: Optional[str] = None):
    """Get or generate today's daily review"""
    review_data = ReviewCreate(
        review_type=ReviewType.DAILY,
        date=date_str
    )
    return generate_review(review_data, request)


@router.get("/weekly", response_model=Review)
def get_weekly_review(request: Request, date_str: Optional[str] = None):
    """Get or generate this week's review"""
    review_data = ReviewCreate(
        review_type=ReviewType.WEEKLY,
        date=date_str
    )
    return generate_review(review_data, request)


@router.get("/monthly", response_model=Review)
def get_monthly_review(request: Request, date_str: Optional[str] = None):
    """Get or generate this month's review"""
    review_data = ReviewCreate(
        review_type=ReviewType.MONTHLY,
        date=date_str
    )
    return generate_review(review_data, request)


@router.get("/", response_model=List[Review])
def list_reviews(
    request: Request,
    review_type: Optional[str] = None,
    limit: int = 50
):
    """List all reviews with optional filters"""
    storage = request.app.state.storage
    return storage.list_reviews(review_type=review_type, limit=limit)


@router.get("/{review_type}/{period_key}", response_model=Review)
def get_review(review_type: str, period_key: str, request: Request):
    """Get a specific review"""
    storage = request.app.state.storage
    try:
        return storage.get_review(review_type, period_key)
    except ReviewNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{review_type}/{period_key}", response_model=Review)
def update_review(review_type: str, period_key: str, update: ReviewUpdate, request: Request):
    """Update a review (mainly for adding personal notes)"""
    storage = request.app.state.storage

    try:
        review = storage.get_review(review_type, period_key)
    except ReviewNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if update.notes is not None:
        review.notes = update.notes

    storage.save_review(review)
    return review


@router.delete("/{review_type}/{period_key}")
def delete_review(review_type: str, period_key: str, request: Request):
    """Delete a review"""
    storage = request.app.state.storage

    try:
        storage.delete_review(review_type, period_key)
    except ReviewNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": f"Review {review_type}/{period_key} deleted"}
