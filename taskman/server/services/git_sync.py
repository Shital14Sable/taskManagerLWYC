"""
Git Auto-Sync Service

Provides Obsidian-style automatic git synchronization for the data directory:
- Auto-pull every 2 minutes
- Auto-push every 2 minutes (only if changes detected)
- Handles merge conflicts gracefully

The data directory should be a separate git repository from the code.
Users can create their own private repo for data sync across machines.
"""

import os
import subprocess
import threading
import time
import logging
from pathlib import Path
from typing import Optional, Callable
from datetime import datetime

logger = logging.getLogger(__name__)


def get_data_dir() -> Path:
    """Get data directory from environment or default."""
    data_dir = os.environ.get('TASKMAN_DATA_DIR', './data')
    return Path(data_dir).expanduser().resolve()


class GitSyncService:
    """
    Automatic git synchronization service.

    Syncs data directory changes via git at regular intervals,
    similar to Obsidian Git plugin behavior.
    """

    def __init__(
        self,
        repo_path: str = ".",
        sync_interval_seconds: int = 120,  # 2 minutes
        data_paths: list[str] = None,
        on_sync_complete: Optional[Callable[[bool, str], None]] = None,
        on_conflict: Optional[Callable[[str], None]] = None
    ):
        """
        Initialize git sync service.

        Args:
            repo_path: Path to git repository root
            sync_interval_seconds: Interval between sync attempts (default 120s = 2 min)
            data_paths: List of paths to track for changes (default: ["data/"])
            on_sync_complete: Callback when sync completes (success: bool, message: str)
            on_conflict: Callback when merge conflict occurs
        """
        self.repo_path = Path(repo_path).resolve()
        self.sync_interval = sync_interval_seconds
        self.data_paths = data_paths or ["data/"]
        self.on_sync_complete = on_sync_complete
        self.on_conflict = on_conflict

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_sync: Optional[datetime] = None
        self._sync_count = 0
        self._error_count = 0

    def _run_git(self, *args, check: bool = True) -> subprocess.CompletedProcess:
        """Run a git command in the repo directory."""
        cmd = ["git", "-C", str(self.repo_path)] + list(args)
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=check
            )
            return result
        except subprocess.CalledProcessError as e:
            logger.error(f"Git command failed: {' '.join(cmd)}")
            logger.error(f"stderr: {e.stderr}")
            raise

    def _has_changes(self) -> bool:
        """Check if there are uncommitted changes in tracked data paths."""
        try:
            # Check for any changes (staged or unstaged) in data paths
            result = self._run_git("status", "--porcelain", *self.data_paths, check=False)
            return bool(result.stdout.strip())
        except Exception as e:
            logger.error(f"Error checking for changes: {e}")
            return False

    def _has_any_changes(self) -> bool:
        """Check if there are ANY uncommitted changes in the entire repo."""
        try:
            result = self._run_git("status", "--porcelain", check=False)
            return bool(result.stdout.strip())
        except Exception as e:
            logger.error(f"Error checking for changes: {e}")
            return False

    def _has_remote(self) -> bool:
        """Check if a remote origin exists."""
        try:
            result = self._run_git("remote", "get-url", "origin", check=False)
            return result.returncode == 0
        except Exception:
            return False

    def _get_current_branch(self) -> Optional[str]:
        """Get current branch name."""
        try:
            result = self._run_git("branch", "--show-current")
            return result.stdout.strip()
        except Exception:
            return None

    def pull(self) -> tuple[bool, str]:
        """
        Pull latest changes from remote.

        Returns:
            Tuple of (success, message)
        """
        if not self._has_remote():
            return True, "No remote configured, skipping pull"

        branch = self._get_current_branch()
        if not branch:
            return False, "Could not determine current branch"

        try:
            # Check for ANY changes in the repo (not just data paths)
            has_any_changes = self._has_any_changes()

            # Stash ALL local changes first (not just data paths)
            if has_any_changes:
                stash_result = self._run_git("stash", "push", "--include-untracked", "-m", "git-sync-auto-stash", check=False)
                if stash_result.returncode != 0:
                    logger.warning(f"Stash failed: {stash_result.stderr}")

            # Pull with rebase to keep history clean
            result = self._run_git("pull", "--rebase", "origin", branch, check=False)

            if result.returncode != 0:
                if "CONFLICT" in result.stdout or "CONFLICT" in result.stderr:
                    # Abort rebase and restore
                    self._run_git("rebase", "--abort", check=False)
                    if has_any_changes:
                        self._run_git("stash", "pop", check=False)

                    if self.on_conflict:
                        self.on_conflict(result.stderr)
                    return False, f"Merge conflict detected: {result.stderr}"

                # Restore stash even on failure
                if has_any_changes:
                    self._run_git("stash", "pop", check=False)
                return False, f"Pull failed: {result.stderr}"

            # Restore stashed changes
            if has_any_changes:
                stash_result = self._run_git("stash", "pop", check=False)
                if stash_result.returncode != 0 and "CONFLICT" in stash_result.stderr:
                    if self.on_conflict:
                        self.on_conflict(stash_result.stderr)
                    return False, f"Conflict applying stashed changes: {stash_result.stderr}"

            return True, "Pull successful"

        except Exception as e:
            return False, f"Pull error: {str(e)}"

    def push(self, message: Optional[str] = None) -> tuple[bool, str]:
        """
        Commit and push changes if any exist.

        Args:
            message: Custom commit message (default: auto-generated)

        Returns:
            Tuple of (success, message)
        """
        if not self._has_changes():
            return True, "No changes to push"

        if not self._has_remote():
            return True, "No remote configured, changes committed locally only"

        branch = self._get_current_branch()
        if not branch:
            return False, "Could not determine current branch"

        try:
            # Add data files
            for path in self.data_paths:
                self._run_git("add", path, check=False)

            # Create commit message
            if message is None:
                timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                message = f"Auto-sync: {timestamp}"

            # Commit
            commit_result = self._run_git("commit", "-m", message, check=False)
            if commit_result.returncode != 0 and "nothing to commit" not in commit_result.stdout:
                return False, f"Commit failed: {commit_result.stderr}"

            # Push
            push_result = self._run_git("push", "origin", branch, check=False)
            if push_result.returncode != 0:
                # Try pull then push if push failed
                pull_success, pull_msg = self.pull()
                if not pull_success:
                    return False, f"Push failed, pull also failed: {pull_msg}"

                # Retry push
                push_result = self._run_git("push", "origin", branch, check=False)
                if push_result.returncode != 0:
                    return False, f"Push failed after pull: {push_result.stderr}"

            return True, "Push successful"

        except Exception as e:
            return False, f"Push error: {str(e)}"

    def sync(self) -> tuple[bool, str]:
        """
        Perform a full sync cycle: pull then push.

        Returns:
            Tuple of (success, message)
        """
        # Pull first
        pull_success, pull_msg = self.pull()
        if not pull_success:
            logger.warning(f"Pull failed during sync: {pull_msg}")
            # Continue with push attempt anyway

        # Then push
        push_success, push_msg = self.push()

        self._last_sync = datetime.now()
        self._sync_count += 1

        if pull_success and push_success:
            message = f"Sync complete: {pull_msg}, {push_msg}"
            if self.on_sync_complete:
                self.on_sync_complete(True, message)
            return True, message
        else:
            self._error_count += 1
            message = f"Sync partial: pull={pull_msg}, push={push_msg}"
            if self.on_sync_complete:
                self.on_sync_complete(False, message)
            return False, message

    def _sync_loop(self):
        """Background sync loop."""
        logger.info(f"Git sync started (interval: {self.sync_interval}s)")

        # Initial sync on startup
        success, msg = self.sync()
        logger.info(f"Initial sync: {msg}")

        while self._running:
            time.sleep(self.sync_interval)
            if not self._running:
                break

            try:
                success, msg = self.sync()
                if success:
                    logger.debug(f"Sync completed: {msg}")
                else:
                    logger.warning(f"Sync issue: {msg}")
            except Exception as e:
                logger.error(f"Sync loop error: {e}")
                self._error_count += 1

    def start(self):
        """Start the background sync thread."""
        if self._running:
            logger.warning("Git sync already running")
            return

        self._running = True
        self._thread = threading.Thread(target=self._sync_loop, daemon=True)
        self._thread.start()
        logger.info("Git auto-sync service started")

    def stop(self):
        """Stop the background sync and perform final sync."""
        if not self._running:
            return

        logger.info("Stopping git sync service...")
        self._running = False

        # Final sync before shutdown
        try:
            success, msg = self.sync()
            logger.info(f"Final sync on shutdown: {msg}")
        except Exception as e:
            logger.error(f"Final sync failed: {e}")

        if self._thread:
            self._thread.join(timeout=5)

    def status(self) -> dict:
        """Get current sync status."""
        return {
            "running": self._running,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "sync_count": self._sync_count,
            "error_count": self._error_count,
            "sync_interval_seconds": self.sync_interval,
            "has_remote": self._has_remote(),
            "current_branch": self._get_current_branch(),
            "has_uncommitted_changes": self._has_changes()
        }


