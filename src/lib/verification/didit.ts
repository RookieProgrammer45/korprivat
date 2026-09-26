// @polsia:user-owned — Didit KYC session + webhook helpers (Verification context).
//
// Facial age estimation lives in src/lib/didit/age-estimation.ts (different
// product). This module is the ID-document / Free KYC path.
//
// Signature verification follows https://docs.didit.me/integration/webhooks
// (X-Signature-V2 preferred, then X-Signature raw, then X-Signature-Simple).

import 'server-only';
import crypto from 'node:crypto';
import type { DiditDecision } from '@/lib/verification/state';

export const DIDIT_TIMESTAMP_SKEW_SECONDS = 300;

/**
 * Free KYC workflow UUID from `DIDIT_WORKFLOW_ID`.
 * Throws if unset — never hardcode a workflow id in source.
 */
export function requireDiditWorkflowId(): string {
  if (!process.env.DIDIT_WORKFLOW_ID) {
    throw new Error('DIDIT_WORKFLOW_ID is required');
  }
  const workflowId = process.env.DIDIT_WORKFLOW_ID.trim();
  if (!workflowId) {
    throw new Error('DIDIT_WORKFLOW_ID is required');
  }
  return workflowId;
}

const DIDIT_API_BASE = 'https://verification.didit.me';

export type DiditWebhookType =
  | 'status.updated'
  | 'data.updated'
  | 'user.status.updated'
  | 'user.data.updated'
  | 'business.status.updated'
  | 'business.data.updated'
  | 'activity.created'
  | 'transaction.created'
  | 'transaction.status.updated'
  | 'travel_rule.status.updated'
  | string;

export type DiditSignatureMethod = 'v2' | 'raw' | 'simple';

export class DiditWebhookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiditWebhookParseError';
  }
}

/**
 * Match Didit's float normalisation: whole-valued floats serialise as ints.
 * @see https://docs.didit.me/integration/webhooks
 */
export function shortenFloats(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [
        key,
        shortenFloats(value),
      ]),
    );
  }
  if (typeof data === 'number' && !Number.isInteger(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
}

/** Sort object keys recursively before re-stringifying (Didit sort_keys). */
export function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

function timingSafeEqualHex(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided.trim(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function isTimestampFresh(timestampHeader: string | null, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!timestampHeader) return false;
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= DIDIT_TIMESTAMP_SKEW_SECONDS;
}

export function verifySignatureV2(
  jsonBody: unknown,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
  nowSec?: number,
): boolean {
  if (!signatureHeader || !isTimestampFresh(timestampHeader, nowSec)) return false;
  // Reproduce Didit's canonical JSON: sorted keys, compact, Unicode preserved.
  const canonical = JSON.stringify(sortKeys(shortenFloats(jsonBody)));
  const expected = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}

export function verifySignatureRaw(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
  nowSec?: number,
): boolean {
  if (!signatureHeader || !isTimestampFresh(timestampHeader, nowSec)) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}

export function verifySignatureSimple(
  jsonBody: Record<string, unknown>,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string,
  nowSec?: number,
): boolean {
  if (!signatureHeader || !isTimestampFresh(timestampHeader, nowSec)) return false;
  const canonical = [
    jsonBody.timestamp ?? '',
    jsonBody.session_id ?? '',
    jsonBody.status ?? '',
    jsonBody.webhook_type ?? '',
  ].join(':');
  const expected = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
  return timingSafeEqualHex(expected, signatureHeader);
}

/**
 * Prefer X-Signature-V2, then X-Signature (raw bytes), then X-Signature-Simple.
 * Simple authenticates the envelope only — callers must not trust `decision`
 * unless method is `v2` or `raw`.
 */
export function verifyDiditRequest(input: {
  rawBody: string;
  jsonBody: unknown;
  signatureV2: string | null;
  signatureRaw: string | null;
  signatureSimple: string | null;
  timestamp: string | null;
  nowSec?: number;
}): { ok: true; method: DiditSignatureMethod } | { ok: false } {
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!secret || !input.timestamp) return { ok: false };

  if (
    input.signatureV2 &&
    verifySignatureV2(input.jsonBody, input.signatureV2, input.timestamp, secret, input.nowSec)
  ) {
    return { ok: true, method: 'v2' };
  }
  if (
    input.signatureRaw &&
    verifySignatureRaw(input.rawBody, input.signatureRaw, input.timestamp, secret, input.nowSec)
  ) {
    return { ok: true, method: 'raw' };
  }
  if (
    input.signatureSimple &&
    input.jsonBody &&
    typeof input.jsonBody === 'object' &&
    verifySignatureSimple(
      input.jsonBody as Record<string, unknown>,
      input.signatureSimple,
      input.timestamp,
      secret,
      input.nowSec,
    )
  ) {
    return { ok: true, method: 'simple' };
  }
  return { ok: false };
}

/** @deprecated Prefer verifyDiditRequest — kept for call-site clarity in older tests. */
export function verifyDiditSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null = null,
): boolean {
  let jsonBody: unknown = null;
  try {
    jsonBody = JSON.parse(rawBody) as unknown;
  } catch {
    jsonBody = null;
  }
  const result = verifyDiditRequest({
    rawBody,
    jsonBody,
    signatureV2: null,
    signatureRaw: signatureHeader,
    signatureSimple: null,
    timestamp: timestampHeader,
  });
  return result.ok;
}

