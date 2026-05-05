#!/usr/bin/env python3
"""
TaskMan CLI - Enhanced with edit, config, and help commands
"""
import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from taskman.client.services.api_client import APIClient

# Add near the top with other imports
from taskman.client.utils.calendar_views import (
    show_day, show_week, show_month, show_project_timeline
)
from taskman.client.commands import calendar as calendar_commands  


console = Console()


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def find_project_by_name(client, name: str):
    """Find project by name (exact or fuzzy match)"""
    projects = client.list_projects()
    
    # Try exact match first
    for project in projects:
        if project['name'].lower() == name.lower():
            return project
    
    # Try partial match
    matches = [p for p in projects if name.lower() in p['name'].lower()]
    
    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        console.print(f"[yellow]Multiple projects match '{name}':[/yellow]")
        for p in matches:
            console.print(f"  - {p['name']} (ID: {p['id']})")
        raise click.ClickException("Please be more specific")
    
    raise click.ClickException(f"Project '{name}' not found")


def find_task_by_title(client, project_id: str, title: str):
    """Find task by title within a project"""
    tasks = client.list_tasks(project_id=project_id)
    
    # Try exact match
    for task in tasks:
        if task['title'].lower() == title.lower():
            return task
    
    # Try partial match
    matches = [t for t in tasks if title.lower() in t['title'].lower()]
    
    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        console.print(f"[yellow]Multiple tasks match '{title}':[/yellow]")
        for t in matches:
            console.print(f"  - {t['title']} (ID: {t['id']})")
        raise click.ClickException("Please be more specific")
    
    return None


# ============================================================================
# MAIN CLI GROUP
# ============================================================================

@click.group()
@click.option('--server', default='http://localhost:3000', help='Server URL')
@click.pass_context
def cli(ctx, server):
    """TaskMan - Intelligent task management system
    
    Features:
    • Smart auto-scheduling based on energy levels
    • Learns from your work patterns
    • Prevents burnout with automatic breaks
    • Works offline with local cache
    
    Quick Start:
      task project add "My Project"
      task add "My Project" "My Task" --time 60 --energy high
      task schedule generate
      task schedule today
    """
    ctx.ensure_object(dict)
    ctx.obj['server_url'] = server
    ctx.obj['client'] = APIClient(server)


# ============================================================================
# PROJECT COMMANDS
# ============================================================================

@cli.group()
def project():
    """Manage projects"""
    pass


@project.command("add")
@click.argument("name")
@click.option("--description", "-d", help="Project description")
@click.option("--priority", "-p", type=int, default=3, help="Priority (1=highest, 5=lowest)")
@click.pass_context
def project_add(ctx, name, description, priority):
    """Create a new project"""
    client = ctx.obj['client']
    
    try:
        data = {
            "name": name,
            "description": description,
            "priority": priority,
            "tags": []
        }
        result = client.create_project(data)
        console.print(f"[green]✅ Created project: {result['name']} (ID: {result['id']})[/green]")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@project.command("list")
@click.option("--status", help="Filter by status (active/paused/completed)")
@click.pass_context
def project_list(ctx, status):
    """List all projects"""
    client = ctx.obj['client']
    
    try:
        projects = client.list_projects(status=status)
        
        if not projects:
            console.print("[yellow]No projects found.[/yellow]")
            return
        
        table = Table(title="Projects")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="bold")
        table.add_column("Priority", justify="center")
        table.add_column("Status", style="green")
        table.add_column("Tasks", justify="right")
        
        for proj in projects:
            tasks = client.list_tasks(project_id=proj['id'])
            task_count = len(tasks)
            completed = len([t for t in tasks if t['status'] == 'completed'])
            
            table.add_row(
                proj['id'],
                proj['name'],
                str(proj['priority']),
                proj['status'],
                f"{completed}/{task_count}"
            )
        
        console.print(table)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@project.command("tree")
@click.pass_context
def project_tree(ctx):
    """Show projects and tasks in a tree view"""
    client = ctx.obj['client']
    
    try:
        projects = client.list_projects()
        
        tree = Tree("📁 [bold]All Projects[/bold]")
        
        for proj in projects:
            proj_branch = tree.add(f"[cyan]{proj['name']}[/cyan] [dim](P{proj['priority']})[/dim]")
            
            tasks = client.list_tasks(project_id=proj['id'])
            
            # Group by status
            todo = [t for t in tasks if t['status'] == 'todo']
            in_progress = [t for t in tasks if t['status'] == 'in_progress']
            completed = [t for t in tasks if t['status'] == 'completed']
            
            if todo:
                todo_branch = proj_branch.add("[yellow]📋 To Do[/yellow]")
                for task in todo:
                    energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[task['energy_level']]
                    todo_branch.add(f"{energy_icon} {task['title']} [dim]({task['estimated_minutes']}m, P{task['priority']})[/dim]")
            
            if in_progress:
                progress_branch = proj_branch.add("[blue]🔄 In Progress[/blue]")
                for task in in_progress:
                    energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[task['energy_level']]
                    progress_branch.add(f"{energy_icon} {task['title']} [dim]({task['estimated_minutes']}m)[/dim]")
            
            if completed:
                completed_branch = proj_branch.add(f"[green]✅ Completed ({len(completed)})[/green]")
                for task in completed[:3]:
                    completed_branch.add(f"[dim]{task['title']}[/dim]")
                if len(completed) > 3:
                    completed_branch.add(f"[dim]... and {len(completed) - 3} more[/dim]")
        
        console.print(tree)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


# ============================================================================
# TASK COMMANDS
# ============================================================================

# Replace the task_add function in cli.py with this version:

@cli.command("add")
@click.argument("project")
@click.argument("title")
@click.option("--time", "-t", default=60, help="Estimated time in minutes")
@click.option("--priority", "-p", type=int, default=3, help="Priority (1=highest, 5=lowest)")
@click.option("--difficulty", type=int, default=3, help="Difficulty (1=easiest, 5=hardest)")
@click.option("--energy", type=click.Choice(['low', 'medium', 'high']), default='medium',
              help="Energy level: high=morning, medium=afternoon, low=evening")
@click.option("--parent", help="Parent task ID or title (for UI hierarchy)")
@click.option("--depends-on", help="Task ID or title this task depends on (for scheduling)")
@click.option("--deadline", help="Deadline date (YYYY-MM-DD format)")
@click.option("--description", "-d", help="Task description")
@click.pass_context
def task_add(ctx, project, title, time, priority, difficulty, energy, parent, depends_on, deadline, description):
    """Add a task to a project

    Examples:
      task add "Project" "Task 1" --time 60
      task add "Project" "Task 2" --depends-on "Task 1"
      task add "Project" "Task 3" --deadline 2024-12-25
    """
    client = ctx.obj['client']

    try:
        # FIX: Use find_project_by_name instead of get_project
        project_obj = client.find_project_by_name(project)
        if not project_obj:
            raise click.ClickException(f"Project '{project}' not found")

        project_id = project_obj['id']

        # Handle parent task (for UI hierarchy)
        parent_id = None
        if parent:
            parent_task = find_task_by_title(client, project_id, parent)
            if parent_task:
                parent_id = parent_task['id']
            else:
                parent_id = parent

        # Handle dependency (for scheduling order)
        dependencies = []
        if depends_on:
            dep_task = find_task_by_title(client, project_id, depends_on)
            if dep_task:
                dependencies.append(dep_task['id'])
            else:
                # Assume it's an ID
                dependencies.append(depends_on)

        # Handle deadline
        deadline_dt = None
        if deadline:
            from datetime import datetime as dt
            try:
                deadline_dt = dt.strptime(deadline, "%Y-%m-%d").isoformat()
            except ValueError:
                raise click.ClickException(f"Invalid deadline format. Use YYYY-MM-DD (e.g., 2024-12-25)")

        data = {
            "project_id": project_id,
            "title": title,
            "estimated_minutes": time,
            "priority": priority,
            "difficulty": difficulty,
            "energy_level": energy,
            "description": description,
            "parent_task_id": parent_id,
            "dependencies": dependencies,
            "deadline": deadline_dt,
            "tags": []
        }

        result = client.create_task(data)

        energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[energy]
        parent_info = f" (subtask of {parent})" if parent_id else ""
        depends_info = f" (depends on {depends_on})" if depends_on else ""
        deadline_info = f" [deadline: {deadline}]" if deadline else ""
        console.print(f"[green]✅ Created task: {result['title']} {energy_icon}{parent_info}{depends_info}{deadline_info}[/green]")
        console.print(f"[dim]   ID: {result['id']} | Priority: {priority} | Time: {time}m[/dim]")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("edit")
