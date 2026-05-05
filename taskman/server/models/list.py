from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict, ForwardRef

from taskman.shared.constants import ListType


# Forward reference for recursive ListItem
ListItemRef = ForwardRef('ListItem')


# Default tag colors (hierarchical tags)
DEFAULT_TAG_COLORS: Dict[str, str] = {
    "work": "#3b82f6",        # blue
    "personal": "#22c55e",    # green
    "priority/high": "#ef4444",   # red
    "priority/medium": "#f59e0b", # amber
    "priority/low": "#6b7280",    # gray
    "research": "#8b5cf6",    # purple
    "reading": "#06b6d4",     # cyan
    "watch": "#ec4899",       # pink
    "buy": "#f97316",         # orange
    "idea": "#eab308",        # yellow
}


class ListItem(BaseModel):
    """An item in a list"""
    id: str
    text: str
    quantity: Optional[str] = None  # e.g., "2 lbs", "1 dozen"
    notes: Optional[str] = None
    category: Optional[str] = None  # For grouping items
    url: Optional[str] = None  # Optional link/URL
    tags: List[str] = Field(default_factory=list)  # Hierarchical tags like "work/research"
    children: List['ListItem'] = Field(default_factory=list)  # Nested sub-items
    order: int = 0
    completed_at: Optional[datetime] = None  # Only used for eternal lists
    # Extended properties (shown in expandable section)
    price: Optional[str] = None  # e.g., "$19.99", "€25"
    rating: Optional[int] = None  # 1-5 stars
    priority: Optional[str] = None  # "high", "medium", "low"
    location: Optional[str] = None  # Where to find/buy item
    due_date: Optional[datetime] = None  # When item needs to be done/acquired
    source: Optional[str] = None  # Where you heard about it (for movies/books)
    image_url: Optional[str] = None  # Image/thumbnail URL


# Update forward references
ListItem.model_rebuild()


class TaskList(BaseModel):
    """A list (either eternal or template)"""
    id: str
    name: str
    description: Optional[str] = None
    list_type: ListType = ListType.ETERNAL
    items: List[ListItem] = Field(default_factory=list)
    categories: List[str] = Field(default_factory=list)  # Predefined categories
    linked_habit_ids: List[str] = Field(default_factory=list)
    linked_project_ids: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    archived: bool = False
    # New features
    is_pinned: bool = False  # Pin list to top
    color: Optional[str] = None  # Color label (hex color like "#3b82f6")
    icon: Optional[str] = None  # Icon name (e.g., "film", "book", "shopping-cart")
    default_sort: Optional[str] = None  # Default sort: "order", "rating", "price", "priority", "due_date"

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ListInstance(BaseModel):
    """An instance of a template list (for checklists that reset)"""
    id: str
    list_id: str  # Reference to the template list
    name: str  # e.g., "Grocery Run - Dec 19"
    item_states: Dict[str, bool] = Field(default_factory=dict)  # item_id -> checked
    extra_items: List[ListItem] = Field(default_factory=list)  # Instance-only items
    linked_habit_instance_id: Optional[str] = None  # If created from a habit
    created_at: datetime = Field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class ListCreate(BaseModel):
    """Schema for creating a new list"""
    name: str
    description: Optional[str] = None
    list_type: ListType = ListType.ETERNAL
    categories: List[str] = Field(default_factory=list)
    linked_habit_ids: List[str] = Field(default_factory=list)
    linked_project_ids: List[str] = Field(default_factory=list)
    is_pinned: bool = False
    color: Optional[str] = None
    icon: Optional[str] = None
    default_sort: Optional[str] = None


class ListUpdate(BaseModel):
    """Schema for updating a list"""
    name: Optional[str] = None
    description: Optional[str] = None
    list_type: Optional[ListType] = None
    categories: Optional[List[str]] = None
    linked_habit_ids: Optional[List[str]] = None
    linked_project_ids: Optional[List[str]] = None
    archived: Optional[bool] = None
    is_pinned: Optional[bool] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    default_sort: Optional[str] = None


class ListItemCreate(BaseModel):
    """Schema for creating a list item"""
    text: str
    quantity: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    children: List['ListItemCreate'] = Field(default_factory=list)
    order: Optional[int] = None
    parent_item_id: Optional[str] = None  # For adding as a child of existing item
    # Extended properties
    price: Optional[str] = None
    rating: Optional[int] = None
    priority: Optional[str] = None
    location: Optional[str] = None
    due_date: Optional[datetime] = None
    source: Optional[str] = None
    image_url: Optional[str] = None


class ListItemUpdate(BaseModel):
    """Schema for updating a list item"""
    text: Optional[str] = None
    quantity: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[str] = None
    url: Optional[str] = None
    tags: Optional[List[str]] = None
    order: Optional[int] = None
    completed_at: Optional[datetime] = None
    # Extended properties
    price: Optional[str] = None
    rating: Optional[int] = None
    priority: Optional[str] = None
    location: Optional[str] = None
    due_date: Optional[datetime] = None
    source: Optional[str] = None
    image_url: Optional[str] = None


# Rebuild for recursive types
ListItemCreate.model_rebuild()


class ListInstanceCreate(BaseModel):
    """Schema for creating a list instance"""
    list_id: str
    name: Optional[str] = None  # Auto-generated if not provided
    linked_habit_instance_id: Optional[str] = None


class ListInstanceUpdate(BaseModel):
    """Schema for updating a list instance"""
    name: Optional[str] = None
    item_states: Optional[Dict[str, bool]] = None
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None
