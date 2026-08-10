/**
 * Painel de Pentest Controlado (profissional) — somente próprio origin + Superadmin.
 *
 * Objetivo: tentar quebrar o app de forma metódica. Em cada FAIL/WARN,
 * documenta: o que foi feito, impacto, como reproduzir e como proteger.
 *
 * @copyright 2026 W1 / LexisPredict
 */

export type ProbeStatus = "PASS" | "FAIL" | "WARN" | "INFO";
export type ProbeSeverity = "critical" | "high" | "medium" | "low" | "info";

export type ProbeStep = {
  id: string;
  title: string;
  status: ProbeStatus;
  severity: ProbeSeverity;
  /** Resumo curto */
  detail: string;
  /** O que a sonda fez (ataque) */
  attack?: string;
  /** Por que importa se passou */
  impact?: string;
  /** Como reproduzir */
  reproduction?: string;
  /** Como proteger (remediação) */
  remediation?: string;
  evidence?: string;
  /** alias legado */
  fix?: string;
};

export type LiveProbeReport = {
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  steps: ProbeStep[];
  findings: ProbeStep[]; // só FAIL + WARN, ordenados por severidade
  summary: { PASS: number; FAIL: number; WARN: number; INFO: number };
  narrative: string[];
  executiveSummary: string;
};

const FAKE_EMPRESA_A = "00000000-0000-4000-8000-000000000001";
const FAKE_EMPRESA_B = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const FAKE_USER = "11111111-1111-4111-8111-111111111111";

