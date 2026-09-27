//
// Shared zod schemas for the guided `/contact` flow. Safe to import from a
// 'use client' file: no server-only imports here, so the client island can
// reuse the input TYPE without pulling in the route handler or Prisma.
//
// Two shapes live here:
//   1. contactSchema              — base { name, email, message } kept for the
//                                  contact-form module's default use.
//   2. contactInquiryCreateSchema — guided-flow input: adds `topic` (one of
//                                  CONTACT_TOPICS) and `locale` (BCP-47-ish).
//
// Topics follow the format spec'd in messages/<locale>.json —
// `landing.contactPage.topics.<i>` enumerates the canonical six in display
// order; the FIRST enum member below is index 0, the second is index 1, etc.
// Reorder both arrays together or you'll desync the tile-to-enum mapping.

import { z } from 'zod';

export const CONTACT_TOPICS = [
  'booking_issue',
  'instructor_question',
  'payment',
  'technical',
  'press',
  'other',
] as const;

export type ContactTopic = (typeof CONTACT_TOPICS)[number];

// Friendly URL → enum aliases. Used by the client island to deep-link from
// the FAQ's cancellation row: `/contact?topic=cancellation` ⊕
const TOPIC_URL_ALIASES: Record<string, ContactTopic> = {
  cancellation: 'booking_issue',
  booking: 'booking_issue',
  instructor: 'instructor_question',
  payment: 'payment',
  refund: 'payment',
  technical: 'technical',
  bug: 'technical',
  press: 'press',
  partnership: 'press',
  other: 'other',
};

export function resolveContactTopic(raw: string | null | undefined): ContactTopic | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if ((CONTACT_TOPICS as readonly string[]).includes(normalized)) {
    return normalized as ContactTopic;
  }
  return TOPIC_URL_ALIASES[normalized] ?? null;
}

export function isContactTopic(raw: string | null | undefined): raw is ContactTopic {
  return resolveContactTopic(raw) !== null;
}

// Human-readable label per topic — sent in the founder email so the founder
// doesn't need to memorise enum IDs.
export const CONTACT_TOPIC_LABELS: Record<ContactTopic, { en: string; sv: string }> = {
  booking_issue: { en: 'Booking issue / cancellation', sv: 'Bokning / avbokning' },
  instructor_question: { en: 'Instructor question', sv: 'Instruktörsfråga' },
  payment: { en: 'Payment & refund', sv: 'Betalning & återbetalning' },
  technical: { en: 'Site / technical problem', sv: 'Sajt / tekniskt problem' },
  press: { en: 'Press / partnership', sv: 'Press / partnerskap' },
  other: { en: 'Something else', sv: 'Något annat' },
};

// Base module shape (kept as-is for the minimum module compatibility).
export const contactSchema = z.object({
  name: z.string().min(1, 'Please enter your name.'),
  email: z.string().email('Please enter a valid email address.'),
  message: z.string().min(1, 'Please enter a message.'),
});

// Guided-flow create shape — what the /contact page POSTs to /api/contact.
// `locale` is REQUIRED (not defaulted) so the input and output types align —
// using `.default()` would widen the inferred INPUT to `locale?:` and trip
// react-hook-form's resolver; we KNOW the locale (read from `useLocale()` in
// the client island), so we just pass it.
export const contactInquiryCreateSchema = contactSchema.extend({
  topic: z.enum(CONTACT_TOPICS),
  locale: z.string().min(2).max(8),
});

export type ContactInput = z.infer<typeof contactSchema>;
export type ContactInquiryCreate = z.infer<typeof contactInquiryCreateSchema>;

// Response shape — confirms what the inbound landed as; the client uses
// `topic`/`locale` for the success toast copy and `id`/`createdAt` only for
// traceability in error reporting.
export const contactInquiryCreatedSchema = z.object({
  id: z.string(),
  topic: z.enum(CONTACT_TOPICS),
  locale: z.string(),
  createdAt: z.string(),
});
export type ContactInquiryCreated = z.infer<typeof contactInquiryCreatedSchema>;
