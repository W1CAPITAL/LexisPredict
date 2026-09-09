/**
 * LexisPredict · Autoaprimoramento (Ornith) — helpers puros, sem I/O.
 * Consumido por cycle.mjs e pelos testes vitest (src/lib/selfimprove-lib.test.ts).
 */

/** Remove blocos <think>…</think> que modelos de raciocínio (Ornith) emitem. */
export function stripThinking(text) {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^<think>[\s\S]*$/i, "") // <think> sem fechamento: descarta tudo
    .trim();
}

/** Extrai o primeiro objeto JSON balanceado do texto (ignora fences ```json). */
export function extractFirstJsonObject(text) {
  const clean = String(text || "").replace(/```(?:json)?/gi, "");
  const start = clean.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(clean.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

const PRIORIDADES = new Set(["P0", "P1", "P2", "P3"]);

function clampStr(v, max) {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Normaliza/valida a proposta retornada pelo modelo — nunca lança. */
export function parseProposal(rawText) {
  const body = stripThinking(rawText);
  const obj = extractFirstJsonObject(body);
  if (!obj || typeof obj !== "object") {
    return { ok: false, motivo: "resposta sem JSON válido", bruto: clampStr(body, 4000) };
  }
  const propostas = Array.isArray(obj.propostas) ? obj.propostas : [];
  const norm = propostas
    .filter((p) => p && typeof p === "object")
    .map((p, i) => ({
      id: i + 1,
      titulo: clampStr(p.titulo || p.title || "Sem título", 200),
      prioridade: PRIORIDADES.has(String(p.prioridade)) ? String(p.prioridade) : "P2",
      arquivos: Array.isArray(p.arquivos) ? p.arquivos.map((a) => clampStr(a, 200)).slice(0, 12) : [],
      descricao: clampStr(p.descricao || "", 2000),
      risco: clampStr(p.risco || "baixo", 300),
      patch: typeof p.patch_unified_diff === "string" && p.patch_unified_diff.includes("@@") ? p.patch_unified_diff : null,
    }));
  return {
    ok: true,
    resumo: clampStr(obj.resumo || "", 1200),
    diagnostico: Array.isArray(obj.diagnostico) ? obj.diagnostico.map((d) => clampStr(d, 500)).slice(0, 15) : [],
    propostas: norm,
    proximosPassos: Array.isArray(obj.proximos_passos)
      ? obj.proximos_passos.map((d) => clampStr(d, 500)).slice(0, 12)
      : [],
  };
}

/** Concatena os patches das propostas num diff unificado aplicável com `git apply`. */
export function buildLotePatch(propostas) {
  const partes = (propostas || []).filter((p) => p && p.patch);
  if (!partes.length) return null;
  const cabecalho = `# Lote gerado pelo ciclo de autoaprimoramento (Ornith)\n# Aplicar com: node scripts/selfimprove/apply.mjs <este-arquivo>\n`;
  return `${cabecalho}\n${partes.map((p) => `# ── Proposta ${p.id}: ${p.titulo}\n${p.patch.trim()}\n`).join("\n")}`;
}

/** ID curto do ciclo: 20260909-1724 (ordenável, legível no log). */
export function cicloId(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}`;
}

/**
 * Normaliza um drop da inbox (exportado pelo browser) para o formato de sinal.
 * Sanitiza: sem query strings, mensagens cortadas, sem valores de storage.
 */
export function normalizeInboxDrop(drop) {
  if (!drop || drop.tipo !== "lexis-selfimprove-inbox" || !Array.isArray(drop.eventos)) return null;
  const eventos = drop.eventos.slice(0, 100).map((e) => ({
    tipo: clampStr(e?.tipo || "erro", 40),
    rota: clampStr(String(e?.rota || "/").split("?")[0], 160),
    mensagem: clampStr(e?.mensagem || "", 400),
    quando: clampStr(e?.quando || "", 40),
    count: Number(e?.count) || 1,
  }));
  return { origem: "inbox-browser", appVersion: clampStr(drop.versaoApp || "", 40), eventos };
}
