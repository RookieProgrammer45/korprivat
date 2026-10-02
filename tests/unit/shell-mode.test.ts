import { describe, expect, it } from 'vitest';
import { isFocusedShellPath, shellModeForPath } from '@/lib/shell-mode';

describe('shellModeForPath', () => {
  it('keeps marketing chrome on public surfaces', () => {
    expect(shellModeForPath('/')).toBe('marketing');
    expect(shellModeForPath('/instructors')).toBe('marketing');
    expect(shellModeForPath('/for-instructors')).toBe('marketing');
    expect(shellModeForPath('/for-skolor')).toBe('marketing');
  });

  it('focuses auth, onboarding, dashboard, and listing wizard', () => {
    expect(isFocusedShellPath('/signup')).toBe(true);
    expect(isFocusedShellPath('/login')).toBe(true);
    expect(isFocusedShellPath('/onboarding/learner')).toBe(true);
    expect(isFocusedShellPath('/onboarding/learner/verify')).toBe(true);
    expect(isFocusedShellPath('/dashboard/instructor')).toBe(true);
    expect(isFocusedShellPath('/instructors/new')).toBe(true);
    expect(isFocusedShellPath('/profile')).toBe(true);
    expect(isFocusedShellPath('/verify-email')).toBe(true);
    expect(isFocusedShellPath('/oauth-complete')).toBe(true);
  });
});
