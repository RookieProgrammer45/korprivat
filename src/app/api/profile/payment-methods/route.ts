//
// Per-user list of `SavedPaymentMethod` rows the dashboard renders on
// the "payment methods" page. Owner-scoped via `requireAuth(req)` +
// `where: { userId: user.id }` so a learner can never read another
// learner's row.
//
// The reading shape is the same data the `GET /api/profile/me` envelope
// carries — same `SavedPaymentMethodItem` contract. We deliberately
// expose one separate endpoint as well so the dashboard island can
// revalidate only the saved-method panel after a `set-default` PATCH
// without refetching the whole `lastInstructors` render (route splits
// let us keep the islands narrowly scoped to one fetch each).

import 'server-only';
import { NextResponse } from 'next/server';
import { SavedPaymentMethodList } from '@/lib/contracts/saved-payment-methods';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.savedPaymentMethod.findMany({
    where: { userId: user.id },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      customerEmail: true,
      brand: true,
      last4: true,
      lastUsedAt: true,
    },
  });

  // `isDefault` is a UI affordance, not a stored column on this model —
  // it's the MOST-recent (desc-sorted) row by `lastUsedAt`. The user can
  // change it via PATCH /api/profile/payment-methods/[id]. Until then,
  // the dashboard island picks the same row that the user would receive
  // from a `set-default` call.
  const items = rows.map((r, i) => ({
    id: r.id,
    customerEmail: r.customerEmail,
    brand: r.brand,
    last4: r.last4 ?? null,
    lastUsedAt: r.lastUsedAt.toISOString(),
    isDefault: i === 0,
  }));

  return NextResponse.json(SavedPaymentMethodList.parse({ items }));
}
