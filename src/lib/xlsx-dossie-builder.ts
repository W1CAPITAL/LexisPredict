/**
 * XLSX Dossiê Operacional v3 — estilo ANALYTICS + AUDITORIA + RAW_DATA
 * Relatório executivo completo de todos os casos da carteira.
 * SEM id / created_at / empresa_id / created_by
 *
 * Abas: Capa | Dashboard | Analytics | Auditoria | Processos | Mapa_TJ |
 *       Por_Status | Por_Escritorio | Por_Advogado | Codigos_TJ
 *
 * Melhorias v4: escopo Supervisor/Superadmin = carteira completa; capa com cargo/escopo.
 * Melhorias v3:
 * - Colunas com largura otimizada por aba
 * - Cabeçalho congelado + AutoFiltro na aba Processos
 * - Aba Dashboard (painel executivo) e Por_Advogado
 * - KPIs de atendimento, prazos e risco
 * - Estilos ampliados (seções, alertas, ok, kpis, zebra)
 */

import JSZip from 'jszip';
import { EXPORT_HEADERS, CNJ_TRIBUNAL_MAP, tribunalFromProtocolo } from './xlsx-schema';

export type DossieCase = Record<string, any>;

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function colRef(idx: number): string {
  let n = idx;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function sim(v: any) {
  return v ? 'SIM' : 'NAO';
}

function isEncerradoStatus(s: string) {
  return /encerrad|arquivad|extint|finaliz|im[oó]vel/i.test(s || '');
}

function isVencido(s: string) {
  return /vencido|cr[ií]tico/i.test(s || '');
}

function isEmAndamento(s: string) {
  return !isEncerradoStatus(s);
}

function parseFlexDate(raw: string): Date | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dt = new Date(s.slice(0, 10) + 'T12:00:00');
    return isNaN(dt.getTime()) ? null : dt;
  }
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dt = new Date(y, Number(m[2]) - 1, Number(m[1]), 12);
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(s + 'T12:00:00');
  return isNaN(dt.getTime()) ? null : dt;
}

function diasSemRetorno(raw: string | null): number | null {
  if (!raw) return null;
  const d = parseFlexDate(String(raw));
  if (!d) return null;
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
}

