//
// vi.hoisted runs BEFORE vi.mock factory bodies (both at the top of the
// file). We bundle the entire `prisma` singleton — every model the booking
// + auth flow touches — into one hoisted object so any `vi.mock('@/lib/db',
// …)` factory can refer to it without a top-level `const prisma = …`
// variable that vitest flags as uninitialized.
//
// Each model method gets a DEFENSIVE DEFAULT IMPLEMENTATION (resolves to
// a `Promise`-safe value) so the route handlers can `await` the result
// safely when a test forgets to queue a return value.
//   - findUnique / findFirst → null (treat missing = "not found")
//   - findMany               → []
//   - create                 → { id, ...input } (handler treats result as opaque)
//   - update / updateMany    → { count: 1 } (handler branches on count===0
//                                       for race guards)
//   - upsert                 → {}
//   - delete                 → { count: 1 }
// Tests override per-case via `mockResolvedValueOnce`; `resetPrisma()`
// does a full mockReset (clears call history AND the once-queue) so stale
// values from a short-circuited route call cannot bleed into the next
// test, then re-attaches the safe defaults.
//
// biome: this file is OUTSIDE the overrides' src/** glob so biome's default
// rule set applies. We do not import @/lib/db directly here.

import { createHash } from 'node:crypto';
import { vi } from 'vitest';

const prisma = vi.hoisted(() => {
  // We can call vi.fn() but cannot call `.mockImplementation()` from inside
  // vi.hoisted: vitest's Mock<Procedure> type narrows aggressively and
  // forbids reassigning the impl with a custom signature. So the default
  // implementation is set here WITHOUT `mockImplementation(...args)`, and
  // `resetPrisma()` (which runs OUTSIDE vi.hoisted, after vitest is fully
  // typed) is responsible for restoring them.
  return {
    receiptStore: new Map<string, Record<string, unknown>>(),
    userProfile: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (_args?: unknown): Promise<unknown> => ({})),
    },
    photoVerification: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (_args?: unknown): Promise<unknown> => ({})),
    },
    user: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      delete: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    account: {
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      delete: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    session: {
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      delete: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    instructor: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 0 })),
    },
    booking: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    bookingReceipt: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_receipt', ...((args as object) ?? {}) })),
    },
    dispute: {
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    lateCancellationFee: {
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    availabilitySlot: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (_args?: unknown): Promise<unknown> => ({})),
    },
    organization: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 0 })),
    },
    payoutRecord: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_payout', ...((args as object) ?? {}) })),
    },
    subscription: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (_args?: unknown): Promise<unknown> => ({})),
    },
    review: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
    },
    instructorLicense: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (_args?: unknown): Promise<unknown> => ({})),
    },
    clickwrapAcceptance: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({ id: 'mock_created', ...((args as object) ?? {}) })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      updateMany: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
      upsert: vi.fn(async (_args?: unknown): Promise<unknown> => ({})),
    },
    conversation: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({
        id: 'conversation_created',
        ...((args as object) ?? {}),
      })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    conversationParticipant: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({
        id: 'participant_created',
        ...((args as object) ?? {}),
      })),
      update: vi.fn(async (_args?: unknown): Promise<unknown> => ({ count: 1 })),
    },
    message: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      count: vi.fn(async (_args?: unknown) => 0),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({
        id: 'message_created',
        ...((args as object) ?? {}),
      })),
    },
    messageReport: {
      findUnique: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findFirst: vi.fn(async (_args?: unknown): Promise<unknown> => null),
      findMany: vi.fn(async (_args?: unknown): Promise<unknown> => []),
      create: vi.fn(async (args: unknown): Promise<unknown> => ({
        id: 'report_created',
        ...((args as object) ?? {}),
      })),
    },
    $transaction: vi.fn(async (...args: unknown[]) => {
      if (typeof args[0] === 'function') {
        return (args[0] as (tx: unknown) => Promise<unknown>)(prisma);
      }
      const all = await Promise.all(args[0] as Array<Promise<unknown>>);
      return all;
    }),
  };
});

vi.mock('@/lib/db', () => ({ prisma }));

export const prismaMock = prisma;

export const TEST_LEARNER_ACCESS_TOKEN = 'learner-token';

function testLearnerAccessTokenHash(): string {
  return createHash('sha256').update(TEST_LEARNER_ACCESS_TOKEN, 'utf8').digest('hex');
}

