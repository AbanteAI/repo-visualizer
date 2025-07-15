#!/bin/bash
set -e

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
$PIP_CMD install -e . > /dev/null 2>&1

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

# Start frontend development server
echo "Starting frontend development server..."
echo ""
echo "Repo Visualizer will be running at:"
echo "  Local:   http://localhost:5173/"
echo "  Network: (see output below)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

cd frontend
npm run dev -- --host 0.0.0.0
