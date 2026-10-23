import { describe, expect, it } from 'vitest';
import {
  decideInboxEvent,
  failureDisposition,
  inventoryHeldByQuarantine,
  quarantineRelease,
  redactPayload,
} from '@/lib/reliability/inbox-policy';

describe('inbox policy', () => {
  it('SC-11 rejects duplicates and stale revisions, and does not guess equal order', () => {
    expect(
      decideInboxEvent({
        duplicate: true,
        revision: 4,
        occurredAt: null,
        watermarkRevision: 3,
        watermarkAt: null,
      }),
    ).toBe('rejected_duplicate');
    expect(
      decideInboxEvent({
        duplicate: false,
        revision: 2,
        occurredAt: null,
        watermarkRevision: 5,
        watermarkAt: null,
      }),
    ).toBe('rejected_stale');
    expect(
      decideInboxEvent({
        duplicate: false,
        revision: 5,
        occurredAt: null,
        watermarkRevision: 5,
        watermarkAt: null,
      }),
    ).toBe('authoritative_retrieval');
    expect(
      decideInboxEvent({
        duplicate: false,
        revision: null,
        occurredAt: null,
        watermarkRevision: 5,
        watermarkAt: null,
      }),
    ).toBe('authoritative_retrieval');
  });

  it('SC-12 dead-letters on the fifth failure and redacts personal fields', () => {
    expect(failureDisposition(4).deadLetter).toBe(false);
    expect(failureDisposition(5)).toEqual({ deadLetter: true });
    expect(redactPayload({ studentEmail: 'ada@example.test', eventType: 'confirmed' })).toEqual({
      studentEmail: '[redacted]',
      eventType: 'confirmed',
    });
  });

  it('SC-20 keeps quarantine through TTL expiry and retry exhaustion', () => {
    expect(quarantineRelease({ kind: 'ttl_expired' }).release).toBe(false);
    expect(quarantineRelease({ kind: 'retry_exhausted' }).release).toBe(false);
    expect(quarantineRelease({ kind: 'audited_decision', rationale: '   ' }).release).toBe(false);
    expect(
      quarantineRelease({ kind: 'audited_decision', rationale: 'school confirmed by phone' })
        .release,
    ).toBe(true);
    expect(
      quarantineRelease({ kind: 'authoritative', resolutionRef: 'vendor-state-9' }).release,
    ).toBe(true);
    expect(
      inventoryHeldByQuarantine({ quarantineResourceRef: 'slot_1', resolutionKind: null }),
    ).toBe(true);
    expect(
      inventoryHeldByQuarantine({
        quarantineResourceRef: 'slot_1',
        resolutionKind: 'audited_decision',
      }),
    ).toBe(false);
  });
});
