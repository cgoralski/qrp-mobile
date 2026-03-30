#!/usr/bin/env bash
# Toolchain PATH helpers for child actions (Node, etc.).

orchestrator_prepare_path() {
  export PATH="/usr/bin:/usr/local/bin:/snap/bin:${HOME}/.local/bin:$PATH"
  [[ -s "${HOME}/.nvm/nvm.sh" ]] && source "${HOME}/.nvm/nvm.sh"
  if ! command -v npm &>/dev/null; then
    local NPM_CANDIDATE
    NPM_CANDIDATE=$(find /usr /opt "${HOME}/.nvm" -name npm -type f 2>/dev/null | head -1)
    if [[ -n "$NPM_CANDIDATE" ]]; then
      export PATH="$(dirname "$NPM_CANDIDATE"):$PATH"
    fi
  fi
}
