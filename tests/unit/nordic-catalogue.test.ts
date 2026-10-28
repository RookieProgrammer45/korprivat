import { describe, expect, it } from 'vitest';
import { InstructorItem } from '@/lib/contracts/instructors';
import {
  listNordicInstructors,
  nordicCountryHasSchools,
  nordicInstructorById,
  nordicListedCount,
  nordicSchoolCountInCity,
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

  it('does not list a school with no website or no category', () => {
    expect(toNordicInstructor({ ...base, website: null })).toBeNull();
    expect(toNordicInstructor({ ...base, categories: [], heavy: [] })).toBeNull();
  });

  it('lists a heavy-vehicle school with no car category and no lesson price', () => {
    const item = toNordicInstructor({
      ...base,
      categories: [],
      heavy: ['C', 'CE'],
      lessonPrice: null,
    });
    expect(item?.categories).toEqual([]);
    expect(item?.publishedPrices?.lesson ?? null).toBeNull();
    expect(item?.publishedPrices?.heavy?.categories).toEqual(['C', 'CE']);
    expect(item?.publishedPrices?.heavy?.prices).toEqual([]);
    expect(InstructorItem.parse(item).categories).toEqual([]);
  });

  it('does not mix Nordic prices into a SEK rate filter or a motorcycle search', () => {
    expect(listNordicInstructors({ minRate: 500 }).length).toBe(0);
    expect(
      listNordicInstructors({ categories: ['A'], city: 'Oslo' }).some(
        (row) => row.categories.length === 1 && row.categories[0] === 'B',
      ),
    ).toBe(false);
  });

  it('lists French and German heavy-vehicle schools without inventing a car category', () => {
    const heavy = listNordicInstructors({ heavy: 'all' });
    expect(heavy.some((school) => school.id.startsWith('eufr'))).toBe(true);
    expect(heavy.some((school) => school.id.startsWith('eude'))).toBe(true);
    expect(
      heavy
        .filter((school) => school.id.startsWith('eu'))
        .every((school) => (school.publishedPrices?.heavy?.categories.length ?? 0) > 0),
    ).toBe(true);
    expect(
      listNordicInstructors({}).some(
        (school) => school.id.startsWith('eufr') && school.categories.length === 0,
      ),
    ).toBe(false);
  });

  it('lists an Australian school only with the lesson price on its own site', () => {
    const item = toNordicInstructor({
      ...base,
      id: 'auabc123-example-driving-school',
      country: 'AU',
      name: 'Example Driving School',
      city: 'Sydney',
      website: 'https://example-driving-school.com.au',
      email: 'hello@example-driving-school.com.au',
      phone: '+61494720978',
      lessonPrice: 80,
      currency: 'AUD',
    });
    const parsed = InstructorItem.parse(item);
    expect(parsed.publishedPrices?.currency).toBe('AUD');
    expect(parsed.publishedPrices?.lesson?.priceSek).toBe(80);
    expect(parsed.languages).toEqual(['en']);
    expect(parsed.englishSpeaking).toBe(true);
    expect(parsed.phone?.display).toBe('+61 494 720 978');
    expect(parsed.verificationStatus).toBe('unverified');
    expect(
      toNordicInstructor({
        ...base,
        country: 'AU',
        currency: 'AUD',
        lessonPrice: null,
        city: 'Sydney',
      }),
    ).toBeNull();
  });

  it('lists a UK school only with the lesson price on its own site', () => {
    const item = toNordicInstructor({
      ...base,
      id: 'ukabc123-example-driving-school',
      country: 'GB',
      name: 'Example Driving School',
      city: 'London',
      website: 'https://example-driving-school.co.uk',
      phone: '+441414237777',
      lessonPrice: 40,
      currency: 'GBP',
    });
    const parsed = InstructorItem.parse(item);
    expect(parsed.publishedPrices?.currency).toBe('GBP');
    expect(parsed.publishedPrices?.lesson?.priceSek).toBe(40);
    expect(parsed.phone?.display).toBe('+44 141 423 7777');
    expect(parsed.serviceArea).toBe('London, United Kingdom');
    expect(
      toNordicInstructor({
        ...base,
        country: 'GB',
        currency: 'GBP',
        lessonPrice: null,
        city: 'London',
      }),
    ).toBeNull();
  });

  it('lists a European school with no lesson price yet, unverified and in euros', () => {
    const item = toNordicInstructor({
      ...base,
      id: 'euesabc123-example-autoescuela',
      country: 'ES',
      name: 'Example Autoescuela',
      city: 'Madrid',
      website: 'https://example-autoescuela.es',
      email: null,
      phone: null,
      lessonPrice: null,
      lessonMinutes: null,
      currency: 'EUR',
      language: 'es',
    });
    const parsed = InstructorItem.parse(item);
    expect(parsed.verificationStatus).toBe('unverified');
    expect(parsed.bookingMode).toBe('contact');
    expect(parsed.canCollectPayment).toBe(false);
    expect(parsed.publishedPrices).toBeNull();
    expect(parsed.priceRequest?.kind).toBe('website');
    expect(parsed.languages).toEqual(['es']);
    expect(parsed.englishSpeaking).toBe(false);
    expect(parsed.serviceArea).toBe('Madrid, Spain');
  });

  it('puts collected schools in the catalogue for the cities that have them', () => {
    expect(nordicSchoolCountInCity('Oslo')).toBeGreaterThan(0);
    expect(nordicSchoolCountInCity('Odense')).toBeGreaterThan(0);
    expect(nordicSchoolCountInCity('Reykjavík')).toBeGreaterThan(0);
    expect(nordicSchoolCountInCity('Helsinki')).toBe(0);
    expect(nordicCountryHasSchools('no')).toBe(true);
    expect(nordicCountryHasSchools('dk')).toBe(true);
    expect(nordicCountryHasSchools('is')).toBe(true);
    expect(nordicCountryHasSchools('fi')).toBe(false);
    expect(nordicCountryHasSchools('au')).toBe(true);
    expect(nordicCountryHasSchools('gb')).toBe(true);
    expect(nordicSchoolCountInCity('Sydney')).toBeGreaterThan(0);
    expect(nordicSchoolCountInCity('London')).toBeGreaterThan(0);
    expect(listNordicInstructors({ city: 'Oslo' }).length).toBeGreaterThan(0);
    const sydney = listNordicInstructors({ city: 'Sydney', english: true });
    expect(sydney.length).toBeGreaterThan(0);
    expect(sydney.every((row) => row.publishedPrices?.currency === 'AUD')).toBe(true);
    const london = listNordicInstructors({ city: 'London', english: true });
    expect(london.length).toBeGreaterThan(0);
    expect(london.every((row) => row.publishedPrices?.currency === 'GBP')).toBe(true);
    expect(listNordicInstructors({ city: 'Oslo', english: true })).toEqual([]);
    const madrid = listNordicInstructors({ city: 'Madrid' });
    expect(madrid.length).toBeGreaterThan(0);
    expect(madrid.every((row) => row.id.startsWith('eues'))).toBe(true);
    expect(madrid.every((row) => row.verificationStatus === 'unverified')).toBe(true);
    expect(madrid.every((row) => row.publishedPrices == null)).toBe(true);
    expect(nordicCountryHasSchools('es')).toBe(true);
    expect(nordicCountryHasSchools('fr')).toBe(true);
    expect(nordicCountryHasSchools('de')).toBe(true);
    expect(nordicCountryHasSchools('hr')).toBe(true);
    expect(nordicCountryHasSchools('cy')).toBe(false);
    expect(nordicCountryHasSchools('mt')).toBe(false);
    expect(nordicSchoolCountInCity('Paris')).toBeGreaterThan(0);
    expect(nordicSchoolCountInCity('Liège')).toBeGreaterThan(0);
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
