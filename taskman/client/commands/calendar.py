# Add these commands to your CLI (taskman/client/cli.py)
# Or create a new calendar.py in taskman/client/commands/

import click
from datetime import date, datetime, timedelta
from rich.console import Console
from taskman.client.utils.calendar_views import (
    show_day, show_week, show_month, show_project_timeline
)

console = Console()


@click.group()
def calendar():
    """Calendar views for schedules"""
    pass


@calendar.command("day")
@click.argument('date_str', required=False)
@click.option('--view', '-v', 
              type=click.Choice(['all', 'pending', 'completed']), 
              default='all',
              help='View mode: all tasks, pending only, or completed only')
@click.pass_context
def calendar_day(ctx, date_str, view):
    """Show detailed day view with timeline
    
    Examples:
      task calendar day                    # Today
      task calendar day 2025-10-20         # Specific date
      task calendar day --view pending     # Only pending tasks
      task calendar day --view completed   # Only completed tasks
    """
    client = ctx.obj['client']
    
    try:
        if date_str:
            target_date = datetime.fromisoformat(date_str).date()
        else:
            target_date = date.today()
        
        show_day(client, target_date, view)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@calendar.command("week")
@click.argument('date_str', required=False)
@click.option('--view', '-v',
              type=click.Choice(['all', 'pending', 'completed']),
              default='all',
              help='View mode: all tasks, pending only, or completed only')
@click.pass_context
def calendar_week(ctx, date_str, view):
    """Show week view (7 days)
    
    Shows Mon-Sun for the week containing the specified date.
    
    Examples:
      task calendar week                   # This week
      task calendar week 2025-10-20        # Week containing that date
      task calendar week --view pending    # Only pending tasks
      task calendar week --view completed  # Only completed tasks
    """
    client = ctx.obj['client']
    
    try:
        if date_str:
            start_date = datetime.fromisoformat(date_str).date()
        else:
            start_date = date.today()
        
        show_week(client, start_date, view)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@calendar.command("month")
@click.argument('month_str', required=False)
@click.option('--view', '-v',
              type=click.Choice(['all', 'pending', 'completed']),
              default='all',
              help='View mode: all tasks, pending only, or completed only')
@click.pass_context
def calendar_month(ctx, month_str, view):
    """Show month calendar view
    
    Month format: YYYY-MM or just MM for current year
    
    Examples:
      task calendar month                  # This month
      task calendar month 2025-11          # November 2025
      task calendar month 11               # November this year
      task calendar month --view pending   # Only pending tasks
    """
    client = ctx.obj['client']
    
    try:
        if month_str:
            if '-' in month_str:
                # Full YYYY-MM format
                year, month = map(int, month_str.split('-'))
            else:
                # Just month number, use current year
                year = date.today().year
                month = int(month_str)
        else:
            # Current month
            today = date.today()
            year = today.year
            month = today.month
        
        show_month(client, year, month, view)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@calendar.command("project")
@click.argument('project')
@click.option('--days', '-d', type=int, default=14,
              help='Number of days to show (default: 14)')
@click.pass_context
def calendar_project(ctx, project, days):
    """Show timeline for a specific project
    
    Examples:
      task calendar project "GammaZero"
      task calendar project gamma --days 30
    """
    client = ctx.obj['client']
    
    try:
        show_project_timeline(client, project, days)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


# Convenience shortcuts - add these to main CLI

#@click.command("day")
#@click.argument('date_str', required=False)
#@click.option('--view', '-v',
#              type=click.Choice(['all', 'pending', 'completed']),
#              default='all')
'''
@calendar.command("day")
@click.option('--view', '-v', 
               type=click.Choice(['all', 'pending', 'completed', 'habits', 'tasks']), 
               default='all',
               help='View mode: all, pending, completed, habits only, or tasks only')

@click.pass_context
def day(ctx, date_str, view):
    """Quick day view (shortcut for 'calendar day')
    
    Examples:
      task day                    # Today
      task day --view pending     # Only pending
    """
    from taskman.client.utils.calendar_views import show_day
    
    client = ctx.obj['client']
    target_date = datetime.fromisoformat(date_str).date() if date_str else date.today()
    show_day(client, target_date, view)
'''
@calendar.command("day")
@click.argument('date_str', required=False)
@click.option('--view', '-v', 
              type=click.Choice(['all', 'pending', 'completed', 'habits', 'tasks']), 
              default='all',
              help='View mode: all, pending, completed, habits only, or tasks only')
@click.pass_context
def day(ctx, date_str, view):
    """Quick day view (shortcut for 'calendar day')
    
    Examples:
      task day                    # Today
      task day 2025-10-20        # Specific date
      task day --view pending     # Only pending
      task day --view habits      # Only habits
    """
    from taskman.client.utils.calendar_views import show_day
    from datetime import datetime, date
    
    client = ctx.obj['client']
    
    try:
        if date_str:
            target_date = datetime.fromisoformat(date_str).date()
        else:
            target_date = date.today()
        
        show_day(client, target_date, view)
    except Exception as e:
        console.print(f"[red]❌ Error: {e}[/red]")


@click.command("week")
@click.argument('date_str', required=False)
@click.option('--view', '-v',
              type=click.Choice(['all', 'pending', 'completed']),
              default='all')
@click.pass_context  
def week(ctx, date_str, view):
    """Quick week view (shortcut for 'calendar week')
    
    Examples:
      task week                   # This week
      task week --view completed  # Completed tasks only
    """
    from taskman.client.utils.calendar_views import show_week
    
    client = ctx.obj['client']
    start_date = datetime.fromisoformat(date_str).date() if date_str else date.today()
    show_week(client, start_date, view)


@click.command("month")
@click.argument('month_str', required=False)
@click.option('--view', '-v',
              type=click.Choice(['all', 'pending', 'completed']),
              default='all')
@click.pass_context
def month(ctx, month_str, view):
    """Quick month view (shortcut for 'calendar month')
    
    Examples:
      task month                  # This month
      task month 11               # November
      task month --view pending   # Pending tasks only
    """
    from taskman.client.utils.calendar_views import show_month
    
    client = ctx.obj['client']
    
    if month_str:
        if '-' in month_str:
            year, month_num = map(int, month_str.split('-'))
        else:
            year = date.today().year
            month_num = int(month_str)
    else:
        today = date.today()
        year = today.year
        month_num = today.month
    
    show_month(client, year, month_num, view)