#!/usr/bin/env bash
#
# TaskMan Setup Script
# ====================
# Comprehensive setup for Mac and Linux with automatic GitHub repo creation
# and multi-device sync support.
#
# Usage:
#   ./setup.sh [OPTIONS]
#
# Options:
#   --data-repo NAME    Name for your private data repo (default: taskman-data)
#   --skip-sync         Skip git sync setup (local-only mode)
#   --help              Show this help message
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DATA_REPO_NAME="taskman-data"
SKIP_SYNC=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(dirname "$SCRIPT_DIR")/taskman-data"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --data-repo)
            DATA_REPO_NAME="$2"
            shift 2
            ;;
        --skip-sync)
            SKIP_SYNC=true
            shift
            ;;
        --help)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       TaskMan Setup Script                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
    echo -e "${GREEN}✓${NC} Detected: macOS"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    echo -e "${GREEN}✓${NC} Detected: Linux"
else
    echo -e "${YELLOW}⚠${NC} Unknown OS: $OSTYPE (proceeding anyway)"
fi

# Detect shell
SHELL_NAME=$(basename "$SHELL")
SHELL_RC=""
if [[ "$SHELL_NAME" == "zsh" ]]; then
    SHELL_RC="$HOME/.zshrc"
    echo -e "${GREEN}✓${NC} Detected shell: zsh"
elif [[ "$SHELL_NAME" == "bash" ]]; then
    if [[ "$OS" == "mac" ]]; then
        SHELL_RC="$HOME/.bash_profile"
    else
        SHELL_RC="$HOME/.bashrc"
    fi
    echo -e "${GREEN}✓${NC} Detected shell: bash"
else
    echo -e "${YELLOW}⚠${NC} Unknown shell: $SHELL_NAME (defaulting to .bashrc)"
    SHELL_RC="$HOME/.bashrc"
fi

echo -e "${GREEN}✓${NC} Data directory: $DATA_DIR"
echo ""

# =============================================================================
# Step 1: Check Python
# =============================================================================
echo -e "${BLUE}[1/6]${NC} Checking Python..."

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1 | cut -d' ' -f2)
    PYTHON_MAJOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f1)
    PYTHON_MINOR=$(echo "$PYTHON_VERSION" | cut -d'.' -f2)

    if [[ "$PYTHON_MAJOR" -ge 3 && "$PYTHON_MINOR" -ge 11 ]]; then
        echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION found"
    else
        echo -e "${RED}✗${NC} Python 3.11+ required (found $PYTHON_VERSION)"
        echo "  Please install Python 3.11+ using conda:"
        echo "    conda create -n taskman python=3.11"
        echo "    conda activate taskman"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} Python not found"
    echo "  Please install Python 3.11+ using conda:"
    echo "    conda create -n taskman python=3.11"
    echo "    conda activate taskman"
    exit 1
fi

# =============================================================================
# Step 2: Check Node.js (optional, for web UI)
# =============================================================================
echo -e "${BLUE}[2/6]${NC} Checking Node.js..."

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | sed 's/v//')
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION found"
    HAS_NODE=true
else
    echo -e "${YELLOW}⚠${NC} Node.js not found (web UI will not be built)"
    echo "  Install Node.js 18+ for web UI support"
    HAS_NODE=false
fi

# =============================================================================
# Step 3: Install Python package
# =============================================================================
echo -e "${BLUE}[3/6]${NC} Installing TaskMan Python package..."

cd "$SCRIPT_DIR"

# Create a venv if not already inside one (conda or venv)
if [[ -z "$VIRTUAL_ENV" && -z "$CONDA_DEFAULT_ENV" ]]; then
    if [[ ! -d ".venv" ]]; then
        echo "  Creating virtual environment at .venv..."
        python3 -m venv .venv
    fi
    source .venv/bin/activate
    echo -e "${GREEN}✓${NC} Virtual environment activated (.venv)"
fi

pip install -e . --quiet
echo -e "${GREEN}✓${NC} TaskMan installed"

# =============================================================================
# Step 4: Build Web UI (if Node.js available)
# =============================================================================
echo -e "${BLUE}[4/6]${NC} Building Web UI..."

