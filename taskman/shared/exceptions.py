"""Custom exceptions for TaskMan"""

class TaskManException(Exception):
    """Base exception for TaskMan"""
    pass

class ProjectNotFoundException(TaskManException):
    """Project not found"""
    pass

class TaskNotFoundException(TaskManException):
    """Task not found"""
    pass

class ListNotFoundException(TaskManException):
    """List not found"""
    pass

class ListInstanceNotFoundException(TaskManException):
    """List instance not found"""
    pass

class GoalNotFoundException(TaskManException):
    """Goal not found"""
    pass

class DependencyCycleError(TaskManException):
    """Circular dependency detected"""
    pass

class InvalidDependencyError(TaskManException):
    """Invalid dependency relationship"""
    pass

class ScheduleNotFoundException(TaskManException):
    """Schedule not found"""
    pass

class StorageError(TaskManException):
    """Storage operation failed"""
    pass

class ValidationError(TaskManException):
    """Data validation failed"""
    pass

class SyncError(TaskManException):
    """Sync operation failed"""
    pass

class BackupError(TaskManException):
    """Backup operation failed"""
    pass

class ServerUnavailableError(TaskManException):
    """Server is not available"""
    pass


class NoteNotFoundException(TaskManException):
    """Note not found"""
    pass


class ReviewNotFoundException(TaskManException):
    """Review not found"""
    pass


class FolderNotFoundException(TaskManException):
    """Folder not found"""
    pass