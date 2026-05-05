import click
from rich.console import Console
from rich.table import Table
from taskman.client.services.api_client import APIClient

console = Console()

@click.group()
def task():
    """Manage tasks"""
    pass

@task.command()
@click.argument('project_id')
@click.argument('title')
@click.option('--priority', type=int, default=3, help='Priority (1-5)')
@click.option('--difficulty', type=int, default=3, help='Difficulty (1-5)')
@click.option('--time', 'estimated_minutes', type=int, default=60, help='Estimated minutes')
@click.option('--energy', type=click.Choice(['high', 'medium', 'low']), default='medium')
@click.option('--description', help='Task description')
@click.option('--deadline', help='Deadline date (YYYY-MM-DD format)')
@click.option('--tag', multiple=True, help='Tags as key=value')
@click.option('--depends-on', 'depends_on', multiple=True, help='Task IDs this task depends on')
@click.pass_context
def add(ctx, project_id, title, priority, difficulty, estimated_minutes, energy, description, deadline, tag, depends_on):
    """Add a new task"""
    client = APIClient(ctx.obj['server_url'])

    tags = {}
    for t in tag:
        if '=' in t:
            key, value = t.split('=', 1)
            tags[key] = value

    data = {
        "project_id": project_id,
        "title": title,
        "priority": priority,
        "difficulty": difficulty,
        "estimated_minutes": estimated_minutes,
        "energy_level": energy,
        "description": description,
        "tags": tags
    }

    if deadline:
        data["deadline"] = deadline

    if depends_on:
        data["dependencies"] = list(depends_on)
    
    try:
        task = client.create_task(data)
        console.print(f"✅ Created task: {task['title']} (ID: {task['id']})", style="green")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@task.command()
@click.argument('project_id', required=False)
@click.option('--status', help='Filter by status')
@click.pass_context
def list(ctx, project_id, status):
    """List tasks"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        tasks = client.list_tasks(project_id=project_id, status=status)
        
        if not tasks:
            console.print("No tasks found.", style="yellow")
            return
        
        table = Table(title="Tasks")
        table.add_column("ID", style="cyan")
        table.add_column("Title", style="magenta")
        table.add_column("Priority", style="yellow")
        table.add_column("Difficulty")
        table.add_column("Energy")
        table.add_column("Time")
        table.add_column("Status", style="green")
        
        for t in tasks:
            table.add_row(
                t['id'],
                t['title'][:40],
                str(t['priority']),
                str(t['difficulty']),
                t['energy_level'],
                f"{t['estimated_minutes']}m",
                t['status']
            )
        
        console.print(table)
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@task.command()
@click.argument('task_id')
@click.pass_context
def view(ctx, task_id):
    """View task details"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        t = client.get_task(task_id)
        
        console.print(f"\n[bold cyan]Task: {t['title']}[/bold cyan]")
        console.print(f"ID: {t['id']}")
        console.print(f"Project: {t['project_id']}")
        console.print(f"Priority: {t['priority']} | Difficulty: {t['difficulty']}")
        console.print(f"Energy Level: {t['energy_level']}")
        console.print(f"Estimated: {t['estimated_minutes']} minutes")
        if t.get('actual_minutes'):
            console.print(f"Actual: {t['actual_minutes']} minutes")
        console.print(f"Status: {t['status']}")
        if t.get('deadline'):
            console.print(f"Deadline: {t['deadline']}", style="yellow")
        if t.get('description'):
            console.print(f"Description: {t['description']}")
        if t.get('tags'):
            console.print(f"Tags: {t['tags']}")
        if t.get('dependencies'):
            console.print(f"Dependencies: {', '.join(t['dependencies'])}")
        console.print(f"Created: {t['created_at']}\n")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@task.command()
@click.argument('task_id')
@click.pass_context
def remove(ctx, task_id):
    """Remove a task"""
    client = APIClient(ctx.obj['server_url'])

    try:
        client.delete_task(task_id)
        console.print(f"✅ Deleted task {task_id}", style="green")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")


@task.command()
@click.argument('task_id')
@click.option('--title', help='New title')
@click.option('--priority', type=int, help='Priority (1-5)')
@click.option('--difficulty', type=int, help='Difficulty (1-5)')
@click.option('--time', 'estimated_minutes', type=int, help='Estimated minutes')
@click.option('--energy', type=click.Choice(['high', 'medium', 'low']), help='Energy level')
@click.option('--description', help='Task description')
@click.option('--deadline', help='Deadline date (YYYY-MM-DD format, use "clear" to remove)')
@click.option('--status', type=click.Choice(['pending', 'in_progress', 'completed']), help='Task status')
@click.pass_context
def edit(ctx, task_id, title, priority, difficulty, estimated_minutes, energy, description, deadline, status):
    """Edit a task's properties"""
    client = APIClient(ctx.obj['server_url'])

    # Build update data with only provided fields
    data = {}
    if title is not None:
        data['title'] = title
    if priority is not None:
        data['priority'] = priority
    if difficulty is not None:
        data['difficulty'] = difficulty
    if estimated_minutes is not None:
        data['estimated_minutes'] = estimated_minutes
    if energy is not None:
        data['energy_level'] = energy
    if description is not None:
        data['description'] = description
    if deadline is not None:
        if deadline.lower() == 'clear':
            data['deadline'] = None
        else:
            data['deadline'] = deadline
    if status is not None:
        data['status'] = status

    if not data:
        console.print("No changes specified. Use --help to see available options.", style="yellow")
        return

    try:
        task = client.update_task(task_id, data)
        console.print(f"✅ Updated task: {task['title']}", style="green")

        # Show updated fields
        if title:
            console.print(f"  Title: {task['title']}")
        if priority:
            console.print(f"  Priority: {task['priority']}")
        if difficulty:
            console.print(f"  Difficulty: {task['difficulty']}")
        if estimated_minutes:
            console.print(f"  Estimated: {task['estimated_minutes']} minutes")
        if energy:
            console.print(f"  Energy: {task['energy_level']}")
        if deadline:
            if task.get('deadline'):
                console.print(f"  Deadline: {task['deadline']}")
            else:
                console.print("  Deadline: (cleared)")
        if status:
            console.print(f"  Status: {task['status']}")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")
