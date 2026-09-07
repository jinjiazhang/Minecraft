#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${LODESTONE_HOST:-ubuntu@jinjiazh.com}"

npm --prefix "$ROOT" run build

ssh "$HOST" "rm -rf /tmp/lodestone-pack /tmp/lodestone-world_behavior_packs.json"
scp -r "$ROOT/pack" "$HOST:/tmp/lodestone-pack"
scp "$ROOT/world_behavior_packs.json" "$HOST:/tmp/lodestone-world_behavior_packs.json"

ssh "$HOST" 'set -e
sudo rm -rf /opt/bedrock/behavior_packs/lodestone
sudo cp -a /tmp/lodestone-pack /opt/bedrock/behavior_packs/lodestone
sudo cp /tmp/lodestone-world_behavior_packs.json /opt/bedrock/world_behavior_packs.json
sudo cp /tmp/lodestone-world_behavior_packs.json /opt/bedrock/worlds/world/world_behavior_packs.json
sudo chown -R minecraft:minecraft /opt/bedrock/behavior_packs/lodestone /opt/bedrock/world_behavior_packs.json /opt/bedrock/worlds/world/world_behavior_packs.json
sudo systemctl restart bedrock.service
'
echo "Lodestone deployed. Restarting BDS..."
