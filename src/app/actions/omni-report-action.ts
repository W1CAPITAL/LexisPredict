'use server';

import { getUserContext, getStoredCasesForEmpresa } from '@/lib/server-db';
import { runCascade, type VisionImage } from '@/lib/ai/cascade';

export type OmniReportSource = {
  name: string;
  kind?: string;
  text: string;
};

export type OmniReportInput = {
  instruction: string;
  sources?: OmniReportSource[];
  images?: VisionImage[];
  detail?: 'normal' | 'profundo' | 'maximo';
};

export type OmniReportResult =
  | {
      success: true;
      html: string;
      markdown: string;
      title: string;
      filenameBase: string;
      sources: Array<{ id: string; name: string; kind: string; chars: number }>;
      stats: {
        inputChars: number;
        chunks: number;
        cnjs: number;
        sections: number;
        engines: string[];
      };
    }
  | { success: false; error: string };

const MAX_SOURCE_CHARS = 220000;
const MAX_TOTAL_CHARS = 420000;
const MAX_IMAGES = 6;
const CHUNK_SIZE = 12000;
const CHUNK_OVERLAP = 500;
const MAX_CHUNKS = 18;

function cleanText(value: unknown) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function normalize(value: unknown) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function extractCnjs(text: string): string[] {
  const out = new Set<string>();
  const formatted = text.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/g) || [];
  for (const value of formatted) out.add(value);
  const digits = text.match(/\b\d{20}\b/g) || [];
  for (const value of digits) out.add(value);
  return [...out];
}

function onlyDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

function chunkText(text: string): string[] {
  const clean = cleanText(text);
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(clean.length, start + CHUNK_SIZE);
    if (end < clean.length) {
      const paragraph = clean.lastIndexOf('\n\n', end);
      const line = clean.lastIndexOf('\n', end);
      const cut = Math.max(paragraph, line);
      if (cut > start + CHUNK_SIZE * 0.65) end = cut;
    }
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }
  return chunks;
}

function escapeHtml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkup(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([SP]\d{2})\]/g, '<span class="source-ref">[$1]</span>');
}

