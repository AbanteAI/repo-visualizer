#!/bin/bash
set -euo pipefail

# Set non-interactive frontend for APT
export DEBIAN_FRONTEND=noninteractive

# Install Python 3.12 and required packages
echo "Installing Python 3.12 and required packages..."
apt-get update
apt-get install -y software-properties-common
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update
apt-get install -y python3.12 python3.12-venv python3.12-dev

# Use Python 3.12 directly instead of system python3
PYTHON_CMD="python3.12"

echo "Using Python command: $PYTHON_CMD"

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv .venv
    echo "Virtual environment created. Checking contents..."
    ls -la .venv/
    if [ -f ".venv/bin/activate" ]; then
        echo "✓ activate script found"
    else
        echo "✗ activate script missing"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Install package with dev dependencies
echo "Installing package with dev dependencies..."
pip install -e ".[dev]"

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# Print completion message
echo "Setup complete!"
echo "Virtual environment activated. You can deactivate it with: deactivate"
echo ""
echo "To start the project, run:"
echo "  ./start_project.sh"
