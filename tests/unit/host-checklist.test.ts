import { describe, expect, it } from 'vitest';
import {
  isHostSetupComplete,
  pickHostChecklistAction,
} from '@/lib/business/host-checklist';

describe('pickHostChecklistAction', () => {
  it('prioritises licence then listing then connect then availability', () => {
    expect(
      pickHostChecklistAction({
        licenceVerified: false,
        hasListing: false,
        connectReady: false,
        hasAvailability: false,
      }),
    ).toBe('licence');

    expect(
      pickHostChecklistAction({
        licenceVerified: true,
        hasListing: false,
        connectReady: false,
        hasAvailability: false,
      }),
    ).toBe('listing');

    expect(
      pickHostChecklistAction({
        licenceVerified: true,
        hasListing: true,
        connectReady: false,
        hasAvailability: false,
      }),
    ).toBe('connect');

    expect(
      pickHostChecklistAction({
        licenceVerified: true,
        hasListing: true,
        connectReady: true,
        hasAvailability: false,
      }),
    ).toBe('availability');

    expect(
      pickHostChecklistAction({
        licenceVerified: true,
        hasListing: true,
        connectReady: true,
        hasAvailability: true,
      }),
    ).toBeNull();
  });
});

describe('isHostSetupComplete', () => {
  it('requires listing, connect, and availability (not licence)', () => {
    expect(
      isHostSetupComplete({
        hasListing: true,
        connectReady: true,
        hasAvailability: true,
      }),
    ).toBe(true);

    expect(
      isHostSetupComplete({
        hasListing: true,
        connectReady: true,
        hasAvailability: false,
      }),
    ).toBe(false);
  });
});
