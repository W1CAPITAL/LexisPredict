/**
 * LexisPredict — CLI de auditoria de segurança do codebase.
 * Executa todos os motores e gera relatórios em reports/:
 *   - reports/security-report.json   (dados completos)
 *   - reports/security-report.md     (relatório legível)
 * Uso: npm run security
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  runFullScan,
  runCodeSecurity,
  runOwasp,
  runTrailOfBits,
  runSecurityReview,
  runAuditCodebase,
  runPonytail,
} from '../src/lib/security-scanner.mjs';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'reports');

const BAR = (n) => '█'.repeat(Math.max(0, Math.min(20, Math.round(n))));

function fmtCounts(c) {
  const parts = [];
  if (c.critical) parts.push(`critica ${c.critical}`);
  if (c.high) parts.push(`alta ${c.high}`);
  if (c.medium) parts.push(`media ${c.medium}`);
  if (c.low) parts.push(`baixa ${c.low}`);
  if (c.info) parts.push(`info ${c.info}`);
  return parts.length ? parts.join(', ') : 'limpo';
}

async function main() {
  const only = process.argv[2];
  console.log('\nLexisPredict — Security Scanner');
  console.log(`Raiz: ${ROOT}\n`);

  let data;
  if (only === 'code') {
    data = runCodeSecurity(ROOT);
    console.log(`[Code Security] ${data.total} achado(s) — ${fmtCounts(data.counts)}`);
  } else if (only === 'owasp') {
    data = await runOwasp(ROOT);
  } else if (only === 'tob') {
    data = await runTrailOfBits(ROOT);
  } else if (only === 'review') {
    data = await runSecurityReview(ROOT);
  } else if (only === 'audit') {
    data = await runAuditCodebase(ROOT);
  } else if (only === 'ponytail') {
    data = runPonytail(ROOT);
  } else {
    console.log('Executando varredura completa (Code + OWASP + Trail of Bits + Ponytail)...\n');
    data = await runFullScan(ROOT);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'security-report.json'), JSON.stringify(data, null, 2));

  const md = renderMarkdown(data, only || 'full');
  fs.writeFileSync(path.join(OUT_DIR, 'security-report.md'), md);

  console.log(renderConsole(data));
  console.log(`Relatórios: reports/security-report.md e reports/security-report.json`);
}

function renderConsole(data) {
  const lines = [];
  const engines = data.engines || {};
  const review = data.review || null;

  if (review) {
    lines.push(`SCORE DE EXPOSICAO: ${review.score}/100 (grade ${review.grade}) — ${review.status}`);
    lines.push(`Achados: ${review.totalFindings} · OWASP com falha: ${review.owaspFail}`);
    lines.push('');
  }
  if (engines.codeSecurity) {
    lines.push(`[Code Security] ${engines.codeSecurity.total} achado(s) — ${fmtCounts(engines.codeSecurity.counts)}`);
  }
  if (engines.owasp) {
    lines.push(`[OWASP Top 10] ${engines.owasp.counts.PASS} ok · ${engines.owasp.counts.WARN} warn · ${engines.owasp.counts.FAIL} fail`);
  }
  if (engines.trailOfBits) {
    lines.push(`[Trail of Bits] ${engines.trailOfBits.counts.PASS} ok · ${engines.trailOfBits.counts.WARN} warn · ${engines.trailOfBits.counts.FAIL} fail`);
  }
  if (engines.ponytail) {
    lines.push(`[Ponytail] ${engines.ponytail.total} achado(s) — ${fmtCounts(engines.ponytail.counts)}`);
  }
  if (data.findings) {
    lines.push(`[${data.engine}] ${data.total} achado(s) — ${fmtCounts(data.counts)}`);
  }
  if (data.categories) {
    lines.push(`[${data.engine}] ${data.counts.PASS} ok · ${data.counts.WARN} warn · ${data.counts.REVIEW} review · ${data.counts.FAIL} fail`);
    for (const cat of data.categories) {
      lines.push(`  ${cat.id} ${cat.name}: ${cat.status} — ${cat.summary}`);
    }
  }
  if (data.checks) {
    for (const ch of data.checks) lines.push(`  ${ch.status} — ${ch.title}: ${ch.detail}`);
  }
  if (review && review.recommendations.length) {
    lines.push('');
    lines.push('Recomendacoes:');
    review.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  if (data.top) {
    lines.push('');
    lines.push('Top achados:');
    for (const t of data.top.slice(0, 10)) lines.push(`  [${t.severity}] ${t.file}:${t.line} — ${t.label}`);
  }
  return lines.join('\n');
}

function renderMarkdown(data, kind) {
  const L = [];
  L.push('# LexisPredict — Security Report');
  L.push('');
  L.push(`Gerado em: ${new Date().toISOString()} · Motor: ${kind}`);
  L.push('');

  const engines = data.engines;
  const review = data.review || null;
  if (review) {
    L.push('## Resumo');
    L.push('');
    L.push(`- Score de exposição: **${review.score}/100** (grade ${review.grade})`);
    L.push(`- Achados: ${review.totalFindings}`);
    L.push(`- OWASP com falha: ${review.owaspFail}`);
    L.push('');
    if (review.recommendations.length) {
      L.push('### Recomendações');
      L.push('');
      review.recommendations.forEach((r, i) => L.push(`${i + 1}. ${r}`));
      L.push('');
    }
  }

  if (engines?.codeSecurity || (kind === 'code')) {
    L.push('## Code Security');
    L.push('');
    L.push('| Severidade | Arquivo | Linha | Regra | Detalhe |');
    L.push('|---|---|---|---|---|');
    for (const f of data.engines?.codeSecurity?.findings || data.findings || []) {
      L.push(`| ${f.severity} | \`${f.file}:${f.line}\` | ${f.line} | ${f.label} | ${String(f.match || '').slice(0, 80)} |`);
    }
    L.push('');
  }

  if (engines?.owasp || data.categories) {
    L.push('## OWASP Top 10');
    L.push('');
    L.push('| ID | Categoria | Status | Resumo |');
    L.push('|---|---|---|---|');
    for (const cat of data.engines?.owasp?.categories || data.categories || []) {
      L.push(`| ${cat.id} | ${cat.name} | ${cat.status} | ${cat.summary} |`);
    }
    L.push('');
  }

  if (engines?.trailOfBits || data.checks) {
    L.push('## Trail of Bits Review');
    L.push('');
    L.push('| Status | Check | Detalhe |');
    L.push('|---|---|---|');
    for (const ch of data.engines?.trailOfBits?.checks || data.checks || []) {
      L.push(`| ${ch.status} | ${ch.title} | ${ch.detail} |`);
    }
    L.push('');
  }

  if (engines?.ponytail || (kind === 'ponytail')) {
    L.push('## Ponytail Audit');
    L.push('');
    L.push('| Severidade | Arquivo | Regra | Fix |');
    L.push('|---|---|---|---|');
    for (const f of data.engines?.ponytail?.findings || data.findings || []) {
      L.push(`| ${f.severity} | \`${f.file}:${f.line}\` | ${f.label} | ${f.fix} |`);
    }
    L.push('');
  }

  return L.join('\n');
}

main().catch((e) => {
  console.error('Falha na auditoria:', e);
  process.exit(1);
});
