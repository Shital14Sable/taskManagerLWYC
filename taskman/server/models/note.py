"""
Note model for hierarchical markdown notes with Obsidian/Evernote compatibility.

Notes are stored as .md files with YAML frontmatter in a real folder structure.
Example: data/notes/Work/Project-Ideas/brainstorm.md
"""
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List


class Note(BaseModel):
    """A markdown note with YAML frontmatter for metadata"""
    id: str
    title: str
    content: str = ""  # Markdown content (without frontmatter)
    folder_path: str = ""  # e.g., "Work/Ideas" - empty string for root

    # Linking to other entities
    linked_task_ids: List[str] = Field(default_factory=list)
    linked_project_ids: List[str] = Field(default_factory=list)
    linked_habit_ids: List[str] = Field(default_factory=list)
    linked_goal_ids: List[str] = Field(default_factory=list)

    # Daily note support
    is_daily_note: bool = False
    date: Optional[str] = None  # ISO date string for daily notes

    # Tags for organization
    tags: List[str] = Field(default_factory=list)

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

    def to_frontmatter_dict(self) -> dict:
        """Convert to dictionary for YAML frontmatter"""
        data = {
            "id": self.id,
            "title": self.title,
            "folder_path": self.folder_path,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

        if self.linked_task_ids:
            data["linked_task_ids"] = self.linked_task_ids
        if self.linked_project_ids:
            data["linked_project_ids"] = self.linked_project_ids
        if self.linked_habit_ids:
            data["linked_habit_ids"] = self.linked_habit_ids
        if self.linked_goal_ids:
            data["linked_goal_ids"] = self.linked_goal_ids
        if self.is_daily_note:
            data["is_daily_note"] = True
            data["date"] = self.date
        if self.tags:
            data["tags"] = self.tags

        return data

    @property
    def file_path(self) -> str:
        """Get the relative file path for this note"""
        # Sanitize title for filename
        safe_title = self.title.replace("/", "-").replace("\\", "-")
        safe_title = "".join(c for c in safe_title if c.isalnum() or c in " -_").strip()

        if self.folder_path:
            return f"{self.folder_path}/{safe_title}.md"
        return f"{safe_title}.md"


class NoteCreate(BaseModel):
    """Schema for creating a new note"""
    title: str
    content: str = ""
    folder_path: str = ""
    linked_task_ids: List[str] = Field(default_factory=list)
    linked_project_ids: List[str] = Field(default_factory=list)
    linked_habit_ids: List[str] = Field(default_factory=list)
    linked_goal_ids: List[str] = Field(default_factory=list)
    is_daily_note: bool = False
    date: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class NoteUpdate(BaseModel):
    """Schema for updating a note"""
    title: Optional[str] = None
    content: Optional[str] = None
    folder_path: Optional[str] = None
    linked_task_ids: Optional[List[str]] = None
    linked_project_ids: Optional[List[str]] = None
    linked_habit_ids: Optional[List[str]] = None
    linked_goal_ids: Optional[List[str]] = None
    tags: Optional[List[str]] = None


class Folder(BaseModel):
    """Represents a folder in the notes hierarchy"""
    name: str
    path: str  # Full path from notes root
    subfolders: List['Folder'] = Field(default_factory=list)
    note_count: int = 0


# Rebuild for recursive types
Folder.model_rebuild()
