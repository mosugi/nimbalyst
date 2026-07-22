#!/bin/bash

echo "Setting up electron for development..."

# Electron 42+ no longer downloads its runtime from the package postinstall.
# Use the package-provided installer so this stays aligned with package.json.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
npx --no-install install-electron

echo "Electron binary ready. You can now run:"
echo "  npm run dev  (from packages/electron directory)"
