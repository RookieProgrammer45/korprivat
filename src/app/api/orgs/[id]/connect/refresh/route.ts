// POST /api/orgs/[id]/connect/refresh — sync Connect flags from Stripe.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  ConnectNotConfiguredError,
  ConnectOrgNotFoundError,
  refreshConnectStatus,
} from '@/lib/payments/connect';
import {
  assertActiveOwner,
  OrgForbiddenError,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { id: orgId } = await context.params;

  try {
    await assertActiveOwner(orgId, user.id);
    const status = await refreshConnectStatus(orgId);
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof ConnectOrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof ConnectNotConfiguredError) {
      return NextResponse.json({ error: 'payments_not_enabled' }, { status: 403 });
    }
    console.error('[orgs/connect/refresh] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
