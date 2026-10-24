import { describe, expect, it } from 'vitest';
import { conciergeStoreDecision } from '@/lib/acquisition/concierge-policy';
import {
  buildOutreachSequence,
  OUTREACH_FROM,
  OUTREACH_SIGNATURE,
  outreachSendDecision,
} from '@/lib/acquisition/outreach-sequence-policy';

describe('authorization outreach sequence drafts', () => {
  it('builds an unsent day 0/4/10 sequence from marketing@ with the founder signature', () => {
    const draft = buildOutreachSequence({
      schoolName: 'Example Trafikskola (synthetic)',
      listingId: 'listing-synthetic',
    });
    expect(draft.allowed).toBe(true);
    if (!draft.allowed) {
      return;
    }
    expect(draft.from).toBe(OUTREACH_FROM);
    expect(draft.signature).toBe(OUTREACH_SIGNATURE);
    expect(draft.sent).toBe(false);
    expect(draft.sendBlocked).toBe('channel_not_authorized');
    expect(draft.scopesPreselected).toEqual([]);
    expect(draft.authorizationEventsCreated).toBe(0);
    expect(draft.claimPage).toBe('missing');
    expect(draft.cadence.map((row) => row.day)).toEqual([0, 4, 10]);
    expect(draft.listingUrl).toBe('https://www.drivelinkup.com/instructors/listing-synthetic');
    for (const row of draft.cadence) {
      expect(row.body).toContain(OUTREACH_SIGNATURE);
      expect(row.body).toMatch(/none of them is pre-selected/i);
      expect(row.body).not.toMatch(/I have enabled|pre-selected.*booking/i);
    }
  });

  it('refuses a contact-restricted listing and never opens a send path', () => {
    expect(
      buildOutreachSequence({
        schoolName: 'Sjöbo Trafikskola',
        bookingMode: 'contact',
      }),
    ).toEqual({ allowed: false, code: 'contact_restricted' });
    expect(outreachSendDecision()).toEqual({
      allowed: false,
      code: 'channel_not_authorized',
      sent: false,
    });
  });

  it('can sit in a concierge draft without manufacturing approval or grants', () => {
    const stored = conciergeStoreDecision({
      source: 'SYNTHETIC_FIXTURE',
      provenance: {
        source: 'SYNTHETIC_FIXTURE',
        sourceUrl: 'synthetic://outreach-sequence',
        retrievedAt: '2026-10-24T00:00:00.000Z',
        fields: ['outreachSequence'],
      },
    });
    expect(stored).toMatchObject({
      allowed: true,
      state: 'DRAFT',
      published: false,
      policyApproved: false,
      verificationManufactured: false,
      authorizationEventsCreated: 0,
      scopesGranted: [],
      bookingSurfaces: false,
    });
  });
});
