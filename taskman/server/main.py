from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import threading
import time
import signal
import sys
import schedule as sched
from pathlib import Path

from taskman.server.api import projects, tasks, schedule, sync, preferences, analytics, calendar, gamification, search, habits, lists, goals, notes, reviews, export
from taskman.server.services.storage import StorageManager
from taskman.server.services.scheduler import Scheduler
from taskman.server.services.git_sync import init_git_sync, get_git_sync
from taskman.server.services.gamification import GamificationService


def get_web_dist_path() -> Path:
    """Get the path to web/dist folder, checking multiple locations."""
    # Check relative to this file's location (package installation)
    package_dir = Path(__file__).parent.parent.parent  # taskman/server/main.py -> task_manager root
    web_dist = package_dir / "web" / "dist"
    if web_dist.exists():
        return web_dist

    # Check current working directory (development mode)
    cwd_dist = Path("./web/dist")
    if cwd_dist.exists():
        return cwd_dist

    return None


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(title="TaskMan API", version="0.1.0")

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Initialize storage
    storage = StorageManager()
    scheduler_service = Scheduler(storage)
    gamification_service = GamificationService(storage.data_dir, storage=storage)

    # Store in app state
    app.state.storage = storage
    app.state.scheduler = scheduler_service
    app.state.gamification = gamification_service

    # Include API routers
    app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
    app.include_router(tasks.router, prefix="/api/tasks", tags=["tasks"])
    app.include_router(schedule.router, prefix="/api/schedule", tags=["schedule"])
    app.include_router(sync.router, prefix="/api/sync", tags=["sync"])
    app.include_router(preferences.router, prefix="/api/preferences", tags=["preferences"])
    app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
    app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
    app.include_router(gamification.router, prefix="/api/gamification", tags=["gamification"])
    app.include_router(search.router, prefix="/api/search", tags=["search"])
    app.include_router(habits.router, prefix="/api/habits", tags=["habits"])
    app.include_router(lists.router, prefix="/api/lists", tags=["lists"])
    app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
    app.include_router(notes.router, prefix="/api/notes", tags=["notes"])
    app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
    app.include_router(export.router, prefix="/api/export", tags=["export"])

    @app.get("/health")
    def health():
        return {"status": "ok"}

    # Check if web UI exists
    web_dist = get_web_dist_path()

    if web_dist:
        web_index = web_dist / "index.html"
        web_assets = web_dist / "assets"
        # Mount static assets directory
        if web_assets.exists():
            app.mount("/assets", StaticFiles(directory=str(web_assets)), name="assets")

        # Serve SPA for root
        @app.get("/")
        async def serve_root():
            return FileResponse(str(web_index))

        # Catch-all for SPA routing (must be last)
        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Check if it's a static file
            file_path = web_dist / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(str(file_path))
            # Serve index.html for SPA routing
            return FileResponse(str(web_index))
    else:
        # API-only mode
        @app.get("/")
        def root():
            return {"message": "TaskMan API", "version": "0.1.0", "docs": "/docs"}

    return app


# Create app instance
app = create_app()


def run_background_scheduler():
    """Run scheduled background tasks"""
    def auto_reschedule():
        """Auto-reschedule at configured time"""
        # TODO: Implement auto-rescheduling
        pass

    def auto_backup():
        """Auto-backup at configured time"""
        # TODO: Implement auto-backup
        pass

    # Schedule tasks
    sched.every().day.at("22:00").do(auto_reschedule)
    sched.every().day.at("02:00").do(auto_backup)

    while True:
        sched.run_pending()
        time.sleep(60)


def start_server(enable_git_sync: bool = True, git_sync_interval: int = 120):
    """
    Start FastAPI server with background tasks and git sync.

    Args:
        enable_git_sync: Whether to enable automatic git synchronization
        git_sync_interval: Sync interval in seconds (default: 120 = 2 minutes)
    """
    import os

    # Get data directory from environment or use default
    data_dir_env = os.environ.get('TASKMAN_DATA_DIR', './data')
    data_dir = Path(data_dir_env).expanduser().resolve()
    data_dir.mkdir(parents=True, exist_ok=True)
    print(f"📁 Data directory: {data_dir}")

    # Initialize git sync service (operates on data directory)
    git_sync = None
    if enable_git_sync:
        print("🔄 Checking for git sync...")
        git_sync = init_git_sync(
            sync_interval_seconds=git_sync_interval,
            auto_start=True
        )
        if git_sync:
            print("✅ Git sync active - data will sync automatically")
        else:
            print("ℹ️  Git sync disabled (data directory is not a git repo)")

    # Start background scheduler in separate thread
    scheduler_thread = threading.Thread(target=run_background_scheduler, daemon=True)
    scheduler_thread.start()

    # Setup graceful shutdown
    def shutdown_handler(signum, frame):
        print("\n🛑 Shutting down...")
        if git_sync:
            print("💾 Final git sync before shutdown...")
            git_sync.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    port = 3000
    host = "localhost"

    # Check if web UI is available
    web_dist = get_web_dist_path()

    print("🚀 TaskMan Server starting...")
    print(f"🌐 Running at:  http://{host}:{port}")
    if web_dist:
        print(f"   Web UI:      http://{host}:{port}")
    print(f"   API docs:    http://{host}:{port}/docs")

    # Start server
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    start_server()
