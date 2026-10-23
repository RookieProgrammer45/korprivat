import 'server-only';
import { AvailabilityPut, ContentPut, InboundEvent } from '@/lib/connectivity/adapter-contract';
import {
  consumeRateLimit,
  hashPayload,
  idempotencyDecision,
  isConnectivityEnabled,
  productionEnablementDecision,
  rateLimitPerMinute,
} from '@/lib/connectivity/policy';
import {
  canSignForEnvironment,
  partnerSecret,
  signaturesMatch,
  signPartnerRequest,
  timestampWithinWindow,
} from '@/lib/connectivity/signing';
import { prisma } from '@/lib/db';
import { receiveInboxEvent } from '@/lib/reliability/inbox-store';

export { isConnectivityEnabled };

type CredentialRow = {
  id: string;
  partnerKey: string;
  environment: string;
  schoolConnectionId: string;
  revokedAt: Date | null;
  connection: { id: string; listingId: string; environment: string; status: string };
};

export type PartnerFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
};

export type PartnerContext = {
  ok: true;
  credentialId: string;
  partnerKey: string;
  connection: CredentialRow['connection'];
  correlationId: string | null;
};

function credentials() {
  return (
    prisma as unknown as {
      partnerCredential?: {
        findUnique: (args: unknown) => Promise<CredentialRow | null>;
        findMany: (args: unknown) => Promise<CredentialRow[]>;
      };
    }
  ).partnerCredential;
}

export async function authenticatePartner(input: {
  method: string;
  path: string;
  rawBody: string;
  headers: Headers;
  urlConnectionId?: string;
  now?: Date;
}): Promise<PartnerContext | PartnerFailure> {
  const now = input.now ?? new Date();
  const partnerId = input.headers.get('x-dlu-partner-id');
  const timestamp = input.headers.get('x-dlu-timestamp');
  const signature = input.headers.get('x-dlu-signature');
  const connectionId = input.headers.get('x-dlu-connection-id');
  if (!partnerId || !timestamp || !signature || !connectionId) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Missing partner signature.',
      retryable: false,
    };
  }
  if (!timestampWithinWindow(timestamp, now)) {
    return {
      ok: false,
      status: 401,
      code: 'stale_timestamp',
      message: 'Timestamp is outside the allowed window.',
      retryable: false,
    };
  }
  const table = credentials();
  if (!table) {
    return {
      ok: false,
      status: 503,
      code: 'not_available',
      message: 'Connectivity storage is unavailable.',
      retryable: true,
    };
  }
  const credential = await table.findUnique({
    where: { id: partnerId },
    include: {
      connection: { select: { id: true, listingId: true, environment: true, status: true } },
    },
  });
  if (!credential || credential.revokedAt) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Credential is unknown or revoked.',
      retryable: false,
    };
  }
  const secret = partnerSecret(credential.id);
  if (!secret) {
    return {
      ok: false,
      status: 401,
      code: 'unauthorized',
      message: 'Credential is unknown or revoked.',
      retryable: false,
    };
  }
  const expected = signPartnerRequest({
    secret,
    method: input.method,
    path: input.path,
    timestamp,
    body: input.rawBody,
  });
  if (!signaturesMatch(expected, signature)) {
    return {
      ok: false,
      status: 401,
      code: 'invalid_signature',
      message: 'Signature does not match.',
      retryable: false,
    };
  }
  if (
    connectionId !== credential.schoolConnectionId ||
    (input.urlConnectionId && input.urlConnectionId !== credential.schoolConnectionId)
  ) {
    return {
      ok: false,
      status: 403,
      code: 'connection_mismatch',
      message: 'Credential is not granted for this connection.',
      retryable: false,
    };
  }
  if (!canSignForEnvironment(credential.environment, credential.connection.environment)) {
    return {
      ok: false,
      status: 403,
      code: 'environment_mismatch',
      message: 'Sandbox and production are isolated.',
      retryable: false,
    };
  }
  const limit = rateLimitPerMinute();
  const partnerLimit = consumeRateLimit({ key: `partner:${credential.id}`, now, limit });
  const connectionLimit = consumeRateLimit({
    key: `connection:${credential.schoolConnectionId}`,
    now,
    limit,
  });
  if (!partnerLimit.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'rate_limited',
      message: 'Rate limit exceeded.',
      retryable: true,
      retryAfterSeconds: partnerLimit.retryAfterSeconds,
    };
  }
  if (!connectionLimit.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'rate_limited',
      message: 'Rate limit exceeded.',
      retryable: true,
      retryAfterSeconds: connectionLimit.retryAfterSeconds,
    };
  }
  return {
    ok: true,
    credentialId: credential.id,
    partnerKey: credential.partnerKey,
    connection: credential.connection,
    correlationId: input.headers.get('x-dlu-correlation-id'),
  };
}

