import 'server-only';
import { NextResponse } from 'next/server';
import { getLocale } from 'next-intl/server';
import { OrgInviteRequest, OrgInviteResponse } from '@/lib/contracts/orgs';
import { orgInviteEmail } from '@/lib/email/org-invite';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';
import {
  getOrganizationById,
  inviteMember,
  OrgForbiddenError,
  OrgMemberAlreadyExistsError,
  OrgNotFoundError,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = OrgInviteRequest.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  try {
    const { invite, inviteToken } = await inviteMember(
      orgId,
      parsed.data.email,
      parsed.data.role,
      user.id,
    );
    const org = await getOrganizationById(orgId);
    const locale = ((await getLocale()) === 'en' ? 'en' : 'sv') as 'sv' | 'en';
    const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
    const mail = orgInviteEmail({
      orgName: org?.name ?? 'DriveLinkUp',
      inviteUrl: `${base}/invite/${inviteToken}`,
      locale,
    });
    await sendEmail({ to: invite.email, ...mail });

    return NextResponse.json(
      OrgInviteResponse.parse({ inviteId: invite.id, email: invite.email }),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgMemberAlreadyExistsError) {
      return NextResponse.json({ error: 'already_member' }, { status: 409 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[orgs/invites] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