function isNestaSemana(raw: string | null, now: Date = new Date()): boolean {
  if (!raw) return false;
  const d = parseFlexDate(String(raw));
  if (!d) return false;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // segunda = 0
  start.setDate(start.getDate() - dow);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

/** Normaliza processo → linha operacional (sem metadados internos) */
export function normalizeCase(r: DossieCase) {
  const dados = (r.dados && typeof r.dados === 'object' ? r.dados : {}) as any;
  const protocolo = String(r.protocolo || r.protocolo_ref || dados.protocolo || '').trim();
  const status = String(r.status || r.status_prazo || dados.status || '').trim();
  const evento = String(r.evento_tipo || dados.evento_tipo || '');
  const cliente = String(r.cliente || dados.cliente || '').trim();
  const telefone = String(r.telefone || dados.telefone || '').trim();
  const advogado = String(r.advogado || dados.advogado || '').trim();
  const escritorio = String(r.escritorio || dados.escritorio || '').trim();
  const assistente = String(r.assistente || dados.assistente || r.atendente || dados.atendente || '').trim();
  const retorno = String(r.ultimoRetorno || r.ultimo_retorno || dados.ultimoRetorno || '').trim();
  const proximo = String(r.proximoRetorno || r.proximo_retorno || r.proximoPrazo || dados.proximoPrazo || '').trim();

  const dsr = diasSemRetorno(retorno || null);

  return {
    assistente,
    escritorio,
    advogado,
    cliente,
    telefone,
    protocolo,
    distribuicao: String(r.data_distribuicao || dados.data_distribuicao || r.distribuicao || '').trim(),
    status,
    observacoes: String(r.observacao || r.observacoes || dados.observacao || dados.observacoes || '')
      .replace(/\n/g, ' ')
      .trim(),
    produtos: String(r.produtos || dados.produtos || '').trim(),
    data_movimentacao: String(
      r.datajud_ultimo_movimento || dados.datajud_ultimo_movimento || r.data_movimentacao || ''
    ).trim(),
    andamento: String(
      r.evento_resumo ||
        r.datajud_ultimo_nome ||
        dados.evento_resumo ||
        dados.datajud_ultimo_nome ||
        ''
    )
      .replace(/\n/g, ' ')
      .trim(),
    retorno,
    proximo,
    tribunal: tribunalFromProtocolo(protocolo, r.tribunal || dados.tribunal),
    evento_tipo: evento,
    novo_andamento: sim(
      r.tem_novo_andamento || r.tem_atualizacao_pos_retorno || r.djen_nova_comunicacao || dados.tem_novo_andamento
    ),
    encerrado: sim(r.datajud_encerrado_tribunal || dados.datajud_encerrado_tribunal),
    ba: sim(r.indicio_busca_apreensao || dados.indicio_busca_apreensao),
    cumprimento: sim(
      r.em_cumprimento_sentenca || dados.em_cumprimento_sentenca || evento === 'cumprimento_sentenca'
    ),
    djen_resumo: String(r.djen_ultimo_resumo || dados.djen_ultimo_resumo || '').trim(),
    situacao_prazo: status,
    procedente: sim(evento === 'sentenca_procedente'),
    improcedente: sim(evento === 'sentenca_improcedente'),
    dias_sem_retorno: dsr == null ? '' : dsr,
    atendido_semana: isNestaSemana(retorno || null),
  };
}

function rowValues(n: ReturnType<typeof normalizeCase>): (string | number)[] {
  return [
    n.assistente,
    n.escritorio,
    n.advogado,
    n.cliente,
    n.telefone,
    n.protocolo,
    n.distribuicao,
    n.status,
    n.observacoes,
    n.produtos,
    n.data_movimentacao,
    n.andamento,
    n.retorno,
    n.proximo,
    n.tribunal,
    n.evento_tipo,
    n.novo_andamento,
    n.encerrado,
    n.ba,
    n.cumprimento,
    n.djen_resumo,
    n.situacao_prazo,
    n.dias_sem_retorno,
    n.procedente,
    n.improcedente,
  ];
}

// ————————————————————————————————————————————————
// Estilos OOXML (ampliados)
// ————————————————————————————————————————————————

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="10">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="16"/><b/><color rgb="FF0B1220"/><name val="Calibri"/></font>
    <font><sz val="12"/><b/><color rgb="FF0B1220"/><name val="Calibri"/></font>
    <font><sz val="10"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FF7F1D1D"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FF065F46"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FF1E3A8A"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="10"/><b/><color rgb="FF0B1220"/><name val="Calibri"/></font>
  </fonts>
  <fills count="12">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF00D1FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0E7490"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFBEAC3"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left/><right/><top/><bottom style="thin"><color rgb="FFE2E8F0"/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="16">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="6" fillId="6" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="7" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="8" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="5" fillId="9" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="10" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
    <xf numFmtId="0" fontId="1" fillId="11" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="9" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="9" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <xf numFmtId="0" fontId="3" fillId="10" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
  </cellXfs>
</styleSheet>`;

function cellXml(r: number, c: number, val: any, styleId?: number): string {
  const ref = `${colRef(c)}${r}`;
  const sAttr = styleId != null ? ` s="${styleId}"` : '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `<c r="${ref}"${sAttr}><v>${val}</v></c>`;
  }
  const t = esc(val);
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t>${t}</t></is></c>`;
}

type SheetRow = {
  values: any[];
  styleRow?: 'header' | 'kpi' | 'zebra' | 'title' | 'normal' | 'alert' | 'ok' | 'section' | 'warn' | 'info' | 'total' | 'white' | 'bold';
};

const STYLE_IDS: Record<NonNullable<SheetRow['styleRow']>, number> = {
  header: 1,
  title: 2,
  kpi: 3,
  zebra: 4,
  alert: 5,
  ok: 6,
  info: 7,
  section: 8,
  warn: 9,
  total: 11,
  white: 10,
  bold: 12,
  normal: 0,
};

function colsXml(widths: number[]): string {
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  return `<cols>${cols}</cols>`;
}

function freezeXml(rows: number, cols: number): string {
  const pane = `<pane ySplit="${rows}" xSplit="${cols}" topLeftCell="${colRef(cols)}${rows + 1}" activePane="bottomRight" state="frozen"/>`;
  return `<sheetViews><sheetView tabSelected="1" workbookViewId="0">${pane}</sheetView></sheetViews>`;
}

function filterXml(firstCol: number, firstRow: number, lastCol: number, lastRow: number): string {
  return `<autoFilter ref="${colRef(firstCol)}${firstRow}:${colRef(lastCol)}${lastRow}"/>`;
}

