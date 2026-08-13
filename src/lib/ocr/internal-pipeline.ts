/**
 * Pipeline OCR interno inspirado no Unlimited-OCR (Baidu):
 * - multi-página (estilo infer_multi)
 * - raster alta resolução
 * - pós-processo anti-repetição (no_repeat_ngram)
 * - pré-processamento de documento
 *
 * Reconhecimento local: Tesseract (sem API externa / sem OCR.space / sem LLM).
 * Opcional: endpoint self-host Unlimited-OCR via OCR_UNLIMITED_URL (só se você hospedar).
 */

/** Remove laços de repetição longos (inspirado em no_repeat_ngram_size ≈ 35). */
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

/** Limpa ruído típico de OCR de diário/tribunal. */
export function cleanDocumentText(text: string): string {
  let t = String(text || '');
  t = t.replace(/\u0000/g, '');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/([|Il1]){6,}/g, '');
  return dedupeNgramRepeats(t.trim());
}

/**
 * Pré-processa canvas estilo documento (contraste / escala cinza)
 * antes do reconhecimento — melhora taxa em prints de PJe/e-SAJ.
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
      // contraste leve
      const v = Math.max(0, Math.min(255, (g - 128) * 1.25 + 128));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  } catch {
    /* ignore security / tainted */
  }
  return out;
}

export const INTERNAL_OCR_ENGINE_LABEL = 'Lexis Internal · pipeline Unlimited-OCR + Tesseract';