export async function listPartnerConnections(partnerKey: string, environment: string) {
  const table = credentials();
  if (!table) return [];
  const rows = await table.findMany({
    where: { partnerKey, environment, revokedAt: null },
    include: {
      connection: { select: { id: true, listingId: true, environment: true, status: true } },
    },
  });
  return rows.map((row) => ({
    id: row.connection.id,
    school_id: row.connection.listingId,
    environment: row.connection.environment,
    scopes: [] as string[],
    status: row.connection.status,
  }));
}

type IdempotencyRow = {
  payloadHash: string;
  responseStatus: number;
  responseBody: unknown;
};

function idempotencyTable() {
  return (
    prisma as unknown as {
      connectivityIdempotency?: {
        findUnique: (args: unknown) => Promise<IdempotencyRow | null>;
        create: (args: unknown) => Promise<unknown>;
      };
    }
  ).connectivityIdempotency;
}

export async function claimOperation(input: {
  connectionId: string;
  operationType: string;
  idempotencyKey: string;
  payload: unknown;
  correlationId: string | null;
  responseStatus: number;
  responseBody: unknown;
}): Promise<
  | { kind: 'created' | 'replay'; status: number; body: unknown }
  | { kind: 'conflict' }
  | { kind: 'unavailable' }
> {
  const table = idempotencyTable();
  if (!table) return { kind: 'unavailable' };
  const hash = hashPayload(input.payload);
  const where = {
    schoolConnectionId_operationType_idempotencyKey: {
      schoolConnectionId: input.connectionId,
      operationType: input.operationType,
      idempotencyKey: input.idempotencyKey,
    },
  };
  const existing = await table.findUnique({ where });
  const decision = idempotencyDecision({ existing, payloadHash: hash });
  if (decision.kind === 'replay') {
    return { kind: 'replay', status: decision.responseStatus, body: decision.responseBody };
  }
  if (decision.kind === 'conflict') return { kind: 'conflict' };
  await table.create({
    data: {
      schoolConnectionId: input.connectionId,
      operationType: input.operationType,
      idempotencyKey: input.idempotencyKey,
      payloadHash: hash,
      responseStatus: input.responseStatus,
      responseBody: input.responseBody,
      correlationId: input.correlationId,
    },
  });
  return { kind: 'created', status: input.responseStatus, body: input.responseBody };
}

export async function acceptAvailability(input: {
  connectionId: string;
  listingId: string;
  correlationId: string | null;
  body: unknown;
}): Promise<{ status: number; body: unknown }> {
  const parsed = AvailabilityPut.safeParse(input.body);
  if (!parsed.success) {
    return {
      status: 422,
      body: {
        error: {
          code: 'invalid_body',
          message: 'Availability payload is invalid.',
          retryable: false,
        },
      },
    };
  }
  if (parsed.data.listing_id && parsed.data.listing_id !== input.listingId) {
    return {
      status: 403,
      body: {
        error: {
          code: 'connection_mismatch',
          message: 'School id does not match the connection.',
          retryable: false,
        },
      },
    };
  }
  let accepted = 0;
  let duplicates = 0;
  for (const window of parsed.data.windows) {
    const result = await claimOperation({
      connectionId: input.connectionId,
      operationType: 'availability',
      idempotencyKey: window.idempotency_key,
      payload: window,
      correlationId: input.correlationId,
      responseStatus: 200,
      responseBody: { window: window.idempotency_key },
    });
    if (result.kind === 'conflict') {
      return {
        status: 422,
        body: {
          error: {
            code: 'idempotency_key_conflict',
            message: 'Idempotency key was reused with a different payload.',
            retryable: false,
          },
        },
      };
    }
    if (result.kind === 'unavailable') {
      return {
        status: 503,
        body: {
          error: {
            code: 'not_available',
            message: 'Connectivity storage is unavailable.',
            retryable: true,
          },
        },
      };
    }
    if (result.kind === 'replay') duplicates += 1;
    else accepted += 1;
  }
  return { status: 200, body: { accepted, duplicates } };
}

