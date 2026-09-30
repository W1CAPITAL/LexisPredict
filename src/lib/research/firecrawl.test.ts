import { describe, expect, it } from 'vitest';
import { isPublicHttpUrl } from './firecrawl';

describe('firecrawl URL guard', () => {
  it('accepts public http urls', () => {
    expect(isPublicHttpUrl('https://www.cnj.jus.br/')).toBe(true);
  });

  it('blocks localhost and private ipv4', () => {
    expect(isPublicHttpUrl('http://localhost:3000')).toBe(false);
    expect(isPublicHttpUrl('http://127.0.0.1/test')).toBe(false);
    expect(isPublicHttpUrl('http://192.168.1.10/test')).toBe(false);
    expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false);
  });
});
