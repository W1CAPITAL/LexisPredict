export type OcrProvider = 'unlimited_internal' | 'tesseract_internal' | 'ocrspace_external';

export type OcrResult = {
  success: boolean;
  text: string;
  provider: OcrProvider | 'none';
  error?: string;
  /** ms */
  latencyMs?: number;
};

export type OcrInput = {
  /** Buffer da imagem (png/jpeg/webp) */
  buffer: Buffer;
  mimeType?: string;
  /** dica de idioma: por padrão português */
  language?: string;
  /** forçar provedor */
  prefer?: 'internal' | 'external' | 'auto';
};
