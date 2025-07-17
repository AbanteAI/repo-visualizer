#!/bin/bash
set -euo pipefail

# Set non-interactive frontend for APT
export DEBIAN_FRONTEND=noninteractive

# Install Python 3.12 and required packages if not available
echo "Checking for Python 3.12..."
if command -v python3.12 &> /dev/null; then
    echo "Python 3.12 found"
    PYTHON_CMD="python3.12"
else
    echo "Installing Python 3.12..."
    apt-get update
    apt-get install -y --no-install-recommends python3.12 python3.12-venv python3.12-dev
    PYTHON_CMD="python3.12"
fi

# Also install pip for system (needed for venv pip setup)
apt-get install -y --no-install-recommends python3-pip

echo "Using Python command: $PYTHON_CMD"

# Create or recreate virtual environment if activate script is missing
if [ ! -f ".venv/bin/activate" ]; then
    echo "Creating virtual environment..."
    rm -rf .venv
    "$PYTHON_CMD" -m venv .venv
    
    # Install pip in the venv (Ubuntu disables ensurepip)
    echo "Setting up pip in virtual environment..."
    .venv/bin/python -m pip install --upgrade pip setuptools wheel
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
