"""
Sync management for cross-device synchronization
"""
from datetime import datetime
from typing import List, Dict, Optional
from taskman.server.services.storage import StorageManager
from taskman.shared.schemas import SyncRequest, SyncResponse

class SyncManager:
    """Manages cross-device synchronization"""
    
    def __init__(self, storage: StorageManager):
        self.storage = storage
        self.conflict_resolution = "server_wins"  # server_wins, client_wins, manual
    
    def sync(self, request: SyncRequest) -> SyncResponse:
        """
        Process sync request from client
        
        Args:
            request: SyncRequest with client data
        
        Returns:
            SyncResponse with updates and conflicts
        """
        updates = []
        conflicts = []
        
        # Get server state
        server_projects = self.storage.list_projects()
        server_tasks = self.storage.list_tasks()
        
        # Build lookup dictionaries
        server_project_dict = {p.id: p for p in server_projects}
        server_task_dict = {t.id: t for t in server_tasks}
        
        # Process client entities
        for entity in request.entities:
            entity_type = entity.get('type')
            entity_id = entity.get('id')
            entity_data = entity.get('data')
            client_updated_at = datetime.fromisoformat(entity_data.get('updated_at'))
            
            if entity_type == 'project':
                server_entity = server_project_dict.get(entity_id)
                
                if server_entity is None:
                    # New project on client, add to server
                    updates.append({
                        'type': 'project',
                        'action': 'create',
                        'data': entity_data
                    })
                else:
                    # Check for conflicts
                    server_updated_at = server_entity.updated_at
                    
                    if client_updated_at > server_updated_at:
                        # Client is newer
                        if self.conflict_resolution == "client_wins":
                            updates.append({
                                'type': 'project',
                                'action': 'update',
                                'id': entity_id,
                                'data': entity_data
                            })
                        else:
                            conflicts.append({
                                'type': 'project',
                                'id': entity_id,
                                'client_version': entity_data,
                                'server_version': server_entity.model_dump(mode='json')
                            })
                    elif client_updated_at < server_updated_at:
                        # Server is newer, send update to client
                        updates.append({
                            'type': 'project',
                            'action': 'update',
                            'id': entity_id,
                            'data': server_entity.model_dump(mode='json')
                        })
            
            elif entity_type == 'task':
                server_entity = server_task_dict.get(entity_id)
                
                if server_entity is None:
                    updates.append({
                        'type': 'task',
                        'action': 'create',
                        'data': entity_data
                    })
                else:
                    server_updated_at = server_entity.updated_at
                    
                    if client_updated_at > server_updated_at:
                        if self.conflict_resolution == "client_wins":
                            updates.append({
                                'type': 'task',
                                'action': 'update',
                                'id': entity_id,
                                'data': entity_data
                            })
                        else:
                            conflicts.append({
                                'type': 'task',
                                'id': entity_id,
                                'client_version': entity_data,
                                'server_version': server_entity.model_dump(mode='json')
                            })
                    elif client_updated_at < server_updated_at:
                        updates.append({
                            'type': 'task',
                            'action': 'update',
                            'id': entity_id,
                            'data': server_entity.model_dump(mode='json')
                        })
        
        # Check for entities on server not on client
        if request.last_sync:
            # Send entities created/updated since last sync
            for project in server_projects:
                if project.updated_at > request.last_sync:
                    if project.id not in [e.get('id') for e in request.entities]:
                        updates.append({
                            'type': 'project',
                            'action': 'create',
                            'data': project.model_dump(mode='json')
                        })
            
            for task in server_tasks:
                if task.updated_at > request.last_sync:
                    if task.id not in [e.get('id') for e in request.entities]:
                        updates.append({
                            'type': 'task',
                            'action': 'create',
                            'data': task.model_dump(mode='json')
                        })
        
        return SyncResponse(
            success=True,
            updates=updates,
            conflicts=conflicts,
            server_time=datetime.now()
        )
    
    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: str,
        chosen_version: Optional[Dict] = None
    ):
        """
        Resolve a sync conflict
        
        Args:
            conflict_id: ID of conflicted entity
            resolution: 'server', 'client', or 'manual'
            chosen_version: For manual resolution, the chosen data
        """
        if resolution == "server":
            # Keep server version, no action needed
            pass
        elif resolution == "client":
            # Update server with client version
            if chosen_version:
                entity_type = chosen_version.get('type')
                if entity_type == 'project':
                    # Update project
                    pass
                elif entity_type == 'task':
                    # Update task
                    pass
        elif resolution == "manual":
            # Apply manually merged version
            if chosen_version:
                # Save chosen version
                pass