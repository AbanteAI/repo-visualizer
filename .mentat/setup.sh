#!/bin/bash
set -e

# Install Python 3.12 and required packages
echo "Installing Python 3.12 and required packages..."
apt-get update
apt-get install -y software-properties-common
add-apt-repository -y ppa:deadsnakes/ppa
apt-get update
apt-get install -y python3.12 python3.12-venv python3.12-dev python3.12-distutils
apt-get install -y python3-pip

# Create symlinks for python3.12
if [ ! -f /usr/bin/python3 ] || [ "$(python3 --version)" != "Python 3.12"* ]; then
    ln -sf /usr/bin/python3.12 /usr/bin/python3
fi

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
