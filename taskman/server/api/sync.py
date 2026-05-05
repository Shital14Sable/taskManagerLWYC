from fastapi import APIRouter, Request
from datetime import datetime

from taskman.server.services.git_sync import get_git_sync

router = APIRouter()

@router.get("/status")
def sync_status(request: Request):
    """Get sync status including git sync info"""
    git_sync = get_git_sync()

    response = {
        "status": "ok",
        "server_time": datetime.now().isoformat(),
        "clients_connected": 0
    }

    if git_sync:
        response["git_sync"] = git_sync.status()

    return response

@router.post("/pull")
def pull_changes(request: Request):
    """Pull changes from server"""
    storage = request.app.state.storage

    projects = storage.list_projects()
    tasks = storage.list_tasks()

    return {
        "projects": projects,
        "tasks": tasks,
        "timestamp": datetime.now().isoformat()
    }

@router.post("/git/pull")
def git_pull():
    """Manually trigger a git pull"""
    git_sync = get_git_sync()
    if not git_sync:
        return {"success": False, "message": "Git sync not enabled"}

    success, message = git_sync.pull()
    return {"success": success, "message": message}

@router.post("/git/push")
def git_push():
    """Manually trigger a git push"""
    git_sync = get_git_sync()
    if not git_sync:
        return {"success": False, "message": "Git sync not enabled"}

    success, message = git_sync.push()
    return {"success": success, "message": message}

@router.post("/git/sync")
def git_sync_now():
    """Manually trigger a full git sync (pull + push)"""
    git_sync = get_git_sync()
    if not git_sync:
        return {"success": False, "message": "Git sync not enabled"}

    success, message = git_sync.sync()
    return {"success": success, "message": message}