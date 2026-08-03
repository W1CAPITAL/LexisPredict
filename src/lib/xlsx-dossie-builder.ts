/**
 * XLSX profissional estilo Dossiê Operacional.
 * Abas: Capa | Dashboard | Processos | Por_Status | Por_Escritorio
 * Estilos: cabeçalho preto, zebra, KPIs em destaque.
 * Dependência: jszip (já no LexisPredict).
 */

import JSZip from 'jszip';
import { EXPORT_HEADERS } from './xlsx-schema';

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

function normalizeCase(r: DossieCase) {
  const evento = String(r.evento_tipo || '');
  return {
    protocolo: r.protocolo || r.protocolo_ref || '',
    cliente: r.cliente || '',
    telefone: r.telefone || '',
    tribunal: r.tribunal || '',
    status: r.status || r.status_prazo || '',
    escritorio: r.escritorio || '',
    advogado: r.advogado || '',
    ultimo_retorno: r.ultimoRetorno || r.ultimo_retorno || '',
    proximo_prazo: r.proximoRetorno || r.proximo_retorno || '',
    evento_tipo: evento,
    evento_resumo: r.evento_resumo || '',
    datajud_ultimo: r.datajud_ultimo_nome || '',
    novo_andamento: sim(r.tem_novo_andamento || r.tem_atualizacao_pos_retorno),
    encerrado: sim(r.datajud_encerrado_tribunal),
    ba: sim(r.indicio_busca_apreensao),
    cumprimento: sim(r.em_cumprimento_sentenca || evento === 'cumprimento_sentenca'),
    procedente: sim(evento === 'sentenca_procedente'),
    improcedente: sim(evento === 'sentenca_improcedente'),
    djen_resumo: r.djen_ultimo_resumo || '',
    observacoes: String(r.observacao || r.observacoes || '').replace(/\n/g, ' '),
  };
}

function rowValues(n: ReturnType<typeof normalizeCase>): string[] {
  return [
    n.protocolo,
    n.cliente,
    n.telefone,
    n.tribunal,
    n.status,
    n.escritorio,
    n.advogado,
    n.ultimo_retorno,
    n.proximo_prazo,
    n.evento_tipo,
    n.evento_resumo,
    n.datajud_ultimo,
    n.novo_andamento,
    n.encerrado,
    n.ba,
    n.cumprimento,
    n.procedente,
    n.improcedente,
    n.djen_resumo,
    n.observacoes,
  ];
}

