#!/usr/bin/env bash
# Build the QRP Mobile frontend UI (Vite + React + PWA) into dist/
#
# Usage (from repo root):
#   bash scripts/build.sh
#   ./scripts/build.sh
#
# Optional:
#   FULL_REBUILD=1 bash scripts/build.sh   # npm ci then build (clean install from package-lock.json)

set -e
cd "$(dirname "$0")/.."

# Include common locations for node/npm (system, NodeSource, snap, local)
export PATH="/usr/bin:/usr/local/bin:/snap/bin:${HOME}/.local/bin:$PATH"
# nvm: load if present so npm is available
[[ -s "${HOME}/.nvm/nvm.sh" ]] && source "${HOME}/.nvm/nvm.sh"

# If npm still not found, try to find it
if ! command -v npm &>/dev/null; then
  NPM_CANDIDATE=$(find /usr /opt -name npm -type f 2>/dev/null | head -1)
  if [[ -n "$NPM_CANDIDATE" ]]; then
    export PATH="$(dirname "$NPM_CANDIDATE"):$PATH"
  fi
fi

if ! command -v npm &>/dev/null; then
  echo "npm not found. Tried PATH and search under /usr, /opt."
  echo "Install Node/npm (e.g. NodeSource or apt install nodejs npm) then run this again."
  exit 1
fi

ROOT="$(pwd)"
echo "==> QRP Mobile frontend build"
echo "    Root: $ROOT"

if [[ "${FULL_REBUILD:-0}" == "1" ]]; then
  echo "==> FULL_REBUILD=1: clean install (npm ci)"
  npm ci
elif [[ ! -d node_modules ]]; then
  echo "==> node_modules missing: npm ci"
  npm ci
fi

echo "==> vite build -> dist/"
npm run build

echo "==> Done. Static UI output: $ROOT/dist/"
