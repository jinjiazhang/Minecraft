#!/bin/bash
set -euo pipefail

journalctl -u bedrock.service -n 0 -f -o cat | while IFS= read -r line; do
  case "$line" in
    *LODESTONE_WIPE_WORLD*)
      /opt/bedrock/wipe-world.sh
      ;;
  esac
done
