from fastapi import APIRouter, HTTPException, Request
from typing import List, Optional, Dict
import uuid
from datetime import datetime

from taskman.server.models.list import (
    TaskList, ListItem, ListInstance,
    ListCreate, ListUpdate, ListItemCreate, ListItemUpdate,
    ListInstanceCreate, ListInstanceUpdate, DEFAULT_TAG_COLORS
)
from taskman.shared.constants import SHORT_ID_LENGTH, ListType
from taskman.shared.exceptions import ListNotFoundException, ListInstanceNotFoundException

router = APIRouter()


# ============================================================================
# TAG ENDPOINTS
# ============================================================================

@router.get("/tags/colors", response_model=Dict[str, str])
def get_tag_colors():
    """Get default tag colors"""
    return DEFAULT_TAG_COLORS


def generate_short_id() -> str:
    """Generate 8-character short ID"""
    return str(uuid.uuid4())[:SHORT_ID_LENGTH]


# ============================================================================
# LIST ENDPOINTS
# ============================================================================

@router.post("/", response_model=TaskList)
def create_list(list_data: ListCreate, request: Request):
    """Create a new list"""
    storage = request.app.state.storage

    new_list = TaskList(
        id=generate_short_id(),
        name=list_data.name,
        description=list_data.description,
        list_type=list_data.list_type,
        categories=list_data.categories,
        linked_habit_ids=list_data.linked_habit_ids,
        linked_project_ids=list_data.linked_project_ids,
        items=[],
        created_at=datetime.now(),
        updated_at=datetime.now(),
        archived=False,
        is_pinned=list_data.is_pinned,
        color=list_data.color,
        icon=list_data.icon,
        default_sort=list_data.default_sort
    )

    storage.save_list(new_list)
    return new_list


@router.get("/", response_model=List[TaskList])
def list_lists(request: Request, include_archived: bool = False):
    """List all lists"""
    storage = request.app.state.storage
    return storage.list_lists(include_archived=include_archived)


@router.get("/{list_id}", response_model=TaskList)
def get_list(list_id: str, request: Request):
    """Get a specific list"""
    storage = request.app.state.storage
    try:
        return storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{list_id}", response_model=TaskList)
def update_list(list_id: str, update: ListUpdate, request: Request):
    """Update a list"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Update fields
    if update.name is not None:
        task_list.name = update.name
    if update.description is not None:
        task_list.description = update.description
    if update.list_type is not None:
        task_list.list_type = update.list_type
    if update.categories is not None:
        task_list.categories = update.categories
    if update.linked_habit_ids is not None:
        task_list.linked_habit_ids = update.linked_habit_ids
    if update.linked_project_ids is not None:
        task_list.linked_project_ids = update.linked_project_ids
    if update.archived is not None:
        task_list.archived = update.archived
    if update.is_pinned is not None:
        task_list.is_pinned = update.is_pinned
    if update.color is not None:
        # Empty string clears the color, otherwise set the color
        task_list.color = update.color if update.color else None
    if update.icon is not None:
        # Empty string clears the icon, otherwise set the icon
        task_list.icon = update.icon if update.icon else None
    if update.default_sort is not None:
        # Empty string clears the default_sort, otherwise set it
        task_list.default_sort = update.default_sort if update.default_sort else None

    task_list.updated_at = datetime.now()
    storage.save_list(task_list)

    return task_list


@router.delete("/{list_id}")
def delete_list(list_id: str, request: Request):
    """Delete a list"""
    storage = request.app.state.storage

    try:
        storage.delete_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": f"List {list_id} deleted"}


# ============================================================================
# LIST ITEM ENDPOINTS
# ============================================================================

def create_list_item_recursive(item_data: ListItemCreate, order: int) -> ListItem:
    """Recursively create a list item with children"""
    children = []
    for idx, child_data in enumerate(item_data.children):
        children.append(create_list_item_recursive(child_data, idx))

    return ListItem(
        id=generate_short_id(),
        text=item_data.text,
        quantity=item_data.quantity,
        notes=item_data.notes,
        category=item_data.category,
        url=item_data.url,
        tags=item_data.tags,
        children=children,
        order=order,
        completed_at=None,
        # Extended properties
        price=item_data.price,
        rating=item_data.rating,
        priority=item_data.priority,
        location=item_data.location,
        due_date=item_data.due_date,
        source=item_data.source,
        image_url=item_data.image_url
    )


def find_item_by_id(items: List[ListItem], item_id: str) -> Optional[ListItem]:
    """Recursively find an item by ID in nested structure"""
    for item in items:
        if item.id == item_id:
            return item
        found = find_item_by_id(item.children, item_id)
        if found:
            return found
    return None


def remove_item_by_id(items: List[ListItem], item_id: str) -> List[ListItem]:
    """Recursively remove an item by ID from nested structure"""
    result = []
    for item in items:
        if item.id != item_id:
            item.children = remove_item_by_id(item.children, item_id)
            result.append(item)
    return result


@router.post("/{list_id}/items", response_model=TaskList)
def add_list_item(list_id: str, item_data: ListItemCreate, request: Request):
    """Add an item to a list (optionally as a child of another item)"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Determine order
    if item_data.order is not None:
        order = item_data.order
    else:
        # Add to end of list (after last incomplete item for eternal lists)
        if item_data.parent_item_id:
            parent_item = find_item_by_id(task_list.items, item_data.parent_item_id)
            if parent_item:
                order = len(parent_item.children)
            else:
                raise HTTPException(status_code=404, detail=f"Parent item {item_data.parent_item_id} not found")
        else:
            incomplete_items = [i for i in task_list.items if not i.completed_at]
            order = len(incomplete_items)

    new_item = create_list_item_recursive(item_data, order)

    # Add to parent or top-level
    if item_data.parent_item_id:
        parent_item = find_item_by_id(task_list.items, item_data.parent_item_id)
        if parent_item:
            parent_item.children.append(new_item)
        else:
            raise HTTPException(status_code=404, detail=f"Parent item {item_data.parent_item_id} not found")
    else:
        task_list.items.append(new_item)

    task_list.updated_at = datetime.now()
    storage.save_list(task_list)

    return task_list


