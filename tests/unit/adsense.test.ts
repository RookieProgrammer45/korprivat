import { describe, expect, it } from 'vitest';
import {
  ADSENSE_CLIENT_DEFAULT,
  adsenseAllowedByConsent,
  adsenseClient,
  adsenseScriptSrc,
  isAdsenseClient,
} from '@/lib/adsense';

describe('AdSense publisher id', () => {
  it('uses a valid env client when present', () => {
    expect(adsenseClient('ca-pub-111')).toBe('ca-pub-111');
  });

  it('falls back to the live publisher id', () => {
    expect(adsenseClient('')).toBe(ADSENSE_CLIENT_DEFAULT);
    expect(adsenseClient('not-a-pub')).toBe(ADSENSE_CLIENT_DEFAULT);
    expect(isAdsenseClient(ADSENSE_CLIENT_DEFAULT)).toBe(true);
  });

  it('builds the official loader URL', () => {
    expect(adsenseScriptSrc(ADSENSE_CLIENT_DEFAULT)).toBe(
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_DEFAULT}`,
    );
  });

  it('loads AdSense only when marketing consent is on', () => {
    expect(adsenseAllowedByConsent(null)).toBe(false);
    expect(adsenseAllowedByConsent({ marketing: false })).toBe(false);
    expect(adsenseAllowedByConsent({ marketing: true })).toBe(true);
  });
});
