"""
Offline operation queue for storing operations when server is unavailable
"""
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional
from taskman.shared.constants import SyncAction

class OfflineQueue:
    """Queue for offline operations"""
    
    def __init__(self, cache_dir: str = "~/.taskman/cache"):
        self.cache_dir = Path(cache_dir).expanduser()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.queue_file = self.cache_dir / "offline_queue.json"
        self.queue = self._load_queue()
    
    def _load_queue(self) -> List[Dict]:
        """Load queue from disk"""
        if not self.queue_file.exists():
            return []
        
        try:
            with open(self.queue_file, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    
    def _save_queue(self):
        """Save queue to disk"""
        with open(self.queue_file, 'w') as f:
            json.dump(self.queue, f, indent=2, default=str)
    
    def add_operation(self, operation_type: str, entity_type: str, 
                     entity_id: str, data: Dict):
        """Add operation to queue"""
        operation = {
            'id': len(self.queue) + 1,
            'type': operation_type,  # create, update, delete
            'entity_type': entity_type,  # project, task, schedule
            'entity_id': entity_id,
            'data': data,
            'timestamp': datetime.now().isoformat(),
            'retries': 0,
            'status': 'pending'
        }
        
        self.queue.append(operation)
        self._save_queue()
    
    def get_pending_operations(self) -> List[Dict]:
        """Get all pending operations"""
        return [op for op in self.queue if op['status'] == 'pending']
    
    def mark_completed(self, operation_id: int):
        """Mark operation as completed"""
        for op in self.queue:
            if op['id'] == operation_id:
                op['status'] = 'completed'
                op['completed_at'] = datetime.now().isoformat()
                break
        
        self._save_queue()
    
    def mark_failed(self, operation_id: int, error: str):
        """Mark operation as failed"""
        for op in self.queue:
            if op['id'] == operation_id:
                op['status'] = 'failed'
                op['error'] = error
                op['retries'] += 1
                op['last_retry'] = datetime.now().isoformat()
                break
        
        self._save_queue()
    
    def sync(self, api_client) -> Dict:
        """Sync all pending operations with server"""
        results = {
            'success': 0,
            'failed': 0,
            'errors': []
        }
        
        pending = self.get_pending_operations()
        
        for op in pending:
            try:
                # Execute operation based on type
                if op['type'] == 'create':
                    if op['entity_type'] == 'project':
                        api_client.create_project(op['data'])
                    elif op['entity_type'] == 'task':
                        api_client.create_task(op['data'])
                
                elif op['type'] == 'update':
                    if op['entity_type'] == 'project':
                        api_client.update_project(op['entity_id'], op['data'])
                    elif op['entity_type'] == 'task':
                        api_client.update_task(op['entity_id'], op['data'])
                
                elif op['type'] == 'delete':
                    if op['entity_type'] == 'project':
                        api_client.delete_project(op['entity_id'])
                    elif op['entity_type'] == 'task':
                        api_client.delete_task(op['entity_id'])
                
                # Mark as completed
                self.mark_completed(op['id'])
                results['success'] += 1
                
            except Exception as e:
                # Mark as failed
                self.mark_failed(op['id'], str(e))
                results['failed'] += 1
                results['errors'].append({
                    'operation': op['id'],
                    'error': str(e)
                })
        
        return results
    
    def clear_completed(self):
        """Remove completed operations from queue"""
        self.queue = [op for op in self.queue if op['status'] != 'completed']
        self._save_queue()
    
    def clear_all(self):
        """Clear all operations"""
        self.queue = []
        self._save_queue()
    
    def get_stats(self) -> Dict:
        """Get queue statistics"""
        return {
            'total': len(self.queue),
            'pending': len([op for op in self.queue if op['status'] == 'pending']),
            'completed': len([op for op in self.queue if op['status'] == 'completed']),
            'failed': len([op for op in self.queue if op['status'] == 'failed'])
        }