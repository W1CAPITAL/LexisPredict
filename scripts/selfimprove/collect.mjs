/**
 * Coleta de sinais do app inteiro — sem API, sem nuvem: roda na sua máquina.
 * Sinais: typecheck, testes, TODOs/FIXMEs, drops da inbox do navegador,
 * tamanho do repo e versão. Grava reports/selfimprove/signals-<ciclo>.json.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { cicloId, normalizeInboxDrop } from "./lib.mjs";

const pexec = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, "..", "..");
const REPORTS = path.join(RAIZ, "reports", "selfimprove");

async function sh(cmd, args, opts = {}) {
  try {
    const { stdout } = await pexec(cmd, args, {
      cwd: RAIZ,
      maxBuffer: 12 * 1024 * 1024,
      timeout: opts.timeoutMs ?? 120_000,
      shell: process.platform === "win32",
    });
    return { ok: true, saida: String(stdout || "") };
  } catch (e) {
    return { ok: false, saida: `${e.stdout || ""}${e.stderr || ""}`, erro: String(e.message || e) };
  }
}

function coletarTodos(srcDir, limit = 40) {
  const achados = [];
  const alvo = path.join(RAIZ, srcDir);
  if (!fs.existsSync(alvo)) return achados;
  const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
  const pular = new Set(["node_modules", ".next", ".git", "dist"]);
  const stack = [alvo];
  while (stack.length && achados.length < limit * 3) {
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
      if (!exts.has(path.extname(nome))) continue;
      let conteudo;
      try {
        conteudo = fs.readFileSync(full, "utf8");
      } catch {
        continue;
      }
      const linhas = conteudo.split("\n");
      for (let i = 0; i < linhas.length; i++) {
        const m = linhas[i].match(/\b(TODO|FIXME|HACK|XXX)\b[:\s](.{5,120})/);
        if (m) {
          achados.push({
            arquivo: path.relative(RAIZ, full).replace(/\\/g, "/"),
            linha: i + 1,
            tipo: m[1],
            texto: m[2].trim(),
          });
          if (achados.length >= limit * 3) break;
        }
      }
    }
  }
  // Dedup por arquivo+linha, prioriza FIXME/HACK, corta no limite.
  const vistos = new Set();
  const peso = { FIXME: 0, HACK: 1, XXX: 2, TODO: 3 };
  return achados
    .filter((a) => {
      const k = `${a.arquivo}:${a.linha}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .sort((a, b) => peso[a.tipo] - peso[b.tipo] || a.arquivo.localeCompare(b.arquivo))
    .slice(0, limit);
}

function contarLinhas(srcDir) {
  const alvo = path.join(RAIZ, srcDir);
  if (!fs.existsSync(alvo)) return { arquivos: 0, linhas: 0 };
  const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
  const pular = new Set(["node_modules", ".next", ".git", "dist"]);
  let arquivos = 0;
  let linhas = 0;
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
      if (!exts.has(path.extname(nome))) continue;
      arquivos++;
      try {
        linhas += fs.readFileSync(full, "utf8").split("\n").length;
      } catch {
        /* ignore */
      }
    }
  }
  return { arquivos, linhas };
}

function lerInbox() {
  const drops = [];
  const dir = path.join(RAIZ, "reports", "selfimprove", "inbox");
  if (!fs.existsSync(dir)) return drops;
  for (const nome of fs.readdirSync(dir)) {
    if (!nome.endsWith(".json")) continue;
    try {
      const norm = normalizeInboxDrop(JSON.parse(fs.readFileSync(path.join(dir, nome), "utf8")));
      if (norm) drops.push(norm);
    } catch {
      /* drop inválido: ignora */
    }
  }
  return drops;
}

function versaoApp() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));
    return String(pkg.version || "?");
  } catch {
    return "?";
  }
}

export async function coletarSinais() {
  const [typecheck, testes] = await Promise.all([
    sh("npm", ["run", "typecheck", "--silent"]),
    sh("npx", ["vitest", "run", "--reporter=basic"], { timeoutMs: 240_000 }),
  ]);

  const errosTsc = (typecheck.saida.match(/error TS\d+: .*/g) || []).slice(0, 30);
  const falhasTeste = [...testes.saida.matchAll(/(FAIL|✗|×)\s+(.+)$/gm)]
    .map((m) => m[2].trim())
    .slice(0, 20);

  return {
    origem: "local-cli",
    ciclo: cicloId(),
    quando: new Date().toISOString(),
    versaoApp: versaoApp(),
    saude: {
      typecheckOk: typecheck.ok,
      errosTsc,
      testesOk: testes.ok,
      falhasTeste,
    },
    todos: coletarTodos("src"),
    inbox: lerInbox(),
    tamanho: contarLinhas("src"),
  };
}

export function sinalParaTexto(s) {
  const linhas = [];
  linhas.push(`# Sinais do LexisPredict — ciclo ${s.ciclo} (app v${s.versaoApp})`);
  linhas.push(
    `Typecheck: ${s.saude.typecheckOk ? "OK" : `FALHOU (${s.saude.errosTsc.length} erros)`} · Testes: ${
      s.saude.testesOk ? "OK" : `FALHOU (${s.saude.falhasTeste.length} falhas)`
    } · Código: ${s.tamanho.arquivos} arquivos / ${s.tamanho.linhas} linhas em src/`
  );
  if (s.saude.errosTsc.length) {
    linhas.push("\n## Erros de TypeScript");
    for (const e of s.saude.errosTsc) linhas.push(`- ${e}`);
  }
  if (s.saude.falhasTeste.length) {
    linhas.push("\n## Testes falhando");
    for (const f of s.saude.falhasTeste) linhas.push(`- ${f}`);
  }
  if (s.inbox.length) {
    linhas.push("\n## Erros reportados pelos usuários do app (inbox do navegador)");
    for (const drop of s.inbox) {
      linhas.push(`\n### Drop ${drop.appVersion || "?"} — ${drop.eventos.length} eventos`);
      for (const ev of drop.eventos.slice(0, 25)) {
        linhas.push(`- [${ev.tipo}] ${ev.rota} ×${ev.count}: ${ev.mensagem}`);
      }
    }
  }
  if (s.todos.length) {
    linhas.push(`\n## TODOs/FIXMEs no código (${s.todos.length})`);
    for (const t of s.todos) linhas.push(`- [${t.tipo}] ${t.arquivo}:${t.linha} — ${t.texto}`);
  }
  return linhas.join("\n");
}

// Execução direta: node scripts/selfimprove/collect.mjs
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  coletarSinais()
    .then((sinais) => {
      fs.mkdirSync(REPORTS, { recursive: true });
      const arq = path.join(REPORTS, `signals-${sinais.ciclo}.json`);
      fs.writeFileSync(arq, JSON.stringify(sinais, null, 2));
      console.log(`Sinais → ${path.relative(RAIZ, arq)}`);
      console.log(sinalParaTexto(sinais));
    })
    .catch((e) => {
      console.error("Falha ao coletar sinais:", e);
      process.exit(1);
    });
}
