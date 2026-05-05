import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from taskman.client.services.api_client import APIClient

console = Console()

@click.group()
def schedule():
    """Manage schedules"""
    pass

@schedule.command()
@click.option('--days', type=int, default=7, help='Number of days to schedule')
@click.option('--date', 'target_date', help='Start date (YYYY-MM-DD)')
@click.option('--force', is_flag=True, help='Force regeneration')
@click.pass_context
def generate(ctx, days, target_date, force):
    """Generate schedule"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        # Build params dict, only include target_date if provided
        params = {"days": days, "force": force}
        if target_date:
            params["target_date"] = target_date
            
        result = client.generate_schedule(**params)
        console.print(f"✅ Generated {result['count']} schedules", style="green")
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@schedule.command()
@click.pass_context
def today(ctx):
    """View today's schedule"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        sched = client.get_today_schedule()
        _display_schedule(sched)
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@schedule.command()
@click.argument('date')
@click.pass_context
def view(ctx, date):
    """View schedule for a specific date"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        sched = client.get_schedule(date)
        _display_schedule(sched)
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

@schedule.command()
@click.option('--date', 'target_date', help='Date to reschedule (YYYY-MM-DD)')
@click.pass_context
def reschedule(ctx, target_date):
    """Reschedule incomplete tasks"""
    client = APIClient(ctx.obj['server_url'])
    
    try:
        params = {}
        if target_date:
            params["target_date"] = target_date
        sched = client.reschedule(**params)
        console.print(f"✅ Rescheduled tasks for {sched['date']}", style="green")
        _display_schedule(sched)
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")

def _display_schedule(sched):
    """Display schedule in a nice format"""
    console.print(f"\n[bold cyan]Schedule for {sched['date']}[/bold cyan]\n")
    
    # Summary
    summary = sched['summary']
    summary_text = f"""
📊 Summary
  • {summary['tasks_remaining']} tasks scheduled
  • {summary['total_scheduled_minutes']} minutes planned
  • {summary['tasks_completed']} tasks completed
  • Completion rate: {summary['completion_rate']*100:.0f}%
    """
    console.print(Panel(summary_text.strip(), title="Summary", border_style="blue"))
    
    # Scheduled tasks
    if sched['scheduled_tasks']:
        table = Table(title="Scheduled Tasks")
        table.add_column("Time", style="cyan")
        table.add_column("Task ID", style="magenta")
        table.add_column("Duration")
        table.add_column("Type")
        
        for task in sched['scheduled_tasks']:
            task_type = "Buffer" if task['is_buffer'] else "Task"
            table.add_row(
                f"{task['start_time']} - {task['end_time']}",
                task['task_id'],
                f"{task['estimated_minutes']}m",
                task_type
            )
        
        console.print(table)
    
    console.print()
