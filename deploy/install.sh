#!/bin/bash
set -euo pipefail

ROOT=/opt/bedrock
DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
DOWNLOAD_API="https://net-secondary.web.minecraft-services.net/api/v1.0/download/links"
UA="Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; BEDROCK-UPDATER)"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo $0" >&2
  exit 1
fi

id -u minecraft >/dev/null 2>&1 || useradd --system --home "$ROOT" --shell /usr/sbin/nologin minecraft

mkdir -p "$ROOT"
chown minecraft:minecraft "$ROOT"

echo "resolving official BDS download url..."
DOWNLOAD_URL="$(curl -fsSL "$DOWNLOAD_API" | jq -r '.result.links[] | select(.downloadType=="serverBedrockLinux") | .downloadUrl')"
if [[ -z "$DOWNLOAD_URL" || "$DOWNLOAD_URL" == "null" ]]; then
  echo "failed to resolve BDS download url" >&2
  exit 1
fi

VERSION="$(basename "$DOWNLOAD_URL" .zip)"
echo "downloading $VERSION ..."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
wget -q --show-progress -U "$UA" "$DOWNLOAD_URL" -O "$TMP/bedrock.zip"
unzip -q -o "$TMP/bedrock.zip" -d "$ROOT"
chmod +x "$ROOT/bedrock_server"

install -m 0755 "$DEPLOY_DIR/start.sh" "$ROOT/start.sh"
install -m 0755 "$DEPLOY_DIR/cmd.sh" "$ROOT/cmd.sh"
install -m 0644 "$DEPLOY_DIR/server.properties" "$ROOT/server.properties"

if [[ ! -s "$ROOT/allowlist.json" ]]; then
  install -m 0644 "$DEPLOY_DIR/allowlist.json" "$ROOT/allowlist.json"
fi

printf '%s\n' "$VERSION" > "$ROOT/VERSION"
chown -R minecraft:minecraft "$ROOT"

install -m 0644 "$DEPLOY_DIR/bedrock.service" /etc/systemd/system/bedrock.service
systemctl daemon-reload
systemctl enable bedrock.service
systemctl restart bedrock.service

echo
echo "BDS installed: $VERSION"
echo "service: systemctl status bedrock"
echo "logs:    journalctl -u bedrock -f"
echo "command: $ROOT/cmd.sh help"
