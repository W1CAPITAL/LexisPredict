
import { describe, it, expect } from 'vitest';
import { colibriConfig } from './colibri';
describe('Colibri integration', () => {
  it('is disabled without an external server', () => {
    expect(colibriConfig({ NODE_ENV: 'production' })).toBeNull();
  });
  it('accepts HTTPS OpenAI-compatible endpoints', () => {
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://llm.example.com/v1/' })?.endpoint)
      .toBe('https://llm.example.com/v1/chat/completions');
  });
  it('rejects localhost and embedded authentication on production', () => {
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'http://127.0.0.1:8000/v1' })).toBeNull();
    expect(colibriConfig({ NODE_ENV: 'production', COLIBRI_BASE_URL: 'https://u:p@llm.example.com/v1' })).toBeNull();
  });
});
