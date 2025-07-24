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

# Install python3-venv (no-op if already installed)
apt update && apt install -y python3-venv

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
npm install
cd ..

# Generate repository data for visualization
echo "Generating repository data..."
$PYTHON_CMD -m repo_visualizer . -o repo_data.json -v

# Copy data to frontend
echo "Copying data to frontend..."
cp repo_data.json frontend/

# Print completion message
echo "Setup complete!"
echo "Virtual environment activated. You can deactivate it with: deactivate"
echo ""
echo "Repository data generated and ready for visualization!"
echo ""
echo "To start the project, run:"
echo "  ./start_project.sh"
