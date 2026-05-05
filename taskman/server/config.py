"""
Server configuration management
"""
import yaml
from pathlib import Path
from typing import Optional, Dict, Any
from pydantic import BaseModel

class ServerConfig(BaseModel):
    """Server configuration model"""
    host: str = "0.0.0.0"
    port: int = 3000
    log_level: str = "info"
    cors_origins: list = ["*"]
    
    data_dir: str = "./data"
    backup_dir: str = "./data/backups"
    max_backups: int = 30
    enable_auto_backup: bool = True
    auto_backup_time: str = "02:00"
    
    auto_reschedule_enabled: bool = True
    auto_reschedule_time: str = "22:00"
    default_work_start: str = "08:00"
    default_work_end: str = "22:00"
    buffer_percentage: int = 10
    max_deep_work_minutes: int = 120
    
    conflict_resolution: str = "server_wins"
    sync_interval_seconds: int = 300
    max_sync_retries: int = 3
    
    log_file: str = "./logs/server.log"
    log_max_size_mb: int = 100
    log_backup_count: int = 5

def load_server_config(config_path: Optional[str] = None) -> ServerConfig:
    """
    Load server configuration from YAML file
    
    Args:
        config_path: Path to config file. If None, uses default location.
    
    Returns:
        ServerConfig instance with loaded or default values
    """
    if config_path is None:
        config_path = "./config/server.yaml"
    
    config_file = Path(config_path)
    
    if not config_file.exists():
        # Return default configuration
        return ServerConfig()
    
    try:
        with open(config_file, 'r') as f:
            config_data = yaml.safe_load(f)
        
        # Flatten nested structure if needed
        flat_config = {}
        
        if 'server' in config_data:
            flat_config.update(config_data['server'])
        
        if 'storage' in config_data:
            flat_config.update(config_data['storage'])
        
        if 'scheduling' in config_data:
            flat_config.update(config_data['scheduling'])
        
        if 'sync' in config_data:
            flat_config.update(config_data['sync'])
        
        if 'logging' in config_data:
            flat_config['log_file'] = config_data['logging'].get('file', './logs/server.log')
            flat_config['log_max_size_mb'] = config_data['logging'].get('max_size_mb', 100)
            flat_config['log_backup_count'] = config_data['logging'].get('backup_count', 5)
        
        return ServerConfig(**flat_config)
    
    except Exception as e:
        print(f"Warning: Error loading config from {config_path}: {e}")
        print("Using default configuration")
        return ServerConfig()

def save_server_config(config: ServerConfig, config_path: Optional[str] = None):
    """
    Save server configuration to YAML file
    
    Args:
        config: ServerConfig instance to save
        config_path: Path to save config file
    """
    if config_path is None:
        config_path = "./config/server.yaml"
    
    config_file = Path(config_path)
    config_file.parent.mkdir(parents=True, exist_ok=True)
    
    # Structure config data
    config_data = {
        'server': {
            'host': config.host,
            'port': config.port,
            'log_level': config.log_level,
            'cors_origins': config.cors_origins
        },
        'storage': {
            'data_dir': config.data_dir,
            'backup_dir': config.backup_dir,
            'max_backups': config.max_backups,
            'enable_auto_backup': config.enable_auto_backup,
            'auto_backup_time': config.auto_backup_time
        },
        'scheduling': {
            'auto_reschedule_enabled': config.auto_reschedule_enabled,
            'auto_reschedule_time': config.auto_reschedule_time,
            'default_work_start': config.default_work_start,
            'default_work_end': config.default_work_end,
            'buffer_percentage': config.buffer_percentage,
            'max_deep_work_minutes': config.max_deep_work_minutes
        },
        'sync': {
            'conflict_resolution': config.conflict_resolution,
            'sync_interval_seconds': config.sync_interval_seconds,
            'max_sync_retries': config.max_sync_retries
        },
        'logging': {
            'file': config.log_file,
            'max_size_mb': config.log_max_size_mb,
            'backup_count': config.log_backup_count
        }
    }
    
    with open(config_file, 'w') as f:
        yaml.dump(config_data, f, default_flow_style=False, sort_keys=False)