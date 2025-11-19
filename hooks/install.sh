#!/bin/bash
#
# Install git hooks
# Run this script to set up git hooks for this repository
#

HOOKS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$(git rev-parse --git-dir)/hooks"

echo "Installing git hooks..."
echo ""

# Copy pre-commit hook
if [ -f "$HOOKS_DIR/pre-commit" ]; then
  cp "$HOOKS_DIR/pre-commit" "$GIT_HOOKS_DIR/pre-commit"
  chmod +x "$GIT_HOOKS_DIR/pre-commit"
  echo "✓ Installed pre-commit hook"
else
  echo "✗ pre-commit hook not found"
  exit 1
fi

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "Installed hooks:"
echo "  - pre-commit: Runs tests before each commit"
