from fastapi import APIRouter, Request

router = APIRouter()

@router.get("/list")
def list_backups(request: Request):
    """List all backups"""
    return {"backups": []}

@router.post("/create")
def create_backup(request: Request):
    """Create a backup"""
    return {"message": "Backup feature coming soon"}