/**
 * Normalized view of a Didit webhook payload.
 * Confirm against Didit docs. Everything downstream is schema-agnostic.
 */
export interface ParsedDiditWebhook {
  eventId: string;
  webhookType: DiditWebhookType;
  sessionId: string | null;
  /** We send userId as vendor_data when creating the session. */
  vendorData: string;
  /** Raw Didit status label (e.g. "Approved", "In Review"). */
  statusLabel: string;
  /** Mapped into resolveLearnerState vocabulary; null when not a session decision. */
  decision: DiditDecision | null;
  verifiedDob: Date | null;
  firstName: string | null;
  lastName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  livenessPassed: boolean | null;
  reason: string | null;
  sessionKind: 'business' | null;
  /** True when decision may be trusted (V2/raw). Set by the route after verify. */
  decisionTrusted: boolean;
}

/**
 * Confirm against Didit docs. Everything downstream is schema-agnostic.
 * Field paths follow the V3 session webhook envelope + decision.id_verifications[].
 */
export function parseDiditWebhook(payload: unknown): ParsedDiditWebhook {
  if (!payload || typeof payload !== 'object') {
    throw new DiditWebhookParseError('payload_not_object');
  }
  const root = payload as Record<string, unknown>;

  const eventId = strOrNull(root.event_id);
  const webhookType = strOrNull(root.webhook_type) ?? '';
  const statusLabel = strOrNull(root.status) ?? '';
  const sessionId = strOrNull(root.session_id);
  const vendorData =
    strOrNull(root.vendor_data) ?? strOrNull(root.vendor_user_id) ?? '';

  if (!eventId) {
    throw new DiditWebhookParseError('missing_event_id');
  }
  if (!webhookType) {
    throw new DiditWebhookParseError('missing_webhook_type');
  }

  const decisionObj =
    root.decision && typeof root.decision === 'object'
      ? (root.decision as Record<string, unknown>)
      : null;

  const idVerification = firstArrayItem(decisionObj?.id_verifications);
  const liveness = firstArrayItem(decisionObj?.liveness_checks);

  const dobRaw =
    strOrNull(idVerification?.date_of_birth) ??
    strOrNull(decisionObj?.date_of_birth) ??
    null;

  const verifiedDob = dobRaw ? new Date(dobRaw) : null;
  if (verifiedDob && Number.isNaN(verifiedDob.getTime())) {
    throw new DiditWebhookParseError('invalid_verified_dob');
  }

  const warnings = collectWarnings(decisionObj);
  const reason =
    warnings[0] ??
    strOrNull(decisionObj?.reason) ??
    strOrNull(root.reason);

  return {
    eventId,
    webhookType,
    sessionId,
    vendorData,
    statusLabel,
    decision: statusLabel ? normalizeSessionStatus(statusLabel) : null,
    verifiedDob,
    firstName: strOrNull(idVerification?.first_name),
    lastName: strOrNull(idVerification?.last_name),
    documentType: strOrNull(idVerification?.document_type),
    documentNumber: strOrNull(idVerification?.document_number),
    nationality:
      strOrNull(idVerification?.nationality) ??
      strOrNull(idVerification?.issuing_state),
    livenessPassed:
      typeof liveness?.status === 'string'
        ? liveness.status.toLowerCase() === 'approved'
        : null,
    reason,
    sessionKind: root.session_kind === 'business' ? 'business' : null,
    decisionTrusted: false,
  };
}

