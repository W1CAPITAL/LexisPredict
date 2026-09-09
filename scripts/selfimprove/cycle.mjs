/**
 * Ciclo completo de autoaprimoramento — app TODO, sem API:
 *   1. coleta sinais locais (typecheck, testes, TODOs, inbox do navegador)
 *   2. envia ao Ornith local (Ollama/llama.cpp) com o scaffold do repo
 *   3. valida e grava relatório + lote de patch em reports/selfimprove/
 * Uso: node scripts/selfimprove/cycle.mjs [--sem-testes]
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { coletarSinais, sinalParaTexto } from "./collect.mjs";
import { ornithChat, ornithConfigFromEnv } from "./ornith-client.mjs";
import { parseProposal, buildLotePatch } from "./lib.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const REPORTS = path.join(RAIZ, "reports", "selfimprove");

const SISTEMA = `Você é o agente de autoaprimoramento do LexisPredict (Next.js 15 + React 19 + Supabase + Tailwind, app jurídico).
Recebe sinais reais do app (erros de build, testes falhando, erros de runtime reportados por usuários, TODOs) e o mapa do repositório.
Responda APENAS com um objeto JSON válido, sem texto fora dele, neste formato:

{
  "resumo": "até 3 frases sobre o estado geral",
  "diagnostico": ["causas prováveis e evidências, curtas"],
  "propostas": [
    {
      "titulo": "melhoria concreta e pequena",
      "prioridade": "P0|P1|P2|P3",
      "arquivos": ["caminho/relativo.ts"],
      "descricao": "o que mudar e por quê, 2-6 frases",
      "risco": "o que pode quebrar",
      "patch_unified_diff": "diff unificado aplicável com git apply (opcional; inclua cabeçalhos --- a/... +++ b/... e hunks @@)"
    }
  ],
  "proximos_passos": ["até 6 passos ordenados"]
}

Regras: priorize P0 (erros de build/testes) antes de refatorações; no máximo 5 propostas;
patches devem ser mínimos e aplicáveis; nunca invente arquivos que não existem na lista; escreva em português.`;

function mapaDoRepo() {
  const alvo = path.join(RAIZ, "src");
  const dirs = new Map();
  const pular = new Set(["node_modules", ".next", ".git"]);
  const stack = [alvo];
  while (stack.length) {
    const dir = stack.pop();
    for (const nome of fs.readdirSync(dir)) {
      const full = path.join(dir, nome);
      let st;
      try {
        st = fs.statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!pular.has(nome)) stack.push(full);
        continue;
      }
      if (!/\.(ts|tsx)$/.test(nome)) continue;
      const rel = path.relative(RAIZ, full).replace(/\\/g, "/");
      const chave = rel.split("/").slice(0, -1).join("/") || "src";
      dirs.set(chave, (dirs.get(chave) || 0) + 1);
    }
  }
  return [...dirs.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([d, n]) => `${d}/ (${n} arquivos)`)
    .join("\n");
}

export async function rodarCiclo({ semTestes = false } = {}) {
  const sinais = await coletarSinais();
  if (semTestes) sinais.saude.testesOk = true, (sinais.saude.falhasTeste = []);

  const config = ornithConfigFromEnv();
  const user = `${sinalParaTexto(sinais)}

## Mapa do repositório (pastas com mais arquivos)
${mapaDoRepo()}

Analise e responda só com o JSON.`;

  const resp = await ornithChat(config, {
    system: SISTEMA,
    user,
    maxTokens: 8192,
  });

  const resultado = {
    ciclo: sinais.ciclo,
    quando: sinais.quando,
    modelo: config.model,
    endpoint: config.baseUrl,
    sinais,
    ornithOk: false,
    erroOrnith: null,
    analise: null,
    patchLote: null,
  };

  if (!resp.ok) {
    resultado.erroOrnith = resp.erro;
  } else {
    const parsed = parseProposal(resp.conteudo);
    if (!parsed.ok) {
      resultado.erroOrnith = `Resposta inválida: ${parsed.motivo}`;
    } else {
      resultado.ornithOk = true;
      resultado.analise = parsed;
      const lote = buildLotePatch(parsed.propostas);
      if (lote) resultado.patchLote = lote;
    }
  }

  // Persistência: relatório legível + JSON bruto + lote de patch.
  fs.mkdirSync(REPORTS, { recursive: true });
  fs.writeFileSync(path.join(REPORTS, `cycle-${resultado.ciclo}.json`), JSON.stringify(resultado, null, 2));

  const linhas = [`# Autoaprimoramento LexisPredict — ciclo ${resultado.ciclo}`, ""];
  linhas.push(`Modelo: ${resultado.modelo} · Endpoint: ${resultado.endpoint}`);
  if (resultado.ornithOk) {
    linhas.push("", "## Resumo", resultado.analise.resumo, "", "## Diagnóstico");
    for (const d of resultado.analise.diagnostico) linhas.push(`- ${d}`);
    linhas.push("", "## Propostas");
    for (const p of resultado.analise.propostas) {
      linhas.push(`\n### [${p.prioridade}] ${p.titulo}`);
      linhas.push(`Arquivos: ${p.arquivos.join(", ") || "—"} · Risco: ${p.risco}`);
      linhas.push(p.descricao);
    }
    if (resultado.analise.proximosPassos.length) {
      linhas.push("", "## Próximos passos");
      for (const s of resultado.analise.proximosPassos) linhas.push(`1. ${s}`);
    }
  } else {
    linhas.push("", `## Ornith falhou`, resultado.erroOrnith);
    linhas.push("Sinais coletados de qualquer forma — rode de novo com o modelo no ar.");
  }
  fs.writeFileSync(path.join(REPORTS, `cycle-${resultado.ciclo}.md`), linhas.join("\n"));

  if (resultado.patchLote) {
    fs.writeFileSync(path.join(REPORTS, `patch-${resultado.ciclo}.diff`), resultado.patchLote);
  }

  // --publicar: já deixa o snapshot pronto para a página /autoaprimoramento.
  if (process.argv.includes("--publicar")) {
    const { publicarUltimoCiclo } = await import("./publish.mjs");
    publicarUltimoCiclo();
  }

  return resultado;
}

// Execução direta
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const semTestes = process.argv.includes("--sem-testes");
  rodarCiclo({ semTestes })
    .then((r) => {
      if (r.ornithOk) {
        console.log(`Ciclo ${r.ciclo} OK — ${r.analise.propostas.length} proposta(s), patch: ${r.patchLote ? "sim" : "não"}`);
        console.log(`Relatório: reports/selfimprove/cycle-${r.ciclo}.md`);
        if (r.patchLote) console.log(`Patch: reports/selfimprove/patch-${r.ciclo}.diff (aplique com node scripts/selfimprove/apply.mjs)`);
      } else {
        console.error(`Ciclo ${r.ciclo}: ${r.erroOrnith}`);
        console.error("Os sinais foram coletados e salvos — suba o modelo e rode de novo.");
        process.exit(2);
      }
    })
    .catch((e) => {
      console.error("Ciclo falhou:", e);
      process.exit(1);
    });
}
