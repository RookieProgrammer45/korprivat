//
// POST /api/chatbot — public FAQ chatbot endpoint.
//
// Drives the floating in-app chatbot (FAB + dialog mounted once at the app
// root via global-mounts.tsx → chatbot-mount.tsx). The bot answers routine
// learner questions (categories, pricing ranges, how booking works, legality,
// cancellation) through OpenAI and falls back to the human
// contact flow when the question is not an FAQ — see
// src/lib/business/chatbot-knowledge.ts for the kernel.
//
// Round-trips through the server-only `chat()` helper (OpenAI). We NEVER call
// @anthropic-ai/sdk (the module's client.ts handles all provider routing).
//
// Hard rules from the brief + plan:
//   - public route (no requireAuth / requireAdmin — FAQ only).
//   - per-IP token bucket identical to /api/contact/route.ts (5 hits per
//     rolling 10-minute window) so a single attacker cannot burn the budget.
//   - input enforced by chatbotMessageSendSchema (1–2000 chars + locale).
//   - response is a STRUCTURED JSON envelope (chatbotMessageResponseSchema)
//     containing { reply, suggestContactTopic, conversationId } so the client
//     can decide whether to surface a handoff CTA without parsing tool calls.
//   - status 200 happy, 400 validation, 429 overflow, 502 upstream.

import 'server-only';
import { NextResponse } from 'next/server';
import { chat } from '@/lib/ai/client';
import {
  buildSystemPrompt,
  extractContactTopic,
  stripHandoffBlock,
} from '@/lib/business/chatbot-knowledge';
import {
  chatbotMessageResponseSchema,
  chatbotMessageSendSchema,
  LOCALE_VALUES,
  type Locale,
} from '@/lib/contracts/chatbot';

export const dynamic = 'force-dynamic';

// Per-IP token bucket — same shape as /api/contact/route.ts so a single
// hostile visitor cannot burn the AI-proxy token budget.
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

  const parsed = chatbotMessageSendSchema.safeParse(bodyJson);
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(flat)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const locale: Locale = (LOCALE_VALUES as readonly string[]).includes(parsed.data.locale)
    ? (parsed.data.locale as Locale)
    : 'en';

  const systemPrompt = buildSystemPrompt(locale);

  let assistantText: string;
  try {
    // Non-streaming chat() from @/lib/ai/client — server-only and routes
    // through the platform AI proxy (no provider SDK / secret in repo).
    assistantText = await chat({
      task: 'faq-bot',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: parsed.data.message },
      ],
    });
  } catch {
    // Upstream failure (auth, network, upstream 5xx) — surface as 502 so the
    // client shows a generic error toast instead of a misleading reply.
    return NextResponse.json(
      { errors: { form: 'The chatbot is not available right now. Please try again.' } },
      { status: 502 },
    );
  }

  const reply = stripHandoffBlock(assistantText || '');
  const suggestContactTopic = extractContactTopic(assistantText ?? '');
  const conversationId = parsed.data.conversationId ?? crypto.randomUUID();

  const responseBody = chatbotMessageResponseSchema.parse({
    reply: reply || '…',
    suggestContactTopic,
    conversationId,
  });

  return NextResponse.json(responseBody, { status: 200 });
}
