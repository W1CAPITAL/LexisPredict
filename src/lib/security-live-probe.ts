/**
 * Sonda de intrusão controlada (nível alto) — somente próprio origin + Superadmin.
 * Tenta quebrar: headers, auth anônima, cross-tenant, APIs sem secret,
 * login/signup sem código, IDOR, path traversal, clickjacking, MIME.
 * Não é arma genérica — valida defesas em produção.
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

const FAKE_EMPRESA_A = "00000000-0000-4000-8000-000000000001";
const FAKE_EMPRESA_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const FAKE_USER = "11111111-1111-4111-8111-111111111111";

const SENSITIVE_PATHS = [
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.git/config",
  "/.git/HEAD",
  "/package.json",
  "/next.config.js",
  "/next.config.mjs",
  "/.well-known/strix-verify.txt",
  "/api/version",
  "/robots.txt",
];

const PROTECTED_PAGES = [
  "/security",
  "/supervisao",
  "/processos",
  "/cases",
  "/settings",
  "/report",
  "/tarefas",
  "/busca-apreensao",
  "/team",
  "/equipe",
];

const API_WITHOUT_COOKIE = [
  "/api/datajud-status",
  "/api/datajud-trigger",
  "/api/datajud-search",
  "/api/scan-health",
  "/api/queue/enqueue-scan",
  "/api/chat",
  "/api/webhooks",
  "/api/webhook",
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
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text().catch(() => "");
    return {
      ok: res.ok,
      status: res.status,
      headers: res.headers,
      text: text.slice(0, 2500),
    };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      headers: new Headers(),
      text: String(e?.message || e),
    };
  }
}

function looksLikeAuthenticatedApp(html: string): boolean {
  if (!html || html.length < 80) return false;
  if (/\/login|sign in|entrar|supabase.*auth/i.test(html) && !/Superadmin|Carteira ativa/i.test(html)) {
    return false;
  }
  return /useAuth|Superadmin|Gabinete|Carteira|processos_lexis|Authority Points/i.test(html);
}

function looksLikeJsonDataLeak(text: string): boolean {
  if (!text || text.length < 2) return false;
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j) && j.length > 0) return true;
    if (j && typeof j === "object") {
      if (j.cases || j.processos || j.data || j.users || j.usuarios || j.empresa_id)
        return true;
      if (j.success === true && (j.tarefas || j.hits || j.queue)) return true;
    }
  } catch {
    /* not json */
  }
  return false;
}

export type LiveProbeOptions = {
  /** Cookie de sessão do Superadmin (para testes autenticados / IDOR) */
  sessionCookie?: string | null;
  /** empresa_id real do Superadmin (para tentar cruzar com outra) */
  ownEmpresaId?: string | null;
};

/**
 * Bateria agressiva de sondas no próprio app.
 */
