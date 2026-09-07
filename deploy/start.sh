#!/bin/bash
set -euo pipefail

ROOT=/opt/bedrock
FIFO="$ROOT/console.in"

cd "$ROOT"

if [[ ! -p "$FIFO" ]]; then
  rm -f "$FIFO"
  mkfifo "$FIFO"
fi

# 保持 FIFO 读写打开，避免 stdin 被提前关闭
exec 3<>"$FIFO"
export LD_LIBRARY_PATH=.
exec ./bedrock_server <&3
