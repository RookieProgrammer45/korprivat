import 'server-only';
import { prisma } from '@/lib/db';
import {
  decideInboxEvent,
  failureDisposition,
  payloadHash,
  quarantineRelease,
  redactPayload,
} from '@/lib/reliability/inbox-policy';

type InboxBody = {
  status: 'rejected_duplicate' | 'rejected_stale' | 'authoritative_retrieval_required' | 'received';
};

export type InboxResult =
  | { httpStatus: 202; body: InboxBody }
  | { httpStatus: 404; body: { error: { code: 'not_found' } } }
  | { httpStatus: 429; body: { error: { code: 'not_accepted' } } };

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error != null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

export async function receiveInboxEvent(input: {
  connectionId: string;
  providerEventId: string;
  eventType: string;
  externalRef?: string | null;
  revision?: number | null;
  occurredAt?: Date | null;
  payload?: unknown;
}): Promise<InboxResult> {
  const connections = (
    prisma as unknown as {
      schoolConnection?: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          eventWatermarkRevision: number | null;
          eventWatermarkAt: Date | null;
        } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
      bookingEvent?: {
        create: (args: unknown) => Promise<{ id: string }>;
        update: (args: unknown) => Promise<unknown>;
      };
    }
  ).schoolConnection;
  const events = (
    prisma as unknown as {
      bookingEvent?: {
        create: (args: unknown) => Promise<{ id: string }>;
        update: (args: unknown) => Promise<unknown>;
      };
    }
  ).bookingEvent;
  if (!connections || !events) {
    return { httpStatus: 429, body: { error: { code: 'not_accepted' } } };
  }
  const connection = await connections.findUnique({
    where: { id: input.connectionId },
    select: { id: true, eventWatermarkRevision: true, eventWatermarkAt: true },
  });
  if (!connection) return { httpStatus: 404, body: { error: { code: 'not_found' } } };

  const revision = input.revision ?? null;
  const occurredAt = input.occurredAt ?? null;
  let created: { id: string };
  try {
    created = await events.create({
      data: {
        schoolConnectionId: connection.id,
        providerEventId: input.providerEventId,
        externalRef: input.externalRef ?? null,
        eventType: input.eventType,
        payloadHash: payloadHash(input.payload ?? null),
        revision,
        occurredAt,
        processingStatus: 'received',
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { httpStatus: 202, body: { status: 'rejected_duplicate' } };
    }
    return { httpStatus: 429, body: { error: { code: 'not_accepted' } } };
  }

  const action = decideInboxEvent({
    duplicate: false,
    revision,
    occurredAt,
    watermarkRevision: connection.eventWatermarkRevision,
    watermarkAt: connection.eventWatermarkAt,
  });
  if (action === 'rejected_stale') {
    await events.update({
      where: { id: created.id },
      data: { processingStatus: 'rejected_stale' },
    });
    return { httpStatus: 202, body: { status: 'rejected_stale' } };
  }
  if (action === 'authoritative_retrieval') {
    await events.update({
      where: { id: created.id },
      data: { disposition: 'authoritative_required' },
    });
    return { httpStatus: 202, body: { status: 'authoritative_retrieval_required' } };
  }
  await events.update({
    where: { id: created.id },
    data: { processingStatus: 'applied' },
  });
  await connections.update({
    where: { id: connection.id },
    data: {
      eventWatermarkRevision: revision ?? connection.eventWatermarkRevision,
      eventWatermarkAt: occurredAt ?? connection.eventWatermarkAt,
    },
  });
  return { httpStatus: 202, body: { status: 'received' } };
}

type OutboxRow = {
  id: string;
  commandType: string;
  attemptCount: number;
  payload: unknown;
  quarantineResourceRef: string | null;
};

export async function tickOutbox(
  now = new Date(),
): Promise<{ processed: number; deadLettered: number }> {
  const client = prisma as unknown as {
    commandOutbox?: {
      findMany: (args: unknown) => Promise<OutboxRow[]>;
      update: (args: unknown) => Promise<unknown>;
    };
    opsTask?: { create: (args: unknown) => Promise<unknown> };
  };
  if (!client.commandOutbox) return { processed: 0, deadLettered: 0 };
  const due = await client.commandOutbox.findMany({
    where: {
      state: { in: ['pending', 'claimed'] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
  });
  let deadLettered = 0;
  for (const row of due) {
    if (row.commandType === 'native_state') {
      await client.commandOutbox.update({
        where: { id: row.id },
        data: { state: 'delivered', leaseExpiresAt: null },
      });
      continue;
    }
    const attemptCount = row.attemptCount + 1;
    const disposition = failureDisposition(attemptCount);
    if (disposition.deadLetter) {
      deadLettered += 1;
      await client.commandOutbox.update({
        where: { id: row.id },
        data: {
          attemptCount,
          state: 'failed_terminal',
          outcome: 'unresolved',
          deadLetterAt: now,
          nextRetryAt: null,
          leaseExpiresAt: null,
          redactedPayload: redactPayload(row.payload),
        },
      });
      if (client.opsTask) {
        await client.opsTask.create({
          data: {
            bookingId: null,
            kind: 'outbox_dead_letter',
            allowedActions: ['authoritative_reconcile', 'audited_release'],
            state: 'open',
          },
        });
      }
      continue;
    }
    await client.commandOutbox.update({
      where: { id: row.id },
      data: {
        attemptCount,
        state: 'pending',
        outcome: 'unresolved',
        nextRetryAt: new Date(now.getTime() + disposition.nextDelayMs),
        leaseExpiresAt: null,
      },
    });
  }
  return { processed: due.length, deadLettered };
}

export async function resolveOutboxCommand(input: {
  id: string;
  kind: 'ttl_expired' | 'retry_exhausted' | 'authoritative' | 'audited_decision';
  rationale?: string | null;
  resolutionRef?: string | null;
}): Promise<{ httpStatus: number; body: Record<string, unknown> }> {
  const decision = quarantineRelease(input);
  const commands = (
    prisma as unknown as {
      commandOutbox?: {
        findUnique: (args: unknown) => Promise<{ id: string } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    }
  ).commandOutbox;
  if (!commands) return { httpStatus: 429, body: { error: { code: 'not_accepted' } } };
  const row = await commands.findUnique({ where: { id: input.id }, select: { id: true } });
  if (!row) return { httpStatus: 404, body: { error: { code: 'not_found' } } };
  if (!decision.release) {
    return { httpStatus: 409, body: { error: { code: 'quarantine_held' } } };
  }
  await commands.update({
    where: { id: row.id },
    data: {
      resolutionKind: input.kind,
      resolutionRef: input.resolutionRef ?? null,
      resolutionRationale: input.rationale ?? null,
      outcome: 'not_confirmed',
    },
  });
  return { httpStatus: 200, body: { id: row.id, released: true } };
}
