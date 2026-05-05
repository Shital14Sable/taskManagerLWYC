"""
Main Textual TUI application
"""
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Header, Footer, Static
from textual.containers import Container
from taskman.client.tui.screens.dashboard import DashboardScreen
from taskman.client.tui.screens.projects import ProjectsScreen
from taskman.client.tui.screens.schedule import ScheduleScreen

class TaskManApp(App):
    """Main TUI application"""
    
    CSS = """
    Screen {
        background: $surface;
    }
    
    .header {
        dock: top;
        height: 3;
        background: $primary;
        color: $text;
    }
    
    .footer {
        dock: bottom;
        height: 1;
        background: $primary-darken-2;
    }
    """
    
    BINDINGS = [
        Binding("d", "show_dashboard", "Dashboard", show=True),
        Binding("p", "show_projects", "Projects", show=True),
        Binding("s", "show_schedule", "Schedule", show=True),
        Binding("q", "quit", "Quit", show=True),
        Binding("r", "refresh", "Refresh", show=True),
    ]
    
    def __init__(self, server_url: str = "http://localhost:3000"):
        super().__init__()
        self.server_url = server_url
        self.title = "TaskMan - Smart Task Manager"
        self.sub_title = "Press 'd' for Dashboard, 'p' for Projects, 's' for Schedule"
    
    def compose(self) -> ComposeResult:
        """Create child widgets"""
        yield Header()
        yield Container(id="main")
        yield Footer()
    
    def on_mount(self) -> None:
        """When app is mounted, show dashboard"""
        self.push_screen(DashboardScreen(self.server_url))
    
    def action_show_dashboard(self) -> None:
        """Show dashboard screen"""
        self.push_screen(DashboardScreen(self.server_url))
    
    def action_show_projects(self) -> None:
        """Show projects screen"""
        self.push_screen(ProjectsScreen(self.server_url))
    
    def action_show_schedule(self) -> None:
        """Show schedule screen"""
        self.push_screen(ScheduleScreen(self.server_url))
    
    def action_refresh(self) -> None:
        """Refresh current screen"""
        if hasattr(self.screen, 'refresh_data'):
            self.screen.refresh_data()
    
    def action_quit(self) -> None:
        """Quit the application"""
        self.exit()

def run_tui(server_url: str = "http://localhost:3000"):
    """Run the TUI application"""
    app = TaskManApp(server_url)
    app.run()