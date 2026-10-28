import { describe, expect, it } from 'vitest';
import {
  claimListingHref,
  parseClaimListingPath,
  parseClaimSchoolName,
} from '@/lib/contact/claim-listing';
import { resolveContactTopic } from '@/lib/contact/schema';

describe('claim listing contact deep-link', () => {
  it('routes owners to the contact form with the listing attached', () => {
    expect(
      claimListingHref({
        name: 'Moderna Trafikskola',
        listing: '/trafikskola/goteborg/moderna-trafikskola-7cb0cb93',
      }),
    ).toBe(
      '/contact?topic=claim_listing&school=Moderna+Trafikskola&listing=%2Ftrafikskola%2Fgoteborg%2Fmoderna-trafikskola-7cb0cb93',
    );
  });

  it('accepts claim aliases and keeps listing paths on this site', () => {
    expect(resolveContactTopic('claim')).toBe('claim_listing');
    expect(resolveContactTopic('claim_listing')).toBe('claim_listing');
    expect(parseClaimListingPath('/trafikskola/goteborg/moderna-trafikskola-7cb0cb93')).toBe(
      '/trafikskola/goteborg/moderna-trafikskola-7cb0cb93',
    );
    expect(parseClaimListingPath('/schools/moderna-trafikskola')).toBe(
      '/schools/moderna-trafikskola',
    );
  });

  it('drops off-site listings, control characters, and empty names', () => {
    expect(parseClaimListingPath('https://evil.example/trafikskola/x')).toBeNull();
    expect(parseClaimListingPath('/trafikskola/../login')).toBeNull();
    expect(parseClaimListingPath('/instructors/abc')).toBeNull();
    expect(parseClaimSchoolName('  Moderna   Trafikskola  ')).toBe('Moderna Trafikskola');
    expect(parseClaimSchoolName('')).toBeNull();
    expect(parseClaimSchoolName('A'.repeat(121))).toBeNull();
  });
});
