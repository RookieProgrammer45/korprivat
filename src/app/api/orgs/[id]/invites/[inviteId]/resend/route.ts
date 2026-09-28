import 'server-only';
import { NextResponse } from 'next/server';
import { getLocale } from 'next-intl/server';
import { orgInviteEmail } from '@/lib/email/org-invite';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';
import {
  getOrganizationById,
  OrgForbiddenError,
  OrgNotFoundError,
  resendInvite,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; inviteId: string }> };

export async function POST(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { id: orgId, inviteId } = await context.params;

  try {
    const { invite, inviteToken } = await resendInvite(inviteId, user.id);
    if (invite.organizationId !== orgId) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const org = await getOrganizationById(orgId);
    const locale = ((await getLocale()) === 'en' ? 'en' : 'sv') as 'sv' | 'en';
    const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    const mail = orgInviteEmail({
      orgName: org?.name ?? 'DriveLinkUp',
      inviteUrl: `${base}/invite/${inviteToken}`,
      locale,
    });
    await sendEmail({ to: invite.email, ...mail });
    return NextResponse.json({ inviteId: invite.id, email: invite.email });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[orgs/invites/resend] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
