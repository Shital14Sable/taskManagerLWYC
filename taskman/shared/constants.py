from enum import Enum

class ProjectStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ARCHIVED = "archived"

class TaskStatus(str, Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"

class EnergyLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class RecurrencePattern(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class SyncAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"

class ConflictResolution(str, Enum):
    SERVER_WINS = "server_wins"
    CLIENT_WINS = "client_wins"
    MANUAL = "manual"

class ListType(str, Enum):
    ETERNAL = "eternal"      # Cumulative lists (movies, books, etc.)
    TEMPLATE = "template"    # Reusable checklists (grocery, packing, etc.)
    QUICK = "quick"          # One-off lists (party supplies, etc.) - auto-archives when complete

# Priority levels
MIN_PRIORITY = 1
MAX_PRIORITY = 5

# Difficulty levels
MIN_DIFFICULTY = 1
MAX_DIFFICULTY = 5

# Time constants
DEFAULT_WORK_START = "08:00"
DEFAULT_WORK_END = "22:00"
DEFAULT_BUFFER_PERCENTAGE = 10
DEFAULT_MIN_TASK_DURATION = 15
DEFAULT_TASK_DURATION = 60
MAX_DEEP_WORK_MINUTES = 120

# Scheduling weights
PRIORITY_WEIGHT = 0.4
DEADLINE_WEIGHT = 0.3
DEPENDENCY_WEIGHT = 0.2
AGE_WEIGHT = 0.1

# ID length
SHORT_ID_LENGTH = 8