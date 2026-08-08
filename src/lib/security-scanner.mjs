/**
 * LexisPredict — Security Scanner (motores de segurança).
 *
 * Motores disponíveis:
 *  - runCodeSecurity   : análise estática de vulnerabilidades (segredos, injection, XSS, exec...)
 *  - runOwasp          : mapeamento OWASP Top 10 (2021) com evidências do próprio codebase
 *  - runTrailOfBits    : revisão de segurança profunda (estilo Trail of Bits) com checklist e evidência
 *  - runSecurityReview : revisão agregada (score de exposição, grade, recomendações)
 *  - runAuditCodebase  : auditoria completa do repositório (segurança + engenharia)
 *  - runPonytail       : auditoria de over-engineering / débito (estilo Ponytail)
 *
 * Puro Node (fs + regex), sem dependências externas. Usado pela CLI
 * `npm run security` (scripts/security-scan.mjs) e pela aba Segurança
 * (server actions em src/app/actions/security-actions.ts).
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

const DEFAULT_ROOT = process.cwd();

function hasLockfile(root = DEFAULT_ROOT) {
  const names = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
  return names.some((n) => fs.existsSync(path.join(root, n)));
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  '.vercel',
  'dist',
  'build',
  'coverage',
  'reports',
  '.turbo',
  'out',
]);

const EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.css',
  '.html',
  '.md',
  '.yml',
  '.yaml',
  '.sql',
  '.prisma',
  '.graphql',
]);

const PUBLIC_PAGES = new Set(['login', 'signup', 'termos']);

const MAX_FINDINGS_PER_ENGINE = 200;
const MAX_FILE_BYTES = 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Utilidades de leitura                                               */
/* ------------------------------------------------------------------ */

export function listSourceFiles(root = DEFAULT_ROOT) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) stack.push(abs);
        continue;
      }
      if (e.name === 'package-lock.json' || e.name === 'pnpm-lock.yaml' || e.name === 'yarn.lock') continue;
      const ext = path.extname(e.name).toLowerCase();
      if (EXTENSIONS.has(ext) || e.name === '.env') files.push(abs);
    }
  }
  return files;
}

function readContent(abs) {
  try {
    const st = fs.statSync(abs);
    if (!st.isFile() || st.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
}

function loadSnapshot(root) {
  const files = listSourceFiles(root);
  const contents = [];
  for (const abs of files) {
    const rel = path.relative(root, abs).split(path.sep).join('/');
    const content = readContent(abs);
    if (content !== null) contents.push({ rel, content });
  }
  return contents;
}

function findContent(snapshot, rel) {
  const f = snapshot.find((x) => x.rel === rel);
  return f ? f.content : '';
}

function lineOf(content, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (content.charCodeAt(i) === 10) n++;
  return n;
}

function countLines(content) {
  let n = 0;
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) === 10) n++;
  return n + 1;
}

/* ------------------------------------------------------------------ */
/* Code Security — regras de análise estática                          */
/* ------------------------------------------------------------------ */

