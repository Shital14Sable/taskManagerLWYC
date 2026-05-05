#!/bin/bash

echo "🚀 TaskMan Quick Start"
echo "====================="
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
REQUIRED_VERSION="3.11"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python 3.11 or higher is required. Current version: $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python $PYTHON_VERSION detected"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
else
    echo "✅ Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
pip install -e . > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Start server in background
echo ""
echo "🚀 Starting TaskMan server..."
nohup python -m taskman.server.main > server.log 2>&1 &
SERVER_PID=$!
echo "✅ Server started (PID: $SERVER_PID)"

# Wait for server to be ready
echo ""
echo "⏳ Waiting for server to be ready..."
sleep 3

# Check if server is running
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
else
    echo "⚠️  Server may still be starting up. Check server.log for details."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ TaskMan is ready!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📚 Quick start commands:"
echo "  task project add \"My Project\" --priority 1"
echo "  task add <project-id> \"My Task\" --time 60"
echo "  task schedule generate"
echo "  task schedule today"
echo ""
echo "📖 Full documentation: README.md"
echo "🌐 API docs: http://localhost:3000/docs"
echo "📋 Server log: server.log"
echo ""
echo "To stop the server: kill $SERVER_PID"
echo ""