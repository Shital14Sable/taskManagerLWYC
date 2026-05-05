"""
Client configuration management
"""
import yaml
from pathlib import Path
from typing import Optional
from pydantic import BaseModel

class ClientConfig(BaseModel):
    """Client configuration model"""
    server_url: str = "http://localhost:3000"
    api_key: Optional[str] = None

    cache_dir: str = "~/.taskman/cache"
    enable_offline_mode: bool = True
    sync_on_startup: bool = True
    sync_interval_minutes: int = 5

    color_scheme: str = "dark"
    time_format: str = "24h"
    date_format: str = "YYYY-MM-DD"
    show_completed_tasks: bool = False

    # Scheduling preferences (fetched from server)
    batch_similar_tasks: bool = True
    respect_energy_patterns: bool = True
    energy_match_bonus: float = 0.15
    max_deep_work_stretch: int = 120

def load_client_config(config_path: Optional[str] = None) -> ClientConfig:
    """Load client configuration from YAML file"""
    if config_path is None:
        config_path = "./config/client.yaml"

    config_file = Path(config_path)

    if not config_file.exists():
        return ClientConfig()

    try:
        with open(config_file, 'r') as f:
            config_data = yaml.safe_load(f)

        flat_config = {}

        if 'server' in config_data:
            flat_config['server_url'] = config_data['server'].get('url', 'http://localhost:3000')
            flat_config['api_key'] = config_data['server'].get('api_key')

        if 'local' in config_data:
            flat_config.update(config_data['local'])

        if 'display' in config_data:
            flat_config.update(config_data['display'])

        if 'scheduling' in config_data:
            prefs = config_data['scheduling'].get('preferences', {})
            flat_config['batch_similar_tasks'] = prefs.get('batch_similar_tasks', True)
            flat_config['respect_energy_patterns'] = prefs.get('respect_energy_patterns', True)
            flat_config['energy_match_bonus'] = prefs.get('energy_match_bonus', 0.15)
            flat_config['max_deep_work_stretch'] = prefs.get('max_deep_work_stretch', 120)

        return ClientConfig(**flat_config)

    except Exception as e:
        print(f"Warning: Error loading config from {config_path}: {e}")
        return ClientConfig()
