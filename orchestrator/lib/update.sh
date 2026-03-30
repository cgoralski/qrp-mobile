#!/usr/bin/env bash
# Self-update: git pull orchestrator clone; compare HEAD.

orchestrator_git_head() {
  local home="$1"
  git -C "$home" rev-parse HEAD 2>/dev/null || echo ""
}

orchestrator_try_pull() {
  local home="${ORCHESTRATOR_HOME:-}"
  if [[ -z "$home" || ! -d "$home/.git" ]]; then
    echo "==> Orchestrator self-update: skipped (ORCHESTRATOR_HOME is not a git clone)."
    echo "    Clone the thin orchestrator repo into e.g. ~/Documents/Projects/.qrp-orchestrator"
    echo "    and set ORCHESTRATOR_HOME in your stub build.sh. Using Git protects against loss"
    echo "    and lets you pull updates easily."
    return 1
  fi

  local before after
  before="$(orchestrator_git_head "$home")"
  if [[ -z "$before" ]]; then
    echo "==> Orchestrator self-update: skipped (not a valid git repo: $home)" >&2
    return 1
  fi

  echo "==> Updating orchestrator at $home …"
  if ! git -C "$home" pull --ff-only 2>&1; then
    echo "error: git pull failed. Resolve conflicts or pull manually." >&2
    return 1
  fi
  after="$(orchestrator_git_head "$home")"
  if [[ "$before" != "$after" ]]; then
    echo "==> Orchestrator updated ($before -> $after). Re-run this script to use the new version."
    return 2
  fi
  echo "==> Orchestrator already up to date."
  return 0
}
