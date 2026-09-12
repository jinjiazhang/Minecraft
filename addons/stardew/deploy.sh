#!/usr/bin/env bash
set -euo pipefail
root=/opt/bedrock
src=/tmp/stardew-release
world=stardew-farm
watcher_was_active=false
if systemctl is-active --quiet helsinki-reset-watch; then watcher_was_active=true; fi
[[ -f "$src/pack/manifest.json" ]]
# Retain the entire Helsinki world and its pack bindings. Switch only active world.
cp "$root/server.properties" "$src/previous-server.properties"
cp "$root/world_behavior_packs.json" "$src/previous-behavior.json"
cp "$root/world_resource_packs.json" "$src/previous-resource.json"
"$root/cmd.sh" stop
for i in {1..30}; do
  if ! systemctl is-active --quiet bedrock; then break; fi
  sleep 1
done
if systemctl is-active --quiet bedrock; then exit 1; fi
mkdir -p "$root/behavior_packs/stardew" "$root/worlds/$world"
cp -r "$src/pack/." "$root/behavior_packs/stardew/"
python3 - <<'PY'
from pathlib import Path
import json
r=Path('/opt/bedrock');w=r/'worlds/stardew-farm'
h=json.loads((r/'behavior_packs/stardew/manifest.json').read_text())['header']
for base in [r,w]:
    (base/'world_behavior_packs.json').write_text(json.dumps([{'pack_id':h['uuid'],'version':h['version']}]))
    (base/'world_resource_packs.json').write_text('[]')
p=r/'server.properties';lines=p.read_text().splitlines()
updates={'level-name':'stardew-farm','gamemode':'adventure','force-gamemode':'true','difficulty':'peaceful','texturepack-required':'false','level-type':'FLAT','level-seed':'20260912','view-distance':'6','tick-distance':'4'}
for i,line in enumerate(lines):
    key=line.split('=',1)[0]
    if key in updates:lines[i]=key+'='+updates.pop(key)
lines.extend(k+'='+v for k,v in updates.items());p.write_text('\n'.join(lines)+'\n')
PY
chown -R minecraft:minecraft "$root/behavior_packs/stardew" "$root/worlds/$world"
systemctl stop helsinki-reset-watch
started=$(date --iso-8601=seconds)
systemctl start bedrock
for i in {1..90}; do
  if journalctl -u bedrock --since "$started" --no-pager | grep -q VALLEY_READY; then
    "$root/cmd.sh" 'scriptevent valley:smoke'
    sleep 2
    if journalctl -u bedrock --since "$started" --no-pager | grep -q VALLEY_SMOKE_PASS; then
      systemctl disable helsinki-reset-watch
      echo 'VALLEY_DEPLOY_OK'
      exit 0
    fi
    break
  fi
  if journalctl -u bedrock --since "$started" --no-pager | grep -Eq 'VALLEY_(BUILD|LOAD)_ERROR'; then break; fi
  sleep 1
done
echo 'Validation failed; restoring the previously active world.' >&2
"$root/cmd.sh" stop
for i in {1..30}; do if ! systemctl is-active --quiet bedrock; then break; fi; sleep 1; done
if systemctl is-active --quiet bedrock; then exit 2; fi
cp "$src/previous-server.properties" "$root/server.properties"
cp "$src/previous-behavior.json" "$root/world_behavior_packs.json"
cp "$src/previous-resource.json" "$root/world_resource_packs.json"
systemctl start bedrock
if "$watcher_was_active"; then systemctl start helsinki-reset-watch; fi
exit 1
