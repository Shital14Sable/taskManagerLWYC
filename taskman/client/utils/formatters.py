"""
Rich formatting helpers for CLI output
"""
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from rich.text import Text
from typing import List, Dict, Any

def format_project_table(projects: List[Dict]) -> Table:
    """Format projects as a Rich table"""
    table = Table(title="Projects", show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan", width=10)
    table.add_column("Name", style="white", no_wrap=False)
    table.add_column("Priority", style="yellow", justify="center", width=8)
    table.add_column("Status", style="green", justify="center")
    table.add_column("Tags", style="dim")
    
    for proj in projects:
        tags_str = ", ".join(f"{k}={v}" for k, v in proj.get('tags', {}).items())
        status_color = {
            'active': 'green',
            'paused': 'yellow',
            'completed': 'blue',
            'archived': 'dim'
        }.get(proj['status'], 'white')
        
        table.add_row(
            proj['id'],
            proj['name'],
            str(proj['priority']),
            f"[{status_color}]{proj['status']}[/{status_color}]",
            tags_str[:40]
        )
    
    return table

def format_task_table(tasks: List[Dict]) -> Table:
    """Format tasks as a Rich table"""
    table = Table(title="Tasks", show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan", width=10)
    table.add_column("Title", style="white", no_wrap=False)
    table.add_column("P", style="yellow", justify="center", width=3)
    table.add_column("D", style="yellow", justify="center", width=3)
    table.add_column("Energy", style="cyan", width=8)
    table.add_column("Time", style="blue", width=8)
    table.add_column("Status", style="green")
    
    for task in tasks:
        status_color = {
            'todo': 'yellow',
            'in_progress': 'blue',
            'completed': 'green',
            'blocked': 'red'
        }.get(task['status'], 'white')
        
        energy_icon = {
            'high': '🔥',
            'medium': '⚡',
            'low': '💤'
        }.get(task['energy_level'], '⚡')
        
        table.add_row(
            task['id'],
            task['title'][:50],
            str(task['priority']),
            str(task['difficulty']),
            f"{energy_icon} {task['energy_level']}",
            f"{task['estimated_minutes']}m",
            f"[{status_color}]{task['status']}[/{status_color}]"
        )
    
    return table

def format_task_tree(tasks: List[Dict], project_name: str = "Tasks") -> Tree:
    """Format tasks as a hierarchical tree"""
    tree = Tree(f"📁 {project_name}")
    
    # Build task lookup
    task_dict = {t['id']: t for t in tasks}
    
    # Find root tasks (no parent)
    root_tasks = [t for t in tasks if not t.get('parent_task_id')]
    
    def add_task_node(parent_node, task):
        """Recursively add task and its children"""
        status_icon = {
            'todo': '⚪',
            'in_progress': '🔵',
            'completed': '✅',
            'blocked': '🔴'
        }.get(task['status'], '⚪')
        
        node_text = f"{status_icon} {task['title']} [{task['estimated_minutes']}m]"
        node = parent_node.add(node_text)
        
        # Add children
        children = [t for t in tasks if t.get('parent_task_id') == task['id']]
        for child in children:
            add_task_node(node, child)
    
    # Add all root tasks
    for task in root_tasks:
        add_task_node(tree, task)
    
    return tree

def format_schedule_panel(schedule: Dict) -> Panel:
    """Format schedule as a Rich panel"""
    summary = schedule.get('summary', {})
    
    content = f"""
📊 [bold]Summary[/bold]
  • Tasks scheduled: {summary.get('tasks_remaining', 0)}
  • Tasks completed: {summary.get('tasks_completed', 0)}
  • Time planned: {summary.get('total_scheduled_minutes', 0)} minutes
  • Time spent: {summary.get('total_completed_minutes', 0)} minutes
  • Completion rate: {summary.get('completion_rate', 0):.0%}

⏰ [bold]Scheduled Tasks[/bold]
"""
    
    for task in schedule.get('scheduled_tasks', [])[:10]:  # Show first 10
        task_type = "☕" if task['is_buffer'] else "📌"
        completed = "✅" if task['task_id'] in schedule.get('completed_tasks', []) else ""
        content += f"\n  {task_type} {task['start_time']}-{task['end_time']}  {task['task_id'][:8]}  {task['estimated_minutes']}m {completed}"
    
    return Panel(
        content.strip(),
        title=f"Schedule for {schedule['date']}",
        border_style="blue"
    )

def format_project_detail(project: Dict) -> Panel:
    """Format project details as a Rich panel"""
    content = f"""
[bold cyan]ID:[/bold cyan] {project['id']}
[bold cyan]Name:[/bold cyan] {project['name']}
[bold cyan]Priority:[/bold cyan] {project['priority']}
[bold cyan]Status:[/bold cyan] {project['status']}
"""
    
    if project.get('description'):
        content += f"\n[bold cyan]Description:[/bold cyan] {project['description']}"
    
    if project.get('tags'):
        tags = ", ".join(f"{k}={v}" for k, v in project['tags'].items())
        content += f"\n[bold cyan]Tags:[/bold cyan] {tags}"
    
    content += f"\n\n[bold cyan]Created:[/bold cyan] {project['created_at']}"
    content += f"\n[bold cyan]Updated:[/bold cyan] {project['updated_at']}"
    
    return Panel(content.strip(), title="Project Details", border_style="cyan")

def format_task_detail(task: Dict) -> Panel:
    """Format task details as a Rich panel"""
    content = f"""
[bold cyan]ID:[/bold cyan] {task['id']}
[bold cyan]Title:[/bold cyan] {task['title']}
[bold cyan]Project:[/bold cyan] {task['project_id']}

[bold yellow]Priority:[/bold yellow] {task['priority']}  [bold yellow]Difficulty:[/bold yellow] {task['difficulty']}
[bold yellow]Energy Level:[/bold yellow] {task['energy_level']}
[bold yellow]Estimated Time:[/bold yellow] {task['estimated_minutes']} minutes
"""
    
    if task.get('actual_minutes'):
        content += f"[bold yellow]Actual Time:[/bold yellow] {task['actual_minutes']} minutes\n"
    
    content += f"\n[bold green]Status:[/bold green] {task['status']}"
    
    if task.get('description'):
        content += f"\n\n[bold]Description:[/bold]\n{task['description']}"
    
    if task.get('tags'):
        tags = ", ".join(f"{k}={v}" for k, v in task['tags'].items())
        content += f"\n\n[bold]Tags:[/bold] {tags}"
    
    if task.get('dependencies'):
        deps = ", ".join(task['dependencies'])
        content += f"\n\n[bold red]Dependencies:[/bold red] {deps}"
    
    return Panel(content.strip(), title="Task Details", border_style="cyan")

def format_error(message: str) -> Text:
    """Format error message"""
    return Text(f"❌ {message}", style="bold red")

def format_success(message: str) -> Text:
    """Format success message"""
    return Text(f"✅ {message}", style="bold green")

def format_warning(message: str) -> Text:
    """Format warning message"""
    return Text(f"⚠️  {message}", style="bold yellow")

def format_info(message: str) -> Text:
    """Format info message"""
    return Text(f"ℹ️  {message}", style="bold blue")