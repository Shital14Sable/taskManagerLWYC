"""Input validation utilities for CLI"""
import re
from datetime import datetime
from typing import Optional

def validate_priority(value: int) -> bool:
    """Validate priority value (1-5)"""
    return 1 <= value <= 5

def validate_difficulty(value: int) -> bool:
    """Validate difficulty value (1-5)"""
    return 1 <= value <= 5

def validate_time(minutes: int) -> bool:
    """Validate time estimate (positive, reasonable)"""
    return 0 < minutes <= 1440

def validate_energy_level(level: str) -> bool:
    """Validate energy level"""
    return level.lower() in ['high', 'medium', 'low']

def validate_tag(tag_str: str) -> bool:
    """Validate tag format (key=value)"""
    return '=' in tag_str and len(tag_str.split('=')) == 2

def parse_tag(tag_str: str) -> tuple:
    """Parse tag string into key-value tuple"""
    if not validate_tag(tag_str):
        raise ValueError(f"Invalid tag format: {tag_str}. Use key=value")
    
    key, value = tag_str.split('=', 1)
    return key.strip(), value.strip()
