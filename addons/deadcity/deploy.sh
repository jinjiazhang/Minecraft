#!/usr/bin/env bash
set -euo pipefail
src=/tmp/deadcity-release
root=/opt/bedrock
[[ -f "$src/pack/manifest.json" && -f "$src/resource_pack/manifest.json" ]] || exit 1
# No world database is copied, replaced or cleared during this update.
"$root/cmd.sh" stop
for i in {1..30}; do
  if ! systemctl is-active --quiet bedrock; then break; fi
  sleep 1
done
if systemctl is-active --quiet bedrock; then exit 1; fi
mkdir -p "$root/behavior_packs/deadcity" "$root/resource_packs/deadcity"
cp -r "$src/pack/." "$root/behavior_packs/deadcity/"
cp -r "$src/resource_pack/." "$root/resource_packs/deadcity/"
cp "$src/admin-main.js" "$root/behavior_packs/helsinki_admin/scripts/main.js"
cp "$src/reset_world.py" "$root/official-admin/reset_world.py"
cp "$src/watch_reset.py" "$root/official-admin/watch_reset.py"
python3 - <<'PY'
from pathlib import Path
import json
r=Path('/opt/bedrock')
(r/'behavior_packs/helsinki_admin/scripts/gameplay.js').write_text('export const gameplayEnabled = true;\n')
packs={'behavior':[{'pack_id':'a4a49c55-b5ef-4d71-a98c-ccbb73b55dc6','version':[1,0,0]},{'pack_id':'67bd555b-4036-40bc-b0ac-d44c3dd5d197','version':[1,0,0]}],'resource':[{'pack_id':'35b4b949-a51c-4fa8-a6f3-bf43366f2875','version':[1,0,0]}]}
for kind,data in packs.items():
    for base in (r,r/'worlds/helsinki-official'):(base/f'world_{kind}_packs.json').write_text(json.dumps(data))
(r/'official-admin/game-packs.json').write_text(json.dumps(packs))
f=r/'server.properties';lines=f.read_text().splitlines();updates={'gamemode':'adventure','force-gamemode':'true','difficulty':'normal','texturepack-required':'true'}
for i,line in enumerate(lines):
    key=line.split('=',1)[0]
    if key in updates:lines[i]=key+'='+updates.pop(key)
lines.extend(k+'='+v for k,v in updates.items());f.write_text('\n'.join(lines)+'\n')
PY
chown -R minecraft:minecraft "$root/behavior_packs/deadcity" "$root/resource_packs/deadcity" "$root/behavior_packs/helsinki_admin"
chown minecraft:minecraft "$root/worlds/helsinki-official/world_behavior_packs.json" "$root/worlds/helsinki-official/world_resource_packs.json"
systemctl start bedrock
systemctl restart helsinki-reset-watch
echo 'Wait for DEADCITY_READY points=7 and run scriptevent dead:smoke before accepting release.'
