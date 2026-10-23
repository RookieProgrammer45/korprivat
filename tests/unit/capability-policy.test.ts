import { describe, expect, it } from 'vitest';
import {
  connectorInstantBookingCertified,
  productionCapabilityDecision,
} from '@/lib/certification/capability-policy';

describe('capability policy', () => {
  it('SC-8 does not treat availability certification as transactional booking', () => {
    expect(connectorInstantBookingCertified({ availability_display: true })).toBe(false);
    expect(
      connectorInstantBookingCertified({
        availability_display: true,
        transactional_booking: true,
      }),
    ).toBe(true);
    expect(
      productionCapabilityDecision({
        capability: 'transactional_booking',
        evidence: { source: 'sandbox', milestone3: true },
      }),
    ).toEqual({ allowed: false, code: 'milestone_5_required' });
    expect(
      productionCapabilityDecision({
        capability: 'availability_display',
        evidence: { source: 'mock', milestone3: true },
      }).allowed,
    ).toBe(false);
    expect(
      productionCapabilityDecision({
        capability: 'payment_collection',
        evidence: { source: 'vendor_environment', milestone5: true },
      }).code,
    ).toBe('payment_provider_external');
  });
});
