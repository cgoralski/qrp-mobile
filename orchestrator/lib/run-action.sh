#!/usr/bin/env bash
# Run one declarative action from a .build catalog.

run_action() {
  local project_root="$1"
  local build_file="$2"
  local action_id="$3"

  local cmd cwd
  cmd="$(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" action-command "$build_file" "$action_id")" || {
    echo "error: unknown action id: $action_id" >&2
    return 1
  }
  cwd="$(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" action-cwd "$build_file" "$action_id")"
  [[ -z "$cwd" ]] && cwd="."

  orchestrator_prepare_path

  echo "==> Action: $action_id ($(python3 "$ORCHESTRATOR_ROOT/lib/catalog.py" action-label "$build_file" "$action_id"))"
  echo "    project: $project_root"
  (cd "$project_root" && cd "$cwd" && bash -euo pipefail -c "$cmd")
}
