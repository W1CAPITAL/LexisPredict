/**
 * Contadores e logs de encerramento (scanner + humano + sistema).
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

export function inicioSemanaBrasil(): string {
  const now = new Date();
  const br = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = br.getDay();
  const diff = day === 0 ? 6 : day - 1;
  br.setDate(br.getDate() - diff);
  const y = br.getFullYear();
  const m = String(br.getMonth() + 1).padStart(2, '0');
  const d = String(br.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function scanDia(c: any): string | null {
  const d = c?.dados && typeof c.dados === 'object' ? c.dados : {};
  return (
    d.scan_auto_encerrado_dia ||
    diaBrasil(d.scan_auto_encerrado_em || c.scan_auto_encerrado_em) ||
    diaBrasil(c.edited_at) ||
    diaBrasil(d.edited_at) ||
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
  humanoEncerrados: number;
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
  let humanoEncerrados = 0;

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
      if (isEncerradoPeloScanner(c)) {
        scannerAutoTotal++;
        const dia = scanDia(c);
        if (dia && dia >= semanaIni) scannerAutoSemana++;
        if (dia === hoje) scannerAutoHoje++;
      } else {
        humanoEncerrados++;
      }
    } else {
      empresaAtivos++;
      if (mine) usuarioAtivos++;
    }
    if (baixa) empresaBaixasTribunal++;

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
    humanoEncerrados,
  };
}

export type ScanEncerrarLogItem = {
  protocolo: string;
  cliente?: string;
  motivo?: string;
  quando?: string;
  dia?: string;
  acao: 'auto_encerrar' | 'revisao_fila' | 'humano' | 'sistema';
  por?: string;
};

export function collectScanEncerrarLogs(cases: any[], limit = 400): ScanEncerrarLogItem[] {
  const out: ScanEncerrarLogItem[] = [];
  for (const c of cases || []) {
    if (!c) continue;
    const d = c.dados && typeof c.dados === 'object' ? c.dados : {};
    const proto = String(c.protocolo || c.protocolo_ref || d.protocolo || '');
    const cliente = c.cliente || d.cliente;

    if (isEncerradoPeloScanner(c) || d.via_scan_auto_encerrar) {
      out.push({
        protocolo: proto,
        cliente,
        motivo: d.scan_auto_encerrar_motivo || 'Auto scanner',
        quando: d.scan_auto_encerrado_em || c.scan_auto_encerrado_em || c.edited_at,
        dia: d.scan_auto_encerrado_dia || scanDia(c) || undefined,
        acao: 'auto_encerrar',
        por: 'W1 CONTROL · Davi Alves Figueredo',
      });
      continue;
    }

    if (
      d.precisa_revisar_encerramento ||
      c.precisa_revisar_encerramento ||
      d.baixa_tribunal_pendente_revisao
    ) {
      out.push({
        protocolo: proto,
        cliente,
        motivo: d.scan_revisao_motivo || c.evento_resumo || 'Revisão de encerramento',
        quando: c.datajud_consultado_em || d.edited_at,
        acao: 'revisao_fila',
        por: 'Scanner · pendente humano',
      });
      continue;
    }

    if (isCasoEncerrado(c)) {
      const por =
        c.edited_by_name ||
        d.edited_by_name ||
        d.auditado_por_nome ||
        c.auditado_por_nome ||
        'Operador / sistema';
      out.push({
        protocolo: proto,
        cliente,
        motivo:
          d.scan_auto_encerrar_motivo ||
          c.datajud_encerrado_motivo ||
          d.situacao ||
          c.situacao ||
          'Encerrado no gabinete',
        quando: c.edited_at || d.edited_at || c.auditado_em || d.auditado_em,
        dia: scanDia(c) || undefined,
        acao: /W1|CONTROL|scanner/i.test(String(por)) ? 'sistema' : 'humano',
        por: String(por),
      });
    }
  }
  out.sort((a, b) => String(b.quando || b.dia || '').localeCompare(String(a.quando || a.dia || '')));
  return out.slice(0, limit);
}