@click.argument("task_id")
@click.option("--title", help="New title")
@click.option("--time", type=int, help="New estimated time in minutes")
@click.option("--priority", "-p", type=int, help="New priority (1-5)")
@click.option("--difficulty", type=int, help="New difficulty (1-5)")
@click.option("--energy", type=click.Choice(['low', 'medium', 'high']), help="New energy level")
@click.option("--description", "-d", help="New description")
@click.option("--status", type=click.Choice(['todo', 'in_progress', 'blocked', 'completed']), help="New status")
@click.pass_context
def task_edit(ctx, task_id, title, time, priority, difficulty, energy, description, status):
    """Edit an existing task
    
    Examples:
      task edit abc123 --priority 1 --time 90
      task edit abc123 --energy high
      task edit abc123 --status in_progress
    """
    client = ctx.obj['client']
    
    try:
        # Build update data with only provided fields
        update_data = {}
        if title is not None:
            update_data['title'] = title
        if time is not None:
            update_data['estimated_minutes'] = time
        if priority is not None:
            update_data['priority'] = priority
        if difficulty is not None:
            update_data['difficulty'] = difficulty
        if energy is not None:
            update_data['energy_level'] = energy
        if description is not None:
            update_data['description'] = description
        if status is not None:
            update_data['status'] = status
        
        if not update_data:
            console.print("[yellow]⚠️  No changes specified. Use --help to see options.[/yellow]")
            return
        
        result = client.update_task(task_id, update_data)
        
        console.print(f"[green]✅ Updated task: {result['title']}[/green]")
        console.print("[dim]Changes:[/dim]")
        for key, value in update_data.items():
            console.print(f"  • {key}: {value}")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("add-dependency")
@click.argument("task_id")
@click.argument("depends_on")
@click.pass_context
def add_dependency(ctx, task_id, depends_on):
    """Add a dependency to an existing task

    This makes TASK_ID depend on DEPENDS_ON task.
    The task will only be scheduled AFTER its dependency is completed.

    Examples:
      task add-dependency abc123 def456
      task add-dependency "Write Paper 2" "Write Paper 1"
    """
    client = ctx.obj['client']

    try:
        # Try to resolve task_id by title if not found as ID
        task = None
        try:
            task = client.get_task(task_id)
        except:
            # Search all tasks for matching title
            tasks = client.list_tasks()
            for t in tasks:
                if t['title'].lower() == task_id.lower():
                    task = t
                    task_id = t['id']
                    break

        if not task:
            raise click.ClickException(f"Task '{task_id}' not found")

        # Try to resolve depends_on by title if not found as ID
        dep_task = None
        try:
            dep_task = client.get_task(depends_on)
            dep_id = depends_on
        except:
            # Search all tasks for matching title
            tasks = client.list_tasks()
            for t in tasks:
                if t['title'].lower() == depends_on.lower():
                    dep_task = t
                    dep_id = t['id']
                    break

        if not dep_task:
            raise click.ClickException(f"Dependency task '{depends_on}' not found")

        result = client.add_dependency(task_id, dep_id)
        console.print(f"[green]✅ Added dependency: '{task['title']}' now depends on '{dep_task['title']}'[/green]")
        console.print(f"[dim]   {task['title']} will only be scheduled after {dep_task['title']} is completed[/dim]")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("remove-dependency")
@click.argument("task_id")
@click.argument("dependency_id")
@click.pass_context
def remove_dependency(ctx, task_id, dependency_id):
    """Remove a dependency from a task

    Examples:
      task remove-dependency abc123 def456
    """
    client = ctx.obj['client']

    try:
        result = client.remove_dependency(task_id, dependency_id)
        console.print(f"[green]✅ Removed dependency from task: {result['title']}[/green]")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("show-dependencies")
@click.argument("task_id")
@click.pass_context
def show_dependencies(ctx, task_id):
    """Show dependencies for a task

    Examples:
      task show-dependencies abc123
    """
    client = ctx.obj['client']

    try:
        # Try to resolve task_id by title if not found as ID
        task = None
        try:
            task = client.get_task(task_id)
        except:
            # Search all tasks for matching title
            tasks = client.list_tasks()
            for t in tasks:
                if t['title'].lower() == task_id.lower():
                    task = t
                    break

        if not task:
            raise click.ClickException(f"Task '{task_id}' not found")

        console.print(f"\n[bold]Task:[/bold] {task['title']} ({task['id']})")

        deps = task.get('dependencies', [])
        if deps:
            console.print(f"\n[bold yellow]Dependencies (must complete first):[/bold yellow]")
            all_tasks = client.list_tasks()
            for dep_id in deps:
                dep_task = next((t for t in all_tasks if t['id'] == dep_id), None)
                if dep_task:
                    status_icon = "✅" if dep_task['status'] == 'completed' else "⏳"
                    console.print(f"  {status_icon} {dep_task['title']} ({dep_id}) - {dep_task['status']}")
                else:
                    console.print(f"  ❓ {dep_id} (not found)")
        else:
            console.print(f"\n[dim]No dependencies - this task can be scheduled immediately[/dim]")

        # Also show tasks that depend on this one
        all_tasks = client.list_tasks()
        dependents = [t for t in all_tasks if task['id'] in t.get('dependencies', [])]
        if dependents:
            console.print(f"\n[bold cyan]Dependent tasks (blocked by this task):[/bold cyan]")
            for dep in dependents:
                console.print(f"  🔒 {dep['title']} ({dep['id']})")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("list")
@click.option("--project", "-p", help="Filter by project name or ID")
@click.option("--status", "-s", help="Filter by status")
@click.pass_context
def task_list(ctx, project, status):
    """List tasks
    
    Examples:
      task list                        # All tasks
      task list --project "GammaZero"  # Tasks for one project
      task list --status todo          # All todo tasks
    """
    client = ctx.obj['client']
    
    try:
        project_id = None
        if project:
            try:
                proj = client.get_project(project)
                project_id = proj['id']
            except:
                proj = find_project_by_name(client, project)
                project_id = proj['id']
        
        tasks = client.list_tasks(project_id=project_id, status=status)
        
        if not tasks:
            console.print("[yellow]No tasks found.[/yellow]")
            return
        
        projects = {p['id']: p['name'] for p in client.list_projects()}
        
        table = Table(title="Tasks")
        table.add_column("ID", style="cyan")
        table.add_column("Project", style="magenta")
        table.add_column("Title", style="bold")
        table.add_column("P", justify="center", style="yellow")
        table.add_column("D", justify="center")
        table.add_column("Energy", style="cyan")
        table.add_column("Time", justify="right")
        table.add_column("Status", style="green")
        
        for t in tasks:
            project_name = projects.get(t['project_id'], t['project_id'])[:20]
            energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[t['energy_level']]
            
            table.add_row(
                t['id'],
                project_name,
                t['title'][:40],
                str(t['priority']),
                str(t['difficulty']),
                f"{energy_icon} {t['energy_level'][:3]}",
                f"{t['estimated_minutes']}m",
                t['status']
            )
        
        console.print(table)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("overview")
