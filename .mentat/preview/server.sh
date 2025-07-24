#!/bin/bash
set -euo pipefail

# Get the directory where this script is located and navigate to repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT/frontend"

exec npm run dev -- --host 0.0.0.0
