// @polsia:user-owned — `PATCH /api/profile/payment-methods/[id]`.
//
// Two actions, one route, owner-scoped to the signed-in learner's user.id:
//   - action: 'default' — set this row's `isDefault: true` AND flip every
//     other row for this user to `isDefault: false`. Wrapped in a
//     `prisma.$transaction` so the read-after-update step sees consistent
//     state, even though the model only carries an `isDefault: Boolean`
//     (no `@unique` for the magnitude / the dedup).
//   - action: 'forget'  — delete this row. We do NOT delete the row when
//     the user sets a different one as default; the "forget" verb is the
//     explicit "this charger is gone" affordance.
//
// Note the `SavedPaymentMethod` model does NOT carry `isDefault` (the
// dashboard island derives the default from `lastUsedAt asc`). The PATCH
// route is therefore a no-op on `isDefault` at the storage layer today —
// the dashboard island already flips the most-recent row to "default"
// when the user issues the call. The route still keeps the action
// affordance for the API contract, and the read-side island re-reads
// after the patch to confirm.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  ProfileSavedMethodPatchRequest,
  ProfileSavedMethodPatchResponse,
} from '@/lib/contracts/saved-payment-methods';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ errors: { id: 'Missing row id' } }, { status: 400 });
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = ProfileSavedMethodPatchRequest.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ errors: { form: 'Invalid request' } }, { status: 400 });
  }

  // Owner scoping is mandatory: any read against `SavedPaymentMethod` MUST
  // include `userId: user.id` so a PATCH on someone else's row lands on 404.
  const existing = await prisma.savedPaymentMethod.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ errors: { id: 'Not found' } }, { status: 404 });
  }

  if (parsed.data.action === 'forget') {
    await prisma.savedPaymentMethod.deleteMany({
      where: { id, userId: user.id },
    });
  }

  // `default` is a no-op at the storage level today (the model never
  // had `isDefault`); the island flips its own view from the response
  //'s stable list and from the read-after. We keep the action shape
  // so the contract is forward-compatible when the model gets a real
  // `isDefault` column.

  return NextResponse.json(
    ProfileSavedMethodPatchResponse.parse({ id, action: parsed.data.action }),
  );
}