@click.pass_context
def overview(ctx):
    """Show complete overview of all projects and tasks"""
    client = ctx.obj['client']
    
    try:
        projects = client.list_projects()
        
        console.print("\n[bold cyan]📊 TaskMan Overview[/bold cyan]\n")
        
        for proj in projects:
            tasks = client.list_tasks(project_id=proj['id'])
            total = len(tasks)
            completed = len([t for t in tasks if t['status'] == 'completed'])
            in_progress = len([t for t in tasks if t['status'] == 'in_progress'])
            
            total_time = sum(t['estimated_minutes'] for t in tasks if t['status'] != 'completed')
            
            console.print(f"\n[bold]{proj['name']}[/bold] [dim](P{proj['priority']})[/dim]")
            console.print(f"  Tasks: {completed}/{total} completed | {total_time}m remaining")
            
            if proj.get('description'):
                console.print(f"  [dim]{proj['description']}[/dim]")
            
            active_tasks = [t for t in tasks if t['status'] in ['todo', 'in_progress']]
            if active_tasks:
                console.print("\n  [yellow]Active Tasks:[/yellow]")
                for t in active_tasks[:5]:
                    status_icon = "🔄" if t['status'] == 'in_progress' else "📋"
                    energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[t['energy_level']]
                    console.print(f"    {status_icon} {energy_icon} {t['title']} [dim]({t['estimated_minutes']}m, P{t['priority']})[/dim]")
                
                if len(active_tasks) > 5:
                    console.print(f"    [dim]... and {len(active_tasks) - 5} more[/dim]")
        
        console.print()
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("complete")
@click.argument('task_id')
@click.option('--actual-time', type=int, help='Actual time spent in minutes')
@click.pass_context
def complete(ctx, task_id, actual_time):
    """Mark a task as complete
    
    The system learns from actual times to improve future estimates!
    
    Example:
      task complete abc123 --actual-time 75
    """
    client = ctx.obj['client']
    
    try:
        task = client.complete_task(task_id, actual_minutes=actual_time)
        console.print(f"[green]✅ Completed: {task['title']}[/green]")
        
        if actual_time and task.get('estimated_minutes'):
            estimated = task['estimated_minutes']
            diff = actual_time - estimated
            if abs(diff) <= 5:
                console.print(f"[green]🎯 Perfect estimate! (±{abs(diff)}m)[/green]")
            elif diff > 0:
                console.print(f"[yellow]⏱️  Took {diff}m longer than estimated[/yellow]")
            else:
                console.print(f"[green]⏱️  Finished {abs(diff)}m earlier than estimated[/green]")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


# ============================================================================
# SCHEDULE COMMANDS
# ============================================================================

@cli.group()
def schedule():
    """Manage schedules"""
    pass


@schedule.command("generate")
@click.option('--days', type=int, default=1, help='Number of days to schedule (1-7)')
@click.option('--date', 'target_date', help='Start date (YYYY-MM-DD), default: today')
@click.option('--force', is_flag=True, help='Force regeneration (overwrite existing)')
@click.pass_context
def schedule_generate(ctx, days, target_date, force):
    """Generate schedule for upcoming days
    
    The scheduler:
    • Places high-energy tasks in morning (8am-12pm)
    • Places medium-energy tasks in afternoon (12pm-5pm)
    • Places low-energy tasks in evening (5pm-10pm)
    • Inserts 15-min breaks every 2 hours
    • Respects task dependencies
    • Learns from your completion patterns
    
    Examples:
      task schedule generate                  # Generate today
      task schedule generate --days 7         # Generate next week
      task schedule generate --force          # Regenerate today
    """
    client = ctx.obj['client']
    
    try:
        params = {"days": days, "force": force}
        if target_date:
            params["target_date"] = target_date
            
        result = client.generate_schedule(**params)
        console.print(f"[green]✅ Generated {result['count']} schedule(s)[/green]")
        console.print("[dim]Tip: Run 'task schedule today' to see your schedule[/dim]")
    except Exception as e:
        console.print(f"[red]❌ Error: {str(e)}[/red]")


@schedule.command("today")
@click.pass_context
def schedule_today(ctx):
    """View today's schedule"""
    client = ctx.obj['client']
    
    try:
        sched = client.get_today_schedule()
        _display_schedule(sched, client)
    except Exception as e:
        console.print(f"[red]❌ Error: {str(e)}[/red]")


