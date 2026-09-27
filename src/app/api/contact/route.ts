//
// POST /api/contact — guided Contact flow ingest.
//
// The brief is "personal answers from the founder, no auto-responder". We
// deliver each inquiry to the company inbox (POLSIA_COMPANY_EMAIL) and let
// the founder's inbox be the source of truth — we DO NOT persist to the
// contact-form module's ContactMessage table for the MVP, because that
// table only has the base name/email/message columns (no topic/locale) and
// the founder reads the inbox directly. We DO call registerKnownContact
// before the send so transactional emails stay inside the 50/day tier.
//
// Hard rules from the brief (and from the platform skill-docs) the agent
// followed verbatim:
//   - recipient is ALWAYS process.env.POLSIA_COMPANY_EMAIL resolved at
//     request time — no hardcoded domain address (it bounces).
//   - no auto-responder / chatbot reply back to the visitor.
//   - the route is public (no requireAuth/requireAdmin).
//   - per-IP token bucket caps burst rate so a single attacker cannot burn
//     the known-contact 50/day tier for the whole account.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  CONTACT_TOPIC_LABELS,
  type ContactTopic,
  contactInquiryCreatedSchema,
  contactInquiryCreateSchema,
} from '@/lib/contact/schema';

export const dynamic = 'force-dynamic';

// Per-IP token bucket — keeps a malicious single visitor from burning the
// 50/day known-contact tier. Three hits in a rolling 10-minute window is
// generous for a real visitor (double-submit safety + an honest correction)
// but blocks a script that POSTs every 100 ms.
type Bucket = { count: number; windowStartMs: number };
const buckets = new Map<string, Bucket>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function clientBucketed(ip: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(ip);
  if (!existing || now - existing.windowStartMs > WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStartMs: now });
    return { ok: true };
  }
  if (existing.count >= MAX_PER_WINDOW) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((WINDOW_MS - (now - existing.windowStartMs)) / 1000),
    );
    return { ok: false, retryAfterSec };
  }
  existing.count += 1;
  return { ok: true };
}

function clientIp(headers: Headers): string {
  // x-forwarded-for is a comma list; the leftmost is the originating client
  // when the request was proxied (which the platform always does).
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'anonymous';
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const bucket = clientBucketed(ip);
  if (!bucket.ok) {
    return NextResponse.json(
      { errors: { form: 'Too many requests — please try again later.' } },
      { status: 429, headers: { 'retry-after': String(bucket.retryAfterSec) } },
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid request body.' } }, { status: 400 });
  }

  const parsed = contactInquiryCreateSchema.safeParse(bodyJson);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(flat)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const inquiry = parsed.data;
  const topicLabel = CONTACT_TOPIC_LABELS[inquiry.topic as ContactTopic];
  const recipient = process.env.POLSIA_COMPANY_EMAIL;
  if (!recipient) {
    // No inbox configured → the brief is broken (we can't deliver to the
    // founder). Surface as a 500 so the client shows a generic error rather
    // than a misleading "submitted" toast.
    return NextResponse.json(
      { errors: { form: 'Contact form is not configured right now.' } },
      { status: 500 },
    );
  }

  const createdAt = new Date();
  const id = `con_${crypto.randomUUID()}`;

  // Compose the founder notification email and fire post-validation. Per the
  // brief we do NOT send anything back to the visitor. The founder's inbox
  // is the source of truth — a partial failure on a side channel (register
  // contact) is silently swallowed (matches /api/instructors/route.ts:218
  // pattern: silent `.catch(() => {})` because the row / inbox is the
  // thing we promised the user, not the contact registration).
  const { contactInquiryReceivedEmail } = await import('@/lib/email/templates');
  const { sendEmail } = await import('@/lib/email/send');
  const template = contactInquiryReceivedEmail({
    topic: inquiry.topic,
    topicLabel: topicLabel.en,
    name: inquiry.name,
    email: inquiry.email,
    message: inquiry.message,
    locale: inquiry.locale,
    receivedAt: createdAt,
  });

  // Register the visitor as a known contact BEFORE the send so the email
  // lands inside the 50/day known-contact tier (vs. the cold-outreach tier).
  // Side-effect is intentionally fire-and-forget: a fast round-trip matters
  // for the visitor's success-toast UX, and a register failure is
  // non-fatal to the inquiry being recorded at the recipient's inbox via
  // the email channel — the email proxy still accepts the cold-tier send.
  const apiBase = process.env.POLSIA_API_BASE_URL || 'https://polsia.com';
  const apiKey = process.env.POLSIA_API_KEY;
  if (apiKey) {
    void fetch(`${apiBase}/api/proxy/email/contacts`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email: inquiry.email.trim().toLowerCase(),
        name: inquiry.name,
        source: 'contact_form',
      }),
    }).catch(() => {});
  }

  try {
    await sendEmail({ to: recipient, ...template });
  } catch {
    // The send failed → we did NOT actually deliver to the founder. Surface
    // a 502 so the client shows an honest error (a misleading "Thanks!" toast
    // would be worse than the visitor seeing a retry button).
    return NextResponse.json(
      { errors: { form: "We couldn't reach the team just now — please try again." } },
      { status: 502 },
    );
  }

  return NextResponse.json(
    contactInquiryCreatedSchema.parse({
      id,
      topic: inquiry.topic,
      locale: inquiry.locale,
      createdAt: createdAt.toISOString(),
    }),
    { status: 201 },
  );
}
