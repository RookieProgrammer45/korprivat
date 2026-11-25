import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeLocaleCookie } from '@/lib/locale-cookie';

describe('writeLocaleCookie', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie.split(';').forEach((part) => {
      const name = part.split('=')[0]?.trim();
      // biome-ignore lint/suspicious/noDocumentCookie: test cleanup of the same cookie the production helper writes
      if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
    });
  });

  it('writes NEXT_LOCALE for a known locale', () => {
    vi.stubGlobal('window', { location: { protocol: 'http:' } });
    expect(writeLocaleCookie('en')).toBe(true);
    expect(document.cookie).toContain('NEXT_LOCALE=en');
  });

  it('rejects unknown locales', () => {
    expect(writeLocaleCookie('xx')).toBe(false);
  });
});
