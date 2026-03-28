#!/usr/bin/env bash
# One-time setup: qrpmobile.vk4cgo.com — HTTP-only nginx, Let's Encrypt, then full HTTPS config.
# Run from repo root with sudo (or as root). Requires: nginx, certbot, DNS for qrpmobile.vk4cgo.com pointing here.
#
# Usage:
#   cd /var/www/html/sites/qrpmobile.vk4cgo.com
#   sudo bash scripts/setup-qrpmobile-vk4cgo-com.sh
#
# Steps:
#   1. Ensure site directory /var/www/html/sites/qrpmobile.vk4cgo.com exists (repo root is usually this path).
#   2. Copy/sync app files into it (or skip if the repo already lives there).
#   3. Install HTTP-only nginx config so certbot can complete the challenge.
#   4. Run certbot to get a certificate for qrpmobile.vk4cgo.com.
#   5. Install full nginx config (HTTPS + redirect) and reload nginx.

set -e

SITE_NAME="qrpmobile.vk4cgo.com"
SITES_ROOT="/var/www/html/sites"
NEW_SITE_DIR="${SITES_ROOT}/${SITE_NAME}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_AVAILABLE="${NGINX_AVAILABLE:-/etc/nginx/wcc/apps-available}"
NGINX_ENABLED="${NGINX_ENABLED:-/etc/nginx/wcc/apps-enabled}"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script with sudo (or as root)."
  exit 1
fi

echo "=== Setup ${SITE_NAME} ==="

# 1. Site directory (create or use existing; if you renamed repo to qrpmobile.vk4cgo.com, REPO_ROOT may equal NEW_SITE_DIR)
if [[ "$(realpath "$REPO_ROOT")" == "$(realpath "$NEW_SITE_DIR")" ]]; then
  echo "Repo is already at ${NEW_SITE_DIR} (folder was renamed)."
elif [[ ! -d "$NEW_SITE_DIR" ]]; then
  echo "Creating ${NEW_SITE_DIR}..."
  mkdir -p "$NEW_SITE_DIR"
  if [[ -d "${REPO_ROOT}/dist" ]]; then
    echo "Copying dist/ from current repo into ${NEW_SITE_DIR}..."
    cp -a "${REPO_ROOT}/dist" "$NEW_SITE_DIR/"
  else
    echo "No dist/ in repo; create and copy dist/ to ${NEW_SITE_DIR}/dist before serving."
    mkdir -p "${NEW_SITE_DIR}/dist"
  fi
else
  echo "Site dir already exists: ${NEW_SITE_DIR}"
fi

# Ensure .well-known for certbot (certbot will create acme-challenge)
mkdir -p "${NEW_SITE_DIR}/.well-known/acme-challenge"
chown -R www-data:www-data "${NEW_SITE_DIR}" 2>/dev/null || true

# 2. HTTP-only nginx config (for initial cert issuance)
echo "Installing HTTP-only nginx config for ACME challenge..."
cp "${REPO_ROOT}/nginx/${SITE_NAME}-http-only.conf" "${NGINX_AVAILABLE}/${SITE_NAME}.conf"
ln -sf "${NGINX_AVAILABLE}/${SITE_NAME}.conf" "${NGINX_ENABLED}/${SITE_NAME}.conf"
nginx -t && systemctl reload nginx
echo "Nginx reloaded (HTTP only)."

# 3. Obtain certificate
echo "Running certbot for ${SITE_NAME}..."
# Use CERTBOT_EMAIL if set (e.g. CERTBOT_EMAIL=you@example.com), else certbot may prompt
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
CERTBOT_OPTS=(--webroot -w "$NEW_SITE_DIR" -d "$SITE_NAME" --non-interactive --agree-tos)
[[ -n "$CERTBOT_EMAIL" ]] && CERTBOT_OPTS+=(--email "$CERTBOT_EMAIL")

if certbot certonly "${CERTBOT_OPTS[@]}" 2>/dev/null; then
  echo "Certificate obtained."
else
  echo "Certbot may need an email. Run manually:"
  echo "  sudo certbot certonly --webroot -w ${NEW_SITE_DIR} -d ${SITE_NAME}"
  echo "Then run this script again, or continue with step 4 manually."
  read -p "Continue to install full nginx config anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[yY]$ ]]; then
    exit 1
  fi
fi

# 4. Full nginx config (HTTPS + HTTP redirect)
if [[ -f /etc/letsencrypt/live/${SITE_NAME}/fullchain.pem ]]; then
  echo "Installing full nginx config (HTTPS)..."
  cp "${REPO_ROOT}/nginx/${SITE_NAME}.conf" "${NGINX_AVAILABLE}/${SITE_NAME}.conf"
  ln -sf "${NGINX_AVAILABLE}/${SITE_NAME}.conf" "${NGINX_ENABLED}/${SITE_NAME}.conf"
  nginx -t && systemctl reload nginx
  echo "Done. Site should be live at https://${SITE_NAME}"
else
  echo "Certificate not found. Install full config after obtaining cert:"
  echo "  sudo cp ${REPO_ROOT}/nginx/${SITE_NAME}.conf ${NGINX_AVAILABLE}/"
  echo "  sudo ln -sf ${NGINX_AVAILABLE}/${SITE_NAME}.conf ${NGINX_ENABLED}/"
  echo "  sudo nginx -t && sudo systemctl reload nginx"
fi
