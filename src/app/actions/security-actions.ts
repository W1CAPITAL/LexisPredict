'use server';

/**
 * Segurança — server actions para a aba /security.
 * Executa os motores de segurança (Code, OWASP, Trail of Bits, Review,
 * Audit Codebase, Ponytail) sobre o próprio repositório e exporta XLSX.
 * Acesso restrito a Administrador/Supervisor/Superadmin.
 * @copyright 2026 Davi Alves Figueredo / W1 Capital Assessoria Financeira Ltda.
 */

import { getUserContext } from '@/lib/server-db';
import { isAdminGroup } from '@/lib/roles';
import { buildXlsxWithSheetJS } from '@/lib/sheetjs-bridge';

export type SecurityMotorId = 'code' | 'owasp' | 'tob' | 'review' | 'audit' | 'ponytail' | 'all';

async function requireAdmin() {
  const ctx = await getUserContext();
  if (!ctx?.empresa_id) return { error: 'Sessão não identificada.' };
  if (!isAdminGroup(ctx?.cargo)) return { error: 'Acesso restrito a Administrador/Supervisor/Superadmin.' };
  return { ctx };
}

// @ts-ignore — módulo ESM de runtime sem tipos TS
const scanner = () => import('../../lib/security-scanner.mjs') as Promise<any>;

export async function runSecurityScanAction(motor: SecurityMotorId) {
  try {
    const guard = await requireAdmin();
    if (guard.error) return { success: false as const, error: guard.error };
    const mod = await scanner();
    const root = process.cwd();
    let result;
    switch (motor) {
      case 'code':
        result = mod.runCodeSecurity(root);
        break;
      case 'owasp':
        result = await mod.runOwasp(root);
        break;
      case 'tob':
        result = await mod.runTrailOfBits(root);
        break;
      case 'review':
        result = await mod.runSecurityReview(root);
        break;
      case 'audit':
        result = await mod.runAuditCodebase(root);
        break;
      case 'ponytail':
        result = mod.runPonytail(root);
        break;
      default:
        result = await mod.runFullScan(root);
        break;
    }
    return { success: true as const, result, root };
  } catch (e: any) {
    return { success: false as const, error: String(e?.message || e) };
  }
}

export async function exportSecurityXlsxAction() {
  try {
    const guard = await requireAdmin();
    if (guard.error) return { success: false as const, error: guard.error };

    const mod = await scanner();
    const root = process.cwd();
    const scan = await mod.runFullScan(root);

    const sev = (s: string) => s.toUpperCase();
    const achados = (scan.engines?.codeSecurity?.findings || []).map((f: any) => [
      sev(f.severity),
      f.file,
      f.line,
      f.rule,
      f.label,
      f.match || '',
      f.fix || '',
    ]);
    const ponytail = (scan.engines?.ponytail?.findings || []).map((f: any) => [
      sev(f.severity),
      f.file,
      f.line,
      f.rule,
      f.label,
      f.fix || '',
    ]);
    const owasp = (scan.engines?.owasp?.categories || []).map((c: any) => [
      c.id,
      c.name,
      c.status,
      c.summary,
      (c.evidence || []).join(' | '),
      c.recommendation,
    ]);
    const tob = (scan.engines?.trailOfBits?.checks || []).map((c: any) => [
      c.status,
      c.title,
      c.detail,
      (c.files || []).join(' | '),
      c.fix || '',
    ]);

    const sheets = [
      {
        name: 'Resumo',
        rows: [
          ['Score de exposição', scan.review?.score],
          ['Grade', scan.review?.grade],
          ['Status', scan.review?.status],
          ['Total achados', scan.review?.totalFindings],
          ['OWASP com falha', scan.review?.owaspFail],
          ['Arquivos escaneados', scan.scannedFiles],
          ['Gerado em', scan.generatedAt],
        ],
      },
      {
        name: 'Code Security',
        rows: [
          ['Severidade', 'Arquivo', 'Linha', 'Regra', 'Detalhe', 'Trecho', 'Correção'],
          ...achados,
        ],
      },
      {
        name: 'OWASP Top 10',
        rows: [
          ['ID', 'Categoria', 'Status', 'Resumo', 'Evidências', 'Recomendação'],
          ...owasp,
        ],
      },
      {
        name: 'Trail of Bits',
        rows: [
          ['Status', 'Check', 'Detalhe', 'Arquivos', 'Correção'],
          ...tob,
        ],
      },
      {
        name: 'Ponytail',
        rows: [
          ['Severidade', 'Arquivo', 'Linha', 'Regra', 'Detalhe', 'Correção'],
          ...ponytail,
        ],
      },
    ];

    const u8 = await buildXlsxWithSheetJS(sheets);
    const base64 = Buffer.from(u8).toString('base64');
    return {
      success: true as const,
      base64,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `security-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
    };
  } catch (e: any) {
    return { success: false as const, error: String(e?.message || e) };
  }
}
