#!/usr/bin/env python3
"""Classificador local barato — sem API. Exit 0 imprime intent e tier."""
import re
import sys

ZERO = [
    (r"\b(kpi|ativos|vencidos|atendidos|ranking|carteira|meus processos)\b", "kpi_or_list"),
    (r"\b(salvar|atendimento|registrar retorno|proximo retorno)\b", "case_save"),
    (r"\b(export|csv|planilha export)\b", "export_csv"),
    (r"\b(login|entrar|autentic)\b", "auth"),
    (r"\b(watermark|marca\s*d['\u2019]?[aá]gua|remover\s*marca)\b", "watermark_strip_local"),
]
SLM = [
    (r"\b(linkedin|post|coment[aá]rio|divulg)\b", "gtm_copy"),
    (r"\b(e-?mail|rascunho|mensagem ao cliente)\b", "draft_text"),
    (r"\b(resum|triagem|classific)\b", "summarize"),
]
LLM = [
    (r"\b(arquitetur|multi-?tenant|RLS|debug|regress[aã]o)\b", "architecture"),
    (r"\b(objec[cç][aã]o|proposta comercial|negoci)\b", "sales_complex"),
]


def classify(text: str) -> tuple[str, str]:
    t = text.lower()
    for pat, intent in ZERO:
        if re.search(pat, t, re.I):
            return intent, "zero"
    for pat, intent in SLM:
        if re.search(pat, t, re.I):
            return intent, "slm"
    for pat, intent in LLM:
        if re.search(pat, t, re.I):
            return intent, "llm"
    return "unknown", "slm"  # default barato, nao frontier


if __name__ == "__main__":
    q = " ".join(sys.argv[1:]) or sys.stdin.read()
    intent, tier = classify(q)
    print(f"{intent}\t{tier}")
