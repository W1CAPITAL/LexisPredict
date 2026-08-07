/**
 * Gera planilha Excel (SpreadsheetML / XML 2003) com:
 * - Aba Processos (dados)
 * - Aba Dashboard (métricas + FÓRMULAS que o Excel recalcula)
 * - Aba Por Status / Por Escritório (tabelas para gráfico)
 *
 * Abre no Excel / LibreOffice / Google Sheets (importar).
 * Sem dependência exceljs.
 */

function xmlEscape(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellString(v: any): string {
  return `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`;
}

function cellNumber(v: number): string {
  const n = Number.isFinite(v) ? v : 0;
  return `<Cell><Data ss:Type="Number">${n}</Data></Cell>`;
}

function cellFormula(formula: string, fallback = 0): string {
  return `<Cell ss:Formula="=${xmlEscape(formula)}"><Data ss:Type="Number">${fallback}</Data></Cell>`;
}

export type ExportCaseRow = Record<string, any>;

const PROCESS_HEADERS = [
  'Protocolo',
  'Cliente',
  'Telefone',
  'Tribunal',
  'Status',
  'Escritorio',
  'Advogado',
  'Ultimo_Retorno',
  'Proximo_Prazo',
  'Evento_Tipo',
  'Evento_Resumo',
  'Ultimo_Movimento_DataJud',
  'Novo_Andamento',
  'Encerrado_Tribunal',
  'Busca_Apreensao',
  'Cumprimento_Sentenca',
  'DJEN_Nova',
  'DJEN_Resumo',
  'Observacoes',
] as const;

function mapRow(r: ExportCaseRow): (string | number)[] {
  const sim = (b: any) => (b ? 'SIM' : 'NAO');
  return [
    r.protocolo || r.protocolo_ref || '',
    r.cliente || '',
    r.telefone || '',
    r.tribunal || '',
    r.status || r.status_prazo || '',
    r.escritorio || '',
    r.advogado || '',
    r.ultimoRetorno || r.ultimo_retorno || '',
    r.proximoRetorno || r.proximo_retorno || '',
    r.evento_tipo || '',
    r.evento_resumo || '',
    r.datajud_ultimo_nome || r.datajud_ultimo_movimento || '',
    sim(r.tem_novo_andamento || r.tem_atualizacao_pos_retorno),
    sim(r.datajud_encerrado_tribunal),
    sim(r.indicio_busca_apreensao),
    sim(r.em_cumprimento_sentenca),
    sim(r.djen_nova_comunicacao),
    r.djen_ultimo_resumo || '',
    String(r.observacao || r.observacoes || '').replace(/\n/g, ' '),
  ];
}

/**
 * @returns XML string (application/vnd.ms-excel) — salvar como .xls
 */
export function buildOperationalWorkbookXml(rows: ExportCaseRow[]): string {
  const data = rows.map(mapRow);
  const n = data.length;
  const lastRow = n + 1; // header is row 1

  // Processos sheet rows
  let processosRows = `<Row>${PROCESS_HEADERS.map((h) => cellString(h)).join('')}</Row>\n`;
  for (const row of data) {
    processosRows += `<Row>${row.map((c) => (typeof c === 'number' ? cellNumber(c) : cellString(c))).join('')}</Row>\n`;
  }

  // Status aggregation for chart table
  const statusCount = new Map<string, number>();
  const escritorioCount = new Map<string, number>();
  for (const r of rows) {
    const st = String(r.status || r.status_prazo || 'Sem status');
    statusCount.set(st, (statusCount.get(st) || 0) + 1);
    const esc = String(r.escritorio || 'Sem escritório');
    escritorioCount.set(esc, (escritorioCount.get(esc) || 0) + 1);
  }

  let statusRows = `<Row>${cellString('Status')}${cellString('Quantidade')}${cellString('%')}</Row>\n`;
  let i = 2;
  const statusEntries = [...statusCount.entries()];
  for (const [st, qty] of statusEntries) {
    statusRows += `<Row>${cellString(st)}${cellNumber(qty)}${cellFormula(`B${i}/SUM(B$2:B$${statusEntries.length + 1})`, 0)}</Row>\n`;
    i++;
  }

  let escRows = `<Row>${cellString('Escritorio')}${cellString('Quantidade')}</Row>\n`;
  for (const [esc, qty] of escritorioCount.entries()) {
    escRows += `<Row>${cellString(esc)}${cellNumber(qty)}</Row>\n`;
  }

  // Dashboard with formulas referencing Processos columns
  // Col M = Novo_Andamento (13), N = Encerrado (14), O = BA (15), P = Cumprimento (16)
  // Col E = Status (5)
  const dash = `
  <Row>${cellString('LEXISPREDICT — DOSSIÊ OPERACIONAL')}${cellString('')}${cellString(new Date().toISOString().slice(0, 10))}</Row>
  <Row></Row>
  <Row>${cellString('KPI')}${cellString('Valor')}${cellString('Fórmula / origem')}</Row>
  <Row>${cellString('Total de processos')}${cellFormula(`COUNTA(Processos!A2:A${Math.max(lastRow, 2)})`, n)}${cellString('COUNTA Protocolos')}</Row>
  <Row>${cellString('Novos andamentos (SIM)')}${cellFormula(`COUNTIF(Processos!M2:M${Math.max(lastRow, 2)},"SIM")`, 0)}${cellString('COUNTIF Novo_Andamento')}</Row>
  <Row>${cellString('Encerrados tribunal (SIM)')}${cellFormula(`COUNTIF(Processos!N2:N${Math.max(lastRow, 2)},"SIM")`, 0)}${cellString('COUNTIF Encerrado')}</Row>
  <Row>${cellString('Indício B.A. (SIM)')}${cellFormula(`COUNTIF(Processos!O2:O${Math.max(lastRow, 2)},"SIM")`, 0)}${cellString('COUNTIF B.A.')}</Row>
  <Row>${cellString('Cumprimento sentença (SIM)')}${cellFormula(`COUNTIF(Processos!P2:P${Math.max(lastRow, 2)},"SIM")`, 0)}${cellString('COUNTIF Cumprimento')}</Row>
  <Row>${cellString('Status Vencido')}${cellFormula(`COUNTIF(Processos!E2:E${Math.max(lastRow, 2)},"Vencido")`, 0)}${cellString('COUNTIF Status')}</Row>
  <Row>${cellString('Status É Hoje')}${cellFormula(`COUNTIF(Processos!E2:E${Math.max(lastRow, 2)},"É Hoje")+COUNTIF(Processos!E2:E${Math.max(lastRow, 2)},"E Hoje")`, 0)}${cellString('COUNTIF Status')}</Row>
  <Row>${cellString('% Andamentos')}${cellFormula(`IF(B4=0,0,B5/B4)`, 0)}${cellString('Andamentos/Total')}</Row>
  <Row></Row>
  <Row>${cellString('Instruções')}</Row>
  <Row>${cellString('1. Abra no Excel. As fórmulas recalculam automaticamente.')}</Row>
  <Row>${cellString('2. Aba Por_Status: selecione quantidade e Inserir > Gráfico de pizza/barras.')}</Row>
  <Row>${cellString('3. Aba Por_Escritorio: idem para ranking de unidades.')}</Row>
  <Row>${cellString('4. Não edite cabeçalhos da aba Processos se quiser manter as fórmulas do Dashboard.')}</Row>
`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>LexisPredict Operacional</Title>
  <Author>LexisPredict Elite</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <Interior ss:Color="#111827" ss:Pattern="Solid"/>
   <Font ss:Color="#FFFFFF" ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Dashboard">
  <Table>${dash}</Table>
 </Worksheet>
 <Worksheet ss:Name="Processos">
  <Table>${processosRows}</Table>
 </Worksheet>
 <Worksheet ss:Name="Por_Status">
  <Table>${statusRows}</Table>
 </Worksheet>
 <Worksheet ss:Name="Por_Escritorio">
  <Table>${escRows}</Table>
 </Worksheet>
</Workbook>`;

  return xml;
}
