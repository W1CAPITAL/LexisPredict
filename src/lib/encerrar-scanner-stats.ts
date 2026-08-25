/**
 * Contadores de encerramento — usuário × empresa × scanner W1 (semana).
 */
import { isCasoEncerrado, isBaixaTribunal } from '@/lib/status-encerrado';
import { isEncerradoPeloScanner } from '@/lib/operacao-sistema';

function diaBrasil(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 10);
  } catch {
    return String(iso).slice(0, 10);
  }
}

/** Segunda 00:00 Brasília da semana atual (aproximação ISO). */
export function inicioSemanaBrasil(): string {
  const now = new Date();
  // get weekday in BR
  const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = br.getDay(); // 0=dom
  const diff = day === 0 ? 6 : day - 1;
  br.setDate(br.getDate() - diff);
  return br.toISOString().slice(0, 10);
}

function scanDia(c: any): string | null {
  const d = c?.dados && typeof c.dados === 'object' ? c.dados : {};
  return (
    d.scan_auto_encerrado_dia ||
    diaBrasil(d.scan_auto_encerrado_em || c.scan_auto_encerrado_em) ||
    null
  );
}

export type EncerrarScannerStats = {
  empresaEncerrados: number;
  empresaAtivos: number;
  empresaBaixasTribunal: number;
  usuarioEncerrados: number;
  usuarioAtivos: number;
  scannerAutoTotal: number;
  scannerAutoSemana: number;
  scannerAutoHoje: number;
  revisaoPendente: number;
};

export function computeEncerrarScannerStats(
  cases: any[],
  opts?: { authUserId?: string | null; userNome?: string | null }
): EncerrarScannerStats {
  const auth = opts?.authUserId || null;
  const semanaIni = inicioSemanaBrasil();
  const hoje = new Date().toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).slice(0, 10);

  let empresaEncerrados = 0;
  let empresaAtivos = 0;
  let empresaBaixasTribunal = 0;
  let usuarioEncerrados = 0;
  let usuarioAtivos = 0;
  let scannerAutoTotal = 0;
  let scannerAutoSemana = 0;
  let scannerAutoHoje = 0;
  let revisaoPendente = 0;

  for (const c of cases || []) {
    if (!c) continue;
    const enc = isCasoEncerrado(c);
    const baixa = isBaixaTribunal(c);
    const d = c.dados && typeof c.dados === 'object' ? c.dados : {};
    const owner = String(c.created_by || d.created_by || '');
    const mine = auth ? owner === String(auth) : false;

    if (enc) {
      empresaEncerrados++;
      if (mine) usuarioEncerrados++;
    } else {
      empresaAtivos++;
      if (mine) usuarioAtivos++;
    }
    if (baixa) empresaBaixasTribunal++;

    if (isEncerradoPeloScanner(c)) {
      scannerAutoTotal++;
      const dia = scanDia(c);
      if (dia && dia >= semanaIni) scannerAutoSemana++;
      if (dia === hoje) scannerAutoHoje++;
    }

    if (
      c.precisa_revisar_encerramento ||
      d.precisa_revisar_encerramento ||
      d.baixa_tribunal_pendente_revisao
    ) {
      revisaoPendente++;
    }
  }

  return {
    empresaEncerrados,
    empresaAtivos,
    empresaBaixasTribunal,
    usuarioEncerrados,
    usuarioAtivos,
    scannerAutoTotal,
    scannerAutoSemana,
    scannerAutoHoje,
    revisaoPendente,
  };
}

export type ScanEncerrarLogItem = {
  protocolo: string;
  cliente?: string;
  motivo?: string;
  quando?: string;
  dia?: string;
  acao: 'auto_encerrar' | 'revisao_fila';
};

export function collectScanEncerrarLogs(cases: any[], limit = 200): ScanEncerrarLogItem[] {
  const out: ScanEncerrarLogItem[] = [];
  for (const c of cases || []) {
    const d = c?.dados && typeof c.dados === 'object' ? c.dados : {};
    if (isEncerradoPeloScanner(c) || d.via_scan_auto_encerrar) {
      out.push({
        protocolo: String(c.protocolo || c.protocolo_ref || d.protocolo || ''),
        cliente: c.cliente || d.cliente,
        motivo: d.scan_auto_encerrar_motivo || c.scan_auto_encerrar_motivo || 'Auto scanner',
        quando: d.scan_auto_encerrado_em || c.scan_auto_encerrado_em,
        dia: d.scan_auto_encerrado_dia || scanDia(c) || undefined,
        acao: 'auto_encerrar',
      });
    } else if (
      d.precisa_revisar_encerramento ||
      c.precisa_revisar_encerramento ||
      d.baixa_tribunal_pendente_revisao
    ) {
      out.push({
        protocolo: String(c.protocolo || c.protocolo_ref || d.protocolo || ''),
        cliente: c.cliente || d.cliente,
        motivo: d.scan_revisao_motivo || c.evento_resumo || 'Revisão de encerramento',
        quando: d.scan_auto_encerrado_em || c.datajud_consultado_em,
        dia: undefined,
        acao: 'revisao_fila',
      });
    }
  }
  out.sort((a, b) => String(b.quando || '').localeCompare(String(a.quando || '')));
  return out.slice(0, limit);
}
