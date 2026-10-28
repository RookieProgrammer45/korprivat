import { describe, expect, it } from 'vitest';
import { SocialRoleRequest } from '@/lib/contracts/auth';
import { LicenseUploadResponse } from '@/lib/contracts/instructor-license';
import { resetIpRateLimitForTests, takeIpToken } from '@/lib/http/ip-rate-limit';
import { navItems } from '@/lib/nav';
import { robotsConfig } from '@/lib/robots-config';
import { isSitemapDisallowed, renderRobotsTxt } from '@/lib/robots-txt';
import { siteDescription } from '@/lib/site';
import { licenseFileAccepted, magicLooksLikeLicense } from '@/lib/verification/license-file';

describe('ip rate limit', () => {
  it('allows up to max then returns retry-after', () => {
    resetIpRateLimitForTests();
    expect(takeIpToken('seo-audit', { max: 2 }).ok).toBe(true);
    expect(takeIpToken('seo-audit', { max: 2 }).ok).toBe(true);
    const blocked = takeIpToken('seo-audit', { max: 2 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

describe('open-redirect contract', () => {
  it('rejects protocol-relative next paths', () => {
    expect(SocialRoleRequest.safeParse({ role: 'STUDENT', next: '//evil.test' }).success).toBe(
      false,
    );
  });
});

describe('public SEO surfaces', () => {
  it('keeps login-walled catalogues out of robots and sitemap sources', () => {
    expect(robotsConfig.disallow).toEqual(
      expect.arrayContaining([
        '/instructors',
        '/tung-trafik',
        '/dashboard',
        '/admin',
        '/api/',
        '/login',
      ]),
    );
    expect(robotsConfig.disallow).not.toContain('/trafikskola');
    expect(robotsConfig.disallow).not.toContain('/locations');
    const gated = navItems.filter((item) => item.catalogGated).map((item) => item.href);
    expect(gated).toEqual(expect.arrayContaining(['/instructors', '/tung-trafik']));
    expect(isSitemapDisallowed('/instructors')).toBe(true);
    expect(isSitemapDisallowed('/signup')).toBe(true);
    expect(isSitemapDisallowed('/trafikskola/stockholm/example')).toBe(false);
    expect(isSitemapDisallowed('/locations/se/stockholm')).toBe(false);
  });

  it('emits Disallow lines when the deploy is indexable', () => {
    const previous = process.env.SEO_INDEXABLE;
    process.env.SEO_INDEXABLE = 'true';
    const body = renderRobotsTxt();
    if (previous === undefined) delete process.env.SEO_INDEXABLE;
    else process.env.SEO_INDEXABLE = previous;
    expect(body).toContain('Disallow: /instructors');
    expect(body).toContain('Disallow: /tung-trafik');
    expect(body).toContain('Disallow: /admin');
    expect(body).toContain('Sitemap:');
  });

  it('describes a free directory, not a learner-only marketplace', () => {
    expect(siteDescription.toLowerCase()).toContain('katalog');
    expect(siteDescription.toLowerCase()).not.toContain('marknadsplats');
    expect(siteDescription.toLowerCase()).not.toContain('kostnadsfritt för elever');
  });
});

describe('licence upload hardening', () => {
  it('rejects spoofed MIME that does not match magic bytes', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const html = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0]);
    expect(magicLooksLikeLicense(jpeg, 'image/jpeg')).toBe(true);
    expect(magicLooksLikeLicense(html, 'image/jpeg')).toBe(false);
    expect(licenseFileAccepted('image/svg+xml', 100, 20_000_000, 50_000_000).ok).toBe(false);
  });

  it('does not echo the stored file URL to the uploader', () => {
    const parsed = LicenseUploadResponse.safeParse({
      status: 'PENDING',
      submittedAt: '2026-10-27T00:00:00.000Z',
      fileUrl: 'https://blob.vercel-storage.com/secret-licence.pdf',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('fileUrl' in parsed.data).toBe(false);
    }
  });
});
