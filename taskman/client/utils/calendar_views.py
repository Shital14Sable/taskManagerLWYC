"""
Calendar visualization system for TaskMan
Provides day, week, and month views with rich formatting
NOW WITH HABIT SUPPORT - distinguishes habits from regular tasks
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich.layout import Layout
from rich import box

console = Console()

# Color schemes for projects (cycles through these)
PROJECT_COLORS = [
    "cyan", "magenta", "yellow", "green", "blue", 
    "red", "bright_cyan", "bright_magenta", "bright_yellow"
]

# Priority colors
PRIORITY_COLORS = {
    1: "bright_red",
    2: "red", 
    3: "yellow",
    4: "blue",
    5: "dim"
}

# Difficulty indicators
DIFFICULTY_ICONS = {
    1: "●",      # Very easy
    2: "●●",     # Easy
    3: "●●●",    # Medium
    4: "●●●●",   # Hard
    5: "●●●●●"   # Very hard
}

# Status icons
STATUS_ICONS = {
    "todo": "○",
    "in_progress": "◐",
    "completed": "●",
    "blocked": "✖"
}


class CalendarViewer:
    """Main calendar visualization class"""
    
    def __init__(self, client):
        self.client = client
        self.project_colors = {}
        self._assign_project_colors()
    
    def _assign_project_colors(self):
        """Assign consistent colors to projects"""
        projects = self.client.list_projects()
        for i, proj in enumerate(projects):
            color_idx = i % len(PROJECT_COLORS)
            self.project_colors[proj['id']] = PROJECT_COLORS[color_idx]
    
    def _get_project_color(self, project_id: str) -> str:
        """Get color for a project"""
        if project_id not in self.project_colors:
            self._assign_project_colors()
        return self.project_colors.get(project_id, "white")
    
    def day_view(self, target_date: date, view_mode: str = "all"):
        """
        Detailed day view with timeline - NOW WITH HABIT DISTINCTION
        
        Args:
            target_date: Date to view
            view_mode: 'all', 'pending', 'completed', 'habits', or 'tasks'
        """
        try:
            schedule = self.client.get_schedule(target_date.isoformat())
        except:
            console.print(f"[yellow]No schedule found for {target_date}. Generate one first.[/yellow]")
            return
        
        # Get all tasks for this date
        all_tasks = self.client.list_tasks()
        task_map = {t['id']: t for t in all_tasks}
        
        # Get projects for color mapping
        projects = self.client.list_projects()
        project_map = {p['id']: p for p in projects}
        
        # Separate habits from regular tasks
        scheduled_tasks = schedule['scheduled_tasks']
        habit_tasks = []
        regular_tasks = []
        breaks = []
        
        for st in scheduled_tasks:
            if st['is_buffer']:
                breaks.append(st)
                continue
            
            task = task_map.get(st['task_id'])
            if not task:
                continue
            
            # Check if completed
            is_completed = st['task_id'] in schedule.get('completed_tasks', [])
            
            # Filter by view mode
            if view_mode == 'completed' and not is_completed:
                continue
            if view_mode == 'pending' and is_completed:
                continue
            if view_mode == 'habits' and not task.get('is_habit'):
                continue
            if view_mode == 'tasks' and task.get('is_habit'):
                continue
            
            # Add to appropriate list
            task_with_schedule = {**task, 'scheduled_time': st}
            if task.get('is_habit'):
                habit_tasks.append(task_with_schedule)
            else:
                regular_tasks.append(task_with_schedule)
        
        # Create title
        day_name = target_date.strftime("%A")
        date_str = target_date.strftime("%B %d, %Y")
        title = f"📅 {day_name}, {date_str}"
        
        if view_mode != 'all':
            title += f" ({view_mode.title()})"
        
        console.print(f"\n[bold cyan]{title}[/bold cyan]\n")
        
        # Summary panel
        summary = schedule['summary']
        habit_count = len(habit_tasks)
        task_count = len(regular_tasks)
        
        summary_text = f"""
