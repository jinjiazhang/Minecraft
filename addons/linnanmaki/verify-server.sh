#!/usr/bin/env bash
set -euo pipefail
cmd=/opt/bedrock/cmd.sh
"$cmd" tickingarea add circle 20013 89 20016 1 lintsi_verify_0 true
"$cmd" tickingarea add circle 20240 102 20254 1 lintsi_verify_1 true
"$cmd" tickingarea add circle 20490 89 20485 1 lintsi_verify_2 true
sleep 3
"$cmd" testforblock 20013 89 20016 minecraft:black_concrete
"$cmd" testforblock 20240 102 20254 minecraft:gray_concrete
"$cmd" testforblock 20490 89 20485 minecraft:gray_concrete
"$cmd" testforblock 20200 190 20200 minecraft:glass
"$cmd" testforblock 20013 0 20016 minecraft:air
"$cmd" scriptevent lintsi:status check
sleep 2
"$cmd" tickingarea remove lintsi_verify_0
"$cmd" tickingarea remove lintsi_verify_1
"$cmd" tickingarea remove lintsi_verify_2
sleep 1
journalctl -u bedrock --since '30 seconds ago' --no-pager
# Console command delivery success alone is not a validation pass.
# Inspect journal for five successful tests and STATUS 256/256 running=false.
