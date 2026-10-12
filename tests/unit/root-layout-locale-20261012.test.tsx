import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { documentLocaleAttributes } from '@/lib/public-locale';

describe('root document locale — 2026-10-12', () => {
  const layout = readFileSync(resolve(process.cwd(), 'src/app/layout.tsx'), 'utf8');

  it('connects the root document attributes to the same active request resolver as next-intl', () => {
    expect(layout).toContain("import { resolveLocale } from '@/lib/i18n';");
    expect(layout).toContain('const [requestHeaders, activeLocale] = await Promise.all');
    expect(layout).toContain('documentLocaleAttributes(activeLocale)');
    expect(layout).toContain('<html lang={lang} dir={dir} suppressHydrationWarning>');
  });

  it.each([
    ['sv', 'sv'],
    ['en', 'en'],
    ['invalid cookie fallback', 'sv'],
  ] as const)('maps resolved %s to document lang=%s', (_case, locale) => {
    expect(documentLocaleAttributes(locale).lang).toBe(locale);
  });
});
