"""
Storage Manager
Handles all data persistence for tasks, projects, schedules, and preferences

Data directory can be configured via:
1. Constructor parameter
2. TASKMAN_DATA_DIR environment variable
3. Config file (~/.config/taskman/config.json)
4. Default: ./data (relative to current working directory)
"""
import json
import os
import sqlite3
from pathlib import Path
from typing import List, Optional
from datetime import date, datetime, timedelta

from taskman.server.models.task import Task
from taskman.server.models.project import Project
from taskman.server.models.schedule import Schedule
from taskman.server.models.user_preferences import UserPreferences
from taskman.server.models.habit_instance import HabitInstance
from taskman.server.models.list import TaskList, ListInstance
from taskman.shared.exceptions import TaskNotFoundException, ProjectNotFoundException, ListNotFoundException


def migrate_tags(data: dict) -> dict:
    """Migrate tags from old dict format to new list format."""
    if 'tags' in data:
        tags = data['tags']
        # Convert dict to list (old format was Dict[str, str])
        if isinstance(tags, dict):
            # If empty dict, convert to empty list
            if not tags:
                data['tags'] = []
            else:
                # If dict has values, convert to list of "key/value" strings
                data['tags'] = [f"{k}/{v}" if v else k for k, v in tags.items()]
    return data


def get_config_path() -> Path:
    """Get the path to the TaskMan config file."""
    return Path.home() / ".config" / "taskman" / "config.json"


def get_default_data_dir() -> str:
    """
    Get data directory with the following priority:
    1. TASKMAN_DATA_DIR environment variable
    2. Config file (~/.config/taskman/config.json)
    3. Default: ./data
    """
    # First check environment variable
    env_dir = os.environ.get('TASKMAN_DATA_DIR')
    if env_dir:
        return env_dir

    # Then check config file
    config_path = get_config_path()
    if config_path.exists():
        try:
            with open(config_path, 'r') as f:
                config = json.load(f)
                if 'data_dir' in config:
                    return config['data_dir']
        except (json.JSONDecodeError, IOError):
            pass  # Fall through to default

    # Default
    return './data'


