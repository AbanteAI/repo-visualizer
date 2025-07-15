#!/bin/bash
set -euo pipefail

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Repo Visualizer..."

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

# Ensure the package is installed
echo "Ensuring package is installed..."
if ! $PIP_CMD install -e . > /dev/null 2>&1; then
    echo "Warning: Failed to install package. Trying with --user flag..."
    if ! $PIP_CMD install --user -e . > /dev/null 2>&1; then
        echo "Error: Failed to install package. Please run '.mentat/setup.sh' first."
        exit 1
    fi
fi

# Generate repository data
echo "Generating repository data..."
$PYTHON_CMD -m repo_visualizer . -o repo_data.json -v

# Copy data to frontend
echo "Copying data to frontend..."
if [ ! -d "frontend" ]; then
    echo "Error: frontend directory not found"
    exit 1
fi
cp repo_data.json frontend/

# Ensure frontend dependencies are installed
echo "Ensuring frontend dependencies are installed..."
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start frontend development server
echo "Starting frontend development server..."
echo ""
echo "Repo Visualizer will be running at:"
echo "  Local:   http://localhost:5173/"
echo "  Network: (see output below)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev -- --host 0.0.0.0
