#!/usr/bin/env bash
set -euo pipefail
CANDIDATES=(
  "${SEGUNDO_CEREBRO_PATH:-}"
  "${HOME}/documentos/segundo cerebro"
  "${HOME}/Documentos/segundo cerebro"
  "${HOME}/documentos/segundo-cerebro"
  "${HOME}/Documentos/segundo-cerebro"
  "/home/workdir/documentos/segundo cerebro"
  "/home/workdir/documentos/segundo-cerebro"
)
for p in "${CANDIDATES[@]}"; do
  [[ -z "$p" ]] && continue
  mkdir -p "$p"/inbox "$p"/notes "$p"/decisions "$p"/projects "$p"/runs "$p"/people "$p"/prompts
  echo "$p"
  exit 0
done
echo "[ERROR] vault path" >&2
exit 1
