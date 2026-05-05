"""
Gamification API endpoints
"""
from fastapi import APIRouter, Request
from typing import List

from taskman.server.models.gamification import UserStats, Badge, BADGE_DEFINITIONS

router = APIRouter()


@router.get("/stats", response_model=UserStats)
def get_user_stats(request: Request):
    """Get user gamification statistics"""
    gamification = request.app.state.gamification
    return gamification.get_stats()


@router.get("/level-progress")
def get_level_progress(request: Request):
    """Get detailed level progress"""
    gamification = request.app.state.gamification
    return gamification.get_level_progress()


@router.get("/badges")
def get_badges(request: Request):
    """Get all badges with earned status"""
    gamification = request.app.state.gamification
    return gamification.get_all_badges()


@router.get("/badges/earned")
def get_earned_badges(request: Request):
    """Get only earned badges"""
    gamification = request.app.state.gamification
    return gamification.get_earned_badges()


@router.get("/badges/summary")
def get_badge_summary(request: Request):
    """Get summary of all badges with earned count and history"""
    gamification = request.app.state.gamification
    return gamification.get_badge_summary()


@router.get("/badges/history")
def get_badge_history(request: Request, badge_type: str = None):
    """Get badge achievement history, optionally filtered by badge type"""
    gamification = request.app.state.gamification
    return gamification.get_badge_history(badge_type)