@schedule.command("reschedule")
@click.option('--date', 'target_date', help='Date to reschedule (YYYY-MM-DD), default: today')
@click.option('--all', 'reschedule_all', is_flag=True, help='Reschedule ALL remaining tasks across all future days')
@click.option('--days', type=int, help='Number of days to reschedule (overrides --all)')
@click.pass_context
def schedule_reschedule(ctx, target_date, reschedule_all, days):
    """Reschedule incomplete tasks
    
    By default, reschedules only TODAY's incomplete tasks.
    Use --all to reschedule ALL remaining tasks across future days.
    Use --days N to reschedule specific number of days.
    
    Examples:
      task schedule reschedule              # Reschedule today only
      task schedule reschedule --all        # Reschedule ALL remaining tasks
      task schedule reschedule --days 14    # Reschedule next 2 weeks
      task schedule reschedule --date 2025-10-20
    """
    client = ctx.obj['client']

    try:
        if reschedule_all:
            # Show info about what we're scheduling
            all_tasks = client.list_tasks(status='todo')
            all_tasks += client.list_tasks(status='in_progress')
            # Separate habits vs regular tasks for clarity
            habits = [t for t in all_tasks if t.get('is_habit', False)]
            regular_tasks = [t for t in all_tasks if not t.get('is_habit', False)]
            subtasks = [t for t in regular_tasks if t.get('parent_task_id')]
            top_level_tasks = [t for t in regular_tasks if not t.get('parent_task_id')]

            total_minutes = sum(t['estimated_minutes'] for t in regular_tasks)
            estimated_days = max(1, (total_minutes // 360) + 1)

            console.print(f"[cyan]📊 Found {len(all_tasks)} incomplete items:[/cyan]")
            console.print(f"[cyan]   • {len(top_level_tasks)} tasks ({total_minutes} minutes)[/cyan]")
            if subtasks:
                console.print(f"[cyan]   • {len(subtasks)} subtasks[/cyan]")
            if habits:
                console.print(f"[cyan]   • {len(habits)} habits (scheduled separately)[/cyan]")
            console.print(f"[cyan]📅 Scheduling until all tasks are placed...[/cyan]")

            # Use reschedule endpoint with reschedule_all flag
            result = client.reschedule(reschedule_all=True)
            console.print(f"[green]✅ Rescheduled {result['count']} day(s) with all remaining tasks[/green]")
            console.print(f"[dim]Tip: Run 'task schedule today' to see updated schedule[/dim]")
        elif days:
            # Reschedule specific number of days
            console.print(f"[cyan]📅 Scheduling across {days} days...[/cyan]")
            result = client.reschedule(days=days)
            console.print(f"[green]✅ Rescheduled {result['count']} day(s) with all remaining tasks[/green]")
            console.print(f"[dim]Tip: Run 'task schedule today' to see updated schedule[/dim]")
        else:
            # Reschedule single day
            params = {}
            if target_date:
                params["target_date"] = target_date
            sched = client.reschedule(**params)
            console.print(f"[green]✅ Rescheduled tasks for {sched['date']}[/green]")
            _display_schedule(sched, client)
    except Exception as e:
        console.print(f"[red]❌ Error: {str(e)}[/red]")


@schedule.command("unscheduled")
@click.option("--days", type=int, default=14, help="Number of days to check for unscheduled items")
@click.pass_context
def schedule_unscheduled(ctx, days):
    """View unscheduled tasks and habits

    Shows tasks and habits that couldn't be scheduled due to:
    - Time conflicts (overlapping habits)
    - Unmet dependencies
    - Not enough time in available slots

    Examples:
      task schedule unscheduled
      task schedule unscheduled --days 30
    """
    client = ctx.obj['client']

    try:
        # Get upcoming schedules with unscheduled info
        upcoming = client.get_upcoming_schedules(days)
        unscheduled_ids = upcoming.get('unscheduled_task_ids', [])

        if not unscheduled_ids:
            console.print(f"[green]✅ All tasks and habits are scheduled for the next {days} days![/green]")
            return

        # Get task details
        all_tasks = client.list_tasks()
        task_map = {t['id']: t for t in all_tasks}

        # Separate habits from regular tasks
        unscheduled_habits = []
        unscheduled_tasks = []

        for task_id in unscheduled_ids:
            task = task_map.get(task_id)
            if task:
                if task.get('is_habit'):
                    unscheduled_habits.append(task)
                else:
                    unscheduled_tasks.append(task)

        console.print(f"\n[bold yellow]Unscheduled Items ({len(unscheduled_ids)} total)[/bold yellow]\n")

        # Display habits
        if unscheduled_habits:
            console.print("[bold cyan]Habits with Conflicts:[/bold cyan]")
            for habit in unscheduled_habits:
                rec = habit.get('recurrence', {})
                time_str = rec.get('time_of_day', 'N/A')
                days_str = "Daily" if rec.get('frequency') == 'daily' else ", ".join(rec.get('days_of_week', []))
                console.print(f"  ⚠️  {habit['title']} ({time_str} on {days_str})")
                console.print(f"      [dim]Likely conflict with another habit at the same time[/dim]")
            console.print()

        # Display regular tasks
        if unscheduled_tasks:
            console.print("[bold cyan]Unscheduled Tasks:[/bold cyan]")

            # Group by reason
            blocked_by_deps = [t for t in unscheduled_tasks if t.get('dependencies')]
            no_time = [t for t in unscheduled_tasks if not t.get('dependencies')]

            if blocked_by_deps:
                console.print("  [yellow]Blocked by dependencies:[/yellow]")
                for task in blocked_by_deps:
                    deps = task.get('dependencies', [])
                    dep_names = []
                    for dep_id in deps:
                        dep_task = task_map.get(dep_id)
                        if dep_task:
                            status = "✅" if dep_task.get('status') == 'completed' else "⏳"
                            dep_names.append(f"{status} {dep_task['title']}")
                    console.print(f"    🔒 {task['title']} ({task['estimated_minutes']}m)")
                    console.print(f"       [dim]Waiting for: {', '.join(dep_names)}[/dim]")

            if no_time:
                console.print("\n  [yellow]Not enough time in schedule:[/yellow]")
                for task in no_time:
                    console.print(f"    📋 {task['title']} ({task['estimated_minutes']}m, P{task['priority']})")

        # Summary
        console.print(f"\n[dim]Stats: {upcoming.get('scheduled_count', 0)} scheduled, {len(unscheduled_ids)} unscheduled[/dim]")
        console.print("[dim]Tip: Run 'task schedule reschedule --all' to reschedule all tasks[/dim]")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


def _display_schedule(sched, client):
    """Display schedule in a nice format"""
    console.print(f"\n[bold cyan]Schedule for {sched['date']}[/bold cyan]\n")
    
    summary = sched['summary']
    summary_text = f"""
📊 Summary
  • {summary['tasks_remaining']} tasks scheduled
  • {summary['total_scheduled_minutes']} minutes planned
  • {summary['tasks_completed']} tasks completed
  • Completion rate: {summary['completion_rate']*100:.0f}%
    """
    console.print(Panel(summary_text.strip(), title="Summary", border_style="blue"))
    
    if sched['scheduled_tasks']:
        table = Table(title="Scheduled Tasks")
        table.add_column("Time", style="cyan")
        table.add_column("Task ID", style="magenta")
        table.add_column("Title", style="bold")
        table.add_column("Duration")
        table.add_column("Type")
        
        all_tasks = client.list_tasks()
        task_map = {t['id']: t for t in all_tasks}
        
        for task in sched['scheduled_tasks']:
            task_type = "Break" if task['is_buffer'] else "Task"
            if task['is_buffer']:
                title = "☕ Break"
                task_id_display = "-"
            else:
                task_obj = task_map.get(task['task_id'])
                if task_obj:
                    energy_icon = {"high": "🔥", "medium": "⚡", "low": "💤"}[task_obj['energy_level']]
                    title = f"{energy_icon} {task_obj['title'][:40]}"
                    task_id_display = task['task_id']
                else:
                    title = "-"
                    task_id_display = task['task_id']
            
            table.add_row(
                f"{task['start_time']} - {task['end_time']}",
                task_id_display,
                title,
                f"{task['estimated_minutes']}m",
                task_type
            )
        
        console.print(table)
    
    console.print()


# Register calendar commands
cli.add_command(calendar_commands.calendar)
cli.add_command(calendar_commands.day)
cli.add_command(calendar_commands.week)
cli.add_command(calendar_commands.month)

# Register notes, goals, and review commands
from taskman.client.commands.notes import notes
from taskman.client.commands.goals import goals
from taskman.client.commands.review import review

cli.add_command(notes)
cli.add_command(goals)
cli.add_command(review)

# ============================================================================
# CONFIG COMMAND
# ============================================================================

@cli.command("config")
@click.option('--show', is_flag=True, help='Show current configuration')
@click.option('--work-start', help='Set work start time (HH:MM)')
@click.option('--work-end', help='Set work end time (HH:MM)')
@click.option('--max-work-block', type=int, help='Max continuous work minutes before break (default: 120)')
@click.pass_context
def config(ctx, show, work_start, work_end, max_work_block):
    """View or modify user preferences
    
    Examples:
      task config --show                    # View current settings
      task config --work-start 09:00        # Change start time
      task config --max-work-block 90       # Max 90min before break
    """
    client = ctx.obj['client']
    
    try:
        if show or not any([work_start, work_end, max_work_block]):
            # Show current config
            prefs = client.get_preferences()
            
            config_text = f"""
⚙️  User Preferences

Work Hours (per day):"""
            for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
                if day in prefs.get('work_hours', {}):
                    hours = prefs['work_hours'][day]
                    config_text += f"\n  • {day.capitalize()}: {hours['start']} - {hours['end']}"

            config_text += f"""

Energy Patterns:"""
            for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
                if day in prefs.get('energy_patterns', {}):
                    patterns = prefs['energy_patterns'][day]
                    if patterns:
                        config_text += f"\n  {day.capitalize()}:"
                        for p in patterns:
                            level_icon = {'high': '🔥', 'medium': '⚡', 'low': '💤'}.get(p['level'], '')
                            config_text += f"\n    • {p['start']}-{p['end']}: {level_icon} {p['level']}"

            sched_prefs = prefs.get('scheduling_preferences', {})
            config_text += f"""

Scheduling:
  • Max continuous work: {sched_prefs.get('max_deep_work_stretch', 120)} minutes
  • Energy matching: {'enabled' if sched_prefs.get('respect_energy_patterns', True) else 'disabled'}
  • Energy match bonus: {int(sched_prefs.get('energy_match_bonus', 0.15) * 100)}%
  • Batch similar tasks: {sched_prefs.get('batch_similar_tasks', True)}
            """
            
            console.print(Panel(config_text.strip(), title="Configuration", border_style="cyan"))
        else:
            # Update config
            console.print("[yellow]⚠️  Config update not yet implemented. Edit data/user_preferences.json manually.[/yellow]")
            if work_start:
                console.print(f"[dim]Set work_hours.start = \"{work_start}\"[/dim]")
            if work_end:
                console.print(f"[dim]Set work_hours.end = \"{work_end}\"[/dim]")
            if max_work_block:
                console.print(f"[dim]Set scheduling_preferences.max_deep_work_minutes = {max_work_block}[/dim]")
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


# ============================================================================
# HELP COMMAND
# ============================================================================

@cli.command("help")
@click.argument('topic', required=False)
def help_command(topic):
    """Get help on specific topics
    
    Topics:
      energy    - Understanding energy levels
      schedule  - How scheduling works
      burnout   - Burnout prevention features
      workflow  - Recommended daily workflow
    """
    if topic == 'energy':
        help_text = """
🔥 Energy Levels - How They Work

TaskMan uses energy levels to schedule tasks at optimal times:

HIGH ENERGY (🔥)
  • Scheduled: Morning (8am-12pm)
  • Best for: Complex problem-solving, creative work, learning
  • Examples: Algorithm design, architecture planning, writing code
  • Use when: Task requires intense focus and mental effort

MEDIUM ENERGY (⚡)
  • Scheduled: Afternoon (12pm-5pm)
  • Best for: Standard work, meetings, reviews
  • Examples: Code reviews, testing, refactoring, documentation
  • Use when: Task is important but not extremely demanding

LOW ENERGY (💤)
  • Scheduled: Evening (5pm-10pm)
  • Best for: Simple tasks, admin work, organizing
  • Examples: Updating docs, responding to emails, planning
  • Use when: Task is necessary but not mentally taxing

Setting Energy Levels:
  task add "Project" "Task name" --energy high
  task edit abc123 --energy medium

The system will automatically schedule high-energy tasks in your
morning hours when you're freshest, and save low-energy tasks for
when you're winding down.
        """
        console.print(Panel(help_text.strip(), title="Energy Levels", border_style="cyan"))
    
    elif topic == 'schedule':
        help_text = """
📅 Smart Scheduling - How It Works

The scheduler uses multiple factors to create your optimal schedule:

1. ENERGY MATCHING
   • High-energy tasks → Morning (8am-12pm)
   • Medium-energy tasks → Afternoon (12pm-5pm)
   • Low-energy tasks → Evening (5pm-10pm)

2. PRIORITY SCORING (40%)
   • Priority 1 tasks scheduled first
   • Priority 5 tasks scheduled last

3. DEADLINE AWARENESS (30%)
   • Tasks with approaching deadlines prioritized
   • Overdue tasks scheduled immediately

4. AUTOMATIC BREAKS (ENFORCED!)
   • 15-minute break inserted every 2 hours (120 minutes)
   • Tasks longer than 2 hours are automatically split
   • Example: 4-hour task becomes 2h + break + 2h
   • Prevents burnout and maintains focus
   • Configurable: task config --max-work-block 90

5. DEPENDENCY RESOLUTION
   • Only schedules tasks when dependencies are met
   • Automatically orders dependent tasks correctly

6. LEARNING FROM HISTORY
   • Tracks your actual completion times
   • Adjusts future estimates based on patterns
   • Gets smarter over time!

Scheduling Commands:
  task schedule generate           # Generate today
  task schedule generate --days 7  # Generate next week
  task schedule today              # View today
  task schedule reschedule         # Reschedule today
  task schedule reschedule --all   # Reschedule next 7 days
        """
        console.print(Panel(help_text.strip(), title="Smart Scheduling", border_style="cyan"))
    
    elif topic == 'burnout':
        help_text = """
🛡️ Burnout Prevention Features

TaskMan actively helps prevent burnout:

AUTOMATIC BREAKS
  • 15-minute break every 2 hours (configurable)
  • Enforced rest periods to maintain focus
  • Configure: task config --max-work-block 90

ENERGY-BASED SCHEDULING
  • Matches task difficulty to your energy levels
  • Prevents scheduling hard work when you're tired
  • Respects your natural energy rhythms

WORKLOAD MONITORING (Coming Soon)
  • Tracks daily work hours
  • Warns when consistently overloaded
  • Suggests task deferrals when overwhelmed

REALISTIC ESTIMATION
  • Learns from your actual completion times
  • Prevents over-optimistic scheduling
  • Adapts to your actual pace

FLEXIBLE RESCHEDULING
  • Easy to reschedule when things change
  • No penalty for adjusting plans
  • Encourages realistic planning

Best Practices:
  • Set realistic time estimates
  • Take scheduled breaks seriously
  • Use energy levels honestly
  • Reschedule daily if needed
  • Review weekly patterns

Commands:
  task config --show              # Check your settings
  task schedule reschedule        # Adjust today's plan
        """
        console.print(Panel(help_text.strip(), title="Burnout Prevention", border_style="cyan"))
    
    elif topic == 'workflow':
        help_text = """
🔄 Recommended Daily Workflow

MORNING (Start of Day)
  1. Review today's schedule
     $ task schedule today
  
  2. Check project overview
     $ task overview
  
  3. Adjust if needed
     $ task schedule reschedule

DURING WORK
  1. Follow your schedule
  
  2. Complete tasks with actual time
     $ task complete abc123 --actual-time 75
  
  3. Add new urgent tasks
     $ task add "Project" "Urgent fix" --energy high --priority 1
     $ task schedule reschedule

EVENING (End of Day)
  1. Complete remaining tasks
     $ task complete xyz789 --actual-time 45
  
  2. Review what you accomplished
     $ task overview
  
  3. Generate tomorrow's schedule
     $ task schedule generate

WEEKLY REVIEW
  1. Review all projects
     $ task project tree
  
  2. Update priorities
     $ task edit abc123 --priority 1
  
  3. Generate next week
     $ task schedule generate --days 7

TIPS:
  • Always log actual time for learning
  • Reschedule when plans change (no guilt!)
  • Use energy levels accurately
  • Review and adjust regularly
  • Trust the system - it learns!
        """
        console.print(Panel(help_text.strip(), title="Daily Workflow", border_style="cyan"))
    
    else:
        help_text = """
📚 TaskMan Help Topics

Available help topics:
  task help energy     - Understanding energy levels
  task help schedule   - How scheduling works
  task help burnout    - Burnout prevention features
  task help workflow   - Recommended daily workflow

Quick Start:
  1. Create a project
     $ task project add "My Project"
  
  2. Add tasks with energy levels
     $ task add "My Project" "Hard task" --time 120 --energy high
     $ task add "My Project" "Easy task" --time 30 --energy low
  
  3. Generate schedule
     $ task schedule generate
  
  4. View your day
     $ task schedule today
  
  5. Complete tasks
     $ task complete <task-id> --actual-time 90

Key Features:
  • Smart scheduling based on energy levels
  • Automatic breaks every 2 hours
  • Learns from your work patterns
  • Prevents burnout with workload balancing
  • Works offline with local storage

For full command list: task --help
        """
        console.print(Panel(help_text.strip(), title="TaskMan Help", border_style="cyan"))


@cli.command("habits-today")
@click.pass_context
def habits_today(ctx):
    """View today's habits and routines only
    
    Shows only your recurring personal wellbeing tasks for today,
    excluding all regular work tasks.
    
    Example:
      task habits-today
    """
    from taskman.client.utils.calendar_views import show_day
    from datetime import date
    
    client = ctx.obj['client']
    
    # We need to create a custom viewer that shows only habits
    try:
        from taskman.client.utils.calendar_views import CalendarViewer
        viewer = CalendarViewer(client)
        viewer.day_view(date.today(), view_mode='habits')
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("tasks-today")
@click.pass_context
def tasks_today(ctx):
    """View today's work tasks only (excluding habits)
    
    Shows only your scheduled work tasks, excluding recurring habits.
    This gives you a clean view of just your work for the day.
    
    Example:
      task tasks-today
    """
    from taskman.client.utils.calendar_views import show_day
    from datetime import date
    
    client = ctx.obj['client']
    
    try:
        from taskman.client.utils.calendar_views import CalendarViewer
        viewer = CalendarViewer(client)
        viewer.day_view(date.today(), view_mode='tasks')
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")

# Add these commands to your cli.py file

@cli.command("add-habit")
@click.argument("project")
@click.argument("title")
@click.option("--time", "-t", required=True, type=int, help="Duration in minutes")
@click.option("--priority", "-p", type=int, default=1, help="Priority (1-5)")
@click.option("--energy", type=click.Choice(['low', 'medium', 'high']), default='low')
@click.option("--days", multiple=True, required=True,
              type=click.Choice(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
              help="Days of week (can specify multiple times)")
@click.option("--at", "time_of_day", required=True, help="Time of day (HH:MM)")
@click.option("--description", "-d", help="Description")
@click.pass_context
def add_habit(ctx, project, title, time, priority, energy, days, time_of_day, description):
    """Add a recurring habit
    
    Habits automatically block time in your schedule and can be tracked separately.
    
    Examples:
      task add-habit "Personal Wellbeing" "Lunch" --time 60 --days mon --days tue --days wed --days thu --days fri --days sat --days sun --at 14:00
      
      task add-habit "Personal Wellbeing" "Gym" --time 75 --days mon --days wed --days fri --at 19:00
      
      task add-habit "Personal Wellbeing" "Meditation" --time 30 --days mon --days tue --days wed --days thu --days fri --days sat --days sun --at 22:00
    """
    client = ctx.obj['client']
    
    try:
        # Find project
        project_obj = client.find_project_by_name(project)
        if not project_obj:
            raise click.ClickException(f"Project '{project}' not found")
        
        project_id = project_obj['id']
        
        # Convert day abbreviations to full names
        day_map = {
            'mon': 'Monday',
            'tue': 'Tuesday', 
            'wed': 'Wednesday',
            'thu': 'Thursday',
            'fri': 'Friday',
            'sat': 'Saturday',
            'sun': 'Sunday'
        }
        
        full_days = [day_map[d] for d in days]
        
        # Create recurrence pattern
        frequency = "daily" if len(full_days) == 7 else "weekly"
        
        data = {
            "project_id": project_id,
            "title": title,
            "description": description,
            "estimated_minutes": time,
            "priority": priority,
            "energy_level": energy,
            "is_habit": True,
            "recurrence": {
                "frequency": frequency,
                "days_of_week": full_days,
                "time_of_day": time_of_day
            },
            "tags": []
        }
        
        result = client.create_task(data)
        
        days_str = ", ".join(full_days) if frequency == "weekly" else "Daily"
        console.print(f"[green]✅ Created habit: {result['title']}[/green]")
        console.print(f"[dim]   ID: {result['id']} | {days_str} at {time_of_day} | {time}m[/dim]")
        console.print(f"[yellow]⚠️  Run 'task schedule generate --force' to update schedules[/yellow]")
        
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("habits")
@click.pass_context
def list_habits(ctx):
    """List all habits"""
    client = ctx.obj['client']
    
    try:
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]
        
        if not habits:
            console.print("[yellow]No habits found.[/yellow]")
            console.print("\n[dim]Add a habit with:[/dim]")
            console.print("[dim]  task add-habit \"Personal Wellbeing\" \"Lunch\" --time 60 --days mon --days tue --at 14:00[/dim]")
            return
        
        table = Table(title="Recurring Habits")
        table.add_column("ID", style="cyan")
        table.add_column("Title", style="bold")
        table.add_column("Days", style="yellow")
        table.add_column("Time", style="green")
        table.add_column("Duration", justify="right")
        
        for habit in habits:
            rec = habit.get('recurrence', {})
            
            if rec.get('frequency') == 'daily':
                days_str = "Daily"
            else:
                days = rec.get('days_of_week', [])
                # Abbreviate day names
                day_abbrev = {
                    'Monday': 'Mon', 'Tuesday': 'Tue', 'Wednesday': 'Wed',
                    'Thursday': 'Thu', 'Friday': 'Fri', 'Saturday': 'Sat', 'Sunday': 'Sun'
                }
                days_str = ", ".join([day_abbrev.get(d, d) for d in days])
            
            time_str = rec.get('time_of_day', '-')
            
            table.add_row(
                habit['id'],
                habit['title'],
                days_str,
                time_str,
                f"{habit['estimated_minutes']}m"
            )
        
        console.print(table)
        console.print(f"\n[dim]Total habits: {len(habits)}[/dim]")
        
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("pause-habit")
@click.argument("habit_id_or_name")
@click.option("--until", "pause_until", help="Pause until date (YYYY-MM-DD), or indefinitely if not specified")
@click.pass_context
def pause_habit(ctx, habit_id_or_name, pause_until):
    """Pause a habit temporarily

    Paused habits won't be scheduled until resumed or until the pause date passes.

    Examples:
      task pause-habit Gym                    # Pause indefinitely
      task pause-habit Meditation --until 2025-01-01   # Pause until date
      task pause-habit 4cb07212               # Pause by ID
    """
    client = ctx.obj['client']

    try:
        # Find the habit
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]

        # Try to find by ID first
        habit = next((h for h in habits if h['id'] == habit_id_or_name), None)

        # Try by title
        if not habit:
            matching = [h for h in habits if habit_id_or_name.lower() in h['title'].lower()]
            if len(matching) == 1:
                habit = matching[0]
            elif len(matching) > 1:
                console.print(f"[yellow]Multiple habits match '{habit_id_or_name}':[/yellow]")
                for h in matching:
                    console.print(f"  • {h['title']} (ID: {h['id']})")
                raise click.ClickException("Please be more specific")

        if not habit:
            console.print(f"[red]❌ Habit '{habit_id_or_name}' not found[/red]")
            return

        # Update the habit
        update_data = {"is_paused": True}
        if pause_until:
            update_data["paused_until"] = pause_until

        client.update_task(habit['id'], update_data)

        if pause_until:
            console.print(f"[green]✅ Paused '{habit['title']}' until {pause_until}[/green]")
        else:
            console.print(f"[green]✅ Paused '{habit['title']}' indefinitely[/green]")
        console.print("[dim]Use 'task resume-habit' to resume[/dim]")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("resume-habit")
@click.argument("habit_id_or_name")
@click.pass_context
def resume_habit(ctx, habit_id_or_name):
    """Resume a paused habit

    Examples:
      task resume-habit Gym
      task resume-habit Meditation
    """
    client = ctx.obj['client']

    try:
        # Find the habit
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]

        # Try to find by ID first
        habit = next((h for h in habits if h['id'] == habit_id_or_name), None)

        # Try by title
        if not habit:
            matching = [h for h in habits if habit_id_or_name.lower() in h['title'].lower()]
            if len(matching) == 1:
                habit = matching[0]
            elif len(matching) > 1:
                console.print(f"[yellow]Multiple habits match '{habit_id_or_name}':[/yellow]")
                for h in matching:
                    console.print(f"  • {h['title']} (ID: {h['id']})")
                raise click.ClickException("Please be more specific")

        if not habit:
            console.print(f"[red]❌ Habit '{habit_id_or_name}' not found[/red]")
            return

        # Update the habit
        update_data = {"is_paused": False, "paused_until": None}
        client.update_task(habit['id'], update_data)

        console.print(f"[green]✅ Resumed '{habit['title']}'[/green]")
        console.print("[dim]Run 'task schedule generate --force' to update schedules[/dim]")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("edit-habit")
