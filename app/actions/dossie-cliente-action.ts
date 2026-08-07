
'use server';

/**
 * Dossiê do cliente — preview editável + PDF (Claude/OmniRoute + local).
 */
import React from "react";
import { readFile } from "fs/promises";
import path from "path";
import { getUserContext, getStoredCasesForEmpresa } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { scoreRiscoProcesso } from "@/lib/dossie-cliente-risco";
import { plainTextFromDjen } from "@/lib/djen";
import type { DossieClientePdfData } from "@/components/pdf/dossie-cliente-pdf";

async function loadLogoBase64(): Promise<string | null> {
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "logo.png"));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function guessParteContraria(texts: string[]): string {
  const blob = texts.join(" ");
  const m =
    blob.match(/BANCO\s+([A-ZÁÉÍÓÚÃÕÂÊÔÇ][A-ZÁÉÍÓÚÃÕÂÊÔÇ\s\.]+?)(?:\s+S\.?A\.?|\s+S\/A)/i) ||
    blob.match(/R[EÉ](?:U|QUERID[OA])\s*:\s*([^\n]+)/i);
  if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 80);
  return "";
}

/** Todos os campos do PDF — editáveis no modal antes de gerar */
export type DossieEditableFields = {
  cliente?: string;
  protocolo?: string;
  advogado?: string;
  escritorio?: string;
  tribunal?: string;
  status?: string;
  telefone?: string;
  observacao?: string;
  ultimoRetorno?: string;
  proximoPrazo?: string;
  parteContraria?: string;
  resumoProcesso?: string;
  faseAtual?: string;
  score?: number;
  nivel?: string;
  chanceRuim?: string;
  pontosFortes?: string; // linhas
  pontosAtencao?: string;
  planoAcao?: string;
  leituraEstrategica?: string;
};

type Options = {
  previewOnly?: boolean;
  useClaude?: boolean;
  preferredMotor?: string;
  edited?: DossieEditableFields;
};


async function enrichWithClaude(bruto: string, preferredMotor?: string): Promise<Partial<DossieEditableFields> | null> {
  try {
    // Prefer superfície oficial dossiê (OmniRoute/Claude)
    try {
      const { runClaudeSurface } = await import("@/lib/ai/claude-surfaces");
      const surf = await runClaudeSurface({
        surface: "dossie",
        content: bruto.slice(0, 12000),
        enabled: true,
        preferred: preferredMotor === "local_only" ? "auto" : (preferredMotor || "claude"),
        maxTokens: 4096,
        extraSystem: `Além do resumo, se possível ao final inclua um bloco JSON com:
{"resumoProcesso":"...","faseAtual":"...","score":0,"nivel":"...","chanceRuim":"...","pontosFortes":[],"pontosAtencao":[],"planoAcao":[],"leituraEstrategica":"...","parteContraria":""}`,
      });
      if (surf?.text) {
        const text = surf.text;
        let clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const a = clean.indexOf("{");
        const b = clean.lastIndexOf("}");
        if (a >= 0 && b > a) {
          try {
            const parsed = JSON.parse(clean.slice(a, b + 1));
            return {
              resumoProcesso: parsed.resumoProcesso || text.slice(0, 1200),
              faseAtual: parsed.faseAtual,
              score: parsed.score,
              nivel: parsed.nivel,
              chanceRuim: parsed.chanceRuim,
              pontosFortes: Array.isArray(parsed.pontosFortes)
                ? parsed.pontosFortes.join("\n")
                : parsed.pontosFortes,
              pontosAtencao: Array.isArray(parsed.pontosAtencao)
                ? parsed.pontosAtencao.join("\n")
                : parsed.pontosAtencao,
              planoAcao: Array.isArray(parsed.planoAcao)
                ? parsed.planoAcao.join("\n")
                : parsed.planoAcao,
              leituraEstrategica: parsed.leituraEstrategica,
              parteContraria: parsed.parteContraria,
            };
          } catch {
            return { resumoProcesso: text.slice(0, 2000), leituraEstrategica: text.slice(0, 800) };
          }
        }
        return { resumoProcesso: text.slice(0, 2000), leituraEstrategica: text.slice(0, 800) };
      }
    } catch (e: any) {
      console.warn("[dossie] surface:", e?.message);
    }

    // Fallback: runCascade direto
    const { runCascade } = await import("@/lib/ai/cascade");
    const system = `Você é o motor de dossiê operacional LexisPredict.
Responda APENAS JSON válido com:
resumoProcesso, faseAtual, score (0-100), nivel, chanceRuim,
pontosFortes[], pontosAtencao[], planoAcao[], leituraEstrategica, parteContraria.
Não invente CNJ/nomes/datas ausentes.`;
    const r = await runCascade({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `Dados brutos do caso:

${bruto.slice(0, 12000)}` },
      ],
      preferred: preferredMotor === "local_only" ? "auto" : (preferredMotor || "claude"),
      temperature: 0.2,
      max_tokens: 4096,
    });
    const text = (r as any)?.text || "";
    if (!text) {
      console.error("[dossie-claude]", (r as any)?.error || "sem texto");
      return null;
    }
    let clean = String(text).replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = clean.indexOf("{");
    const b = clean.lastIndexOf("}");
    if (a < 0 || b <= a) {
      return { resumoProcesso: text.slice(0, 2000) };
    }
    const parsed = JSON.parse(clean.slice(a, b + 1));
    return {
      resumoProcesso: parsed.resumoProcesso,
      faseAtual: parsed.faseAtual,
      score: parsed.score,
      nivel: parsed.nivel,
      chanceRuim: parsed.chanceRuim,
      pontosFortes: Array.isArray(parsed.pontosFortes)
        ? parsed.pontosFortes.join("\n")
        : parsed.pontosFortes,
      pontosAtencao: Array.isArray(parsed.pontosAtencao)
        ? parsed.pontosAtencao.join("\n")
        : parsed.pontosAtencao,
      planoAcao: Array.isArray(parsed.planoAcao)
        ? parsed.planoAcao.join("\n")
        : parsed.planoAcao,
      leituraEstrategica: parsed.leituraEstrategica,
      parteContraria: parsed.parteContraria,
    };
  } catch (e: any) {
    console.error("[dossie-claude]", e?.message);
    return null;
  }
}


