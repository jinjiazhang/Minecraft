#!/usr/bin/env bash
# Install the verified official Bedrock world without copying the previous save.
set -euo pipefail
root=/opt/bedrock
stage=/tmp/helsinki-official
target="$root/worlds/helsinki-official"
[[ ! -e "$target" ]] || { echo 'Target already exists; refusing to replace it'; exit 1; }
python3 - <<'PY'
from pathlib import Path
import hashlib,json
p=Path('/tmp/helsinki-official')
m=json.loads((p/'source.json').read_text())
h=hashlib.sha256()
with (p/'official.zip').open('rb') as f:
    for b in iter(lambda:f.read(1048576),b''): h.update(b)
assert h.hexdigest()==m['sha256']=='c96f2b73343101c50cc6915ffda28c5d7bce8bb72c610543d0deaf79be657f8c'
assert m['zip_crc_valid']
w=p/'extracted/Helsinki_3D'
assert (w/'level.dat').stat().st_size>8 and (w/'db/CURRENT').is_file()
PY
"$root/cmd.sh" stop
for i in {1..30}; do
  if ! systemctl is-active --quiet bedrock; then break; fi
  sleep 1
done
if systemctl is-active --quiet bedrock; then echo 'Stop timed out'; exit 1; fi
mv "$stage/extracted/Helsinki_3D" "$target"
python3 - <<'PY'
from pathlib import Path
r=Path('/opt/bedrock'); w=r/'worlds/helsinki-official'
f=r/'server.properties'
updates={'level-name':'helsinki-official','texturepack-required':'false','gamemode':'creative','force-gamemode':'true'}
lines=[]
for line in f.read_text().splitlines():
    key=line.split('=',1)[0]
    if key in updates: line=key+'='+updates.pop(key)
    lines.append(line)
lines.extend(k+'='+v for k,v in updates.items())
f.write_text('\n'.join(lines)+'\n')
for base in (r,w):
    for kind in ('behavior','resource'):
        (base/f'world_{kind}_packs.json').write_text('[]\n')
(w/'levelname.txt').write_text('Helsinki3D+ Official\n')
PY
chown -R minecraft:minecraft "$target"
chown minecraft:minecraft "$root/server.properties" "$root/world_behavior_packs.json" "$root/world_resource_packs.json"
systemctl start bedrock
echo 'OFFICIAL_WORLD_STARTED: verify server journal, spawn chunks and UDP before accepting.'