if [[ "$HAS_NODE" == true && -d "$SCRIPT_DIR/packages/web" ]]; then
    cd "$SCRIPT_DIR"
    # Use pnpm if available (monorepo uses pnpm workspaces), otherwise fall back to npm
    if command -v pnpm &> /dev/null; then
        PKG_MGR="pnpm"
    else
        PKG_MGR="npm"
    fi
    if [[ ! -d "node_modules" ]]; then
        echo "  Installing dependencies..."
        $PKG_MGR install --silent 2>/dev/null || $PKG_MGR install
    fi
    echo "  Building..."
    $PKG_MGR run build > /dev/null 2>&1 || $PKG_MGR run build
    echo -e "${GREEN}✓${NC} Web UI built"
else
    echo -e "${YELLOW}⚠${NC} Skipping Web UI build"
fi

# =============================================================================
# Step 5: Setup Data Directory with Git Sync
# =============================================================================
echo -e "${BLUE}[5/6]${NC} Setting up data directory..."

if [[ "$SKIP_SYNC" == true ]]; then
    echo -e "${YELLOW}⚠${NC} Skipping git sync setup (--skip-sync specified)"
    mkdir -p "$DATA_DIR"
    echo -e "${GREEN}✓${NC} Data directory created (local only, no sync)"
else
    # Check for GitHub CLI
    if ! command -v gh &> /dev/null; then
        echo -e "${YELLOW}⚠${NC} GitHub CLI (gh) not found"
        echo ""
        echo "  To enable multi-device sync, install GitHub CLI:"
        if [[ "$OS" == "mac" ]]; then
            echo "    brew install gh"
        else
            echo "    See: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
        fi
        echo ""
        echo "  Then run this script again, or continue without sync:"
        read -p "  Continue without git sync? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            SKIP_SYNC=true
            mkdir -p "$DATA_DIR"
            echo -e "${GREEN}✓${NC} Data directory created (local only)"
        else
            exit 1
        fi
    fi

    if [[ "$SKIP_SYNC" == false ]]; then
        # Check gh auth status
        if ! gh auth status &> /dev/null; then
            echo -e "${YELLOW}!${NC} GitHub CLI not authenticated"
            echo "  Running: gh auth login"
            gh auth login
        fi

        # Get GitHub username
        GH_USER=$(gh api user --jq '.login' 2>/dev/null || echo "")
        if [[ -z "$GH_USER" ]]; then
            echo -e "${RED}✗${NC} Could not get GitHub username"
            exit 1
        fi
        echo -e "${GREEN}✓${NC} GitHub user: $GH_USER"

        # Check if repo exists on GitHub
        echo "  Checking for existing data repo: $GH_USER/$DATA_REPO_NAME..."
        REPO_EXISTS=false
        if gh repo view "$GH_USER/$DATA_REPO_NAME" &> /dev/null; then
            REPO_EXISTS=true
            echo -e "${GREEN}✓${NC} Found existing repo: $GH_USER/$DATA_REPO_NAME"
        else
            echo -e "${YELLOW}!${NC} Repo $GH_USER/$DATA_REPO_NAME does not exist on GitHub"
        fi

        if [[ -d "$DATA_DIR" && -d "$DATA_DIR/.git" ]]; then
            # Data directory already exists with git - pull latest
            echo -e "${GREEN}✓${NC} Data directory already configured with git"
            echo "  Pulling latest changes..."
            cd "$DATA_DIR"
            git pull origin main --rebase 2>/dev/null || git pull origin master --rebase 2>/dev/null || echo -e "${YELLOW}!${NC} Could not pull (may be up to date or no remote)"
            cd "$SCRIPT_DIR"
        elif [[ "$REPO_EXISTS" == true ]]; then
            # Repo exists on GitHub - clone it (this is an additional machine)
            echo -e "${BLUE}→${NC} Syncing data from existing repo (multi-device setup)..."
            if [[ -d "$DATA_DIR" ]]; then
                # Backup any existing local data
                mv "$DATA_DIR" "${DATA_DIR}.backup.$(date +%s)"
                echo -e "${YELLOW}!${NC} Existing local data backed up"
            fi

            # Clone the existing repo with all its data
            if gh repo clone "$GH_USER/$DATA_REPO_NAME" "$DATA_DIR"; then
                echo -e "${GREEN}✓${NC} Data repo cloned successfully"
                echo -e "${GREEN}✓${NC} Your data from other devices is now available!"
            else
                echo -e "${RED}✗${NC} Failed to clone repo. Trying alternative method..."
                git clone "https://github.com/$GH_USER/$DATA_REPO_NAME.git" "$DATA_DIR" || {
                    echo -e "${RED}✗${NC} Could not clone data repo"
                    exit 1
                }
                echo -e "${GREEN}✓${NC} Data repo cloned via HTTPS"
            fi
        else
            # Repo doesn't exist - create new repo (first machine setup)
            echo -e "${BLUE}→${NC} First-time setup: Creating new private data repo..."

            # Create repo on GitHub
            if ! gh repo create "$DATA_REPO_NAME" --private --description "TaskMan data (private)" -y 2>/dev/null; then
                # Repo might already exist (race condition) - try to clone instead
                echo -e "${YELLOW}!${NC} Could not create repo (may already exist). Attempting to clone..."
                if gh repo clone "$GH_USER/$DATA_REPO_NAME" "$DATA_DIR" 2>/dev/null; then
                    echo -e "${GREEN}✓${NC} Found and cloned existing repo"
                    cd "$SCRIPT_DIR"
                else
                    echo -e "${RED}✗${NC} Failed to create or clone data repo"
                    exit 1
                fi
            else
                # Successfully created new repo - initialize it
                mkdir -p "$DATA_DIR"
                cd "$DATA_DIR"
                git init --quiet

                # Create initial commit
                echo "# TaskMan Data" > README.md
                echo "" >> README.md
                echo "Private data repository for TaskMan." >> README.md
                echo "Do not share or make public." >> README.md
                git add README.md
                git commit -m "Initial commit" --quiet

                # Set remote and push
                git remote add origin "git@github.com:$GH_USER/$DATA_REPO_NAME.git"
                git branch -M main
                git push -u origin main --quiet 2>/dev/null || {
                    # Try HTTPS if SSH fails
                    git remote set-url origin "https://github.com/$GH_USER/$DATA_REPO_NAME.git"
                    git push -u origin main
                }

                cd "$SCRIPT_DIR"
                echo -e "${GREEN}✓${NC} Data repo created and initialized"
            fi
        fi
    fi