/** Célula inline string ou número */
function cellXml(r: number, c: number, val: any, styleId?: number): string {
  const ref = `${colRef(c)}${r}`;
  const sAttr = styleId != null ? ` s="${styleId}"` : '';
  if (typeof val === 'number' && Number.isFinite(val)) {
    return `<c r="${ref}"${sAttr}><v>${val}</v></c>`;
  }
  const t = esc(val);
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t>${t}</t></is></c>`;
}

function sheetXml(rows: { values: any[]; styleRow?: 'header' | 'kpi' | 'zebra' | 'title' | 'normal' }[]): string {
  let body = '';
  rows.forEach((row, i) => {
    const r = i + 1;
    let styleId = 0;
    if (row.styleRow === 'header') styleId = 1;
    else if (row.styleRow === 'title') styleId = 2;
    else if (row.styleRow === 'kpi') styleId = 3;
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
  <fonts count="5">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><sz val="11"/><b/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="16"/><b/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><sz val="12"/><b/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="5">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF00D1FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

/**
 * Gera XLSX base64 estilo dossiê.
 */
export async function buildDossieXlsxBase64(cases: DossieCase[]): Promise<{
  base64: string;
  filename: string;
  count: number;
  kpis: Record<string, number>;
}> {
  const list = (cases || []).map(normalizeCase);
  const n = list.length;

  let and = 0,
    enc = 0,
    ba = 0,
    cump = 0,
    proc = 0,
    impr = 0,
    venc = 0,
    hoje = 0;
  const statusMap = new Map<string, number>();
  const escMap = new Map<string, number>();

  for (const r of list) {
    if (r.novo_andamento === 'SIM') and++;
    if (r.encerrado === 'SIM') enc++;
    if (r.ba === 'SIM') ba++;
    if (r.cumprimento === 'SIM') cump++;
    if (r.procedente === 'SIM') proc++;
    if (r.improcedente === 'SIM') impr++;
    if (/vencido|crítico|critico/i.test(r.status)) venc++;
    if (/hoje/i.test(r.status)) hoje++;
    statusMap.set(r.status || '—', (statusMap.get(r.status || '—') || 0) + 1);
    escMap.set(r.escritorio || 'Sem escritório', (escMap.get(r.escritorio || 'Sem escritório') || 0) + 1);
  }

  const day = new Date().toISOString().slice(0, 10);
  const hora = new Date().toLocaleString('pt-BR');

  // —— Capa
  const capaRows = [
    { values: ['LEXISPREDICT ELITE'], styleRow: 'title' as const },
    { values: ['DOSSIÊ OPERACIONAL DA CARTEIRA'], styleRow: 'title' as const },
    { values: [''], styleRow: 'normal' as const },
    { values: ['Gerado em', hora], styleRow: 'kpi' as const },
    { values: ['Protocolo', 'v300.0 Authority Sheet'], styleRow: 'normal' as const },
    { values: ['Total de processos', n], styleRow: 'kpi' as const },
    { values: [''], styleRow: 'normal' as const },
    { values: ['Instruções'], styleRow: 'header' as const },
    { values: ['1. Aba Dashboard — KPIs da carteira'], styleRow: 'normal' as const },
    { values: ['2. Aba Processos — base completa (filtre no Excel)'], styleRow: 'normal' as const },
    { values: ['3. Por_Status / Por_Escritorio — selecione dados e Inserir > Gráfico'], styleRow: 'normal' as const },
    { values: ['4. Compatível com Excel, Google Sheets (Arquivo > Importar) e LibreOffice'], styleRow: 'normal' as const },
  ];

  // —— Dashboard
  const dashRows = [
    { values: ['KPI', 'Valor', '% s/ Total'], styleRow: 'header' as const },
    { values: ['Total de processos', n, n ? 1 : 0], styleRow: 'kpi' as const },
    { values: ['Novos andamentos', and, n ? and / n : 0], styleRow: 'zebra' as const },
    { values: ['Encerrados tribunal', enc, n ? enc / n : 0], styleRow: 'zebra' as const },
    { values: ['Indício busca e apreensão', ba, n ? ba / n : 0], styleRow: 'zebra' as const },
    { values: ['Cumprimento de sentença', cump, n ? cump / n : 0], styleRow: 'zebra' as const },
    { values: ['Sentenças procedentes', proc, n ? proc / n : 0], styleRow: 'zebra' as const },
    { values: ['Sentenças improcedentes', impr, n ? impr / n : 0], styleRow: 'zebra' as const },
    { values: ['Status vencido / crítico', venc, n ? venc / n : 0], styleRow: 'zebra' as const },
    { values: ['Status é hoje', hoje, n ? hoje / n : 0], styleRow: 'zebra' as const },
  ];

  // —— Processos
  const procRows = [
    { values: [...EXPORT_HEADERS], styleRow: 'header' as const },
    ...list.map((r, i) => ({
      values: rowValues(r),
      styleRow: (i % 2 === 0 ? 'zebra' : 'normal') as 'zebra' | 'normal',
    })),
  ];

  // —— Status / Escritório
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

  const sheets = [
    { name: 'Capa', xml: sheetXml(capaRows) },
    { name: 'Dashboard', xml: sheetXml(dashRows) },
    { name: 'Processos', xml: sheetXml(procRows) },
    { name: 'Por_Status', xml: sheetXml(statusRows) },
    { name: 'Por_Escritorio', xml: sheetXml(escRows) },
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
    kpis: { total: n, andamentos: and, encerrados: enc, ba, cumprimento: cump, procedentes: proc, improcedentes: impr },
  };
}
