import { describe, expect, it } from 'vitest';
import {
  listTaxiTraining,
  publishedTaxiTraining,
  taxiCountries,
  taxiFiltersFromSearch,
} from '@/lib/discovery/taxi-training';
import { taxiSearchPath } from '@/lib/seo/taxi-search-path';
import en from '../../messages/en.json';

describe('published taxi-driver training prices', () => {
  it('keeps a course price apart from an official test fee', () => {
    const rows = publishedTaxiTraining();
    expect(taxiCountries()).toEqual(['GB', 'SE']);
    for (const row of rows) {
      expect(row.sourceUrl.startsWith('https://')).toBe(true);
      expect(row.amount).toBeGreaterThan(0);
      for (const note of row.notes) {
        expect(en.taxiPage.notes[note]).toEqual(expect.any(String));
      }
    }
    const courses = listTaxiTraining(taxiFiltersFromSearch({}));
    expect(courses.some((row) => row.provider === 'Driver & Vehicle Agency')).toBe(false);
    const skarholmen = courses.find((row) => row.id === 'se-skarholmen-course');
    expect(skarholmen?.amount).toBe(4000);
    const exam = listTaxiTraining(taxiFiltersFromSearch({ kind: 'exam', country: 'GB' }));
    expect(exam.map((row) => row.id)).toContain('gb-ni-theory');
    expect(exam.every((row) => row.kind === 'exam')).toBe(true);
    expect(taxiSearchPath(taxiFiltersFromSearch({}))).toBe('/taxiutbildning');
    expect(taxiSearchPath(taxiFiltersFromSearch({ kind: 'exam' }))).toBe(
      '/taxiutbildning?kind=exam',
    );
  });
});
