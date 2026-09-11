#!/usr/bin/env bash
# Explicitly destructive: user requested removal of the old active world.
set -euo pipefail
stage=${1:?Upload staging directory required}
[[ "$stage" == /tmp/linnanmaki-deploy.* ]] || exit 1
test -f "$stage/bundle.zip"
test -f "$stage/flat-level.dat"
python3 - "$stage" <<'PY'
import sys,zipfile,pathlib
stage=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(stage/'bundle.zip') as z:
    if z.testzip(): raise RuntimeError('Corrupt pack archive')
    for name in z.namelist():
        if not (stage/'pack'/name).resolve().is_relative_to((stage/'pack').resolve()):
            raise RuntimeError('Invalid archive path')
    z.extractall(stage/'pack')
assert (stage/'pack/manifest.json').is_file()
assert len(list((stage/'pack/structures/lintsi').glob('*.mcstructure'))) == 256
PY
target=/opt/bedrock/worlds/world
[[ "$(readlink -f "$target")" == /opt/bedrock/worlds/world ]] || exit 1
[[ ! -L "$target" ]] || exit 1
[[ "$(readlink -f /opt/bedrock/behavior_packs)" == /opt/bedrock/behavior_packs ]] || exit 1
systemctl stop bedrock.service
test "$(systemctl is-active bedrock.service || true)" != active
rm -rf -- /opt/bedrock/worlds/world
mkdir -p /opt/bedrock/worlds/world /opt/bedrock/behavior_packs/linnanmaki
cp -a "$stage/pack/." /opt/bedrock/behavior_packs/linnanmaki/
cp "$stage/flat-level.dat" /opt/bedrock/worlds/world/level.dat
python3 - <<'PY'
import json,pathlib
root=pathlib.Path('/opt/bedrock')
activation=[{'pack_id':'ce5a572d-9517-446d-9d84-b395d24b0c97','version':[0,1,0]}]
for p in [root/'world_behavior_packs.json',root/'worlds/world/world_behavior_packs.json']:
    p.write_text(json.dumps(activation))
properties=root/'server.properties'
lines=properties.read_text().splitlines()
settings={'gamemode':'creative','force-gamemode':'true','difficulty':'peaceful','level-name':'world','level-seed':'20260911','allow-cheats':'true'}
for k,v in settings.items():
    if any(line.startswith(k+'=') for line in lines):
        lines=[k+'='+v if line.startswith(k+'=') else line for line in lines]
    else: lines.append(k+'='+v)
properties.write_text('\n'.join(lines)+'\n')
PY
chown -R minecraft:minecraft /opt/bedrock/worlds/world /opt/bedrock/behavior_packs/linnanmaki
chown minecraft:minecraft /opt/bedrock/world_behavior_packs.json /opt/bedrock/server.properties
systemctl start bedrock.service
echo 'FRESH_WORLD_DEPLOYED'
