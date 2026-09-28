import 'server-only';
import { NextResponse } from 'next/server';
import {
  cancelInvite,
  OrgForbiddenError,
  OrgNotFoundError,
} from '@/lib/orgs/service';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; inviteId: string }> };

export async function DELETE(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { id: orgId, inviteId } = await context.params;

  try {
    const invite = await prisma.membershipInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.organizationId !== orgId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    await cancelInvite(inviteId, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[orgs/invites/cancel] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
