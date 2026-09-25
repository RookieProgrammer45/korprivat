// @polsia:user-owned — deterministic, high-confidence messaging guardrails.
import type { MessagingCategoryCode } from '@/lib/contracts/messaging';

export interface MessagingGuardrailResult {
  blocked: boolean;
  categories: MessagingCategoryCode[];
  explanationKey: 'blocked';
  alternativeKey: 'keep_on_platform';
}

const PHONE_PATTERN =
  /(?:\+46|0046|0)[\s().-]*(?:7[0-9]|[1-9][0-9])[\s().-]*(?:[0-9][\s().-]*){6,10}/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const LINK_PATTERN = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|se|org|net|io|co)\b/i;
const SOCIAL_PATTERN =
  /(?:instagram|snapchat|tiktok|facebook|whatsapp|telegram|signal|discord)\s*(?:[.:/]\s*|handle\s*(?:is|:)?\s+|@)\S+/i;
const PAYMENT_PATTERN =
  /\b(?:swish|paypal|venmo|cash|kontant|bank transfer|banköverföring|utanfo(?:r|̈) plattformen|off[- ]platform|outside (?:the )?platform|pay me directly|betala direkt)\b/i;

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
    .trim();
}

export function classifyMessage(value: string): MessagingGuardrailResult {
  const text = normalize(value);
  const categories: MessagingCategoryCode[] = [];
  if (PHONE_PATTERN.test(text)) categories.push('phone');
  if (EMAIL_PATTERN.test(text)) categories.push('email');
  if (SOCIAL_PATTERN.test(text) || /\b(?:my|mitt|min)\s+@[a-z0-9_.-]{3,}\b/i.test(text)) {
    categories.push('social');
  }
  if (LINK_PATTERN.test(text)) categories.push('external_link');
  if (PAYMENT_PATTERN.test(text)) categories.push('off_platform_payment');

  return {
    blocked: categories.length > 0,
    categories,
    explanationKey: 'blocked',
    alternativeKey: 'keep_on_platform',
  };
}
