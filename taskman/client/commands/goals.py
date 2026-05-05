"""
Goals CLI commands for managing yearly, quarterly, and monthly goals.
"""
import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from rich.progress import Progress, BarColumn, TextColumn

console = Console()


@click.group()
def goals():
    """Manage goals (yearly, quarterly, monthly)"""
    pass


@goals.command("list")
@click.option("--horizon", "-h", type=click.Choice(['yearly', 'quarterly', 'monthly']),
              help="Filter by time horizon")
@click.option("--category", "-c", help="Filter by category")
@click.option("--status", "-s", type=click.Choice(['active', 'achieved', 'abandoned']),
              default='active', help="Filter by status")
@click.pass_context
def goals_list(ctx, horizon, category, status):
    """List all goals

    Examples:
      task goals list
      task goals list --horizon yearly
      task goals list --category career
    """
    client = ctx.obj['client']

    try:
        params = {}
        if horizon:
            params['time_horizon'] = horizon
        if category:
            params['category'] = category
        if status:
            params['status'] = status

        goals = client.get("/goals", params=params)

        if not goals:
            console.print("[yellow]No goals found.[/yellow]")
            return

        table = Table(title="Goals")
        table.add_column("ID", style="cyan")
        table.add_column("Title", style="bold")
        table.add_column("Horizon", style="magenta")
        table.add_column("Category", style="green")
        table.add_column("Progress", justify="right")
        table.add_column("Projects", justify="center")
        table.add_column("Status")

        for goal in goals:
            progress = goal.get('progress', 0)
            progress_str = f"{progress:.0f}%"

            # Color progress based on value
            if progress >= 75:
                progress_str = f"[green]{progress_str}[/green]"
            elif progress >= 50:
                progress_str = f"[yellow]{progress_str}[/yellow]"
            else:
                progress_str = f"[red]{progress_str}[/red]"

            status_str = goal.get('status', 'active')
            if status_str == 'achieved':
                status_str = f"[green]{status_str}[/green]"
            elif status_str == 'abandoned':
                status_str = f"[dim]{status_str}[/dim]"

            table.add_row(
                goal['id'],
                goal['title'][:40],
                goal.get('time_horizon', ''),
                goal.get('category', ''),
                progress_str,
                str(len(goal.get('linked_project_ids', []))),
                status_str
            )

        console.print(table)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("add")
@click.argument("title")
@click.option("--horizon", "-h", type=click.Choice(['yearly', 'quarterly', 'monthly']),
              default='yearly', help="Time horizon")
@click.option("--category", "-c", type=click.Choice(['career', 'health', 'personal', 'learning', 'financial', 'relationships', 'other']),
              default='other', help="Category")
