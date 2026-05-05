# taskman/server/utils/logger.py
import logging
from pathlib import Path

def setup_logger(name: str) -> logging.Logger:
    """Setup logger with consistent formatting"""
    logger = logging.getLogger(name)
    
    if not logger.handlers:
        # Create logs directory
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)
        
        # File handler
        file_handler = logging.FileHandler(log_dir / "server.log")
        file_handler.setLevel(logging.DEBUG)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # Formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)
        
        logger.addHandler(file_handler)
        logger.addHandler(console_handler)
        logger.setLevel(logging.DEBUG)
    
    return logger

# taskman/server/services/backup_manager.py
import tarfile
import json
import hashlib
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

from taskman.server.utils.logger import setup_logger

logger = setup_logger(__name__)

class BackupManager:
    """Manage backups of all data"""
    
    def __init__(self, storage_manager):
        self.storage = storage_manager
        self.backup_dir = Path("data/backups")
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.max_backups = 30
    
    def create_backup(self, label: Optional[str] = None, auto: bool = False) -> Dict:
        """Create a backup of all data"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"backup_{timestamp}"
        backup_file = self.backup_dir / f"{backup_name}.tar.gz"
        
        try:
            with tarfile.open(backup_file, 'w:gz') as tar:
                # Add data directories
                for data_path in ['projects', 'tasks', 'schedules']:
                    full_path = Path('data') / data_path
                    if full_path.exists():
                        tar.add(full_path, arcname=f"data/{data_path}")
                
                # Add individual files
                for file_name in ['inbox.json', 'templates.json', 'user_preferences.json', 'database.db']:
                    file_path = Path('data') / file_name
                    if file_path.exists():
                        tar.add(file_path, arcname=f"data/{file_name}")
                
                # Add config files
                config_dir = Path('config')
                if config_dir.exists():
                    tar.add(config_dir, arcname='config')
                
                # Create metadata
                metadata = {
                    'backup_id': backup_name,
                    'created_at': datetime.now().isoformat(),
                    'version': '0.1.0',
                    'file_count': len(tar.getnames()),
                    'total_size_bytes': backup_file.stat().st_size if backup_file.exists() else 0,
                    'integrity_hash': self._calculate_hash(backup_file),
                    'label': label,
                    'auto_backup': auto
                }
                
                # Add metadata to archive
                metadata_str = json.dumps(metadata, indent=2)
                metadata_info = tarfile.TarInfo('backup_metadata.json')
                metadata_info.size = len(metadata_str)
                tar.addfile(metadata_info, fileobj=io.BytesIO(metadata_str.encode()))
            
            logger.info(f"Created backup: {backup_name}")
            
            # Rotate old backups
            self._rotate_backups()
            
            return metadata
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            raise
    
    def list_backups(self) -> List[Dict]:
        """List all available backups"""
        backups = []
        
        for backup_file in sorted(self.backup_dir.glob("backup_*.tar.gz"), reverse=True):
            try:
                with tarfile.open(backup_file, 'r:gz') as tar:
                    # Extract metadata if exists
                    try:
                        metadata_file = tar.extractfile('backup_metadata.json')
                        if metadata_file:
                            metadata = json.loads(metadata_file.read().decode())
                            backups.append(metadata)
                    except KeyError:
                        # Old backup without metadata
                        backups.append({
                            'backup_id': backup_file.stem,
                            'created_at': datetime.fromtimestamp(
                                backup_file.stat().st_mtime
                            ).isoformat(),
                            'size_bytes': backup_file.stat().st_size
                        })
            except Exception as e:
                logger.warning(f"Could not read backup {backup_file}: {e}")
        
        return backups
    
    def restore_backup(self, backup_id: str) -> bool:
        """Restore from a backup"""
        backup_file = self.backup_dir / f"{backup_id}.tar.gz"
        
        if not backup_file.exists():
            logger.error(f"Backup not found: {backup_id}")
            return False
        
        try:
            # Create restore point before restoring
            self.create_backup(label=f"Before restore from {backup_id}")
            
            # Extract backup
            with tarfile.open(backup_file, 'r:gz') as tar:
                tar.extractall('.')
            
            logger.info(f"Restored from backup: {backup_id}")
            
            # Sync SQLite from restored JSON
            self.storage.sync_from_json()
            
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def _calculate_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file"""
        if not file_path.exists():
            return ""
        
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _rotate_backups(self):
        """Remove old backups beyond max_backups limit"""
        backups = sorted(self.backup_dir.glob("backup_*.tar.gz"))
        
        if len(backups) > self.max_backups:
            for backup in backups[:-self.max_backups]:
                backup.unlink()
                logger.info(f"Removed old backup: {backup.name}")

# taskman/client/utils/formatters.py
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree
from rich.console import Group
from rich import box
from datetime import datetime, timedelta

def format_project(project: dict, detailed: bool = False) -> Panel:
    """Format project for display"""
    content = []
    
    priority_colors = {1: "red", 2: "yellow", 3: "white", 4: "blue", 5: "dim"}
    status_colors = {
        'active': 'green', 'paused': 'yellow', 
        'completed': 'blue', 'archived': 'dim'
    }
    
    content.append(f"[cyan]ID:[/cyan] {project['id']}")
    content.append(f"[cyan]Name:[/cyan] {project['name']}")
    
    priority_color = priority_colors.get(project['priority'], 'white')
    content.append(f"[cyan]Priority:[/cyan] [{priority_color}]{project['priority']}[/{priority_color}]")
    
    status_color = status_colors.get(project['status'], 'white')
    content.append(f"[cyan]Status:[/cyan] [{status_color}]{project['status']}[/{status_color}]")
    
    if detailed:
        if project.get('description'):
            content.append(f"\n[cyan]Description:[/cyan]\n{project['description']}")
        
        if project.get('tags'):
            tags_str = ", ".join(f"{k}={v}" for k, v in project['tags'].items())
            content.append(f"\n[cyan]Tags:[/cyan] {tags_str}")
        
        content.append(f"\n[cyan]Created:[/cyan] {project['created_at']}")
        content.append(f"[cyan]Updated:[/cyan] {project['updated_at']}")
    
    return Panel(
        "\n".join(content),
        title=f"Project: {project['name']}",
        border_style="cyan"
    )

