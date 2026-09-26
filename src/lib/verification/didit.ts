// @polsia:user-owned — Didit ID-verification webhook helpers (signature + parse).
//
// Facial age estimation lives in src/lib/didit/age-estimation.ts (different
// product). This module is only for the ID-document webhook writer.

import 'server-only';
import crypto from 'node:crypto';
import type { DiditDecision } from '@/lib/verification/state';

/**
 * Verify the Didit webhook signature.
 *
 * ASSUMPTION: HMAC-SHA256 over the raw request body, hex-encoded, sent in
 * `x-didit-signature`. Confirm header name and encoding against Didit's docs
 * and adjust the two marked lines if different.
 */
export function verifyDiditSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false;
  const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
  if (!secret) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex'); // <- change to "base64" if Didit encodes that way

  // Strip optional "sha256=" prefix if present.
  const provided = signatureHeader.trim().replace(/^sha256=/i, '');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Normalized view of a Didit webhook payload.
 * Confirm against Didit docs. Everything downstream is schema-agnostic.
 */
export interface ParsedDiditWebhook {
  sessionId: string;
  /** We send userId as vendor_data when creating the session. */
  vendorData: string;
  decision: DiditDecision;
  verifiedDob: Date | null;
  firstName: string | null;
  lastName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  nationality: string | null;
  livenessPassed: boolean | null;
  reason: string | null;
}

export class DiditWebhookParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiditWebhookParseError';
  }
}

/**
 * Confirm against Didit docs. Everything downstream is schema-agnostic.
 * Field paths below are educated guesses — adjust accessors only here.
 */
export function parseDiditWebhook(payload: unknown): ParsedDiditWebhook {
  if (!payload || typeof payload !== 'object') {
    throw new DiditWebhookParseError('payload_not_object');
  }
  const root = payload as Record<string, unknown>;
  // Confirm against Didit docs. Everything downstream is schema-agnostic.
  const session =
    root.session && typeof root.session === 'object'
      ? (root.session as Record<string, unknown>)
      : root;
  const decisionObj =
    session.decision && typeof session.decision === 'object'
      ? (session.decision as Record<string, unknown>)
      : null;
  const document =
    session.document && typeof session.document === 'object'
      ? (session.document as Record<string, unknown>)
      : null;
  const liveness =
    session.liveness && typeof session.liveness === 'object'
      ? (session.liveness as Record<string, unknown>)
      : null;

  const decisionRaw = String(
    session.status ?? root.decision ?? decisionObj?.status ?? '',
  ).toLowerCase();
  const dobRaw =
    (decisionObj?.date_of_birth as string | undefined) ??
    (document?.date_of_birth as string | undefined) ??
    null;

  const sessionId = String(session.session_id ?? session.id ?? '');
  const vendorData = String(session.vendor_data ?? root.vendor_data ?? '');

  if (!sessionId) {
    throw new DiditWebhookParseError('missing_session_id');
  }
  if (!decisionRaw) {
    throw new DiditWebhookParseError('missing_decision');
  }

  const verifiedDob = dobRaw ? new Date(dobRaw) : null;
  if (verifiedDob && Number.isNaN(verifiedDob.getTime())) {
    throw new DiditWebhookParseError('invalid_verified_dob');
  }

  return {
    sessionId,
    vendorData,
    decision: normalizeDecision(decisionRaw),
    verifiedDob,
    firstName:
      strOrNull(document?.first_name) ?? strOrNull(decisionObj?.first_name),
    lastName:
      strOrNull(document?.last_name) ?? strOrNull(decisionObj?.last_name),
    documentType: strOrNull(document?.document_type),
    documentNumber: strOrNull(document?.document_number),
    nationality: strOrNull(document?.nationality),
    livenessPassed:
      typeof liveness?.passed === 'boolean'
        ? liveness.passed
        : typeof decisionObj?.liveness_passed === 'boolean'
          ? decisionObj.liveness_passed
          : null,
    reason: strOrNull(decisionObj?.reason) ?? strOrNull(root.reason),
  };
}

function strOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDecision(raw: string): DiditDecision {
  switch (raw) {
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
      return 'in_review';
    case 'expired':
      return 'expired';
    case 'abandoned':
    case 'cancelled':
    case 'canceled':
      return 'abandoned';
    default:
      throw new DiditWebhookParseError(`unknown_decision:${raw}`);
  }
}

/** Structured alert when Sentry is not wired (no @sentry package today). */
export function alertDiditWebhook(note: string, extra?: Record<string, unknown>): void {
  // TODO(verification): route to Sentry once @sentry/nextjs is installed.
  console.error('[didit-webhook]', note, extra ?? {});
}
