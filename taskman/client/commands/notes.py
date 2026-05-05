"""
Notes CLI commands for managing hierarchical markdown notes.
"""
import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel
from rich.markdown import Markdown
from datetime import date

console = Console()


@click.group()
def notes():
    """Manage notes (hierarchical markdown)"""
    pass


@notes.command("list")
@click.option("--folder", "-f", default=None, help="Filter by folder path")
@click.option("--daily", is_flag=True, help="Show only daily notes")
@click.pass_context
def notes_list(ctx, folder, daily):
    """List all notes

    Examples:
      task notes list
      task notes list --folder Work/Ideas
      task notes list --daily
    """
    client = ctx.obj['client']

    try:
        params = {}
        if folder:
            params['folder'] = folder
        if daily:
            params['is_daily_note'] = True

        notes = client.get("/notes", params=params)

        if not notes:
            console.print("[yellow]No notes found.[/yellow]")
            return

        table = Table(title="Notes")
        table.add_column("ID", style="cyan")
        table.add_column("Title", style="bold")
        table.add_column("Folder", style="magenta")
        table.add_column("Tags", style="green")
        table.add_column("Updated")

        for note in notes:
            tags_str = ", ".join(note.get('tags', [])[:3])
            if len(note.get('tags', [])) > 3:
                tags_str += "..."

            updated = note.get('updated_at', '')[:10]

            table.add_row(
                note['id'],
                note['title'][:40],
                note.get('folder_path', '') or "(root)",
                tags_str,
                updated
            )

        console.print(table)
        console.print(f"\n[dim]Total: {len(notes)} notes[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("add")
@click.argument("title")
@click.option("--folder", "-f", default="", help="Folder path (e.g., 'Work/Ideas')")
@click.option("--content", "-c", default="", help="Initial content")
@click.option("--link-project", "-p", multiple=True, help="Link to project IDs")
@click.option("--link-task", "-t", multiple=True, help="Link to task IDs")
@click.option("--link-goal", "-g", multiple=True, help="Link to goal IDs")
@click.option("--tag", multiple=True, help="Add tags")
@click.pass_context
def notes_add(ctx, title, folder, content, link_project, link_task, link_goal, tag):
    """Create a new note

    Examples:
      task notes add "Meeting Notes"
      task notes add "Project Ideas" --folder Work/Ideas
      task notes add "Sprint Planning" --link-project abc123
    """
    client = ctx.obj['client']

    try:
        data = {
            "title": title,
            "content": content or f"# {title}\n\n",
            "folder_path": folder,
            "linked_project_ids": list(link_project),
            "linked_task_ids": list(link_task),
            "linked_goal_ids": list(link_goal),
            "tags": list(tag)
        }

        result = client.post("/notes", data)

        console.print(f"[green]Created note: {result['title']}[/green]")
        console.print(f"[dim]ID: {result['id']}[/dim]")
        if folder:
            console.print(f"[dim]Folder: {folder}[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("view")
@click.argument("note_id")
@click.pass_context
def notes_view(ctx, note_id):
    """View a note's content

    Example:
      task notes view abc123
    """
    client = ctx.obj['client']

    try:
        note = client.get(f"/notes/{note_id}")

        # Display metadata
        console.print(f"\n[bold cyan]{note['title']}[/bold cyan]")
        console.print(f"[dim]ID: {note['id']} | Folder: {note.get('folder_path', '(root)')}[/dim]")

        if note.get('tags'):
            console.print(f"[dim]Tags: {', '.join(note['tags'])}[/dim]")

        if note.get('linked_project_ids'):
            console.print(f"[dim]Linked Projects: {', '.join(note['linked_project_ids'])}[/dim]")

        console.print()

        # Display content as markdown
        md = Markdown(note['content'])
        console.print(Panel(md, border_style="blue"))

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("edit")
@click.argument("note_id")
@click.option("--title", help="New title")
@click.option("--folder", help="Move to new folder")
@click.option("--content", help="New content (replaces existing)")
@click.option("--append", "-a", help="Append to content")
@click.option("--tag", multiple=True, help="Set tags (replaces existing)")
@click.pass_context
def notes_edit(ctx, note_id, title, folder, content, append, tag):
    """Edit a note

    Examples:
      task notes edit abc123 --title "New Title"
      task notes edit abc123 --folder Work/Archive
      task notes edit abc123 --append "\\n\\n## New Section\\n"
    """
    client = ctx.obj['client']

    try:
        # Get current note if appending
        if append:
            current = client.get(f"/notes/{note_id}")
            content = current['content'] + append

        update_data = {}
        if title:
            update_data['title'] = title
        if folder is not None:
            update_data['folder_path'] = folder
        if content:
            update_data['content'] = content
        if tag:
            update_data['tags'] = list(tag)

        if not update_data:
            console.print("[yellow]No changes specified.[/yellow]")
            return

        result = client.put(f"/notes/{note_id}", update_data)

        console.print(f"[green]Updated note: {result['title']}[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("delete")
@click.argument("note_id")
@click.option("--yes", "-y", is_flag=True, help="Skip confirmation")
@click.pass_context
def notes_delete(ctx, note_id, yes):
    """Delete a note

    Example:
      task notes delete abc123
    """
    client = ctx.obj['client']

    try:
        if not yes:
            note = client.get(f"/notes/{note_id}")
            if not click.confirm(f"Delete note '{note['title']}'?"):
                return

        client.delete(f"/notes/{note_id}")
        console.print(f"[green]Deleted note {note_id}[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("daily")
@click.option("--date", "-d", "date_str", default=None, help="Date (YYYY-MM-DD), default: today")
@click.pass_context
def notes_daily(ctx, date_str):
    """Open/create today's daily note

    Examples:
      task notes daily
      task notes daily --date 2024-01-15
    """
    client = ctx.obj['client']

    try:
        params = {}
        if date_str:
            params['date_str'] = date_str

        note = client.get("/notes/daily", params=params)

        console.print(f"[bold cyan]{note['title']}[/bold cyan]")
        console.print(f"[dim]ID: {note['id']}[/dim]\n")

        # Display content
        md = Markdown(note['content'])
        console.print(Panel(md, border_style="blue"))

        if note.get('linked_task_ids'):
            console.print(f"\n[dim]Linked tasks: {len(note['linked_task_ids'])} tasks completed[/dim]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("search")
@click.argument("query")
@click.pass_context
def notes_search(ctx, query):
    """Search notes by title and content

    Example:
      task notes search "meeting"
    """
    client = ctx.obj['client']

    try:
        results = client.get("/notes/search", params={"query": query})

        if not results:
            console.print(f"[yellow]No notes found matching '{query}'[/yellow]")
            return

        console.print(f"[bold]Found {len(results)} notes matching '{query}'[/bold]\n")

        for note in results:
            console.print(f"[cyan]{note['id']}[/cyan] - [bold]{note['title']}[/bold]")
            console.print(f"  [dim]Folder: {note.get('folder_path', '(root)')}[/dim]")

            # Show snippet of content
            content = note.get('content', '')
            if query.lower() in content.lower():
                idx = content.lower().find(query.lower())
                start = max(0, idx - 50)
                end = min(len(content), idx + len(query) + 50)
                snippet = content[start:end]
                if start > 0:
                    snippet = "..." + snippet
                if end < len(content):
                    snippet = snippet + "..."
                console.print(f"  [dim]{snippet}[/dim]")
            console.print()
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("folders")
@click.pass_context
def notes_folders(ctx):
    """Show folder structure

    Example:
      task notes folders
    """
    client = ctx.obj['client']

    try:
        folders = client.get("/notes/folders/tree")

        if not folders:
            console.print("[yellow]No folders found.[/yellow]")
            return

        def build_tree(folder, tree_node):
            for subfolder in folder.get('subfolders', []):
                branch = tree_node.add(f"[cyan]{subfolder['name']}[/cyan] ({subfolder['note_count']} notes)")
                build_tree(subfolder, branch)

        tree = Tree("[bold]Notes[/bold]")
        root_folder = folders[0]
        tree.add(f"[dim](root)[/dim] ({root_folder['note_count']} notes)")
        build_tree(root_folder, tree)

        console.print(tree)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("mkdir")
@click.argument("folder_path")
@click.pass_context
def notes_mkdir(ctx, folder_path):
    """Create a new folder

    Example:
      task notes mkdir Work/Projects
    """
    client = ctx.obj['client']

    try:
        client.post("/notes/folders/create", params={"folder_path": folder_path})
        console.print(f"[green]Created folder: {folder_path}[/green]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")


@notes.command("link")
@click.argument("note_id")
@click.option("--project", "-p", help="Link to project ID")
@click.option("--task", "-t", help="Link to task ID")
@click.option("--goal", "-g", help="Link to goal ID")
@click.pass_context
def notes_link(ctx, note_id, project, task, goal):
    """Link a note to other entities

    Examples:
      task notes link abc123 --project proj456
      task notes link abc123 --goal goal789
    """
    client = ctx.obj['client']

    try:
        if project:
            client.post(f"/notes/{note_id}/link-project/{project}")
            console.print(f"[green]Linked note to project {project}[/green]")

        if task:
            client.post(f"/notes/{note_id}/link-task/{task}")
            console.print(f"[green]Linked note to task {task}[/green]")

        if goal:
            client.post(f"/notes/{note_id}/link-goal/{goal}")
            console.print(f"[green]Linked note to goal {goal}[/green]")

        if not any([project, task, goal]):
            console.print("[yellow]No link specified. Use --project, --task, or --goal[/yellow]")
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
