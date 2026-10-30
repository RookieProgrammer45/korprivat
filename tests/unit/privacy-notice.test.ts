import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/privacy';

function loadMessages(locale: 'en' | 'sv') {
  return JSON.parse(readFileSync(join(process.cwd(), `messages/${locale}.json`), 'utf8')) as {
    privacyPage: {
      hero: Record<string, string>;
      sections: Record<string, { title: string; body: string; items: string[] }>;
    };
    termsPage: { sections: Record<string, { body: string; items: string[] }> };
  };
}

describe('published privacy notice', () => {
  it('is a live notice, not a draft awaiting counsel', () => {
    expect(PRIVACY_POLICY_VERSION).toBe('v2026.10.27');
    expect(HANDLEDARE_TERMS_VERSION).toBe('v1.1.0');
    for (const locale of ['en', 'sv'] as const) {
      const page = loadMessages(locale).privacyPage;
      expect(page.hero.reviewNotice).toBeUndefined();
      const blob = JSON.stringify(page);
      expect(blob).not.toMatch(/legal review|juridik|juristgransk/i);
      expect(blob).toMatch(/frank@drivelinkup\.com/);
      expect(blob).not.toMatch(/Stripe|hosted payment|betalningsleverantör/i);
      expect(blob).toMatch(
        /do not currently collect card numbers|samlar just nu inte in kortnummer/,
      );
    }
  });

  it('keeps English and Swedish section keys in parity', () => {
    const en = Object.keys(loadMessages('en').privacyPage.sections);
    const sv = Object.keys(loadMessages('sv').privacyPage.sections);
    expect(sv).toEqual(en);
    expect(en).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
    ]);
    expect(Object.keys(loadMessages('sv').termsPage.sections)).toEqual(
      Object.keys(loadMessages('en').termsPage.sections),
    );
  });

  it('points terms support at the same inbox as the privacy notice', () => {
    for (const locale of ['en', 'sv'] as const) {
      const blob = JSON.stringify(loadMessages(locale).termsPage);
      expect(blob).toMatch(/frank@drivelinkup\.com/);
      expect(blob).not.toMatch(/support@drivelinkup\.com/);
    }
  });
});
