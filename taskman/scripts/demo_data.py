"""Generate demo data for testing"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from taskman.server.services.storage import StorageManager
from taskman.server.services.scheduler import Scheduler
from taskman.server.models.project import Project
from taskman.server.models.task import Task
from taskman.server.models.user_preferences import UserPreferences
from taskman.shared.constants import EnergyLevel, TaskStatus
from datetime import datetime, date

def create_demo_data():
    """Create demo projects and tasks"""
    storage = StorageManager()
    scheduler = Scheduler(storage)
    
    print("🎬 Creating demo data...")
    
    # Create projects
    projects_data = [
        {
            "id": "research1",
            "name": "Neural Networks Research Paper",
            "priority": 1,
            "tags": {"type": "research", "deadline": "2025-12-31", "collaborator": "Dr. Smith"}
        },
        {
            "id": "client1",
            "name": "Client Website Project",
            "priority": 2,
            "tags": {"type": "client_work", "client": "Acme Corp", "deadline": "2025-11-15"}
        },
        {
            "id": "infra1",
            "name": "Infrastructure Improvements",
            "priority": 3,
            "tags": {"type": "internal", "area": "devops"}
        }
    ]
    
    for proj_data in projects_data:
        project = Project(
            id=proj_data["id"],
            name=proj_data["name"],
            priority=proj_data["priority"],
            tags=proj_data["tags"],
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        storage.save_project(project)
        print(f"  ✅ Created project: {project.name}")
    
    # Create tasks for research project
    research_tasks = [
        {
            "id": "task001",
            "title": "Literature review of recent papers",
            "difficulty": 4,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 180,
            "priority": 1,
            "tags": {"type": "research", "phase": "background"}
        },
        {
            "id": "task002",
            "title": "Design experimental setup",
            "difficulty": 5,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 120,
            "priority": 1,
            "tags": {"type": "research", "phase": "planning"}
        },
        {
            "id": "task003",
            "title": "Implement baseline model",
            "difficulty": 4,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 240,
            "priority": 2,
            "tags": {"type": "coding", "phase": "implementation"}
        },
        {
            "id": "task004",
            "title": "Run experiments",
            "difficulty": 3,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 180,
            "priority": 2,
            "tags": {"type": "research", "phase": "execution"}
        },
        {
            "id": "task005",
            "title": "Analyze results",
            "difficulty": 4,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 150,
            "priority": 1,
            "tags": {"type": "research", "phase": "analysis"}
        },
        {
            "id": "task006",
            "title": "Write paper draft",
            "difficulty": 5,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 360,
            "priority": 1,
            "tags": {"type": "writing", "phase": "documentation"}
        },
        {
            "id": "task007",
            "title": "Update bibliography",
            "difficulty": 1,
            "energy_level": EnergyLevel.LOW,
            "estimated_minutes": 30,
            "priority": 3,
            "tags": {"type": "admin", "phase": "documentation"}
        }
    ]
    
    for task_data in research_tasks:
        task = Task(
            id=task_data["id"],
            project_id="research1",
            title=task_data["title"],
            difficulty=task_data["difficulty"],
            energy_level=task_data["energy_level"],
            estimated_minutes=task_data["estimated_minutes"],
            priority=task_data["priority"],
            tags=task_data["tags"],
            status=TaskStatus.TODO,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        storage.save_task(task)
    
    print(f"  ✅ Created {len(research_tasks)} tasks for research project")
    
    # Create tasks for client project
    client_tasks = [
        {
            "id": "task101",
            "title": "Initial client meeting",
            "difficulty": 2,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 60,
            "priority": 1,
            "tags": {"type": "meeting", "phase": "discovery"}
        },
        {
            "id": "task102",
            "title": "Design mockups",
            "difficulty": 3,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 180,
            "priority": 1,
            "tags": {"type": "design", "phase": "planning"}
        },
        {
            "id": "task103",
            "title": "Implement frontend",
            "difficulty": 4,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 360,
            "priority": 2,
            "tags": {"type": "coding", "phase": "implementation"}
        },
        {
            "id": "task104",
            "title": "Backend API integration",
            "difficulty": 4,
            "energy_level": EnergyLevel.HIGH,
            "estimated_minutes": 240,
            "priority": 2,
            "tags": {"type": "coding", "phase": "implementation"}
        },
        {
            "id": "task105",
            "title": "Testing and QA",
            "difficulty": 3,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 120,
            "priority": 2,
            "tags": {"type": "testing", "phase": "qa"}
        },
        {
            "id": "task106",
            "title": "Client demo",
            "difficulty": 2,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 60,
            "priority": 1,
            "tags": {"type": "meeting", "phase": "delivery"}
        }
    ]
    
    for task_data in client_tasks:
        task = Task(
            id=task_data["id"],
            project_id="client1",
            title=task_data["title"],
            difficulty=task_data["difficulty"],
            energy_level=task_data["energy_level"],
            estimated_minutes=task_data["estimated_minutes"],
            priority=task_data["priority"],
            tags=task_data["tags"],
            status=TaskStatus.TODO,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        storage.save_task(task)
    
    print(f"  ✅ Created {len(client_tasks)} tasks for client project")
    
    # Create tasks for infrastructure project
    infra_tasks = [
        {
            "id": "task201",
            "title": "Update server dependencies",
            "difficulty": 2,
            "energy_level": EnergyLevel.LOW,
            "estimated_minutes": 45,
            "priority": 3,
            "tags": {"type": "maintenance", "area": "backend"}
        },
        {
            "id": "task202",
            "title": "Set up monitoring",
            "difficulty": 3,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 120,
            "priority": 2,
            "tags": {"type": "infrastructure", "area": "devops"}
        },
        {
            "id": "task203",
            "title": "Database backup automation",
            "difficulty": 3,
            "energy_level": EnergyLevel.MEDIUM,
            "estimated_minutes": 90,
            "priority": 2,
            "tags": {"type": "infrastructure", "area": "database"}
        }
    ]
    
    for task_data in infra_tasks:
        task = Task(
            id=task_data["id"],
            project_id="infra1",
            title=task_data["title"],
            difficulty=task_data["difficulty"],
            energy_level=task_data["energy_level"],
            estimated_minutes=task_data["estimated_minutes"],
            priority=task_data["priority"],
            tags=task_data["tags"],
            status=TaskStatus.TODO,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        storage.save_task(task)
    
    print(f"  ✅ Created {len(infra_tasks)} tasks for infrastructure project")
    
    # Generate schedule for next 7 days
    print("\n📅 Generating schedules for next 7 days...")
    preferences = storage.get_preferences()
    
    for i in range(7):
        target_date = date.today()
        if i > 0:
            target_date = date.fromordinal(target_date.toordinal() + i)
        schedule = scheduler.generate_schedule(target_date, preferences, force=True)
        print(f"  ✅ Generated schedule for {target_date}")
    
    print("\n🎉 Demo data created successfully!")
    print("\nNext steps:")
    print("  1. View projects: task project list")
    print("  2. View tasks: task list")
    print("  3. View schedule: task schedule today")
    print("  4. Complete a task: task complete <task-id> --actual-time <minutes>")

if __name__ == "__main__":
    create_demo_data()