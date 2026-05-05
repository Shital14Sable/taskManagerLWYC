"""
Notes API - File-based markdown notes with Obsidian/Evernote compatibility.

Notes are stored as .md files with YAML frontmatter in a real folder structure.
Example: data/notes/Work/Project-Ideas/brainstorm.md
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional
import uuid
from datetime import datetime, date

from taskman.server.models.note import Note, NoteCreate, NoteUpdate, Folder
from taskman.shared.constants import SHORT_ID_LENGTH
from taskman.shared.exceptions import NoteNotFoundException, FolderNotFoundException

router = APIRouter()


def generate_short_id() -> str:
    """Generate 8-character short ID"""
    return str(uuid.uuid4())[:SHORT_ID_LENGTH]


# ============================================================================
# NOTE ENDPOINTS
# ============================================================================

@router.post("/", response_model=Note)
def create_note(note_data: NoteCreate, request: Request):
    """Create a new note"""
    storage = request.app.state.storage

    new_note = Note(
        id=generate_short_id(),
        title=note_data.title,
        content=note_data.content,
        folder_path=note_data.folder_path,
        linked_task_ids=note_data.linked_task_ids,
        linked_project_ids=note_data.linked_project_ids,
        linked_habit_ids=note_data.linked_habit_ids,
        linked_goal_ids=note_data.linked_goal_ids,
        is_daily_note=note_data.is_daily_note,
        date=note_data.date,
        tags=note_data.tags,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    storage.save_note(new_note)
    return new_note


@router.get("/", response_model=List[Note])
def list_notes(
    request: Request,
    folder: Optional[str] = None,
    is_daily_note: Optional[bool] = None
):
    """List all notes with optional filters"""
    storage = request.app.state.storage
    return storage.list_notes(folder_path=folder, is_daily_note=is_daily_note)


@router.get("/search", response_model=List[Note])
def search_notes(query: str, request: Request):
    """Search notes by title and content"""
    storage = request.app.state.storage
    return storage.search_notes(query)


@router.get("/daily", response_model=Note)
def get_or_create_daily_note(request: Request, date_str: Optional[str] = None):
    """Get or create today's daily note"""
    storage = request.app.state.storage

    # Parse date or use today
    if date_str:
        target_date = date.fromisoformat(date_str)
    else:
        target_date = date.today()

    # Check if daily note exists
    existing = storage.get_daily_note(target_date)
    if existing:
        return existing

    # Create new daily note
    formatted_date = target_date.strftime("%A, %B %d, %Y")
    new_note = Note(
        id=generate_short_id(),
        title=f"Daily Note - {formatted_date}",
        content=f"# {formatted_date}\n\n## Tasks Completed Today\n\n## Notes\n\n## Reflections\n\n",
        folder_path="Daily",
        is_daily_note=True,
        date=target_date.isoformat(),
        created_at=datetime.now(),
        updated_at=datetime.now()
    )

    # Auto-link completed tasks from today
    tasks = storage.list_tasks()
    completed_today = []
    for task in tasks:
        if task.completed_at:
            completed_date = task.completed_at.date() if hasattr(task.completed_at, 'date') else task.completed_at
            if isinstance(completed_date, str):
                completed_date = datetime.fromisoformat(completed_date).date()
            if completed_date == target_date:
                completed_today.append(task.id)
                new_note.content += f"- [x] {task.title}\n"

    new_note.linked_task_ids = completed_today

    storage.save_note(new_note)
    return new_note


@router.get("/{note_id}", response_model=Note)
def get_note(note_id: str, request: Request):
    """Get a specific note by ID"""
    storage = request.app.state.storage
    try:
        return storage.get_note(note_id)
    except NoteNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{note_id}", response_model=Note)
def update_note(note_id: str, update: NoteUpdate, request: Request):
    """Update a note"""
    storage = request.app.state.storage

    try:
        note = storage.get_note(note_id)
    except NoteNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Track if folder changed (need to move file)
    old_folder = note.folder_path
    old_title = note.title

    # Update fields
    if update.title is not None:
        note.title = update.title
    if update.content is not None:
        note.content = update.content
    if update.folder_path is not None:
        note.folder_path = update.folder_path
    if update.linked_task_ids is not None:
        note.linked_task_ids = update.linked_task_ids
    if update.linked_project_ids is not None:
        note.linked_project_ids = update.linked_project_ids
    if update.linked_habit_ids is not None:
        note.linked_habit_ids = update.linked_habit_ids
    if update.linked_goal_ids is not None:
        note.linked_goal_ids = update.linked_goal_ids
    if update.tags is not None:
        note.tags = update.tags

    note.updated_at = datetime.now()

    # If folder or title changed, delete old file first
    if old_folder != note.folder_path or old_title != note.title:
        try:
            storage.delete_note(note_id)
        except:
            pass  # Old file might not exist

    storage.save_note(note)
    return note


@router.delete("/{note_id}")
def delete_note(note_id: str, request: Request):
    """Delete a note"""
    storage = request.app.state.storage

    try:
        storage.delete_note(note_id)
    except NoteNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": f"Note {note_id} deleted"}


@router.post("/{note_id}/link-task/{task_id}", response_model=Note)
def link_task_to_note(note_id: str, task_id: str, request: Request):
    """Link a task to a note"""
    storage = request.app.state.storage

    try:
        note = storage.get_note(note_id)
    except NoteNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if task_id not in note.linked_task_ids:
        note.linked_task_ids.append(task_id)
        note.updated_at = datetime.now()
        storage.save_note(note)

    return note


@router.post("/{note_id}/link-project/{project_id}", response_model=Note)
def link_project_to_note(note_id: str, project_id: str, request: Request):
    """Link a project to a note"""
    storage = request.app.state.storage

    try:
        note = storage.get_note(note_id)
    except NoteNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if project_id not in note.linked_project_ids:
        note.linked_project_ids.append(project_id)
        note.updated_at = datetime.now()
        storage.save_note(note)

    return note


@router.post("/{note_id}/link-goal/{goal_id}", response_model=Note)
def link_goal_to_note(note_id: str, goal_id: str, request: Request):
    """Link a goal to a note"""
    storage = request.app.state.storage

    try:
        note = storage.get_note(note_id)
    except NoteNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if goal_id not in note.linked_goal_ids:
        note.linked_goal_ids.append(goal_id)
        note.updated_at = datetime.now()
        storage.save_note(note)

    return note


# ============================================================================
# FOLDER ENDPOINTS
# ============================================================================

@router.get("/folders/tree", response_model=List[Folder])
def get_folder_tree(request: Request):
    """Get the folder tree structure"""
    storage = request.app.state.storage
    return storage.list_folders()


@router.post("/folders/create")
def create_folder(folder_path: str, request: Request):
    """Create a new folder"""
    storage = request.app.state.storage
    storage.create_folder(folder_path)
    return {"message": f"Folder {folder_path} created"}


@router.delete("/folders/{folder_path:path}")
def delete_folder(folder_path: str, request: Request, recursive: bool = False):
    """Delete a folder"""
    storage = request.app.state.storage

    try:
        storage.delete_folder(folder_path, recursive=recursive)
    except FolderNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"message": f"Folder {folder_path} deleted"}
