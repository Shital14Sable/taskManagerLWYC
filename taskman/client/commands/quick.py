import click
from rich.console import Console
import json
from pathlib import Path
import uuid

console = Console()

@click.command()
@click.argument('text')
@click.option('--project', 'project_id', help='Optional project ID')
@click.pass_context
def quick(ctx, text, project_id):
    """Quick capture to inbox"""
    inbox_file = Path("./data/inbox.json")
    inbox_file.parent.mkdir(parents=True, exist_ok=True)
    
    if inbox_file.exists():
        with open(inbox_file, 'r') as f:
            data = json.load(f)
    else:
        data = {"inbox": []}
    
    item = {
        "id": str(uuid.uuid4())[:8],
        "text": text,
        "captured_at": "2025-10-17T12:00:00Z",
        "project_id": project_id
    }
    data["inbox"].append(item)
    
    with open(inbox_file, 'w') as f:
        json.dump(data, f, indent=2)
    
    console.print(f"✅ Captured to inbox: {text}", style="green")
