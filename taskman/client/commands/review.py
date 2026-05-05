"""
Review CLI commands for daily, weekly, and monthly reviews.
"""
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from datetime import date, timedelta

console = Console()


@click.group()
def review():
    """Generate and view reviews (daily, weekly, monthly)"""
    pass


@review.command()
@click.option("--date", "-d", "date_str", default=None, help="Date (YYYY-MM-DD), default: today")
@click.pass_context
def daily(ctx, date_str):
    """Generate or view today's daily review

    Examples:
      task review daily
      task review daily --date 2024-01-15
    """
    client = ctx.obj['client']

    try:
        params = {}
        if date_str:
            params['date_str'] = date_str

        review = client.get("/reviews/daily", params=params)
        _display_review(review, "Daily")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@review.command()
@click.option("--date", "-d", "date_str", default=None, help="Any date in the week (YYYY-MM-DD)")
@click.pass_context
def weekly(ctx, date_str):
    """Generate or view this week's review

    Examples:
      task review weekly
      task review weekly --date 2024-01-15
    """
    client = ctx.obj['client']

    try:
        params = {}
        if date_str:
            params['date_str'] = date_str

        review = client.get("/reviews/weekly", params=params)
        _display_review(review, "Weekly")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@review.command()
@click.option("--date", "-d", "date_str", default=None, help="Any date in the month (YYYY-MM-DD)")
@click.pass_context
def monthly(ctx, date_str):
    """Generate or view this month's review

    Examples:
      task review monthly
      task review monthly --date 2024-01-15
    """
    client = ctx.obj['client']

    try:
        params = {}
        if date_str:
            params['date_str'] = date_str

        review = client.get("/reviews/monthly", params=params)
        _display_review(review, "Monthly")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@review.command("history")
@click.option("--type", "-t", "review_type", type=click.Choice(['daily', 'weekly', 'monthly']),
              help="Filter by review type")
@click.option("--limit", "-l", default=10, help="Number of reviews to show")
@click.pass_context
def history(ctx, review_type, limit):
    """View past reviews

    Examples:
      task review history
      task review history --type weekly
      task review history --limit 20
    """
    client = ctx.obj['client']

    try:
        params = {"limit": limit}
        if review_type:
            params['review_type'] = review_type

        reviews = client.get("/reviews", params=params)

        if not reviews:
            console.print("[yellow]No reviews found.[/yellow]")
            return

        table = Table(title="Review History")
        table.add_column("Date", style="cyan")
        table.add_column("Type", style="magenta")
        table.add_column("Period", style="dim")
        table.add_column("Tasks Done", justify="right")
        table.add_column("Score", justify="right")

        for r in reviews:
            content = r.get('content', {})
            tasks = content.get('tasks_completed', {})
            completed = tasks.get('completed_count', 0)
            score = content.get('productivity_score', 0)

            score_str = f"{score:.0f}%"
            if score >= 75:
                score_str = f"[green]{score_str}[/green]"
            elif score >= 50:
                score_str = f"[yellow]{score_str}[/yellow]"
            else:
                score_str = f"[red]{score_str}[/red]"

            table.add_row(
                r['date'],
                r['review_type'],
                f"{r['period_start']} to {r['period_end']}",
                str(completed),
                score_str
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


def _display_review(review, review_type):
    """Display a review in a nice format"""
    content = review.get('content', {})

    # Header
    console.print(f"\n[bold cyan]{review_type} Review[/bold cyan]")
    console.print(f"[dim]Period: {review['period_start']} to {review['period_end']}[/dim]\n")

    # Productivity Score
    score = content.get('productivity_score', 0)
    score_color = "green" if score >= 75 else ("yellow" if score >= 50 else "red")
    console.print(f"[bold]Productivity Score:[/bold] [{score_color}]{score:.0f}%[/{score_color}]")

    # Task Summary
    tasks = content.get('tasks_completed', {})
    console.print(f"\n[bold magenta]Tasks[/bold magenta]")
    console.print(f"  Completed: [green]{tasks.get('completed_count', 0)}[/green]")
    console.print(f"  Time spent: {tasks.get('total_time_spent', 0)} minutes")

    if tasks.get('completed_tasks'):
        console.print("\n  [dim]Completed tasks:[/dim]")
        for task in tasks['completed_tasks'][:5]:
            console.print(f"    [green][/green] {task['title']}")
        if len(tasks.get('completed_tasks', [])) > 5:
            console.print(f"    [dim]... and {len(tasks['completed_tasks']) - 5} more[/dim]")

    # Stale Tasks
    if tasks.get('stale_tasks'):
        console.print(f"\n  [yellow]Stale tasks ({tasks.get('stale_count', 0)} tasks with no activity in 7+ days):[/yellow]")
        for task in tasks['stale_tasks'][:3]:
            console.print(f"    [yellow][/yellow] {task['title']}")
        if len(tasks.get('stale_tasks', [])) > 3:
            console.print(f"    [dim]... and {len(tasks['stale_tasks']) - 3} more[/dim]")

    # Upcoming Deadlines
    if tasks.get('upcoming_deadlines'):
        console.print(f"\n  [red]Upcoming deadlines:[/red]")
        for task in tasks['upcoming_deadlines'][:5]:
            days = task.get('days_until', 0)
            urgency = "red" if days <= 1 else ("yellow" if days <= 3 else "dim")
            console.print(f"    [{urgency}][/{urgency}] {task['title']} ({days} days)")

    # Goal Progress
    goals = content.get('goals_progress', [])
    if goals:
        console.print(f"\n[bold magenta]Goals Progress[/bold magenta]")
        for goal in goals[:5]:
            progress = goal.get('progress', 0)
            progress_color = "green" if progress >= 75 else ("yellow" if progress >= 50 else "red")
            console.print(f"  [{progress_color}]{progress:.0f}%[/{progress_color}] {goal['title']}")

    # Habit Summary
    habits = content.get('habits_summary', [])
    if habits:
        console.print(f"\n[bold magenta]Habits[/bold magenta]")
        for habit in habits[:5]:
            rate = habit.get('completion_rate', 0)
            rate_color = "green" if rate >= 75 else ("yellow" if rate >= 50 else "red")
            console.print(f"  {habit['title']}: [{rate_color}]{rate:.0f}%[/{rate_color}] ({habit.get('completed_count', 0)}/{habit.get('scheduled_count', 0)})")

    # Lists with pending items
    lists = content.get('lists_summary', [])
    if lists:
        console.print(f"\n[bold magenta]Lists with Pending Items[/bold magenta]")
        for lst in lists[:5]:
            console.print(f"  {lst['name']}: {lst.get('pending_count', 0)} pending")

    # Highlights
    highlights = content.get('highlights', [])
    if highlights:
        console.print(f"\n[bold green]Highlights[/bold green]")
        for h in highlights:
            console.print(f"  [green][/green] {h}")

    # Areas for Improvement
    improvements = content.get('areas_for_improvement', [])
    if improvements:
        console.print(f"\n[bold yellow]Areas for Improvement[/bold yellow]")
        for i in improvements:
            console.print(f"  [yellow][/yellow] {i}")

    # User notes
    if review.get('notes'):
        console.print(f"\n[bold]Notes:[/bold]")
        console.print(f"  {review['notes']}")

    console.print()
