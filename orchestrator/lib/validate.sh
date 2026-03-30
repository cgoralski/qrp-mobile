#!/usr/bin/env bash
# Validate project dir is a git work tree and .build is readable.

require_git_project() {
  local proj="$1"
  if [[ ! -d "$proj/.git" ]] && ! git -C "$proj" rev-parse --is-inside-work-tree &>/dev/null; then
    echo "error: $proj is not a git repository (.build must live inside an app git clone)." >&2
    echo "  Clone the project from GitHub (or init git) before running orchestrator actions." >&2
    return 1
  fi
  return 0
}

require_build_file() {
  local bf="$1"
  if [[ ! -f "$bf" ]]; then
    echo "error: missing catalog: $bf" >&2
    return 1
  fi
  return 0
}

validate_catalog_schema() {
  local bf="$1"
  local ver
  ver="$(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" schema-version "$bf" 2>/dev/null)" || true
  if [[ -z "$ver" || "$ver" == "0" ]]; then
    echo "warning: $bf has no or unknown schemaVersion (expected 1)" >&2
  fi
}
