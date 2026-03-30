#!/usr/bin/env bash
# Thin wrapper: runs the repo-local orchestrator against this clone’s parent folder
# so sibling projects are discovered. For a global multi-project setup, copy
# orchestrator/stub-build.sh to ~/Documents/Projects/build.sh (see orchestrator/docs/INSTALL.md).
#
# From repo root (effective):
#   bash scripts/build.sh
#   bash scripts/build.sh --non-interactive
#   FULL_REBUILD=1 bash scripts/build.sh --non-interactive
#
# CI: when using --non-interactive / -n without --project, the wrapper adds
# --project <basename of this repo directory>.

set -euo pipefail
cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
export ORCH_PARENT="$(dirname "$REPO_ROOT")"
export ORCHESTRATOR_HOME="${ORCHESTRATOR_HOME:-$REPO_ROOT/orchestrator}"
SLUG="$(basename "$REPO_ROOT")"
MAIN="$ORCHESTRATOR_HOME/build.sh"

if [[ ! -f "$MAIN" ]]; then
  echo "error: orchestrator missing: $MAIN" >&2
  echo "  This repo includes orchestrator/ — ensure you did not delete it." >&2
  echo "  Standalone install: see orchestrator/docs/INSTALL.md" >&2
  exit 1
fi

args=("$@")
extra=()
if [[ "${1:-}" == "--non-interactive" || "${1:-}" == "-n" ]]; then
  has_project=0
  i=0
  while [[ $i -lt ${#args[@]} ]]; do
    if [[ "${args[i]}" == "--project" ]]; then
      has_project=1
      break
    fi
    i=$((i + 1))
  done
  if [[ "$has_project" == "0" ]]; then
    extra=(--project "$SLUG")
  fi
fi

exec bash "$MAIN" "${args[@]}" "${extra[@]}"
