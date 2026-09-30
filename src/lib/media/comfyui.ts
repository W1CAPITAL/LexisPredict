export type ComfyMediaKind = 'image' | 'video';

export type ComfyQueueInput = {
  kind: ComfyMediaKind;
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  frames?: number;
  workflow?: Record<string, unknown>;
};

export type ComfyQueueResult = {
  ok: boolean;
  promptId?: string;
  number?: number;
  error?: string;
  latencyMs: number;
};

function comfyBaseUrl(): string {
  return String(process.env.COMFYUI_BASE_URL || '').trim().replace(/\/+$/, '');
}

export function isComfyConfigured(kind?: ComfyMediaKind): boolean {
  const base = comfyBaseUrl();
  if (!/^https?:\/\//i.test(base)) return false;
  if (!kind) return true;
  const raw = kind === 'image' ? process.env.COMFYUI_IMAGE_WORKFLOW_JSON : process.env.COMFYUI_VIDEO_WORKFLOW_JSON;
  return Boolean(String(raw || '').trim());
}

function comfyHeaders(): Record<string,string> {
  const token = String(process.env.COMFYUI_TOKEN || '').trim();
  return {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function parsePreset(kind: ComfyMediaKind): Record<string, unknown> | null {
  const raw = kind === 'image' ? process.env.COMFYUI_IMAGE_WORKFLOW_JSON : process.env.COMFYUI_VIDEO_WORKFLOW_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function applyWorkflowBindings<T>(value: T, bindings: Record<string, string | number>): T {
  if (typeof value === 'string') {
    const exact = value.match(/^\{\{([A-Z0-9_]+)\}\}$/);
    if (exact && Object.prototype.hasOwnProperty.call(bindings, exact[1])) {
      return bindings[exact[1]] as T;
    }
    let out = String(value);
    for (const [key, replacement] of Object.entries(bindings)) {
      out = out.split(`{{${key}}}`).join(String(replacement));
    }
    return out as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyWorkflowBindings(item, bindings)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = applyWorkflowBindings(child, bindings);
    }
    return out as T;
  }
  return value;
}

function clampInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.floor(Number(value)) : fallback;
  return Math.max(min, Math.min(max, n));
}

export async function getComfyStatus(): Promise<{ configured: boolean; ok: boolean; error?: string; stats?: unknown }> {
  if (!isComfyConfigured()) return { configured: false, ok: false, error: 'COMFYUI_BASE_URL não configurado.' };
  try {
    const res = await fetch(`${comfyBaseUrl()}/system_stats`, {
      headers: comfyHeaders(),
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    if (!res.ok) return { configured: true, ok: false, error: `ComfyUI HTTP ${res.status}` };
    return { configured: true, ok: true, stats: await res.json().catch(() => null) };
  } catch (error: any) {
    return { configured: true, ok: false, error: error?.message || 'ComfyUI indisponível' };
  }
}

export async function queueComfyMedia(input: ComfyQueueInput): Promise<ComfyQueueResult> {
  const started = Date.now();
  if (!isComfyConfigured()) {
    return { ok: false, error: 'COMFYUI_BASE_URL não configurado.', latencyMs: 0 };
  }

  const baseWorkflow = input.workflow || parsePreset(input.kind);
  if (!baseWorkflow) {
    const env = input.kind === 'image' ? 'COMFYUI_IMAGE_WORKFLOW_JSON' : 'COMFYUI_VIDEO_WORKFLOW_JSON';
    return { ok: false, error: `${env} não configurado e nenhum workflow foi fornecido.`, latencyMs: 0 };
  }

  const prompt = String(input.prompt || '').trim();
  if (!prompt) return { ok: false, error: 'Prompt vazio.', latencyMs: 0 };

  const width = clampInt(input.width, input.kind === 'video' ? 1280 : 1024, 256, 4096);
  const height = clampInt(input.height, input.kind === 'video' ? 720 : 1024, 256, 4096);
  const frames = clampInt(input.frames, input.kind === 'video' ? 81 : 1, 1, 1200);
  const seed = Number.isFinite(input.seed) ? Math.floor(Number(input.seed)) : Math.floor(Math.random() * 2_147_483_647);

  const workflow = applyWorkflowBindings(baseWorkflow, {
    PROMPT: prompt.slice(0, 8000),
    NEGATIVE_PROMPT: String(input.negativePrompt || '').slice(0, 4000),
    WIDTH: width,
    HEIGHT: height,
    FRAMES: frames,
    SEED: seed,
  });

  if (JSON.stringify(workflow).length > 1_500_000) {
    return { ok: false, error: 'Workflow excede o limite de 1,5 MB.', latencyMs: 0 };
  }

  try {
    const res = await fetch(`${comfyBaseUrl()}/prompt`, {
      method: 'POST',
      headers: comfyHeaders(),
      body: JSON.stringify({
        prompt: workflow,
        client_id: 'lexispredict-server',
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message || data?.error || data?.message || `ComfyUI HTTP ${res.status}`,
        latencyMs: Date.now() - started,
      };
    }

    const promptId = String(data?.prompt_id || data?.promptId || '').trim();
    return {
      ok: Boolean(promptId),
      promptId: promptId || undefined,
      number: Number.isFinite(data?.number) ? Number(data.number) : undefined,
      error: promptId ? undefined : 'ComfyUI não retornou prompt_id.',
      latencyMs: Date.now() - started,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || 'Falha ao enfileirar workflow no ComfyUI',
      latencyMs: Date.now() - started,
    };
  }
}

export async function getComfyHistory(promptId: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const id = String(promptId || '').trim();
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(id)) return { ok: false, error: 'prompt_id inválido.' };
  if (!isComfyConfigured()) return { ok: false, error: 'ComfyUI não configurado.' };

  try {
    const res = await fetch(`${comfyBaseUrl()}/history/${encodeURIComponent(id)}`, {
      headers: comfyHeaders(),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `ComfyUI HTTP ${res.status}` };
    return { ok: true, data };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Falha ao consultar histórico ComfyUI' };
  }
}
