#!/usr/bin/env bash
# Project-agnostic build orchestrator. Discovers sibling folders with .build JSON catalogs.
#
# Requires ORCH_PARENT in the environment (folder containing project directories).
# Typically set by stub-build.sh next to your clones.
#
# Usage:
#   ORCH_PARENT=~/Documents/Projects GIT_AUTO_UPDATE=1 ./build.sh
#   ./build.sh --non-interactive --project qrp-mobile
#   ./build.sh --help

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export ORCHESTRATOR_ROOT="$SCRIPT_DIR"

if ! command -v python3 &>/dev/null; then
  echo "error: python3 is required to read .build JSON catalogs." >&2
  exit 1
fi

# shellcheck source=/dev/null
for _lib in paths env validate discover run-action menu update; do
  source "$ORCHESTRATOR_ROOT/lib/${_lib}.sh"
done

usage() {
  cat <<'EOF'
Project-agnostic build orchestrator. Set ORCH_PARENT to the folder containing
project directories (each may include a .build JSON catalog).
EOF
  echo ""
  echo "Environment:"
  echo "  ORCH_PARENT       Directory containing project folders (each may hold .build)."
  echo "  ORCHESTRATOR_HOME Git clone of this orchestrator (for self-update / stub)."
  echo "  GIT_AUTO_UPDATE=1 If set and stdin is a TTY, git pull orchestrator before menu."
  echo ""
  echo "Options:"
  echo "  --help, -h              Show this help."
  echo "  --non-interactive, -n   Run menu.defaultAction only (no prompts)."
  echo "  --project SLUG          Project folder name under ORCH_PARENT (required with -n)."
  echo "  --update-orchestrator   Run git pull on ORCHESTRATOR_HOME and exit."
}

UPDATE_ONLY=0
NONINTERACTIVE=0
PROJECT_SLUG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help | -h)
      usage
      exit 0
      ;;
    --non-interactive | -n)
      NONINTERACTIVE=1
      shift
      ;;
    --project)
      PROJECT_SLUG="${2:-}"
      shift 2
      ;;
    --update-orchestrator)
      UPDATE_ONLY=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "${ORCH_PARENT:-}" ]]; then
  echo "error: ORCH_PARENT is not set." >&2
  echo "  Use the stub script in your Projects folder (see orchestrator/stub-build.sh)" >&2
  echo "  or:  export ORCH_PARENT=/path/to/parent  $ORCHESTRATOR_ROOT/build.sh" >&2
  exit 1
fi

ORCH_PARENT="$(cd "$ORCH_PARENT" && pwd)"

if [[ "$UPDATE_ONLY" == "1" ]]; then
  orchestrator_try_pull "${ORCHESTRATOR_HOME:-}" || true
  exit 0
fi

if [[ "${GIT_AUTO_UPDATE:-0}" == "1" ]] && [[ -t 0 ]]; then
  set +e
  orchestrator_try_pull "${ORCHESTRATOR_HOME:-}"
  pull_code=$?
  set -e
  if [[ "$pull_code" -eq 2 ]]; then
    exit 0
  fi
fi

if [[ "$NONINTERACTIVE" == "1" ]]; then
  if [[ -z "$PROJECT_SLUG" ]]; then
    echo "error: --non-interactive requires --project <slug>" >&2
    exit 1
  fi
  if [[ ! -t 0 ]]; then
    : # CI
  fi
  menu_run_noninteractive "$ORCH_PARENT" "$PROJECT_SLUG"
  exit 0
fi

if [[ ! -t 0 ]]; then
  echo "error: interactive menu requires a TTY, or use --non-interactive --project SLUG" >&2
  exit 1
fi

while true; do
  MENU_CHOICE=""
  MENU_SLUG=""
  menu_pick_project "$ORCH_PARENT" || continue
  case "${MENU_CHOICE:-}" in
    UPDATE_ORCHESTRATOR)
      set +e
      orchestrator_try_pull "${ORCHESTRATOR_HOME:-}"
      pull_code=$?
      set -e
      if [[ "$pull_code" -eq 2 ]]; then
        exit 0
      fi
      ;;
    PROJECT)
      menu_run_project_flow "$ORCH_PARENT" "${MENU_SLUG:-}" || true
      ;;
  esac
  echo ""
done
