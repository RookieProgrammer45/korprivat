import { afterEach, describe, expect, it, vi } from 'vitest';
import { newBookingCreationEnabled, publishedBookingMode } from '@/lib/scheduling/booking-creation';

describe('directory-first booking boundary', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps new booking creation closed unless the flag is exactly true', () => {
    vi.stubEnv('BOOKING_CREATION_ENABLED', '');
    expect(newBookingCreationEnabled()).toBe(false);
    vi.stubEnv('BOOKING_CREATION_ENABLED', 'false');
    expect(newBookingCreationEnabled()).toBe(false);
    vi.stubEnv('BOOKING_CREATION_ENABLED', 'true');
    expect(newBookingCreationEnabled()).toBe(true);
  });

  it('does not advertise instant or request booking while creation is closed', () => {
    vi.stubEnv('BOOKING_CREATION_ENABLED', '');
    expect(publishedBookingMode('instant')).toBe('contact');
    expect(publishedBookingMode('request')).toBe('contact');
    expect(publishedBookingMode(null)).toBe('contact');
  });

  it('keeps the stored public mode when creation is explicitly on', () => {
    vi.stubEnv('BOOKING_CREATION_ENABLED', 'true');
    expect(publishedBookingMode('request')).toBe('request');
    expect(publishedBookingMode('contact')).toBe('contact');
    expect(publishedBookingMode('instant')).toBe('instant');
  });
});
