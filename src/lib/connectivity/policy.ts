import { payloadHash } from '@/lib/reliability/inbox-policy';

export function isConnectivityEnabled(
  env: string | undefined = process.env.CONNECTIVITY_API,
): boolean {
  return env === '1' || env === 'true';
}

export function rateLimitPerMinute(
  env: string | undefined = process.env.CONNECTIVITY_RATE_LIMIT,
): number {
  const parsed = Number(env ?? '60');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

const hits = new Map<string, number[]>();

export function resetRateLimits(): void {
  hits.clear();
}

export function consumeRateLimit(input: {
  key: string;
  now: Date;
  limit: number;
  windowMs?: number;
}): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const windowMs = input.windowMs ?? 60_000;
  const current = (hits.get(input.key) ?? []).filter(
    (stamp) => input.now.getTime() - stamp < windowMs,
  );
  if (current.length >= input.limit) {
    const oldest = current[0] ?? input.now.getTime();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + windowMs - input.now.getTime()) / 1000),
    );
    hits.set(input.key, current);
    return { allowed: false, retryAfterSeconds };
  }
  current.push(input.now.getTime());
  hits.set(input.key, current);
  return { allowed: true };
}

export function idempotencyDecision(input: {
  existing: { payloadHash: string; responseStatus: number; responseBody: unknown } | null;
  payloadHash: string;
}):
  | { kind: 'new' }
  | { kind: 'replay'; responseStatus: number; responseBody: unknown }
  | { kind: 'conflict' } {
  if (!input.existing) return { kind: 'new' };
  if (input.existing.payloadHash === input.payloadHash) {
    return {
      kind: 'replay',
      responseStatus: input.existing.responseStatus,
      responseBody: input.existing.responseBody,
    };
  }
  return { kind: 'conflict' };
}

export function productionEnablementDecision(evidenceSource: 'mock' | 'vendor_environment'): {
  httpStatus: number;
  code: 'mock_evidence_refused' | 'milestone_5_required';
  prodEnabled: false;
  recorded: boolean;
} {
  if (evidenceSource === 'mock') {
    return { httpStatus: 403, code: 'mock_evidence_refused', prodEnabled: false, recorded: false };
  }
  return { httpStatus: 202, code: 'milestone_5_required', prodEnabled: false, recorded: true };
}

export function hashPayload(value: unknown): string {
  return payloadHash(value);
}
