// @polsia:user-owned — public terminology parity and legacy-copy guard.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function loadMessages(locale: 'en' | 'sv'): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), `messages/${locale}.json`), 'utf8'),
  ) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageKeys(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return isRecord(child) ? [path, ...messageKeys(child, path)] : [path];
  });
}

describe('public marketplace localization', () => {
  it('keeps English and Swedish message keys in lockstep', () => {
    const english = messageKeys(loadMessages('en')).sort();
    const swedish = messageKeys(loadMessages('sv')).sort();
    expect(swedish).toEqual(english);
  });

  it('does not reintroduce retired public marketplace claims', () => {
    const publicCopy = JSON.stringify({
      en: loadMessages('en'),
      sv: loadMessages('sv'),
    }).toLowerCase();
    const retiredPhrases = [
      '5% service',
      '5 % service',
      'learner service fee',
      'serviceavgift',
      'airbnb',
      'fiverr',
      'guaranteed bookings',
      'guaranteed settlement',
      'garanterade bokningar',
      'garanterad utbetalning',
    ];

    for (const phrase of retiredPhrases) {
      expect(publicCopy).not.toContain(phrase);
    }
  });
});
