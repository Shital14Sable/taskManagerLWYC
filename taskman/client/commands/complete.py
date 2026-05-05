import click
from rich.console import Console
from taskman.client.services.api_client import APIClient

console = Console()

@click.command()
@click.argument('task_id')
@click.option('--actual-time', type=int, help='Actual time spent in minutes')
@click.pass_context
def complete(ctx, task_id, actual_time):
    """Mark a task as complete"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        task = client.complete_task(task_id, actual_minutes=actual_time)
        console.print(f"✅ Completed task: {task['title']}", style="green")
        
        if actual_time and task.get('estimated_minutes'):
            estimated = task['estimated_minutes']
            if actual_time > estimated:
                console.print(f"⏱️  Took {actual_time - estimated}m longer than estimated", style="yellow")
            elif actual_time < estimated:
                console.print(f"⏱️  Finished {estimated - actual_time}m earlier than estimated", style="green")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")