function firstArrayItem(
  value: unknown,
): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  return first && typeof first === 'object'
    ? (first as Record<string, unknown>)
    : null;
}

function collectWarnings(decisionObj: Record<string, unknown> | null): string[] {
  if (!decisionObj) return [];
  const out: string[] = [];
  for (const key of Object.keys(decisionObj)) {
    const section = decisionObj[key];
    if (!Array.isArray(section)) continue;
    for (const item of section) {
      if (!item || typeof item !== 'object') continue;
      const warnings = (item as { warnings?: unknown }).warnings;
      if (!Array.isArray(warnings)) continue;
      for (const w of warnings) {
        if (!w || typeof w !== 'object') continue;
        const short = strOrNull((w as { short_description?: unknown }).short_description);
        const risk = strOrNull((w as { risk?: unknown }).risk);
        if (short) out.push(short);
        else if (risk) out.push(risk);
      }
    }
  }
  return out;
}

function strOrNull(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Map Didit verification status labels → learner state-machine decisions. */
export function normalizeSessionStatus(raw: string): DiditDecision | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  switch (key) {
    case 'approved':
    case 'verified':
    case 'success':
      return 'approved';
    case 'declined':
    case 'rejected':
    case 'failed':
      return 'declined';
    case 'in_review':
    case 'pending':
    case 'processing':
    case 'in_progress':
    case 'not_started':
    case 'awaiting_user':
    case 'resubmitted':
      return 'in_review';
    case 'expired':
    case 'kyc_expired': // Didit literal: "Kyc Expired"
      return 'expired';
    case 'abandoned':
    case 'cancelled':
    case 'canceled':
      return 'abandoned';
    default:
      return null;
  }
}

export class DiditSessionCreateError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(`Didit session create failed: ${status}`);
    this.name = 'DiditSessionCreateError';
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Create a Didit KYC session. Server-side only — never call from the browser.
 * `vendor_data` must be the stable internal user id (webhook correlation).
 */
export async function createDiditSession(args: {
  userId: string;
  claimedDob: Date | null;
  callbackUrl: string;
  workflowId?: string;
}): Promise<{ sessionId: string; url: string }> {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  if (!apiKey) {
    throw new DiditSessionCreateError(500, 'DIDIT_API_KEY is not configured');
  }

  const res = await fetch(`${DIDIT_API_BASE}/v3/session/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      workflow_id: args.workflowId ?? requireDiditWorkflowId(),
      vendor_data: args.userId,
      callback: args.callbackUrl,
      language: 'sv',
      metadata: {
        role: 'LEARNER',
        claimedDob: args.claimedDob?.toISOString().slice(0, 10) ?? null,
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new DiditSessionCreateError(res.status, detail);
  }

  const json = (await res.json()) as Record<string, unknown>;
  const sessionId = strOrNull(json.session_id) ?? strOrNull(json.id);
  const url = strOrNull(json.url) ?? strOrNull(json.verification_url);
  if (!sessionId || !url) {
    throw new DiditSessionCreateError(502, 'Didit response missing session_id or url');
  }
  return { sessionId, url };
}

/** Structured alert when Sentry is not wired (no @sentry package today). */
export function alertDiditWebhook(note: string, extra?: Record<string, unknown>): void {
  // TODO(verification): route to Sentry once @sentry/nextjs is installed.
  console.error('[didit-webhook]', note, extra ?? {});
}
