#!/usr/bin/env bash
# Discover sibling projects with .build under ORCH_PARENT.

discover_projects_tsv() {
  local parent="$1"
  python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" discover "$parent"
}

discover_project_count() {
  local parent="$1"
  discover_projects_tsv "$parent" | wc -l | tr -d ' '
}
