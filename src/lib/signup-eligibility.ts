// @polsia:user-owned — age and licence-tenure gates for marketplace signup.

/** Youngest learner age accepted on DriveLinkUp. */
export const MIN_LEARNER_AGE_YEARS = 16;

/** Minimum years a certified instructor must have held a full driving licence. */
export const MIN_INSTRUCTOR_LICENSE_YEARS = 5;

export type SignupPath = 'LEARNER' | 'SCHOOL' | 'INSTRUCTOR';

export function ageYearsFromDateOfBirth(dateOfBirth: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function isLearnerAgeEligible(dateOfBirth: Date, now = new Date()): boolean {
  return ageYearsFromDateOfBirth(dateOfBirth, now) >= MIN_LEARNER_AGE_YEARS;
}

export function isInstructorLicenseTenureEligible(yearsHeld: number): boolean {
  return Number.isFinite(yearsHeld) && yearsHeld >= MIN_INSTRUCTOR_LICENSE_YEARS;
}

/** Map UI signup path → persisted UserProfile.role. */
export function roleForSignupPath(path: SignupPath): 'STUDENT' | 'INSTRUCTOR' {
  return path === 'LEARNER' ? 'STUDENT' : 'INSTRUCTOR';
}

/** Map UI signup path → Instructor.providerRole when a listing is created. */
export function providerRoleForSignupPath(path: SignupPath): 'SCHOOL' | 'INSTRUCTOR' | null {
  if (path === 'SCHOOL') return 'SCHOOL';
  if (path === 'INSTRUCTOR') return 'INSTRUCTOR';
  return null;
}
