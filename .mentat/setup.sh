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

# Check if python3-venv is available and install if needed (Ubuntu/Debian systems)
if ! $PYTHON_CMD -m venv --help > /dev/null 2>&1; then
    echo "python3-venv not available, attempting to install..."
    if command -v apt &> /dev/null; then
        echo "Installing python3-venv using apt..."
        apt update
        if [[ $PYTHON_CMD == "python3" ]]; then
            # Get Python version for specific venv package
            PYTHON_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
            apt install -y "python${PYTHON_VERSION}-venv"
        else
            apt install -y python3-venv
        fi
    else
        echo "Error: Cannot install python3-venv - apt package manager not found"
        echo "Please install python3-venv manually for your system"
        exit 1
    fi
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv .venv
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
