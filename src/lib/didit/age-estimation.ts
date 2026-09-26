// @polsia:user-owned — Didit biometric age estimation for learner signup.

import 'server-only';
import { MIN_LEARNER_AGE_YEARS } from '@/lib/signup-eligibility';

const DIDIT_AGE_URL = 'https://verification.didit.me/v3/age-estimation/';
const MAX_FACE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FACE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff']);

export type DiditAgeStatus = 'Approved' | 'Declined' | 'In Review' | 'Not Finished';

export type DiditAgeEstimationResult = {
  requestId: string | null;
  status: DiditAgeStatus | 'Unavailable';
  estimatedAge: number | null;
  livenessScore: number | null;
  eligible: boolean;
  warnings: string[];
};

export class DiditAgeError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export function isDiditAgeConfigured(): boolean {
  return Boolean(process.env.DIDIT_API_KEY?.trim());
}

export function validateFaceImage(
  file: File,
): { ok: true } | { ok: false; code: 'empty_file' | 'file_too_large' | 'unsupported_image_format' } {
  if (file.size === 0) return { ok: false, code: 'empty_file' };
  if (file.size > MAX_FACE_BYTES) return { ok: false, code: 'file_too_large' };
  const type = file.type.toLowerCase();
  if (!ACCEPTED_FACE_TYPES.has(type)) return { ok: false, code: 'unsupported_image_format' };
  return { ok: true };
}

type DiditAgeResponse = {
  request_id?: string;
  liveness?: {
    status?: string;
    score?: number;
    age_estimation?: number | null;
    warnings?: Array<{ short_description?: string; risk?: string }>;
  };
};

/**
 * Estimate age from a facial image. When DIDIT_API_KEY is unset, returns
 * Unavailable so callers can fall back to date-of-birth attestation only.
 */
export async function estimateLearnerAge(
  faceImage: File,
  vendorData?: string,
): Promise<DiditAgeEstimationResult> {
  const apiKey = process.env.DIDIT_API_KEY?.trim();
  if (!apiKey) {
    return {
      requestId: null,
      status: 'Unavailable',
      estimatedAge: null,
      livenessScore: null,
      eligible: false,
      warnings: ['DIDIT_API_KEY is not configured'],
    };
  }

  const validation = validateFaceImage(faceImage);
  if (!validation.ok) throw new DiditAgeError(validation.code, validation.code);

  const body = new FormData();
  body.append('user_image', faceImage, faceImage.name || 'selfie.jpg');
  if (vendorData) body.append('vendor_data', vendorData);

  const response = await fetch(DIDIT_AGE_URL, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body,
  });

  if (response.status === 401) {
    throw new DiditAgeError('unauthorized', 'Didit API key was rejected');
  }
  if (response.status === 403) {
    throw new DiditAgeError('credits', 'Didit account needs credits');
  }
  if (!response.ok) {
    throw new DiditAgeError('request_failed', `Didit age estimation failed (${response.status})`);
  }

  const payload = (await response.json()) as DiditAgeResponse;
  const status = normalizeStatus(payload.liveness?.status);
  const estimatedAge =
    typeof payload.liveness?.age_estimation === 'number' ? payload.liveness.age_estimation : null;
  const warnings = (payload.liveness?.warnings ?? [])
    .map((w) => w.short_description)
    .filter((value): value is string => Boolean(value));

  // MAE for under-18 is ~1.5y — require estimated age at/above the product
  // minimum. "In Review" borderline cases stay ineligible until ID fallback.
  const eligible =
    status === 'Approved' && estimatedAge !== null && estimatedAge >= MIN_LEARNER_AGE_YEARS;

  return {
    requestId: payload.request_id ?? null,
    status,
    estimatedAge,
    livenessScore: typeof payload.liveness?.score === 'number' ? payload.liveness.score : null,
    eligible,
    warnings,
  };
}

function normalizeStatus(value: string | undefined): DiditAgeStatus {
  if (value === 'Approved' || value === 'Declined' || value === 'In Review' || value === 'Not Finished') {
    return value;
  }
  return 'Declined';
}
