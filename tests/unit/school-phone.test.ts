import { describe, expect, it } from 'vitest';
import { phoneFromPages } from '../../scripts/school-prices/phone';

const page = (text: string, url = 'https://skola.se/') => ({ url, text });

describe('phoneFromPages', () => {
  it('takes the one number on the site, as printed', () => {
    expect(phoneFromPages([page('Ring oss på 0472-124 70 eller mejla.')])).toEqual({
      display: '0472-124 70',
      e164: '+4647212470',
      sourceUrl: 'https://skola.se/',
    });
  });

  it('reads +46 (0) numbers and mobile numbers', () => {
    expect(phoneFromPages([page('Tel: +46 (0)70-410 88 34')]))?.toMatchObject({
      e164: '+46704108834',
    });
  });

  it('skips two branch numbers of equal weight', () => {
    expect(phoneFromPages([page('Växjö 0470-123 45 · Ljungby 0372-123 45')])).toBeNull();
  });

  it('keeps a clearly dominant main number', () => {
    const main = '023-70 55 70';
    expect(
      phoneFromPages([
        page(`${main} ${main}`),
        page(`${main} Kundtjänst 0774-44 00 00`, 'https://skola.se/kontakt'),
      ])?.e164,
    ).toBe('+4623705570');
  });

  it('ignores Trafikverket, prices, postcodes and org numbers', () => {
    expect(
      phoneFromPages([
        page('Boka prov via Trafikverket 0771-921 921. Körlektion 695 kr. 761 46 Norrtälje.'),
        page('Org.nr 556677-8899'),
      ]),
    ).toBeNull();
  });
});