fi

# =============================================================================
# Step 6: Configure Data Directory
# =============================================================================
echo -e "${BLUE}[6/6]${NC} Configuring data directory..."

# Write config file (primary method - works immediately)
CONFIG_DIR="$HOME/.config/taskman"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"
echo "{\"data_dir\": \"$DATA_DIR\"}" > "$CONFIG_FILE"
echo -e "${GREEN}✓${NC} Config saved to $CONFIG_FILE"

# Also add to shell config (backup method)
ENV_LINE="export TASKMAN_DATA_DIR=\"$DATA_DIR\""
if ! grep -q "TASKMAN_DATA_DIR" "$SHELL_RC" 2>/dev/null; then
    echo "" >> "$SHELL_RC"
    echo "# TaskMan data directory" >> "$SHELL_RC"
    echo "$ENV_LINE" >> "$SHELL_RC"
fi

# Export for current session
export TASKMAN_DATA_DIR="$DATA_DIR"

# =============================================================================
# Done!
# =============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Setup Complete!                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════╝${NC}"
echo ""
echo "Data directory: $DATA_DIR"
echo ""
echo -e "${BLUE}To start TaskMan:${NC}"
echo ""
if [[ -d "$SCRIPT_DIR/.venv" ]]; then
    echo "  1. Activate venv: source $SCRIPT_DIR/.venv/bin/activate"
    echo "  2. Run: task-server"
else
    echo "  1. Run: task-server"
fi
echo "  $([ -d "$SCRIPT_DIR/.venv" ] && echo 3 || echo 2). Open http://localhost:3000 in your browser"
echo ""
if [[ "$SKIP_SYNC" == false && -d "$DATA_DIR/.git" ]]; then
    echo -e "${BLUE}Git sync:${NC} Enabled (auto-syncs every 2 minutes)"
    echo ""
fi
echo -e "${BLUE}On additional machines:${NC}"
echo ""
echo "  1. Clone this repo: git clone https://github.com/RajeshDM/task_manager.git"
echo "  2. Run: cd task_manager && ./setup.sh"
echo "     (Your data repo will be automatically detected and cloned)"
echo ""
