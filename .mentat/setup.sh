#!/bin/bash
set +e  # Don't exit on error so we can handle failures gracefully

# Determine Python command to use (python3 or python)
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    PIP_CMD="pip3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    PIP_CMD="pip"
else
    echo "Error: Neither python3 nor python was found"
    # Try to continue anyway and hope the commands we need are in the PATH
fi

if [ -n "$PYTHON_CMD" ]; then
    echo "Using Python command: $PYTHON_CMD"
fi

# Determine if we can create a virtual environment or if we should install globally
USE_VENV=false

# Only try to set up virtual environment if python was found
if [ -n "$PYTHON_CMD" ]; then
    # Check if user has permission to create virtual environments
    echo "Checking if we can create a virtual environment..."
    if $PYTHON_CMD -m venv --help &>/dev/null; then
        USE_VENV=true
    fi
fi

# Try to create virtual environment, skip if it fails
if [ "$USE_VENV" = true ] && [ ! -d ".venv" ]; then
    echo "Attempting to create virtual environment..."
    $PYTHON_CMD -m venv .venv 2>/dev/null || {
        echo "Warning: Unable to create virtual environment. Will install dependencies globally."
        USE_VENV=false
    }
fi

# Activate virtual environment if created successfully
if [ "$USE_VENV" = true ] && [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate 2>/dev/null || {
        echo "Warning: Unable to activate virtual environment. Will install dependencies globally."
        USE_VENV=false
    }
    PIP_CMD="pip"  # Use pip from virtual environment if activated
fi

# Check if pip is available
if ! command -v $PIP_CMD &> /dev/null; then
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
    elif [ -n "$PYTHON_CMD" ]; then
        # Try to use pip from python module
        if $PYTHON_CMD -m pip --version &>/dev/null; then
            PIP_CMD="$PYTHON_CMD -m pip"
        else
            echo "Error: No pip command found. Cannot install dependencies."
            exit 1
        fi
    else
        echo "Error: No pip command found. Cannot install dependencies."
        exit 1
    fi
fi

echo "Using pip command: $PIP_CMD"

# Install dependencies
echo "Installing development dependencies..."

# Try to upgrade pip but don't fail if it doesn't work (common in system python installations)
echo "Attempting to upgrade pip (may be skipped if installed by system package manager)..."
$PIP_CMD install --upgrade pip 2>/dev/null || echo "Skipping pip upgrade due to system restrictions."

# Install dependencies with different options depending on environment
if [ "$USE_VENV" = true ]; then
    echo "Installing dependencies in virtual environment..."
    $PIP_CMD install -r dev-requirements.txt || {
        echo "Warning: Failed to install dev-requirements.txt"
    }
    
    echo "Installing package in development mode..."
    $PIP_CMD install -e . || {
        echo "Warning: Failed to install package in development mode"
    }
else
    echo "Installing dependencies globally (with --user flag)..."
    # Use --user flag to avoid permission issues when installing globally
    $PIP_CMD install --user -r dev-requirements.txt || {
        # Try without --user flag as a fallback
        echo "Trying to install dependencies without --user flag..."
        $PIP_CMD install -r dev-requirements.txt || {
            echo "Warning: Failed to install dev-requirements.txt"
        }
    }
    
    echo "Installing package in development mode..."
    $PIP_CMD install --user -e . || {
        # Try without --user flag as a fallback
        echo "Trying to install package without --user flag..."
        $PIP_CMD install -e . || {
            echo "Warning: Failed to install package in development mode"
        }
    }
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
if [ -d "frontend" ]; then
    cd frontend
    if command -v npm &> /dev/null; then
        if [ ! -d "node_modules" ]; then
            npm install || {
                echo "Warning: Failed to install frontend dependencies"
                cd ..
                exit 1
            }
            echo "Frontend dependencies installed successfully"
        else
            echo "Frontend dependencies already installed"
        fi
    else
        echo "Warning: npm not found, skipping frontend setup"
    fi
    cd ..
else
    echo "Warning: frontend directory not found, skipping frontend setup"
fi

# Print completion message
echo "Setup complete! Some steps may have been skipped due to environment restrictions."
if [ "$USE_VENV" = true ]; then
    echo "You can activate the virtual environment with: source .venv/bin/activate"
fi
echo ""
echo "To start the project, run:"
echo "  ./start_project.sh"
