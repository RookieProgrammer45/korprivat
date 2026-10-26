import { describe, expect, it } from 'vitest';
import { resolveSchoolContact } from '@/lib/discovery/school-contact';

describe('resolveSchoolContact', () => {
  it('prefers the school inbox over a website in the bio', () => {
    expect(
      resolveSchoolContact({
        providerRole: 'SCHOOL',
        email: 'info@sjobotrafikskola.se',
        bio: 'Auktoriserad trafikskola. https://www.sjobotrafikskola.se',
      }),
    ).toEqual({
      kind: 'inbox',
      href: 'mailto:info@sjobotrafikskola.se',
    });
  });

  it('falls back to the first safe website when the listing has no email', () => {
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
