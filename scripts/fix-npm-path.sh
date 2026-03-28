#!/usr/bin/env bash
# Fix PATH so npm/node are found again after PlatformIO install, without breaking pio.
# Run once on the server: bash scripts/fix-npm-path.sh
# Then run: source ~/.bashrc   (or open a new session)

set -e
BASHRC="${HOME}/.bashrc"
MARKER="# Ensure system paths for node/npm (before PlatformIO)"

# Find npm so we add the directory that actually has it
NPM_DIR=""
for d in /usr/bin /usr/local/bin /snap/bin; do
  [[ -x "$d/npm" ]] && NPM_DIR="$d" && break
done
if [[ -z "$NPM_DIR" ]]; then
  FOUND=$(find /usr /opt -name npm -type f 2>/dev/null | head -1)
  [[ -n "$FOUND" ]] && NPM_DIR="$(dirname "$FOUND")"
fi
if [[ -z "$NPM_DIR" ]]; then
  NPM_DIR="/usr/bin:/usr/local/bin:/snap/bin"
  echo "Could not find npm on disk. Adding $NPM_DIR to PATH anyway."
fi
LINE="export PATH=\"${NPM_DIR}:\\\$PATH\""

if [[ ! -f "$BASHRC" ]]; then
  echo "No ~/.bashrc found. Creating with PATH fix."
  printf '%s\n%s\n' "$MARKER" "$LINE" > "$BASHRC"
  echo "Done. Run: source ~/.bashrc"
  exit 0
fi

if grep -qF "$MARKER" "$BASHRC" 2>/dev/null; then
  echo "PATH fix already present in ~/.bashrc. Nothing to do."
  exit 0
fi

# Prepend after first line (in case of shebang) so system paths win
BACKUP="${BASHRC}.bak.$(date +%Y%m%d%H%M%S)"
cp "$BASHRC" "$BACKUP"
{
  echo ""
  echo "$MARKER"
  echo "$LINE"
  echo ""
  cat "$BASHRC"
} > "${BASHRC}.new"
mv "${BASHRC}.new" "$BASHRC"
echo "Updated ~/.bashrc (backup: $BACKUP). Run: source ~/.bashrc"
echo "Then: npm run build   and   pio run   should both work."
