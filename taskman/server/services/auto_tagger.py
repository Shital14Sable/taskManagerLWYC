"""
Auto-tagging service for tasks.
Automatically assigns tags based on task title and description keywords.
"""
import re
from typing import List, Optional, Tuple

# Keyword to tag mappings (case-insensitive)
# Format: list of (keywords, tag)
TAG_RULES: List[Tuple[List[str], str]] = [
    # Work - Meetings
    (["meeting", "sync", "standup", "stand-up", "call", "conference", "zoom", "teams"], "Work/Meetings"),
    # Work - Admin
    (["email", "reply", "respond", "follow up", "followup", "invoice", "expense", "paperwork"], "Work/Admin"),
    # Work - Deep Work
    (["write", "draft", "document", "report", "design", "code", "develop", "implement", "build", "create", "research"], "Work/Deep Work"),
    # Work - Review
    (["review", "feedback", "approve", "check", "verify", "audit"], "Work/Review"),

    # Personal - Health
    (["gym", "workout", "exercise", "run", "yoga", "meditate", "meditation", "doctor", "dentist", "health", "fitness", "stretch"], "Personal/Health"),
    # Personal - Errands
    (["groceries", "shopping", "buy", "pick up", "pickup", "drop off", "dropoff", "return", "errand", "store", "bank", "post office"], "Personal/Errands"),
    # Personal - Learning
    (["read", "book", "learn", "course", "study", "tutorial", "practice", "lesson"], "Personal/Learning"),
    # Personal - Family
    (["family", "kids", "children", "spouse", "parent", "mom", "dad", "birthday", "anniversary"], "Personal/Family"),
    # Personal - Home
    (["clean", "organize", "fix", "repair", "laundry", "dishes", "cook", "meal prep", "garden"], "Personal/Home"),

    # Finance
    (["budget", "invest", "tax", "payment", "bill", "insurance", "savings"], "Finance"),

    # Urgent indicators (can be combined with other tags)
    (["urgent", "asap", "emergency", "critical", "important", "deadline"], "urgent"),
]


def auto_tag_task(title: str, description: Optional[str] = None, project_name: Optional[str] = None) -> List[str]:
    """
    Automatically generate tags for a task based on its content.

    Args:
        title: Task title
        description: Optional task description
        project_name: Optional project name (will be added as a tag)

    Returns:
        List of hierarchical tags
    """
    tags = []

    # Combine title and description for matching
    text = title.lower()
    if description:
        text += " " + description.lower()

    # Add project as a tag if provided
    if project_name:
        # Sanitize project name for use as tag
        sanitized_project = project_name.strip()
        if sanitized_project:
            tags.append(f"Projects/{sanitized_project}")

    # Find matching tags based on keywords
    matched_tag = None
    for keywords, tag in TAG_RULES:
        for keyword in keywords:
            # Use word boundary matching to avoid partial matches
            pattern = r'\b' + re.escape(keyword) + r'\b'
            if re.search(pattern, text, re.IGNORECASE):
                # For urgent tag, always add it (can have multiple)
                if tag == "urgent":
                    if tag not in tags:
                        tags.append(tag)
                elif matched_tag is None:
                    # For category tags, only take the first match
                    matched_tag = tag
                break

    # Add the matched category tag
    if matched_tag:
        tags.append(matched_tag)

    return tags


def get_all_tag_categories() -> List[dict]:
    """
    Get all available tag categories for the UI.

    Returns:
        List of tag category definitions with keywords
    """
    categories = {}

    for keywords, tag in TAG_RULES:
        if tag == "urgent":
            continue  # Skip urgent as it's a modifier

        # Parse hierarchical tag
        parts = tag.split("/")
        parent = parts[0] if len(parts) > 1 else None
        name = parts[-1]

        if tag not in categories:
            categories[tag] = {
                "tag": tag,
                "name": name,
                "parent": parent,
                "keywords": keywords
            }

    return list(categories.values())


def suggest_tags(text: str) -> List[str]:
    """
    Suggest tags for given text without applying them.
    Useful for showing suggestions in the UI.

    Args:
        text: Text to analyze

    Returns:
        List of suggested tags
    """
    return auto_tag_task(text)
