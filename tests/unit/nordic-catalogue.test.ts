import { describe, expect, it } from 'vitest';
import { InstructorItem } from '@/lib/contracts/instructors';
import {
  listNordicInstructors,
  nordicInstructorById,
  nordicListedCount,
  toNordicInstructor,
} from '@/lib/discovery/nordic-catalogue';

const base = {
  id: 'noabc123-example-trafikkskole',
  country: 'NO' as const,
  name: 'Example Trafikkskole',
  city: 'Oslo',
  website: 'https://example-trafikkskole.no',
  categories: ['B'],
  heavy: [],
  email: 'post@example-trafikkskole.no',
  phone: '+4722334455',
  lessonPrice: 980,
  lessonMinutes: 45,
  currency: 'NOK' as const,
  sourceUrl: 'https://example-trafikkskole.no',
  checkedAt: '2026-10-28',
  websiteStatus: 'OK',
};

describe('nordic catalogue', () => {
  it('keeps a school as an unverified contact listing with the local currency', () => {
    const item = toNordicInstructor(base);
    expect(item).not.toBeNull();
    const parsed = InstructorItem.parse(item);
    expect(parsed.verificationStatus).toBe('unverified');
    expect(parsed.bookingMode).toBe('contact');
    expect(parsed.canCollectPayment).toBe(false);
    expect(parsed.surfaces?.directoryOnly).toBe(true);
    expect(parsed.surfaces?.transactionalBooking).toBe(false);
    expect(parsed.hourlyRateSek).toBe(0);
    expect(parsed.languages).toEqual(['no']);
    expect(parsed.publishedPrices?.currency).toBe('NOK');
    expect(parsed.publishedPrices?.lesson?.priceSek).toBe(980);
    expect(parsed.contact?.href).toBe('mailto:post@example-trafikkskole.no');
    expect(parsed.phone?.display).toBe('+47 22 33 44 55');
    expect(parsed).not.toHaveProperty('email');
  });

  it('drops placeholder inboxes, invalid phones, and prices that are not a lesson', () => {
    const item = toNordicInstructor({
      ...base,
      email: 'bruker@domene.no',
      phone: '+4711111111',
      lessonPrice: 4600,
    });
    expect(item?.contact?.kind).toBe('website');
    expect(item?.contact?.href).toBe('https://example-trafikkskole.no/');
    expect(item?.phone).toBeNull();
    expect(item?.publishedPrices?.lesson ?? null).toBeNull();
    expect(item?.priceRequest?.kind).toBe('website');
  });

  it('does not list a school with no website or no car category', () => {
    expect(toNordicInstructor({ ...base, website: null })).toBeNull();
    expect(toNordicInstructor({ ...base, categories: [], heavy: ['C'] })).toBeNull();
  });

  it('does not mix Nordic prices into a SEK rate filter or a motorcycle search', () => {
    expect(listNordicInstructors({ minRate: 500 }).length).toBe(0);
    expect(
      listNordicInstructors({ categories: ['A'], city: 'Oslo' }).some(
        (row) => row.categories.length === 1 && row.categories[0] === 'B',
      ),
    ).toBe(false);
  });

  it('loads the collected file without a verified badge', () => {
    expect(nordicListedCount()).toBeGreaterThan(0);
    const sample = nordicInstructorById(
      listNordicInstructors({}).find((row) => row.city === 'Oslo')?.id ?? '',
    );
    expect(sample?.verificationStatus).toBe('unverified');
    expect(sample?.canCollectPayment).toBe(false);
  });
});
