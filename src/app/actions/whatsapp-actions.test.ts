import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ctx: vi.fn(),
  waConfigured: vi.fn(),
  waSend: vi.fn(),
  evolutionSend: vi.fn(),
  persist: vi.fn(),
  suggest: vi.fn(),
}));

vi.mock('@/lib/server-db', () => ({
  getUserContext: mocks.ctx,
  getWhatsAppHistory: vi.fn(async () => []),
}));
vi.mock('@/lib/evolution-api', () => ({
  normalizeBrPhone: (value: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length === 11 || digits.length === 10 ? `55${digits}` : digits;
  },
  sendTextMessageSafe: mocks.evolutionSend,
  evolutionHealthCheck: vi.fn(),
}));
vi.mock('@/lib/wa-auto-client', () => ({
  isWaAutoConfigured: mocks.waConfigured,
  sendViaWaAuto: mocks.waSend,
}));
vi.mock('@/lib/whatsapp-persist', () => ({
  persistWhatsAppMessage: mocks.persist,
}));
vi.mock('@/lib/script-processual/suggest', () => ({
  suggestScripts: mocks.suggest,
}));

import { sendWhatsAppAction, sendSuggestedReplyAction } from '@/app/actions/whatsapp-actions';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ctx.mockResolvedValue({ auth_id: 'user-1', empresa_id: 'empresa-1', isViewer: false });
  mocks.waConfigured.mockReturnValue(true);
  mocks.waSend.mockResolvedValue({ ok: true, raw: { key: 'message-1' } });
  mocks.evolutionSend.mockResolvedValue({ ok: true, raw: { key: 'other' } });
  mocks.persist.mockResolvedValue({ ok: true, id: 'saved-1' });
  mocks.suggest.mockReturnValue([{ titulo: 'Sugestão', texto: 'Mensagem revisada' }]);
});

describe('WA.Auto integration — safe delivery', () => {
  it('uses WA.Auto and persists the outbound with its company', async () => {
    const result = await sendWhatsAppAction('11999999999', 'Olá, cliente!');
    expect(result.success).toBe(true);
    expect(result.provider).toBe('waauto');
    expect(mocks.waSend).toHaveBeenCalledWith('11999999999', 'Olá, cliente!');
    expect(mocks.evolutionSend).not.toHaveBeenCalled();
    expect(mocks.persist).toHaveBeenCalledWith(expect.objectContaining({
      empresaId: 'empresa-1',
      contactNumber: '5511999999999',
      messageText: 'Olá, cliente!',
    }));
  });

  it('never retries with Evolution after an uncertain WA.Auto error', async () => {
    mocks.waSend.mockResolvedValue({ ok: false, error: 'timeout' });
    const result = await sendWhatsAppAction('11999999999', 'Olá');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Confira a conversa');
    expect(mocks.evolutionSend).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('blocks viewer and missing-company sessions before contacting WhatsApp', async () => {
    mocks.ctx.mockResolvedValueOnce({ auth_id: 'u', empresa_id: 'e', isViewer: true });
    expect((await sendWhatsAppAction('11999999999', 'Olá')).success).toBe(false);
    mocks.ctx.mockResolvedValueOnce({ auth_id: 'u', empresa_id: null, isViewer: false });
    expect((await sendWhatsAppAction('11999999999', 'Olá')).success).toBe(false);
    expect(mocks.waSend).not.toHaveBeenCalled();
  });

  it('routes suggested replies through the same WA.Auto transport', async () => {
    const result = await sendSuggestedReplyAction({
      to: '11999999999', protocolo: '00000000000000000000', sendIndex: 0,
    });
    expect(result.success).toBe(true);
    expect(result.sent).toBe(true);
    expect(mocks.waSend).toHaveBeenCalledWith('11999999999', 'Mensagem revisada');
    expect(mocks.evolutionSend).not.toHaveBeenCalled();
  });

  it('rejects invalid recipients without a remote request', async () => {
    const result = await sendWhatsAppAction('123', 'Olá');
    expect(result.success).toBe(false);
    expect(mocks.waSend).not.toHaveBeenCalled();
  });
});
