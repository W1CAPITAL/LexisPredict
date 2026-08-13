/**
 * Pipeline OCR interno — pós-processo de leitura (documentos jurídicos BR).
 */

/** Remove laços de repetição longos. */
export function dedupeNgramRepeats(text: string, ngramSize = 12, maxRepeats = 2): string {
  if (!text || text.length < 80) return text;
  const tokens = text.split(/(\s+)/);
  const words = tokens.filter((t) => !/^\s+$/.test(t));
  if (words.length < ngramSize * 3) return text;

  const out: string[] = [];
  let i = 0;
  while (i < words.length) {
    if (i + ngramSize * 2 <= words.length) {
      const gram = words.slice(i, i + ngramSize).join(' ').toLowerCase();
      let repeats = 1;
      let j = i + ngramSize;
      while (j + ngramSize <= words.length) {
        const next = words.slice(j, j + ngramSize).join(' ').toLowerCase();
        if (next !== gram) break;
        repeats++;
        j += ngramSize;
      }
      if (repeats > maxRepeats) {
        for (let k = 0; k < ngramSize * maxRepeats; k++) out.push(words[i + k]);
        i = j;
        continue;
      }
    }
    out.push(words[i]);
    i++;
  }
  return out.join(' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Corrige artefatos típicos de OCR em e-mail e pontuação jurídica. */
export function fixOcrArtifacts(text: string): string {
  let t = String(text || '');

  // E-mail: OCR costuma trocar @ por ( &  (D  (&  etc.
  t = t.replace(/([A-Za-z0-9._%+-]+)\s*\(\s*&\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1@$2');
  t = t.replace(/([A-Za-z0-9._%+-]+)\s*\(\s*[&D@]\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1@$2');
  t = t.replace(/([A-Za-z0-9._%+-]+)\s*\(\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1@$2');
  t = t.replace(/([A-Za-z0-9._%+-]+)\s+[QO0D]\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1@$2');
  // pablobastos(Dadv.oab → pablobastos@adv.oab
  t = t.replace(/([A-Za-z0-9._%+-]+)\(D(adv\.[A-Za-z0-9.-]+)/gi, '$1@$2');
  t = t.replace(/([A-Za-z0-9._%+-]+)\(([QD0])([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1@$3');
  // domínio partido: oab- sp.org.br / oab sp.org.br
  t = t.replace(/@(adv\.oab)\s*-\s*(sp\.org\.br)/gi, '@$1sp.org.br');
  t = t.replace(/@(adv\.oab)\s+(sp\.org\.br)/gi, '@$1sp.org.br');
  t = t.replace(/@([A-Za-z0-9.-]+)\s*-\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '@$1$2');
  t = t.replace(/@\s*gmail\s*\.\s*com/gi, '@gmail.com');
  t = t.replace(/@\s*hotmail\s*\.\s*com/gi, '@hotmail.com');
  t = t.replace(/@\s*outlook\s*\.\s*com/gi, '@outlook.com');
  // "endereço eletrônico: x" colado
  t = t.replace(/eletr[oô]nico:\s*/gi, 'eletrônico: ');

  // OAB 249550/MG OCR: OAB 249550/MG or OAB 249550 / MG
  t = t.replace(/\bOAB\s*[/:]?\s*(\d{2,7})\s*\/\s*([A-Z]{2})\b/gi, 'OAB $1/$2');
  t = t.replace(/\bOAB\s+(\d{2,7})\s+([A-Z]{2})\b/gi, 'OAB $1/$2');

  // S/A com OCR estranho
  t = t.replace(/\$\/A\b/g, 'S/A');
  t = t.replace(/S\s*\/\s*A\b/g, 'S/A');

  // CPF/CNPJ com espaços
  t = t.replace(/(\d{3})\s*\.\s*(\d{3})\s*\.\s*(\d{3})\s*-\s*(\d{2})/g, '$1.$2.$3-$4');
  t = t.replace(/(\d{2})\s*\.\s*(\d{3})\s*\.\s*(\d{3})\s*\/\s*(\d{4})\s*-\s*(\d{2})/g, '$1.$2.$3/$4-$5');

  // barras verticais de layout
  t = t.replace(/\s*\|\s*/g, ' ');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');

  return t.trim();
}

export function cleanDocumentText(text: string): string {
  let t = fixOcrArtifacts(String(text || ''));
  t = t.replace(/\u0000/g, '');
  t = t.replace(/([|Il1]){6,}/g, '');
  return dedupeNgramRepeats(t);
}

/**
 * Pré-processa canvas (contraste / cinza) antes do Tesseract.
 */
export function enhanceCanvasForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  if (!ctx) return source;
  ctx.drawImage(source, 0, 0);
  try {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = Math.max(0, Math.min(255, (g - 128) * 1.35 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* ignore */
  }
  return out;
}

export const INTERNAL_OCR_ENGINE_LABEL =
  'Lexis Internal · Tesseract local + pós-processo jurídico';
