#!/usr/bin/env python3
"""Agrega linhas 'intent\\ttier' ou texto livre e conta tiers. Sem API."""
import re
import sys
from collections import Counter

def main():
    raw = open(sys.argv[1], encoding="utf-8").read() if len(sys.argv) > 1 else sys.stdin.read()
    tiers = Counter()
    intents = Counter()
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if "\t" in line:
            intent, tier = line.split("\t", 1)
            intents[intent.strip()] += 1
            tiers[tier.strip()] += 1
            continue
        # fallback keywords
        low = line.lower()
        if re.search(r"vencid|ativo|kpi|ranking|carteira", low):
            tiers["zero"] += 1
            intents["kpi_guess"] += 1
        elif re.search(r"linkedin|post|coment", low):
            tiers["slm"] += 1
            intents["gtm_guess"] += 1
        else:
            tiers["unknown"] += 1
    total = sum(tiers.values()) or 1
    print("tiers:")
    for t, n in tiers.most_common():
        print(f"  {t}\t{n}\t{100*n/total:.0f}%")
    print("intents top:")
    for i, n in intents.most_common(10):
        print(f"  {i}\t{n}")
    z = tiers.get("zero", 0) / total
    print(f"meta_zero_ok\t{z >= 0.70}")

if __name__ == "__main__":
    main()
