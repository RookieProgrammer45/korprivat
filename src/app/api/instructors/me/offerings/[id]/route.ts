//
// One of the signed-in instructor's own offerings.
//   PATCH  — partial update (kind/name/description/price/sessions/weeks/
//            active). Ownership verified against the session's own row —
//            another provider's offering id is a plain 404.
//   DELETE — removes the row. OfferingRequest rows are self-contained
//            (scalar references + snapshots) so request history survives.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import { OfferingDeleted, OfferingUpsert, OfferingUpserted } from '@/lib/contracts/offerings';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const NO_ROW = { errors: { id: 'No instructor row for this account' } };
const NOT_FOUND = { errors: { id: 'Offering not found' } };

type Ctx = { params: Promise<{ id: string }> };

async function sessionInstructor(
  req: Request,
): Promise<{ instructor: OwnedProvider } | { response: Response }> {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return { response: res as Response };
  }
  let instructor: OwnedProvider | null;
  try {
    instructor = await resolveOwnedProvider(user);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return {
        response: NextResponse.json(
          { errors: { id: 'Provider ownership needs operator review.' } },
          { status: 409 },
        ),
      };
    }
    throw error;
  }
  if (!instructor) {
    return { response: NextResponse.json(NO_ROW, { status: 404 }) };
  }
  return { instructor };
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await sessionInstructor(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = OfferingUpsert.partial().safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }
  const data = parsed.data;
  // Empty-string description means "cleared" → persist NULL, not "".
  const description =
    data.description === undefined ? undefined : data.description === '' ? null : data.description;
  const existing = await prisma.offering.findFirst({
    where: { id, instructorId: auth.instructor.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }
  const updated = await prisma.offering.update({
    where: { id: existing.id },
    data: {
      kind: data.kind,
      name: data.name,
      description,
      priceSek: data.priceSek,
      sessions: data.sessions ?? undefined,
      weeks: data.weeks ?? undefined,
      active: data.active,
    },
    select: { id: true },
  });
  return NextResponse.json(OfferingUpserted.parse({ id: updated.id }), { status: 200 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await sessionInstructor(req);
  if ('response' in auth) return auth.response;
  const { id } = await ctx.params;
  const existing = await prisma.offering.findFirst({
    where: { id, instructorId: auth.instructor.id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }
  await prisma.offering.delete({ where: { id: existing.id } });
  return NextResponse.json(OfferingDeleted.parse({ ok: true }), { status: 200 });
}