export async function runLiveSecurityProbe(
  baseUrl: string,
  opts: LiveProbeOptions = {}
): Promise<LiveProbeReport> {
  const startedAt = new Date().toISOString();
  const base = baseUrl.replace(/\/$/, "");
  const steps: ProbeStep[] = [];
  const narrative: string[] = [];
  const cookie = (opts.sessionCookie || "").trim();
  const authHeaders: Record<string, string> = cookie
    ? { Cookie: cookie }
    : {};

  narrative.push(`[LIVE] Iniciando sonda FORTE em ${base}`);
  narrative.push(
    cookie
      ? "[LIVE] Modo híbrido: anônimo + sessão Superadmin (IDOR/cross-tenant)."
      : "[LIVE] Modo anônimo puro (sem cookie de sessão na sonda)."
  );

  // ─── 1) Headers ───────────────────────────────────────────
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
        detail: `Não alcançou ${base}: ${r.text}`,
        fix: "Confirme URL pública e deploy.",
      });
    } else if (missing.length) {
      steps.push({
        id: "headers",
        title: "Headers de segurança (resposta real)",
        status: "FAIL",
        detail: `Resposta ${r.status}. Faltando: ${missing.join(", ")}`,
        evidence: missing.join(", "),
        fix: "middleware.ts + next.config headers no deploy ativo.",
      });
      narrative.push(`[FAIL] Headers ausentes: ${missing.join(", ")}`);
    } else {
      steps.push({
        id: "headers",
        title: "Headers de segurança (resposta real)",
        status: "PASS",
        detail: `Resposta ${r.status}. Todos os 6 headers críticos presentes.`,
      });
      narrative.push("[PASS] Headers de segurança OK.");
    }
  }

  // ─── 2) Rotas autenticadas sem sessão ─────────────────────
  {
    narrative.push("[LIVE] Quebra de acesso — páginas sem sessão…");
    const leaks: string[] = [];
    for (const p of PROTECTED_PAGES) {
      const r = await safeFetch(`${base}${p}`);
      if (r.status === 200 && looksLikeAuthenticatedApp(r.text)) {
        leaks.push(`${p}→${r.status}`);
      }
    }
    steps.push({
      id: "auth-guard-pages",
      title: "Quebra de acesso (páginas autenticadas)",
      status: leaks.length ? "FAIL" : "PASS",
      detail: leaks.length
        ? `Possível área logada sem sessão: ${leaks.join("; ")}`
        : "Páginas sensíveis não expõem gabinete sem sessão.",
      evidence: leaks.join("; ") || undefined,
      fix: "Middleware de sessão + redirect /login em toda rota privada.",
    });
    narrative.push(
      leaks.length
        ? `[FAIL] Bypass de página: ${leaks.join(", ")}`
        : "[PASS] Guarda de páginas resistiu."
    );
  }

  // ─── 3) APIs sem autenticação ─────────────────────────────
  {
    narrative.push("[LIVE] APIs internas sem cookie/Authorization…");
    const leaks: string[] = [];
    for (const p of API_WITHOUT_COOKIE) {
      const rGet = await safeFetch(`${base}${p}`);
      const rPost = await safeFetch(`${base}${p}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ probe: true, empresa_id: FAKE_EMPRESA_A }),
      });
      for (const [m, r] of [
        ["GET", rGet],
        ["POST", rPost],
      ] as const) {
        if (
          r.status === 200 &&
          (looksLikeJsonDataLeak(r.text) ||
            (/empresa_id|processo|protocolo/i.test(r.text) &&
              !/Unauthorized|Sessão|401|403/i.test(r.text)))
        ) {
          leaks.push(`${m} ${p}→${r.status}`);
        }
      }
    }
    steps.push({
      id: "api-anon",
      title: "APIs sem autenticação",
      status: leaks.length ? "FAIL" : "PASS",
      detail: leaks.length
        ? `APIs responderam dados sem sessão: ${leaks.join("; ")}`
        : "APIs sensíveis exigem sessão ou secret (401/403/redirect).",
      evidence: leaks.join("; ") || undefined,
      fix: "getUserContext() ou Bearer secret em toda route handler sensível.",
    });
    narrative.push(
      leaks.length
        ? `[FAIL] API aberta: ${leaks.join(", ")}`
        : "[PASS] APIs anônimas bloqueadas."
    );
  }

  // ─── 4) Cross-tenant / empresa_id forjado ─────────────────
  {
    narrative.push(
      "[LIVE] Cross-tenant: empresa_id alienígena em worker/queue/health…"
    );
    const attempts: { path: string; init?: RequestInit }[] = [
      {
        path: `/api/datajud-worker?empresa_id=${FAKE_EMPRESA_B}`,
        init: { method: "POST" },
      },
      {
        path: `/api/datajud-worker?empresa_id=${FAKE_EMPRESA_A}`,
        init: {
          method: "POST",
          headers: { Authorization: "Bearer wrong-secret-probe" },
        },
      },
      {
        path: `/api/cron/datajud-scan?empresa_id=${FAKE_EMPRESA_B}`,
      },
      {
        path: `/api/scan-health?empresa_id=${FAKE_EMPRESA_B}`,
      },
      {
        path: `/api/queue/enqueue-scan`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            empresa_id: FAKE_EMPRESA_B,
            mode: "both",
          }),
        },
      },
    ];
    const breaches: string[] = [];
    for (const a of attempts) {
      const r = await safeFetch(`${base}${a.path}`, a.init);
      // 200 com processed/success sem auth = falha grave
      if (
        r.status === 200 &&
        (/processed|success:\s*true|"cases"|fila/i.test(r.text) ||
          looksLikeJsonDataLeak(r.text)) &&
        !/Unauthorized|401|403|Bad Request/i.test(r.text)
      ) {
        breaches.push(`${a.path}→${r.status}`);
      }
    }
    steps.push({
      id: "cross-tenant",
      title: "Cross-tenant (empresa_id forjado)",
      status: breaches.length ? "FAIL" : "PASS",
      detail: breaches.length
        ? `Worker/API aceitou empresa_id estranho: ${breaches.join("; ")}`
        : "empresa_id alienígena rejeitado ou exige secret de worker.",
      evidence: breaches.join("; ") || undefined,
      fix: "DATAJUD_WORKER_SECRET obrigatório; nunca confiar só em query empresa_id.",
    });
    narrative.push(
      breaches.length
        ? `[FAIL] Cross-tenant: ${breaches.join(", ")}`
        : "[PASS] Cross-tenant bloqueado."
    );
  }

  // ─── 5) Header injection / privilege headers ──────────────
  {
    narrative.push(
      "[LIVE] Headers forjados (X-Empresa-Id, X-User-Id, Authorization)…"
    );
    const r = await safeFetch(`${base}/api/datajud-status`, {
      headers: {
        "X-Empresa-Id": FAKE_EMPRESA_B,
        "X-User-Id": FAKE_USER,
        "X-Role": "Superadmin",
        Authorization: "Bearer eyJhbGciOiJub25lIn0.fake.probe",
      },
    });
    const leak =
      r.status === 200 &&
      looksLikeJsonDataLeak(r.text) &&
      !/Unauthorized|Sessão/i.test(r.text);
    steps.push({
      id: "header-forge",
      title: "Escalação por headers forjados",
      status: leak ? "FAIL" : "PASS",
      detail: leak
        ? `datajud-status aceitou headers forjados (HTTP ${r.status}).`
        : `Headers forjados ignorados (HTTP ${r.status || 0}).`,
      fix: "Ignore X-Role/X-Empresa-Id do cliente; use só sessão Supabase.",
    });
    narrative.push(
      leak
        ? "[FAIL] Escalação por header."
        : "[PASS] Headers forjados ignorados."
    );
  }

  // ─── 6) Login / signup sem código ─────────────────────────
  {
    narrative.push(
      "[LIVE] Tentativas de login/signup sem OTP / código / perfil…"
    );
    const authAttempts: {
      path: string;
      init: RequestInit;
      label: string;
    }[] = [
      {
        label: "POST /login fake body",
        path: "/login",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "probe@evil.test",
            password: "Probe123!@#",
          }),
        },
      },
      {
        label: "POST /auth/callback sem code",
        path: "/auth/callback",
        init: { method: "GET" },
      },
      {
        label: "GET /auth/confirm sem token",
        path: "/auth/confirm",
        init: { method: "GET" },
      },
      {
        label: "POST signup sem invite",
        path: "/api/auth/signup",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "probe-no-code@evil.test",
            password: "x",
            empresa_id: FAKE_EMPRESA_A,
          }),
        },
      },
    ];
    const weak: string[] = [];
    for (const a of authAttempts) {
      const r = await safeFetch(`${base}${a.path}`, a.init);
      // Sucesso de criação de sessão / 200 com access_token = falha
      if (
        r.status === 200 &&
        (/access_token|refresh_token|"user":\s*\{|session/i.test(r.text) ||
          looksLikeAuthenticatedApp(r.text))
      ) {
        weak.push(`${a.label}→${r.status}`);
      }
    }
    steps.push({
      id: "auth-no-code",
      title: "Login/signup sem código de autenticação",
      status: weak.length ? "FAIL" : "PASS",
      detail: weak.length
        ? `Fluxo fraco: ${weak.join("; ")}`
        : "Endpoints de auth não emitiram sessão só com body forjado.",
      evidence: weak.join("; ") || undefined,
      fix: "Exija OTP/magic link/invite; nunca crie usuário só com email+senha pública sem política.",
    });
    narrative.push(
      weak.length
        ? `[FAIL] Auth fraca: ${weak.join(", ")}`
        : "[PASS] Login/signup sem código bloqueado."
    );
  }

  // ─── 7) Acesso sem perfil (cookie lixo + páginas) ─────────
  {
    narrative.push("[LIVE] Sessão inválida / sem perfil em área logada…");
    const r = await safeFetch(`${base}/processos`, {
      headers: {
        Cookie:
          "sb-access-token=invalid.probe.token; sb-refresh-token=invalid; lexis-role=Superadmin",
      },
    });
    const bad =
      r.status === 200 && looksLikeAuthenticatedApp(r.text);
    steps.push({
      id: "no-profile",
      title: "Acesso com sessão inválida / sem perfil",
      status: bad ? "FAIL" : "PASS",
      detail: bad
        ? "Cookie lixo ainda serviu área logada."
        : `Sessão inválida não abriu gabinete (HTTP ${r.status || 0}).`,
      fix: "Valide JWT no middleware e perfil em usuarios antes de renderizar dados.",
    });
    narrative.push(
      bad
        ? "[FAIL] Cookie inválido aceito."
        : "[PASS] Sem perfil / token inválido bloqueado."
    );
  }

  // ─── 8) IDOR autenticado (se houver cookie Superadmin) ────
  if (cookie) {
    narrative.push(
      "[LIVE] IDOR autenticado: tentar dados de outra empresa com sua sessão…"
    );
    const paths = [
      `/api/scan-health?empresa_id=${FAKE_EMPRESA_B}`,
      `/api/datajud-worker?empresa_id=${FAKE_EMPRESA_B}`,
    ];
    const idor: string[] = [];
    for (const p of paths) {
      const r = await safeFetch(`${base}${p}`, {
        method: p.includes("worker") ? "POST" : "GET",
        headers: {
          ...authHeaders,
          Authorization: "Bearer wrong",
        },
      });
      if (
        r.status === 200 &&
        looksLikeJsonDataLeak(r.text) &&
        !/Unauthorized|Forbidden|secret/i.test(r.text)
      ) {
        idor.push(`${p}→${r.status}`);
      }
    }
    // Tenta header empresa alienígena com cookie válido
    const r2 = await safeFetch(`${base}/api/datajud-status`, {
      headers: {
        ...authHeaders,
        "X-Empresa-Id": FAKE_EMPRESA_B,
      },
    });
    if (
      r2.status === 200 &&
      looksLikeJsonDataLeak(r2.text) &&
      opts.ownEmpresaId &&
      r2.text.includes(FAKE_EMPRESA_B)
    ) {
      idor.push("datajud-status com X-Empresa-Id alienígena");
    }

    steps.push({
      id: "idor-auth",
      title: "IDOR / cross-tenant com sessão válida",
      status: idor.length ? "FAIL" : "PASS",
      detail: idor.length
        ? `Sessão Superadmin + empresa_id estranho vazou: ${idor.join("; ")}`
        : "Com sessão válida, empresa_id forjado não mudou o escopo.",
      evidence: idor.join("; ") || undefined,
      fix: "empresa_id sempre do getUserContext(), nunca da query do cliente.",
    });
    narrative.push(
      idor.length
        ? `[FAIL] IDOR: ${idor.join(", ")}`
        : "[PASS] IDOR autenticado bloqueado."
    );
  } else {
    steps.push({
      id: "idor-auth",
      title: "IDOR / cross-tenant com sessão válida",
      status: "INFO",
      detail:
        "Cookie de sessão não repassado à sonda — teste IDOR autenticado omitido.",
      fix: "Repasse cookie na action para habilitar este vetor.",
    });
  }

  // ─── 9) Path traversal / arquivos ─────────────────────────
  {
    narrative.push("[LIVE] Arquivos sensíveis e path traversal…");
    const exposed: string[] = [];
    const traversal = [
      "/../../../etc/passwd",
      "/api/../../../.env",
      "/%2e%2e/%2e%2e/.env",
    ];
    for (const p of [...SENSITIVE_PATHS, ...traversal]) {
      const r = await safeFetch(`${base}${p}`);
      if (r.status === 200) {
        if (
          p.includes(".env") ||
          p.includes(".git") ||
          /DATABASE_URL|SERVICE_ROLE|SECRET|passwd:|root:/i.test(r.text)
        ) {
          exposed.push(`${p}→${r.status}`);
        }
      }
    }
    steps.push({
      id: "sensitive-files",
      title: "Arquivos sensíveis / path traversal",
      status: exposed.length ? "FAIL" : "PASS",
      detail: exposed.length
        ? exposed.join("; ")
        : ".env / .git / traversal não retornaram segredo.",
      evidence: exposed.join("; ") || undefined,
      fix: "Bloqueie dotfiles no hosting; nunca publique .env.",
    });
    narrative.push(
      exposed.length
        ? `[FAIL] Exposto: ${exposed.join(", ")}`
        : "[PASS] Sem vazamento de arquivos sensíveis."
    );
  }

  // ─── 10) Clickjacking + MIME ──────────────────────────────
  {
    const r = await safeFetch(`${base}/login`);
    const xfo = (r.headers.get("x-frame-options") || "").toUpperCase();
    const csp = r.headers.get("content-security-policy") || "";
    const ok =
      xfo.includes("DENY") ||
      xfo.includes("SAMEORIGIN") ||
      /frame-ancestors\s+('none'|none)/i.test(csp);
    steps.push({
      id: "clickjacking",
      title: "Clickjacking (XFO / frame-ancestors)",
      status: ok ? "PASS" : "FAIL",
      detail: ok
        ? `Proteção ativa (XFO=${xfo || "via CSP"}).`
        : "Sem X-Frame-Options/frame-ancestors efetivo em /login.",
      fix: "X-Frame-Options DENY + CSP frame-ancestors 'none'.",
    });
    narrative.push(
      ok ? "[PASS] Anti-clickjacking OK." : "[FAIL] Clickjacking aberto."
    );

    const r2 = await safeFetch(`${base}/`);
    const nosniff = (r2.headers.get("x-content-type-options") || "").toLowerCase();
    steps.push({
      id: "nosniff",
      title: "MIME sniffing",
      status: nosniff === "nosniff" ? "PASS" : "FAIL",
      detail: `X-Content-Type-Options=${nosniff || "(ausente)"}`,
    });
  }

  // ─── 11) Métodos HTTP estranhos ───────────────────────────
  {
    narrative.push("[LIVE] Métodos HTTP anômalos (TRACE/PUT)…");
    const methods = ["TRACE", "TRACK", "PUT", "DELETE"] as const;
    const weird: string[] = [];
    for (const m of methods) {
      const r = await safeFetch(`${base}/`, { method: m });
      if (r.status === 200 && m === "TRACE" && /TRACE|Max-Forwards/i.test(r.text)) {
        weird.push(`${m}→${r.status}`);
      }
      if ((m === "PUT" || m === "DELETE") && r.status === 200 && looksLikeJsonDataLeak(r.text)) {
        weird.push(`${m}→${r.status}`);
      }
    }
    steps.push({
      id: "http-methods",
      title: "Métodos HTTP perigosos",
      status: weird.length ? "WARN" : "PASS",
      detail: weird.length
        ? `Respostas suspeitas: ${weird.join("; ")}`
        : "TRACE/PUT/DELETE não expuseram dados.",
      fix: "Desabilite TRACE no edge; restrinja métodos nas rotas.",
    });
  }

  const finishedAt = new Date().toISOString();
  const summary = count(steps);
  narrative.push(
    `[LIVE] Concluído — PASS ${summary.PASS} · FAIL ${summary.FAIL} · WARN ${summary.WARN} · INFO ${summary.INFO}`
  );

  return { startedAt, finishedAt, baseUrl: base, steps, summary, narrative };
}