/** Records a Booking-shaped row helpful for assertions. */
export function bookingRow(
  overrides: Partial<{
    id: string;
    instructorId: string;
    studentName: string;
    studentEmail: string;
    studentPhone: string;
    category: string;
    slotId: string | null;
    userId: string | null;
    preferredAt: Date;
    paymentStatus: string | null;
    stripeCheckoutSessionId: string | null;
    stripeSessionId: string | null;
    paidAt: Date | null;
    actionToken: string | null;
    learnerAccessTokenHash: string | null;
    heldAt: Date | null;
    completedAt: Date | null;
    completedByLabel: string | null;
    deliveredAt: Date | null;
    confirmedAt: Date | null;
    autoReleaseAt: Date | null;
    disputeOpenedAt: Date | null;
    payoutReleasedAt: Date | null;
    releasedByLabel: string | null;
    disputeStatus: string | null;
    cancellationOutcome: string | null;
    cancelledAt: Date | null;
    cancelledByRole: string | null;
    cancelledByLabel: string | null;
    cancellationPolicyTier: string | null;
    bookingMode: string | null;
    priceAmountSek: number | null;
    serviceFeeSek: number | null;
    grossChargedSek: number | null;
  }> = {},
) {
  return {
    id: 'booking_abc123',
    instructorId: 'instructor_erik',
    studentName: 'Test Learner',
    studentEmail: 'learner@example.test',
    studentPhone: '+46700000000',
    category: 'B',
    slotId: 'slot_1',
    userId: null,
    preferredAt: new Date('2026-08-10T14:30:00.000Z'),
    paymentStatus: null,
    stripeCheckoutSessionId: null,
    stripeSessionId: null,
    paidAt: null,
    actionToken: null,
    learnerAccessTokenHash: testLearnerAccessTokenHash(),
    heldAt: null,
    completedAt: null,
    completedByLabel: null,
    deliveredAt: null,
    confirmedAt: null,
    autoReleaseAt: null,
    disputeOpenedAt: null,
    payoutReleasedAt: null,
    releasedByLabel: null,
    disputeStatus: null,
    cancellationOutcome: null,
    cancelledAt: null,
    cancelledByRole: null,
    cancelledByLabel: null,
    cancellationPolicyTier: 'flexible',
    bookingMode: 'instant',
    priceAmountSek: null,
    serviceFeeSek: null,
    grossChargedSek: null,
    ...overrides,
  };
}

/** Records an Instructor-shaped row that fits both the public InstructorItem
 *  contract and the SERVER-ONLY helper routes that need `email`/`hourlyRateSek`. */
export function instructorRow(
  overrides: Partial<{
    id: string;
    name: string;
    city: string;
    categories: string[];
    hourlyRateSek: number;
    email: string | null;
    serviceArea: string | null;
    englishSpeaking: boolean;
    userId: string | null;
    cancellationPolicyTier: string | null;
    bookingMode: 'instant' | 'request' | null;
  }> = {},
) {
  return {
    id: 'instructor_erik',
    name: 'Erik Lindqvist',
    city: 'Stockholm',
    categories: ['B', 'A2'],
    hourlyRateSek: 550,
    email: 'erik@drivelinkup.test',
    serviceArea: 'Stockholm med omnejd',
    englishSpeaking: true,
    userId: null,
    cancellationPolicyTier: 'flexible',
    bookingMode: 'instant',
    ...overrides,
  };
}

const DEFAULT_IMPLS: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  findOne: async () => null,
  findMany: async () => [],
  create: async (args: unknown) => ({ id: 'mock_created', ...((args as object) ?? {}) }),
  update: async () => ({ count: 1 }),
  updateMany: async () => ({ count: 1 }),
  upsert: async () => ({}),
  remove: async () => ({ count: 1 }),
};

function kindFor(method: string): keyof typeof DEFAULT_IMPLS | null {
  if (method === 'findUnique' || method === 'findFirst') return 'findOne';
  if (method === 'findMany') return 'findMany';
  if (method === 'create') return 'create';
  if (method === 'update') return 'update';
  if (method === 'updateMany') return 'updateMany';
  if (method === 'upsert') return 'upsert';
  if (method === 'delete') return 'remove';
  return null;
}

/**
 * Reset every mock fn to the safe default implementation AND clear the
 * `mockResolvedValueOnce` queue — the latter is the trap: a route call
 * that short-circuits (e.g. 400 parse failure) leaves the queued value
 * unconsumed and the next test quietly gets it. `mockReset` clears
 * everything in one step.
 */
