#!/usr/bin/env bash
# QRP Mobile build helper: web UI, optional KV4P firmware flash, optional Xcode.
#
# Usage (from repo root):
#   bash scripts/build.sh
#   ./scripts/build.sh
#
# Non-interactive (CI / automation): skips menu and prompts; web build only.
#   bash scripts/build.sh --non-interactive
#   FULL_REBUILD=1 bash scripts/build.sh --non-interactive
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

ensure_node_deps() {
  if [[ "${FULL_REBUILD:-0}" == "1" ]]; then
    echo "==> FULL_REBUILD=1: clean install (npm ci)"
    npm ci
  elif [[ ! -d node_modules ]]; then
    echo "==> node_modules missing: npm ci"
    npm ci
  fi
}

run_web_build() {
  echo "==> QRP Mobile frontend (vite build -> dist/)"
  echo "    Root: $ROOT"
  ensure_node_deps
  echo "==> vite build -> dist/"
  npm run build
  echo "==> Web build done. Output: $ROOT/dist/"
}

flash_kv4p_firmware() {
  local fm="$ROOT/firmware/microcontroller"
  echo "==> Flash KV4P Firmware (PlatformIO)"
  if [[ ! -f "$fm/platformio.ini" ]]; then
    echo "error: missing $fm/platformio.ini" >&2
    return 1
  fi
  local pio_cmd=""
  if command -v pio &>/dev/null; then
    pio_cmd=pio
  elif command -v platformio &>/dev/null; then
    pio_cmd=platformio
  else
    echo "error: PlatformIO not found. Install: brew install platformio" >&2
    echo "  Then: cd firmware/microcontroller && pio run -e esp32dev -t upload" >&2
    return 1
  fi
  (cd "$fm" && "$pio_cmd" run -e esp32dev -t upload)
  echo "==> Firmware upload finished."
}

sync_ios_open_xcode() {
  echo "==> Preparing iOS project for Xcode (Capacitor sync)"
  if [[ ! -f "$ROOT/capacitor.config.ts" ]]; then
    echo "error: missing capacitor.config.ts at repo root" >&2
    return 1
  fi
  if [[ -f "$ROOT/scripts/apply-npm-patches.sh" ]]; then
    bash "$ROOT/scripts/apply-npm-patches.sh"
  fi
  echo "==> npm run build:capacitor"
  npm run build:capacitor
  echo "==> npx cap sync ios"
  npx cap sync ios
  local ios_app="$ROOT/ios/App"
  if command -v pod &>/dev/null; then
    echo "==> pod install (ios/App)"
    (cd "$ios_app" && pod install)
  else
    echo "warning: CocoaPods (pod) not in PATH. Install: brew install cocoapods" >&2
    echo "  Then run: cd ios/App && pod install" >&2
  fi
  local ws="$ios_app/App.xcworkspace"
  if [[ -d "$ws" ]]; then
    echo "==> Opening Xcode workspace…"
    open "$ws"
  else
    echo "error: workspace not found: $ws (run npx cap sync ios)" >&2
    return 1
  fi
}

interactive_qrp_mobile() {
  run_web_build
  echo ""
  read -r -p "Flash the KV4P Board? (y/n) " flash_ans
  case "$flash_ans" in
    y|Y|yes|YES)
      flash_kv4p_firmware || echo "Firmware flash failed (see errors above)."
      ;;
    *)
      echo "Skipping firmware flash."
      ;;
  esac
  echo ""
  read -r -p "Open the project in Xcode afterwards? (y/n) " xcode_ans
  case "$xcode_ans" in
    y|Y|yes|YES)
      sync_ios_open_xcode || echo "Xcode sync/open failed (see errors above)."
      ;;
    *)
      echo "Skipping Xcode."
      echo "    Later: bash scripts/ios-sync.sh --open"
      echo "    Or: open \"$ROOT/ios/App/App.xcworkspace\""
      ;;
  esac
  echo "==> Done."
}

show_menu() {
  echo ""
  echo "QRP Mobile build"
  echo "----------------"
  echo "  1) QRP Mobile project (web build, then optional flash + Xcode)"
  echo "  2) Exit"
  echo ""
  read -r -p "Choose an option [1-2]: " choice
  case "$choice" in
    1)
      interactive_qrp_mobile
      ;;
    2)
      echo "Exiting."
      exit 0
      ;;
    *)
      echo "Invalid option. Exiting." >&2
      exit 1
      ;;
  esac
}

# Non-interactive: no TTY or explicit flag — preserve previous script behavior (web build only)
if [[ "${1:-}" == "--non-interactive" ]] || [[ "${1:-}" == "-n" ]] || [[ ! -t 0 ]]; then
  echo "==> QRP Mobile frontend build (non-interactive)"
  echo "    Root: $ROOT"
  run_web_build
  echo "==> Done. Static UI output: $ROOT/dist/"
  exit 0
fi

show_menu
