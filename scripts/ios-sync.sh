#!/usr/bin/env bash
# Sync web build into the Capacitor iOS project:
#   npm install (optional) → apply-npm-patches → npm run build:capacitor → npx cap sync ios → pod install
#
# Run from anywhere: symlink into your PATH, e.g.
#   chmod +x scripts/ios-sync.sh
#   ln -sf "$(pwd)/scripts/ios-sync.sh" "$HOME/bin/qrp-ios-sync"
#
# Override repo root: export QRP_MOBILE_ROOT=/path/to/qrp-mobile
#
# Xcode “Clean Build Folder” (Shift+Cmd+K) is still useful after native changes;
# this script does not remove ~/Library/Developer/Xcode/DerivedData.

set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") [options]"
  echo "  --skip-install    Skip npm install"
  echo "  --clean-pods      Remove ios/App/Pods, Podfile.lock, and ios/App/build before pod install"
  echo "                    (use after plugin / patch / Xcode pod errors; slower, full pod fetch)"
  echo "  --open            Open App.xcworkspace in Xcode after sync"
  echo "  -h, --help        Show this help"
  echo ""
  echo "Examples:"
  echo "  $(basename "$0")"
  echo "  $(basename "$0") --skip-install --open"
  echo "  $(basename "$0") --clean-pods --open"
}

resolve_repo_root() {
  if [[ -n "${QRP_MOBILE_ROOT:-}" ]]; then
    cd "$(cd "$QRP_MOBILE_ROOT" && pwd -P)"
    pwd -P
    return
  fi

  local src="${BASH_SOURCE[0]}"
  while [[ -L "$src" ]]; do
    local dir
    dir="$(cd -P "$(dirname "$src")" && pwd)"
    local target
    target="$(readlink "$src")"
    [[ "$target" != /* ]] && target="$dir/$target"
    src="$target"
  done
  local script_dir
  script_dir="$(cd -P "$(dirname "$src")" && pwd)"
  cd "$script_dir/.." && pwd -P
}

verify_websocket_patch() {
  local f="$REPO_ROOT/node_modules/@miaz/capacitor-websocket/ios/Plugin/WebsocketConnection.swift"
  if [[ ! -f "$f" ]]; then
    echo "error: missing $f — run npm install without --ignore-scripts" >&2
    exit 1
  fi
  if ! grep -q 'Starscream\.WebSocket' "$f"; then
    echo "error: iOS WebSocket plugin is not patched (still shows unqualified WebSocket)." >&2
    echo "  Run: bash scripts/apply-npm-patches.sh" >&2
    echo "  Do not use: npm install --ignore-scripts (skips postinstall patches)." >&2
    echo "  Ensure git has scripts/npm-patches/@miaz/capacitor-websocket/*.swift and you ran git pull." >&2
    exit 1
  fi
}

SKIP_INSTALL=0
OPEN_XCODE=0
CLEAN_PODS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install) SKIP_INSTALL=1 ;;
    --open) OPEN_XCODE=1 ;;
    --clean-pods) CLEAN_PODS=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

REPO_ROOT="$(resolve_repo_root)"
cd "$REPO_ROOT"

if [[ ! -f package.json ]] || [[ ! -f capacitor.config.ts ]]; then
  echo "error: $REPO_ROOT does not look like the QRP Mobile repo (missing package.json or capacitor.config.ts)" >&2
  echo "Set QRP_MOBILE_ROOT to your clone path, or run this script from the repo’s scripts/ directory (or a symlink to it)." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "error: node not found in PATH" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "error: npm not found in PATH" >&2; exit 1; }

echo "==> Repo: $REPO_ROOT"

if [[ "$SKIP_INSTALL" -eq 0 ]]; then
  echo "==> npm install"
  npm install
else
  echo "==> skipping npm install"
fi

echo "==> apply-npm-patches (overlay fixed Swift sources for @miaz/capacitor-websocket)"
bash "$REPO_ROOT/scripts/apply-npm-patches.sh"

verify_websocket_patch

echo "==> npm run build:capacitor (no PWA for native)"
npm run build:capacitor

echo "==> npx cap sync ios"
npx cap sync ios

IOS_APP="$REPO_ROOT/ios/App"
if [[ "$CLEAN_PODS" -eq 1 ]]; then
  echo "==> cleaning CocoaPods artifacts under ios/App"
  rm -rf "$IOS_APP/Pods" "$IOS_APP/Podfile.lock" "$IOS_APP/build"
  echo "    (removed Pods, Podfile.lock, build if present)"
fi

echo "==> pod install (ios/App)"
cd "$IOS_APP"
command -v pod >/dev/null 2>&1 || { echo "error: pod (CocoaPods) not found. Install: brew install cocoapods" >&2; exit 1; }
pod install
cd "$REPO_ROOT"

echo "==> Done."
if [[ "$CLEAN_PODS" -eq 1 ]]; then
  echo "    Tip: In Xcode, use Product → Clean Build Folder (Shift+Cmd+K) before Run if the build still acts stale."
fi
if [[ "$OPEN_XCODE" -eq 1 ]]; then
  echo "==> Opening Xcode…"
  open ios/App/App.xcworkspace
else
  echo "Open the workspace with:"
  echo "  open \"$REPO_ROOT/ios/App/App.xcworkspace\""
fi
