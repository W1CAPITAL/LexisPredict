"use server";

import React from "react";
import { readFile } from "fs/promises";
import path from "path";
import { getUserContext, getStoredCasesForEmpresa } from "@/lib/server-db";
import { scanSingleCaseAction } from "@/app/actions/case-actions";
import { scoreRiscoProcesso } from "@/lib/dossie-cliente-risco";
import { plainTextFromDjen } from "@/lib/djen";

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
    blob.match(/R[EÉ](?:U|QUERID[OA])\s*:\s*([^\n]+)/i) ||
    blob.match(/PARTE\s+R[EÉ]\s*:\s*([^\n]+)/i);
  if (m) return m[0].replace(/\s+/g, " ").trim().slice(0, 80);
  return "";
}

export async function exportClienteDossieAction(protocolo: string) {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false as const, error: "Sessão expirada" };

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
      return { success: false as const, error: "Processo não encontrado na carteira visível" };
    }

    let movimentos: any[] = [];
    let comunicacoes: any[] = [];
    try {
      const scan = await scanSingleCaseAction(cnj, { mode: "both" });
      if (scan && (scan as any).success !== false) {
        movimentos = (scan as any).movimentos || [];
        comunicacoes = (scan as any).comunicacoes || [];
        if ((scan as any).case) Object.assign(target, (scan as any).case);
        if ((scan as any).casePatch) Object.assign(target, (scan as any).casePatch);
      }
    } catch (e: any) {
      console.warn("[dossie] scan parcial:", e?.message);
    }

    const djenTexts = (comunicacoes || []).map((d: any) =>
      plainTextFromDjen?.(d.texto || d.conteudo || "") || String(d.texto || d.conteudo || "")
    );

    const risco = scoreRiscoProcesso(target as any, { movimentos, djenTexts });

    const movNorm = (movimentos || []).map((m: any) => ({
      data: m.dataHora || m.data || m.data_hora || "",
      nome: m.nome || m.descricao || "Movimento",
      complemento: m.complemento || m.complementoTabelado || "",
    }));

    const djenNorm = (comunicacoes || []).map((d: any) => ({
      data: d.data_disponibilizacao || d.data || "",
      tipo: d.tipoComunicacao || d.tipo || "DJEN",
      texto: plainTextFromDjen?.(d.texto || d.conteudo || "") || String(d.texto || d.conteudo || ""),
      link: d.link || d.url || "",
    }));

    // Resumo executivo no estilo do exemplo
    const resumoExec = [
      `O processo de ${target.cliente || "cliente"} (${target.protocolo || cnj}${target.tribunal ? `, ${target.tribunal}` : ""}) encontra-se na fase de ${risco.faseAtual}.`,
      risco.resumo,
      `O índice de risco da carteira é ${risco.score}/100 (${risco.nivel}). ${risco.chanceRuim}`,
      risco.leituraEstrategica,
    ].join(" ");

    const pdfData = {
      logoBase64: await loadLogoBase64(),
      cliente: String(target.cliente || "CLIENTE"),
      protocolo: String(target.protocolo || cnj),
      advogado: target.advogado || "",
      escritorio: target.escritorio || "",
      tribunal: target.tribunal || "",
      status: target.status || (target as any).situacao || "",
      telefone: target.telefone || "",
      observacao: target.observacao || "",
      ultimoRetorno: target.ultimoRetorno || "",
      proximoPrazo: target.proximoPrazo || "",
      parteContraria: guessParteContraria(djenTexts) || "",
      resumoProcesso: resumoExec,
      risco: {
        score: risco.score,
        nivel: risco.nivel,
        chanceRuim: risco.chanceRuim,
        drivers: risco.drivers,
        pontosFortes: risco.pontosFortes,
        pontosAtencao: risco.pontosAtencao,
        planoAcao: risco.planoAcao,
        leituraEstrategica: risco.leituraEstrategica,
        faseAtual: risco.faseAtual,
      },
      movimentos: movNorm,
      djen: djenNorm,
      geradoEm: new Date().toLocaleString("pt-BR"),
    };

    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { DossieClientePDF } = await import("@/components/pdf/dossie-cliente-pdf");
    const element = React.createElement(DossieClientePDF as any, { data: pdfData }) as any;
    const buf = await renderToBuffer(element);
    const base64 = Buffer.from(buf).toString("base64");
    const safeName = String(target.cliente || "cliente")
      .slice(0, 40)
      .replace(/[^\w\s-]/gi, "")
      .trim()
      .replace(/\s+/g, "_");
    const filename = `Dossie_${safeName}_${String(target.protocolo || cnj).replace(/\D/g, "").slice(-8)}.pdf`;

    return {
      success: true as const,
      base64,
      filename,
      mime: "application/pdf",
      risco: risco.nivel,
      score: risco.score,
    };
  } catch (e: any) {
    console.error("[exportClienteDossieAction]", e);
    return { success: false as const, error: e?.message || "Falha ao gerar dossiê" };
  }
}
