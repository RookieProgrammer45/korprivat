//
// The signed-in instructor's own offerings (dashboard CRUD).
//   GET  — every offering row for the account (active AND hidden) so the
//          editor can manage history.
//   POST — create an offering; sortOrder lands after the current last row.
// Auth + ownership use the same requireAuth + resolveOwnedProvider gate as
// /api/instructors/me.
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TEACHING_CATEGORIES } from '@/lib/acquisition/claim-policy';
import {
  isSchoolMediatedInstructorsOn,
  offeringCategoryDecision,
} from '@/lib/acquisition/mediated-instructor-policy';
import { verifiedAffiliationForUser } from '@/lib/acquisition/mediated-instructor-store';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import { OfferingUpsert, OfferingUpserted, OwnOfferingList } from '@/lib/contracts/offerings';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const NO_ROW = { errors: { id: 'No instructor row for this account' } };

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  let instructor: OwnedProvider | null;
  try {
    instructor = await resolveOwnedProvider(user);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return NextResponse.json(
        { errors: { id: 'Provider ownership needs operator review.' } },
        { status: 409 },
      );
    }
    throw error;
  }
  if (!instructor) {
    return NextResponse.json(NO_ROW, { status: 404 });
  }
  const rows = await prisma.offering.findMany({
    where: { instructorId: instructor.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      kind: true,
      name: true,
      description: true,
      priceSek: true,
      sessions: true,
      weeks: true,
      active: true,
    },
  });
  return NextResponse.json(OwnOfferingList.parse({ items: rows }), { status: 200 });
}

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  let instructor: OwnedProvider | null;
  try {
    instructor = await resolveOwnedProvider(user);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return NextResponse.json(
        { errors: { id: 'Provider ownership needs operator review.' } },
        { status: 409 },
      );
    }
    throw error;
  }
  if (!instructor) {
    return NextResponse.json(NO_ROW, { status: 404 });
  }
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = OfferingUpsert.safeParse(bodyJson);
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
  if (isSchoolMediatedInstructorsOn() && instructor.providerRole === 'INSTRUCTOR') {
    const categories = z
      .object({ categories: z.array(z.enum(TEACHING_CATEGORIES)).optional() })
      .safeParse(bodyJson);
    const affiliation = await verifiedAffiliationForUser(user.id);
    const decision = offeringCategoryDecision({
      enforced: true,
      providerRole: instructor.providerRole,
      affiliationVerified: affiliation != null,
      offeringCategories: categories.success ? (categories.data.categories ?? []) : [],
      schoolCategories: affiliation?.teachingCategories ?? [],
    });
    if (!decision.allowed) {
      return NextResponse.json({ error: { code: decision.code } }, { status: 403 });
    }
  }
  const last = await prisma.offering.findFirst({
    where: { instructorId: instructor.id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });
  const created = await prisma.offering.create({
    data: {
      instructorId: instructor.id,
      kind: data.kind,
      name: data.name,
      description: data.description ?? null,
      priceSek: data.priceSek,
      sessions: data.sessions ?? null,
      weeks: data.weeks ?? null,
      active: data.active ?? true,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  return NextResponse.json(OfferingUpserted.parse({ id: created.id }), { status: 201 });
}