Regular Tasks: {task_count}
Habits/Routines: {habit_count}
Breaks: {len(breaks)}
Completed: {summary['tasks_completed']} ({summary['completion_rate']*100:.0f}%)
Time Planned: {summary['total_scheduled_minutes']} minutes
Time Spent: {summary['total_completed_minutes']} minutes
        """
        console.print(Panel(summary_text.strip(), title="Summary", border_style="blue", width=50))
        
        # Create combined table showing everything with visual distinction
        table = Table(
            title="Complete Schedule",
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
            expand=True
        )
        
        table.add_column("Time", style="cyan", width=13)
        table.add_column("Type", width=8)
        table.add_column("Duration", justify="right", width=8)
        table.add_column("Task", style="bold", no_wrap=False)
        table.add_column("Project", style="dim", width=20)
        table.add_column("P", justify="center", width=3)
        table.add_column("D", justify="center", width=5)
        table.add_column("Status", justify="center", width=8)
        
        # Combine and sort all items by time
        all_items = []
        
        for task_info in habit_tasks:
            task = task_info
            st = task_info['scheduled_time']
            all_items.append(('habit', st['start_time'], task, st))
        
        for task_info in regular_tasks:
            task = task_info
            st = task_info['scheduled_time']
            all_items.append(('task', st['start_time'], task, st))
        
        for brk in breaks:
            all_items.append(('break', brk['start_time'], None, brk))
        
        all_items.sort(key=lambda x: x[1])
        
        for item_type, _, task, st in all_items:
            if item_type == 'break':
                # Break row
                table.add_row(
                    f"{st['start_time']} - {st['end_time']}",
                    "[dim]break[/dim]",
                    f"{st['estimated_minutes']}m",
                    "☕ Break",
                    "-",
                    "-",
                    "-",
                    "[dim]break[/dim]"
                )
            else:
                project = project_map.get(task['project_id'])
                project_name = project['name'][:20] if project else task['project_id']
                
                # Get colors
                color = self._get_project_color(task['project_id'])
                priority_color = PRIORITY_COLORS.get(task['priority'], "white")
                
                # Status
                is_completed = st['task_id'] in schedule.get('completed_tasks', [])
                status = "✅ Done" if is_completed else STATUS_ICONS.get(task['status'], "○") + " " + task['status']
                
                # Type indicator and formatting
                if item_type == 'habit':
                    type_indicator = "[bold yellow]HABIT[/bold yellow]"
                    # Habits get special 🔄 icon
                    title = f"🔄 {task['title']}"
                else:
                    type_indicator = "[dim]task[/dim]"
                    energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[task['energy_level']]
                    title = f"{energy_icon} {task['title']}"
                
                # Title formatting
                if is_completed:
                    title_text = f"[{color} strike]{title}[/{color} strike]"
                else:
                    title_text = f"[{color}]{title}[/{color}]"
                
                # Difficulty
                diff_icons = DIFFICULTY_ICONS.get(task['difficulty'], "●")
                
                # Priority
                priority_display = f"[{priority_color}]{task['priority']}[/{priority_color}]"
                
                table.add_row(
                    f"{st['start_time']} - {st['end_time']}",
                    type_indicator,
                    f"{st['estimated_minutes']}m",
                    title_text,
                    f"[{color}]{project_name}[/{color}]",
                    priority_display,
                    diff_icons,
                    status
                )
        
        console.print(table)
        console.print()
    
    def week_view(self, start_date: date, view_mode: str = "all"):
        """
        Week view showing 7 days
        
        Args:
            start_date: First day of week (usually Monday)
            view_mode: 'all', 'pending', or 'completed'
        """
        # Ensure start_date is Monday
        days_since_monday = start_date.weekday()
        monday = start_date - timedelta(days=days_since_monday)
        
        title = f"📅 Week of {monday.strftime('%B %d, %Y')}"
        if view_mode != 'all':
            title += f" - {view_mode.title()} Tasks"
        
        console.print(f"\n[bold cyan]{title}[/bold cyan]\n")
        
        # Create table for the week
        table = Table(
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
            expand=True,
            padding=(0, 1)
        )
        
        # Add columns for each day
        for i in range(7):
            day = monday + timedelta(days=i)
            day_name = day.strftime("%a")
            date_str = day.strftime("%m/%d")
            
            # Highlight today
            if day == date.today():
                header = f"[bold yellow]{day_name}\n{date_str}[/bold yellow]"
            else:
                header = f"{day_name}\n{date_str}"
            
            table.add_column(header, justify="left", no_wrap=False, vertical="top")
        
        # Get schedules for all 7 days
        week_schedules = []
        week_tasks_by_day = []
        
        for i in range(7):
            day = monday + timedelta(days=i)
            try:
                schedule = self.client.get_schedule(day.isoformat())
                week_schedules.append(schedule)
                
                # Get tasks for this day
                all_tasks = self.client.list_tasks()
                task_map = {t['id']: t for t in all_tasks}
                
                day_tasks = []
                for st in schedule['scheduled_tasks']:
                    if st['is_buffer']:
                        continue
                    
                    task = task_map.get(st['task_id'])
                    if not task:
                        continue
                    
                    # Filter by view mode
                    is_completed = st['task_id'] in schedule.get('completed_tasks', [])
                    
                    if view_mode == 'completed' and not is_completed:
                        continue
                    if view_mode == 'pending' and is_completed:
                        continue
                    
                    # Add completion status to task
                    task_copy = task.copy()
                    task_copy['is_completed'] = is_completed
                    task_copy['scheduled_time'] = st['start_time']
                    day_tasks.append(task_copy)
                
                week_tasks_by_day.append(day_tasks)
            except:
                week_schedules.append(None)
                week_tasks_by_day.append([])
        
        # Find max tasks in any day for row count
        max_tasks = max(len(tasks) for tasks in week_tasks_by_day) if week_tasks_by_day else 0
        
        # Build rows
        for row_idx in range(max_tasks):
            row = []
            
            for day_tasks in week_tasks_by_day:
                if row_idx < len(day_tasks):
                    task = day_tasks[row_idx]
                    cell = Text()
                    
                    # Time
                    cell.append(f"{task['scheduled_time']} ", style="dim")
                    
                    # Check if habit
                    is_habit = task.get('is_habit', False)
                    
                    # Status icon
                    if task['is_completed']:
                        cell.append("✅ ", style="green")
                    else:
                        if is_habit:
                            cell.append("🔄 ", style="yellow")
                        else:
                            status_icon = STATUS_ICONS.get(task['status'], "○")
                            cell.append(status_icon + " ", style=self._get_project_color(task['project_id']))
                    
                    # Title
                    title = task['title'][:30]
                    color = self._get_project_color(task['project_id'])
                    
                    if task['is_completed']:
                        cell.append(title, style=f"{color} strike dim")
                    else:
                        if is_habit:
                            cell.append(title, style=f"{color} bold")
                        else:
                            # Energy icon for regular tasks only
                            energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[task['energy_level']]
                            cell.append(f"{energy_icon} {title}", style=color)
                    
                    # Priority badge (only for high priority)
                    if task['priority'] <= 2 and not is_habit:
                        priority_color = PRIORITY_COLORS.get(task['priority'])
                        cell.append(f" P{task['priority']}", style=priority_color)
                    
                    row.append(cell)
                else:
                    row.append("")
            
            table.add_row(*row)
        
        console.print(table)
        
        # Week summary
        total_tasks = sum(len(tasks) for tasks in week_tasks_by_day)
        completed_tasks = sum(
            1 for day_tasks in week_tasks_by_day 
            for task in day_tasks if task.get('is_completed')
        )
        
        summary = f"""
