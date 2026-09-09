"use server";

/**
 * Cadastro a partir de:
 * A) texto/PDF de extrato de distribuição (parser determinístico)
 * B) só protocolo → tenta DJEN server-side (pode tomar HTML/WAF; preferir client)
 * C) opcional: Grok só para preencher buracos quando texto é sujo (OCR)
 */

import { parseExtratoDistribuicao, extratoParaCamposCase } from "@/lib/extrato-distribuicao-parse";
import { montarCadastroDeItensDjen } from "@/lib/cadastro-por-protocolo-djen";
import { extractCnjFromText, formatCnj, digitsOnly } from "@/lib/cnj-extract";

export type CadastroInput = {
  /** Texto colado ou extraído do PDF */
  texto?: string;
  /** Só o CNJ — enriquece via DJEN se items forem passados ou fetch server */
  protocolo?: string;
  /** Itens DJEN já buscados no client (recomendado) */
  djenItems?: any[];
  djenMeta?: { ok?: boolean; htmlBlocked?: boolean; error?: string };
  /** Usar Grok só se parser determinístico ficou com confiança baixa */
  usarGrokSeNecessario?: boolean;
};

export async function cadastrarFromExtratoOuProtocoloAction(input: CadastroInput) {
  const texto = String(input.texto || "").trim();
  let protocolo = input.protocolo ? formatCnj(input.protocolo) : null;

  // --- Caminho A: texto/PDF ---
  if (texto.length >= 20) {
    const extrato = parseExtratoDistribuicao(texto);
    if (!protocolo) protocolo = extrato.protocolo;
    const campos = extratoParaCamposCase(extrato);

    // Grok opcional para OCR ruim
    if (
      input.usarGrokSeNecessario &&
      extrato.confianca < 50 &&
      (process.env.XAI_API_KEY || process.env.XAI_DOCUMENTS_API_KEY)
    ) {
      try {
        const enriched = await grokFillGaps(texto, campos);
        return {
          ok: true,
          mode: "pdf_texto+grok" as const,
          confianca: Math.max(extrato.confianca, 60),
          extrato,
          campos: { ...campos, ...enriched },
          aviso: null as string | null,
        };
      } catch {
        /* segue determinístico */
      }
    }

    return {
      ok: !!extrato.protocolo,
      mode: "pdf_texto" as const,
      confianca: extrato.confianca,
      extrato,
      campos,
      aviso: extrato.protocolo
        ? null
        : "CNJ não identificado no texto. Cole o protocolo manualmente.",
    };
  }

  // --- Caminho B: só protocolo + itens DJEN do client ---
  if (protocolo && digitsOnly(protocolo).length === 20) {
    const djen = montarCadastroDeItensDjen(protocolo, input.djenItems || [], input.djenMeta);
    return {
      ok: djen.ok || !!djen.campos.protocolo_ref,
      mode: "protocolo_djen" as const,
      confianca: djen.ok ? 70 : 30,
      extrato: null,
      campos: djen.campos,
      djen,
      aviso: djen.ok
        ? null
        : djen.error ||
          "Sem publicações DJEN ainda. Cadastre o CNJ e complete partes manualmente ou anexe o extrato PDF.",
    };
  }

  // tenta achar CNJ no que veio
  const maybe = extractCnjFromText(texto || String(input.protocolo || ""));
  if (maybe) {
    return cadastrarFromExtratoOuProtocoloAction({
      ...input,
      protocolo: maybe,
      texto: texto.length >= 20 ? texto : "",
    });
  }

  return {
    ok: false,
    mode: "none" as const,
    confianca: 0,
    extrato: null,
    campos: null,
    aviso: "Informe o texto do extrato PDF ou um protocolo CNJ válido (20 dígitos).",
  };
}

async function grokFillGaps(texto: string, base: Record<string, unknown>) {
  const key = process.env.XAI_DOCUMENTS_API_KEY || process.env.XAI_API_KEY;
  if (!key) return {};
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extraia dados de extrato de distribuição judicial. Retorne JSON:
{"protocolo":"","autor":"","reu":"","advogado":"","oab":"","valor_causa":"","orgao_julgador":"","magistrado":"","evento":""}
Não invente. Vazio se ausente.`,
        },
        { role: "user", content: texto.slice(0, 8000) },
      ],
    }),
  });
  if (!res.ok) return {};
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return {};
  const j = JSON.parse(raw);
  return {
    cliente: j.autor || base.cliente || "",
    parte_passiva: j.reu || base.parte_passiva || "",
    advogado: j.advogado || base.advogado || "",
    orgao_julgador: j.orgao_julgador || base.orgao_julgador || "",
    protocolo_ref: j.protocolo || base.protocolo_ref || "",
  };
}
