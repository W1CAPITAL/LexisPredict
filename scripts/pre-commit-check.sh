#!/usr/bin/env bash
# Rodado pelo Husky no pre-commit. Falha = bloqueia o commit.
set -euo pipefail

echo "→ typecheck…"
npm run typecheck

echo "→ lint…"
npm run lint

echo "✓ pre-commit ok"
