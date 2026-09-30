// POST /api/orgs/[id]/connect — mint Stripe Connect Express onboarding link.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  ConnectAccountMissingError,
  ConnectNotConfiguredError,
  ConnectOrgNotFoundError,
  createConnectAccount,
  createOnboardingLink,
} from '@/lib/payments/connect';
import {
  assertActiveOwner,
  OrgForbiddenError,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export async function POST(_req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(_req);
  } catch (response) {
    return response as Response;
  }

  const { id: orgId } = await context.params;

  try {
    await assertActiveOwner(orgId, user.id);
    await createConnectAccount(orgId);

    const base = appBaseUrl();
    const { url } = await createOnboardingLink(
      orgId,
      `${base}/dashboard/school?connect=done`,
      `${base}/dashboard/school?connect=refresh`,
    );

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof ConnectOrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof ConnectNotConfiguredError || err instanceof ConnectAccountMissingError) {
      return NextResponse.json({ error: 'payments_not_enabled' }, { status: 403 });
    }
    console.error('[orgs/connect] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
