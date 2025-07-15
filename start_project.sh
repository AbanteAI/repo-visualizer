#!/bin/bash
set -e

echo "Starting Repo Visualizer..."

# Determine Python command to use (python3 or python)
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Error: Neither python3 nor python was found"
    exit 1
fi

# Generate repository data
echo "Generating repository data..."
$PYTHON_CMD -m repo_visualizer . -o repo_data.json -v

# Copy data to frontend
echo "Copying data to frontend..."
cp repo_data.json frontend/

# Start frontend development server
echo "Starting frontend development server..."
cd frontend
npm run dev -- --host 0.0.0.0

echo "Repo Visualizer is running!"
echo "Access the application at:"
echo "  Local:   http://localhost:5173/"
echo "  Network: (see output above)"
