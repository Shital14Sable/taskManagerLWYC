import click
from rich.console import Console

console = Console()

@click.group()
def inbox():
    """Manage inbox"""
    pass

@inbox.command()
def list():
    """List inbox items"""
    console.print("Inbox feature coming soon!", style="yellow")
