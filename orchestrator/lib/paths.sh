#!/usr/bin/env bash
# Resolve orchestrator install dir and projects parent (ORCH_PARENT).

orchestrator_lib_dir() {
  local here="${BASH_SOURCE[0]}"
  while [[ -L "$here" ]]; do
    here="$(readlink "$here")"
  done
  cd "$(dirname "$here")" && pwd
}

orchestrator_root() {
  cd "$(orchestrator_lib_dir)/.." && pwd
}

# Real path for a file (macOS + Linux)
realpath_safe() {
  local p="$1"
  if command -v realpath &>/dev/null; then
    realpath "$p"
  else
    [[ -e "$p" ]] || return 1
    cd "$(dirname "$p")" && echo "$(pwd -P)/$(basename "$p")"
  fi
}