export async function acceptContent(input: {
  connectionId: string;
  listingId: string;
  body: unknown;
}): Promise<{ status: number; body: unknown }> {
  const parsed = ContentPut.safeParse(input.body);
  if (!parsed.success) {
    return {
      status: 422,
      body: {
        error: { code: 'invalid_body', message: 'Content payload is invalid.', retryable: false },
      },
    };
  }
  if (parsed.data.listing_id && parsed.data.listing_id !== input.listingId) {
    return {
      status: 403,
      body: {
        error: {
          code: 'connection_mismatch',
          message: 'School id does not match the connection.',
          retryable: false,
        },
      },
    };
  }
  const drafts = (
    prisma as unknown as {
      connectionContentDraft?: { create: (args: unknown) => Promise<unknown> };
    }
  ).connectionContentDraft;
  if (!drafts) {
    return {
      status: 503,
      body: {
        error: {
          code: 'not_available',
          message: 'Connectivity storage is unavailable.',
          retryable: true,
        },
      },
    };
  }
  await drafts.create({
    data: {
      schoolConnectionId: input.connectionId,
      payload: parsed.data,
      payloadHash: hashPayload(parsed.data),
      publishedAt: null,
    },
  });
  return { status: 200, body: { stored: true, published: false } };
}

export async function acceptInboundEvent(input: {
  connectionId: string;
  body: unknown;
}): Promise<{ status: number; body: unknown; retryAfterSeconds?: number }> {
  const parsed = InboundEvent.safeParse(input.body);
  if (!parsed.success) {
    return {
      status: 422,
      body: {
        error: { code: 'invalid_body', message: 'Event payload is invalid.', retryable: false },
      },
    };
  }
  const result = await receiveInboxEvent({
    connectionId: input.connectionId,
    providerEventId: parsed.data.event_id,
    eventType: parsed.data.type,
    externalRef: parsed.data.vendor_reservation_ref,
    revision: parsed.data.revision ?? null,
    occurredAt: parsed.data.occurred_at ? new Date(parsed.data.occurred_at) : null,
    payload: parsed.data.payload,
  });
  if (result.httpStatus === 429) {
    return {
      status: 429,
      retryAfterSeconds: 30,
      body: { error: { code: 'not_accepted', message: 'Event was not stored.', retryable: true } },
    };
  }
  return { status: result.httpStatus, body: result.body };
}

export async function recordProductionAttempt(input: {
  connectionId: string;
  evidenceSource: 'mock' | 'vendor_environment';
}): Promise<{ status: number; body: unknown }> {
  const decision = productionEnablementDecision(input.evidenceSource);
  if (decision.recorded) {
    const readiness = (
      prisma as unknown as { connectionReadiness?: { upsert: (args: unknown) => Promise<unknown> } }
    ).connectionReadiness;
    if (readiness) {
      await readiness.upsert({
        where: { schoolConnectionId: input.connectionId },
        create: { schoolConnectionId: input.connectionId, evidenceSource: input.evidenceSource },
        update: { evidenceSource: input.evidenceSource },
      });
    }
  }
  if (decision.recorded) {
    return {
      status: decision.httpStatus,
      body: { recorded: true, prodEnabled: false, code: decision.code },
    };
  }
  return {
    status: decision.httpStatus,
    body: {
      error: {
        code: decision.code,
        message: 'Mock evidence cannot enable production.',
        retryable: false,
      },
      prodEnabled: false,
    },
  };
}