Total Tasks: {total_tasks}
Completed: {completed_tasks} ({completed_tasks/total_tasks*100:.0f}% if total_tasks > 0 else 0)
Remaining: {total_tasks - completed_tasks}
        """
        console.print(Panel(summary.strip(), title="Week Summary", border_style="blue", width=40))
        console.print()

    def month_view(self, year: int, month: int, view_mode: str = "all"):
        """
        Month calendar view
        
        Args:
            year: Year
            month: Month (1-12)
            view_mode: 'all', 'pending', or 'completed'
        """
        from calendar import monthcalendar, month_name
        
        title = f"📅 {month_name[month]} {year}"
        if view_mode != 'all':
            title += f" - {view_mode.title()} Tasks"
        
        console.print(f"\n[bold cyan]{title}[/bold cyan]\n")
        
        # Get calendar grid
        cal = monthcalendar(year, month)
        
        # Create table
        table = Table(
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
            expand=True,
            padding=(1, 1)
        )
        
        # Add day headers
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for day_name in day_names:
            table.add_column(day_name, justify="left", vertical="top", width=15)
        
        # Get all tasks for the month
        all_tasks = self.client.list_tasks()
        task_map = {t['id']: t for t in all_tasks}
        
        # Build rows
        for week in cal:
            row = []
            
            for day_num in week:
                if day_num == 0:
                    # Empty cell
                    row.append("")
                    continue
                
                cell = Text()
                day_date = date(year, month, day_num)
                
                # Highlight today
                if day_date == date.today():
                    cell.append(f"{day_num:2d}", style="bold yellow on blue")
                else:
                    cell.append(f"{day_num:2d}", style="bold")
                
                cell.append("\n")
                
                # Get schedule for this day
                try:
                    schedule = self.client.get_schedule(day_date.isoformat())
                    
                    # Collect tasks
                    day_tasks = []
                    for st in schedule['scheduled_tasks']:
                        if st['is_buffer']:
                            continue
                        
                        task = task_map.get(st['task_id'])
                        if not task:
                            continue
                        
                        is_completed = st['task_id'] in schedule.get('completed_tasks', [])
                        
                        # Filter by view mode
                        if view_mode == 'completed' and not is_completed:
                            continue
                        if view_mode == 'pending' and is_completed:
                            continue
                        
                        task_copy = task.copy()
                        task_copy['is_completed'] = is_completed
                        task_copy['is_habit'] = task.get('is_habit', False)
                        day_tasks.append(task_copy)
                    
                    # Show task dots (colored by project, shaped by status/type)
                    for i, task in enumerate(day_tasks[:5]):
                        if i > 0 and i % 5 == 0:
                            cell.append("\n")
                        
                        color = self._get_project_color(task['project_id'])
                        
                        if task['is_completed']:
                            cell.append("✓", style=f"{color} dim")
                        elif task.get('is_habit'):
                            # Habits shown as circles
                            cell.append("○", style=f"{color} bold")
                        else:
                            # Priority-based size for regular tasks
                            if task['priority'] == 1:
                                cell.append("◆", style=color)  # High priority
                            elif task['priority'] <= 3:
                                cell.append("●", style=color)  # Normal
                            else:
                                cell.append("·", style=f"{color} dim")  # Low priority
                    
                    if len(day_tasks) > 5:
                        cell.append(f"\n+{len(day_tasks)-5}", style="dim")
                    
                except:
                    cell.append("[dim]no data[/dim]")
                
                row.append(cell)
            
            table.add_row(*row)
        
        console.print(table)
        
        # Month summary
        console.print("\n[bold]Legend:[/bold]")
        console.print("  ◆ High Priority Task  ● Normal Priority  · Low Priority")
        console.print("  ○ Habit/Routine")
        console.print("  ✓ Completed")
        console.print()
    
    def project_timeline(self, project_name_or_id: str, days: int = 14):
        """
        Timeline view for a specific project
        
        Args:
            project_name_or_id: Project name or ID
            days: Number of days to show (default 14)
        """
        # Find project
        projects = self.client.list_projects()
        project = None
        
        for p in projects:
            if p['id'] == project_name_or_id or project_name_or_id.lower() in p['name'].lower():
                project = p
                break
        
        if not project:
            console.print(f"[red]Project '{project_name_or_id}' not found[/red]")
            return
        
        console.print(f"\n[bold cyan]📊 Project Timeline: {project['name']}[/bold cyan]\n")
        
        # Get all tasks for this project
        tasks = self.client.list_tasks(project_id=project['id'])
        
        if not tasks:
            console.print("[yellow]No tasks in this project[/yellow]")
            return
        
        # Create timeline table
        table = Table(
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
            expand=True
        )
        
        table.add_column("Date", style="cyan", width=12)
        table.add_column("Tasks", no_wrap=False)
        
        # Check schedules for next N days
        today = date.today()
        color = self._get_project_color(project['id'])
        
        for i in range(days):
            check_date = today + timedelta(days=i)
            
            try:
                schedule = self.client.get_schedule(check_date.isoformat())
                task_map = {t['id']: t for t in tasks}
                
                # Find this project's tasks in schedule
                day_tasks = []
                for st in schedule['scheduled_tasks']:
                    if st['is_buffer']:
                        continue
                    
                    task = task_map.get(st['task_id'])
                    if task:
                        task_copy = task.copy()
                        task_copy['scheduled_time'] = st['start_time']
                        task_copy['is_completed'] = st['task_id'] in schedule.get('completed_tasks', [])
                        day_tasks.append(task_copy)
                
                if day_tasks:
                    date_str = check_date.strftime("%a %m/%d")
                    if check_date == today:
                        date_str = f"[bold yellow]{date_str}[/bold yellow]"
                    
                    tasks_text = Text()
                    for idx, task in enumerate(day_tasks):
                        if idx > 0:
                            tasks_text.append("\n")
                        
                        # Time and status
                        tasks_text.append(f"{task['scheduled_time']} ", style="dim")
                        
                        if task['is_completed']:
                            tasks_text.append("✅ ", style="green")
                            tasks_text.append(task['title'], style=f"{color} strike")
                        else:
                            energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[task['energy_level']]
                            tasks_text.append(f"{energy_icon} ", style=color)
                            tasks_text.append(task['title'], style=color)
                        
                        # Priority
                        if task['priority'] <= 2:
                            tasks_text.append(f" P{task['priority']}", style=PRIORITY_COLORS[task['priority']])
                    
                    table.add_row(date_str, tasks_text)
            except:
                continue
        
        console.print(table)
        console.print()


# Convenience functions for CLI integration

def show_day(client, target_date: date = None, view_mode: str = "all"):
    """Show day view"""
    if target_date is None:
        target_date = date.today()
    
    viewer = CalendarViewer(client)
    viewer.day_view(target_date, view_mode)


def show_week(client, start_date: date = None, view_mode: str = "all"):
    """Show week view"""
    if start_date is None:
        start_date = date.today()
    
    viewer = CalendarViewer(client)
    viewer.week_view(start_date, view_mode)


def show_month(client, year: int = None, month: int = None, view_mode: str = "all"):
    """Show month view"""
    if year is None or month is None:
        today = date.today()
        year = today.year
        month = today.month
    
    viewer = CalendarViewer(client)
    viewer.month_view(year, month, view_mode)


def show_project_timeline(client, project: str, days: int = 14):
    """Show project timeline"""
    viewer = CalendarViewer(client)
    viewer.project_timeline(project, days)