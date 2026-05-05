import click
from rich.console import Console
from rich.table import Table
from taskman.client.services.api_client import APIClient

console = Console()

@click.group()
def project():
    """Manage projects"""
    pass

@project.command()
@click.argument('name')
@click.option('--priority', type=int, default=3, help='Priority (1-5)')
@click.option('--description', help='Project description')
@click.option('--tag', multiple=True, help='Tags as key=value')
@click.pass_context
def add(ctx, name, priority, description, tag):
    """Add a new project"""
    client = APIClient(ctx.obj['server_url'])
    
    tags = {}
    for t in tag:
        if '=' in t:
            key, value = t.split('=', 1)
            tags[key] = value
    
    data = {
        "name": name,
        "priority": priority,
        "description": description,
        "tags": tags
    }
    
    try:
        project = client.create_project(data)
        console.print(f"✅ Created project: {project['name']} (ID: {project['id']})", style="green")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@project.command()
@click.option('--status', help='Filter by status')
@click.pass_context
def list(ctx, status):
    """List all projects"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        projects = client.list_projects(status=status)
        
        if not projects:
            console.print("No projects found.", style="yellow")
            return
        
        table = Table(title="Projects")
        table.add_column("ID", style="cyan")
        table.add_column("Name", style="magenta")
        table.add_column("Priority", style="yellow")
        table.add_column("Status", style="green")
        table.add_column("Tags")
        
        for proj in projects:
            tags_str = ", ".join(f"{k}={v}" for k, v in proj.get('tags', {}).items())
            table.add_row(
                proj['id'],
                proj['name'],
                str(proj['priority']),
                proj['status'],
                tags_str
            )
        
        console.print(table)
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@project.command()
@click.argument('project_id')
@click.pass_context
def view(ctx, project_id):
    """View project details"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        proj = client.get_project(project_id)
        
        console.print(f"\n[bold cyan]Project: {proj['name']}[/bold cyan]")
        console.print(f"ID: {proj['id']}")
        console.print(f"Priority: {proj['priority']}")
        console.print(f"Status: {proj['status']}")
        if proj.get('description'):
            console.print(f"Description: {proj['description']}")
        if proj.get('tags'):
            console.print(f"Tags: {proj['tags']}")
        console.print(f"Created: {proj['created_at']}")
        console.print(f"Updated: {proj['updated_at']}\n")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@project.command()
@click.argument('project_id')
@click.pass_context
def remove(ctx, project_id):
    """Remove a project"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        client.delete_project(project_id)
        console.print(f"✅ Deleted project {project_id}", style="green")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")