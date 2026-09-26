import { describe, expect, it } from 'vitest';
import { MIN_LEARNER_AGE_YEARS } from '@/lib/signup-eligibility';

describe('didit age gate policy', () => {
  it(`treats estimated age at or above ${MIN_LEARNER_AGE_YEARS} as eligible when Approved`, () => {
    const cases = [
      { status: 'Approved', estimatedAge: 16, eligible: true },
      { status: 'Approved', estimatedAge: 15.9, eligible: false },
      { status: 'Approved', estimatedAge: null, eligible: false },
      { status: 'Declined', estimatedAge: 20, eligible: false },
      { status: 'In Review', estimatedAge: 18, eligible: false },
    ] as const;

    for (const row of cases) {
      const eligible =
        row.status === 'Approved' &&
        row.estimatedAge !== null &&
        row.estimatedAge >= MIN_LEARNER_AGE_YEARS;
      expect(eligible).toBe(row.eligible);
    }
  });
});
