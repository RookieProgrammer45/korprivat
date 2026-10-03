import 'server-only';
import { NextResponse } from 'next/server';
import { OrgRegisterRequest, OrgRegisterResponse } from '@/lib/contracts/orgs';
import { prisma } from '@/lib/db';
import {
  createOrganization,
  OrgAlreadyExistsError,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  if (!user.emailVerified) {
    return NextResponse.json({ error: 'email_unverified' }, { status: 403 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { userId: true },
  });
  if (!profile) {
    return NextResponse.json({ error: 'profile_required' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = OrgRegisterRequest.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  try {
    const { organization, membership } = await createOrganization({
      name: parsed.data.name,
      organizationNumber: parsed.data.organizationNumber,
      city: parsed.data.city,
      address: parsed.data.address,
      postcode: parsed.data.postcode,
      ownerUserId: user.id,
      ownerEmail: user.email,
    });
    return NextResponse.json(
      OrgRegisterResponse.parse({
        organizationId: organization.id,
        membershipId: membership.id,
        slug: organization.slug,
      }),
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof OrgAlreadyExistsError) {
      return NextResponse.json({ error: 'org_exists' }, { status: 409 });
    }
    const { reportError } = await import('@/lib/observability/report-error');
    await reportError(err, { tags: { area: 'orgs', route: 'register' } });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