@click.option("--description", "-d", help="Description")
@click.option("--target-date", "-t", help="Target date (YYYY-MM-DD)")
@click.option("--parent", "-p", help="Parent goal ID (for hierarchy)")
@click.pass_context
def goals_add(ctx, title, horizon, category, description, target_date, parent):
    """Create a new goal

    Examples:
      task goals add "Get promoted" --horizon yearly --category career
      task goals add "Complete certification" --horizon quarterly --category learning
      task goals add "Read 12 books" --horizon yearly --category personal
    """
    client = ctx.obj['client']

    try:
        data = {
            "title": title,
            "time_horizon": horizon,
            "category": category
        }

        if description:
            data['description'] = description
        if target_date:
            data['target_date'] = target_date
        if parent:
            data['parent_goal_id'] = parent

        result = client.post("/goals", data)

        console.print(f"[green]Created goal: {result['title']}[/green]")
        console.print(f"[dim]ID: {result['id']} | Horizon: {horizon} | Category: {category}[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("view")
@click.argument("goal_id")
@click.pass_context
def goals_view(ctx, goal_id):
    """View goal details and progress

    Example:
      task goals view abc123
    """
    client = ctx.obj['client']

    try:
        goal = client.get(f"/goals/{goal_id}")
        progress = client.get(f"/goals/{goal_id}/progress")

        # Display goal info
        console.print(f"\n[bold cyan]{goal['title']}[/bold cyan]")
        console.print(f"[dim]{goal.get('description', '')}[/dim]\n")

        # Goal metadata
        console.print(f"[bold]Time Horizon:[/bold] {goal['time_horizon']}")
        console.print(f"[bold]Category:[/bold] {goal['category']}")
        console.print(f"[bold]Status:[/bold] {goal['status']}")
        if goal.get('target_date'):
            console.print(f"[bold]Target Date:[/bold] {goal['target_date']}")
        console.print()

        # Progress bar
        overall_progress = progress.get('overall_progress', 0)
        console.print(f"[bold]Overall Progress:[/bold] {overall_progress}%")

        # Simple progress bar
        filled = int(overall_progress / 5)
        empty = 20 - filled
        progress_bar = "[green]" + "" * filled + "[/green][dim]" + "" * empty + "[/dim]"
        console.print(f"[{progress_bar}]\n")

        # Project breakdown
        if progress.get('projects'):
            console.print("[bold]Linked Projects:[/bold]")
            for proj in progress['projects']:
                proj_progress = proj.get('progress', 0)
                console.print(f"  {proj['project_name']}: {proj_progress}% ({proj['completed_tasks']}/{proj['total_tasks']} tasks)")
        else:
            console.print("[dim]No projects linked yet. Use 'task goals link' to link projects.[/dim]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("link")
@click.argument("goal_id")
@click.option("--project", "-p", required=True, help="Project ID to link")
@click.pass_context
def goals_link(ctx, goal_id, project):
    """Link a project to a goal

    Example:
      task goals link goal123 --project proj456
    """
    client = ctx.obj['client']

    try:
        result = client.post(f"/goals/{goal_id}/link-project/{project}")
        console.print(f"[green]Linked project {project} to goal '{result['title']}'[/green]")
        console.print(f"[dim]Current progress: {result['progress']:.1f}%[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("unlink")
@click.argument("goal_id")
@click.option("--project", "-p", required=True, help="Project ID to unlink")
@click.pass_context
def goals_unlink(ctx, goal_id, project):
    """Unlink a project from a goal

    Example:
      task goals unlink goal123 --project proj456
    """
    client = ctx.obj['client']

    try:
        result = client.delete(f"/goals/{goal_id}/unlink-project/{project}")
        console.print(f"[green]Unlinked project {project} from goal[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("progress")
@click.argument("goal_id")
@click.pass_context
def goals_progress(ctx, goal_id):
    """Show detailed progress for a goal

    Example:
      task goals progress abc123
    """
    client = ctx.obj['client']

    try:
        progress = client.get(f"/goals/{goal_id}/progress")

        console.print(f"\n[bold cyan]{progress['goal_title']}[/bold cyan]")
        console.print(f"[bold]Overall Progress:[/bold] {progress['overall_progress']}%")
        console.print(f"[bold]Tasks:[/bold] {progress['completed_tasks']}/{progress['total_tasks']} completed")
        console.print(f"[bold]Projects:[/bold] {progress['linked_projects']} linked\n")

        if progress.get('projects'):
            table = Table(title="Project Breakdown")
            table.add_column("Project", style="cyan")
            table.add_column("Tasks", justify="center")
            table.add_column("Progress", justify="right")

            for proj in progress['projects']:
                table.add_row(
                    proj['project_name'],
                    f"{proj['completed_tasks']}/{proj['total_tasks']}",
                    f"{proj['progress']:.1f}%"
                )

            console.print(table)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("edit")
@click.argument("goal_id")
@click.option("--title", help="New title")
@click.option("--description", "-d", help="New description")
@click.option("--category", "-c", type=click.Choice(['career', 'health', 'personal', 'learning', 'financial', 'relationships', 'other']),
              help="New category")
@click.option("--target-date", "-t", help="New target date")
@click.option("--status", "-s", type=click.Choice(['active', 'achieved', 'abandoned']),
              help="Update status")
@click.pass_context
def goals_edit(ctx, goal_id, title, description, category, target_date, status):
    """Edit a goal

    Examples:
      task goals edit abc123 --status achieved
      task goals edit abc123 --title "New Goal Title"
    """
    client = ctx.obj['client']

    try:
        update_data = {}
        if title:
            update_data['title'] = title
        if description:
            update_data['description'] = description
        if category:
            update_data['category'] = category
        if target_date:
            update_data['target_date'] = target_date
        if status:
            update_data['status'] = status

        if not update_data:
            console.print("[yellow]No changes specified.[/yellow]")
            return

        result = client.put(f"/goals/{goal_id}", update_data)
        console.print(f"[green]Updated goal: {result['title']}[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("delete")
@click.argument("goal_id")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation")
@click.pass_context
def goals_delete(ctx, goal_id, yes):
    """Delete a goal

    Example:
      task goals delete abc123
    """
    client = ctx.obj['client']

    try:
        if not yes:
            goal = client.get(f"/goals/{goal_id}")
            if not click.confirm(f"Delete goal '{goal['title']}'?"):
                return

        client.delete(f"/goals/{goal_id}")
        console.print(f"[green]Deleted goal {goal_id}[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@goals.command("tree")
@click.pass_context
def goals_tree(ctx):
    """Show goals in a hierarchical tree view

    Example:
      task goals tree
    """
    client = ctx.obj['client']

    try:
        goals = client.get("/goals")

        if not goals:
            console.print("[yellow]No goals found.[/yellow]")
            return

        # Build hierarchy
        goal_map = {g['id']: g for g in goals}
        root_goals = [g for g in goals if not g.get('parent_goal_id')]

        tree = Tree("[bold]Goals[/bold]")

        def add_goal_to_tree(goal, parent_node):
            progress = goal.get('progress', 0)
            status = goal.get('status', 'active')

            if status == 'achieved':
                style = "green"
                icon = ""
            elif status == 'abandoned':
                style = "dim"
                icon = ""
            else:
                style = "cyan"
                icon = ""

            label = f"[{style}]{icon} {goal['title']}[/{style}] [{goal['time_horizon'][:1].upper()}] {progress:.0f}%"
            node = parent_node.add(label)

            # Add child goals
            children = [g for g in goals if g.get('parent_goal_id') == goal['id']]
            for child in children:
                add_goal_to_tree(child, node)

        # Group by time horizon
        for horizon in ['yearly', 'quarterly', 'monthly']:
            horizon_goals = [g for g in root_goals if g['time_horizon'] == horizon]
            if horizon_goals:
                horizon_branch = tree.add(f"[bold magenta]{horizon.capitalize()} Goals[/bold magenta]")
                for goal in horizon_goals:
                    add_goal_to_tree(goal, horizon_branch)

        console.print(tree)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