@click.argument("habit_id_or_name")
@click.option("--title", help="New title")
@click.option("--time", "estimated_minutes", type=int, help="New duration in minutes")
@click.option("--priority", type=int, help="New priority (1-5)")
@click.option("--energy", type=click.Choice(['low', 'medium', 'high']), help="New energy level")
@click.option("--days", multiple=True, type=click.Choice(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']),
              help="New days of week (can specify multiple times)")
@click.option("--at", "time_of_day", help="New time of day (HH:MM)")
@click.pass_context
def edit_habit(ctx, habit_id_or_name, title, estimated_minutes, priority, energy, days, time_of_day):
    """Edit a habit's properties including recurrence

    Examples:
      task edit-habit Gym --time 90                      # Change duration
      task edit-habit Meditation --at 21:30              # Change time
      task edit-habit Lunch --days mon --days tue --days wed  # Change days
      task edit-habit "Novel Reading" --priority 1 --energy medium
    """
    client = ctx.obj['client']

    try:
        # Find the habit
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]

        # Try to find by ID first
        habit = next((h for h in habits if h['id'] == habit_id_or_name), None)

        # Try by title
        if not habit:
            matching = [h for h in habits if habit_id_or_name.lower() in h['title'].lower()]
            if len(matching) == 1:
                habit = matching[0]
            elif len(matching) > 1:
                console.print(f"[yellow]Multiple habits match '{habit_id_or_name}':[/yellow]")
                for h in matching:
                    console.print(f"  • {h['title']} (ID: {h['id']})")
                raise click.ClickException("Please be more specific")

        if not habit:
            console.print(f"[red]❌ Habit '{habit_id_or_name}' not found[/red]")
            return

        # Build update data
        update_data = {}
        if title:
            update_data['title'] = title
        if estimated_minutes:
            update_data['estimated_minutes'] = estimated_minutes
        if priority:
            update_data['priority'] = priority
        if energy:
            update_data['energy_level'] = energy

        # Handle recurrence updates
        if days or time_of_day:
            # Get current recurrence
            current_rec = habit.get('recurrence', {})
            new_rec = {
                "frequency": current_rec.get('frequency', 'weekly'),
                "days_of_week": current_rec.get('days_of_week', []),
                "time_of_day": current_rec.get('time_of_day', '09:00')
            }

            if days:
                day_map = {
                    'mon': 'Monday', 'tue': 'Tuesday', 'wed': 'Wednesday',
                    'thu': 'Thursday', 'fri': 'Friday', 'sat': 'Saturday', 'sun': 'Sunday'
                }
                new_rec['days_of_week'] = [day_map[d] for d in days]
                new_rec['frequency'] = 'daily' if len(days) == 7 else 'weekly'

            if time_of_day:
                new_rec['time_of_day'] = time_of_day

            update_data['recurrence'] = new_rec

        if not update_data:
            console.print("[yellow]⚠️  No changes specified. Use --help to see options.[/yellow]")
            return

        result = client.update_task(habit['id'], update_data)

        console.print(f"[green]✅ Updated habit: {result['title']}[/green]")
        for key, value in update_data.items():
            if key == 'recurrence':
                console.print(f"  • Schedule: {value.get('days_of_week', [])} at {value.get('time_of_day', '')}")
            else:
                console.print(f"  • {key}: {value}")
        console.print("[dim]Run 'task schedule generate --force' to update schedules[/dim]")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("habit-stats")
