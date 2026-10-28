import { describe, expect, it } from 'vitest';
import { SignupStart } from '@/lib/contracts/signup';
import {
  ageYearsFromDateOfBirth,
  isIndependentInstructorSignupOpen,
  isInstructorLicenseTenureEligible,
  isLearnerAgeEligible,
  MIN_INSTRUCTOR_LICENSE_YEARS,
  MIN_LEARNER_AGE_YEARS,
  providerRoleForSignupPath,
  roleForSignupPath,
} from '@/lib/signup-eligibility';

describe('signup eligibility', () => {
  it(`rejects learners younger than ${MIN_LEARNER_AGE_YEARS}`, () => {
    const now = new Date('2026-09-26T00:00:00Z');
    const tooYoung = new Date('2011-09-27T00:00:00Z');
    const eligible = new Date('2010-09-26T00:00:00Z');
    expect(isLearnerAgeEligible(tooYoung, now)).toBe(false);
    expect(isLearnerAgeEligible(eligible, now)).toBe(true);
    expect(ageYearsFromDateOfBirth(eligible, now)).toBe(16);
  });

  it(`requires instructors to hold a licence for at least ${MIN_INSTRUCTOR_LICENSE_YEARS} years`, () => {
    expect(isInstructorLicenseTenureEligible(4)).toBe(false);
    expect(isInstructorLicenseTenureEligible(5)).toBe(true);
    expect(isInstructorLicenseTenureEligible(12)).toBe(true);
  });

  it('keeps independent instructor signup closed in the Nordics', () => {
    expect(isIndependentInstructorSignupOpen()).toBe(false);
    expect(
      SignupStart.safeParse({
        path: 'INSTRUCTOR',
        city: 'Stockholm',
        licenseHeldYears: 8,
      }).success,
    ).toBe(false);
  });

  it('lets a learner start directory signup without a date of birth', () => {
    expect(SignupStart.safeParse({ path: 'LEARNER' }).success).toBe(true);
  });

  it('still rejects an underage date of birth if one is sent', () => {
    expect(
      SignupStart.safeParse({ path: 'LEARNER', dateOfBirth: '2015-01-01' }).success,
    ).toBe(false);
  });

  it('maps signup paths to roles and provider roles', () => {
    expect(roleForSignupPath('LEARNER')).toBe('STUDENT');
    expect(roleForSignupPath('SCHOOL')).toBe('SCHOOL');
    expect(roleForSignupPath('INSTRUCTOR')).toBe('INSTRUCTOR');
    expect(providerRoleForSignupPath('SCHOOL')).toBe('SCHOOL');
    expect(providerRoleForSignupPath('INSTRUCTOR')).toBe('INSTRUCTOR');
    expect(providerRoleForSignupPath('LEARNER')).toBeNull();
  });
});
