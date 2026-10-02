//
// "The signed-in instructor's row". Authed, scoped by `userId` —
// `requireAuth` is the gate; we look up the Instructor row whose `userId`
// matches the session and only operate on that one row. Use cases:
//
//   GET   — drives the dashboard's `<InstructorPolicyEditor/>` mount so
//           the editor shows the current tier on first paint (and so the
//           editor can compute "you don't have an instructor row yet" 404).
//   PATCH — the editor saves the cancellation-policy tier; persist it
//           onto `Instructor.cancellationPolicyTier` and return the saved
//           row id + tier.
//
// Errors:
//   401 — caller is not signed in (handled in `requireAuth`).
//   404 — caller has no Instructor row linked by `userId`. Tells the
//         editor to prompt them to finish onboarding first (the editor
//         already has its own "complete onboarding first" path, so this
//         just lands in the same error envelope).
//
// Server-only route — `import 'server-only'` keeps DB / requireAuth out
// of any client bundle that accidentally imports this file.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import { providerTimezoneForCity } from '@/lib/business/provider-timezone';
import {
  InstructorMe,
  InstructorPolicyUpdate,
  InstructorPolicyUpdated,
} from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

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
    return NextResponse.json(
      { errors: { id: 'No instructor row for this account' } },
      { status: 404 },
    );
  }

  const [connectRow, openSlot] = await Promise.all([
    prisma.instructor.findUnique({
      where: { id: instructor.id },
      select: { chargesEnabled: true, payoutsEnabled: true },
    }),
    prisma.availabilitySlot.findFirst({
      where: {
        instructorId: instructor.id,
        bookedAt: null,
        startsAt: { gt: new Date() },
      },
      select: { id: true },
    }),
  ]);

  const profileReady =
    instructor.name.trim().length > 0 &&
    instructor.city.trim().length > 0 &&
    instructor.categories.length > 0;
  const connectReady = Boolean(
    connectRow?.chargesEnabled && connectRow?.payoutsEnabled,
  );
  const hasAvailability = openSlot != null;

  return NextResponse.json(
    InstructorMe.parse({
      id: instructor.id,
      name: instructor.name,
      city: instructor.city,
      hourlyRateSek: instructor.hourlyRateSek,
      cancellationPolicyTier:
        instructor.cancellationPolicyTier === 'moderate' ||
        instructor.cancellationPolicyTier === 'strict' ||
        instructor.cancellationPolicyTier === 'flexible'
          ? instructor.cancellationPolicyTier
          : 'flexible',
      bookingMode: instructor.bookingMode === 'request' ? 'request' : 'instant',
      providerRole: instructor.providerRole,
      timezone: providerTimezoneForCity(instructor.city),
      // Licence stays a separate banner gate; setupComplete tracks
      // listing profile + Connect + published availability.
      setupComplete: profileReady && connectReady && hasAvailability,
      canManageAvailability: true,
    }),
    { status: 200 },
  );
}

export async function PATCH(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = InstructorPolicyUpdate.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  let existing: OwnedProvider | null;
  try {
    existing = await resolveOwnedProvider(user);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return NextResponse.json(
        { errors: { id: 'Provider ownership needs operator review.' } },
        { status: 409 },
      );
    }
    throw error;
  }
  if (!existing) {
    return NextResponse.json(
      { errors: { id: 'No instructor row for this account' } },
      { status: 404 },
    );
  }

  // Build the patch data off the parsed body so we can omit legacy fields
  // the caller didn't include (a body that sends ONLY bookingMode must
  // still commit without overwriting the existing cancellationPolicyTier).
  // `tier` is the original mechanic — every prior client sends it; treat
  // its absence here as "no change to tier".
  const data: {
    cancellationPolicyTier?: 'flexible' | 'moderate' | 'strict';
    bookingMode?: 'instant' | 'request';
  } = {};
  if (parsed.data.tier) data.cancellationPolicyTier = parsed.data.tier;
  if (parsed.data.bookingMode) data.bookingMode = parsed.data.bookingMode;

  const updated = await prisma.instructor.update({
    where: { id: existing.id },
    select: { id: true, cancellationPolicyTier: true, bookingMode: true },
    data,
  });

  return NextResponse.json(InstructorPolicyUpdated.parse(updated), { status: 200 });
}
