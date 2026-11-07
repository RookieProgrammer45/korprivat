import { describe, expect, it } from 'vitest';
import { defaultLocale, locales } from '@/i18n/config';
import { publicAlternates } from '@/lib/seo/alternates';
import {
  isSchoolProfilePath,
  localeHreflang,
  localeHtmlLang,
  localePath,
  localeProxyDecision,
  parseLocalePrefix,
  sitemapPathsFor,
  switchLocalePath,
} from '@/lib/seo/locale-path';

describe('parseLocalePrefix', () => {
  it('leaves Swedish unprefixed paths unchanged', () => {
    expect(parseLocalePrefix('/locations/se')).toEqual({
      locale: 'sv',
      pathname: '/locations/se',
      hadPrefix: false,
    });
    expect(parseLocalePrefix('/')).toEqual({
      locale: 'sv',
      pathname: '/',
      hadPrefix: false,
    });
  });

  it('strips a non-Swedish locale prefix', () => {
    expect(parseLocalePrefix('/de/locations/se')).toEqual({
      locale: 'de',
      pathname: '/locations/se',
      hadPrefix: true,
    });
    expect(parseLocalePrefix('/en')).toEqual({
      locale: 'en',
      pathname: '/',
      hadPrefix: true,
    });
    expect(parseLocalePrefix('/nb/faq')).toEqual({
      locale: 'nb',
      pathname: '/faq',
      hadPrefix: true,
    });
  });

  it('does not treat country hubs as locale prefixes', () => {
    expect(parseLocalePrefix('/locations/de')).toMatchObject({
      locale: 'sv',
      pathname: '/locations/de',
      hadPrefix: false,
    });
  });
});

describe('localePath and switchLocalePath', () => {
  it('keeps Swedish URLs unprefixed', () => {
    expect(localePath('sv', '/faq')).toBe('/faq');
    expect(localePath('sv', '/')).toBe('/');
  });

  it('prefixes non-Swedish locales', () => {
    expect(localePath('de', '/faq')).toBe('/de/faq');
    expect(localePath('en', '/')).toBe('/en');
    expect(localePath('pl', '/locations/se/stockholm')).toBe('/pl/locations/se/stockholm');
  });

  it('switches locale without stacking prefixes', () => {
    expect(switchLocalePath('/de/faq', 'fr')).toBe('/fr/faq');
    expect(switchLocalePath('/de/faq', 'sv')).toBe('/faq');
    expect(switchLocalePath('/faq', 'en')).toBe('/en/faq');
  });
});

describe('localeProxyDecision', () => {
  it('rewrites prefixed locales to the unprefixed route', () => {
    expect(localeProxyDecision('/de/locations/se')).toEqual({
      action: 'rewrite',
      pathname: '/locations/se',
      locale: 'de',
    });
  });

  it('redirects /sv/... to the unprefixed Swedish URL', () => {
    expect(localeProxyDecision('/sv/faq')).toEqual({
      action: 'redirect',
      pathname: '/faq',
    });
    expect(localeProxyDecision('/sv')).toEqual({
      action: 'redirect',
      pathname: '/',
    });
  });

  it('leaves unprefixed Swedish paths alone', () => {
    expect(localeProxyDecision('/locations/se')).toEqual({ action: 'next' });
    expect(localeProxyDecision('/')).toEqual({ action: 'next' });
  });
});

describe('publicAlternates', () => {
  it('gives each language a unique URL and keeps Swedish unprefixed', () => {
    const alts = publicAlternates('/locations', 'de');
    expect(alts.canonical).toBe('/de/locations');
    expect(alts.languages['sv-SE']).toMatch(/\/locations$/);
    expect(alts.languages['sv-SE']).not.toContain('/sv/');
    expect(alts.languages.en).toMatch(/\/en\/locations$/);
    expect(alts.languages['nb-NO']).toMatch(/\/nb\/locations$/);
    expect(alts.languages.de).toMatch(/\/de\/locations$/);
    expect(alts.languages['x-default']).toBe(alts.languages['sv-SE']);
  });

  it('uses the unprefixed path as the Swedish canonical', () => {
    const alts = publicAlternates('/faq', 'sv');
    expect(alts.canonical).toBe('/faq');
    expect(alts.languages['sv-SE']).toBe(alts.languages['x-default']);
  });
});

describe('swedishCanonicalAlternates', () => {
  it('does not advertise untranslated language versions', async () => {
    const { swedishCanonicalAlternates } = await import('@/lib/seo/alternates');
    const alts = swedishCanonicalAlternates('/blog/riskutbildning-korkort-b');
    expect(alts.canonical).toBe('/blog/riskutbildning-korkort-b');
    expect(Object.keys(alts.languages).sort()).toEqual(['sv-SE', 'x-default'].sort());
    const school = swedishCanonicalAlternates('/trafikskola/stockholm/example');
    expect(school.canonical).toBe('/trafikskola/stockholm/example');
    expect(school.languages.de).toBeUndefined();
    expect(school.languages['sv-SE']).toMatch(/\/trafikskola\/stockholm\/example$/);
  });
});

describe('sitemapPathsFor', () => {
  it('adds locale prefixes for hubs and editorial pages, not school profiles', () => {
    const hub = sitemapPathsFor('/locations/se/stockholm');
    expect(hub).toContain('/locations/se/stockholm');
    expect(hub).toContain('/de/locations/se/stockholm');
    expect(hub).toContain('/en/locations/se/stockholm');
    expect(hub).toHaveLength(locales.length);

    const school = sitemapPathsFor('/trafikskola/stockholm/fogels-trafikskola-abcd1234');
    expect(school).toEqual(['/trafikskola/stockholm/fogels-trafikskola-abcd1234']);
    expect(isSchoolProfilePath('/schools/some-slug')).toBe(true);
    expect(sitemapPathsFor('/blog/riskutbildning-korkort-b')).toEqual([
      '/blog/riskutbildning-korkort-b',
    ]);
    expect(sitemapPathsFor('/blog')).toContain('/de/blog');
  });

  it('does not invent a /sv prefix', () => {
    expect(sitemapPathsFor('/faq')).not.toContain('/sv/faq');
    expect(sitemapPathsFor('/')).toContain('/');
    expect(sitemapPathsFor('/')).toContain('/en');
    expect(sitemapPathsFor('/')).not.toContain('/sv');
  });
});

describe('locale catalogs', () => {
  it('covers the major-search locale set', () => {
    expect(defaultLocale).toBe('sv');
    expect([...locales]).toEqual([
      'sv',
      'en',
      'nb',
      'da',
      'fi',
      'de',
      'fr',
      'nl',
      'es',
      'it',
      'pl',
    ]);
    expect(localeHreflang.sv).toBe('sv-SE');
    expect(localeHtmlLang.de).toBe('de');
  });
});
