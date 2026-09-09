/**
 * Aplica um lote de patch gerado pelo ciclo — com rede de segurança:
 *   - lista os arquivos afetados antes de aplicar (--listar)
 *   - valida caminhos (nada fora do repo, nada em node_modules/.next/.git, sem ..)
 *   - git apply --check (dry-run) antes de tocar em qualquer arquivo
 *   - backup .bak de cada arquivo modificado em reports/selfimprove/backup-<ciclo>/
 * Uso: node scripts/selfimprove/apply.mjs reports/selfimprove/patch-XXXX.diff [--listar]
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { stripThinking } from "./lib.mjs";

const pexec = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const BLOQUEADOS = ["node_modules", ".next", ".git", "dist", ".vercel"];

/** Extrai caminhos de --- / +++ do diff e valida. Retorna { ok, arquivos, motivo? }. */
export function validarPatch(diffText) {
  const linhas = String(diffText || "").split("\n");
  const arquivos = new Set();
  for (const linha of linhas) {
    const m = linha.match(/^(?:---|\+\+\+)\s+(.+?)(?:\t.*)?$/);
    if (!m) continue;
    // Git usa prefixos a/ e b/ — remove para obter o caminho real no repo.
    const alvo = m[1].trim().replace(/^(?:a|b)\//, "");
    if (alvo === "/dev/null" || m[1].trim() === "/dev/null") continue;
    if (alvo.includes("..") || alvo.startsWith("/")) {
      return { ok: false, arquivos: [], motivo: `caminho inseguro: ${alvo}` };
    }
    const raiz = alvo.split("/")[0];
    if (BLOQUEADOS.includes(raiz)) {
      return { ok: false, arquivos: [], motivo: `caminho bloqueado: ${alvo}` };
    }
    arquivos.add(alvo.replace(/\\/g, "/"));
  }
  if (!arquivos.size) return { ok: false, arquivos: [], motivo: "nenhum arquivo no diff" };
  return { ok: true, arquivos: [...arquivos] };
}

async function aplicar(difArq, listar) {
  const raw = fs.readFileSync(difArq, "utf8");
  const diff = stripThinking(raw); // modelos às vezes deixam <think> no arquivo
  const validacao = validarPatch(diff);
  if (!validacao.ok) {
    console.error(`Patch rejeitado: ${validacao.motivo}`);
    process.exit(2);
  }
  console.log(`Arquivos afetados:\n${validacao.arquivos.map((a) => `  ${a}`).join("\n")}`);
  if (listar) return;

  const tmp = path.join(RAIZ, "reports", "selfimprove", "lote-aplicavel.diff");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, diff);

  // Dry-run primeiro.
  try {
    await pexec("git", ["apply", "--check", path.relative(RAIZ, tmp)], { cwd: RAIZ, shell: process.platform === "win32" });
  } catch (e) {
    console.error(`git apply --check falhou:\n${(e.stderr || e.message || "").slice(0, 2000)}`);
    console.error("Nada foi modificado. Corrija o diff à mão ou peça um novo ciclo.");
    process.exit(3);
  }

  // Backup dos arquivos existentes.
  const ciclo = path.basename(difArq, path.extname(difArq)).replace(/^patch-?/, "") || "manual";
  const backupDir = path.join(RAIZ, "reports", "selfimprove", `backup-${ciclo}`);
  for (const arq of validacao.arquivos) {
    const full = path.join(RAIZ, arq);
    if (fs.existsSync(full)) {
      fs.mkdirSync(path.dirname(path.join(backupDir, arq)), { recursive: true });
      fs.copyFileSync(full, path.join(backupDir, arq));
    }
  }

  try {
    const { stdout } = await pexec("git", ["apply", path.relative(RAIZ, tmp)], {
      cwd: RAIZ,
      shell: process.platform === "win32",
    });
    if (stdout?.trim()) console.log(stdout);
    console.log(`Patch aplicado. Backups em ${path.relative(RAIZ, backupDir)}`);
    console.log("Rode agora: npm run typecheck && npm test");
  } catch (e) {
    console.error(`git apply falhou após dry-run OK (estado pode ter mudado):\n${(e.stderr || e.message || "").slice(0, 2000)}`);
    process.exit(4);
  }
}

// Execução direta
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).filter((a) => a !== "--listar");
  if (!args[0]) {
    console.error("Uso: node scripts/selfimprove/apply.mjs <patch.diff> [--listar]");
    process.exit(1);
  }
  const difArq = path.resolve(args[0]);
  if (!fs.existsSync(difArq)) {
    console.error(`Arquivo não encontrado: ${difArq}`);
    process.exit(1);
  }
  aplicar(difArq, process.argv.includes("--listar")).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
