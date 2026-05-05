"""Main entry point for taskman package"""
import sys
from taskman.client.cli import cli

if __name__ == '__main__':
    sys.exit(cli())
