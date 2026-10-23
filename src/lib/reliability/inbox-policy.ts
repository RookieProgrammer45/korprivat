import { createHash } from 'node:crypto';

export const RETRY_MAX_ATTEMPTS = 5;
export const RETRY_INITIAL_MS = 30_000;
export const RETRY_MAX_INTERVAL_MS = 60 * 60 * 1000;

export function isReliableProcessingOn(
  env: string | undefined = process.env.RELIABLE_PROCESSING,
): boolean {
  return env === '1' || env === 'true';
}

export type InboxAction =
  | 'rejected_duplicate'
  | 'rejected_stale'
  | 'authoritative_retrieval'
  | 'apply';

export function decideInboxEvent(input: {
  duplicate: boolean;
  revision: number | null;
  occurredAt: Date | null;
  watermarkRevision: number | null;
  watermarkAt: Date | null;
}): InboxAction {
  if (input.duplicate) return 'rejected_duplicate';
  if (input.revision != null && input.watermarkRevision != null) {
    if (input.revision < input.watermarkRevision) return 'rejected_stale';
    if (input.revision === input.watermarkRevision) return 'authoritative_retrieval';
    return 'apply';
  }
  if (input.occurredAt != null && input.watermarkAt != null) {
    const occurred = input.occurredAt.getTime();
    const watermark = input.watermarkAt.getTime();
    if (occurred < watermark) return 'rejected_stale';
    if (occurred === watermark) return 'authoritative_retrieval';
    return 'apply';
  }
  if (input.watermarkRevision == null && input.watermarkAt == null) return 'apply';
  return 'authoritative_retrieval';
}

const SENSITIVE_KEY = /email|phone|name|token|secret|address|dob/i;

export function redactPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactPayload(item));
  if (value && typeof value === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      redacted[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redactPayload(item);
    }
    return redacted;
  }
  if (typeof value === 'string' && value.includes('@')) return '[redacted]';
  return value;
}

export function payloadHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex');
}

export function failureDisposition(
  attemptCountAfterFailure: number,
): { deadLetter: false; nextDelayMs: number } | { deadLetter: true } {
  if (attemptCountAfterFailure >= RETRY_MAX_ATTEMPTS) return { deadLetter: true };
  const delay = Math.min(
    RETRY_INITIAL_MS * 2 ** Math.max(0, attemptCountAfterFailure - 1),
    RETRY_MAX_INTERVAL_MS,
  );
  return { deadLetter: false, nextDelayMs: delay };
}

export function quarantineRelease(input: {
  kind: 'ttl_expired' | 'retry_exhausted' | 'authoritative' | 'audited_decision';
  rationale?: string | null;
  resolutionRef?: string | null;
}): { release: boolean } {
  if (input.kind === 'ttl_expired' || input.kind === 'retry_exhausted') {
    return { release: false };
  }
  if (input.kind === 'audited_decision') {
    return { release: Boolean(input.rationale?.trim()) };
  }
  return { release: Boolean(input.resolutionRef?.trim()) };
}

export function nativeOutboxData(bookingId: string) {
  return {
    commandType: 'native_state',
    bookingId,
    correlationId: bookingId,
    idempotencyKey: `booking:${bookingId}:pending`,
    payload: { toState: 'pending' },
    state: 'pending',
    outcome: 'pending',
  };
}

export function inventoryHeldByQuarantine(input: {
  quarantineResourceRef: string | null;
  resolutionKind: string | null;
}): boolean {
  return input.quarantineResourceRef != null && input.resolutionKind == null;
}
