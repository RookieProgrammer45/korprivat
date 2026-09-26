/**
 * Date-only age helpers for learner verification.
 * Pure module — no app imports, no I/O.
 */

/** Youngest learner age accepted on DriveLinkUp. */
export const MINIMUM_AGE = 16;

/** Age at which handledare enrollment is no longer required. */
export const HANDLEDARE_CEILING_AGE = 18;

/**
 * Age in whole years, computed on UTC calendar dates.
 * A learner who turns 16 today is 16 — not 15.
 */
export function ageInYears(dob: Date, today: Date = new Date()): number {
  const d = new Date(Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let age = t.getUTCFullYear() - d.getUTCFullYear();
  const monthDelta = t.getUTCMonth() - d.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && t.getUTCDate() < d.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Date the learner turns `targetAge` (UTC calendar date). */
export function dateTurningAge(dob: Date, targetAge: number): Date {
  return new Date(Date.UTC(dob.getUTCFullYear() + targetAge, dob.getUTCMonth(), dob.getUTCDate()));
}
