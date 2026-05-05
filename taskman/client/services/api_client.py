"""
API Client for TaskMan
Fixed to handle project lookups by name
"""
import requests
from typing import Dict, List, Optional

class APIClient:
    def __init__(self, base_url: str = "http://localhost:3000"):
        self.base_url = base_url.rstrip('/')
        
    def _get(self, endpoint: str, params: Optional[Dict] = None) -> Dict:
        """Make GET request"""
        url = f"{self.base_url}{endpoint}"
        response = requests.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    def _post(self, endpoint: str, data: Dict) -> Dict:
        """Make POST request"""
        url = f"{self.base_url}{endpoint}"
        response = requests.post(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def _put(self, endpoint: str, data: Dict) -> Dict:
        """Make PUT request"""
        url = f"{self.base_url}{endpoint}"
        response = requests.put(url, json=data)
        response.raise_for_status()
        return response.json()
    
    def _delete(self, endpoint: str) -> Dict:
        """Make DELETE request"""
        url = f"{self.base_url}{endpoint}"
        response = requests.delete(url)
        response.raise_for_status()
        return response.json()
    
    # Projects
    def create_project(self, data: Dict) -> Dict:
        """Create a new project"""
        return self._post("/api/projects/", data)
    
    def list_projects(self, status: Optional[str] = None) -> List[Dict]:
        """List all projects"""
        params = {"status": status} if status else {}
        return self._get("/api/projects/", params)
    
    def get_project(self, project_id: str) -> Dict:
        """Get project by ID"""
        return self._get(f"/api/projects/{project_id}")
    
    def find_project_by_name(self, name: str) -> Optional[Dict]:
        """Find project by name (exact or partial match)"""
        projects = self.list_projects()
        
        # Try exact match first
        for project in projects:
            if project['name'].lower() == name.lower():
                return project
        
        # Try partial match
        matches = [p for p in projects if name.lower() in p['name'].lower()]
        
        if len(matches) == 1:
            return matches[0]
        elif len(matches) > 1:
            raise ValueError(f"Multiple projects match '{name}': {[p['name'] for p in matches]}")
        
        return None
    
    def update_project(self, project_id: str, data: Dict) -> Dict:
        """Update a project"""
        return self._put(f"/api/projects/{project_id}", data)
    
    def delete_project(self, project_id: str) -> Dict:
        """Delete a project"""
        return self._delete(f"/api/projects/{project_id}")
    
    # Tasks
    def create_task(self, data: Dict) -> Dict:
        """Create a new task"""
        return self._post("/api/tasks/", data)
    
    def list_tasks(self, project_id: Optional[str] = None, 
                   status: Optional[str] = None) -> List[Dict]:
        """List all tasks"""
        params = {}
        if project_id:
            params["project_id"] = project_id
        if status:
            params["status"] = status
        return self._get("/api/tasks/", params)
    
    def get_task(self, task_id: str) -> Dict:
        """Get task by ID"""
        return self._get(f"/api/tasks/{task_id}")
    
    def update_task(self, task_id: str, data: Dict) -> Dict:
        """Update a task"""
        return self._put(f"/api/tasks/{task_id}", data)
    
    def delete_task(self, task_id: str) -> Dict:
        """Delete a task"""
        return self._delete(f"/api/tasks/{task_id}")

    def add_dependency(self, task_id: str, dependency_id: str) -> Dict:
        """Add a dependency to a task"""
        return self._post(f"/api/tasks/{task_id}/dependencies?dependency_id={dependency_id}", {})

    def remove_dependency(self, task_id: str, dependency_id: str) -> Dict:
        """Remove a dependency from a task"""
        return self._delete(f"/api/tasks/{task_id}/dependencies/{dependency_id}")

    def complete_task(self, task_id: str, actual_minutes: Optional[int] = None) -> Dict:
        """Mark task as complete"""
        params = {}
        if actual_minutes is not None:
            params["actual_minutes"] = actual_minutes
        return self._post(f"/api/tasks/{task_id}/complete", params)
    
    # Schedules
    def generate_schedule(self, target_date: Optional[str] = None, 
                         days: int = 1, force: bool = False) -> Dict:
        """Generate schedule"""
        params = {"days": days, "force": force}
        if target_date:
            params["target_date"] = target_date
        return self._post("/api/schedule/generate", params)
    
    def get_today_schedule(self) -> Dict:
        """Get today's schedule"""
        return self._get("/api/schedule/today")
    
    def get_schedule(self, schedule_date: str) -> Dict:
        """Get schedule for a specific date"""
        return self._get(f"/api/schedule/{schedule_date}")
    
    def reschedule(self, target_date: Optional[str] = None,
                   days: Optional[int] = None,
                   reschedule_all: bool = False) -> Dict:
        """Reschedule incomplete tasks

        Args:
            target_date: Start date (YYYY-MM-DD), defaults to today
            days: Number of days to reschedule
            reschedule_all: If True, calculate days needed for all tasks
        """
        params = {}
        if target_date:
            params["target_date"] = target_date
        if days:
            params["days"] = days
        if reschedule_all:
            params["reschedule_all"] = True
        return self._post("/api/schedule/reschedule", params)
    
    # Preferences
    def get_preferences(self) -> Dict:
        """Get user preferences"""
        return self._get("/api/preferences/")

    # Habit Instances
    def get_habit_instance(self, habit_id: str, date: str) -> Optional[Dict]:
        """Get habit instance for a specific date"""
        try:
            return self._get(f"/api/habits/{habit_id}/instances/{date}")
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                return None
            raise

    def set_habit_instance(self, habit_id: str, date: str,
                           instance_detail: str, notes: Optional[str] = None) -> Dict:
        """Set or update habit instance for a specific date"""
        data = {"instance_detail": instance_detail}
        if notes:
            data["notes"] = notes
        return self._put(f"/api/habits/{habit_id}/instances/{date}", data)

    def delete_habit_instance(self, habit_id: str, date: str) -> Dict:
        """Delete habit instance"""
        return self._delete(f"/api/habits/{habit_id}/instances/{date}")

    def list_habit_instances(self, habit_id: str,
                              start_date: Optional[str] = None,
                              end_date: Optional[str] = None) -> List[Dict]:
        """List habit instances for a habit"""
        params = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        return self._get(f"/api/habits/{habit_id}/instances", params)

    # Generic methods for direct API access (used by CLI commands)
    def get(self, endpoint: str, params: Optional[Dict] = None):
        """Generic GET request"""
        return self._get(f"/api{endpoint}", params)

    def post(self, endpoint: str, data: Dict = None, params: Optional[Dict] = None):
        """Generic POST request"""
        url = f"{self.base_url}/api{endpoint}"
        response = requests.post(url, json=data, params=params)
        response.raise_for_status()
        return response.json()

    def put(self, endpoint: str, data: Dict):
        """Generic PUT request"""
        return self._put(f"/api{endpoint}", data)

    def delete(self, endpoint: str):
        """Generic DELETE request"""
        return self._delete(f"/api{endpoint}")

    # Export
    def export_data(self, options: Optional[Dict] = None) -> Dict:
        """Export data (projects, tasks, habits, schedules)"""
        return self._post("/api/export/", options or {})

    # Upcoming schedules and unscheduled tasks
    def get_upcoming_schedules(self, days: int = 60) -> Dict:
        """Get upcoming schedules and identify unscheduled tasks/habits"""
        return self._get("/api/schedule/upcoming", {"days": days})

    # Analytics
    def get_habit_stats(self, habit_id: str, days: int = 30) -> Dict:
        """Get habit statistics"""
        return self._get(f"/api/analytics/habits/{habit_id}", {"days": days})

    def get_analytics_summary(self, days: int = 30) -> Dict:
        """Get overall analytics summary"""
        return self._get("/api/analytics/summary", {"days": days})