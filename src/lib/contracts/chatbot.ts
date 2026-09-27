//
// Client island in src/components/custom/chatbot-mount.tsx and route handler
// src/app/api/chatbot/route.ts both import the same schemas so a shape change
// is a `tsc` / runtime ZodError, not silent drift. No server-only imports here
// — safe to import from either side of the wire.
//
// `suggestContactTopic` reuses CONTACT_TOPICS / ContactTopic from
// @/lib/contact/schema so the bot's "Talk to the team" CTA shares the
// canonical enum the contact-form uses (same name => same handoff seam).
//
// Values are deliberately narrow: short messages keep the bot responsive;
// max 2000 chars matches a polite chat-message limit and the LLM roundtrip;
// max 4000 chars reply keeps the toast / transcript tidy.

import { z } from 'zod';
import { CONTACT_TOPICS } from '@/lib/contact/schema';

export const LOCALE_VALUES = ['en', 'sv'] as const;
export type Locale = (typeof LOCALE_VALUES)[number];

export const chatbotMessageSendSchema = z.object({
  message: z.string().min(1, 'message is required').max(2000),
  conversationId: z.string().uuid().optional(),
  locale: z.string().regex(/^(en|sv)$/, 'locale must be en or sv'),
});

export type ChatbotMessageSend = z.infer<typeof chatbotMessageSendSchema>;

export const chatbotMessageResponseSchema = z.object({
  reply: z.string().min(1).max(4000),
  suggestContactTopic: z.enum(CONTACT_TOPICS).nullable(),
  conversationId: z.string().uuid(),
});

export type ChatbotMessageResponse = z.infer<typeof chatbotMessageResponseSchema>;