def format_task(task: dict) -> Panel:
    """Format task for display"""
    content = []
    
    content.append(f"[cyan]ID:[/cyan] {task['id']}")
    content.append(f"[cyan]Title:[/cyan] {task['title']}")
    content.append(f"[cyan]Project:[/cyan] {task['project_id']}")
    
    energy_colors = {'high': 'red', 'medium': 'yellow', 'low': 'green'}
    energy_color = energy_colors.get(task['energy_level'], 'white')
    content.append(f"[cyan]Energy:[/cyan] [{energy_color}]{task['energy_level']}[/{energy_color}]")
    
    content.append(f"[cyan]Priority:[/cyan] {task['priority']}")
    content.append(f"[cyan]Difficulty:[/cyan] {task['difficulty']}")
    content.append(f"[cyan]Estimated:[/cyan] {task['estimated_minutes']} minutes")
    
    status_colors = {
        'todo': 'white', 'in_progress': 'yellow',
        'completed': 'green', 'blocked': 'red'
    }
    status_color = status_colors.get(task['status'], 'white')
    content.append(f"[cyan]Status:[/cyan] [{status_color}]{task['status']}[/{status_color}]")
    
    if task.get('description'):
        content.append(f"\n[cyan]Description:[/cyan]\n{task['description']}")
    
    if task.get('tags'):
        tags_str = ", ".join(f"{k}={v}" for k, v in task['tags'].items())
        content.append(f"\n[cyan]Tags:[/cyan] {tags_str}")
    
    return Panel(
        "\n".join(content),
        title=f"Task: {task['title']}",
        border_style="cyan"
    )

def format_schedule(schedule: dict, detailed: bool = False, summary: bool = False) -> Panel:
    """Format schedule for display"""
    if summary:
        summary_data = schedule.get('summary', {})
        content = []
        content.append(f"Date: {schedule['date']}")
        content.append(f"Tasks: {summary_data.get('tasks_remaining', 0)}")
        content.append(f"Time: {summary_data.get('total_scheduled_minutes', 0)} minutes")
        
        return Panel(
            "\n".join(content),
            title=f"Schedule Summary - {schedule['date']}",
            border_style="blue"
        )
    
    if detailed:
        table = Table(title=f"Schedule for {schedule['date']}", box=box.ROUNDED)
        table.add_column("Time", style="cyan", no_wrap=True)
        table.add_column("Task", style="white")
        table.add_column("Duration", justify="right")
        table.add_column("Status", justify="center")
        
        for task in schedule.get('scheduled_tasks', []):
            if task.get('is_buffer'):
                table.add_row(
                    f"{task['start_time']}-{task['end_time']}",
                    "[dim]Break[/dim]",
                    f"[dim]{task['estimated_minutes']}m[/dim]",
                    "[dim]—[/dim]"
                )
            else:
                # TODO: Get actual task details
                status = "⏳" if task['task_id'] not in schedule.get('completed_tasks', []) else "✅"
                table.add_row(
                    f"{task['start_time']}-{task['end_time']}",
                    f"Task {task['task_id']}",
                    f"{task['estimated_minutes']}m",
                    status
                )
        
        return Panel(table, border_style="blue")
    
    return Panel("Schedule", border_style="blue")

def format_daily_summary(schedule: dict, date: str) -> Panel:
    """Format daily summary"""
    summary = schedule.get('summary', {})
    
    completion_rate = summary.get('completion_rate', 0)
    completion_color = "green" if completion_rate >= 0.8 else "yellow" if completion_rate >= 0.5 else "red"
    
    content = []
    content.append(f"[bold cyan]Today's Schedule ({date})[/bold cyan]\n")
    content.append(f"📊 [bold]Summary[/bold]")
    content.append(f"  • Tasks scheduled: {summary.get('tasks_remaining', 0)}")
    content.append(f"  • Tasks completed: {summary.get('tasks_completed', 0)}")
    content.append(f"  • Time planned: {summary.get('total_scheduled_minutes', 0)} minutes")
    content.append(f"  • Time actual: {summary.get('total_completed_minutes', 0)} minutes")
    content.append(f"  • Completion rate: [{completion_color}]{completion_rate:.0%}[/{completion_color}]")
    
    if summary.get('tasks_behind_schedule', 0) > 0:
        content.append(f"\n⚠️  [yellow]You're behind schedule by {summary['tasks_behind_schedule']} tasks[/yellow]")
        content.append(f"💡 Suggestion: Run 'task schedule reschedule' to adjust")
    
    return Panel(
        "\n".join(content),
        title="Daily Summary",
        border_style="cyan"
    )

def format_time_remaining(end_time: str) -> str:
    """Format time remaining until end time"""
    now = datetime.now()
    end_hour, end_minute = map(int, end_time.split(':'))
    end = now.replace(hour=end_hour, minute=end_minute, second=0, microsecond=0)
    
    if end < now:
        return "Overdue"
    
    delta = end - now
    minutes = int(delta.total_seconds() / 60)
    hours = minutes // 60
    minutes = minutes % 60
    
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

# Add missing import
import io