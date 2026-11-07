import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';

function loadMessages(locale: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `messages/${locale}.json`), 'utf8'),
  ) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageKeys(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(child) ? [path, ...messageKeys(child, path)] : [path];
  });
}

describe('public marketplace localization', () => {
  it('keeps every locale message file in lockstep with English', () => {
    const english = messageKeys(loadMessages('en')).sort();
    for (const locale of locales) {
      expect({ locale, keys: messageKeys(loadMessages(locale)).sort() }).toEqual({
        locale,
        keys: english,
      });
    }
  });

  it('does not leave machine-translation placeholder tokens in catalogs', () => {
    for (const locale of locales) {
      const raw = JSON.stringify(loadMessages(locale));
      expect(raw.includes('__PH')).toBe(false);
    }
  });

  it('uses native titles on major-language location hubs, not English clones', () => {
    expect(
      (loadMessages('de') as { locationHub: { meta: { indexTitle: string } } }).locationHub.meta
        .indexTitle,
    ).toBe('Fahrschulen');
    expect(
      (loadMessages('fr') as { locationHub: { meta: { indexTitle: string } } }).locationHub.meta
        .indexTitle,
    ).toBe('Auto-écoles');
    expect(
      (loadMessages('nb') as { locationHub: { meta: { indexTitle: string } } }).locationHub.meta
        .indexTitle,
    ).toBe('Trafikkskoler');
  });

  it('uses native FAQ copy on indexed major-language pages', () => {
    const de = loadMessages('de') as {
      faqPage: { items: { scope: { q: string }; prerequisites: { q: string } } };
    };
    const fr = loadMessages('fr') as { faqPage: { items: { scope: { q: string } } } };
    expect(de.faqPage.items.scope.q).toBe('Was finde ich?');
    expect(de.faqPage.items.prerequisites.q.length).toBeGreaterThan(0);
    expect(de.faqPage.items.scope.q).not.toContain('What can I find');
    expect(fr.faqPage.items.scope.q).toContain('trouver');
  });

  it('uses native SERP titles on indexed marketing pages', () => {
    const de = loadMessages('de') as {
      aboutPage: { meta: { title: string } };
      pricingPage: { meta: { title: string } };
    };
    expect(de.aboutPage.meta.title).toBe('Über uns');
    expect(de.pricingPage.meta.title).toBe('Preise');
    expect(de.aboutPage.meta.title).not.toBe('About us');
  });

  it('keeps /locations metadata keys that generateMetadata reads', () => {
    for (const locale of locales) {
      const messages = loadMessages(locale);
      expect(isRecord(messages)).toBe(true);
      const hub = isRecord(messages) ? messages.locationHub : null;
      expect(isRecord(hub)).toBe(true);
      const meta = isRecord(hub) ? hub.meta : null;
      expect(isRecord(meta)).toBe(true);
      if (!isRecord(meta)) continue;
      expect(typeof meta.indexTitle).toBe('string');
      expect(String(meta.indexTitle).length).toBeGreaterThan(0);
      expect(String(meta.indexTitle)).not.toContain('locationHub');
      expect(typeof meta.indexSubtitle).toBe('string');
      expect(String(meta.indexSubtitle).length).toBeGreaterThan(0);
    }
  });

  it('does not reintroduce retired public marketplace claims', () => {
    const publicCopy = JSON.stringify(
      Object.fromEntries(locales.map((locale) => [locale, loadMessages(locale)])),
    ).toLowerCase();
    const retiredPhrases = [
      '5% service',
      '5 % service',
      'learner service fee',
      'serviceavgift',
      'airbnb',
      'fiverr',
      'guaranteed bookings',
      'guaranteed settlement',
      'garanterade bokningar',
      'garanterad utbetalning',
    ];

    for (const phrase of retiredPhrases) {
      expect(publicCopy).not.toContain(phrase);
    }
  });
});