# Global instance for use across the application
_git_sync_instance: Optional[GitSyncService] = None


def get_git_sync() -> Optional[GitSyncService]:
    """Get the global git sync instance."""
    return _git_sync_instance


def init_git_sync(
    repo_path: Optional[str] = None,
    sync_interval_seconds: int = 120,
    auto_start: bool = True
) -> Optional[GitSyncService]:
    """
    Initialize and optionally start the global git sync service.

    The git sync service operates on the data directory, which should be
    a separate git repository for user data.

    Args:
        repo_path: Path to git repository (default: data directory from env)
        sync_interval_seconds: Sync interval (default 2 minutes)
        auto_start: Whether to start the service immediately

    Returns:
        GitSyncService instance, or None if data dir is not a git repo
    """
    global _git_sync_instance

    # Use data directory as the repo path by default
    if repo_path is None:
        repo_path = str(get_data_dir())

    repo = Path(repo_path)

    # Check if the data directory is a git repository
    if not (repo / ".git").exists():
        logger.info(f"Data directory {repo} is not a git repo. Git sync disabled.")
        logger.info("To enable sync, run: cd <data_dir> && git init && git remote add origin <your-private-repo>")
        return None

    _git_sync_instance = GitSyncService(
        repo_path=repo_path,
        sync_interval_seconds=sync_interval_seconds,
        data_paths=["."]  # Sync everything in the data repo
    )

    if auto_start:
        _git_sync_instance.start()

    return _git_sync_instance
