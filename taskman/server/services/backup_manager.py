"""
Backup management service
"""
import tarfile
import hashlib
import json
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict
from taskman.shared.schemas import BackupMetadata

class BackupManager:
    """Manages backup creation and restoration"""
    
    def __init__(self, data_dir: str = "./data", backup_dir: str = "./data/backups"):
        self.data_dir = Path(data_dir)
        self.backup_dir = Path(backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)
    
    def create_backup(self, label: Optional[str] = None) -> BackupMetadata:
        """
        Create a compressed backup of all data
        
        Args:
            label: Optional label for the backup
        
        Returns:
            BackupMetadata with details of created backup
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_id = f"backup_{timestamp}"
        backup_file = self.backup_dir / f"{backup_id}.tar.gz"
        
        # Create tar.gz archive
        file_count = 0
        total_size = 0
        
        with tarfile.open(backup_file, "w:gz") as tar:
            # Backup data directory
            for item in self.data_dir.rglob("*"):
                if item.is_file() and 'backups' not in str(item):
                    tar.add(item, arcname=item.relative_to(self.data_dir.parent))
                    file_count += 1
                    total_size += item.stat().st_size
            
            # Backup config directory if exists
            config_dir = Path("./config")
            if config_dir.exists():
                for item in config_dir.rglob("*"):
                    if item.is_file():
                        tar.add(item, arcname=item.relative_to(Path(".")))
                        file_count += 1
                        total_size += item.stat().st_size
        
        # Calculate integrity hash
        integrity_hash = self._calculate_file_hash(backup_file)
        
        # Create metadata
        metadata = BackupMetadata(
            backup_id=backup_id,
            created_at=datetime.now(),
            version="0.1.0",
            file_count=file_count,
            total_size_bytes=total_size,
            integrity_hash=integrity_hash,
            label=label,
            auto_backup=False
        )
        
        # Save metadata
        self._save_metadata(backup_id, metadata)
        
        return metadata
    
    def list_backups(self) -> List[BackupMetadata]:
        """List all available backups"""
        backups = []
        
        for backup_file in self.backup_dir.glob("backup_*.tar.gz"):
            metadata_file = self.backup_dir / f"{backup_file.stem}_metadata.json"
            
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    data = json.load(f)
                    backups.append(BackupMetadata(**data))
            else:
                # Create metadata from file if missing
                metadata = BackupMetadata(
                    backup_id=backup_file.stem,
                    created_at=datetime.fromtimestamp(backup_file.stat().st_mtime),
                    version="unknown",
                    file_count=0,
                    total_size_bytes=backup_file.stat().st_size,
                    integrity_hash="",
                    auto_backup=False
                )
                backups.append(metadata)
        
        # Sort by creation date, newest first
        backups.sort(key=lambda x: x.created_at, reverse=True)
        
        return backups
    
    def restore_backup(self, backup_id: str, verify: bool = True) -> bool:
        """
        Restore data from a backup
        
        Args:
            backup_id: ID of backup to restore
            verify: Whether to verify integrity before restoring
        
        Returns:
            True if successful, False otherwise
        """
        backup_file = self.backup_dir / f"{backup_id}.tar.gz"
        
        if not backup_file.exists():
            raise FileNotFoundError(f"Backup {backup_id} not found")
        
        # Verify integrity if requested
        if verify:
            metadata = self._load_metadata(backup_id)
            if metadata and metadata.integrity_hash:
                current_hash = self._calculate_file_hash(backup_file)
                if current_hash != metadata.integrity_hash:
                    raise ValueError(f"Backup integrity check failed for {backup_id}")
        
        # Create backup of current data before restoring
        print("Creating safety backup of current data...")
        safety_backup = self.create_backup(label="Pre-restore safety backup")
        print(f"Safety backup created: {safety_backup.backup_id}")
        
        # Extract backup
        print(f"Restoring backup {backup_id}...")
        with tarfile.open(backup_file, "r:gz") as tar:
            tar.extractall(path=".")
        
        print("Backup restored successfully")
        return True
    
    def verify_backup(self, backup_id: str) -> bool:
        """Verify backup integrity"""
        backup_file = self.backup_dir / f"{backup_id}.tar.gz"
        
        if not backup_file.exists():
            return False
        
        metadata = self._load_metadata(backup_id)
        
        if not metadata or not metadata.integrity_hash:
            return False
        
        current_hash = self._calculate_file_hash(backup_file)
        return current_hash == metadata.integrity_hash
    
    def delete_backup(self, backup_id: str):
        """Delete a backup"""
        backup_file = self.backup_dir / f"{backup_id}.tar.gz"
        metadata_file = self.backup_dir / f"{backup_id}_metadata.json"
        
        if backup_file.exists():
            backup_file.unlink()
        
        if metadata_file.exists():
            metadata_file.unlink()
    
    def rotate_backups(self, max_backups: int = 30):
        """
        Rotate backups, keeping only the most recent max_backups
        
        Args:
            max_backups: Maximum number of backups to keep
        """
        backups = self.list_backups()
        
        if len(backups) <= max_backups:
            return
        
        # Delete oldest backups
        for backup in backups[max_backups:]:
            print(f"Rotating out old backup: {backup.backup_id}")
            self.delete_backup(backup.backup_id)
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of a file"""
        sha256_hash = hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        
        return f"sha256:{sha256_hash.hexdigest()}"
    
    def _save_metadata(self, backup_id: str, metadata: BackupMetadata):
        """Save backup metadata to JSON file"""
        metadata_file = self.backup_dir / f"{backup_id}_metadata.json"
        
        with open(metadata_file, 'w') as f:
            json.dump(metadata.model_dump(mode='json'), f, indent=2, default=str)
    
    def _load_metadata(self, backup_id: str) -> Optional[BackupMetadata]:
        """Load backup metadata from JSON file"""
        metadata_file = self.backup_dir / f"{backup_id}_metadata.json"
        
        if not metadata_file.exists():
            return None
        
        with open(metadata_file, 'r') as f:
            data = json.load(f)
            return BackupMetadata(**data)