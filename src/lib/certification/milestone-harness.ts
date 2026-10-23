import { productionCapabilityDecision } from '@/lib/certification/capability-policy';
import { decideInboxEvent, type InboxAction } from '@/lib/reliability/inbox-policy';
import { reconcileCapturedPayment } from '@/lib/scheduling/booking-policy';

/** Local stand-in for a vendor. A passing run is not milestone evidence. */
export interface MilestoneVendor {
  concurrentConfirm(
    resourceRef: string,
  ): readonly ['confirmed' | 'conflict', 'confirmed' | 'conflict'];
  inboxAction(input: {
    duplicate: boolean;
    revision: number;
    watermarkRevision: number;
  }): InboxAction;
  reschedule(input: {
    newResourceFree: boolean;
  }):
    | { kind: 'swapped'; old: 'released'; next: 'confirmed' }
    | { kind: 'unchanged'; old: 'confirmed'; next: 'absent' }
    | { kind: 'partial'; old: 'released'; next: 'held' | 'absent' };
  latePayment(): {
    bookingState: 'expired' | 'confirmed';
    paymentFlag: 'late_captured' | 'captured';
    opsRouted: boolean;
  };
  connectorInstant(input: { access: 'active' | 'revoked'; inventory: 'fresh' | 'stale' }): boolean;
  nativeInstant(input: { nativeControl: boolean }): boolean;
}

export const HARNESS_EXTERNAL = [
  'vendor_environment_failure_tests',
  'milestone_5_pilot',
  'production_certification',
  'vendor_invitations',
] as const;

export type HarnessCheck = {
  id: 1 | 2 | 3 | 4 | 5;
  name: string;
  passed: boolean;
};

export type HarnessReport = {
  tests: HarnessCheck[];
  milestone4LocalPass: boolean;
  productionEnabled: false;
  evidenceSource: 'harness_double';
  persistsCertification: false;
};

const INBOX_STEPS = [
  { duplicate: false, revision: 18, watermarkRevision: 17, event: 'cancelled' as const },
  { duplicate: true, revision: 18, watermarkRevision: 18, event: 'cancelled' as const },
  { duplicate: false, revision: 17, watermarkRevision: 18, event: 'confirmed' as const },
];

function judgeInbox(vendor: MilestoneVendor): boolean {
  let state: 'confirmed' | 'cancelled' = 'confirmed';
  for (const step of INBOX_STEPS) {
    const oracle = decideInboxEvent({
      duplicate: step.duplicate,
      revision: step.revision,
      occurredAt: null,
      watermarkRevision: step.watermarkRevision,
      watermarkAt: null,
    });
    if (vendor.inboxAction(step) !== oracle) return false;
    if (oracle === 'apply' && step.event === 'cancelled') state = 'cancelled';
    if (oracle === 'apply' && step.event === 'confirmed') state = 'confirmed';
  }
  return state === 'cancelled';
}

function judgeReschedule(vendor: MilestoneVendor): boolean {
  const swapped = vendor.reschedule({ newResourceFree: true });
  const blocked = vendor.reschedule({ newResourceFree: false });
  return (
    swapped.kind === 'swapped' &&
    swapped.old === 'released' &&
    swapped.next === 'confirmed' &&
    blocked.kind === 'unchanged' &&
    blocked.old === 'confirmed' &&
    blocked.next === 'absent'
  );
}

function judgeLatePayment(vendor: MilestoneVendor): boolean {
  const oracle = reconcileCapturedPayment('expired');
  const vendorResult = vendor.latePayment();
  return (
    oracle.action === 'late_captured' &&
    oracle.nextState === 'expired' &&
    oracle.autoConfirm === false &&
    vendorResult.bookingState === 'expired' &&
    vendorResult.paymentFlag === 'late_captured' &&
    vendorResult.opsRouted === true
  );
}

function judgeRevocation(vendor: MilestoneVendor): boolean {
  const revoked = vendor.connectorInstant({ access: 'revoked', inventory: 'fresh' });
  const stale = vendor.connectorInstant({ access: 'active', inventory: 'stale' });
  const restored = vendor.connectorInstant({ access: 'active', inventory: 'fresh' });
  const native = vendor.nativeInstant({ nativeControl: true });
  return revoked === false && stale === false && restored === true && native === true;
}

export function runMilestoneHarness(vendor: MilestoneVendor): HarnessReport {
  const tests: HarnessCheck[] = [
    {
      id: 1,
      name: 'concurrent_confirm',
      passed:
        vendor.concurrentConfirm('resource_1').filter((outcome) => outcome === 'confirmed')
          .length === 1,
    },
    { id: 2, name: 'duplicate_and_stale', passed: judgeInbox(vendor) },
    { id: 3, name: 'atomic_reschedule', passed: judgeReschedule(vendor) },
    { id: 4, name: 'late_payment', passed: judgeLatePayment(vendor) },
    { id: 5, name: 'revoked_or_stale', passed: judgeRevocation(vendor) },
  ];
  return {
    tests,
    milestone4LocalPass: tests.every((test) => test.passed),
    productionEnabled: false,
    evidenceSource: 'harness_double',
    persistsCertification: false,
  };
}

/** A local pass never becomes vendor-environment evidence or production enablement. */
export function harnessEvidenceDecision(report: Pick<HarnessReport, 'milestone4LocalPass'>) {
  const productionDecision = productionCapabilityDecision({
    capability: 'transactional_booking',
    evidence: {
      source: 'mock',
      milestone3: true,
      milestone5: report.milestone4LocalPass,
    },
  });
  return {
    allowed: false as const,
    code: 'harness_evidence_refused' as const,
    productionDecision,
    persistsCertification: false as const,
    milestone5: 'partner_external' as const,
  };
}

export const referenceHarnessVendor: MilestoneVendor = {
  concurrentConfirm() {
    return ['confirmed', 'conflict'];
  },
  inboxAction(input) {
    return decideInboxEvent({
      duplicate: input.duplicate,
      revision: input.revision,
      occurredAt: null,
      watermarkRevision: input.watermarkRevision,
      watermarkAt: null,
    });
  },
  reschedule(input) {
    if (!input.newResourceFree) return { kind: 'unchanged', old: 'confirmed', next: 'absent' };
    return { kind: 'swapped', old: 'released', next: 'confirmed' };
  },
  latePayment() {
    const decision = reconcileCapturedPayment('expired');
    if (decision.action !== 'late_captured') {
      return { bookingState: 'confirmed', paymentFlag: 'captured', opsRouted: false };
    }
    return { bookingState: 'expired', paymentFlag: 'late_captured', opsRouted: true };
  },
  connectorInstant(input) {
    return input.access === 'active' && input.inventory === 'fresh';
  },
  nativeInstant(input) {
    return input.nativeControl;
  },
};
