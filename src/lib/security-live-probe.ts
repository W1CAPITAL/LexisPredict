/**
 * Sonda ativa de segurança — somente contra o próprio origin.
 * Não é arma ofensiva genérica: valida defesas (headers, auth, paths sensíveis).
 * @copyright 2026 W1 / LexisPredict
 */

export type ProbeStatus = "PASS" | "FAIL" | "WARN" | "INFO";

export type ProbeStep = {
  id: string;
  title: string;
  status: ProbeStatus;
  detail: string;
  evidence?: string;
  fix?: string;
};

export type LiveProbeReport = {
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  steps: ProbeStep[];
  summary: { PASS: number; FAIL: number; WARN: number; INFO: number };
  narrative: string[];
};

const SENSITIVE_PATHS = [
  "/.env",
  "/.env.local",
  "/.git/config",
  "/package.json",
  "/next.config.js",
  "/.well-known/strix-verify.txt",
  "/api/version",
];

const REQUIRED_HEADERS = [
  "x-frame-options",
  "x-content-type-options",
  "referrer-policy",
  "content-security-policy",
  "strict-transport-security",
  "permissions-policy",
];

function count(steps: ProbeStep[]) {
  const s = { PASS: 0, FAIL: 0, WARN: 0, INFO: 0 };
  for (const st of steps) s[st.status]++;
  return s;
}

async function safeFetch(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; headers: Headers; text: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, headers: res.headers, text: text.slice(0, 2000) };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      text: String(e?.message || e),
    };
  }
}

/**
 * Executa bateria de sondas ativas no próprio app (baseUrl).
 */
