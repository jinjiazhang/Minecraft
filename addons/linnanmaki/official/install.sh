#!/usr/bin/env bash
set -euo pipefail
src=/tmp/helsinki-official/admin
root=/opt/bedrock
python3 "$src/test_reset.py"
mkdir -p "$root/official-source" "$root/official-admin"
if [[ ! -f "$root/official-source/Helsinki3D_MC_bedrock.zip" ]]; then
  cp /tmp/helsinki-official/official.zip "$root/official-source/Helsinki3D_MC_bedrock.zip"
fi
echo 'c96f2b73343101c50cc6915ffda28c5d7bce8bb72c610543d0deaf79be657f8c  /opt/bedrock/official-source/Helsinki3D_MC_bedrock.zip' | sha256sum -c -
"$root/cmd.sh" stop
for i in {1..30}; do
  if ! systemctl is-active --quiet bedrock; then break; fi
  sleep 1
done
if systemctl is-active --quiet bedrock; then exit 1; fi
cp "$src/reset_world.py" "$src/watch_reset.py" "$root/official-admin/"
mkdir -p "$root/behavior_packs/helsinki_admin"
cp -r "$src/pack/." "$root/behavior_packs/helsinki_admin/"
python3 - <<'PY'
from pathlib import Path
import json
r=Path('/opt/bedrock')
pack=[{'pack_id':'a4a49c55-b5ef-4d71-a98c-ccbb73b55dc6','version':[1,0,0]}]
for base in (r,r/'worlds/helsinki-official'):
    (base/'world_behavior_packs.json').write_text(json.dumps(pack))
    (base/'world_resource_packs.json').write_text('[]')
PY
chown -R minecraft:minecraft "$root/behavior_packs/helsinki_admin"
chown minecraft:minecraft "$root/worlds/helsinki-official/world_behavior_packs.json" "$root/worlds/helsinki-official/world_resource_packs.json"
cp "$src/helsinki-reset-watch.service" /etc/systemd/system/
systemctl disable --now wipe-watch.service
systemctl daemon-reload
systemctl enable --now helsinki-reset-watch.service
systemctl start bedrock
