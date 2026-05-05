"""
Shared Pydantic schemas used across client and server.
These are for API communication and validation.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime, date

class SyncRequest(BaseModel):
    """Request for syncing data"""
    client_id: str
    last_sync: Optional[datetime] = None
    entities: List[Dict] = Field(default_factory=list)

class SyncResponse(BaseModel):
    """Response from sync operation"""
    success: bool
    updates: List[Dict] = Field(default_factory=list)
    conflicts: List[Dict] = Field(default_factory=list)
    server_time: datetime

class BackupMetadata(BaseModel):
    """Metadata for a backup"""
    backup_id: str
    created_at: datetime
    version: str
    file_count: int
    total_size_bytes: int
    integrity_hash: str
    label: Optional[str] = None
    auto_backup: bool = False

class InboxItem(BaseModel):
    """Quick capture inbox item"""
    id: str
    text: str
    captured_at: datetime
    project_id: Optional[str] = None

class AnalyticsQuery(BaseModel):
    """Query parameters for analytics"""
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    project_id: Optional[str] = None
    task_type: Optional[str] = None

class EstimationAccuracy(BaseModel):
    """Estimation accuracy statistics"""
    project_id: Optional[str] = None
    task_type: Optional[str] = None
    average_ratio: float
    sample_count: int
    improvement_trend: Optional[float] = None

class ProjectStats(BaseModel):
    """Statistics for a project"""
    project_id: str
    total_tasks: int
    completed_tasks: int
    total_estimated_minutes: int
    total_actual_minutes: int
    completion_rate: float
    average_accuracy_ratio: float

class WeeklyReport(BaseModel):
    """Weekly progress report"""
    week_start: date
    week_end: date
    total_tasks_completed: int
    total_minutes_worked: int
    daily_completion_rates: Dict[str, float]
    top_projects: List[ProjectStats]
    estimation_accuracy: EstimationAccuracy
    insights: List[str]

class BurnoutRiskAssessment(BaseModel):
    """Burnout risk assessment"""
    risk_level: str  # low, medium, high
    indicators: List[str]
    suggestions: List[str]
    metrics: Dict[str, float]