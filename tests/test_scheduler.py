import pytest
from datetime import date, datetime
from taskman.server.services.storage import StorageManager
from taskman.server.services.scheduler import Scheduler
from taskman.server.models.task import Task, TaskCreate
from taskman.server.models.project import Project
from taskman.server.models.user_preferences import UserPreferences
from taskman.shared.constants import EnergyLevel, TaskStatus

def test_scheduler_basic(tmp_path):
    """Test basic scheduling functionality"""
    storage = StorageManager(str(tmp_path / "data"))
    scheduler = Scheduler(storage)
    
    # Create a project
    project = Project(
        id="proj123",
        name="Test Project",
        priority=1,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    storage.save_project(project)
    
    # Create tasks
    task1 = Task(
        id="task001",
        project_id="proj123",
        title="High energy task",
        priority=1,
        difficulty=5,
        energy_level=EnergyLevel.HIGH,
        estimated_minutes=120,
        status=TaskStatus.TODO,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    task2 = Task(
        id="task002",
        project_id="proj123",
        title="Low energy task",
        priority=3,
        difficulty=1,
        energy_level=EnergyLevel.LOW,
        estimated_minutes=30,
        status=TaskStatus.TODO,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    storage.save_task(task1)
    storage.save_task(task2)
    
    # Generate schedule
    preferences = UserPreferences()
    target_date = date.today()
    schedule = scheduler.generate_schedule(target_date, preferences)
    
    # Verify schedule was created
    assert schedule is not None
    assert schedule.date == target_date
    assert len(schedule.scheduled_tasks) > 0
    
    # Verify high energy task is scheduled in the morning
    high_task_scheduled = None
    for st in schedule.scheduled_tasks:
        if st.task_id == "task001":
            high_task_scheduled = st
            break
    
    assert high_task_scheduled is not None
    # Task should be scheduled before noon
    hour = int(high_task_scheduled.start_time.split(':')[0])
    assert hour < 12

def test_dependency_resolution(tmp_path):
    """Test that dependencies are respected in scheduling"""
    storage = StorageManager(str(tmp_path / "data"))
    scheduler = Scheduler(storage)
    
    project = Project(
        id="proj456",
        name="Test Project",
        priority=1,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    storage.save_project(project)
    
    # Create tasks with dependency
    task1 = Task(
        id="task010",
        project_id="proj456",
        title="Prerequisite task",
        priority=1,
        difficulty=3,
        energy_level=EnergyLevel.MEDIUM,
        estimated_minutes=60,
        status=TaskStatus.TODO,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    task2 = Task(
        id="task011",
        project_id="proj456",
        title="Dependent task",
        priority=1,
        difficulty=3,
        energy_level=EnergyLevel.MEDIUM,
        estimated_minutes=60,
        status=TaskStatus.TODO,
        dependencies=["task010"],  # Depends on task1
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    storage.save_task(task1)
    storage.save_task(task2)
    
    # Generate schedule - task2 should not be scheduled since task1 is not complete
    preferences = UserPreferences()
    schedule = scheduler.generate_schedule(date.today(), preferences)
    
    # task2 should not be in the schedule
    task2_scheduled = any(st.task_id == "task011" for st in schedule.scheduled_tasks)
    assert not task2_scheduled or task2.status == TaskStatus.BLOCKED

def test_estimation_factors(tmp_path):
    """Test that estimation factors are calculated correctly"""
    storage = StorageManager(str(tmp_path / "data"))
    
    project = Project(
        id="proj789",
        name="Test Project",
        priority=1,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    storage.save_project(project)
    
    # Create and complete tasks to build history
    for i in range(5):
        task = Task(
            id=f"task{i:03d}",
            project_id="proj789",
            title=f"Task {i}",
            priority=1,
            difficulty=3,
            energy_level=EnergyLevel.MEDIUM,
            estimated_minutes=60,
            actual_minutes=75,  # Consistently 25% over
            status=TaskStatus.COMPLETED,
            completed_at=datetime.now(),
            tags={"type": "coding"},
            created_at=datetime.now(),
            updated_at=datetime.now()
        )
        storage.save_task(task)
        storage.record_task_completion(task)
    
    # Get estimation factor
    factor = storage.get_estimation_factors(
        project_id="proj789",
        task_type="coding",
        difficulty=3
    )
    
    # Factor should be around 1.25 (75/60)
    assert 1.2 <= factor <= 1.3