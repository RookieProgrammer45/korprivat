//
// POST /api/contact — guided Contact flow ingest.
//
// Deliver each inquiry to CONTACT_EMAIL (founder inbox). We do NOT persist
// to the ContactMessage table for the MVP (no topic/locale columns there).
// No auto-responder back to the visitor. Public route (no requireAuth).
// Per-IP token bucket caps burst rate.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  CONTACT_TOPIC_LABELS,
  type ContactTopic,
  contactInquiryCreatedSchema,
  contactInquiryCreateSchema,
} from '@/lib/contact/schema';

export const dynamic = 'force-dynamic';

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
  const recipient = process.env.CONTACT_EMAIL ?? 'support@drivelinkup.com';

  const createdAt = new Date();
  const id = `con_${crypto.randomUUID()}`;

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

  try {
    await sendEmail({ to: recipient, ...template });
  } catch {
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
