import { describe, expect, it } from 'vitest';
import { classifyGeolocationError } from '@/hooks/use-user-location';

describe('classifyGeolocationError', () => {
  it('treats only an explicit permission refusal as denied', () => {
    expect(classifyGeolocationError(1)).toBe('denied');
  });

  it('lets the user retry when the browser times out or cannot find a position', () => {
    expect(classifyGeolocationError(2)).toBe('failed');
    expect(classifyGeolocationError(3)).toBe('failed');
  });
});