export const CODE_RULES = [
  {
    id: 'hardcoded_secret',
    severity: 'critical',
    label: 'Credencial / segredo hardcoded',
    pattern: /\b(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[0-9A-Za-z-]{10,}|ghp_[0-9A-Za-z]{36,}|glpat-[A-Za-z0-9_\-]{20,}|n8n_[A-Za-z0-9]{20,})\b/g,
    fix: 'Remova o segredo do código e use variável de ambiente (process.env / cofre).',
  },
  {
    id: 'private_key',
    severity: 'critical',
    label: 'Chave privada no código',
    pattern: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY-----/g,
    fix: 'Remova a chave privada do repositório e armazene em secret/cofre.',
  },
  {
    id: 'dangerous_eval',
    severity: 'high',
    label: 'eval / new Function',
    pattern: /\beval\s*\(|new\s+Function\s*\(/g,
    fix: 'Evite eval/Function com entrada externa; reestruture a lógica.',
  },
  {
    id: 'command_injection',
    severity: 'high',
    label: 'Execução de comando com entrada dinâmica',
    pattern: /(?<![\w.])exec(?:Sync)?\s*\(|(?<![\w.])spawn(?:Sync)?\s*\(|(?<![\w.])fork\s*\(/g,
    fix: 'Nunca interpole entrada do usuário em comandos; use execFile/args array e valide.',
  },
  {
    id: 'sql_injection',
    severity: 'high',
    label: 'Query SQL/raw com interpolação',
    pattern: /\.(?:sql|raw|executeQuery|query)\(?[`'"]?[\s\S]{0,120}\$\{/g,
    fix: 'Use prepared statements/parâmetros nomeados; nunca concatene entrada em SQL.',
  },
  {
    id: 'dom_xss',
    severity: 'high',
    label: 'innerHTML / outerHTML / document.write',
    pattern: /\.(?:innerHTML|outerHTML)\s*=|document\.write\s*\(/g,
    fix: 'Use textContent/React; sanitize ou evite injetar HTML com entrada.',
  },
  {
    id: 'dangerously_set_inner_html',
    severity: 'high',
    label: 'dangerouslySetInnerHTML',
    pattern: /dangerouslySetInnerHTML/g,
    fix: 'Evite; se necessário, sanitize o HTML antes de renderizar.',
  },
  {
    id: 'wildcard_cors',
    severity: 'high',
    label: 'CORS com origem *',
    pattern: /Access-Control-Allow-Origin\s*[=:]\s*['"]?\*/g,
    fix: 'Restrinja Access-Control-Allow-Origin às origens confiáveis.',
  },
  {
    id: 'path_traversal',
    severity: 'medium',
    label: 'Leitura/escrita de arquivo com entrada dinâmica',
    pattern: /\b(?:readFile|readFileSync|writeFile|writeFileSync|readdir|createReadStream|createWriteStream|unlink|rm|stat|existsSync)\([^)]*\$\{|path\.(?:join|resolve|normalize)\([^)]*\+/g,
    fix: 'Valide/normalize caminhos (prefixo permitido + path.resolve); nunca use entrada bruta.',
  },
  {
    id: 'ssrf',
    severity: 'medium',
    label: 'fetch com URL dinâmica',
    pattern: /\bfetch\s*\([`'"][^`'"]*\$\{/g,
    fix: 'Valide/allowlist os hosts; evite buscar URL controlada pelo usuário.',
  },
  {
    id: 'weak_crypto',
    severity: 'medium',
    label: 'Hash/cifra fraca',
    pattern: /createHash\s*\(\s*['"](?:md5|sha1|md4|sha1)['"]|createCipher(?:iv)?\s*\([^)]*['"](?:des|aes-?128-?ecb)['"]/gi,
    fix: 'Use sha256+ ou algoritmo moderno (bcrypt/argon2/scrypt para senhas).',
  },
  {
    id: 'hardcoded_password',
    severity: 'medium',
    label: 'Senha/segredo hardcoded',
    pattern: /\b(?:password|passwd|pwd|senha|api[_-]?key|secret|token)\s*[=:]\s*['"`][^'"`\s]{6,}['"`]/gi,
    fix: 'Use process.env para credenciais; nunca fixe valores no código.',
  },
  {
    id: 'plaintext_http',
    severity: 'low',
    label: 'Requisição HTTP sem TLS',
    pattern: /\bfetch\s*\(\s*['"`]http:\/\/[^'"`]*['"`]/g,
    fix: 'Use HTTPS; HTTP apenas para localhost/ambiente de teste.',
  },
  {
    id: 'sensitive_log',
    severity: 'low',
    label: 'Log de dado sensível',
    pattern: /console\.(?:log|info|debug)\([^)]*\b(?:senha|password|passwd|token|secret|authorization|bearer)\b/gi,
    fix: 'Nunca registre credenciais; logue apenas IDs/tratamentos.',
  },
  {
    id: 'debug_log',
    severity: 'info',
    label: 'console.log em produção',
    pattern: /\bconsole\.log\s*\(/g,
    fix: 'Remova ou use logger condicionado por ambiente.',
  },
];

function scanWithRules(content, rules) {
  const out = [];
  for (const r of rules) {
    r.pattern.lastIndex = 0;
    let m;
    while ((m = r.pattern.exec(content)) !== null) {
      out.push({
        rule: r.id,
        severity: r.severity,
        label: r.label,
        fix: r.fix,
        line: lineOf(content, m.index),
        match: (m[0] || '').slice(0, 140),
      });
      if (out.length >= MAX_FINDINGS_PER_ENGINE) return out;
      if (m.index === r.pattern.lastIndex) r.pattern.lastIndex++;
    }
  }
  return out;
}

function isEnvFile(rel) {
  return rel === '.env' || rel.startsWith('.env.');
}

export function runCodeSecurity(root = DEFAULT_ROOT) {
  const snapshot = loadSnapshot(root);
  const findings = [];
  const toolFiles = new Set(['src/lib/security-scanner.mjs', 'scripts/security-scan.mjs']);
  for (const f of snapshot) {
    if (isEnvFile(f.rel) || toolFiles.has(f.rel)) continue;
    const hits = scanWithRules(f.content, CODE_RULES);
    for (const h of hits) findings.push({ ...h, file: f.rel });
  }
  findings.sort((a, b) => SEVERITY_ORDER(b.severity) - SEVERITY_ORDER(a.severity));
  return {
    engine: 'Code Security',
    findings: findings.slice(0, MAX_FINDINGS_PER_ENGINE),
    total: findings.length,
    counts: countSeverities(findings),
    scannedFiles: snapshot.length,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Helper de severidade                                                */
/* ------------------------------------------------------------------ */

const SEVERITY_WEIGHT = { critical: 15, high: 8, medium: 4, low: 1.5, info: 0.5 };
const SEVERITY_ORDER = (s) => (SEVERITY_ORDER.rank[s] ?? 0);
SEVERITY_ORDER.rank = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

function countSeverities(findings) {
  const c = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) if (c[f.severity] !== undefined) c[f.severity]++;
  return c;
}

function exposureScore(findings) {
  let sum = 0;
  for (const f of findings) sum += SEVERITY_WEIGHT[f.severity] ?? 0;
  return Math.max(0, Math.min(100, Math.round(100 - sum)));
}

function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function statusFromCounts(c) {
  if (c.critical > 0 || c.high > 0) return 'FAIL';
  if (c.medium > 0) return 'WARN';
  if (c.low > 0 || c.info > 0) return 'REVIEW';
  return 'PASS';
}

/* ------------------------------------------------------------------ */
/* OWASP Top 10 (2021)                                                 */
/* ------------------------------------------------------------------ */

const SECURITY_HEADERS = [
  'X-Frame-Options',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'Permissions-Policy',
];

let npmAuditCache = null;

export function runNpmAudit(root = DEFAULT_ROOT) {
  if (npmAuditCache) return npmAuditCache;
  const promise = new Promise((resolve) => {
    const hasLock =
      fs.existsSync(path.join(root, 'package-lock.json')) ||
      fs.existsSync(path.join(root, 'yarn.lock')) ||
      fs.existsSync(path.join(root, 'pnpm-lock.yaml'));
    if (!hasLock) {
      resolve({ ok: false, error: 'Sem package-lock.json/yarn.lock/pnpm-lock.yaml detectado na raiz no repositório.', counts: null, details: [] });
      return;
    }
    exec(
      'npm audit --json --omit=dev',
      { cwd: root, timeout: 60000, maxBuffer: 20 * 1024 * 1024, windowsHide: true },
      (err, stdout) => {
        try {
          const data = JSON.parse(stdout || '{}');
          const v = data.vulnerabilities || {};
          const counts = { critical: 0, high: 0, moderate: 0, low: 0 };
          const details = [];
          for (const name of Object.keys(v)) {
            const c = v[name];
            if (!c || !c.severity) continue;
            const sev = c.severity === 'moderate' ? 'moderate' : c.severity;
            if (counts[sev] !== undefined) counts[sev]++;
            details.push({
              name,
              severity: sev,
              fix: typeof c.fixAvailable === 'object' && c.fixAvailable ? `atualizar para ${c.fixAvailable.version || ''}`.trim() : 'verificar upstream',
              via: (c.via || []).slice(0, 3).map((x) => (typeof x === 'string' ? x : x.title || x.url || '')).filter(Boolean),
            });
          }
          resolve({ ok: true, counts, total: Object.keys(v).length, details: details.slice(0, 20) });
        } catch {
          resolve({ ok: false, error: 'npm audit indisponível neste ambiente.', counts: null, details: [] });
        }
      }
    );
  });
  npmAuditCache = promise;
  return promise;
}

export async function runOwasp(root = DEFAULT_ROOT) {
  const snapshot = loadSnapshot(root);
  const code = runCodeSecurity(root);
  const byRule = {};
  for (const f of code.findings) (byRule[f.rule] = byRule[f.rule] || []).push(f);

  const mw = findContent(snapshot, 'src/middleware.ts') || findContent(snapshot, 'middleware.ts');
  const missingHeaders = SECURITY_HEADERS.filter((h) => !mw.includes(h));

  const pages = snapshot.filter((f) => f.rel.startsWith('src/app/') && f.rel.endsWith('/page.tsx'));
  const unprotected = [];
  for (const p of pages) {
    const folder = p.rel.split('/').slice(0, -1).pop() || '';
    if (PUBLIC_PAGES.has(folder)) continue;
    if (/_not-found|\(api\)|_app|layout/.test(p.rel)) continue;
    if (!/\b(useAuth|getUserContext|profile|isAdmin|cargo)\b/.test(p.content)) unprotected.push(p.rel);
  }

  const audit = await runNpmAudit(root);
  const authText = snapshot
    .filter((f) => /(login|signup|auth)/i.test(f.rel))
    .map((f) => f.content)
    .join('\n');
  const hasRateLimit = /\b(rateLimit|rate-limiter|limiter|maxAttempts|lockout|tooManyRequests)\b/i.test(authText);
  const hasPasswordHashing = /\b(bcrypt|argon2|scrypt)\b/i.test(authText);
  const hasAudit = snapshot.some((f) => /auditoria_logs_app|registrarAuditoriaAction/.test(f.content));
  const hasLockfile = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'].some((f) => fs.existsSync(path.join(root, f)));

  const allFindings = code.findings;
  const f = (rule) => byRule[rule] || [];

  const categories = [
    {
      id: 'A01',
      name: 'Broken Access Control',
      status: unprotected.length ? 'FAIL' : 'PASS',
      summary: `${unprotected.length} página(s) sem referência visível a autenticação/autorização (useAuth/profile).`,
      evidence: unprotected.slice(0, 12),
      recommendation: 'Adicione guarda de autenticação/autorização em cada rota sensível (página + server action).',
    },
    {
      id: 'A02',
      name: 'Cryptographic Failures',
      status: f('weak_crypto').length || f('plaintext_http').length ? 'WARN' : 'PASS',
      summary: `${f('weak_crypto').length} hash/cifra fraca · ${f('plaintext_http').length} requisição HTTP sem TLS.`,
      evidence: [...f('weak_crypto'), ...f('plaintext_http')].slice(0, 8).map((x) => `${x.file}:${x.line} — ${x.label}`),
      recommendation: 'Use TLS 1.2+ e algoritmos modernos (SHA-256+, bcrypt/argon2/scrypt para senhas).',
    },
    {
      id: 'A03',
      name: 'Injection',
      status: f('sql_injection').length || f('command_injection').length || f('dangerous_eval').length ? 'FAIL' : 'PASS',
      summary: `${f('sql_injection').length} SQL · ${f('command_injection').length} command · ${f('dangerous_eval').length} eval.`,
      evidence: [...f('sql_injection'), ...f('command_injection'), ...f('dangerous_eval')].slice(0, 8).map((x) => `${x.file}:${x.line} — ${x.label}`),
      recommendation: 'Parametrize consultas, evite eval e não interpole entrada em comandos do sistema.',
    },
    {
      id: 'A04',
      name: 'Insecure Design',
      status: 'REVIEW',
      summary: 'Revisão de desenho sugerida para fluxos que consomem fontes externas (DataJud/DJEN), uploads e peças geradas.',
      evidence: allFindings.filter((x) => x.rule === 'ssrf').slice(0, 5).map((x) => `${x.file}:${x.line} — ${x.label}`),
      recommendation: 'Modele ameaças por fluxo (STRIDE) e adote validação, limites e sanitização por padrão.',
    },
    {
      id: 'A05',
      name: 'Security Misconfiguration',
      status: missingHeaders.length ? 'FAIL' : 'PASS',
      summary: missingHeaders.length
        ? `Faltam ${missingHeaders.length} header(s) de segurança no middleware: ${missingHeaders.join(', ')}.`
        : 'Headers de segurança presentes no middleware.',
      evidence: missingHeaders.map((h) => `Faltando: ${h}`),
      recommendation: 'Adicione CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy e Permissions-Policy.',
    },
    {
      id: 'A06',
      name: 'Vulnerable & Outdated Components',
      status: !audit.ok ? 'REVIEW' : (audit.counts.critical + audit.counts.high) > 0 ? 'FAIL' : 'PASS',
      summary: audit.ok
        ? `npm audit: ${audit.counts.critical} crítica · ${audit.counts.high} alta · ${audit.counts.moderate} média · ${audit.counts.low} baixa.`
        : (audit.error || 'npm audit indisponível.'),
      evidence: (audit.details || []).slice(0, 10).map((d) => `[${d.severity}] ${d.name} — ${d.fix}`),
      recommendation: 'Mantenha dependências atualizadas e remova pacotes vulneráveis (npm audit fix).',
    },
    {
      id: 'A07',
      name: 'Identification & Authentication Failures',
      status: hasRateLimit ? 'PASS' : 'WARN',
      summary: hasRateLimit
        ? 'Proteção de brute force (rate limit/lockout) detectada nos fluxos de login.'
        : 'Sem evidência de rate limit/lockout nos fluxos de autenticação.' + (hasPasswordHashing ? ' Hashing moderno detectado (Supabase gerencia).' : ''),
      evidence: hasPasswordHashing ? ['Hashing de senha delegado (bcrypt/argon2/scrypt/Supabase).'] : [],
      recommendation: 'Adicione rate limiting e bloqueio por tentativas no login; use MFA em contas privilegiadas.',
    },
    {
      id: 'A08',
      name: 'Software & Data Integrity',
      status: hasLockfile ? 'PASS' : 'FAIL',
      summary: hasLockfile ? 'Lockfile presente — dependências pinadas por integridade.' : 'Sem package-lock.json/yarn.lock/pnpm-lock.yaml detectado na raiz.',
      evidence: [],
      recommendation: 'Mantenha o lockfile versionado e pin versões das dependências críticas.',
    },
    {
      id: 'A09',
      name: 'Security Logging & Monitoring',
      status: hasAudit ? 'PASS' : 'WARN',
      summary: hasAudit ? 'Logs de auditoria de ações detectados (auditoria_logs_app).' : 'Sem evidência de trilha de auditoria de ações.',
      evidence: hasAudit ? ['Trilha: auditoria_logs_app + auditoria_logins.'] : [],
      recommendation: 'Registre falhas de autenticação/autorização e monitore anomalias (alertas).',
    },
    {
      id: 'A10',
      name: 'SSRF',
      status: f('ssrf').length ? 'WARN' : 'PASS',
      summary: `${f('ssrf').length} chamada(s) com URL dinâmica encontrada(s).`,
      evidence: f('ssrf').slice(0, 8).map((x) => `${x.file}:${x.line} — ${x.label}`),
      recommendation: 'Allowlist de hosts, validação de CNJ/tribunal e restrição de destinos nos fetchers externos.',
    },
  ];

  const c = { PASS: 0, WARN: 0, REVIEW: 0, FAIL: 0 };
  for (const cat of categories) c[cat.status]++;
  return {
    engine: 'OWASP Top 10',
    categories,
    counts: c,
    scannedFiles: snapshot.length,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Trail of Bits — revisão de segurança profunda                       */
/* ------------------------------------------------------------------ */

export async function runTrailOfBits(root = DEFAULT_ROOT) {
  const snapshot = loadSnapshot(root);
  const serverFiles = snapshot.filter((f) => f.content.includes("'use server'"));
  const withCtx = serverFiles.filter((f) => /\bgetUserContext\b/.test(f.content));
  const withEmpresa = serverFiles.filter((f) => /\bempresa_id\b/.test(f.content));
  const withValidation = serverFiles.filter((f) => /\bzod\b|\.safeParse\(|\.parse\(/.test(f.content));
  const leaking = serverFiles.filter((f) => /e\?\.message|e\.message/.test(f.content));

  const code = runCodeSecurity(root);
  const byRule = {};
  for (const f of code.findings) (byRule[f.rule] = byRule[f.rule] || []).push(f);

  const mw = findContent(snapshot, 'src/middleware.ts') || findContent(snapshot, 'middleware.ts');
  const missingHeaders = SECURITY_HEADERS.filter((h) => !mw.includes(h));
  const cookieText = snapshot.filter((f) => /supabase|ssr|cookie/i.test(f.rel)).map((f) => f.content).join('\n');
  const hasHttpOnly = /httpOnly|HttpOnly/.test(cookieText);
  const hasSameSite = /SameSite|sameSite/.test(cookieText);

  const audit = await runNpmAudit(root);
  const authText = snapshot.filter((f) => /(login|signup|auth)/i.test(f.rel)).map((f) => f.content).join('\n');
  const hasRateLimit = /\b(rateLimit|rate-limiter|limiter|maxAttempts|lockout)\b/i.test(authText);
  const hasCsp = mw.includes('Content-Security-Policy');

  const pct = (a, b) => (b === 0 ? 100 : Math.round((a / b) * 100));

  const checks = [
    {
      title: 'Autenticação em ações de servidor',
      status: serverFiles.length && withCtx.length === 0 ? 'FAIL' : pct(withCtx.length, serverFiles.length) >= 90 ? 'PASS' : 'WARN',
      detail: `${withCtx.length}/${serverFiles.length} arquivos 'use server' chamam getUserContext (${pct(withCtx.length, serverFiles.length)}%).`,
      files: serverFiles.filter((f) => !withCtx.includes(f)).slice(0, 8).map((f) => f.rel),
      fix: 'Todo server action que expõe dados precisa confirmar sessão (getUserContext).',
    },
    {
      title: 'Escopo multi-tenant por empresa',
      status: withEmpresa.length && withEmpresa.length >= withCtx.length * 0.7 ? 'PASS' : 'WARN',
      detail: `${withEmpresa.length} arquivos filtram por empresa_id.`,
      files: serverFiles.filter((f) => withCtx.includes(f) && !withEmpresa.includes(f)).slice(0, 8).map((f) => f.rel),
      fix: 'Garanta que toda consulta respeite o escopo empresa_id do contexto.',
    },
    {
      title: 'Validação de entrada nas ações',
      status: withValidation.length >= serverFiles.length * 0.4 ? 'PASS' : 'WARN',
      detail: `${withValidation.length}/${serverFiles.length} arquivos usam zod/parse para validar entrada.`,
      files: [],
      fix: 'Valide tipos e tamanhos de todas as entradas de server actions.',
    },
    {
      title: 'Rate limiting em rotas públicas',
      status: hasRateLimit ? 'PASS' : 'WARN',
      detail: hasRateLimit ? 'Rate limit/lockout detectado.' : 'Sem evidência de rate limiting em login/APIs públicas.',
      files: [],
      fix: 'Aplique limite de requisições por IP/usuário nas rotas sensíveis.',
    },
    {
      title: 'Cabeçalhos de segurança (CSP/HSTS)',
      status: missingHeaders.length ? 'FAIL' : 'PASS',
      detail: missingHeaders.length ? `Faltam: ${missingHeaders.join(', ')}.` : 'Headers de segurança presentes.',
      files: missingHeaders.map((h) => `Faltando: ${h}`),
      fix: 'Configure CSP restritivo, HSTS e anti-clickjacking no middleware.',
    },
    {
      title: 'Higiene de segredos',
      status: byRule.hardcoded_secret?.length || byRule.private_key?.length ? 'FAIL' : 'PASS',
      detail: `${byRule.hardcoded_secret?.length || 0} credencial hardcoded · ${byRule.private_key?.length || 0} chave privada.`,
      files: (byRule.hardcoded_secret || []).concat(byRule.private_key || []).slice(0, 8).map((x) => `${x.file}:${x.line}`),
      fix: 'Varredura de segredos no CI (trufflehog/gitleaks) e rotação imediata de qualquer segredo vazado.',
    },
    {
      title: 'SSRF — controle de destinos externos',
      status: byRule.ssrf?.length ? 'WARN' : 'PASS',
      detail: `${byRule.ssrf?.length || 0} fetch com URL dinâmica.`,
      files: (byRule.ssrf || []).slice(0, 8).map((x) => `${x.file}:${x.line}`),
      fix: 'Allowlist de hosts e validação de CNJ/tribunal antes de consultas externas.',
    },
    {
      title: 'Dependências auditadas',
      status: !audit.ok ? 'REVIEW' : (audit.counts.critical + audit.counts.high) > 0 ? 'FAIL' : 'PASS',
      detail: audit.ok ? `npm audit: ${audit.counts.critical} crítica · ${audit.counts.high} alta.` : (audit.error || 'npm audit indisponível.'),
      files: (audit.details || []).slice(0, 8).map((d) => `[${d.severity}] ${d.name}`),
      fix: 'Aplicar npm audit fix e revisar versões de pacotes transitivos.',
    },
    {
      title: 'Cookies de sessão (httpOnly/SameSite)',
      status: hasHttpOnly && hasSameSite ? 'PASS' : 'WARN',
      detail: `httpOnly: ${hasHttpOnly ? 'ok' : 'não detectado'} · SameSite: ${hasSameSite ? 'ok' : 'não detectado'}.`,
      files: [],
      fix: 'Garanta httpOnly, SameSite e Secure nos cookies de sessão.',
    },
    {
      title: 'Erros não vazam detalhes internos',
      status: leaking.length ? 'REVIEW' : 'PASS',
      detail: `${leaking.length} arquivos devolvem e?.message ao cliente — revise para não expor detalhes internos.`,
      files: leaking.slice(0, 8).map((f) => f.rel),
      fix: 'Retorne mensagens genéricas e registre o detalhe técnico internamente.',
    },
    {
      title: 'CSP restritivo ativo',
      status: hasCsp ? 'PASS' : 'FAIL',
      detail: hasCsp ? 'Content-Security-Policy presente.' : 'Sem Content-Security-Policy no middleware.',
      files: [],
      fix: 'Defina CSP que bloqueie inline scripts e origens não confiáveis.',
    },
  ];

  const c = { PASS: 0, WARN: 0, REVIEW: 0, FAIL: 0 };
  for (const ch of checks) c[ch.status]++;
  return {
    engine: 'Trail of Bits Review',
    checks,
    counts: c,
    scannedFiles: snapshot.length,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Security Review — score agregado                                    */
/* ------------------------------------------------------------------ */

export async function runSecurityReview(root = DEFAULT_ROOT) {
  const code = runCodeSecurity(root);
  const owasp = await runOwasp(root);
  const score = exposureScore(code.findings);
  const top = code.findings.slice(0, 10).map((f) => ({ file: f.file, line: f.line, severity: f.severity, label: f.label }));
  const recos = [];
  const seen = new Set();
  for (const f of code.findings) {
    if (f.severity === 'critical' || f.severity === 'high') {
      if (!seen.has(f.fix)) {
        seen.add(f.fix);
        recos.push(f.fix);
      }
    }
  }
  for (const cat of owasp.categories) {
    if (cat.status === 'FAIL' && !recos.includes(cat.recommendation)) recos.push(cat.recommendation);
  }
  const failCount = owasp.categories.filter((c) => c.status === 'FAIL').length;
  return {
    engine: 'Security Review',
    score,
    grade: gradeFor(score),
    counts: code.counts,
    totalFindings: code.total,
    owaspFail: failCount,
    status: score >= 75 ? 'PASS' : score >= 60 ? 'WARN' : 'FAIL',
    top,
    recommendations: recos.slice(0, 12),
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Ponytail — auditoria de over-engineering / débito                   */
/* ------------------------------------------------------------------ */

export function runPonytail(root = DEFAULT_ROOT) {
  const snapshot = loadSnapshot(root);
  const findings = [];

  const commented = /^\s*\/\/\s*(?:const|let|var|function|if\s*\(|for\s*\(|while\s*\(|return|async|await|import|export)\b/gm;
  for (const f of snapshot) {
    let n = 0;
    commented.lastIndex = 0;
    let m;
    while ((m = commented.exec(f.content)) !== null) n++;
    if (n >= 5) {
      findings.push({
        rule: 'commented_code',
        severity: 'low',
        label: `Bloco de código comentado (${n} ocorrências)`,
        fix: 'Remova código morto em vez de deixá-lo comentado.',
        file: f.rel,
        line: lineOf(f.content, commented.lastIndex > 0 ? Math.max(0, commented.lastIndex - 1) : 0),
        match: 'código comentado',
      });
    }
  }

  for (const f of snapshot) {
    const re = /\bconsole\.log\s*\(/g;
    let n = 0;
    re.lastIndex = 0;
    while (re.exec(f.content)) n++;
    if (n > 0) {
      findings.push({
        rule: 'debug_log',
        severity: 'info',
        label: `console.log deixado (${n})`,
        fix: 'Remova ou troque por logger condicionado.',
        file: f.rel,
        line: 1,
        match: 'console.log',
      });
    }
  }

  for (const f of snapshot) {
    if (f.rel.startsWith('src/') && countLines(f.content) > 700) {
      findings.push({
        rule: 'monolith_file',
        severity: 'low',
        label: `Arquivo monolítico (${countLines(f.content)} linhas)`,
        fix: 'Quebre em módulos menores de responsabilidade única.',
        file: f.rel,
        line: 1,
        match: 'arquivo longo',
      });
    }
  }

  const defs = new Map();
  for (const f of snapshot) {
    const re = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+const\s+([A-Za-z_$][\w$]*)\s*=/g;
    let m;
    while ((m = re.exec(f.content)) !== null) {
      const name = m[1] || m[2];
      if (!name) continue;
      if (!defs.has(name)) defs.set(name, []);
      defs.get(name).push(f.rel);
    }
  }
  for (const [name, files] of defs) {
    const uniq = [...new Set(files)];
    if (uniq.length > 1) {
      findings.push({
        rule: 'duplicate_definition',
        severity: 'medium',
        label: `Função exportada ${name} definida em ${uniq.length} arquivos`,
        fix: 'Centralize em um único módulo e importe onde precisar.',
        file: uniq[0],
        line: 1,
        match: name,
      });
    }
  }

  let pkg = null;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    /* sem package.json */
  }
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    const srcText = snapshot.map((f) => f.content).join('\n');
    const unused = [];
    for (const name of Object.keys(deps)) {
      if (name.startsWith('@types/')) continue;
      if (name === 'next' || name === 'react' || name === 'react-dom') continue;
      if (name === 'typescript' || name === 'tailwindcss' || name === 'postcss' || name === 'autoprefixer') continue;
      if (!srcText.includes(name)) unused.push(name);
    }
    if (unused.length) {
      findings.push({
        rule: 'unused_dependency',
        severity: 'info',
        label: `Dependência(s) sem referência no código (${unused.length})`,
        fix: 'Confirme e remova dependências não utilizadas para reduzir superfície de ataque.',
        file: 'package.json',
        line: 1,
        match: unused.slice(0, 10).join(', '),
      });
    }
  }

  const todo = [];
  for (const f of snapshot) {
    const re = /\/\/\s*(?:TODO|FIXME|XXX|HACK)\b/g;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(f.content)) !== null) {
      todo.push(`${f.rel}:${lineOf(f.content, m.index)}`);
      if (todo.length > 30) break;
    }
    if (todo.length > 30) break;
  }
  if (todo.length) {
    findings.push({
      rule: 'deferred_debt',
      severity: 'info',
      label: `Débito adiado (${todo.length} TODO/FIXME/XXX/HACK)`,
      fix: 'Cadastre em ledger e priorize correções de segurança primeiro.',
      file: todo[0].split(':')[0],
      line: Number(todo[0].split(':')[1]) || 1,
      match: 'TODO/FIXME',
    });
  }

  findings.sort((a, b) => SEVERITY_ORDER(b.severity) - SEVERITY_ORDER(a.severity));
  return {
    engine: 'Ponytail Audit',
    findings: findings.slice(0, MAX_FINDINGS_PER_ENGINE),
    total: findings.length,
    counts: countSeverities(findings),
    scannedFiles: snapshot.length,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Audit Codebase (segurança + engenharia) e varredura completa        */
/* ------------------------------------------------------------------ */

export async function runAuditCodebase(root = DEFAULT_ROOT) {
  const code = runCodeSecurity(root);
  const ponytail = runPonytail(root);
  const combined = [...code.findings, ...ponytail.findings].sort(
    (a, b) => SEVERITY_ORDER(b.severity) - SEVERITY_ORDER(a.severity)
  );
  return {
    engine: 'Audit Codebase',
    findings: combined.slice(0, MAX_FINDINGS_PER_ENGINE),
    total: combined.length,
    counts: countSeverities(combined),
    codeSecurity: { total: code.total, counts: code.counts },
    ponytail: { total: ponytail.total, counts: ponytail.counts },
    scannedFiles: code.scannedFiles,
    generatedAt: new Date().toISOString(),
  };
}

export async function runFullScan(root = DEFAULT_ROOT) {
  const code = runCodeSecurity(root);
  const owasp = await runOwasp(root);
  const tob = await runTrailOfBits(root);
  const ponytail = runPonytail(root);
  const combined = [...code.findings, ...ponytail.findings];
  const score = exposureScore(combined);
  const recos = [];
  const seen = new Set();
  for (const f of code.findings) {
    if ((f.severity === 'critical' || f.severity === 'high') && !seen.has(f.fix)) {
      seen.add(f.fix);
      recos.push(f.fix);
    }
  }
  for (const cat of owasp.categories) {
    if (cat.status === 'FAIL' && !recos.includes(cat.recommendation)) recos.push(cat.recommendation);
  }
  return {
    engines: {
      codeSecurity: {
        total: code.total,
        counts: code.counts,
        findings: code.findings,
      },
      owasp: {
        categories: owasp.categories,
        counts: owasp.counts,
      },
      trailOfBits: {
        checks: tob.checks,
        counts: tob.counts,
      },
      ponytail: {
        total: ponytail.total,
        counts: ponytail.counts,
        findings: ponytail.findings,
      },
    },
    review: {
      score,
      grade: gradeFor(score),
      counts: countSeverities(combined),
      totalFindings: combined.length,
      owaspFail: owasp.categories.filter((c) => c.status === 'FAIL').length,
      status: score >= 75 ? 'PASS' : score >= 60 ? 'WARN' : 'FAIL',
      recommendations: recos.slice(0, 12),
    },
    scannedFiles: code.scannedFiles,
    generatedAt: new Date().toISOString(),
  };
}