export async function runLiveSecurityProbe(baseUrl: string): Promise<LiveProbeReport> {
  const startedAt = new Date().toISOString();
  const base = baseUrl.replace(/\/$/, "");
  const steps: ProbeStep[] = [];
  const narrative: string[] = [];

  narrative.push(`[LIVE] Iniciando sonda ativa em ${base}`);

  // 1) Headers na home
  {
    narrative.push("[LIVE] Verificando headers HTTP na raiz…");
    const r = await safeFetch(`${base}/`);
    const missing: string[] = [];
    for (const h of REQUIRED_HEADERS) {
      if (!r.headers.get(h)) missing.push(h);
    }
    if (r.status === 0) {
      steps.push({
        id: "headers",
        title: "Headers de segurança (resposta real)",
        status: "WARN",
        detail: `Não foi possível alcançar ${base}: ${r.text}`,
        fix: "Confirme a URL pública e o deploy.",
      });
    } else if (missing.length) {
      steps.push({
        id: "headers",
        title: "Headers de segurança (resposta real)",
        status: "FAIL",
        detail: `Resposta ${r.status}. Faltando: ${missing.join(", ")}`,
        evidence: missing.join(", "),
        fix: "Garanta middleware.ts + next.config headers no deploy ativo.",
      });
      narrative.push(`[FAIL] Headers ausentes: ${missing.join(", ")}`);
    } else {
      steps.push({
        id: "headers",
        title: "Headers de segurança (resposta real)",
        status: "PASS",
        detail: `Resposta ${r.status}. Todos os 6 headers críticos presentes.`,
      });
      narrative.push("[PASS] Headers de segurança OK na resposta real.");
    }
  }

  // 2) Rotas sensíveis sem sessão
  {
    narrative.push("[LIVE] Tentando acessar rotas protegidas sem autenticação…");
    const protectedPaths = ["/security", "/supervisao", "/processos", "/settings"];
    const leaks: string[] = [];
    for (const p of protectedPaths) {
      const r = await safeFetch(`${base}${p}`);
      // 200 com HTML de app logado = possível falha; 307/302/login = ok
      if (r.status === 200 && /useAuth|Superadmin|Carteira/i.test(r.text) && !/login|Entrar|sign in/i.test(r.text)) {
        leaks.push(`${p} → ${r.status}`);
      }
    }
    if (leaks.length) {
      steps.push({
        id: "auth-guard",
        title: "Quebra de acesso (rotas autenticadas)",
        status: "FAIL",
        detail: `Possível conteúdo autenticado sem sessão: ${leaks.join("; ")}`,
        fix: "Reforce middleware de sessão e guards nas páginas.",
      });
      narrative.push(`[FAIL] Possível bypass em: ${leaks.join(", ")}`);
    } else {
      steps.push({
        id: "auth-guard",
        title: "Quebra de acesso (rotas autenticadas)",
        status: "PASS",
        detail: "Rotas sensíveis redirecionam ou não expõem área logada sem sessão.",
      });
      narrative.push("[PASS] Guarda de autenticação resistiu às sondas anônimas.");
    }
  }

  // 3) Arquivos sensíveis
  {
    narrative.push("[LIVE] Procurando arquivos sensíveis expostos…");
    const exposed: string[] = [];
    for (const p of SENSITIVE_PATHS) {
      const r = await safeFetch(`${base}${p}`);
      if (r.status === 200) {
        const looksSecret =
          p.includes(".env") ||
          p.includes(".git") ||
          (p.includes("package.json") && /"dependencies"/i.test(r.text));
        // package.json público às vezes é ok; .env nunca
        if (p.includes(".env") || p.includes(".git")) {
          exposed.push(`${p} → ${r.status}`);
        } else if (p === "/package.json" && r.status === 200) {
          // info only
          steps.push({
            id: `expose-${p}`,
            title: `Exposição ${p}`,
            status: "INFO",
            detail: "package.json acessível (comum em alguns deploys estáticos).",
          });
        }
      }
    }
    if (exposed.length) {
      steps.push({
        id: "sensitive-files",
        title: "Arquivos sensíveis expostos",
        status: "FAIL",
        detail: exposed.join("; "),
        fix: "Bloqueie .env e .git no hosting; nunca publique segredos em public/.",
      });
      narrative.push(`[FAIL] Exposto: ${exposed.join(", ")}`);
    } else {
      steps.push({
        id: "sensitive-files",
        title: "Arquivos sensíveis expostos",
        status: "PASS",
        detail: ".env / .git não retornaram 200 com conteúdo sensível.",
      });
      narrative.push("[PASS] Sem vazamento óbvio de .env/.git.");
    }
  }

  // 4) Clickjacking header
  {
    const r = await safeFetch(`${base}/login`);
    const xfo = (r.headers.get("x-frame-options") || "").toUpperCase();
    const csp = r.headers.get("content-security-policy") || "";
    const ok = xfo.includes("DENY") || xfo.includes("SAMEORIGIN") || /frame-ancestors\s+'none'/i.test(csp);
    steps.push({
      id: "clickjacking",
      title: "Clickjacking (XFO / frame-ancestors)",
      status: ok ? "PASS" : "FAIL",
      detail: ok
        ? `Proteção ativa (XFO=${xfo || "—"}).`
        : "Sem X-Frame-Options/frame-ancestors efetivo na resposta de /login.",
      fix: "Mantenha X-Frame-Options DENY e CSP frame-ancestors 'none'.",
    });
    narrative.push(ok ? "[PASS] Anti-clickjacking OK." : "[FAIL] Anti-clickjacking ausente.");
  }

  // 5) MIME sniffing
  {
    const r = await safeFetch(`${base}/`);
    const nosniff = (r.headers.get("x-content-type-options") || "").toLowerCase();
    steps.push({
      id: "nosniff",
      title: "MIME sniffing",
      status: nosniff === "nosniff" ? "PASS" : "FAIL",
      detail: `X-Content-Type-Options=${nosniff || "(ausente)"}`,
    });
  }

  const finishedAt = new Date().toISOString();
  const summary = count(steps);
  narrative.push(
    `[LIVE] Concluído — PASS ${summary.PASS} · FAIL ${summary.FAIL} · WARN ${summary.WARN} · INFO ${summary.INFO}`
  );

  return { startedAt, finishedAt, baseUrl: base, steps, summary, narrative };
}
