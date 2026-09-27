// Server-only sendEmail transport — sends via the Resend SDK. Import it from
// your app's OWN server route handlers (never expose a generic /api/email
// route). Compose subject/html/text in @/lib/email/templates, then:
// sendEmail({ to, ...welcomeEmail({ name }) }).

import 'server-only';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Ignored — kept for call-site compatibility with the former proxy. */
  replyToEmailId?: string;
}

export interface SendEmailResult {
  id: string;
}

const emailOverrideTo = process.env.EMAIL_OVERRIDE_TO;
if (emailOverrideTo) {
  // biome-ignore lint/suspicious/noConsole: one-shot startup notice for ops visibility
  console.info(`[email] EMAIL_OVERRIDE_TO active — all mail → ${emailOverrideTo}`);
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set');
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const text =
    input.text ??
    input.html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const recipient = process.env.EMAIL_OVERRIDE_TO ?? input.to;
  const subject = process.env.EMAIL_OVERRIDE_TO
    ? `[→ ${input.to}] ${input.subject}`
    : input.subject;

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'DriveLinkUp <noreply@drivelinkup.com>',
    to: recipient,
    subject,
    html: input.html,
    text,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
  return { id: data?.id ?? '' };
}