function sheetXml(
  rows: SheetRow[],
  opts?: { widths?: number[]; freeze?: number; filter?: boolean; merges?: string[]; rowHeights?: Record<number, number> }
): string {
  let body = '';
  rows.forEach((row, i) => {
    const r = i + 1;
    let styleId = 0;
    if (row.styleRow) styleId = STYLE_IDS[row.styleRow];
    else if (i % 2 === 0 && rows[0]?.styleRow === 'header') styleId = STYLE_IDS.zebra;
    const cells = row.values.map((v, c) => cellXml(r, c, v, styleId)).join('');
    const hAttr =
      opts?.heights && opts.heights[r] != null ? ` ht="${opts.heights[r]}" customHeight="1"` : '';
    body += `<row r="${r}"${hAttr}>${cells}</row>`;
  });
  const widthXml = opts?.widths?.length ? colsXml(opts.widths) : '';
  const freezeXmlOut = opts?.freeze ? freezeXml(opts.freeze, 0) : '';
  const filterXmlOut = opts?.filter && rows.length > 1 ? filterXml(0, 1, Math.max(1, rows[0].values.length - 1), rows.length) : '';
  const mergeXmlOut = opts?.merges?.length
    ? `<mergeCells count="${opts.merges.length}">${opts.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${freezeXmlOut}
  ${widthXml}
  ${filterXmlOut}
  <sheetData>${body}</sheetData>
  ${mergeXmlOut}
</worksheet>`;
}

// ————————————————————————————————————————————————
// Builder principal
// ————————————————————————————————————————————————

