export type OcrProvider =
  | 'paddle_internal'
  | 'unlimited_internal'
  | 'tesseract_internal'
  | 'none';

export type OcrInput = {
  buffer: Buffer;
  mimeType?: string;
  language?: string;
  prefer?: 'internal' | 'auto' | 'paddle';
};

export type OcrResult = {
  success: boolean;
  text: string;
  provider: OcrProvider | string;
  error?: string;
  latencyMs?: number;
};