@click.argument("habit_id_or_name", required=False)
@click.option("--days", type=int, default=30, help="Number of days to analyze")
@click.pass_context
def habit_stats(ctx, habit_id_or_name, days):
    """Show habit completion analytics and streaks

    Shows completion rates, current streak, and longest streak for habits.

    Examples:
      task habit-stats                    # Overview of all habits
      task habit-stats Meditation         # Stats for specific habit
      task habit-stats Gym --days 90      # Last 90 days
    """
    client = ctx.obj['client']

    try:
        if habit_id_or_name:
            # Get stats for a specific habit
            all_tasks = client.list_tasks()
            habits = [t for t in all_tasks if t.get('is_habit', False)]

            # Find the habit
            habit = next((h for h in habits if h['id'] == habit_id_or_name), None)
            if not habit:
                matching = [h for h in habits if habit_id_or_name.lower() in h['title'].lower()]
                if len(matching) == 1:
                    habit = matching[0]
                elif len(matching) > 1:
                    console.print(f"[yellow]Multiple habits match:[/yellow]")
                    for h in matching:
                        console.print(f"  • {h['title']}")
                    return

            if not habit:
                console.print(f"[red]❌ Habit '{habit_id_or_name}' not found[/red]")
                return

            # Get analytics from API
            try:
                stats = client.get_habit_stats(habit['id'], days)

                console.print(f"\n[bold cyan]{stats.get('habit_title', habit['title'])} - {days} Day Stats[/bold cyan]\n")

                # Completion rate
                rate = stats.get('completion_rate', 0) * 100
                rate_color = "green" if rate >= 80 else "yellow" if rate >= 50 else "red"
                console.print(f"  Completion Rate: [{rate_color}]{rate:.0f}%[/{rate_color}]")
                console.print(f"  Completed: {stats.get('completed_count', 0)}/{stats.get('scheduled_count', 0)} days")

                # Streaks
                current_streak = stats.get('current_streak', 0)
                longest_streak = stats.get('longest_streak', 0)
                streak_icon = "🔥" if current_streak >= 7 else "⚡" if current_streak >= 3 else "📈"

                console.print(f"\n  {streak_icon} Current Streak: {current_streak} days")
                console.print(f"  🏆 Longest Streak: {longest_streak} days")

                # Recent activity
                if stats.get('recent_completions'):
                    console.print(f"\n  Recent Completions:")
                    for comp in stats['recent_completions'][-5:]:
                        console.print(f"    ✓ {comp}")

            except Exception as api_err:
                # If API doesn't have analytics yet, show basic info
                console.print(f"\n[bold]{habit['title']}[/bold]")
                rec = habit.get('recurrence', {})
                console.print(f"  Schedule: {rec.get('days_of_week', [])} at {rec.get('time_of_day', 'N/A')}")
                console.print(f"  Duration: {habit['estimated_minutes']} minutes")
                console.print(f"  Status: {'Paused' if habit.get('is_paused') else 'Active'}")
                console.print(f"\n[dim]Detailed analytics require tracking habit completions.[/dim]")
        else:
            # Show overview of all habits
            all_tasks = client.list_tasks()
            habits = [t for t in all_tasks if t.get('is_habit', False)]

            if not habits:
                console.print("[yellow]No habits found.[/yellow]")
                return

            console.print(f"\n[bold cyan]Habit Overview ({days} days)[/bold cyan]\n")

            table = Table()
            table.add_column("Habit", style="bold")
            table.add_column("Schedule", style="dim")
            table.add_column("Status", justify="center")
            table.add_column("Time", justify="right")

            for habit in habits:
                rec = habit.get('recurrence', {})

                # Days
                if rec.get('frequency') == 'daily':
                    days_str = "Daily"
                else:
                    day_abbrev = {'Monday': 'M', 'Tuesday': 'Tu', 'Wednesday': 'W',
                                  'Thursday': 'Th', 'Friday': 'F', 'Saturday': 'Sa', 'Sunday': 'Su'}
                    days_list = rec.get('days_of_week', [])
                    days_str = "".join([day_abbrev.get(d, '?') for d in days_list])

                time_str = rec.get('time_of_day', '-')

                # Status
                if habit.get('is_paused'):
                    status = "[yellow]⏸ Paused[/yellow]"
                else:
                    status = "[green]✓ Active[/green]"

                table.add_row(
                    habit['title'],
                    f"{days_str} @ {time_str}",
                    status,
                    f"{habit['estimated_minutes']}m"
                )

            console.print(table)
            console.print(f"\n[dim]For detailed stats: task habit-stats \"Habit Name\"[/dim]")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


