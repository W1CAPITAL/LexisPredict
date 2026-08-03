/**
 * XLSX Dossiê Operacional v2 — estilo ANALYTICS + AUDITORIA + RAW_DATA
 * SEM id / created_at / empresa_id / created_by
 * Abas: Capa | Analytics | Auditoria | Processos | Mapa_TJ | Por_Status | Por_Escritorio | Codigos_TJ
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
    retorno: String(r.ultimoRetorno || r.ultimo_retorno || dados.ultimoRetorno || '').trim(),
    proximo: String(r.proximoRetorno || r.proximo_retorno || r.proximoPrazo || dados.proximoPrazo || '').trim(),
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
  };
}

function rowValues(n: ReturnType<typeof normalizeCase>): string[] {
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
  ];
}

function cellXml(r: number, c: number, val: any, styleId?: number): string {
  const ref = `${colRef(c)}${r}`;
  const sAttr = styleId != null ? ` s="${styleId}"` : '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `<c r="${ref}"${sAttr}><v>${val}</v></c>`;
  }
  const t = esc(val);
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t>${t}</t></is></c>`;
}

function sheetXml(
  rows: { values: any[]; styleRow?: 'header' | 'kpi' | 'zebra' | 'title' | 'normal' | 'alert' }[]
): string {
  let body = '';
  rows.forEach((row, i) => {
    const r = i + 1;
    let styleId = 0;
    if (row.styleRow === 'header') styleId = 1;
    else if (row.styleRow === 'title') styleId = 2;
    else if (row.styleRow === 'kpi') styleId = 3;
    else if (row.styleRow === 'alert') styleId = 5;
    else if (row.styleRow === 'zebra' && i % 2 === 0) styleId = 4;
    const cells = row.values.map((v, c) => cellXml(r, c, v, styleId)).join('');
    body += `<row r="${r}">${cells}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetData>${body}</sheetData>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="6">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="16"/><b/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><sz val="12"/><b/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FF7F1D1D"/><name val="Calibri"/></font>
  </fonts>
  <fills count="6">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF00D1FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="5" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

export async function buildDossieXlsxBase64(
  cases: DossieCase[],
  meta?: { usuario?: string; empresa?: string }
): Promise<{
  base64: string;
  filename: string;
  count: number;
  kpis: Record<string, number>;
}> {
  const list = (cases || []).map(normalizeCase);
  const n = list.length;
  const hojeStr = new Date().toLocaleDateString('pt-BR');
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
    djen = 0;

  const statusMap = new Map<string, number>();
  const escMap = new Map<string, number>();
  const tjMap = new Map<string, number>();
  const advMap = new Map<string, number>();

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

    statusMap.set(r.status || '—', (statusMap.get(r.status || '—') || 0) + 1);
    escMap.set(r.escritorio || 'Sem escritório', (escMap.get(r.escritorio || 'Sem escritório') || 0) + 1);
    tjMap.set(r.tribunal || '—', (tjMap.get(r.tribunal || '—') || 0) + 1);
    if (r.advogado) advMap.set(r.advogado, (advMap.get(r.advogado) || 0) + 1);
  }

  // —— Capa
  const capaRows = [
    { values: ['LEXISPREDICT'], styleRow: 'title' as const },
    { values: ['DOSSIÊ OPERACIONAL'], styleRow: 'title' as const },
    { values: [''], styleRow: 'normal' as const },
    { values: ['Gerado em', hora], styleRow: 'kpi' as const },
    { values: ['Usuário', meta?.usuario || '—'], styleRow: 'normal' as const },
    { values: ['Escopo', 'Carteira visível ao usuário logado'], styleRow: 'normal' as const },
    { values: ['Total de processos', n], styleRow: 'kpi' as const },
    { values: [''], styleRow: 'normal' as const },
    { values: ['Abas'], styleRow: 'header' as const },
    { values: ['1. Analytics — KPIs executivos (estilo Power BI)'], styleRow: 'normal' as const },
    { values: ['2. Auditoria — falhas e críticos para ação'], styleRow: 'normal' as const },
    { values: ['3. Processos — base completa operacional'], styleRow: 'normal' as const },
    { values: ['4. Mapa_TJ — distribuição por tribunal'], styleRow: 'normal' as const },
    { values: ['5. Por_Status / Por_Escritorio — agregações'], styleRow: 'normal' as const },
    { values: ['6. Codigos_TJ — tabela oficial CNJ'], styleRow: 'normal' as const },
    { values: [''], styleRow: 'normal' as const },
    { values: ['Privacidade'], styleRow: 'header' as const },
    {
      values: ['Não inclui ID interno, empresa_id, created_by nem data de criação do banco.'],
      styleRow: 'normal' as const,
    },
  ];

  // —— Analytics (estilo referência)
  const analyticsRows = [
    { values: ['RELATÓRIO ANALÍTICO AUTOMÁTICO'], styleRow: 'title' as const },
    { values: [''], styleRow: 'normal' as const },
    {
      values: ['Painel executivo para leitura rápida por responsável, escritório, situação e TJ.'],
      styleRow: 'normal' as const,
    },
    {
      values: ['TOTAL', 'EM ANDAMENTO', 'ENCERRADOS', 'VENCIDOS', 'SEM TELEFONE', 'SEM ADVOGADO'],
      styleRow: 'header' as const,
    },
    {
      values: [n, emAndamento, encerrados, vencidos, semTelefone, semAdvogado],
      styleRow: 'kpi' as const,
    },
    { values: [''], styleRow: 'normal' as const },
    {
      values: ['NOVOS ANDAMENTOS', 'BAIXA TRIBUNAL', 'B.A.', 'CUMPRIMENTO', 'PROCEDENTE', 'IMPROCEDENTE'],
      styleRow: 'header' as const,
    },
    { values: [and, encTrib, ba, cump, proc, impr], styleRow: 'kpi' as const },
    { values: [''], styleRow: 'normal' as const },
    { values: ['ESCRITÓRIO', 'QTD', 'ADVOGADO', 'QTD', 'TRIBUNAL', 'QTD'], styleRow: 'header' as const },
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
  const criticos = list.filter(
    (r) =>
      isVencido(r.status) ||
      !r.telefone ||
      !r.advogado ||
      !r.cliente ||
      r.ba === 'SIM' ||
      r.novo_andamento === 'SIM'
  );

  const auditoriaRows = [
    { values: ['AUDITORIA AUTOMÁTICA'], styleRow: 'title' as const },
    { values: [''], styleRow: 'normal' as const },
    {
      values: ['Falhas operacionais e processos críticos — ação imediata.'],
      styleRow: 'normal' as const,
    },
    {
      values: ['SEM TELEFONE', 'SEM ADVOGADO', 'SEM CLIENTE', 'VENCIDOS', 'NOVOS ANDAMENTOS', 'B.A.'],
      styleRow: 'header' as const,
    },
    {
      values: [semTelefone, semAdvogado, semCliente, vencidos, and, ba],
      styleRow: 'alert' as const,
    },
    { values: [''], styleRow: 'normal' as const },
    { values: ['LISTA CRÍTICA / ALERTAS'], styleRow: 'header' as const },
    { values: [...EXPORT_HEADERS], styleRow: 'header' as const },
    ...criticos.slice(0, 2000).map((r, i) => ({
      values: rowValues(r),
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  // —— Processos (carteira completa)
  const procRows = [
    { values: [...EXPORT_HEADERS], styleRow: 'header' as const },
    ...list.map((r, i) => ({
      values: rowValues(r),
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  // —— Mapa TJ
  const mapaRows = [
    { values: ['Tribunal', 'Quantidade'], styleRow: 'header' as const },
    ...[...tjMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v], i) => ({
        values: [k, v],
        styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
      })),
  ];

  const statusRows = [
    { values: ['Status', 'Quantidade'], styleRow: 'header' as const },
    ...[...statusMap.entries()].map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const escRows = [
    { values: ['Escritorio', 'Quantidade'], styleRow: 'header' as const },
    ...[...escMap.entries()].map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const codRows = [
    { values: ['Código CNJ (TT)', 'Tribunal'], styleRow: 'header' as const },
    ...Object.entries(CNJ_TRIBUNAL_MAP).map(([k, v], i) => ({
      values: [k, v],
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  const sheets = [
    { name: 'Capa', xml: sheetXml(capaRows) },
    { name: 'Analytics', xml: sheetXml(analyticsRows) },
    { name: 'Auditoria', xml: sheetXml(auditoriaRows) },
    { name: 'Processos', xml: sheetXml(procRows) },
    { name: 'Mapa_TJ', xml: sheetXml(mapaRows) },
    { name: 'Por_Status', xml: sheetXml(statusRows) },
    { name: 'Por_Escritorio', xml: sheetXml(escRows) },
    { name: 'Codigos_TJ', xml: sheetXml(codRows) },
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
    filename: `LexisPredict_Dossie_${day}.xlsx`,
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
    },
  };
}
