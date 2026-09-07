#!/bin/bash
set -euo pipefail

ROOT=/opt/bedrock
LOCK="$ROOT/wipe.lock"
PACK_JSON="$ROOT/world_behavior_packs.json"
NOW="$(date +%s)"

if [[ -f "$LOCK" ]]; then
  LAST="$(stat -c %Y "$LOCK")"
  if (( NOW - LAST < 90 )); then
    echo "wipe already in progress"
    exit 0
  fi
fi
touch "$LOCK"

echo "wiping bedrock world..."
systemctl stop bedrock.service
rm -rf "$ROOT/worlds/world"
mkdir -p "$ROOT/worlds"
chown minecraft:minecraft "$ROOT/worlds"

systemctl start bedrock.service

ok=0
for _ in $(seq 1 40); do
  if [[ -f "$ROOT/worlds/world/level.dat" ]]; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  echo "new world did not appear" >&2
  rm -f "$LOCK"
  exit 1
fi

if [[ -f "$PACK_JSON" ]]; then
  cp "$PACK_JSON" "$ROOT/worlds/world/world_behavior_packs.json"
  chown minecraft:minecraft "$ROOT/worlds/world/world_behavior_packs.json"
  systemctl restart bedrock.service
fi

rm -f "$LOCK"
echo "world wiped and recreated"
