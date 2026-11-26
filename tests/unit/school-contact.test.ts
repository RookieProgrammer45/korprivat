import { describe, expect, it } from 'vitest';
import {
  phoneFact,
  resolvePriceRequest,
  resolveSchoolContact,
} from '@/lib/discovery/school-contact';

describe('resolveSchoolContact', () => {
  it('emails the school even when a phone number and a website exist', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'SCHOOL',
        email: 'info@alvesta-trafikskola.se',
        bio: 'https://alvesta-trafikskola.se',
        inbox: 'other@alvesta-trafikskola.se',
      }),
    ).toEqual({ kind: 'inbox', href: 'mailto:info@alvesta-trafikskola.se' });
  });

  it('uses the address printed on the school website when the listing has none', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'SCHOOL',
        email: null,
        bio: 'https://alvesta-trafikskola.se',
        inbox: 'info@alvesta-trafikskola.se',
      }),
    ).toEqual({ kind: 'inbox', href: 'mailto:info@alvesta-trafikskola.se' });
  });

  it('falls back to the first safe website when the school has no email', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'SCHOOL',
        email: null,
        bio: 'Mer info: https://www.hornstullstrafikskola.com/kontakt tack.',
      }),
    ).toEqual({
      kind: 'website',
      href: 'https://www.hornstullstrafikskola.com/kontakt',
    });
  });

  it('uses a bare email in the bio when the email column is empty', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'SCHOOL',
        email: '  ',
        bio: 'Skriv till fogelsnyatrafikskola2017@gmail.com',
      }),
    ).toEqual({
      kind: 'inbox',
      href: 'mailto:fogelsnyatrafikskola2017@gmail.com',
    });
  });

  it('returns null for a non-school listing', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'INSTRUCTOR',
        email: 'erik@example.com',
        bio: 'https://example.com',
      }),
    ).toBeNull();
  });

  it('rejects header-injection emails and javascript urls', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'SCHOOL',
        email: 'info@school.se\nbcc:other@example.com',
        bio: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });
});

describe('phoneFact', () => {
  it('keeps the number as printed, for the information section', () => {
    expect(phoneFact({ display: '0472-124 70', e164: '+4647212470' })).toEqual({
      display: '0472-124 70',
      href: 'tel:+4647212470',
    });
  });

  it('drops a number that is not a Swedish phone', () => {
    expect(phoneFact({ display: 'x', e164: 'javascript:alert(1)' })).toBeNull();
  });
});

describe('resolvePriceRequest', () => {
  it('asks by email first, so the message can be pre-filled', () => {
    expect(
      resolvePriceRequest({
        providerRole: 'SCHOOL',
        email: 'info@alvesta-trafikskola.se',
        bio: 'https://alvesta-trafikskola.se',
      }),
    ).toEqual({ kind: 'inbox', href: 'mailto:info@alvesta-trafikskola.se' });
  });

  it('falls back to the website when the school has no email', () => {
    expect(resolvePriceRequest({ providerRole: 'SCHOOL', bio: 'https://a.se' })?.kind).toBe(
      'website',
    );
  });

  it('returns null for a non-school listing', () => {
    expect(resolvePriceRequest({ providerRole: 'INSTRUCTOR' })).toBeNull();
  });
});
