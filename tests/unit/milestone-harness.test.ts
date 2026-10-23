import { describe, expect, it } from 'vitest';
import {
  harnessEvidenceDecision,
  type MilestoneVendor,
  referenceHarnessVendor,
  runMilestoneHarness,
} from '@/lib/certification/milestone-harness';

function vendor(overrides: Partial<MilestoneVendor>): MilestoneVendor {
  return { ...referenceHarnessVendor, ...overrides };
}

describe('milestone harness', () => {
  it('passes the five local failure checks and still refuses evidence', () => {
    const report = runMilestoneHarness(referenceHarnessVendor);
    const evidence = harnessEvidenceDecision(report);
    expect(report.milestone4LocalPass).toBe(true);
    expect(report.productionEnabled).toBe(false);
    expect(report.persistsCertification).toBe(false);
    expect(evidence).toMatchObject({
      allowed: false,
      code: 'harness_evidence_refused',
      persistsCertification: false,
      milestone5: 'partner_external',
    });
    expect(evidence.productionDecision).toEqual({ allowed: false, code: 'mock_evidence_refused' });
  });

  it('fails when both concurrent attempts confirm', () => {
    const report = runMilestoneHarness(
      vendor({
        concurrentConfirm: () => ['confirmed', 'confirmed'],
      }),
    );
    expect(report.tests.find((test) => test.id === 1)?.passed).toBe(false);
    expect(report.milestone4LocalPass).toBe(false);
    expect(harnessEvidenceDecision(report).allowed).toBe(false);
  });

  it('fails when an older confirmation is applied over a newer cancellation', () => {
    const report = runMilestoneHarness(
      vendor({
        inboxAction: (input) =>
          input.revision < input.watermarkRevision ? 'apply' : 'rejected_duplicate',
      }),
    );
    expect(report.tests.find((test) => test.id === 2)?.passed).toBe(false);
  });

  it('fails when reschedule releases the old resource without confirming the new one', () => {
    const report = runMilestoneHarness(
      vendor({
        reschedule: () => ({ kind: 'partial', old: 'released', next: 'held' }),
      }),
    );
    expect(report.tests.find((test) => test.id === 3)?.passed).toBe(false);
  });

  it('fails when a late payment confirms an expired booking', () => {
    const report = runMilestoneHarness(
      vendor({
        latePayment: () => ({
          bookingState: 'confirmed',
          paymentFlag: 'captured',
          opsRouted: false,
        }),
      }),
    );
    expect(report.tests.find((test) => test.id === 4)?.passed).toBe(false);
  });

  it('fails when revoked access still allows connector instant booking', () => {
    const report = runMilestoneHarness(
      vendor({
        connectorInstant: () => true,
      }),
    );
    expect(report.tests.find((test) => test.id === 5)?.passed).toBe(false);
  });

  it('keeps the native control available on the reference double while connector access is revoked', () => {
    expect(referenceHarnessVendor.connectorInstant({ access: 'revoked', inventory: 'fresh' })).toBe(
      false,
    );
    expect(referenceHarnessVendor.nativeInstant({ nativeControl: true })).toBe(true);
  });
});