class StorageManager:
    def __init__(self, data_dir: Optional[str] = None):
        # Use provided dir, or env var, or default
        resolved_dir = data_dir if data_dir else get_default_data_dir()
        self.data_dir = Path(resolved_dir).expanduser().resolve()
        self.data_dir.mkdir(parents=True, exist_ok=True)

        # Create subdirectories
        self.tasks_dir = self.data_dir / "tasks"
        self.projects_dir = self.data_dir / "projects"
        self.schedules_dir = self.data_dir / "schedules"
        self.habit_instances_dir = self.data_dir / "habit_instances"
        self.lists_dir = self.data_dir / "lists"
        self.list_instances_dir = self.data_dir / "list_instances"
        self.goals_dir = self.data_dir / "goals"

        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        self.schedules_dir.mkdir(parents=True, exist_ok=True)
        self.habit_instances_dir.mkdir(parents=True, exist_ok=True)
        self.lists_dir.mkdir(parents=True, exist_ok=True)
        self.list_instances_dir.mkdir(parents=True, exist_ok=True)
        self.goals_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize SQLite database
        self.db_path = self.data_dir / "database.db"
        self._init_db()
        
        # Load or create user preferences
        self.prefs_path = self.data_dir / "user_preferences.json"
        self._load_preferences()
    
    def _init_db(self):
        """Initialize SQLite database with tables"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Tasks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                parent_task_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                priority INTEGER,
                difficulty INTEGER,
                energy_level TEXT,
                estimated_minutes INTEGER,
                actual_minutes INTEGER,
                status TEXT,
                deadline TEXT,
                scheduled_for TEXT,
                created_at TEXT,
                updated_at TEXT,
                completed_at TEXT,
                is_habit INTEGER DEFAULT 0,
                recurrence_data TEXT
            )
        """)
        
        # Projects table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                priority INTEGER,
                status TEXT,
                parent_id TEXT,
                created_at TEXT,
                updated_at TEXT,
                completed_at TEXT
            )
        """)
        
        # Analytics table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS task_completions (
                task_id TEXT,
                completed_at TEXT,
                estimated_minutes INTEGER,
                actual_minutes INTEGER,
                energy_level TEXT,
                difficulty INTEGER
            )
        """)
        
        conn.commit()
        conn.close()
    
    def _load_preferences(self):
        """Load user preferences from file"""
        if self.prefs_path.exists():
            with open(self.prefs_path, 'r') as f:
                data = json.load(f)
                self.preferences = UserPreferences(**data)
        else:
            self.preferences = UserPreferences()
            self._save_preferences()
    
    def _save_preferences(self):
        """Save user preferences to file"""
        with open(self.prefs_path, 'w') as f:
            json.dump(self.preferences.dict(), f, indent=2, default=str)
    
    def get_preferences(self) -> UserPreferences:
        """Get user preferences"""
        return self.preferences
    
    # ========================================================================
    # TASK OPERATIONS
    # ========================================================================
    
    def save_task(self, task: Task):
        """Save task to both JSON file and database"""
        # Ensure directory exists
        self.tasks_dir.mkdir(parents=True, exist_ok=True)
        # Save to JSON
        task_file = self.tasks_dir / f"{task.id}.json"
        with open(task_file, 'w') as f:
            json.dump(task.dict(), f, indent=2, default=str)
        
        # Save to database
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # FIX: Handle energy_level as string, not enum
        energy_level = task.energy_level if isinstance(task.energy_level, str) else task.energy_level.value
        
        # FIX: Handle status as string or enum
        status = task.status if isinstance(task.status, str) else task.status.value
        
        # Serialize recurrence data
        recurrence_data = json.dumps(task.recurrence.dict()) if task.recurrence else None
        
        cursor.execute("""
            INSERT OR REPLACE INTO tasks VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, (
            task.id, task.project_id, task.parent_task_id, task.title,
            task.description, task.priority, task.difficulty, energy_level,
            task.estimated_minutes, task.actual_minutes, status,
            task.deadline.isoformat() if task.deadline else None,
            task.scheduled_for.isoformat() if task.scheduled_for else None,
            task.created_at.isoformat(), task.updated_at.isoformat(),
            task.completed_at.isoformat() if task.completed_at else None,
            1 if task.is_habit else 0,
            recurrence_data
        ))
        
        conn.commit()
        conn.close()
    
    def get_task(self, task_id: str) -> Task:
        """Get task by ID"""
        task_file = self.tasks_dir / f"{task_id}.json"

        if not task_file.exists():
            raise TaskNotFoundException(f"Task {task_id} not found")

        with open(task_file, 'r') as f:
            data = json.load(f)
            data = migrate_tags(data)  # Handle old tags format
            return Task(**data)
    
    def list_tasks(self, project_id: Optional[str] = None,
                   status: Optional[str] = None) -> List[Task]:
        """List all tasks, optionally filtered"""
        tasks = []

        for task_file in self.tasks_dir.glob("*.json"):
            with open(task_file, 'r') as f:
                data = json.load(f)
                data = migrate_tags(data)  # Handle old tags format
                task = Task(**data)
                
                # Apply filters
                if project_id and task.project_id != project_id:
                    continue
                
                if status:
                    task_status = task.status if isinstance(task.status, str) else task.status.value
                    if task_status != status:
                        continue
                
                tasks.append(task)
        
        return tasks
    
    def delete_task(self, task_id: str):
        """Delete a task.

        When a task is deleted, any tasks that depend on it will have that
        dependency removed (they become independent of the deleted task).
        """
        task_file = self.tasks_dir / f"{task_id}.json"

        if not task_file.exists():
            raise TaskNotFoundException(f"Task {task_id} not found")

        # Remove this task from dependencies of other tasks
        self._remove_dependency_from_all_tasks(task_id)

        task_file.unlink()

        # Delete from database
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()

    def _remove_dependency_from_all_tasks(self, dependency_id: str):
        """Remove a dependency ID from all tasks that reference it.

        This is called when a task is deleted to make dependent tasks independent.
        """
        for task_file in self.tasks_dir.glob("*.json"):
            with open(task_file, 'r') as f:
                data = json.load(f)

            if dependency_id in data.get('dependencies', []):
                data['dependencies'].remove(dependency_id)
                data['updated_at'] = datetime.now().isoformat()

                with open(task_file, 'w') as f:
                    json.dump(data, f, indent=2, default=str)
    
    def record_task_completion(self, task: Task):
        """Record task completion for analytics"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        energy_level = task.energy_level if isinstance(task.energy_level, str) else task.energy_level.value
        
        cursor.execute("""
            INSERT INTO task_completions VALUES (?, ?, ?, ?, ?, ?)
        """, (
            task.id,
            datetime.now().isoformat(),
            task.estimated_minutes,
            task.actual_minutes,
            energy_level,
            task.difficulty
        ))
        
        conn.commit()
        conn.close()
    
    # ========================================================================
    # PROJECT OPERATIONS
    # ========================================================================
    
    def save_project(self, project: Project):
        """Save project to both JSON file and database"""
        # Ensure directory exists
        self.projects_dir.mkdir(parents=True, exist_ok=True)
        # Save to JSON
        project_file = self.projects_dir / f"{project.id}.json"
        with open(project_file, 'w') as f:
            json.dump(project.dict(), f, indent=2, default=str)
        
        # Save to database
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        status = project.status if isinstance(project.status, str) else project.status.value
        
        cursor.execute("""
            INSERT OR REPLACE INTO projects VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
        """, (
            project.id, project.name, project.description, project.priority,
            status, project.parent_id,
            project.created_at.isoformat(), project.updated_at.isoformat(),
            project.completed_at.isoformat() if project.completed_at else None
        ))
        
        conn.commit()
        conn.close()
    
    def get_project(self, project_id: str) -> Project:
        """Get project by ID"""
        project_file = self.projects_dir / f"{project_id}.json"

        if not project_file.exists():
            raise ProjectNotFoundException(f"Project {project_id} not found")

        with open(project_file, 'r') as f:
            data = json.load(f)
            data = migrate_tags(data)  # Handle old tags format
            return Project(**data)
    
    def list_projects(self, status: Optional[str] = None) -> List[Project]:
        """List all projects, optionally filtered by status"""
        projects = []

        for project_file in self.projects_dir.glob("*.json"):
            with open(project_file, 'r') as f:
                data = json.load(f)
                data = migrate_tags(data)  # Handle old tags format
                project = Project(**data)
                
                if status:
                    project_status = project.status if isinstance(project.status, str) else project.status.value
                    if project_status != status:
                        continue
                
                projects.append(project)
        
        return projects
    
    def delete_project(self, project_id: str):
        """Delete a project"""
        project_file = self.projects_dir / f"{project_id}.json"
        
        if not project_file.exists():
            raise ProjectNotFoundException(f"Project {project_id} not found")
        
        project_file.unlink()
        
        # Delete from database
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        conn.close()
    
    # ========================================================================
    # SCHEDULE OPERATIONS
    # ========================================================================
    
    def save_schedule(self, schedule: Schedule):
        """Save schedule to JSON file"""
        # Ensure directory exists (handles case where it was deleted)
        self.schedules_dir.mkdir(parents=True, exist_ok=True)
        schedule_file = self.schedules_dir / f"{schedule.date.isoformat()}.json"
        with open(schedule_file, 'w') as f:
            json.dump(schedule.dict(), f, indent=2, default=str)
    
    def get_schedule(self, schedule_date: date) -> Optional[Schedule]:
        """Get schedule for a specific date"""
        schedule_file = self.schedules_dir / f"{schedule_date.isoformat()}.json"
        
        if not schedule_file.exists():
            return None
        
        with open(schedule_file, 'r') as f:
            data = json.load(f)
            return Schedule(**data)
    
    def delete_schedule(self, schedule_date: date):
        """Delete a schedule"""
        schedule_file = self.schedules_dir / f"{schedule_date.isoformat()}.json"
        if schedule_file.exists():
            schedule_file.unlink()

    def delete_all_schedules(self) -> int:
        """Delete ALL schedule files. Returns count of deleted files."""
        deleted_count = 0
        if self.schedules_dir.exists():
            for schedule_file in self.schedules_dir.glob("*.json"):
                try:
                    schedule_file.unlink()
                    deleted_count += 1
                except Exception:
                    pass
        return deleted_count

    def delete_future_schedules(self, from_date: date) -> int:
        """Delete all schedules from a given date onwards. Returns count of deleted files."""
        deleted_count = 0
        if self.schedules_dir.exists():
            for schedule_file in self.schedules_dir.glob("*.json"):
                try:
                    # Parse date from filename (YYYY-MM-DD.json)
                    file_date = date.fromisoformat(schedule_file.stem)
                    if file_date >= from_date:
                        schedule_file.unlink()
                        deleted_count += 1
                except (ValueError, Exception):
                    pass
        return deleted_count

    def cleanup_old_schedules(self, keep_days_past: int = 7) -> int:
        """Delete schedules older than keep_days_past. Returns count of deleted files."""
        cutoff_date = date.today() - timedelta(days=keep_days_past)
        deleted_count = 0
        if self.schedules_dir.exists():
            for schedule_file in self.schedules_dir.glob("*.json"):
                try:
                    file_date = date.fromisoformat(schedule_file.stem)
                    if file_date < cutoff_date:
                        schedule_file.unlink()
                        deleted_count += 1
                except (ValueError, Exception):
                    pass
        return deleted_count

    def list_schedules(self, start_date: date, end_date: date) -> List[Schedule]:
        """List all schedules in a date range"""
        schedules = []
        current = start_date
        while current <= end_date:
            schedule = self.get_schedule(current)
            if schedule:
                schedules.append(schedule)
            current += timedelta(days=1)
        return schedules

    def get_estimation_factors(self) -> float:
        """Get average estimation accuracy from completed tasks"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute("""
            SELECT AVG(CAST(actual_minutes AS FLOAT) / estimated_minutes)
            FROM tasks
            WHERE status = 'completed'
            AND actual_minutes IS NOT NULL
            AND actual_minutes > 0
            AND estimated_minutes > 0
        """)

        result = cursor.fetchone()[0]
        conn.close()

        return result if result else 1.0

    # ========================================================================
    # PREFERENCES
    # ========================================================================

    def save_preferences(self, prefs: UserPreferences):
        """Save user preferences"""
        self.preferences = prefs
        self._save_preferences()

    # ========================================================================
    # HABIT INSTANCE OPERATIONS
    # ========================================================================

    def _get_habit_instance_key(self, habit_id: str, instance_date: date) -> str:
        """Generate a unique key for a habit instance."""
        return f"{habit_id}_{instance_date.isoformat()}"

    def save_habit_instance(self, instance: HabitInstance):
        """Save a habit instance to JSON file."""
        self.habit_instances_dir.mkdir(parents=True, exist_ok=True)
        key = self._get_habit_instance_key(instance.habit_id, instance.date)
        instance_file = self.habit_instances_dir / f"{key}.json"
        with open(instance_file, 'w') as f:
            json.dump(instance.dict(), f, indent=2, default=str)

    def get_habit_instance(self, habit_id: str, instance_date: date) -> Optional[HabitInstance]:
        """Get a habit instance for a specific habit and date."""
        key = self._get_habit_instance_key(habit_id, instance_date)
        instance_file = self.habit_instances_dir / f"{key}.json"

        if not instance_file.exists():
            return None

        with open(instance_file, 'r') as f:
            data = json.load(f)
            return HabitInstance(**data)

    def list_habit_instances(self, habit_id: str,
                              start_date: Optional[date] = None,
                              end_date: Optional[date] = None) -> List[HabitInstance]:
        """List all instances for a habit, optionally filtered by date range."""
        instances = []

        for instance_file in self.habit_instances_dir.glob(f"{habit_id}_*.json"):
            with open(instance_file, 'r') as f:
                data = json.load(f)
                instance = HabitInstance(**data)

                # Apply date filters
                if start_date and instance.date < start_date:
                    continue
                if end_date and instance.date > end_date:
                    continue

                instances.append(instance)

        # Sort by date
        instances.sort(key=lambda x: x.date)
        return instances

    def list_habit_instances_for_date(self, instance_date: date) -> List[HabitInstance]:
        """List all habit instances for a specific date."""
        instances = []

        for instance_file in self.habit_instances_dir.glob(f"*_{instance_date.isoformat()}.json"):
            with open(instance_file, 'r') as f:
                data = json.load(f)
                instances.append(HabitInstance(**data))

        return instances

    def delete_habit_instance(self, habit_id: str, instance_date: date) -> bool:
        """Delete a habit instance."""
        key = self._get_habit_instance_key(habit_id, instance_date)
        instance_file = self.habit_instances_dir / f"{key}.json"

        if instance_file.exists():
            instance_file.unlink()
            return True
        return False

    # ========================================================================
    # LIST OPERATIONS
    # ========================================================================

    def save_list(self, task_list: TaskList):
        """Save a list to JSON file."""
        self.lists_dir.mkdir(parents=True, exist_ok=True)
        list_file = self.lists_dir / f"{task_list.id}.json"
        with open(list_file, 'w') as f:
            json.dump(task_list.dict(), f, indent=2, default=str)

    def get_list(self, list_id: str) -> TaskList:
        """Get a list by ID."""
        list_file = self.lists_dir / f"{list_id}.json"

        if not list_file.exists():
            raise ListNotFoundException(f"List {list_id} not found")

        with open(list_file, 'r') as f:
            data = json.load(f)
            return TaskList(**data)

    def list_lists(self, include_archived: bool = False) -> List[TaskList]:
        """List all lists, optionally including archived ones."""
        lists = []

        for list_file in self.lists_dir.glob("*.json"):
            with open(list_file, 'r') as f:
                data = json.load(f)
                task_list = TaskList(**data)

                # Filter out archived unless requested
                if not include_archived and task_list.archived:
                    continue

                lists.append(task_list)

        # Sort by updated_at descending
        lists.sort(key=lambda x: x.updated_at, reverse=True)
        return lists

    def delete_list(self, list_id: str) -> bool:
        """Delete a list."""
        list_file = self.lists_dir / f"{list_id}.json"

        if not list_file.exists():
            raise ListNotFoundException(f"List {list_id} not found")

        list_file.unlink()
        return True

    # ========================================================================
    # LIST INSTANCE OPERATIONS
    # ========================================================================

    def save_list_instance(self, instance: ListInstance):
        """Save a list instance to JSON file."""
        self.list_instances_dir.mkdir(parents=True, exist_ok=True)
        instance_file = self.list_instances_dir / f"{instance.id}.json"
        with open(instance_file, 'w') as f:
            json.dump(instance.dict(), f, indent=2, default=str)

    def get_list_instance(self, instance_id: str) -> ListInstance:
        """Get a list instance by ID."""
        instance_file = self.list_instances_dir / f"{instance_id}.json"

        if not instance_file.exists():
            from taskman.shared.exceptions import ListInstanceNotFoundException
            raise ListInstanceNotFoundException(f"List instance {instance_id} not found")

        with open(instance_file, 'r') as f:
            data = json.load(f)
            return ListInstance(**data)

    def list_list_instances(self, list_id: Optional[str] = None,
                            include_archived: bool = False) -> List[ListInstance]:
        """List all list instances, optionally filtered by list_id."""
        instances = []

        for instance_file in self.list_instances_dir.glob("*.json"):
            with open(instance_file, 'r') as f:
                data = json.load(f)
                instance = ListInstance(**data)

                # Filter by list_id if provided
                if list_id and instance.list_id != list_id:
                    continue

                # Filter out archived unless requested
                if not include_archived and instance.archived_at:
                    continue

                instances.append(instance)

        # Sort by created_at descending
        instances.sort(key=lambda x: x.created_at, reverse=True)
        return instances

    def delete_list_instance(self, instance_id: str) -> bool:
        """Delete a list instance."""
        instance_file = self.list_instances_dir / f"{instance_id}.json"

        if not instance_file.exists():
            from taskman.shared.exceptions import ListInstanceNotFoundException
            raise ListInstanceNotFoundException(f"List instance {instance_id} not found")

        instance_file.unlink()
        return True

    # ========================================================================
    # GOAL OPERATIONS
    # ========================================================================

    def save_goal(self, goal: 'Goal'):
        """Save a goal to JSON file."""
        from taskman.server.models.goal import Goal
        self.goals_dir.mkdir(parents=True, exist_ok=True)
        goal_file = self.goals_dir / f"{goal.id}.json"
        with open(goal_file, 'w') as f:
            json.dump(goal.dict(), f, indent=2, default=str)

    def get_goal(self, goal_id: str) -> 'Goal':
        """Get a goal by ID."""
        from taskman.server.models.goal import Goal
        from taskman.shared.exceptions import GoalNotFoundException
        goal_file = self.goals_dir / f"{goal_id}.json"

        if not goal_file.exists():
            raise GoalNotFoundException(f"Goal {goal_id} not found")

        with open(goal_file, 'r') as f:
            data = json.load(f)
            return Goal(**data)

    def list_goals(self, status: Optional[str] = None,
                   time_horizon: Optional[str] = None,
                   category: Optional[str] = None) -> List['Goal']:
        """List all goals with optional filters."""
        from taskman.server.models.goal import Goal
        goals = []

        for goal_file in self.goals_dir.glob("*.json"):
            with open(goal_file, 'r') as f:
                data = json.load(f)
                goal = Goal(**data)

                # Apply filters
                if status and goal.status.value != status:
                    continue
                if time_horizon and goal.time_horizon.value != time_horizon:
                    continue
                if category and goal.category.value != category:
                    continue

                goals.append(goal)

        # Sort by created_at descending
        goals.sort(key=lambda x: x.created_at, reverse=True)
        return goals

    def delete_goal(self, goal_id: str) -> bool:
        """Delete a goal."""
        from taskman.shared.exceptions import GoalNotFoundException
        goal_file = self.goals_dir / f"{goal_id}.json"

        if not goal_file.exists():
            raise GoalNotFoundException(f"Goal {goal_id} not found")

        goal_file.unlink()
        return True

    def calculate_goal_progress(self, goal_id: str) -> float:
        """Calculate goal progress based on linked projects."""
        goal = self.get_goal(goal_id)

        if not goal.linked_project_ids:
            return 0.0

        total_tasks = 0
        completed_tasks = 0

        for project_id in goal.linked_project_ids:
            try:
                project_tasks = self.list_tasks(project_id=project_id)
                for task in project_tasks:
                    total_tasks += 1
                    if task.status == 'completed':
                        completed_tasks += 1
            except:
                continue

        if total_tasks == 0:
            return 0.0

        return round((completed_tasks / total_tasks) * 100, 1)

    # ========================================================================
    # NOTE OPERATIONS (File-based markdown with YAML frontmatter)
    # ========================================================================

    def _get_notes_dir(self) -> Path:
        """Get the notes directory, creating if needed."""
        notes_dir = self.data_dir / "notes"
        notes_dir.mkdir(parents=True, exist_ok=True)
        return notes_dir

    def _parse_note_file(self, file_path: Path) -> 'Note':
        """Parse a markdown file with YAML frontmatter into a Note object."""
        import yaml
        from taskman.server.models.note import Note

        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Parse YAML frontmatter
        if content.startswith('---'):
            parts = content.split('---', 2)
            if len(parts) >= 3:
                frontmatter = yaml.safe_load(parts[1])
                markdown_content = parts[2].strip()
            else:
                frontmatter = {}
                markdown_content = content
        else:
            frontmatter = {}
            markdown_content = content

        # Build note from frontmatter
        return Note(
            id=frontmatter.get('id', file_path.stem),
            title=frontmatter.get('title', file_path.stem),
            content=markdown_content,
            folder_path=frontmatter.get('folder_path', ''),
            linked_task_ids=frontmatter.get('linked_task_ids', []),
            linked_project_ids=frontmatter.get('linked_project_ids', []),
            linked_habit_ids=frontmatter.get('linked_habit_ids', []),
            linked_goal_ids=frontmatter.get('linked_goal_ids', []),
            is_daily_note=frontmatter.get('is_daily_note', False),
            date=frontmatter.get('date'),
            tags=frontmatter.get('tags', []),
            created_at=datetime.fromisoformat(frontmatter['created_at']) if 'created_at' in frontmatter else datetime.now(),
            updated_at=datetime.fromisoformat(frontmatter['updated_at']) if 'updated_at' in frontmatter else datetime.now(),
        )

    def _write_note_file(self, note: 'Note', file_path: Path):
        """Write a Note to a markdown file with YAML frontmatter."""
        import yaml

        # Ensure directory exists
        file_path.parent.mkdir(parents=True, exist_ok=True)

        # Build frontmatter
        frontmatter = note.to_frontmatter_dict()

        # Write file
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('---\n')
            yaml.dump(frontmatter, f, default_flow_style=False, allow_unicode=True)
            f.write('---\n\n')
            f.write(note.content)

    def save_note(self, note: 'Note'):
        """Save a note to a markdown file."""
        notes_dir = self._get_notes_dir()

        # Determine file path
        if note.folder_path:
            folder = notes_dir / note.folder_path
        else:
            folder = notes_dir

        # Sanitize filename
        safe_title = note.title.replace("/", "-").replace("\\", "-")
        safe_title = "".join(c for c in safe_title if c.isalnum() or c in " -_").strip()
        file_path = folder / f"{safe_title}.md"

        self._write_note_file(note, file_path)

    def get_note(self, note_id: str) -> 'Note':
        """Get a note by ID (searches all notes)."""
        from taskman.shared.exceptions import NoteNotFoundException

        notes_dir = self._get_notes_dir()

        # Search all markdown files
        for md_file in notes_dir.rglob("*.md"):
            try:
                note = self._parse_note_file(md_file)
                if note.id == note_id:
                    return note
            except:
                continue

        raise NoteNotFoundException(f"Note {note_id} not found")

    def get_note_by_path(self, path: str) -> 'Note':
        """Get a note by its file path."""
        from taskman.shared.exceptions import NoteNotFoundException

        notes_dir = self._get_notes_dir()
        file_path = notes_dir / path

        if not file_path.exists():
            raise NoteNotFoundException(f"Note not found at path: {path}")

        return self._parse_note_file(file_path)

    def list_notes(self, folder_path: Optional[str] = None, is_daily_note: Optional[bool] = None) -> List['Note']:
        """List all notes, optionally filtered by folder or daily note status."""
        notes_dir = self._get_notes_dir()
        notes = []

        # Determine search directory
        if folder_path:
            search_dir = notes_dir / folder_path
        else:
            search_dir = notes_dir

        if not search_dir.exists():
            return []

        # Find all markdown files
        for md_file in search_dir.rglob("*.md"):
            try:
                note = self._parse_note_file(md_file)

                # Apply filters
                if is_daily_note is not None and note.is_daily_note != is_daily_note:
                    continue

                notes.append(note)
            except:
                continue

        # Sort by updated_at descending
        notes.sort(key=lambda x: x.updated_at, reverse=True)
        return notes

    def delete_note(self, note_id: str) -> bool:
        """Delete a note by ID."""
        from taskman.shared.exceptions import NoteNotFoundException

        notes_dir = self._get_notes_dir()

        # Find the note file
        for md_file in notes_dir.rglob("*.md"):
            try:
                note = self._parse_note_file(md_file)
                if note.id == note_id:
                    md_file.unlink()
                    return True
            except:
                continue

        raise NoteNotFoundException(f"Note {note_id} not found")

    def get_daily_note(self, target_date: date) -> Optional['Note']:
        """Get or create a daily note for a specific date."""
        notes = self.list_notes(is_daily_note=True)

        date_str = target_date.isoformat()
        for note in notes:
            if note.date == date_str:
                return note

        return None

    def list_folders(self) -> List['Folder']:
        """List all folders in the notes directory."""
        from taskman.server.models.note import Folder

        notes_dir = self._get_notes_dir()
        folders = []

        def scan_folder(path: Path, relative_path: str = "") -> Folder:
            name = path.name if relative_path else "notes"
            folder = Folder(name=name, path=relative_path)

            # Count notes in this folder
            folder.note_count = len(list(path.glob("*.md")))

            # Scan subfolders
            for subdir in path.iterdir():
                if subdir.is_dir() and not subdir.name.startswith('.'):
                    sub_relative = f"{relative_path}/{subdir.name}" if relative_path else subdir.name
                    folder.subfolders.append(scan_folder(subdir, sub_relative))

            return folder

        root_folder = scan_folder(notes_dir)
        return [root_folder]

    def create_folder(self, folder_path: str):
        """Create a new folder in the notes directory."""
        notes_dir = self._get_notes_dir()
        new_folder = notes_dir / folder_path
        new_folder.mkdir(parents=True, exist_ok=True)

    def delete_folder(self, folder_path: str, recursive: bool = False):
        """Delete a folder from the notes directory."""
        from taskman.shared.exceptions import FolderNotFoundException
        import shutil

        notes_dir = self._get_notes_dir()
        folder = notes_dir / folder_path

        if not folder.exists():
            raise FolderNotFoundException(f"Folder {folder_path} not found")

        if recursive:
            shutil.rmtree(folder)
        else:
            # Only delete if empty
            if any(folder.iterdir()):
                raise ValueError(f"Folder {folder_path} is not empty. Use recursive=True to delete.")
            folder.rmdir()

    def search_notes(self, query: str) -> List['Note']:
        """Search notes by title and content."""
        notes = self.list_notes()
        query_lower = query.lower()

        results = []
        for note in notes:
            if query_lower in note.title.lower() or query_lower in note.content.lower():
                results.append(note)

        return results

    # ========================================================================
    # REVIEW OPERATIONS
    # ========================================================================

    def _get_reviews_dir(self) -> Path:
        """Get the reviews directory, creating if needed."""
        reviews_dir = self.data_dir / "reviews"
        reviews_dir.mkdir(parents=True, exist_ok=True)
        return reviews_dir

    def save_review(self, review: 'Review'):
        """Save a review to JSON file."""
        from taskman.server.models.review import Review

        reviews_dir = self._get_reviews_dir()

        # Create subdirectory based on type
        type_dir = reviews_dir / review.review_type.value
        type_dir.mkdir(parents=True, exist_ok=True)

        # Generate filename from period key
        period_key = Review.get_period_key(review.review_type, date.fromisoformat(review.date))
        review_file = type_dir / f"{period_key}.json"

        with open(review_file, 'w') as f:
            json.dump(review.dict(), f, indent=2, default=str)

    def get_review(self, review_type: str, period_key: str) -> 'Review':
        """Get a review by type and period key."""
        from taskman.server.models.review import Review, ReviewType
        from taskman.shared.exceptions import ReviewNotFoundException

        reviews_dir = self._get_reviews_dir()
        review_file = reviews_dir / review_type / f"{period_key}.json"

        if not review_file.exists():
            raise ReviewNotFoundException(f"Review {review_type}/{period_key} not found")

        with open(review_file, 'r') as f:
            data = json.load(f)
            return Review(**data)

    def list_reviews(self, review_type: Optional[str] = None, limit: int = 50) -> List['Review']:
        """List reviews, optionally filtered by type."""
        from taskman.server.models.review import Review

        reviews_dir = self._get_reviews_dir()
        reviews = []

        if review_type:
            type_dirs = [reviews_dir / review_type]
        else:
            type_dirs = [d for d in reviews_dir.iterdir() if d.is_dir()]

        for type_dir in type_dirs:
            if not type_dir.exists():
                continue

            for review_file in type_dir.glob("*.json"):
                try:
                    with open(review_file, 'r') as f:
                        data = json.load(f)
                        reviews.append(Review(**data))
                except:
                    continue

        # Sort by date descending
        reviews.sort(key=lambda x: x.date, reverse=True)
        return reviews[:limit]

    def delete_review(self, review_type: str, period_key: str) -> bool:
        """Delete a review."""
        from taskman.shared.exceptions import ReviewNotFoundException

        reviews_dir = self._get_reviews_dir()
        review_file = reviews_dir / review_type / f"{period_key}.json"

        if not review_file.exists():
            raise ReviewNotFoundException(f"Review {review_type}/{period_key} not found")

        review_file.unlink()
        return True