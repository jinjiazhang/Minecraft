#!/usr/bin/env bash
# Update to detail v2 in a new region. Preserve the old map and world database.
set -euo pipefail
stage=${1:?staging directory}
[[ "$stage" == /tmp/lintsi-update.* ]] || exit 1
python3 - "$stage" <<'PY'
import pathlib,zipfile,sys,json
p=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(p/'detail.mcaddon') as z:
    assert z.testzip() is None
    for name in z.namelist():assert (p/name).resolve().is_relative_to(p.resolve())
    z.extractall(p)
assert len(list((p/'pack/structures/lintsi').glob('*.mcstructure')))==256
assert json.loads((p/'pack/manifest.json').read_text())['header']['version']==[0,2,0]
PY
root=/opt/bedrock
[[ "$(readlink -f "$root/behavior_packs/linnanmaki")" == "$root/behavior_packs/linnanmaki" ]] || exit 1
[[ "$(readlink -f "$root/worlds/world")" == "$root/worlds/world" ]] || exit 1
backup="$root/backups/lintsi-before-detail-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
"$root/cmd.sh" stop
for i in {1..30}; do
  if ! systemctl is-active --quiet bedrock; then break; fi
  sleep 1
done
if systemctl is-active --quiet bedrock; then echo 'Graceful stop timed out; aborting without replacing files' >&2; exit 1; fi
cp -a "$root/worlds/world" "$backup/world"
cp -a "$root/behavior_packs/linnanmaki" "$backup/pack"
cp "$root/server.properties" "$backup/server.properties"
cp "$root/world_behavior_packs.json" "$backup/root-packs.json"
rollback() {
  mv "$root/behavior_packs/linnanmaki" "$backup/failed-pack"
  cp -a "$backup/pack" "$root/behavior_packs/linnanmaki"
  cp "$backup/server.properties" "$root/server.properties"
  cp "$backup/root-packs.json" "$root/world_behavior_packs.json"
  cp "$backup/world/world_behavior_packs.json" "$root/worlds/world/world_behavior_packs.json"
  if [[ -f "$backup/world/world_resource_packs.json" ]]; then
    cp "$backup/world/world_resource_packs.json" "$root/worlds/world/world_resource_packs.json"
  else printf '[]' > "$root/worlds/world/world_resource_packs.json"; fi
  systemctl start bedrock
}
trap rollback ERR
mkdir -p "$root/resource_packs/linnanmaki"
cp -a "$stage/pack/." "$root/behavior_packs/linnanmaki/"
cp -a "$stage/resource_pack/." "$root/resource_packs/linnanmaki/"
python3 - <<'PY'
from pathlib import Path
import json
r=Path('/opt/bedrock')
for kind,uuid in [('behavior','ce5a572d-9517-446d-9d84-b395d24b0c97'),('resource','80e6b767-badb-47e1-bb10-c5d26066bd62')]:
    data=json.dumps([{'pack_id':uuid,'version':[0,2,0]}])
    (r/f'world_{kind}_packs.json').write_text(data)
    (r/f'worlds/world/world_{kind}_packs.json').write_text(data)
f=r/'server.properties';t=f.read_text().replace('texturepack-required=false','texturepack-required=true')
if 'texturepack-required=' not in t:t+='\ntexturepack-required=true\n'
f.write_text(t)
PY
chown -R minecraft:minecraft "$root/behavior_packs/linnanmaki" "$root/resource_packs/linnanmaki" "$root/worlds/world"
chown minecraft:minecraft "$root/world_behavior_packs.json" "$root/world_resource_packs.json" "$root/server.properties"
systemctl set-property --runtime bedrock.service MemoryMax=1G
systemctl start bedrock
trap - ERR
echo "DETAIL_DEPLOYED backup=$backup"
echo 'Check journal for BUILD_COMPLETE 256/256 and errors before accepting deployment.'
echo 'After generation and graceful restart, restore the normal memory cap with: systemctl set-property --runtime bedrock.service MemoryMax=800M'
