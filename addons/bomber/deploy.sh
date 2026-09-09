#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOST="${BOMBER_HOST:-ubuntu@jinjiazh.com}"
npm --prefix "$ROOT" run build
npm --prefix "$ROOT" test
STAGE=$(ssh "$HOST" 'mktemp -d /tmp/bomber-deploy.XXXXXX')
scp -r "$ROOT/pack" "$HOST:$STAGE/pack"
scp "$ROOT/world_behavior_packs.json" "$HOST:$STAGE/world_behavior_packs.json"
ssh "$HOST" bash -s -- "$STAGE" <<'REMOTE'
set -euo pipefail
stage=$1
backup_dir=/opt/bedrock/backups/bomber-standalone-$(date +%Y%m%d-%H%M%S)
sudo mkdir -p "$backup_dir"
sudo cp /opt/bedrock/world_behavior_packs.json "$backup_dir/root-packs.json"
sudo cp /opt/bedrock/worlds/world/world_behavior_packs.json "$backup_dir/world-packs.json"
if sudo test -d /opt/bedrock/behavior_packs/bomber; then
  sudo cp -a /opt/bedrock/behavior_packs/bomber "$backup_dir/previous-bomber"
fi
rollback() {
  echo "Deploy failed; restoring previous activation." >&2
  sudo rm -rf /opt/bedrock/behavior_packs/bomber
  if sudo test -d "$backup_dir/previous-bomber"; then sudo cp -a "$backup_dir/previous-bomber" /opt/bedrock/behavior_packs/bomber; fi
  sudo cp "$backup_dir/root-packs.json" /opt/bedrock/world_behavior_packs.json
  sudo cp "$backup_dir/world-packs.json" /opt/bedrock/worlds/world/world_behavior_packs.json
  sudo systemctl restart bedrock.service
}
trap rollback ERR
sudo systemctl stop bedrock.service
sudo rm -rf /opt/bedrock/behavior_packs/bomber
sudo cp -a "$stage/pack" /opt/bedrock/behavior_packs/bomber
sudo cp "$stage/world_behavior_packs.json" /opt/bedrock/world_behavior_packs.json
sudo cp "$stage/world_behavior_packs.json" /opt/bedrock/worlds/world/world_behavior_packs.json
sudo chown -R minecraft:minecraft /opt/bedrock/behavior_packs/bomber /opt/bedrock/world_behavior_packs.json /opt/bedrock/worlds/world/world_behavior_packs.json
sudo systemctl start bedrock.service
trap - ERR
rm -rf "$stage"
echo "Standalone Bomber deployed. Activation backup: $backup_dir"
REMOTE