@router.put("/{list_id}/items/{item_id}", response_model=TaskList)
def update_list_item(list_id: str, item_id: str, update: ListItemUpdate, request: Request):
    """Update an item in a list (works with nested items)"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Find the item (recursively)
    item = find_item_by_id(task_list.items, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found in list")

    # Update fields
    if update.text is not None:
        item.text = update.text
    if update.quantity is not None:
        item.quantity = update.quantity
    if update.notes is not None:
        item.notes = update.notes
    if update.category is not None:
        item.category = update.category
    if update.url is not None:
        item.url = update.url
    if update.tags is not None:
        item.tags = update.tags
    if update.order is not None:
        item.order = update.order
    if update.completed_at is not None:
        item.completed_at = update.completed_at
    # Extended properties
    if update.price is not None:
        item.price = update.price
    if update.rating is not None:
        item.rating = update.rating
    if update.priority is not None:
        item.priority = update.priority
    if update.location is not None:
        item.location = update.location
    if update.due_date is not None:
        item.due_date = update.due_date
    if update.source is not None:
        item.source = update.source
    if update.image_url is not None:
        item.image_url = update.image_url

    task_list.updated_at = datetime.now()
    storage.save_list(task_list)

    return task_list


@router.post("/{list_id}/items/{item_id}/toggle", response_model=TaskList)
def toggle_list_item(list_id: str, item_id: str, request: Request):
    """Toggle completion status of an item (for eternal/quick lists)"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if task_list.list_type not in [ListType.ETERNAL, ListType.QUICK]:
        raise HTTPException(
            status_code=400,
            detail="Can only toggle items directly on eternal/quick lists. For template lists, use instances."
        )

    # Find the item (recursively)
    item = find_item_by_id(task_list.items, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Item {item_id} not found in list")

    # Toggle completion
    if item.completed_at:
        item.completed_at = None
    else:
        item.completed_at = datetime.now()

    task_list.updated_at = datetime.now()
    storage.save_list(task_list)

    return task_list


@router.delete("/{list_id}/items/{item_id}", response_model=TaskList)
def delete_list_item(list_id: str, item_id: str, request: Request):
    """Delete an item from a list (works with nested items)"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Remove the item (recursively)
    task_list.items = remove_item_by_id(task_list.items, item_id)
    task_list.updated_at = datetime.now()
    storage.save_list(task_list)

    return task_list


@router.get("/{list_id}/items/by-tag/{tag}", response_model=List[ListItem])
def get_items_by_tag(list_id: str, tag: str, request: Request):
    """Get all items with a specific tag (including partial matches for hierarchical tags)"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    def collect_items_with_tag(items: List[ListItem], tag: str) -> List[ListItem]:
        """Recursively collect items that have the tag or a child of the tag"""
        result = []
        for item in items:
            # Check if any of the item's tags match or start with the given tag
            if any(t == tag or t.startswith(f"{tag}/") for t in item.tags):
                result.append(item)
            # Also check children
            result.extend(collect_items_with_tag(item.children, tag))
        return result

    return collect_items_with_tag(task_list.items, tag)


@router.put("/{list_id}/items/reorder", response_model=TaskList)
def reorder_list_items(list_id: str, item_ids: List[str], request: Request):
    """Reorder items in a list"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Create a map of item_id -> item
    item_map = {item.id: item for item in task_list.items}

    # Update order based on position in item_ids
    for idx, item_id in enumerate(item_ids):
        if item_id in item_map:
            item_map[item_id].order = idx

    # Sort items by order
    task_list.items.sort(key=lambda x: x.order)
    task_list.updated_at = datetime.now()
    storage.save_list(task_list)

    return task_list


# ============================================================================
# LIST INSTANCE ENDPOINTS (for template lists)
# ============================================================================

@router.post("/{list_id}/instances", response_model=ListInstance)
def create_list_instance(list_id: str, instance_data: ListInstanceCreate, request: Request):
    """Create a new instance of a template list"""
    storage = request.app.state.storage

    try:
        task_list = storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    if task_list.list_type != ListType.TEMPLATE:
        raise HTTPException(
            status_code=400,
            detail="Can only create instances from template lists"
        )

    # Generate name if not provided
    name = instance_data.name or f"{task_list.name} - {datetime.now().strftime('%b %d')}"

    # Initialize all items as unchecked
    item_states = {item.id: False for item in task_list.items}

    new_instance = ListInstance(
        id=generate_short_id(),
        list_id=list_id,
        name=name,
        item_states=item_states,
        extra_items=[],
        linked_habit_instance_id=instance_data.linked_habit_instance_id,
        created_at=datetime.now(),
        completed_at=None,
        archived_at=None
    )

    storage.save_list_instance(new_instance)
    return new_instance


@router.get("/{list_id}/instances", response_model=List[ListInstance])
def list_instances(list_id: str, request: Request, include_archived: bool = False):
    """List all instances of a list"""
    storage = request.app.state.storage

    # Verify list exists
    try:
        storage.get_list(list_id)
    except ListNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    return storage.list_list_instances(list_id=list_id, include_archived=include_archived)


@router.get("/instances/{instance_id}", response_model=ListInstance)
def get_instance(instance_id: str, request: Request):
    """Get a specific list instance"""
    storage = request.app.state.storage
    try:
        return storage.get_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/instances/{instance_id}", response_model=ListInstance)
def update_instance(instance_id: str, update: ListInstanceUpdate, request: Request):
    """Update a list instance"""
    storage = request.app.state.storage

    try:
        instance = storage.get_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Update fields
    if update.name is not None:
        instance.name = update.name
    if update.item_states is not None:
        instance.item_states.update(update.item_states)
    if update.completed_at is not None:
        instance.completed_at = update.completed_at
    if update.archived_at is not None:
        instance.archived_at = update.archived_at

    storage.save_list_instance(instance)
    return instance


@router.post("/instances/{instance_id}/toggle/{item_id}", response_model=ListInstance)
def toggle_instance_item(instance_id: str, item_id: str, request: Request):
    """Toggle an item's checked state in a list instance"""
    storage = request.app.state.storage

    try:
        instance = storage.get_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Toggle the item state
    current_state = instance.item_states.get(item_id, False)
    instance.item_states[item_id] = not current_state

    # Check if all items are complete
    task_list = storage.get_list(instance.list_id)
    all_template_items_done = all(
        instance.item_states.get(item.id, False) for item in task_list.items
    )
    all_extra_items_done = all(
        instance.item_states.get(item.id, False) for item in instance.extra_items
    )

    if all_template_items_done and all_extra_items_done and not instance.completed_at:
        instance.completed_at = datetime.now()
    elif not (all_template_items_done and all_extra_items_done) and instance.completed_at:
        instance.completed_at = None

    storage.save_list_instance(instance)
    return instance


@router.post("/instances/{instance_id}/items", response_model=ListInstance)
def add_instance_item(instance_id: str, item_data: ListItemCreate, request: Request):
    """Add an extra item to a list instance (instance-specific item)"""
    storage = request.app.state.storage

    try:
        instance = storage.get_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    new_item = ListItem(
        id=generate_short_id(),
        text=item_data.text,
        quantity=item_data.quantity,
        notes=item_data.notes,
        category=item_data.category,
        order=len(instance.extra_items),
        completed_at=None
    )

    instance.extra_items.append(new_item)
    instance.item_states[new_item.id] = False
    storage.save_list_instance(instance)

    return instance


@router.post("/instances/{instance_id}/complete", response_model=ListInstance)
def complete_instance(instance_id: str, request: Request):
    """Mark a list instance as complete"""
    storage = request.app.state.storage

    try:
        instance = storage.get_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    instance.completed_at = datetime.now()
    storage.save_list_instance(instance)

    return instance


@router.post("/instances/{instance_id}/archive", response_model=ListInstance)
def archive_instance(instance_id: str, request: Request):
    """Archive a list instance"""
    storage = request.app.state.storage

    try:
        instance = storage.get_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    instance.archived_at = datetime.now()
    storage.save_list_instance(instance)

    return instance


@router.delete("/instances/{instance_id}")
def delete_instance(instance_id: str, request: Request):
    """Delete a list instance"""
    storage = request.app.state.storage

    try:
        storage.delete_list_instance(instance_id)
    except ListInstanceNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {"message": f"Instance {instance_id} deleted"}
