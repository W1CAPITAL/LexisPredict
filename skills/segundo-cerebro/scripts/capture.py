#!/usr/bin/env python3
"""Append a durable note to the segundo-cerebro vault."""
from __future__ import annotations

import argparse
import datetime as dt
import os
import re
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


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s, flags=re.UNICODE)
    s = re.sub(r"[\s_]+", "-", s)
    return s[:60].strip("-") or "nota"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--title", required=True)
    ap.add_argument("--body", required=True)
    ap.add_argument("--folder", default="notes", choices=["inbox", "notes", "decisions", "projects", "runs", "people", "prompts"])
    ap.add_argument("--tags", default="")
    args = ap.parse_args()
    root = vault_root()
    day = dt.date.today().isoformat()
    slug = slugify(args.title)
    path = root / args.folder / f"{day}-{slug}.md"
    n = 2
    while path.exists():
        path = root / args.folder / f"{day}-{slug}-{n}.md"
        n += 1
    tags = [t.strip() for t in args.tags.split(",") if t.strip()]
    fm = [
        "---",
        f"id: {path.stem}",
        f"title: {args.title}",
        f"date: {day}",
        f"tags: [{', '.join(tags)}]",
        "status: active",
        "---",
        "",
        f"# {args.title}",
        "",
        args.body.strip(),
        "",
    ]
    path.write_text("\n".join(fm), encoding="utf-8")
    print(path)


if __name__ == "__main__":
    main()
