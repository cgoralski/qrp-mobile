#!/usr/bin/env bash
# Copy this file to ~/Documents/Projects/build.sh (or another parent of your git clones).
# Adjust ORCHESTRATOR_HOME if your orchestrator clone lives elsewhere.
#
# Install once:
#   git clone <orchestrator-repo-url> ~/Documents/Projects/.qrp-orchestrator
#   cp stub-build.sh ~/Documents/Projects/build.sh
#   chmod +x ~/Documents/Projects/build.sh

set -euo pipefail

STUB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ORCH_PARENT="$STUB_DIR"
export ORCHESTRATOR_HOME="${ORCHESTRATOR_HOME:-$STUB_DIR/.qrp-orchestrator}"
export GIT_AUTO_UPDATE="${GIT_AUTO_UPDATE:-0}"

MAIN="$ORCHESTRATOR_HOME/build.sh"
if [[ ! -f "$MAIN" ]]; then
  echo "error: orchestrator not found at: $MAIN" >&2
  echo "  Clone the thin orchestrator repository into:" >&2
  echo "    $ORCHESTRATOR_HOME" >&2
  echo "  Then re-run this script." >&2
  exit 1
fi

exec bash "$MAIN" "$@"
