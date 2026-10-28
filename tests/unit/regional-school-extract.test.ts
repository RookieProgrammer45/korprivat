import { describe, expect, it } from 'vitest';
import { decideLesson } from '../../scripts/regional-schools/extract';

describe('decideLesson', () => {
  it('keeps a single lesson price printed next to the currency', () => {
    expect(
      decideLesson(
        { country: 'GB', currency: 'GBP' },
        {
          lessonAmount: 36,
          minutes: 60,
          currency: 'GBP',
          sourceUrl: 'https://school.example/prices',
        },
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
        { lessonAmount: 80, minutes: 60, currency: 'GBP', sourceUrl: 'https://school.example/' },
        [{ url: 'https://school.example/', text: 'Lesson AUD 80' }],
      ).lessonPrice,
    ).toBeNull();
  });

  it('drops a from-price, a package total, and a price cited on another page', () => {
    const priced = (
      country: string,
      currency: string,
      amount: number,
      text: string,
      sourceUrl = 'https://school.example/prices',
    ) =>
      decideLesson(
        { country, currency },
        { lessonAmount: amount, minutes: 60, currency, sourceUrl },
        [{ url: 'https://school.example/prices', text }],
      ).lessonPrice;

    expect(priced('FR', 'EUR', 49, 'à partir de 49 € la leçon')).toBeNull();
    expect(priced('DE', 'EUR', 49, 'Fahrstunde ab 49 €')).toBeNull();
    expect(priced('GB', 'GBP', 36, 'Lessons from £36')).toBeNull();
    expect(priced('FR', 'EUR', 120, 'Forfait 10 heures 120 €')).toBeNull();
    expect(priced('ES', 'EUR', 45, 'Clase suelta 45,00 €')).toBe(45);
    expect(priced('ES', 'EUR', 45, 'Clase suelta 45,90 €')).toBeNull();
    expect(
      decideLesson(
        { country: 'ES', currency: 'EUR' },
        {
          lessonAmount: 45,
          minutes: 60,
          currency: 'EUR',
          sourceUrl: 'https://school.example/',
        },
        [
          { url: 'https://school.example/', text: 'Welcome to the school' },
          { url: 'https://school.example/prices', text: 'Clase 45 €' },
        ],
      ).lessonPrice,
    ).toBeNull();
  });
});