export function resetPrisma(): void {
  prisma.receiptStore.clear();
  for (const [key, model] of Object.entries(prisma)) {
    if (!model || typeof model !== 'object') continue;
    if (key === '$transaction') {
      // The transaction shape varies (single op, array of ops, or interactive
      // callback); we accept the simplest "all promises resolve, return
      // values in order" behaviour. Tests override when they need a
      // simulated transaction conflict.
      const fn = model as unknown as {
        mockReset: () => void;
        mockImplementation: (impl: unknown) => void;
      };
      fn.mockReset();
      fn.mockImplementation(prismaTransactionDefault);
      continue;
    }
    for (const [method, fn] of Object.entries(
      model as unknown as Record<
        string,
        {
          mockReset?: () => void;
          mockImplementation?: (impl: (...args: unknown[]) => unknown) => void;
        }
      >,
    )) {
      if (typeof fn?.mockReset !== 'function') continue;
      fn.mockReset();
      const kind = kindFor(method);
      if (kind !== null && typeof fn.mockImplementation === 'function') {
        fn.mockImplementation(DEFAULT_IMPLS[kind] as (...args: unknown[]) => unknown);
      }
    }
  }
  restoreBookingReceiptDefaults();
}

function restoreBookingReceiptDefaults(): void {
  const receipts = prisma.receiptStore;
  type MockWithArgs = {
    mockImplementation: (implementation: (args: unknown) => Promise<unknown>) => void;
  };
  const findUnique = prisma.bookingReceipt.findUnique as unknown as MockWithArgs;
  const findMany = prisma.bookingReceipt.findMany as unknown as MockWithArgs;
  const upsert = prisma.bookingReceipt.upsert as unknown as MockWithArgs;
  const updateMany = prisma.bookingReceipt.updateMany as unknown as MockWithArgs;
  findUnique.mockImplementation(async (args: unknown) => {
    const where = (args as { where?: Record<string, unknown> }).where ?? {};
    const compound = where.bookingId_recipientRole as
      | { bookingId: string; recipientRole: string }
      | undefined;
    if (compound)
      return receipts.get(receiptKey(compound.bookingId, compound.recipientRole)) ?? null;
    if (typeof where.id === 'string') {
      return Array.from(receipts.values()).find((row) => row.id === where.id) ?? null;
    }
    return null;
  });
  findMany.mockImplementation(async (args: unknown) => {
    const where = (args as { where?: Record<string, unknown> }).where ?? {};
    return Array.from(receipts.values()).filter((row) => matchesReceiptWhere(row, where));
  });
  upsert.mockImplementation(async (args: unknown) => {
    const input = args as {
      where: { bookingId_recipientRole: { bookingId: string; recipientRole: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    const key = receiptKey(
      input.where.bookingId_recipientRole.bookingId,
      input.where.bookingId_recipientRole.recipientRole,
    );
    const row = {
      id: receipts.get(key)?.id ?? `mock_receipt_${receipts.size + 1}`,
      ...(receipts.get(key) ?? {}),
      ...input.create,
      ...input.update,
    };
    receipts.set(key, row);
    return row;
  });
  updateMany.mockImplementation(async (args: unknown) => {
    const input = args as { where: Record<string, unknown>; data: Record<string, unknown> };
    let count = 0;
    for (const [key, row] of receipts) {
      if (!matchesReceiptWhere(row, input.where)) continue;
      receipts.set(key, { ...row, ...input.data });
      count += 1;
    }
    return { count };
  });
}

function receiptKey(bookingId: string, recipientRole: string): string {
  return `${bookingId}:${recipientRole}`;
}

function matchesReceiptWhere(
  row: Record<string, unknown>,
  where: Record<string, unknown>,
): boolean {
  if (typeof where.id === 'string' && row.id !== where.id) return false;
  if (typeof where.bookingId === 'string' && row.bookingId !== where.bookingId) return false;
  if (typeof where.recipientRole === 'string' && row.recipientRole !== where.recipientRole)
    return false;
  if (Array.isArray(where.OR)) {
    const matchesOr = (where.OR as Array<Record<string, unknown>>).some((condition) =>
      matchesReceiptWhere(row, condition),
    );
    if (!matchesOr) return false;
  }
  for (const [field, expected] of Object.entries(where)) {
    if (field === 'id' || field === 'bookingId' || field === 'recipientRole' || field === 'OR')
      continue;
    const actual = row[field];
    if (expected && typeof expected === 'object') {
      const condition = expected as { in?: unknown[]; lt?: unknown };
      if (condition.in && !condition.in.includes(actual)) return false;
      if (condition.lt && (!(actual instanceof Date) || actual >= condition.lt)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }
  return true;
}

async function prismaTransactionDefault(...args: unknown[]): Promise<unknown> {
  // Interactive transaction callback: prisma.$transaction(async (tx) => {…})
  // resolves whatever the callback returns.
  if (typeof args[0] === 'function') {
    return (args[0] as (tx: unknown) => Promise<unknown>)(prisma);
  }
  // Array of ops: $transaction([ opA, opB, opC ]) → Promise.all.
  if (Array.isArray(args[0])) {
    return Promise.all(args[0] as Array<Promise<unknown>>);
  }
  // Single op: $transaction(op) → just await it.
  return args[0];
}