# ============================================================================
# HABIT INSTANCE COMMANDS (Meal Planning, etc.)
# ============================================================================

@cli.command("plan-habit")
@click.argument("habit_name")
@click.argument("detail")
@click.option("--date", "-d", default=None, help="Date (YYYY-MM-DD), defaults to today")
@click.option("--notes", "-n", default=None, help="Optional notes (e.g., recipe link)")
@click.pass_context
def plan_habit(ctx, habit_name, detail, date, notes):
    """Plan what a habit instance will be for a specific day

    Perfect for meal planning! Set what you'll have for lunch, dinner, etc.

    Examples:
      task plan-habit "Lunch" "Fried Rice"
      task plan-habit "Lunch" "Pasta with Salad" --date 2025-12-20
      task plan-habit "Dinner" "Grilled Chicken" -d 2025-12-21 --notes "Recipe: example.com/recipe"

    Meal prep for the week:
      task plan-habit Lunch "Meal Prep Bowl" -d 2025-12-23
      task plan-habit Lunch "Leftover Bowl" -d 2025-12-24
    """
    from datetime import date as dt_date
    client = ctx.obj['client']

    try:
        # Find the habit by name
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]

        # Find matching habit
        matching = [h for h in habits if habit_name.lower() in h['title'].lower()]

        if not matching:
            console.print(f"[red]❌ No habit found matching '{habit_name}'[/red]")
            console.print("\n[dim]Available habits:[/dim]")
            for h in habits:
                console.print(f"  • {h['title']}")
            return

        if len(matching) > 1:
            exact = [h for h in matching if h['title'].lower() == habit_name.lower()]
            if len(exact) == 1:
                matching = exact
            else:
                console.print(f"[yellow]Multiple habits match '{habit_name}':[/yellow]")
                for h in matching:
                    console.print(f"  • {h['title']} (ID: {h['id'][:8]}...)")
                raise click.ClickException("Please be more specific")

        habit = matching[0]
        target_date = date if date else dt_date.today().isoformat()

        # Set the habit instance
        result = client.set_habit_instance(habit['id'], target_date, detail, notes)

        console.print(f"[green]✓ Planned:[/green] {habit['title']} - {detail}")
        console.print(f"[dim]  Date: {target_date}[/dim]")
        if notes:
            console.print(f"[dim]  Notes: {notes}[/dim]")

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("habit-plan")
@click.argument("habit_name")
@click.option("--days", "-d", type=int, default=7, help="Number of days to show")
@click.option("--print", "-p", "printable", is_flag=True, help="Plain text output for printing")
@click.pass_context
def habit_plan(ctx, habit_name, days, printable):
    """View planned instances for a habit (meal plan view)

    Examples:
      task habit-plan "Lunch"
      task habit-plan "Dinner" --days 14
      task habit-plan "Lunch" --print           # Plain text for printing
      task habit-plan "Lunch" -p > meal-plan.txt  # Save to file
    """
    from datetime import date as dt_date, timedelta
    client = ctx.obj['client']

    try:
        # Find the habit
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]
        matching = [h for h in habits if habit_name.lower() in h['title'].lower()]

        if not matching:
            if printable:
                print(f"No habit found matching '{habit_name}'")
            else:
                console.print(f"[red]❌ No habit found matching '{habit_name}'[/red]")
            return

        habit = matching[0]

        # Get instances for the next N days
        start = dt_date.today()
        end = start + timedelta(days=days)

        instances = client.list_habit_instances(
            habit['id'],
            start_date=start.isoformat(),
            end_date=end.isoformat()
        )

        # Create lookup by date
        instance_map = {inst['date']: inst for inst in instances}

        if printable:
            # Plain text output for printing
            print()
            print(f"{'=' * 40}")
            print(f"  {habit['title'].upper()} PLAN")
            print(f"  {start.strftime('%B %d')} - {end.strftime('%B %d, %Y')}")
            print(f"{'=' * 40}")
            print()

            current = start
            while current <= end:
                date_str = current.isoformat()
                day_name = current.strftime("%A %b %d")

                if date_str in instance_map:
                    inst = instance_map[date_str]
                    print(f"  {day_name}:")
                    print(f"    → {inst['instance_detail']}")
                    if inst.get('notes'):
                        print(f"      ({inst['notes']})")
                else:
                    print(f"  {day_name}:")
                    print(f"    → _______________")

                current += timedelta(days=1)

            print()
            print(f"{'=' * 40}")
            print()
        else:
            console.print(f"\n[bold]{habit['title']} Plan[/bold] ({days} days)")
            console.print("─" * 40)

            current = start
            while current <= end:
                date_str = current.isoformat()
                day_name = current.strftime("%a %b %d")

                if date_str in instance_map:
                    inst = instance_map[date_str]
                    console.print(f"  {day_name}: [green]{inst['instance_detail']}[/green]")
                    if inst.get('notes'):
                        console.print(f"             [dim]{inst['notes']}[/dim]")
                else:
                    console.print(f"  {day_name}: [dim]Not planned[/dim]")

                current += timedelta(days=1)

            console.print()
            console.print(f"[dim]Plan with: task plan-habit \"{habit['title']}\" \"Your meal\" --date YYYY-MM-DD[/dim]")

    except Exception as e:
        if printable:
            print(f"Error: {e}")
        else:
            console.print(f"[red]❌ Error: {e}[/red]")


