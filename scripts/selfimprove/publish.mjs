/**
 * Publica o último ciclo no app: reports/selfimprove/cycle-*.json →
 * public/selfimprove/report.json (lido pela página /autoaprimoramento).
 * Uso: node scripts/selfimprove/publish.mjs  (ou: node scripts/selfimprove/cycle.mjs --publicar)
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const REPORTS = path.join(RAIZ, "reports", "selfimprove");
const DESTINO = path.join(RAIZ, "public", "selfimprove", "report.json");

export function publicarUltimoCiclo() {
  const ciclos = fs
    .readdirSync(REPORTS)
    .filter((n) => /^cycle-\d{8}-\d{4}\.json$/.test(n))
    .sort();
  if (!ciclos.length) {
    console.error("Nenhum ciclo encontrado em reports/selfimprove/. Rode antes: node scripts/selfimprove/cycle.mjs");
    process.exit(1);
  }
  const ultimo = ciclos[ciclos.length - 1];
  const bruto = JSON.parse(fs.readFileSync(path.join(REPORTS, ultimo), "utf8"));
  const publicavel = {
    ciclo: bruto.ciclo,
    quando: bruto.quando,
    modelo: bruto.modelo,
    endpoint: bruto.endpoint,
    ornithOk: bruto.ornithOk,
    erroOrnith: bruto.erroOrnith,
    analise: bruto.analise,
    temPatch: Boolean(bruto.patchLote),
    sinais: bruto.sinais,
  };
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, JSON.stringify(publicavel, null, 2));
  console.log(`Publicado: ${ultimo} → public/selfimprove/report.json`);
  console.log("A página /autoaprimoramento lê este snapshot (faça deploy para ver no ar).");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  publicarUltimoCiclo();
}
