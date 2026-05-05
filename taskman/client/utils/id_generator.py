"""ID generation utilities"""
import uuid

def generate_short_id() -> str:
    """Generate 8-character short ID from UUID"""
    return str(uuid.uuid4())[:8]
