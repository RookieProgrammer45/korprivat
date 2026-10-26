import 'server-only';
import { NextResponse } from 'next/server';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import { InstructorItem, PUBLIC_INSTRUCTOR_SELECT } from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { getActiveAffiliationForUser } from '@/lib/orgs/public';
import { loadListingSurfaces } from '@/lib/orgs/school-authorization';
import {
  isCancellationPolicyEnforced,
  listingHasActiveCancellationPolicy,
} from '@/lib/scheduling/cancellation-policy-store';
import {
  loadInstructorPaymentEligibility,
  maskSurfacesForPayment,
} from '@/lib/scheduling/listing-eligibility';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const instructor = await prisma.instructor.findUnique({
    where: { id },
    select: PUBLIC_INSTRUCTOR_SELECT,
  });
  if (!instructor) {
    // Same envelope the form's `applyServerErrors` consumes, so the client
    // island can detect "not found" without a bespoke shape.
    return NextResponse.json({ errors: { id: 'Not found' } }, { status: 404 });
  }
  if (!hasCanonicalCategory(instructor)) {
    return NextResponse.json({ errors: { id: 'Not found' } }, { status: 404 });
  }
  const [aggregates, affiliation] = await Promise.all([
    loadPublicInstructorAggregates([{ id: instructor.id, userId: instructor.userId }]),
    getActiveAffiliationForUser(instructor.userId),
  ]);
  const slot = prisma.availabilitySlot
    ? await prisma.availabilitySlot.findFirst({
        where: {
          instructorId: instructor.id,
          bookedAt: null,
          startsAt: { gt: new Date() },
        },
        orderBy: { startsAt: 'asc' },
        select: { startsAt: true },
      })
    : null;
  const aggregate = aggregates.get(instructor.id) ?? {
    verificationStatus: 'unverified' as const,
    reviewSummary: { count: 0, averageRating: null },
  };
  const payment = await loadInstructorPaymentEligibility({
    listingId: instructor.id,
    userId: instructor.userId,
    providerRole: instructor.providerRole,
  });
  const surfaces = maskSurfacesForPayment(
    await loadListingSurfaces(instructor.id, instructor.bookingMode),
    payment.allowed,
  );
  const nextSlotAt = surfaces.availabilityDisplay ? (slot?.startsAt.toISOString() ?? null) : null;
  const hidePolicy =
    isCancellationPolicyEnforced() && !(await listingHasActiveCancellationPolicy(instructor.id));
  return NextResponse.json(
    InstructorItem.parse({
      ...toPublicInstructor(instructor, aggregate, nextSlotAt),
      affiliation: affiliation ? { name: affiliation.name, slug: affiliation.slug } : null,
      canCollectPayment: payment.allowed,
      surfaces,
      ...(hidePolicy ? { cancellationPolicyTier: null, showCancellationPolicy: false } : {}),
    }),
  );
}
