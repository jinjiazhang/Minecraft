#!/bin/bash
set -euo pipefail

ROOT=/opt/bedrock
DOWNLOAD_API="https://net-secondary.web.minecraft-services.net/api/v1.0/download/links"
UA="Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1; BEDROCK-UPDATER)"
KEEP=(server.properties allowlist.json permissions.json worlds console.in start.sh cmd.sh VERSION)

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root: sudo $0" >&2
  exit 1
fi

if [[ ! -x "$ROOT/bedrock_server" ]]; then
  echo "BDS is not installed under $ROOT; run install.sh first" >&2
  exit 1
fi

CURRENT="$(cat "$ROOT/VERSION" 2>/dev/null || echo unknown)"
DOWNLOAD_URL="$(curl -fsSL "$DOWNLOAD_API" | jq -r '.result.links[] | select(.downloadType=="serverBedrockLinux") | .downloadUrl')"
VERSION="$(basename "$DOWNLOAD_URL" .zip)"

if [[ "$CURRENT" == "$VERSION" ]]; then
  echo "already up to date: $CURRENT"
  exit 0
fi

echo "updating $CURRENT -> $VERSION"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
wget -q --show-progress -U "$UA" "$DOWNLOAD_URL" -O "$TMP/bedrock.zip"
mkdir -p "$TMP/extract"
unzip -q -o "$TMP/bedrock.zip" -d "$TMP/extract"

systemctl stop bedrock.service

# 只覆盖官方运行文件，保留世界和本地配置
shopt -s dotglob
for entry in "$TMP/extract"/*; do
  name="$(basename "$entry")"
  skip=0
  for keep in "${KEEP[@]}"; do
    if [[ "$name" == "$keep" ]]; then
      skip=1
      break
    fi
  done
  if [[ "$skip" -eq 0 ]]; then
    rm -rf "$ROOT/$name"
    cp -a "$entry" "$ROOT/$name"
  fi
done

chmod +x "$ROOT/bedrock_server"
printf '%s\n' "$VERSION" > "$ROOT/VERSION"
chown -R minecraft:minecraft "$ROOT"

systemctl start bedrock.service
echo "updated to $VERSION"