function markdownToHtml(markdown: string) {
  const lines = cleanText(markdown).split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (list) out.push('</' + list + '>');
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (/^####\s+/.test(line)) {
      closeList();
      out.push('<h4>' + inlineMarkup(line.replace(/^####\s+/, '')) + '</h4>');
      continue;
    }
    if (/^###\s+/.test(line)) {
      closeList();
      out.push('<h3>' + inlineMarkup(line.replace(/^###\s+/, '')) + '</h3>');
      continue;
    }
    if (/^##\s+/.test(line)) {
      closeList();
      out.push('<h2>' + inlineMarkup(line.replace(/^##\s+/, '')) + '</h2>');
      continue;
    }
    if (/^#\s+/.test(line)) {
      closeList();
      out.push('<h2>' + inlineMarkup(line.replace(/^#\s+/, '')) + '</h2>');
      continue;
    }
    if (/^[-*•]\s+/.test(line)) {
      if (list !== 'ul') {
        closeList();
        list = 'ul';
        out.push('<ul>');
      }
      out.push('<li>' + inlineMarkup(line.replace(/^[-*•]\s+/, '')) + '</li>');
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      if (list !== 'ol') {
        closeList();
        list = 'ol';
        out.push('<ol>');
      }
      out.push('<li>' + inlineMarkup(line.replace(/^\d+[.)]\s+/, '')) + '</li>');
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      out.push('<blockquote>' + inlineMarkup(line.replace(/^>\s?/, '')) + '</blockquote>');
      continue;
    }
    closeList();
    out.push('<p>' + inlineMarkup(line) + '</p>');
  }
  closeList();
  return out.join('\n');
}

function buildHtml(input: {
  title: string;
  subtitle: string;
  instruction: string;
  sections: Array<{ number: string; title: string; body: string }>;
  sources: Array<{ id: string; name: string; kind: string; chars: number }>;
  generatedAt: string;
  statsLine: string;
}) {
  const nav = input.sections
    .map((s, i) => '<a href="#sec-' + (i + 1) + '">' + escapeHtml(s.title) + '</a>')
    .join('');
  const sections = input.sections
    .map(
      (s, i) =>
        '<section id="sec-' +
        (i + 1) +
        '"><div class="section-head"><span>' +
        escapeHtml(s.number) +
        '</span><h2>' +
        escapeHtml(s.title) +
        '</h2></div>' +
        markdownToHtml(s.body) +
        '</section>'
    )
    .join('\n');
  const sourceRows = input.sources
    .map(
      (s) =>
        '<tr><td><strong>' +
        escapeHtml(s.id) +
        '</strong></td><td>' +
        escapeHtml(s.name) +
        '</td><td>' +
        escapeHtml(s.kind) +
        '</td><td>' +
        s.chars.toLocaleString('pt-BR') +
        '</td></tr>'
    )
    .join('');

  return (
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    '<title>' +
    escapeHtml(input.title) +
    '</title><style>' +
    ':root{--navy:#182e43;--red:#923c35;--ink:#24313c;--muted:#62707b;--line:#d9ddd9;--paper:#f5f3ed;--white:#fff;--gold:#af8b50}' +
    '*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.68 system-ui,-apple-system,Segoe UI,Arial,sans-serif}' +
    'header{position:sticky;top:0;z-index:10;background:var(--navy);color:#fff;padding:10px 20px;display:flex;gap:12px;align-items:center;box-shadow:0 2px 10px #0002}' +
    'header strong{font-size:12px;letter-spacing:1.5px;text-transform:uppercase}header input{margin-left:auto;width:min(360px,45vw);padding:8px 10px;border-radius:6px;border:1px solid #ffffff55}' +
    '.layout{display:grid;grid-template-columns:260px minmax(0,1fr);max-width:1500px;margin:auto}aside{position:sticky;top:62px;height:calc(100vh - 62px);overflow:auto;padding:24px 16px;font-size:12px}' +
    'aside h3{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:var(--muted)}aside a{display:block;text-decoration:none;color:var(--ink);padding:7px 8px;border-left:2px solid transparent}aside a:hover{background:#fff;border-left-color:var(--red)}' +
    'main{padding:0 38px 70px;min-width:0}.hero{padding:58px 0 34px;border-bottom:3px solid var(--navy);margin-bottom:30px}.eyebrow{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--red)}' +
    'h1{font:400 48px/1.08 Georgia,serif;color:var(--navy);margin:16px 0 18px;max-width:980px}.intro{font-size:19px;line-height:1.48;color:var(--muted);max-width:940px}.meta{margin-top:22px;font-size:11px;letter-spacing:.7px;color:var(--muted)}' +
    '.scope{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px}.scope span{font-size:11px;background:#e8e8e2;padding:6px 10px;border-radius:4px}' +
    'section{background:#fff;border:1px solid var(--line);border-radius:9px;padding:30px;margin-bottom:26px;scroll-margin-top:76px}.section-head{display:flex;gap:14px;align-items:flex-start;border-bottom:1px solid var(--line);padding-bottom:14px;margin-bottom:20px}.section-head>span{font-size:12px;font-weight:800;color:var(--red);padding-top:5px}' +
    'h2{font:400 29px/1.25 Georgia,serif;color:var(--navy);margin:0}h3{font:600 19px/1.35 Georgia,serif;color:var(--navy);margin:25px 0 8px}h4{font-size:14px;color:var(--navy);margin:20px 0 6px}p{margin:10px 0}ul,ol{padding-left:24px}li{margin:7px 0}blockquote{margin:16px 0;padding:14px 17px;border-left:3px solid var(--gold);background:#f6f3e9}' +
    '.source-ref{display:inline-block;background:#eef2f4;color:#35546d;border-radius:3px;padding:0 4px;font-size:.9em;font-weight:700}.sources{width:100%;border-collapse:collapse;font-size:12px}.sources th,.sources td{padding:9px;border-bottom:1px solid var(--line);text-align:left}.sources th{background:#edf0f0;color:var(--navy)}' +
    '.note{border-left:3px solid var(--gold);background:#f5f2e8;padding:16px 18px;margin:18px 0;font-size:13px}' +
    '@media(max-width:850px){header input{display:none}.layout{display:block}aside{display:none}main{padding:0 14px 80px}.hero{padding-top:34px}h1{font-size:36px}section{padding:20px}}' +
    '@media print{header,aside{display:none!important}.layout{display:block}main{padding:0}.hero{padding:22mm 12mm 10mm}.hero h1{font-size:32pt}section{border:0;border-radius:0;padding:9mm 12mm;margin:0;break-inside:auto}section+section{break-before:page}.section-head{break-after:avoid}h2,h3,h4{break-after:avoid}p,li{orphans:3;widows:3}@page{size:A4;margin:12mm 10mm 14mm}}' +
    '</style></head><body><header><strong>LexisPredict · OmniReport</strong><input id="q" placeholder="Buscar no relatório"/></header>' +
    '<div class="layout"><aside><h3>Conteúdo</h3>' +
    nav +
    '<a href="#fontes">Fontes e rastreabilidade</a></aside><main>' +
    '<div class="hero"><div class="eyebrow">Dossiê documental, processual e operacional</div><h1>' +
    escapeHtml(input.title) +
    '</h1><div class="intro">' +
    escapeHtml(input.subtitle) +
    '</div><div class="scope"><span>Rastreabilidade por fonte</span><span>Escala de prova</span><span>Auditoria por lentes</span><span>Contrafactuais</span><span>HTML + PDF</span></div>' +
    '<div class="meta">' +
    escapeHtml(input.generatedAt + ' · ' + input.statsLine) +
    '</div><div class="note"><strong>Pedido do usuário:</strong> ' +
    escapeHtml(input.instruction) +
    '</div></div>' +
    sections +
    '<section id="fontes"><div class="section-head"><span>ANEXO</span><h2>Fontes e rastreabilidade</h2></div><p>Cada referência [Sxx] ou [Pxx] usada no texto aponta para uma fonte desta tabela. Ausência de referência deve ser tratada como interpretação ou síntese, não como prova autônoma.</p><table class="sources"><thead><tr><th>ID</th><th>Fonte</th><th>Tipo</th><th>Caracteres</th></tr></thead><tbody>' +
    sourceRows +
    '</tbody></table></section></main></div>' +
    '<script>(function(){var q=document.getElementById("q");if(!q)return;q.addEventListener("input",function(){var v=q.value.toLowerCase().trim();document.querySelectorAll("main section").forEach(function(s){s.style.display=!v||s.innerText.toLowerCase().includes(v)?"":"none"})})})();</script>' +
    '</body></html>'
  );
}

async function extractImageEvidence(images: VisionImage[], instruction: string) {
  if (!images.length) return null;
  const result = await runCascade({
    preferred: 'auto',
    noTokenSaver: true,
    system:
      'Você é um extrator forense multimodal. Leia integralmente as imagens fornecidas. Transcreva texto relevante e descreva tabelas, prints, documentos, datas, nomes, valores, números de processo e relações visíveis. Não conclua culpa nem invente conteúdo ilegível. Organize por IMAGEM 1, IMAGEM 2 etc.',
    messages: [
      {
        role: 'user',
        content:
          'Contexto do relatório: ' +
          instruction +
          '\nExtraia das imagens tudo que possa servir de evidência, preservando incertezas.',
      },
    ],
    images: images.slice(0, MAX_IMAGES),
    temperature: 0.05,
    max_tokens: 4200,
  });
  return cleanText(result.text);
}

async function buildProcessSources(instruction: string, sourceBlob: string) {
  const ctx = await getUserContext();
  if (!ctx.empresa_id) return [] as OmniReportSource[];

  const cases = await getStoredCasesForEmpresa(ctx.empresa_id, false);
  const blob = instruction + '\n' + sourceBlob;
  const cnjs = extractCnjs(blob).slice(0, 5);
  const out: OmniReportSource[] = [];
  const used = new Set<string>();

  for (const cnj of cnjs) {
    const digits = onlyDigits(cnj);
    const found = (cases || []).find(
      (row: any) =>
        onlyDigits(row.protocolo) === digits ||
        onlyDigits(row.protocolo_ref) === digits
    );

    if (found) {
      out.push({
        name: 'Carteira Lexis · ' + (found.cliente || cnj),
        kind: 'processo_interno',
        text: JSON.stringify(
          {
            cliente: found.cliente,
            protocolo: found.protocolo,
            tribunal: found.tribunal,
            advogado: found.advogado,
            escritorio: found.escritorio,
            status: found.status,
            situacao: found.situacao,
            ultimoRetorno: found.ultimoRetorno,
            proximoPrazo: found.proximoPrazo,
            observacao: found.observacao,
            evento_tipo: found.evento_tipo,
            evento_resumo: found.evento_resumo,
            datajud_ultimo_nome: found.datajud_ultimo_nome,
            datajud_ultimo_movimento: found.datajud_ultimo_movimento,
            djen_ultimo_resumo: found.djen_ultimo_resumo,
            datajud_encerrado_tribunal: found.datajud_encerrado_tribunal,
            em_cumprimento_sentenca: found.em_cumprimento_sentenca,
            indicio_busca_apreensao: found.indicio_busca_apreensao,
          },
          null,
          2
        ),
      });
      used.add(String(found.id || digits));
    }

    try {
      const { scanSingleCaseAction } = await import('@/app/actions/case-actions');
      const scan: any = await scanSingleCaseAction(cnj, { mode: 'both' } as any);
      if (scan && scan.success !== false) {
        out.push({
          name: 'Tribunal DataJud/DJEN · ' + cnj,
          kind: 'tribunal',
          text: JSON.stringify(
            {
              processo: cnj,
              case: scan.case || scan.casePatch || null,
              movimentos: (scan.movimentos || []).slice(0, 120),
              comunicacoes: (scan.comunicacoes || []).slice(0, 80),
            },
            null,
            2
          ),
        });
      }
    } catch {
      // Relatório continua com as fontes disponíveis.
    }
  }

  if (!cnjs.length) {
    const haystack = normalize(blob);
    for (const row of cases || []) {
      const cliente = normalize((row as any).cliente);
      if (cliente.length < 8 || !haystack.includes(cliente)) continue;
      const key = String((row as any).id || (row as any).protocolo || cliente);
      if (used.has(key)) continue;
      used.add(key);
      out.push({
        name: 'Carteira Lexis · ' + ((row as any).cliente || 'cliente'),
        kind: 'processo_interno',
        text: JSON.stringify(
          {
            cliente: (row as any).cliente,
            protocolo: (row as any).protocolo,
            tribunal: (row as any).tribunal,
            advogado: (row as any).advogado,
            escritorio: (row as any).escritorio,
            status: (row as any).status,
            ultimoRetorno: (row as any).ultimoRetorno,
            proximoPrazo: (row as any).proximoPrazo,
            observacao: (row as any).observacao,
            evento_resumo: (row as any).evento_resumo,
            datajud_ultimo_nome: (row as any).datajud_ultimo_nome,
            djen_ultimo_resumo: (row as any).djen_ultimo_resumo,
          },
          null,
          2
        ),
      });
      if (out.length >= 10) break;
    }
  }

  return out;
}

async function summarizeChunk(chunk: string, index: number, total: number) {
  const result = await runCascade({
    preferred: 'auto',
    noTokenSaver: true,
    system:
      'Você é o indexador forense do OmniReport LexisPredict. Converta o trecho em um ledger de evidências detalhado. Preserve TODOS os identificadores de fonte [Sxx]/[Pxx], CNJs, datas, pessoas, falas, valores, prazos, eventos e contradições relevantes. Separe fato documental, relato, indício e hipótese. Aponte também lacunas e documentos que seriam decisivos. Não faça acusações além do que a fonte sustenta. Não desperdice espaço com introdução.',
    messages: [
      {
        role: 'user',
        content:
          'TRECHO ' +
          String(index + 1) +
          ' DE ' +
          String(total) +
          '\n\n' +
          chunk,
      },
    ],
    temperature: 0.05,
    max_tokens: 2200,
  });
  return {
    text: cleanText(result.text),
    engine: result.engineId + (result.model ? '/' + result.model : ''),
  };
}

async function generateSection(
  title: string,
  task: string,
  instruction: string,
  ledger: string,
  detail: 'normal' | 'profundo' | 'maximo'
) {
  const maxTokens = detail === 'maximo' ? 3600 : detail === 'profundo' ? 2800 : 1800;
  const result = await runCascade({
    preferred: 'auto',
    noTokenSaver: true,
    system:
      'Você é o redator principal do OmniReport LexisPredict. Produza relatório técnico em português brasileiro, humano, preciso e rastreável. Use apenas o ledger fornecido. Cite as fontes como [S01], [S02], [P01] etc. Diferencie claramente: CONFIRMADO (fonte primária), REGISTRO/ADMISSÃO, INDÍCIO, RELATO e HIPÓTESE. Não transforme contagem em culpa automática. Quando houver profissionais, atribua por ato, fase, poderes, intimação e tarefa concreta. Se uma conclusão não puder ser sustentada, diga o que falta. Evite linguagem de IA. Não use tabela Markdown; prefira subtítulos e listas. Não repita a mesma conclusão para inflar tamanho.',
    messages: [
      {
        role: 'user',
        content:
          'PEDIDO DO USUÁRIO:\n' +
          instruction +
          '\n\nSEÇÃO A REDIGIR: ' +
          title +
          '\nOBJETIVO ESPECÍFICO:\n' +
          task +
          '\n\nLEDGER DE EVIDÊNCIAS:\n' +
          ledger,
      },
    ],
    temperature: 0.12,
    max_tokens: maxTokens,
  });
  return {
    text: cleanText(result.text),
    engine: result.engineId + (result.model ? '/' + result.model : ''),
  };
}

export async function extractOmniReportFileAction(formData: FormData) {
  try {
    await getUserContext();
    const file = formData.get('file') as File | null;
    if (!file) return { success: false as const, error: 'Nenhum arquivo recebido.' };
    const name = String(file.name || 'arquivo');
    const lower = name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 25 * 1024 * 1024) {
      return { success: false as const, error: 'Arquivo maior que 25 MB.' };
    }

    if (file.type.startsWith('image/')) {
      if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
        return { success: false as const, error: 'Imagem não suportada. Use JPG, PNG, GIF ou WEBP.' };
      }
      return {
        success: true as const,
        name,
        kind: 'imagem',
        text: '',
        image: {
          mediaType: file.type as VisionImage['mediaType'],
          data: buf.toString('base64'),
        },
        chars: 0,
      };
    }

    let text = '';
    let kind = 'arquivo';

    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      const { extractTextResilient } = await import('@/app/actions/knowledge-actions');
      text = await extractTextResilient(buf, name);
      kind = 'pdf';
    } else if (/\.(xlsx|xls|xlsm|csv)$/i.test(lower)) {
      const XLSX: any = await import('xlsx');
      const workbook = XLSX.read(buf, { type: 'buffer', dense: true });
      const parts: string[] = [];
      for (const sheetName of workbook.SheetNames || []) {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' });
        parts.push('### ABA: ' + sheetName + '\n' + csv);
      }
      text = parts.join('\n\n');
      kind = 'planilha';
    } else if (lower.endsWith('.docx')) {
      const mod: any = await import('mammoth');
      const mammoth = mod.default || mod;
      const result = await mammoth.extractRawText({ buffer: buf });
      text = result.value || '';
      kind = 'docx';
    } else if (/\.(txt|md|json|html|htm|xml|log)$/i.test(lower) || /^text\//i.test(file.type)) {
      text = buf.toString('utf8');
      if (/\.(html|htm)$/i.test(lower)) {
        text = text
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/&amp;/gi, '&');
      }
      kind = lower.split('.').pop() || 'texto';
    } else {
      return {
        success: false as const,
        error: 'Formato ainda não suportado. Use PDF, DOCX, XLSX/XLS/CSV, TXT/MD/JSON/HTML ou imagem.',
      };
    }

    const clean = cleanText(text).slice(0, MAX_SOURCE_CHARS);
    if (clean.length < 10) {
      return {
        success: false as const,
        error: 'Não encontrei texto utilizável neste arquivo. Se for escaneado, envie também as páginas como imagem.',
      };
    }

    return {
      success: true as const,
      name,
      kind,
      text: clean,
      chars: clean.length,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Falha ao ler arquivo.' };
  }
}

export async function generateOmniReportAction(
  input: OmniReportInput
): Promise<OmniReportResult> {
  try {
    const ctx = await getUserContext();
    if (!ctx.empresa_id) return { success: false, error: 'Sessão expirada.' };

    const instruction = cleanText(input?.instruction);
    const supplied = (input?.sources || [])
      .map((s) => ({
        name: cleanText(s.name) || 'Fonte enviada',
        kind: cleanText(s.kind) || 'texto',
        text: cleanText(s.text).slice(0, MAX_SOURCE_CHARS),
      }))
      .filter((s) => s.text);

    if (instruction) {
      supplied.unshift({
        name: 'Contexto digitado pelo usuário',
        kind: 'contexto_usuario',
        text: instruction.slice(0, MAX_SOURCE_CHARS),
      });
    }

    const imageEvidence = await extractImageEvidence(input?.images || [], instruction);
    if (imageEvidence) {
      supplied.push({
        name: 'Imagens anexadas',
        kind: 'imagem_extraida',
        text: imageEvidence,
      });
    }

    const sourceBlob = supplied.map((s) => s.text).join('\n\n').slice(0, MAX_TOTAL_CHARS);
    const processSources = await buildProcessSources(instruction, sourceBlob);
    const all = [...supplied, ...processSources];

    if (!instruction && all.length === 0) {
      return {
        success: false,
        error: 'Descreva o relatório, informe um processo ou envie algum material.',
      };
    }

    const registered = all.map((s, i) => {
      const id = (s.kind === 'processo_interno' || s.kind === 'tribunal' ? 'P' : 'S') +
        String(i + 1).padStart(2, '0');
      return { ...s, id };
    });

    let totalChars = 0;
    const taggedParts: string[] = [];
    for (const source of registered) {
      if (totalChars >= MAX_TOTAL_CHARS) break;
      const available = MAX_TOTAL_CHARS - totalChars;
      const text = source.text.slice(0, available);
      totalChars += text.length;
      taggedParts.push(
        '[' +
          source.id +
          '] FONTE: ' +
          source.name +
          ' | TIPO: ' +
          source.kind +
          '\n' +
          text
      );
    }

    const rawCorpus = taggedParts.join('\n\n===== FIM DA FONTE =====\n\n');
    const chunks = chunkText(rawCorpus);
    const ledgerParts: string[] = [];
    const engines = new Set<string>();

    for (let i = 0; i < chunks.length; i += 2) {
      const batch = chunks.slice(i, i + 2);
      const results = await Promise.all(
        batch.map((chunk, offset) =>
          summarizeChunk(chunk, i + offset, chunks.length).catch(() => ({
            text: chunk.slice(0, 5000),
            engine: 'fallback-local',
          }))
        )
      );
      for (const result of results) {
        ledgerParts.push(result.text);
        engines.add(result.engine);
      }
    }

    const ledger = ledgerParts.join('\n\n---\n\n').slice(0, 90000);
    const detail = input.detail || 'maximo';

    const definitions =
      detail === 'normal'
        ? [
            {
              title: 'Conclusões executivas e escopo',
              task: 'Explique o que o conjunto permite sustentar, o que não permite, o escopo, os fatos centrais e as conclusões prioritárias.',
            },
            {
              title: 'Cronologia, evidências e contradições',
              task: 'Reconstrua a linha do tempo e destaque cada evidência relevante, divergência, prazo, valor, documento e versão conflitante.',
            },
            {
              title: 'Responsabilidades, riscos e providências',
              task: 'Analise responsabilidades por ato/fase, riscos, causalidade, contrafactuais plausíveis e providências concretas.',
            },
            {
              title: 'Limitações, pendências e fontes decisivas',
              task: 'Liste lacunas, documentos faltantes, diligências necessárias e cautelas de interpretação.',
            },
          ]
        : [
            {
              title: 'Conclusões que o conjunto permite sustentar',
              task: 'Abra com conclusões executivas detalhadas, distinguindo fatos comprovados, inferências e pontos ainda não demonstrados. Inclua impacto prático e materialidade.',
            },
            {
              title: 'Base documental, metodologia e escala de prova',
              task: 'Explique o universo analisado, qualidade das fontes, rastreabilidade e use escala: Nível 4 fonte primária; Nível 3 admissão/registro direto; Nível 2 cruzamento; Nível 1 alegação. Explique limitações.',
            },
            {
              title: 'Cronologia integral e matriz de evidências',
              task: 'Reconstrua cronologicamente os acontecimentos. Para cada marco importante, indique fonte, evento, consequência, possível responsável por fase e o que ainda precisa ser conferido.',
            },
            {
              title: 'Auditoria por múltiplas lentes',
              task: 'Aplique de 18 a 24 lentes adequadas ao material: mandato/poderes, transição, prazos, acesso a sistemas, individualização dos fatos, contrato, cálculos, prova, contraditório, recursos, comunicação, financeiro, execução, qualidade de peça, governança, controles, causalidade, dano, compliance e outras pertinentes. Em cada lente: problema, base, efeito, documento decisivo e como deveria ser conduzido.',
            },
            {
              title: 'Atores, responsabilidades, falhas e contraprovas',
              task: 'Separe pessoas, equipes e organizações. Atribua somente o que for sustentado por fase/ato. Identifique falhas, acertos, contraprovas, versões conflitantes e situações em que a culpa não pode ser individualizada.',
            },
            {
              title: 'Cenários contrafactuais e caminhos alternativos',
              task: 'Formule pelo menos cinco cenários contrafactuais quando houver base: o que teria precisado ocorrer de forma diferente, condição necessária, provável efeito e nível de confiança. Não prometa resultado judicial inevitável.',
            },
            {
              title: 'Prejuízos, causalidade, prioridades e plano de ação',
              task: 'Analise prejuízos sem dupla contagem, nexo causal, riscos atuais, prioridades 24h/7d/30d, medidas de preservação de prova, correções operacionais e próximos documentos a obter.',
            },
            {
              title: 'Apêndice analítico e pontos que exigem confirmação',
              task: 'Feche com inventário de questões abertas, checklist de diligências, lista de números/datas/valores relevantes, inconsistências e índice das fontes mais decisivas.',
            },
          ];

    const sections: Array<{ number: string; title: string; body: string }> = [];
    for (let i = 0; i < definitions.length; i += 2) {
      const batch = definitions.slice(i, i + 2);
      const results = await Promise.all(
        batch.map((definition) =>
          generateSection(
            definition.title,
            definition.task,
            instruction || 'Gere um dossiê completo a partir das fontes.',
            ledger,
            detail
          )
        )
      );
      for (let j = 0; j < results.length; j++) {
        const definition = batch[j];
        const result = results[j];
        sections.push({
          number: String(i + j + 1).padStart(2, '0'),
          title: definition.title,
          body: result.text,
        });
        engines.add(result.engine);
      }
    }

    const titleSeed =
      instruction.split('\n')[0].slice(0, 120) ||
      registered.find((s) => s.kind === 'processo_interno')?.name ||
      'Dossiê OmniReport';
    const title =
      /dossi[eê]|relat[oó]rio|auditoria/i.test(titleSeed)
        ? titleSeed
        : 'Dossiê OmniReport · ' + titleSeed;
    const subtitle =
      'Análise consolidada a partir de ' +
      String(registered.length) +
      ' fonte(s), com rastreabilidade, separação por grau de comprovação e reconstrução multidimensional.';
    const generatedAt = new Date().toLocaleString('pt-BR');
    const cnjCount = extractCnjs(instruction + '\n' + sourceBlob).length;
    const html = buildHtml({
      title,
      subtitle,
      instruction: instruction || 'Dossiê completo a partir das fontes fornecidas.',
      sections,
      sources: registered.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        chars: s.text.length,
      })),
      generatedAt,
      statsLine:
        totalChars.toLocaleString('pt-BR') +
        ' caracteres analisados · ' +
        String(chunks.length) +
        ' bloco(s) de evidência',
    });

    const markdown = sections
      .map((section) => '# ' + section.number + ' · ' + section.title + '\n\n' + section.body)
      .join('\n\n---\n\n');

    const safeBase = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 70);

    return {
      success: true,
      html,
      markdown,
      title,
      filenameBase: safeBase || 'OmniReport_LexisPredict',
      sources: registered.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        chars: s.text.length,
      })),
      stats: {
        inputChars: totalChars,
        chunks: chunks.length,
        cnjs: cnjCount,
        sections: sections.length,
        engines: [...engines],
      },
    };
  } catch (error: any) {
    console.error('[omni-report]', error);
    return {
      success: false,
      error: error?.message || 'Falha ao gerar OmniReport.',
    };
  }
}

export async function renderOmniReportPdfAction(html: string, filenameBase?: string) {
  let browser: any = null;
  try {
    await getUserContext();
    const content = String(html || '');
    if (!content.includes('<!DOCTYPE html>') || content.length < 500) {
      return { success: false as const, error: 'HTML do relatório inválido.' };
    }
    if (content.length > 3_000_000) {
      return { success: false as const, error: 'Relatório grande demais para conversão direta em PDF.' };
    }

    const puppeteerMod: any = await import('puppeteer-core');
    const chromiumMod: any = await import('@sparticuz/chromium');
    const puppeteer = puppeteerMod.default || puppeteerMod;
    const chromium = chromiumMod.default || chromiumMod;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1440, height: 900 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(content, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.emulateMediaType('print');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '10mm', right: '8mm', bottom: '12mm', left: '8mm' },
    });
    const safe = String(filenameBase || 'OmniReport_LexisPredict')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 80);

    return {
      success: true as const,
      base64: Buffer.from(pdf).toString('base64'),
      filename: safe + '.pdf',
      mime: 'application/pdf',
    };
  } catch (error: any) {
    return {
      success: false as const,
      error: error?.message || 'Falha ao converter relatório para PDF.',
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {}
    }
  }
}