@cli.command("weekly-habits")
@click.option("--days", "-d", type=int, default=7, help="Number of days to show")
@click.option("--print", "-p", "printable", is_flag=True, help="Plain text output for printing")
@click.pass_context
def weekly_habits(ctx, days, printable):
    """View all habits for the week with their planned instances

    Perfect for printing and putting on your fridge!

    Examples:
      task weekly-habits
      task weekly-habits --days 14
      task weekly-habits --print              # Plain text for printing
      task weekly-habits -p > weekly.txt      # Save to file
    """
    from datetime import date as dt_date, timedelta
    client = ctx.obj['client']

    try:
        # Get all habits
        all_tasks = client.list_tasks()
        habits = [t for t in all_tasks if t.get('is_habit', False)]

        if not habits:
            if printable:
                print("No habits found.")
            else:
                console.print("[yellow]No habits found.[/yellow]")
            return

        start = dt_date.today()
        end = start + timedelta(days=days)

        # Collect all instances for all habits
        all_instances = {}
        for habit in habits:
            instances = client.list_habit_instances(
                habit['id'],
                start_date=start.isoformat(),
                end_date=end.isoformat()
            )
            all_instances[habit['id']] = {
                'habit': habit,
                'instances': {inst['date']: inst for inst in instances}
            }

        if printable:
            # Plain text output for printing
            print()
            print(f"{'=' * 50}")
            print(f"  WEEKLY HABIT PLAN")
            print(f"  {start.strftime('%B %d')} - {end.strftime('%B %d, %Y')}")
            print(f"{'=' * 50}")

            current = start
            while current <= end:
                date_str = current.isoformat()
                day_name = current.strftime("%A, %B %d")

                print()
                print(f"  {day_name}")
                print(f"  {'-' * 30}")

                for habit in habits:
                    habit_data = all_instances[habit['id']]
                    recurrence = habit.get('recurrence', {})
                    habit_days = recurrence.get('days_of_week', [])
                    time_of_day = recurrence.get('time_of_day', '')

                    # Check if habit is scheduled for this day
                    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    current_day_name = day_names[current.weekday()]

                    if current_day_name in habit_days or not habit_days:
                        time_str = f" ({time_of_day})" if time_of_day else ""
                        instance = habit_data['instances'].get(date_str)

                        if instance:
                            print(f"    [ ] {habit['title']}{time_str}: {instance['instance_detail']}")
                        else:
                            print(f"    [ ] {habit['title']}{time_str}")

                current += timedelta(days=1)

            print()
            print(f"{'=' * 50}")
            print("  [ ] = checkbox for completion")
            print()
        else:
            console.print(f"\n[bold]Weekly Habit Plan[/bold] ({days} days)")
            console.print(f"[dim]{start.strftime('%B %d')} - {end.strftime('%B %d, %Y')}[/dim]")
            console.print("─" * 50)

            current = start
            while current <= end:
                date_str = current.isoformat()
                day_name = current.strftime("%A, %B %d")
                is_today = current == dt_date.today()

                if is_today:
                    console.print(f"\n[bold cyan]📅 {day_name} (TODAY)[/bold cyan]")
                else:
                    console.print(f"\n[bold]{day_name}[/bold]")

                for habit in habits:
                    habit_data = all_instances[habit['id']]
                    recurrence = habit.get('recurrence', {})
                    habit_days = recurrence.get('days_of_week', [])
                    time_of_day = recurrence.get('time_of_day', '')

                    # Check if habit is scheduled for this day
                    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                    current_day_name = day_names[current.weekday()]

                    if current_day_name in habit_days or not habit_days:
                        time_str = f" [dim]({time_of_day})[/dim]" if time_of_day else ""
                        instance = habit_data['instances'].get(date_str)

                        if instance:
                            console.print(f"  ☐ {habit['title']}{time_str}: [green]{instance['instance_detail']}[/green]")
                        else:
                            console.print(f"  ☐ {habit['title']}{time_str}")

                current += timedelta(days=1)

            console.print()
            console.print("[dim]Tip: Use --print flag for a printable version[/dim]")

    except Exception as e:
        if printable:
            print(f"Error: {e}")
        else:
            console.print(f"[red]❌ Error: {e}[/red]")


# ============================================================================
# EXPORT COMMANDS
# ============================================================================

@cli.command("export")
@click.option("--projects/--no-projects", default=True, help="Include projects")
@click.option("--tasks/--no-tasks", default=True, help="Include tasks")
@click.option("--habits/--no-habits", default=True, help="Include habits")
@click.option("--schedules/--no-schedules", default=True, help="Include schedules")
@click.option("--schedule-days", type=int, default=14, help="Days of schedule to export")
@click.option("--completed/--no-completed", default=False, help="Include completed tasks")
@click.option("--output", "-o", type=click.Path(), help="Output file path (default: stdout)")
@click.option("--pretty", is_flag=True, help="Pretty-print JSON output")
@click.pass_context
def export_data(ctx, projects, tasks, habits, schedules, schedule_days, completed, output, pretty):
    """Export data to JSON format

    Export your projects, tasks, habits, and schedules for backup or AI processing.

    Examples:
      task export                           # Export all to stdout
      task export -o backup.json            # Save to file
      task export --no-schedules            # Export without schedules
      task export --tasks --habits          # Only tasks and habits
      task export --completed               # Include completed tasks
      task export --schedule-days 30        # 30 days of schedules
    """
    import json
    client = ctx.obj['client']

    try:
        # Build export options
        options = {
            "include_projects": projects,
            "include_tasks": tasks,
            "include_habits": habits,
            "include_schedules": schedules,
            "schedule_days": schedule_days,
            "include_completed": completed,
        }

        # Call export API
        result = client.export_data(options)

        # Format output
        indent = 2 if pretty else None
        json_output = json.dumps(result, indent=indent, default=str)

        if output:
            with open(output, 'w') as f:
                f.write(json_output)
            console.print(f"[green]✅ Exported to {output}[/green]")

            # Print summary
            if result.get('projects'):
                console.print(f"   • {len(result['projects'])} projects")
            if result.get('tasks'):
                console.print(f"   • {len(result['tasks'])} tasks")
            if result.get('habits'):
                console.print(f"   • {len(result['habits'])} habits")
            if result.get('schedules'):
                console.print(f"   • {len(result['schedules'])} days of schedules")
        else:
            # Output to stdout
            print(json_output)

    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


if __name__ == "__main__":
    cli(obj={})