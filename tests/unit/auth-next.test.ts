import { describe, expect, it } from 'vitest';
import {
  loginHrefWithNext,
  sanitizeNext,
  signupHrefWithNext,
} from '@/lib/auth-next';

describe('sanitizeNext', () => {
  it('allows same-origin relative paths', () => {
    expect(sanitizeNext('/instructors/instructor_omar')).toBe(
      '/instructors/instructor_omar',
    );
    expect(sanitizeNext('/bookings/abc?token=xyz')).toBe('/bookings/abc?token=xyz');
  });

  it('rejects open redirects', () => {
    expect(sanitizeNext('https://evil.example')).toBeUndefined();
    expect(sanitizeNext('//evil.example')).toBeUndefined();
    expect(sanitizeNext('')).toBeUndefined();
    expect(sanitizeNext(undefined)).toBeUndefined();
  });
});

describe('auth next href helpers', () => {
  it('builds signup/login links that preserve next', () => {
    expect(signupHrefWithNext('/instructors/x')).toBe(
      '/signup?next=%2Finstructors%2Fx',
    );
    expect(loginHrefWithNext('/instructors/x')).toBe(
      '/login?next=%2Finstructors%2Fx',
    );
    expect(signupHrefWithNext(undefined)).toBe('/signup');
    expect(loginHrefWithNext(undefined)).toBe('/login');
  });
});
