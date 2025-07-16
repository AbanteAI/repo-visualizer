#!/bin/bash
set -e

# Install ruff
pip install ruff

# Format and fix Python code
ruff format .
ruff check --fix --unsafe-fixes .

# Frontend formatting (if frontend directory exists)
if [ -d "frontend" ]; then
    cd frontend
    npm install
    npm run format
    npm run lint:fix
    cd ..
fi
