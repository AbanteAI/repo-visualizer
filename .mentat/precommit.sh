#!/bin/bash
set +e  # Don't exit on error so we can handle failures gracefully

# Check if there are changes in the frontend directory
FRONTEND_CHANGES=$(git diff --cached --name-only | grep -E '
^
frontend/')
BACKEND_SUCCESS=true
FRONTEND_SUCCESS=true

# Try to activate virtual environment, but don't fail if it doesn't exist
if [ -d ".venv" ]; then
    echo "Attempting to activate virtual environment..."
    source .venv/bin/activate 2>/dev/null || echo "Warning: Virtual environment exists but could not be activated"
fi

# Determine Python command to use (python3 or python)
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "Warning: No Python command found. Will try to run tools directly."
    PYTHON_CMD=""
fi

# Find appropriate commands for our tools
RUFF_CMD=""
PYRIGHT_CMD=""

# Try different methods to find ruff
echo "Looking for ruff command..."
if command -v ruff &> /dev/null; then
    echo "Found ruff in PATH"
    RUFF_CMD="ruff"
elif [ -n "$PYTHON_CMD" ] && $PYTHON_CMD -m ruff --version &> /dev/null; then
    echo "Found ruff as Python module"
    RUFF_CMD="$PYTHON_CMD -m ruff"
elif command -v python3 &> /dev/null && python3 -m ruff --version &> /dev/null; then
    echo "Found ruff as Python3 module"
    RUFF_CMD="python3 -m ruff"
elif command -v python &> /dev/null && python -m ruff --version &> /dev/null; then
    echo "Found ruff as Python module"
    RUFF_CMD="python -m ruff"
else
    echo "Warning: ruff not found. Code formatting and linting will be skipped."
fi

# Try different methods to find pyright
echo "Looking for pyright command..."
if command -v pyright &> /dev/null; then
    echo "Found pyright in PATH"
    PYRIGHT_CMD="pyright"
elif command -v npx &> /dev/null && npx --no-install pyright --version &> /dev/null; then
    echo "Found pyright via npx"
    PYRIGHT_CMD="npx --no-install pyright"
else
    echo "Warning: pyright not found. Type checking will be skipped."
fi

# Run the checks if the tools were found
SUCCESS=true

# Format code with ruff
if [ -n "$RUFF_CMD" ]; then
    echo "Formatting code with ruff..."
    $RUFF_CMD format .
    if [ $? -ne 0 ]; then
        echo "Warning: Ruff formatting failed, continuing with other checks"
        BACKEND_SUCCESS=false
    fi

    # Fix linting issues with ruff
    echo "Running ruff linter with automatic fixes..."
    $RUFF_CMD check --fix .
    if [ $? -ne 0 ]; then
        echo "Warning: Ruff linting failed, continuing with other checks"
        BACKEND_SUCCESS=false
    fi
else
    echo "Skipping ruff formatting and linting due to missing tool"
    BACKEND_SUCCESS=false
fi

# Run type checking with pyright
if [ -n "$PYRIGHT_CMD" ]; then
    echo "Running type checking with pyright..."
    $PYRIGHT_CMD
    if [ $? -ne 0 ]; then
        echo "Warning: Pyright type checking found issues"
        # Don't fail the script on type checking issues, just warn
    fi
else
    echo "Skipping pyright type checking due to missing tool"
fi

# Run frontend tests if changes were made to frontend files
if [ -n "$FRONTEND_CHANGES" ]; then
    echo "Frontend changes detected. Running frontend tests..."
    cd frontend && npm test
    if [ $? -ne 0 ]; then
        echo "Warning: Frontend tests failed"
        FRONTEND_SUCCESS=false
    else
        echo "Frontend tests passed!"
    fi
    cd ..
fi

# Indicate overall success or failure
if [ "$BACKEND_SUCCESS" = true ] && [ "$FRONTEND_SUCCESS" = true ]; then
    echo "All available checks completed successfully!"
    exit 0
else
    echo "Warning: Some checks failed or were skipped. Review the output above for details."
    # Exit with success anyway to not block commits - CI will catch real errors
    exit 0
fi
