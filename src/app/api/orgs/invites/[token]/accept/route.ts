import 'server-only';
import { NextResponse } from 'next/server';
import {
  acceptInviteByToken,
  getInviteByToken,
  OrgForbiddenError,
  OrgNotFoundError,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { token } = await context.params;

  try {
    const invite = await getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!invite.acceptedAt && invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'expired' }, { status: 403 });
    }
    if (invite.email !== user.email.trim().toLowerCase()) {
      return NextResponse.json({ error: 'wrong_email' }, { status: 403 });
    }

    const result = await acceptInviteByToken(token, user.id, user.email);
    return NextResponse.json({ organizationId: result.organizationId });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[orgs/invites/accept] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
