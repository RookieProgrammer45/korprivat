import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: {} }));

import { maskSurfacesForPayment } from '@/lib/scheduling/listing-eligibility';

describe('maskSurfacesForPayment', () => {
  const openSurfaces = {
    availabilityDisplay: true,
    inquiryCollection: true,
    requestToBook: true,
    transactionalBooking: true,
    directoryOnly: false,
  };

  it('leaves school payment surfaces unchanged', () => {
    expect(maskSurfacesForPayment(openSurfaces, true)).toEqual(openSurfaces);
  });

  it('clears booking surfaces when the instructor cannot collect payment', () => {
    expect(maskSurfacesForPayment(openSurfaces, false)).toEqual({
      availabilityDisplay: true,
      inquiryCollection: true,
      requestToBook: false,
      transactionalBooking: false,
      directoryOnly: false,
    });
  });
});
