#!/bin/bash
set -euo pipefail

FIFO=/opt/bedrock/console.in

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <bedrock command>" >&2
  echo "example: $0 op Steve" >&2
  exit 1
fi

if [[ ! -p "$FIFO" ]]; then
  echo "server console is not ready; is bedrock.service running?" >&2
  exit 1
fi

printf '%s\n' "$*" > "$FIFO"
