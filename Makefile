.PHONY: install server demo test clean help

help:
	@echo "TaskMan - Smart Task Manager"
	@echo ""
	@echo "Available commands:"
	@echo "  make install    - Install dependencies"
	@echo "  make server     - Start the server"
	@echo "  make demo       - Create demo data"
	@echo "  make test       - Run tests"
	@echo "  make clean      - Clean data and cache"
	@echo "  make help       - Show this help"

install:
	pip install -e .
	@echo "✅ Installation complete!"
	@echo "Run 'make server' to start the server"

server:
	@echo "🚀 Starting TaskMan server..."
	python -m taskman.server.main

demo:
	@echo "🎬 Creating demo data..."
	python taskman/scripts/demo_data.py

test:
	pytest tests/ -v

clean:
	@echo "🧹 Cleaning up..."
	rm -rf data/
	rm -rf __pycache__
	rm -rf taskman/__pycache__
	rm -rf taskman/*/__pycache__
	rm -rf taskman/*/*/__pycache__
	rm -rf .pytest_cache
	rm -rf *.egg-info
	@echo "✅ Cleanup complete!"