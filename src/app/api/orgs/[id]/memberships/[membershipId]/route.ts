import 'server-only';
import { NextResponse } from 'next/server';
import {
  OrgForbiddenError,
  OrgNotFoundError,
  revokeMembership,
} from '@/lib/orgs/service';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; membershipId: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { id: orgId, membershipId } = await context.params;

  try {
    const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!membership || membership.organizationId !== orgId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    await revokeMembership(membershipId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[orgs/memberships/revoke] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
