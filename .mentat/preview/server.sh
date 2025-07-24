#!/bin/bash
set -euo pipefail

echo "Starting Repo Visualizer development server..."

# Get the directory where this script is located and navigate to repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT/frontend"

# Start frontend development server with hot reload
echo ""
echo "Repo Visualizer will be running at:"
echo "  Local:   http://localhost:5173/"
echo "  Network: (see output below)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev -- --host 0.0.0.0
