import { describe, expect, it } from 'vitest';
import { decideLesson } from '../../scripts/regional-schools/extract';

describe('decideLesson', () => {
  it('keeps a single lesson price printed next to the currency', () => {
    expect(
      decideLesson(
        { country: 'GB', currency: 'GBP' },
        { lessonAmount: 36, minutes: 60, currency: 'GBP', sourceUrl: null },
        [{ url: 'https://school.example/prices', text: 'Manual lessons £36 per hour' }],
      ),
    ).toEqual({ lessonPrice: 36, lessonMinutes: 60 });
  });

  it('drops a price that is not printed next to the currency', () => {
    expect(
      decideLesson(
        { country: 'NO', currency: 'NOK' },
        { lessonAmount: 890, minutes: 45, currency: 'NOK', sourceUrl: null },
        [{ url: 'https://skole.example/', text: 'Ring 890 12 345 for a lesson' }],
      ),
    ).toEqual({ lessonPrice: null, lessonMinutes: null });
  });

  it('drops a price outside the country range or in another currency', () => {
    const pages = [{ url: 'https://school.example/', text: 'One lesson £390' }];
    expect(
      decideLesson(
        { country: 'GB', currency: 'GBP' },
        { lessonAmount: 390, minutes: 60, currency: 'GBP', sourceUrl: null },
        pages,
      ).lessonPrice,
    ).toBeNull();
    expect(
      decideLesson(
        { country: 'AU', currency: 'AUD' },
        { lessonAmount: 80, minutes: 60, currency: 'GBP', sourceUrl: null },
        [{ url: 'https://school.example/', text: 'Lesson AUD 80' }],
      ).lessonPrice,
    ).toBeNull();
  });
});
