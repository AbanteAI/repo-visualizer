#!/bin/bash
set -e

echo "Starting Repo Visualizer development server..."

# Navigate to frontend directory
cd frontend

# Ensure frontend dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start frontend development server with hot reload
echo ""
echo "Repo Visualizer will be running at:"
echo "  Local:   http://localhost:5173/"
echo "  Network: (see output below)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev -- --host 0.0.0.0
