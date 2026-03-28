#!/usr/bin/env bash
# After npm install, overlay patched sources for dependencies that need fixes.
# Replaces patch-package (avoids patch(1) / line-ending failures on some macOS setups).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/node_modules/@miaz/capacitor-websocket/ios/Plugin"
SRC="$ROOT/scripts/npm-patches/@miaz/capacitor-websocket"
if [[ -d "$TARGET" ]]; then
  cp "$SRC/WebsocketConnection.swift" "$TARGET/"
  cp "$SRC/CapacitorWebsocketPlugin.swift" "$TARGET/"
  echo "apply-npm-patches: @miaz/capacitor-websocket iOS Swift sources updated"
fi
