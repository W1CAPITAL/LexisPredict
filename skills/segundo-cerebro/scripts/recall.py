#!/usr/bin/env python3
"""Search the segundo-cerebro vault for notes related to a query."""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path


def vault_root() -> Path:
    env = os.environ.get("SEGUNDO_CEREBRO_PATH")
    candidates = [
        Path(env) if env else None,
        Path.home() / "documentos" / "segundo cerebro",
        Path.home() / "Documentos" / "segundo cerebro",
        Path.home() / "documentos" / "segundo-cerebro",
        Path.home() / "Documentos" / "segundo-cerebro",
        Path("/home/workdir/documentos/segundo cerebro"),
        Path("/home/workdir/documentos/segundo-cerebro"),
    ]
    for c in candidates:
        if c is None:
            continue
        c.mkdir(parents=True, exist_ok=True)
        for sub in ("inbox", "notes", "decisions", "projects", "runs", "people", "prompts"):
            (c / sub).mkdir(exist_ok=True)
        return c
    raise SystemExit("vault path not found")


def tokenize(s: str) -> set[str]:
    return {t for t in re.split(r"[^\w]+", s.lower()) if len(t) >= 3}


def score(text: str, query_tokens: set[str]) -> int:
    words = tokenize(text)
    return sum(3 if t in words else 0 for t in query_tokens)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", required=True)
    ap.add_argument("--limit", type=int, default=8)
    args = ap.parse_args()
    root = vault_root()
    q = tokenize(args.query)
    hits: list[tuple[int, Path]] = []
    for p in root.rglob("*.md"):
        try:
            body = p.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        s = score(p.name + "\n" + body, q)
        if s > 0:
            hits.append((s, p))
    hits.sort(key=lambda x: (-x[0], str(x[1])))
    print(f"VAULT {root}")
    if not hits:
        print("NO_HITS")
        print("Action: create inbox note before starting the task.")
        sys.exit(0)
    for s, p in hits[: args.limit]:
        rel = p.relative_to(root)
        lines=p.read_text(encoding="utf-8", errors="ignore").splitlines()
        body=lines
        if lines and lines[0].strip()=="---":
            cut=1
            while cut < len(lines) and lines[cut].strip()!="---":
                cut += 1
            body=lines[cut+1:]
        first = next((ln.strip("# ").strip() for ln in body if ln.strip()), p.stem)
        print(f"{s:3d}  {rel}  |  {first[:80]}")


if __name__ == "__main__":
    main()
