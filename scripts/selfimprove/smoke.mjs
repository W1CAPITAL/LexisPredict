/**
 * Smoke test E2E do autoaprimoramento — sobe um servidor fake compatível com
 * OpenAI na porta 8123, roda um ciclo completo e valida as saídas.
 * Uso: node scripts/selfimprove/smoke.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { rodarCiclo } from "./cycle.mjs";
import { validarPatch } from "./apply.mjs";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");

const RESPOSTA_FAKE = `<think>definitely thinking here</think>
\`\`\`json
{
  "resumo": "App compilando; sem P0. Duas melhorias de robustez.",
  "diagnostico": ["Typecheck limpo (deps opcionais fora do lock)", "Nenhum erro de runtime na inbox"],
  "propostas": [
    {
      "titulo": "Smoke: arquivo de exemplo para validar pipeline de patch",
      "prioridade": "P3",
      "arquivos": ["reports/selfimprove/smoke-exemplo.txt"],
      "descricao": "Cria um arquivo novo para provar que o git apply funciona de ponta a ponta.",
      "risco": "nenhum — arquivo novo",
      "patch_unified_diff": "--- /dev/null\\n+++ b/reports/selfimprove/smoke-exemplo.txt\\n@@ -0,0 +1,2 @@\\n+criado pelo smoke test\\n+se você ler isto, o pipeline funciona\\n"
    },
    {
      "titulo": "Proposta sem patch (só descrição)",
      "prioridade": "P2",
      "arquivos": [],
      "descricao": "Exemplo de proposta sem diff.",
      "risco": "baixo"
    }
  ],
  "proximos_passos": ["rodar npm run typecheck", "revisar propostas no painel"]
}
\`\`\``;

function iniciarFake() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let corpo = "";
      req.on("data", (c) => (corpo += c));
      req.on("end", () => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: RESPOSTA_FAKE } }],
          })
        );
      });
    });
    srv.listen(8123, "127.0.0.1", () => resolve(srv));
  });
}

async function main() {
  const srv = await iniciarFake();
  process.env.ORNITH_BASE_URL = "http://127.0.0.1:8123/v1";
  process.env.ORNITH_MODEL = "ornith-smoke";
  process.env.ORNITH_TIMEOUT_MS = "15000";

  let falhou = false;
  try {
    // 1. Validador de patch: rejeita caminho perigoso.
    const ruim = validarPatch("--- a/../.git/config\n+++ b/../.git/config\n@@ -1 +1 @@\n-x\n+y\n");
    if (ruim.ok) throw new Error("validarPatch deveria rejeitar ../");

    // 2. Ciclo completo (sem testes para o smoke ser rápido).
    const r = await rodarCiclo({ semTestes: true });
    if (!r.ornithOk) throw new Error(`ciclo falhou: ${r.erroOrnith}`);
    if (r.analise.propostas.length !== 2) throw new Error(`esperava 2 propostas, veio ${r.analise.propostas.length}`);
    if (r.analise.propostas[0].prioridade !== "P3") throw new Error("prioridade normalizada errada");
    if (!r.patchLote) throw new Error("patchLote ausente");
    console.log(`✔ ciclo OK — relatórios em reports/selfimprove/cycle-${r.ciclo}.{json,md}`);

    // 3. Publish.
    const { publicarUltimoCiclo } = await import("./publish.mjs");
    publicarUltimoCiclo();
    if (!fs.existsSync(path.join(RAIZ, "public", "selfimprove", "report.json"))) throw new Error("report.json não publicado");

    // 4. validarPatch aceita o patch real do ciclo.
    const bom = validarPatch(r.patchLote);
    if (!bom.ok) throw new Error(`validarPatch rejeitou patch válido: ${bom.motivo}`);
    if (!bom.arquivos.includes("reports/selfimprove/smoke-exemplo.txt")) throw new Error("arquivo do patch não detectado");
    console.log("✔ publish + validarPatch OK");
  } catch (e) {
    console.error("✘ SMOKE FALHOU:", e?.message || e);
    falhou = true;
  } finally {
    srv.close();
  }
  process.exit(falhou ? 1 : 0);
}

main();
