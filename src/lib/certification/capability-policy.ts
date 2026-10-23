export const CERTIFIED_CAPABILITIES = [
  'availability_display',
  'content_sync',
  'events',
  'transactional_booking',
  'transactional_reschedule',
] as const;

export type CertifiedCapability = (typeof CERTIFIED_CAPABILITIES)[number];

export type MilestoneEvidence = {
  source?: 'mock' | 'sandbox' | 'vendor_environment';
  milestone3?: boolean;
  milestone5?: boolean;
  atomicReschedule?: boolean;
};

export function isCertificationEnforced(
  env: string | undefined = process.env.CERTIFICATION_ENFORCEMENT,
): boolean {
  return env === '1' || env === 'true';
}

export function connectorInstantBookingCertified(prodEnabled: unknown): boolean {
  if (!prodEnabled || typeof prodEnabled !== 'object' || Array.isArray(prodEnabled)) return false;
  return (prodEnabled as Record<string, unknown>).transactional_booking === true;
}

export function enabledCapabilityNames(prodEnabled: unknown): string[] {
  if (!prodEnabled || typeof prodEnabled !== 'object' || Array.isArray(prodEnabled)) return [];
  return Object.entries(prodEnabled as Record<string, unknown>)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}

export function productionCapabilityDecision(input: {
  capability: CertifiedCapability | 'payment_collection';
  evidence: MilestoneEvidence;
}): { allowed: boolean; code: string } {
  if (input.capability === 'payment_collection') {
    return { allowed: false, code: 'payment_provider_external' };
  }
  if (input.evidence.source === 'mock' || input.evidence.source == null) {
    return { allowed: false, code: 'mock_evidence_refused' };
  }
  if (input.capability === 'transactional_booking') {
    if (input.evidence.milestone5 && input.evidence.source === 'vendor_environment') {
      return { allowed: true, code: 'enabled' };
    }
    return { allowed: false, code: 'milestone_5_required' };
  }
  if (input.capability === 'transactional_reschedule') {
    if (
      input.evidence.milestone5 &&
      input.evidence.atomicReschedule &&
      input.evidence.source === 'vendor_environment'
    ) {
      return { allowed: true, code: 'enabled' };
    }
    return { allowed: false, code: 'milestone_5_required' };
  }
  if (input.evidence.milestone3) return { allowed: true, code: 'enabled' };
  return { allowed: false, code: 'milestone_3_required' };
}
