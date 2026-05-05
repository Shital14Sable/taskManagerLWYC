import click

@click.group()
def backup():
    """Backup commands (coming soon)"""
    pass

@backup.command()
def list():
    """List backups"""
    click.echo("Backup feature coming soon!")
