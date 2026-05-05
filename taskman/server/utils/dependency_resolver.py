from typing import List, Dict, Set
from taskman.server.models.task import Task
from taskman.shared.exceptions import DependencyCycleError, InvalidDependencyError

class DependencyResolver:
    def __init__(self):
        pass
    
    def validate_dependency(self, task_id: str, dependency_id: str, 
                           all_tasks: List[Task]) -> bool:
        """Validate that adding a dependency won't create a cycle"""
        # Build dependency graph
        graph = self._build_graph(all_tasks)
        
        # Add the new edge
        if task_id not in graph:
            graph[task_id] = set()
        graph[task_id].add(dependency_id)
        
        # Check for cycle
        if self._has_cycle(graph):
            raise DependencyCycleError(
                f"Adding dependency from {task_id} to {dependency_id} would create a cycle"
            )
        
        return True
    
    def _build_graph(self, tasks: List[Task]) -> Dict[str, Set[str]]:
        """Build adjacency list of dependencies"""
        graph = {}
        for task in tasks:
            graph[task.id] = set(task.dependencies)
        return graph
    
    def _has_cycle(self, graph: Dict[str, Set[str]]) -> bool:
        """Detect cycle using DFS"""
        visited = set()
        rec_stack = set()
        
        def dfs(node: str) -> bool:
            visited.add(node)
            rec_stack.add(node)
            
            for neighbor in graph.get(node, set()):
                if neighbor not in visited:
                    if dfs(neighbor):
                        return True
                elif neighbor in rec_stack:
                    return True
            
            rec_stack.remove(node)
            return False
        
        for node in graph:
            if node not in visited:
                if dfs(node):
                    return True
        
        return False
    
    def topological_sort(self, tasks: List[Task]) -> List[Task]:
        """Sort tasks by dependency order using Kahn's algorithm"""
        graph = self._build_graph(tasks)
        task_dict = {t.id: t for t in tasks}
        
        # Calculate in-degree
        in_degree = {task_id: 0 for task_id in graph}
        for task_id in graph:
            for dep in graph[task_id]:
                if dep in in_degree:
                    in_degree[dep] += 1
        
        # Queue of tasks with no dependencies
        queue = [task_id for task_id, degree in in_degree.items() if degree == 0]
        sorted_tasks = []
        
        while queue:
            task_id = queue.pop(0)
            if task_id in task_dict:
                sorted_tasks.append(task_dict[task_id])
            
            # Reduce in-degree for dependent tasks
            for other_task_id in graph:
                if task_id in graph[other_task_id]:
                    in_degree[other_task_id] -= 1
                    if in_degree[other_task_id] == 0:
                        queue.append(other_task_id)
        
        return sorted_tasks