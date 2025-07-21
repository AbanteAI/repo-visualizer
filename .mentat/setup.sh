#!/bin/bash
set -e

# Determine Python command to use (python3 or python)
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    PIP_CMD="pip"
else
    echo "Error: Neither python3 nor python was found"
    exit 1
fi

echo "Using Python command: $PYTHON_CMD"

# Install python3-venv (no-op if already installed, only on apt-based systems with root access)
if command -v apt >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    apt update && apt install -y python3-venv || true
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv .venv
    if [ ! -d ".venv" ]; then
        echo "Error: Failed to create virtual environment"
        echo "Please ensure python3-venv is installed:"
        echo "  Ubuntu/Debian: sudo apt install python3-venv"
        echo "  macOS: Virtual environment support should be built-in"
        exit 1
    fi
fi

# Activate virtual environment
echo "Activating virtual environment..."
if [ ! -f ".venv/bin/activate" ]; then
    echo "Error: Virtual environment activation script not found"
    echo "Removing corrupted .venv directory and trying again..."
    rm -rf .venv
    $PYTHON_CMD -m venv .venv
    if [ ! -f ".venv/bin/activate" ]; then
        echo "Error: Still unable to create working virtual environment"
        exit 1
    fi
fi
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