const SEV_RANK: Record<ProbeSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const SENSITIVE_PATHS = [
  "/.env",
  "/.env.local",
  "/.env.production",
  "/.git/config",
  "/.git/HEAD",
  "/package.json",
  "/next.config.js",
  "/next.config.mjs",
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

function finding(step: ProbeStep): ProbeStep {
  return {
    ...step,
    fix: step.fix || step.remediation,
  };
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
  if (
    /\/login|sign in|entrar/i.test(html) &&
    !/Superadmin|Carteira ativa/i.test(html)
  ) {
    return false;
  }
  return /useAuth|Superadmin|Gabinete|Carteira|Authority Points/i.test(html);
}

function looksLikeJsonDataLeak(text: string): boolean {
  if (!text || text.length < 2) return false;
  try {
    const j = JSON.parse(text);
    if (Array.isArray(j) && j.length > 0) return true;
    if (j && typeof j === "object") {
      if (j.cases || j.processos || j.data || j.users || j.usuarios || j.empresa_id)
        return true;
      if (j.success === true && (j.tarefas || j.hits || j.queue || j.processed != null))
        return true;
    }
  } catch {
    /* */
  }
  return false;
}

export type LiveProbeOptions = {
  sessionCookie?: string | null;
  ownEmpresaId?: string | null;
};

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

  narrative.push(`[PENTEST] Alvo controlado: ${base}`);
  narrative.push(
    cookie
      ? "[PENTEST] Vetores: anônimo + sessão Superadmin (IDOR)."
      : "[PENTEST] Vetores: anônimo (sem cookie de sessão)."
  );

  // 1) Headers
  {
    narrative.push("[ATTACK] GET / — inspecionar headers de segurança");
    const r = await safeFetch(`${base}/`);
    const missing = REQUIRED_HEADERS.filter((h) => !r.headers.get(h));
    if (r.status === 0) {
      steps.push(
        finding({
          id: "headers",
          title: "Headers de segurança",
          status: "WARN",
          severity: "medium",
          detail: `Alvo inacessível: ${r.text}`,
          attack: "Requisição GET à raiz do app.",
          impact: "Não foi possível validar headers em produção.",
          reproduction: `curl -sI ${base}/`,
          remediation: "Confirme URL pública e DNS do deploy.",
        })
      );
    } else if (missing.length) {
      steps.push(
        finding({
          id: "headers",
          title: "Headers de segurança ausentes",
          status: "FAIL",
          severity: "high",
          detail: `HTTP ${r.status}. Faltam: ${missing.join(", ")}`,
          evidence: missing.join(", "),
          attack:
            "Cliente anônimo fez GET na home e leu a lista de response headers.",
          impact:
            "Sem CSP/HSTS/XFO o app fica exposto a clickjacking, MIME sniffing e downgrade HTTP.",
          reproduction: `curl -sI '${base}/' | grep -iE 'frame|csp|hsts|nosniff|referrer|permissions'`,
          remediation:
            "No middleware.ts e/ou next.config, defina: Content-Security-Policy, Strict-Transport-Security, X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy, Permissions-Policy.",
        })
      );
      narrative.push(`[FAIL] Headers: ${missing.join(", ")}`);
    } else {
      steps.push({
        id: "headers",
        title: "Headers de segurança",
        status: "PASS",
        severity: "info",
        detail: `HTTP ${r.status}. 6 headers críticos presentes.`,
      });
      narrative.push("[PASS] Headers OK.");
    }
  }

  // 2) Páginas sem sessão
  {
    narrative.push("[ATTACK] GET páginas privadas sem Cookie");
    const leaks: string[] = [];
    for (const p of PROTECTED_PAGES) {
      const r = await safeFetch(`${base}${p}`);
      if (r.status === 200 && looksLikeAuthenticatedApp(r.text)) {
        leaks.push(`${p} (${r.status})`);
      }
    }
    if (leaks.length) {
      steps.push(
        finding({
          id: "auth-guard-pages",
          title: "Broken Access Control — páginas sem sessão",
          status: "FAIL",
          severity: "critical",
          detail: `Área logada visível sem autenticação: ${leaks.join("; ")}`,
          evidence: leaks.join("; "),
          attack:
            "Acesso anônimo (sem Cookie de sessão) a rotas de gabinete; HTML continha marcadores de área autenticada.",
          impact:
            "Invasor sem login pode ver UI/dados do gabinete ou descobrir estrutura interna.",
          reproduction: `curl -s '${base}/processos' | head -c 2000  # sem Cookie`,
          remediation:
            "Middleware Next.js: se não houver sessão Supabase válida, redirect 307 para /login em todas as rotas privadas. Guards useAuth nas pages.",
        })
      );
      narrative.push(`[FAIL] Páginas abertas: ${leaks.join(", ")}`);
    } else {
      steps.push({
        id: "auth-guard-pages",
        title: "Guarda de páginas autenticadas",
        status: "PASS",
        severity: "info",
        detail: "Páginas privadas não expuseram gabinete sem sessão.",
      });
      narrative.push("[PASS] Páginas protegidas.");
    }
  }

  // 3) APIs anônimas
  {
    narrative.push("[ATTACK] GET/POST APIs internas sem Authorization");
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
          leaks.push(`${m} ${p}`);
        }
      }
    }
    if (leaks.length) {
      steps.push(
        finding({
          id: "api-anon",
          title: "API sensível sem autenticação",
          status: "FAIL",
          severity: "critical",
          detail: `Dados ou ação sem sessão: ${leaks.join("; ")}`,
          evidence: leaks.join("; "),
          attack:
            "Chamadas GET/POST anônimas às route handlers /api/* com body contendo empresa_id falso.",
          impact:
            "Exfiltração de métricas/processos ou disparo de worker sem login.",
          reproduction: `curl -s -X POST '${base}/api/queue/enqueue-scan' -H 'Content-Type: application/json' -d '{"empresa_id":"${FAKE_EMPRESA_B}"}'`,
          remediation:
            "Em cada route: validar getUserContext() ou Bearer DATAJUD_WORKER_SECRET. Responder 401/403 sem corpo útil.",
        })
      );
      narrative.push(`[FAIL] API aberta: ${leaks.join(", ")}`);
    } else {
      steps.push({
        id: "api-anon",
        title: "APIs sem autenticação",
        status: "PASS",
        severity: "info",
        detail: "APIs sensíveis exigem sessão ou secret.",
      });
      narrative.push("[PASS] APIs anônimas bloqueadas.");
    }
  }

  // 4) Cross-tenant
  {
    narrative.push(
      "[ATTACK] Cross-tenant — empresa_id UUID alienígena em worker/cron/queue"
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
      { path: `/api/cron/datajud-scan?empresa_id=${FAKE_EMPRESA_B}` },
      { path: `/api/scan-health?empresa_id=${FAKE_EMPRESA_B}` },
      {
        path: `/api/queue/enqueue-scan`,
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ empresa_id: FAKE_EMPRESA_B, mode: "both" }),
        },
      },
    ];
    const breaches: string[] = [];
    for (const a of attempts) {
      const r = await safeFetch(`${base}${a.path}`, a.init);
      if (
        r.status === 200 &&
        (/processed|success:\s*true|"cases"|fila/i.test(r.text) ||
          looksLikeJsonDataLeak(r.text)) &&
        !/Unauthorized|401|403|Bad Request/i.test(r.text)
      ) {
        breaches.push(a.path.split("?")[0]);
      }
    }
    if (breaches.length) {
      steps.push(
        finding({
          id: "cross-tenant",
          title: "Broken Access Control — cross-tenant (empresa_id)",
          status: "FAIL",
          severity: "critical",
          detail: `API aceitou empresa_id de outra empresa: ${breaches.join(", ")}`,
          evidence: breaches.join("; "),
          attack: `POST/GET com query/body empresa_id=${FAKE_EMPRESA_B} (UUID que não é a sua) sem secret válido.`,
          impact:
            "Possível leitura ou processamento da carteira de outro tenant (vazamento multi-empresa).",
          reproduction: `curl -s -X POST '${base}/api/datajud-worker?empresa_id=${FAKE_EMPRESA_B}'`,
          remediation:
            "Obrigar Authorization: Bearer ${DATAJUD_WORKER_SECRET}. Nunca confiar só em empresa_id da query. Preferir empresa_id do contexto autenticado.",
        })
      );
      narrative.push(`[FAIL] Cross-tenant: ${breaches.join(", ")}`);
    } else {
      steps.push({
        id: "cross-tenant",
        title: "Isolamento multi-tenant (empresa_id)",
        status: "PASS",
        severity: "info",
        detail: "empresa_id alienígena rejeitado ou exige secret.",
      });
      narrative.push("[PASS] Cross-tenant bloqueado.");
    }
  }

  // 5) Header forge
  {
    narrative.push(
      "[ATTACK] Headers X-Empresa-Id / X-Role / Bearer JWT lixo"
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
    if (leak) {
      steps.push(
        finding({
          id: "header-forge",
          title: "Escalação de privilégio via headers",
          status: "FAIL",
          severity: "critical",
          detail: `API confiou em headers de cliente (HTTP ${r.status}).`,
          attack:
            "Enviou X-Role=Superadmin, X-Empresa-Id alienígena e JWT inválido esperando que o servidor confiasse neles.",
          impact: "Usuário comum ou anônimo vira Superadmin / troca de tenant.",
          reproduction: `curl -s '${base}/api/datajud-status' -H 'X-Role: Superadmin' -H 'X-Empresa-Id: ${FAKE_EMPRESA_B}'`,
          remediation:
            "Nunca leia papel/empresa de headers do request. Use apenas sessão Supabase validada no servidor (getUserContext).",
        })
      );
      narrative.push("[FAIL] Escalação por header.");
    } else {
      steps.push({
        id: "header-forge",
        title: "Headers de privilégio forjados",
        status: "PASS",
        severity: "info",
        detail: `Headers forjados ignorados (HTTP ${r.status || 0}).`,
      });
      narrative.push("[PASS] Headers forjados ignorados.");
    }
  }

  // 6) Auth sem código
  {
    narrative.push(
      "[ATTACK] Login/signup sem OTP, magic link ou invite"
    );
    const authAttempts: { path: string; init: RequestInit; label: string }[] =
      [
        {
          label: "POST /login body forjado",
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
          label: "GET /auth/callback sem code",
          path: "/auth/callback",
          init: { method: "GET" },
        },
        {
          label: "GET /auth/confirm sem token",
          path: "/auth/confirm",
          init: { method: "GET" },
        },
        {
          label: "POST /api/auth/signup sem invite",
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
      if (
        r.status === 200 &&
        (/access_token|refresh_token|"user":\s*\{/i.test(r.text) ||
          looksLikeAuthenticatedApp(r.text))
      ) {
        weak.push(a.label);
      }
    }
    if (weak.length) {
      steps.push(
        finding({
          id: "auth-no-code",
          title: "Autenticação sem código / invite",
          status: "FAIL",
          severity: "critical",
          detail: `Fluxo emitiu sessão sem segundo fator: ${weak.join("; ")}`,
          evidence: weak.join("; "),
          attack:
            "Tentou criar ou obter sessão só com email/senha ou callback sem token de verificação.",
          impact: "Conta criada ou sessão aberta sem validação de identidade.",
          reproduction:
            "POST JSON em /login ou /api/auth/signup sem OTP; GET /auth/callback sem ?code=",
          remediation:
            "Supabase: desabilite signup público se for privado; use magic link/OTP; invite-only para novos usuários; callback só com code válido.",
        })
      );
      narrative.push(`[FAIL] Auth fraca: ${weak.join(", ")}`);
    } else {
      steps.push({
        id: "auth-no-code",
        title: "Login/signup sem código",
        status: "PASS",
        severity: "info",
        detail: "Não foi possível obter sessão só com body forjado.",
      });
      narrative.push("[PASS] Auth sem código bloqueada.");
    }
  }

  // 7) Sem perfil
  {
    narrative.push("[ATTACK] Cookie inválido + role Superadmin forjada");
    const r = await safeFetch(`${base}/processos`, {
      headers: {
        Cookie:
          "sb-access-token=invalid.probe.token; sb-refresh-token=invalid; lexis-role=Superadmin",
      },
    });
    const bad = r.status === 200 && looksLikeAuthenticatedApp(r.text);
    if (bad) {
      steps.push(
        finding({
          id: "no-profile",
          title: "Acesso com token inválido / sem perfil",
          status: "FAIL",
          severity: "critical",
          detail: "Cookie lixo ainda serviu área logada.",
          attack:
            "Enviou tokens Supabase inventados e cookie lexis-role=Superadmin.",
          impact: "Bypass de autenticação real se o app confiar em cookie de role.",
          reproduction: `curl -s '${base}/processos' -H 'Cookie: sb-access-token=invalid; lexis-role=Superadmin'`,
          remediation:
            "Validar JWT no middleware (getUser). Cargo só vem da tabela usuarios após auth.uid(), nunca de cookie legível pelo cliente.",
        })
      );
      narrative.push("[FAIL] Cookie inválido aceito.");
    } else {
      steps.push({
        id: "no-profile",
        title: "Sessão inválida / sem perfil",
        status: "PASS",
        severity: "info",
        detail: `Token inválido não abriu gabinete (HTTP ${r.status || 0}).`,
      });
      narrative.push("[PASS] Sem perfil bloqueado.");
    }
  }

  // 8) IDOR autenticado
  if (cookie) {
    narrative.push(
      "[ATTACK] Sessão Superadmin + empresa_id de outro tenant"
    );
    const idor: string[] = [];
    for (const p of [
      `/api/scan-health?empresa_id=${FAKE_EMPRESA_B}`,
      `/api/datajud-worker?empresa_id=${FAKE_EMPRESA_B}`,
    ]) {
      const r = await safeFetch(`${base}${p}`, {
        method: p.includes("worker") ? "POST" : "GET",
        headers: { ...authHeaders, Authorization: "Bearer wrong" },
      });
      if (
        r.status === 200 &&
        looksLikeJsonDataLeak(r.text) &&
        !/Unauthorized|Forbidden|secret/i.test(r.text)
      ) {
        idor.push(p.split("?")[0]);
      }
    }
    if (idor.length) {
      steps.push(
        finding({
          id: "idor-auth",
          title: "IDOR autenticado (troca de empresa_id)",
          status: "FAIL",
          severity: "critical",
          detail: `Com sua sessão, API serviu outro tenant: ${idor.join(", ")}`,
          evidence: idor.join("; "),
          attack:
            "Reusou o Cookie de sessão do Superadmin logado e trocou só o parâmetro empresa_id para UUID alheio.",
          impact:
            "Mesmo autenticado, um usuário poderia ler/processar dados de outra empresa.",
          reproduction:
            "Logado no app, chamar /api/scan-health?empresa_id=<UUID-outra-empresa> com os mesmos cookies.",
          remediation:
            "Ignorar empresa_id da query. Usar exclusivamente ctx.empresa_id de getUserContext(). Workers: só secret de sistema.",
        })
      );
      narrative.push(`[FAIL] IDOR: ${idor.join(", ")}`);
    } else {
      steps.push({
        id: "idor-auth",
        title: "IDOR com sessão válida",
        status: "PASS",
        severity: "info",
        detail: "empresa_id forjado não alterou o escopo da sessão.",
      });
      narrative.push("[PASS] IDOR autenticado bloqueado.");
    }
  } else {
    steps.push({
      id: "idor-auth",
      title: "IDOR com sessão válida",
      status: "INFO",
      severity: "info",
      detail: "Cookie não disponível — vetor IDOR autenticado não executado.",
      remediation: "Repasse cookies sb-* na action para habilitar este teste.",
    });
  }

  // 9) Arquivos / traversal
  {
    narrative.push("[ATTACK] Path traversal e dotfiles (.env, .git)");
    const exposed: string[] = [];
    const paths = [
      ...SENSITIVE_PATHS,
      "/../../../etc/passwd",
      "/api/../../../.env",
      "/%2e%2e/%2e%2e/.env",
    ];
    for (const p of paths) {
      const r = await safeFetch(`${base}${p}`);
      if (
        r.status === 200 &&
        (p.includes(".env") ||
          p.includes(".git") ||
          /DATABASE_URL|SERVICE_ROLE|SECRET|passwd:|root:/i.test(r.text))
      ) {
        exposed.push(p);
      }
    }
    if (exposed.length) {
      steps.push(
        finding({
          id: "sensitive-files",
          title: "Exposição de segredos / path traversal",
          status: "FAIL",
          severity: "critical",
          detail: `Arquivos sensíveis legíveis: ${exposed.join(", ")}`,
          evidence: exposed.join("; "),
          attack: "GET direto a /.env, /.git e variantes de path traversal.",
          impact: "Vazamento de chaves Supabase, service role, senhas de banco.",
          reproduction: `curl -s '${base}/.env' | head`,
          remediation:
            "Vercel/hosting: não publique .env. Bloqueie dotfiles. Rotacione qualquer secret que tenha sido exposto.",
        })
      );
      narrative.push(`[FAIL] Exposto: ${exposed.join(", ")}`);
    } else {
      steps.push({
        id: "sensitive-files",
        title: "Arquivos sensíveis / traversal",
        status: "PASS",
        severity: "info",
        detail: ".env/.git/traversal não devolveram segredo.",
      });
      narrative.push("[PASS] Sem vazamento de arquivos.");
    }
  }

  // 10) Clickjacking + MIME
  {
    const r = await safeFetch(`${base}/login`);
    const xfo = (r.headers.get("x-frame-options") || "").toUpperCase();
    const csp = r.headers.get("content-security-policy") || "";
    const ok =
      xfo.includes("DENY") ||
      xfo.includes("SAMEORIGIN") ||
      /frame-ancestors\s+('none'|none)/i.test(csp);
    if (!ok) {
      steps.push(
        finding({
          id: "clickjacking",
          title: "Clickjacking",
          status: "FAIL",
          severity: "medium",
          detail: "Sem X-Frame-Options nem frame-ancestors efetivo em /login.",
          attack: "Inspecionou headers de /login para iframe embutível.",
          impact: "UI de login pode ser embutida em site malicioso (UI redress).",
          reproduction: `curl -sI '${base}/login' | grep -iE 'frame|content-security'`,
          remediation: "X-Frame-Options: DENY e CSP frame-ancestors 'none'.",
        })
      );
      narrative.push("[FAIL] Clickjacking aberto.");
    } else {
      steps.push({
        id: "clickjacking",
        title: "Clickjacking",
        status: "PASS",
        severity: "info",
        detail: `Proteção ativa (XFO=${xfo || "CSP"}).`,
      });
      narrative.push("[PASS] Anti-clickjacking OK.");
    }

    const r2 = await safeFetch(`${base}/`);
    const nosniff = (r2.headers.get("x-content-type-options") || "").toLowerCase();
    if (nosniff !== "nosniff") {
      steps.push(
        finding({
          id: "nosniff",
          title: "MIME sniffing",
          status: "FAIL",
          severity: "low",
          detail: "X-Content-Type-Options ausente ou incorreto.",
          attack: "Leitura do header X-Content-Type-Options na home.",
          impact: "Browser pode interpretar resposta como script (XSS de MIME).",
          reproduction: `curl -sI '${base}/' | grep -i content-type-options`,
          remediation: "X-Content-Type-Options: nosniff em todas as respostas.",
        })
      );
    } else {
      steps.push({
        id: "nosniff",
        title: "MIME sniffing",
        status: "PASS",
        severity: "info",
        detail: "X-Content-Type-Options=nosniff",
      });
    }
  }

  // 11) Métodos HTTP
  {
    narrative.push("[ATTACK] TRACE / PUT / DELETE na raiz");
    const weird: string[] = [];
    for (const m of ["TRACE", "PUT", "DELETE"] as const) {
      const r = await safeFetch(`${base}/`, { method: m });
      if (m === "TRACE" && r.status === 200 && /TRACE|Max-Forwards/i.test(r.text)) {
        weird.push(m);
      }
      if (
        (m === "PUT" || m === "DELETE") &&
        r.status === 200 &&
        looksLikeJsonDataLeak(r.text)
      ) {
        weird.push(m);
      }
    }
    if (weird.length) {
      steps.push(
        finding({
          id: "http-methods",
          title: "Métodos HTTP perigosos habilitados",
          status: "WARN",
          severity: "medium",
          detail: `Respostas suspeitas para: ${weird.join(", ")}`,
          attack: "Enviou TRACE/PUT/DELETE e analisou o corpo da resposta.",
          impact: "TRACE pode ecoar headers; PUT/DELETE podem mutar recurso.",
          reproduction: `curl -s -X TRACE '${base}/' -D -`,
          remediation: "Desabilite TRACE no edge; restrinja métodos nas rotas.",
        })
      );
    } else {
      steps.push({
        id: "http-methods",
        title: "Métodos HTTP perigosos",
        status: "PASS",
        severity: "info",
        detail: "TRACE/PUT/DELETE não expuseram dados.",
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = count(steps);
  const findings = steps
    .filter((s) => s.status === "FAIL" || s.status === "WARN")
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity]);

  let executiveSummary: string;
  if (summary.FAIL === 0 && summary.WARN === 0) {
    executiveSummary =
      "Nenhuma falha explorável encontrada nesta bateria. Continue com rate-limit de login, lockfile versionado e auditoria de ações.";
  } else {
    executiveSummary = `Encontrado(s) ${summary.FAIL} FAIL e ${summary.WARN} WARN. Priorize os findings critical/high abaixo: cada um descreve o ataque, o impacto e a correção.`;
  }

  narrative.push(
    `[PENTEST] Fim — PASS ${summary.PASS} · FAIL ${summary.FAIL} · WARN ${summary.WARN} · INFO ${summary.INFO}`
  );
  if (findings.length) {
    narrative.push("[PENTEST] Achados (ver cards com Ataque / Impacto / Correção):");
    for (const f of findings) {
      narrative.push(
        `  · [${f.severity.toUpperCase()}] ${f.title}: ${f.detail}`
      );
    }
  }

  return {
    startedAt,
    finishedAt,
    baseUrl: base,
    steps,
    findings,
    summary,
    narrative,
    executiveSummary,
  };
}
