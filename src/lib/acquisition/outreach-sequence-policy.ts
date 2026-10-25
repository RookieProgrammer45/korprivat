// Collection-plan §4 / §10 outreach sequence drafts.
// File- and concierge-payload only. This module cannot send mail.

import { isContactRestriction } from '@/lib/orgs/school-authorization-policy';

export const OUTREACH_FROM = 'marketing@drivelinkup.com';
export const OUTREACH_SIGNATURE = 'frank - founder of drivelinkup.com';
export const OUTREACH_CADENCE_DAYS = [0, 4, 10] as const;
export const OUTREACH_APP_ORIGIN = 'https://www.drivelinkup.com';

export type OutreachCadenceDay = (typeof OUTREACH_CADENCE_DAYS)[number];

export type OutreachMessage = {
  day: OutreachCadenceDay;
  subject: string;
  body: string;
};

export type OutreachSequenceDraft = {
  kind: 'OUTREACH_SEQUENCE';
  from: typeof OUTREACH_FROM;
  signature: typeof OUTREACH_SIGNATURE;
  sent: false;
  sendBlocked: 'channel_not_authorized';
  scopesPreselected: [];
  authorizationEventsCreated: 0;
  policyApproved: false;
  verificationManufactured: false;
  bookingSurfaces: false;
  claimPage: 'missing';
  schoolName: string;
  listingId: string | null;
  listingUrl: string | null;
  cadence: OutreachMessage[];
};

export type OutreachRecipientDecision =
  | { allowed: true }
  | { allowed: false; code: 'contact_restricted' | 'missing_school' };

export function outreachRecipientDecision(input: {
  schoolName?: string;
  bookingMode?: string | null;
}): OutreachRecipientDecision {
  if (isContactRestriction(input.bookingMode)) {
    return { allowed: false, code: 'contact_restricted' };
  }
  if (input.schoolName !== undefined && input.schoolName.trim().length === 0) {
    return { allowed: false, code: 'missing_school' };
  }
  return { allowed: true };
}

export function outreachSendDecision(): {
  allowed: false;
  code: 'channel_not_authorized';
  sent: false;
} {
  return { allowed: false, code: 'channel_not_authorized', sent: false };
}

function schoolLabel(name: string | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : '[school name]';
}

function listingUrl(listingId: string | null): string | null {
  return listingId ? `${OUTREACH_APP_ORIGIN}/instructors/${listingId}` : null;
}

function messageBody(input: {
  schoolName: string;
  listingUrl: string | null;
  closing: string;
}): string {
  const listingLine = input.listingUrl
    ? `Your current listing: ${input.listingUrl}`
    : 'Your listing stays visible in the directory.';
  return [
    `Hello ${input.schoolName},`,
    '',
    'DriveLinkUp is a Sweden-first directory for driving schools. Being listed has no fee.',
    listingLine,
    '',
    'Authorization is your control. Each scope is a separate choice — times, inquiries, request-to-book, and transactional booking are independent, and none of them is pre-selected. You can withdraw a scope the same day. We will not run a second diary next to yours.',
    '',
    'A public claim page is not shipped yet. If you want to decide scopes, use the available verification or manual-review route — a reply to this draft does not create a grant.',
    '',
    'Directory-only is a valid choice. Collection records permission; it does not pressure a school into granting it.',
    '',
    input.closing,
    '',
    OUTREACH_SIGNATURE,
  ].join('\n');
}

export function buildOutreachSequence(input: {
  schoolName?: string;
  listingId?: string;
  bookingMode?: string | null;
}):
  | ({ allowed: true } & OutreachSequenceDraft)
  | { allowed: false; code: 'contact_restricted' | 'missing_school' } {
  const recipient = outreachRecipientDecision(input);
  if (!recipient.allowed) {
    return recipient;
  }
  const schoolName = schoolLabel(input.schoolName);
  const id = input.listingId?.trim() || null;
  const url = listingUrl(id);
  return {
    allowed: true,
    kind: 'OUTREACH_SEQUENCE',
    from: OUTREACH_FROM,
    signature: OUTREACH_SIGNATURE,
    sent: false,
    sendBlocked: 'channel_not_authorized',
    scopesPreselected: [],
    authorizationEventsCreated: 0,
    policyApproved: false,
    verificationManufactured: false,
    bookingSurfaces: false,
    claimPage: 'missing',
    schoolName,
    listingId: id,
    listingUrl: url,
    cadence: [
      {
        day: 0,
        subject: 'Your school controls authorization on DriveLinkUp',
        body: messageBody({
          schoolName,
          listingUrl: url,
          closing: 'This is the first note in a three-step cadence (day 0 / 4 / 10).',
        }),
      },
      {
        day: 4,
        subject: 'Follow-up: authorization stays your decision',
        body: messageBody({
          schoolName,
          listingUrl: url,
          closing: 'This is the day-4 follow-up. Directory-only remains available.',
        }),
      },
      {
        day: 10,
        subject: 'Last note from this cadence',
        body: messageBody({
          schoolName,
          listingUrl: url,
          closing: 'This is the last note. No further rounds are a flip prerequisite.',
        }),
      },
    ],
  };
}

export function outreachSequenceForConcierge(draft: OutreachSequenceDraft): OutreachSequenceDraft {
  return draft;
}
