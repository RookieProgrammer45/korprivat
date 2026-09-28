import 'server-only';
import { NextResponse } from 'next/server';
import { OrgUpdateRequest } from '@/lib/contracts/orgs';
import {
  OrgForbiddenError,
  OrgNotFoundError,
  updateOrganization,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = OrgUpdateRequest.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ errors: { form: 'No fields to update' } }, { status: 400 });
  }

  try {
    const organization = await updateOrganization(id, user.id, parsed.data);
    return NextResponse.json({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      organizationNumber: organization.organizationNumber,
      address: organization.address,
      postcode: organization.postcode,
      city: organization.city,
      contactEmail: organization.contactEmail,
      contactPhone: organization.contactPhone,
      verificationState: organization.verificationState,
      updatedAt: organization.updatedAt.toISOString(),
    });
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    console.error('[orgs/patch] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