function linesToArr(s?: string): string[] {
  if (!s) return [];
  return s
    .split("\n")
    .map((l) => l.replace(/^•\s*/, "").trim())
    .filter(Boolean);
}

export async function exportClienteDossieAction(
  protocolo: string,
  options?: Options
) {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) {
      return { success: false as const, error: "Sessão expirada" };
    }

    const cnj = String(protocolo || "").trim();
    if (!cnj) return { success: false as const, error: "Protocolo inválido" };

    const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
    const target =
      (cases || []).find(
        (c: any) =>
          String(c.protocolo || "").replace(/\D/g, "") === cnj.replace(/\D/g, "") ||
          String(c.protocolo || "") === cnj
      ) || null;

    if (!target) {
      return {
        success: false as const,
        error: "Processo não encontrado na carteira visível",
      };
    }

    let movimentos: any[] = [];
    let comunicacoes: any[] = [];
    try {
      const scan = await scanSingleCaseAction(cnj, { mode: "both" } as any);
      if (scan && (scan as any).success !== false) {
        movimentos = (scan as any).movimentos || [];
        comunicacoes = (scan as any).comunicacoes || [];
        if ((scan as any).case) Object.assign(target, (scan as any).case);
        if ((scan as any).casePatch) Object.assign(target, (scan as any).casePatch);
      }
    } catch (e: any) {
      console.warn("[dossie] scan parcial:", e?.message);
    }

    const djenTexts = (comunicacoes || []).map(
      (d: any) =>
        plainTextFromDjen?.(d.texto || d.conteudo || "") ||
        String(d.texto || d.conteudo || "")
    );

    const risco = scoreRiscoProcesso(target as any, { movimentos, djenTexts });
    const parteGuess = guessParteContraria([
      ...djenTexts,
      String(target.observacao || ""),
    ]);

    const resumoLocal = [
      `O processo de ${target.cliente || "cliente"} (${target.protocolo || cnj}${
        target.tribunal ? `, ${target.tribunal}` : ""
      }) encontra-se na fase de ${risco.faseAtual}.`,
      risco.resumo,
      `O índice de risco da carteira é ${risco.score}/100 (${risco.nivel}). ${risco.chanceRuim}`,
      risco.leituraEstrategica,
    ]
      .filter(Boolean)
      .join(" ");

    // Claude / OmniRoute: obrigatório no preview; PDF final usa campos já editados
    let claudePart: Partial<DossieEditableFields> | null = null;
    let claudeError: string | null = null;
    const wantClaude = options?.previewOnly === true || options?.useClaude === true;
    if (wantClaude) {
      const bruto = [
        `Cliente: ${target.cliente}`,
        `Protocolo: ${target.protocolo}`,
        `Status: ${target.status}`,
        `Advogado: ${target.advogado}`,
        `Tribunal: ${target.tribunal || ""}`,
        `Prazo: ${target.proximoPrazo || ""}`,
        `Último retorno: ${target.ultimoRetorno || ""}`,
        `Obs: ${target.observacao || ""}`,
        `Risco local: ${risco.score} ${risco.nivel} fase ${risco.faseAtual}`,
        `Movimentos: ${JSON.stringify(movimentos.slice(0, 15))}`,
        `DJEN: ${djenTexts.slice(0, 3).join(" | ").slice(0, 2000)}`,
      ].join("\n");
      const pref = options?.preferredMotor === "local_only" ? "claude" : (options?.preferredMotor || "claude");
      claudePart = await enrichWithClaude(bruto, pref);
      if (!claudePart) {
        claudeError = "Claude indisponível. Configure Anthropic no painel OmniRoute (Providers) ou verifique OMNIROUTE_BASE_URL. Preview preenchido com score local.";
      }
    }

    const basePreview: DossieEditableFields = {
      cliente: target.cliente || "",
      protocolo: String(target.protocolo || cnj),
      advogado: target.advogado || "",
      escritorio: target.escritorio || "",
      tribunal: target.tribunal || "",
      status: String(target.status || ""),
      telefone: target.telefone || "",
      observacao: target.observacao || "",
      ultimoRetorno: target.ultimoRetorno || "",
      proximoPrazo: target.proximoPrazo || "",
      parteContraria: claudePart?.parteContraria || parteGuess || "",
      resumoProcesso: claudePart?.resumoProcesso || resumoLocal,
      faseAtual: claudePart?.faseAtual || risco.faseAtual,
      score: claudePart?.score ?? risco.score,
      nivel: claudePart?.nivel || risco.nivel,
      chanceRuim: claudePart?.chanceRuim || risco.chanceRuim,
      pontosFortes:
        claudePart?.pontosFortes ||
        (risco.pontosFortes || []).join("\n"),
      pontosAtencao:
        claudePart?.pontosAtencao ||
        (risco.pontosAtencao || []).join("\n"),
      planoAcao:
        claudePart?.planoAcao || (risco.planoAcao || []).join("\n"),
      leituraEstrategica:
        claudePart?.leituraEstrategica || risco.leituraEstrategica || "",
    };

    if (claudeError) {
      basePreview.leituraEstrategica = [
        claudeError,
        basePreview.leituraEstrategica || "",
      ].filter(Boolean).join("\n\n");
      if (!basePreview.resumoProcesso) {
        basePreview.resumoProcesso = resumoLocal;
      }
    }

    if (options?.previewOnly) {
      return {
        success: true as const,
        preview: basePreview,
        engine: claudePart ? "Claude AI (OmniRoute)+local" : (claudeError ? "local (Claude falhou)" : "local"),
        claudeError,
        movimentosCount: movimentos.length,
        djenCount: comunicacoes.length,
      };
    }

    const ed = { ...basePreview, ...(options?.edited || {}) };

    const movNorm = (movimentos || []).slice(0, 40).map((m: any) => ({
      data: m.dataHora || m.data || m.data_disponibilizacao || "",
      nome: m.nome || m.movimento || "",
      complemento: m.complemento || m.descricao || "",
    }));

    const djenNorm = (comunicacoes || []).slice(0, 10).map((d: any) => ({
      data: d.data_disponibilizacao || d.data || "",
      tipo: d.tipoComunicacao || d.tipo || "",
      texto: plainTextFromDjen?.(d.texto || "") || String(d.texto || ""),
      link: d.link || "",
    }));

    const logoBase64 = await loadLogoBase64();

    const pdfData: DossieClientePdfData = {
      logoBase64,
      cliente: ed.cliente || "Cliente",
      protocolo: ed.protocolo || cnj,
      advogado: ed.advogado,
      escritorio: ed.escritorio,
      tribunal: ed.tribunal,
      status: ed.status,
      telefone: ed.telefone,
      observacao: ed.observacao,
      ultimoRetorno: ed.ultimoRetorno,
      proximoPrazo: ed.proximoPrazo,
      parteContraria: ed.parteContraria,
      resumoProcesso: ed.resumoProcesso || resumoLocal,
      risco: {
        score: Number(ed.score ?? risco.score) || 0,
        nivel: ed.nivel || risco.nivel,
        chanceRuim: ed.chanceRuim || risco.chanceRuim,
        drivers: risco.drivers || [],
        pontosFortes: linesToArr(ed.pontosFortes),
        pontosAtencao: linesToArr(ed.pontosAtencao),
        planoAcao: linesToArr(ed.planoAcao),
        leituraEstrategica: ed.leituraEstrategica || "",
        faseAtual: ed.faseAtual || risco.faseAtual,
      },
      movimentos: movNorm,
      djen: djenNorm,
      geradoEm: new Date().toLocaleString("pt-BR"),
    };

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { DossieClientePDF } = await import("@/components/pdf/dossie-cliente-pdf");
    const element = React.createElement(DossieClientePDF as any, {
      data: pdfData,
    }) as any;
    const buf = await renderToBuffer(element);
    const base64 = Buffer.from(buf).toString("base64");

    const safeName = String(ed.cliente || "cliente")
      .slice(0, 40)
      .replace(/[^\w\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "_");

    const filename = `Dossie_${safeName}_${String(ed.protocolo || cnj)
      .replace(/\D/g, "")
      .slice(-8)}.pdf`;

    return {
      success: true as const,
      base64,
      filename,
      mime: "application/pdf",
      risco: ed.nivel,
      score: ed.score,
    };
  } catch (e: any) {
    console.error("[exportClienteDossieAction]", e);
    return {
      success: false as const,
      error: e?.message || "Falha ao gerar dossiê",
    };
  }
}