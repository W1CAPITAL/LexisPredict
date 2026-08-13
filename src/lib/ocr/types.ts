export type OcrProvider =
  | 'unlimited_internal'
  | 'tesseract_internal'
  | 'none';

export type OcrInput = {
  buffer: Buffer;
  mimeType?: string;
  language?: string;
  prefer?: 'internal' | 'auto';
};

export type OcrResult = {
  success: boolean;
  text: string;
  provider: OcrProvider | string;
  error?: string;
  latencyMs?: number;
};
