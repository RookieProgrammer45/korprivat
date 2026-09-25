// @polsia:user-owned — single-slot PATCH/DELETE for the signed-in instructor.
//
// `PATCH /api/instructor-availability/[slotId]` nudges an open slot's
// `startsAt` / `endsAt`. `DELETE` removes an empty slot. Both are gated
// with `requireAuth` and re-derive the owning Instructor row — a slot
// addressed by an id the caller doesn't own returns 404.
//
// Booked slots are NOT editable / deletable: the learner already has a
// pending booking that resolves against this `startsAt`. Returning 409
// here is the safest move, and the editor renders the row read-only
// rather than disappearing from the list.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import { AvailabilitySlotUpdate } from '@/lib/contracts/availability';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function loadOwnedInstructor(user: SessionUser): Promise<OwnedProvider | null | Response> {
  try {
    return await resolveOwnedProvider(user);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return NextResponse.json({ errors: { ownership: error.message } }, { status: 409 });
    }
    throw error;
  }
}

async function loadOwnedSlot(instructorId: string, slotId: string) {
  return prisma.availabilitySlot.findFirst({
    where: { id: slotId, instructorId },
    select: {
      id: true,
      bookedAt: true,
      startsAt: true,
      endsAt: true,
    },
  });
}

type Ctx = { params: Promise<{ slotId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const { slotId } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = AvailabilitySlotUpdate.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) {
        errors[field] = message;
      }
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const owned = await loadOwnedInstructor(user);
  if (owned instanceof Response) return owned;
  if (!owned) {
    return NextResponse.json({ errors: { slots: 'Not found' } }, { status: 404 });
  }

  const slot = await loadOwnedSlot(owned.id, slotId);
  if (!slot) {
    return NextResponse.json({ errors: { slots: 'Not found' } }, { status: 404 });
  }
  if (slot.bookedAt) {
    return NextResponse.json(
      { errors: { slots: 'Cannot edit a slot already booked.' } },
      { status: 409 },
    );
  }

  const nextStartsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : slot.startsAt;
  const nextEndsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : slot.endsAt;
  const durationMinutes =
    parsed.data.durationMinutes ??
    Math.round((nextEndsAt.getTime() - nextStartsAt.getTime()) / 60_000);
  if (
    nextEndsAt.getTime() <= nextStartsAt.getTime() ||
    nextEndsAt.getTime() - nextStartsAt.getTime() !== durationMinutes * 60_000
  ) {
    return NextResponse.json(
      { errors: { endsAt: 'End time must be after start time.' } },
      { status: 400 },
    );
  }
  if (nextStartsAt.getTime() <= Date.now()) {
    return NextResponse.json(
      { errors: { startsAt: 'Cannot move a slot into the past.' } },
      { status: 400 },
    );
  }

  try {
    const overlap = await prisma.availabilitySlot.findFirst({
      where: {
        instructorId: owned.id,
        id: { not: slotId },
        startsAt: { lt: nextEndsAt },
        endsAt: { gt: nextStartsAt },
      },
      select: { id: true },
    });
    if (overlap) {
      return NextResponse.json(
        { errors: { startsAt: 'That time overlaps another slot.' } },
        { status: 409 },
      );
    }
    await prisma.availabilitySlot.update({
      where: { id: slotId },
      data: { startsAt: nextStartsAt, endsAt: nextEndsAt, durationMinutes },
    });
  } catch (err: unknown) {
    // Race with another instructor-side insert: the new startsAt collides
    // with an existing @@unique([instructorId, startsAt]) row. Surface as
    // a 409 the same way POST does.
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2002' || code === 'P2034') {
      return NextResponse.json(
        { errors: { startsAt: 'That start time clashes with another slot.' } },
        { status: 409 },
      );
    }
    throw err;
  }

  return new Response(null, { status: 204 });
}

export async function DELETE(req: Request, ctx: Ctx) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const { slotId } = await ctx.params;

  const owned = await loadOwnedInstructor(user);
  if (owned instanceof Response) return owned;
  if (!owned) {
    return NextResponse.json({ errors: { slots: 'Not found' } }, { status: 404 });
  }

  const slot = await loadOwnedSlot(owned.id, slotId);
  if (!slot) {
    return NextResponse.json({ errors: { slots: 'Not found' } }, { status: 404 });
  }
  if (slot.bookedAt) {
    return NextResponse.json(
      { errors: { slots: 'Cannot delete a slot already booked.' } },
      { status: 409 },
    );
  }

  await prisma.availabilitySlot.delete({ where: { id: slotId } });
  return new Response(null, { status: 204 });
}
