#!/usr/bin/env bash
set -euo pipefail
root=/opt/bedrock
src=/tmp/rainbow-rush-release
world=rainbow-rush
watcher_was_active=false
if systemctl is-active --quiet helsinki-reset-watch; then watcher_was_active=true; fi
[[ -f "$src/pack/manifest.json" ]]
[[ -f "$src/resource_pack/manifest.json" ]]
# Retain the entire Helsinki world and its pack bindings. Switch only active world.
cp "$root/server.properties" "$src/previous-server.properties"
cp "$root/world_behavior_packs.json" "$src/previous-behavior.json"
cp "$root/world_resource_packs.json" "$src/previous-resource.json"
had_pack=false
had_resource=false
if [[ -d "$root/behavior_packs/rainbow-rush" ]]; then
  had_pack=true
  mkdir -p "$src/previous-rainbow-rush-pack"
  cp -r "$root/behavior_packs/rainbow-rush/." "$src/previous-rainbow-rush-pack/"
fi
if [[ -d "$root/resource_packs/rainbow-rush" ]]; then
  had_resource=true
  mkdir -p "$src/previous-rainbow-rush-resource"
  cp -r "$root/resource_packs/rainbow-rush/." "$src/previous-rainbow-rush-resource/"
fi
"$root/cmd.sh" stop
for i in {1..30}; do
  if ! systemctl is-active --quiet bedrock; then break; fi
  sleep 1
done
if systemctl is-active --quiet bedrock; then exit 1; fi
mkdir -p "$root/behavior_packs/rainbow-rush" "$root/resource_packs/rainbow-rush" "$root/worlds/$world"
cp -r "$src/pack/." "$root/behavior_packs/rainbow-rush/"
cp -r "$src/resource_pack/." "$root/resource_packs/rainbow-rush/"
python3 - <<'PY'
from pathlib import Path
import json
r=Path('/opt/bedrock');w=r/'worlds/rainbow-rush'
h=json.loads((r/'behavior_packs/rainbow-rush/manifest.json').read_text())['header']
rp=json.loads((r/'resource_packs/rainbow-rush/manifest.json').read_text())['header']
for base in [r,w]:
    (base/'world_behavior_packs.json').write_text(json.dumps([{'pack_id':h['uuid'],'version':h['version']}]))
    (base/'world_resource_packs.json').write_text(json.dumps([{'pack_id':rp['uuid'],'version':rp['version']}]))
p=r/'server.properties';lines=p.read_text().splitlines()
updates={'level-name':'rainbow-rush','gamemode':'adventure','force-gamemode':'true','difficulty':'normal','texturepack-required':'true','level-type':'FLAT','level-seed':'20260913','view-distance':'6','tick-distance':'4'}
for i,line in enumerate(lines):
    key=line.split('=',1)[0]
    if key in updates:lines[i]=key+'='+updates.pop(key)
lines.extend(k+'='+v for k,v in updates.items());p.write_text('\n'.join(lines)+'\n')
PY
chown -R minecraft:minecraft "$root/behavior_packs/rainbow-rush" "$root/resource_packs/rainbow-rush" "$root/worlds/$world"
systemctl stop helsinki-reset-watch
started=$(date --iso-8601=seconds)
systemctl start bedrock
for i in {1..90}; do
  if journalctl -u bedrock --since "$started" --no-pager | grep -q RUSH_READY; then
    "$root/cmd.sh" 'scriptevent rush:smoke'
    sleep 2
    if journalctl -u bedrock --since "$started" --no-pager | grep -q RUSH_SMOKE_PASS; then
      systemctl disable helsinki-reset-watch
      echo 'RUSH_DEPLOY_OK'
      exit 0
    fi
    break
  fi
  if journalctl -u bedrock --since "$started" --no-pager | grep -Eq 'RUSH_(BUILD|LOAD)_ERROR'; then break; fi
  sleep 1
done
echo 'Validation failed; restoring the previously active world.' >&2
"$root/cmd.sh" stop
for i in {1..30}; do if ! systemctl is-active --quiet bedrock; then break; fi; sleep 1; done
if systemctl is-active --quiet bedrock; then exit 2; fi
cp "$src/previous-server.properties" "$root/server.properties"
cp "$src/previous-behavior.json" "$root/world_behavior_packs.json"
cp "$src/previous-resource.json" "$root/world_resource_packs.json"
if "$had_pack"; then cp -r "$src/previous-rainbow-rush-pack/." "$root/behavior_packs/rainbow-rush/"; fi
if "$had_resource"; then cp -r "$src/previous-rainbow-rush-resource/." "$root/resource_packs/rainbow-rush/"; fi
chown -R minecraft:minecraft "$root/behavior_packs/rainbow-rush" "$root/resource_packs/rainbow-rush"
systemctl start bedrock
if "$watcher_was_active"; then systemctl start helsinki-reset-watch; fi
exit 1