export async function buildDossieXlsxBase64(
  cases: DossieCase[],
  meta?: {
    usuario?: string;
    empresa?: string;
    escopo?: string;
    cargo?: string;
    fullCarteira?: boolean;
  }
): Promise<{
  base64: string;
  filename: string;
  count: number;
  kpis: Record<string, number>;
}> {
  const list = (cases || []).map(normalizeCase);
  const n = list.length;
  const hora = new Date().toLocaleString('pt-BR');
  const day = new Date().toISOString().slice(0, 10);

  let emAndamento = 0,
    encerrados = 0,
    vencidos = 0,
    semTelefone = 0,
    semAdvogado = 0,
    semCliente = 0,
    and = 0,
    encTrib = 0,
    ba = 0,
    cump = 0,
    proc = 0,
    impr = 0,
    djen = 0,
    atendidosSemana = 0,
    comRetorno = 0,
    semRetorno = 0,
    criticos = 0;

  const statusMap = new Map<string, number>();
  const escMap = new Map<string, number>();
  const tjMap = new Map<string, number>();
  const advMap = new Map<string, number>();
  const assMap = new Map<string, number>();

  for (const r of list) {
    if (isEmAndamento(r.status)) emAndamento++;
    else encerrados++;
    if (isVencido(r.status)) vencidos++;
    if (!r.telefone || r.telefone === '-' || r.telefone.toUpperCase() === 'GRUPO') semTelefone++;
    if (!r.advogado || r.advogado === '-') semAdvogado++;
    if (!r.cliente) semCliente++;
    if (r.novo_andamento === 'SIM') and++;
    if (r.encerrado === 'SIM') encTrib++;
    if (r.ba === 'SIM') ba++;
    if (r.cumprimento === 'SIM') cump++;
    if (r.procedente === 'SIM') proc++;
    if (r.improcedente === 'SIM') impr++;
    if (r.djen_resumo) djen++;
    if (r.atendido_semana) atendidosSemana++;
    if (r.retorno) comRetorno++;
    else semRetorno++;
    if (isVencido(r.status) || r.ba === 'SIM' || r.novo_andamento === 'SIM' || Number(r.dias_sem_retorno) > 30) criticos++;

    statusMap.set(r.status || '—', (statusMap.get(r.status || '—') || 0) + 1);
    escMap.set(r.escritorio || 'Sem escritório', (escMap.get(r.escritorio || 'Sem escritório') || 0) + 1);
    tjMap.set(r.tribunal || '—', (tjMap.get(r.tribunal || '—') || 0) + 1);
    advMap.set(r.advogado || 'Sem advogado', (advMap.get(r.advogado || 'Sem advogado') || 0) + 1);
    assMap.set(r.assistente || 'Sem assistente', (assMap.get(r.assistente || 'Sem assistente') || 0) + 1);
  }

  const risco = emAndamento > 0 ? Math.min(100, Math.round(((vencidos * 1.0) / (emAndamento || 1)) * 100)) : 0;
  const comRetornoPct = n > 0 ? Math.round((comRetorno / n) * 100) : 0;

  // —— Capa
  const capaRows: SheetRow[] = [
    { values: ['LEXISPREDICT'], styleRow: 'title' },
    { values: ['DOSSIÊ OPERACIONAL — RELATÓRIO EXECUTIVO DE CARTEIRA'], styleRow: 'title' },
    { values: [meta?.fullCarteira ? 'ESCOPO: CARTEIRA COMPLETA DA EMPRESA' : 'ESCOPO: CARTEIRA DO OPERADOR'], styleRow: meta?.fullCarteira ? 'kpi' : 'info' },
    { values: ['Planilha profissional com painel analítico, auditoria e base completa de processos.'], styleRow: 'normal' },
    { values: [''], styleRow: 'normal' },
    { values: ['Gerado em', hora], styleRow: 'kpi' },
    { values: ['Usuário', meta?.usuario || '—'], styleRow: 'normal' },
    { values: ['Escopo', meta?.escopo || (meta?.fullCarteira ? 'Carteira completa da empresa' : 'Carteira do operador logado')], styleRow: 'info' },
    { values: ['Cargo', meta?.cargo || '—'], styleRow: 'normal' },
    { values: ['Total de processos', n], styleRow: 'kpi' },
    { values: [''], styleRow: 'normal' },
    { values: ['Abas do relatório'], styleRow: 'section' },
    { values: ['1. Dashboard — painel executivo com KPIs de carteira, sinais e prazos'], styleRow: 'normal' },
    { values: ['2. Analytics — agregações por escritório, advogado e tribunal'], styleRow: 'normal' },
    { values: ['3. Auditoria — falhas e críticos para ação imediata'], styleRow: 'normal' },
    { values: ['4. Processos — base completa (todos os casos, filtros e congelamento)'], styleRow: 'normal' },
    { values: ['5. Mapa_TJ / Por_Status / Por_Escritorio / Por_Advogado — visões agregadas'], styleRow: 'normal' },
    { values: ['6. Codigos_TJ — tabela oficial CNJ'], styleRow: 'normal' },
    { values: [''], styleRow: 'normal' },
    { values: ['Privacidade'], styleRow: 'section' },
    { values: ['Não inclui ID interno, empresa_id, created_by nem data de criação do banco.'], styleRow: 'normal' },
    { values: ['Documento gerado por LexisPredict — uso interno operacional.'], styleRow: 'normal' },
    { values: [''], styleRow: 'normal' },
    { values: ['RESUMO EXECUTIVO'], styleRow: 'section' },
    { values: ['Total', n, 'Em andamento', emAndamento, 'Encerrados', encerrados], styleRow: 'kpi' },
    { values: ['Vencidos', vencidos, 'Novos andamentos', and, 'B.A.', ba], styleRow: 'kpi' },
    { values: ['Cumprimento', cump, 'Procedentes', proc, 'Improcedentes', impr], styleRow: 'kpi' },
    { values: ['Casos críticos', criticos, 'Risco estimado', `${risco}%`, 'Atendidos (semana)', atendidosSemana], styleRow: criticos > 0 ? 'alert' : 'kpi' },
    { values: ['Próximo passo: abra as abas Auditoria e Dashboard para priorizar a fila de ação.'], styleRow: criticos > 0 ? 'warn' : 'normal' },
  ];

  // —— Dashboard (executivo)
  const dashboardRows: SheetRow[] = [
    { values: ['PAINEL EXECUTIVO — LEXISPREDICT'], styleRow: 'title' },
    { values: [`Gerado em ${hora} • ${meta?.usuario || 'usuário logado'} • ${n} processos`], styleRow: 'normal' },
    { values: [''], styleRow: 'normal' },
    { values: ['CARTEIRA'], styleRow: 'section' },
    { values: ['Total de processos', n, '', 'Andamento', emAndamento], styleRow: 'kpi' },
    { values: ['Encerrados', encerrados, '', 'Vencidos / Críticos', vencidos], styleRow: 'zebra' },
    { values: ['Sem telefone', semTelefone, '', 'Sem advogado', semAdvogado], styleRow: 'zebra' },
    { values: ['Sem cliente', semCliente, '', 'Risco estimado', `${risco}%`], styleRow: risco > 40 ? 'alert' : 'zebra' },
    { values: [''], styleRow: 'normal' },
    { values: ['SINAIS OPERACIONAIS'], styleRow: 'section' },
    { values: ['Novos andamentos', and, '', 'Baixa no tribunal', encTrib], styleRow: 'kpi' },
    { values: ['Indícios de B.A.', ba, '', 'Cumprimento de sentença', cump], styleRow: ba > 0 ? 'alert' : 'zebra' },
    { values: ['Sentenças procedentes', proc, '', 'Sentenças improcedentes', impr], styleRow: 'ok' },
    { values: ['Casos com DJEN ativo', djen, '', 'Casos críticos (ação)', criticos], styleRow: criticos > 0 ? 'warn' : 'zebra' },
    { values: [''], styleRow: 'normal' },
    { values: ['ATENDIMENTO'], styleRow: 'section' },
    { values: ['Casos com retorno registrado', comRetorno, '', '% com retorno', `${comRetornoPct}%`], styleRow: 'kpi' },
    { values: ['Atendidos na última semana', atendidosSemana, '', 'Casos sem retorno', semRetorno], styleRow: semRetorno > 0 ? 'warn' : 'zebra' },
    { values: [''], styleRow: 'normal' },
    { values: ['LEITURA ESTRATÉGICA'], styleRow: 'section' },
    {
      values: [
        `Foco em ${criticos} caso(s) crítico(s): priorizar vencidos, indícios de B.A. e novos andamentos sem retorno.`,
      ],
      styleRow: criticos > 0 ? 'warn' : 'ok',
    },
    { values: [`Carteira com ${comRetornoPct}% de retorno registrado — manter rotina de retorno ao cliente.`], styleRow: 'normal' },
  ];

  // —— Analytics
  const analyticsRows: SheetRow[] = [
    { values: ['RELATÓRIO ANALÍTICO AUTOMÁTICO'], styleRow: 'title' },
    { values: ['Painel executivo para leitura rápida por responsável, escritório, situação e TJ.'], styleRow: 'normal' },
    { values: [''], styleRow: 'normal' },
    { values: ['TOTAL', 'EM ANDAMENTO', 'ENCERRADOS', 'VENCIDOS', 'SEM TELEFONE', 'SEM ADVOGADO'], styleRow: 'header' },
    { values: [n, emAndamento, encerrados, vencidos, semTelefone, semAdvogado], styleRow: 'kpi' },
    { values: [''], styleRow: 'normal' },
    { values: ['NOVOS ANDAMENTOS', 'BAIXA TRIBUNAL', 'B.A.', 'CUMPRIMENTO', 'PROCEDENTE', 'IMPROCEDENTE'], styleRow: 'header' },
    { values: [and, encTrib, ba, cump, proc, impr], styleRow: 'kpi' },
    { values: [''], styleRow: 'normal' },
    { values: ['ATENDIDOS (SEMANA)', 'COM RETORNO', 'SEM RETORNO', 'RISCOS', 'DJEN ATIVO', 'SEM CLIENTE'], styleRow: 'header' },
    { values: [atendidosSemana, comRetorno, semRetorno, criticos, djen, semCliente], styleRow: 'kpi' },
    { values: [''], styleRow: 'normal' },
    { values: ['ESCRITÓRIO', 'QTD', 'ADVOGADO', 'QTD', 'TRIBUNAL', 'QTD'], styleRow: 'header' },
    ...Array.from({ length: Math.max(escMap.size, advMap.size, tjMap.size, 1) }).map((_, i) => {
      const escE = [...escMap.entries()].sort((a, b) => b[1] - a[1])[i];
      const advE = [...advMap.entries()].sort((a, b) => b[1] - a[1])[i];
      const tjE = [...tjMap.entries()].sort((a, b) => b[1] - a[1])[i];
      return {
        values: [
          escE?.[0] || '',
          escE?.[1] ?? '',
          advE?.[0] || '',
          advE?.[1] ?? '',
          tjE?.[0] || '',
          tjE?.[1] ?? '',
        ],
        styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
      };
    }),
  ];

  // —— Auditoria
  const criticosList = list.filter(
    (r) =>
      isVencido(r.status) ||
      !r.telefone ||
      !r.advogado ||
      !r.cliente ||
      r.ba === 'SIM' ||
      r.novo_andamento === 'SIM' ||
      (r.dias_sem_retorno !== '' && Number(r.dias_sem_retorno) > 30)
  );

  const auditoriaRows: SheetRow[] = [
    { values: ['AUDITORIA AUTOMÁTICA'], styleRow: 'title' },
    { values: ['Falhas operacionais e processos críticos — ação imediata.'], styleRow: 'normal' },
    { values: [''], styleRow: 'normal' },
    { values: ['SEM TELEFONE', 'SEM ADVOGADO', 'SEM CLIENTE', 'VENCIDOS', 'NOVOS ANDAMENTOS', 'B.A.'], styleRow: 'header' },
    { values: [semTelefone, semAdvogado, semCliente, vencidos, and, ba], styleRow: 'alert' },
    { values: [''], styleRow: 'normal' },
    { values: ['LISTA CRÍTICA / ALERTAS'], styleRow: 'section' },
    { values: [...EXPORT_HEADERS], styleRow: 'header' },
    ...criticosList.slice(0, 2000).map((r, i) => ({
      values: rowValues(r),
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  // —— Processos (carteira completa com filtro e congelamento)
  const procRows: SheetRow[] = [
    { values: [...EXPORT_HEADERS], styleRow: 'header' },
    ...list.map((r, i) => ({
      values: rowValues(r),
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  // —— Mapa TJ
  const mapaRows: SheetRow[] = [
    { values: ['Tribunal', 'Quantidade'], styleRow: 'header' },
    ...[...tjMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v], i) => ({
        values: [k, v],
        styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
      })),
  ];

  const statusRows: SheetRow[] = [
    { values: ['Status', 'Quantidade'], styleRow: 'header' },
    ...[...statusMap.entries()].map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const escRows: SheetRow[] = [
    { values: ['Escritorio', 'Quantidade'], styleRow: 'header' },
    ...[...escMap.entries()].map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const advRows: SheetRow[] = [
    { values: ['Advogado', 'Quantidade'], styleRow: 'header' },
    ...[...advMap.entries()].map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const codRows: SheetRow[] = [
    { values: ['Código CNJ (TT)', 'Tribunal'], styleRow: 'header' },
    ...Object.entries(CNJ_TRIBUNAL_MAP).map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const PROCESSOS_WIDTHS = [16, 18, 20, 24, 15, 22, 14, 14, 30, 16, 14, 42, 14, 14, 16, 18, 8, 8, 8, 8, 40, 14, 10, 8, 8];
  const MAPA_WIDTHS = [26, 12];
  const ANALYTICS_WIDTHS = [18, 14, 14, 14, 16, 16];

  const sheets = [
    { name: 'Capa', xml: sheetXml(capaRows, { widths: [34, 14, 30, 16, 26, 14], merges: ['A1:F1', 'A2:F2'] }) },
    { name: 'Dashboard', xml: sheetXml(dashboardRows, { widths: [34, 16, 4, 34, 16] }) },
    { name: 'Analytics', xml: sheetXml(analyticsRows, { widths: ANALYTICS_WIDTHS }) },
    { name: 'Auditoria', xml: sheetXml(auditoriaRows, { widths: PROCESSOS_WIDTHS }) },
    { name: 'Processos', xml: sheetXml(procRows, { widths: PROCESSOS_WIDTHS, freeze: 1, filter: true }) },
    { name: 'Mapa_TJ', xml: sheetXml(mapaRows, { widths: MAPA_WIDTHS }) },
    { name: 'Por_Status', xml: sheetXml(statusRows, { widths: MAPA_WIDTHS }) },
    { name: 'Por_Escritorio', xml: sheetXml(escRows, { widths: MAPA_WIDTHS }) },
    { name: 'Por_Advogado', xml: sheetXml(advRows, { widths: MAPA_WIDTHS }) },
    { name: 'Codigos_TJ', xml: sheetXml(codRows, { widths: MAPA_WIDTHS }) },
  ];

  const zip = new JSZip();

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n  ')}
</Types>`;

  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels')?.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  );

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheets
      .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('\n    ')}
  </sheets>
</workbook>`;

  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    )
    .join('\n  ')}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const xl = zip.folder('xl')!;
  xl.file('workbook.xml', workbook);
  xl.file('styles.xml', STYLES_XML);
  xl.folder('_rels')!.file('workbook.xml.rels', wbRels);
  const ws = xl.folder('worksheets')!;
  sheets.forEach((s, i) => ws.file(`sheet${i + 1}.xml`, s.xml));

  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const base64 = Buffer.from(buf).toString('base64');

  return {
    base64,
    filename: `LexisPredict_Relatorio_Carteira_${day}.xlsx`,
    count: n,
    kpis: {
      total: n,
      emAndamento,
      encerrados,
      vencidos,
      andamentos: and,
      ba,
      cumprimento: cump,
      semTelefone,
      semAdvogado,
      semCliente,
      atendidosSemana,
      comRetorno,
      semRetorno,
      criticos,
      risco,
    },
  };
}
