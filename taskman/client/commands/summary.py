import click
from rich.console import Console
from rich.panel import Panel
from datetime import date
from taskman.client.services.api_client import APIClient

console = Console()

@click.command()
@click.argument('date_str', required=False)
@click.pass_context
def summary(ctx, date_str):
    """Show daily summary"""
    client = APIClient(ctx.obj['server_url'])
    
    if date_str:
        target_date = date_str
    else:
        target_date = date.today().isoformat()
    
    try:
        sched = client.get_schedule(target_date)
        
        summary_text = f"""
📅 Schedule for {sched['date']}

📊 Summary
  • Tasks scheduled: {sched['summary']['tasks_remaining']}
  • Time planned: {sched['summary']['total_scheduled_minutes']} minutes
  • Tasks completed: {sched['summary']['tasks_completed']}
  • Time spent: {sched['summary']['total_completed_minutes']} minutes
  • Completion rate: {sched['summary']['completion_rate']*100:.0f}%

✅ Completed: {len(sched['completed_tasks'])} tasks
⏳ Remaining: {sched['summary']['tasks_remaining']} tasks
        """
        
        console.print(Panel(summary_text.strip(), title="Daily Summary", border_style="blue"))
        
        if sched['summary']['tasks_behind_schedule'] > 0:
            console.print(f"\n⚠️  You're behind schedule on {sched['summary']['tasks_behind_schedule']} tasks", style="yellow")
            console.print("💡 Consider running: task schedule reschedule\n")
        
    except Exception as e:
        console.print(f"❌ Error: {str(e)}", style="red")
