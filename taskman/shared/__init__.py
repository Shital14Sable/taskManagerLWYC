"""Shared module"""
from taskman.shared.constants import (
    ProjectStatus,
    TaskStatus,
    EnergyLevel,
    RecurrencePattern,
    SyncAction,
    ConflictResolution,
    MIN_PRIORITY,
    MAX_PRIORITY,
    MIN_DIFFICULTY,
    MAX_DIFFICULTY,
    DEFAULT_WORK_START,
    DEFAULT_WORK_END,
    SHORT_ID_LENGTH
)
from taskman.shared.exceptions import (
    TaskManException,
    ProjectNotFoundException,
    TaskNotFoundException,
    DependencyCycleError,
    InvalidDependencyError,
    ScheduleNotFoundException,
    StorageError,
    ValidationError,
    SyncError,
    BackupError,
    ServerUnavailableError
)

__all__ = [
    'ProjectStatus',
    'TaskStatus',
    'EnergyLevel',
    'RecurrencePattern',
    'SyncAction',
    'ConflictResolution',
    'MIN_PRIORITY',
    'MAX_PRIORITY',
    'MIN_DIFFICULTY',
    'MAX_DIFFICULTY',
    'DEFAULT_WORK_START',
    'DEFAULT_WORK_END',
    'SHORT_ID_LENGTH',
    'TaskManException',
    'ProjectNotFoundException',
    'TaskNotFoundException',
    'DependencyCycleError',
    'InvalidDependencyError',
    'ScheduleNotFoundException',
    'StorageError',
    'ValidationError',
    'SyncError',
    'BackupError',
    'ServerUnavailableError'
]