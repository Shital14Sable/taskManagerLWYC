import click

@click.command()
@click.pass_context
def ui(ctx):
    """Launch interactive TUI (coming soon)"""
    click.echo("TUI feature is under development.")
    click.echo("For now, use CLI commands:")
    click.echo("  task project list")
    click.echo("  task list")
    click.echo("  task schedule today")
