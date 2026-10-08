import { afterEach, describe, expect, it, vi } from 'vitest';
import { colibriConfig, discoverColibriModel, probeColibri } from './colibri';

afterEach(() => vi.unstubAllGlobals());

describe('Colibri integration', () => {
  it('is disabled without an external HTTPS server', () => {
    expect(colibriConfig({ NODE_ENV: 'production' })).toBeNull();
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'http://127.0.0.1:8000/v1' })).toBeNull();
  });
  it('accepts HTTPS base URLs and complete OpenAI paths', () => {
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://llm.example.com/v1/' })?.endpoint)
      .toBe('https://llm.example.com/v1/chat/completions');
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://llm.example.com/v1/chat/completions' })?.endpoint)
      .toBe('https://llm.example.com/v1/chat/completions');
  });
  it('rejects embedded URL credentials and query strings', () => {
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://u:p@llm.example.com/v1' })).toBeNull();
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://llm.example.com/v1?token=secret' })).toBeNull();
  });
  it('discovers the actual light model rather than sending the invalid identifier auto', async () => {
    const cfg = colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://llm-qwen.example.com/v1', COLIBRI_MODEL: 'auto' })!;
    const fake = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ id: 'qwen3-coder-30b-colibri' }] }) }));
    vi.stubGlobal('fetch', fake);
    expect(await discoverColibriModel(cfg)).toBe('qwen3-coder-30b-colibri');
    expect(String(fake.mock.calls[0]?.[0])).toBe('https://llm-qwen.example.com/v1/models');
  });
  it('respects a fixed model without attempting discovery', async () => {
    const cfg = colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://llm.example.com/v1', COLIBRI_MODEL: 'olm0e-7b-colibri' })!;
    const fake = vi.fn();
    vi.stubGlobal('fetch', fake);
    expect(await discoverColibriModel(cfg)).toBe('olm0e-7b-colibri');
    expect(fake).not.toHaveBeenCalled();
  });
  it('reports not configured with no HTTP requests', async () => {
    const old = process.env.COLIBRI_BASE_URL;
    delete process.env.COLIBRI_BASE_URL;
    try {
      const fake = vi.fn();
      vi.stubGlobal('fetch', fake);
      const status = await probeColibri();
      expect(status.configured).toBe(false);
      expect(fake).not.toHaveBeenCalled();
    } finally {
      if (old === undefined) delete process.env.COLIBRI_BASE_URL;
      else process.env.COLIBRI_BASE_URL = old;
    }
  });
});
