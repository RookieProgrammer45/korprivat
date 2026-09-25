// @polsia:user-owned — GET /api/profile
//
// Owner-scoped read for the /profile surface. Returns the session user's
// name/email/avatar + their marketplace role + the role-correct upcoming
// bookings list. The single source of truth for what /profile renders.
//
//   STUDENT   → upcoming bookings where Booking.userId matches the
//               authenticated session user AND preferredAt >= now()
//   INSTRUCTOR → upcoming bookings where Booking.instructorId matches the
//                Instructor row owned by the authenticated session user AND
//                preferredAt >= now(). A signing-in instructor without a
//                matching Instructor row (signed up but hasn't completed
//                instructor onboarding) gets an empty upcoming list rather
//                than a 404 — same affordance as /api/bookings/instructor.
//
// Why no `paymentStatus` filter: the brief says "upcoming bookings/lessons",
// so anything with preferredAt >= now() qualifies regardless of whether the
// learner has paid yet. Released / refunded rows whose lesson time has
// passed are correctly excluded by the date filter alone.
//
// Self-heal for missing UserProfile rows mirrors the dashboard-guard: a
// pre-UserProfile auth row (e.g. seed admins provisioned outside signup)
// gets a STUDENT UserProfile the first time any guard reads it.

import 'server-only';
import { NextResponse } from 'next/server';
import { photoState } from '@/lib/business/photo-verification';
import { type BookingPaymentStatus, BookingPaymentStatusEnum } from '@/lib/contracts/bookings';
import { MarketplaceRole, Profile } from '@/lib/contracts/profile';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type PaymentStatusWire = BookingPaymentStatus;

function asPaymentStatus(s: string | null | undefined): PaymentStatusWire {
  // Booking.paymentStatus is nullable for legacy rows. Preserve every
  // recognized request/terminal state; only an unknown value falls back to
  // `unpaid` so the typed profile envelope stays parseable.
  const parsed = BookingPaymentStatusEnum.safeParse(s ?? 'unpaid');
  return parsed.success ? parsed.data : 'unpaid';
}

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  // Resolve the marketplace role. Self-heal if the row is missing, mirroring
  // the dashboard-guard pattern (src/lib/dashboard-guard.ts). Safer to upsert
  // here than to assume every session has one — seed admins / pre-migration
  // rows can land here without a UserProfile.
  let profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (!profile) {
    profile = await prisma.userProfile.create({
      data: { userId: user.id, role: 'STUDENT' },
      select: { role: true },
    });
  }
  const role = MarketplaceRole.parse(profile.role);

  const upcoming = await loadUpcoming(role, user);

  const payload = Profile.parse({
    user: {
      name: user.name ?? user.email,
      email: user.email,
      image: user.image ?? null,
    },
    role,
    upcoming,
    photo: await photoState(user.id),
  });

  return NextResponse.json(payload);
}

async function loadUpcoming(
  role: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE',
  user: SessionUser,
): Promise<{
  items: Array<{
    id: string;
    counterpartyName: string;
    category: string;
    preferredAt: string;
    paymentStatus: PaymentStatusWire;
  }>;
}> {
  const now = new Date();

  if (role === 'STUDENT') {
    const rows = await prisma.booking.findMany({
      where: {
        userId: user.id,
        preferredAt: { gte: now },
      },
      orderBy: { preferredAt: 'asc' },
      take: 50,
      select: {
        id: true,
        instructorId: true,
        category: true,
        preferredAt: true,
        paymentStatus: true,
      },
    });

    // Join-free resolve of instructor names for the result set — no FK to
    // auth User, so a by-id lookup is the only available path.
    const ids = Array.from(new Set(rows.map((r) => r.instructorId)));
    const instructors = ids.length
      ? await prisma.instructor.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true },
        })
      : [];
    const nameByInstructor = new Map(instructors.map((i) => [i.id, i.name]));

    return {
      items: rows.map((b) => ({
        id: b.id,
        counterpartyName: nameByInstructor.get(b.instructorId) ?? 'Awaiting confirmation',
        category: b.category,
        preferredAt: b.preferredAt.toISOString(),
        paymentStatus: asPaymentStatus(b.paymentStatus),
      })),
    };
  }

  // INSTRUCTOR — empty list if the session isn't linked to an Instructor
  // row (parallel to /api/bookings/instructor's affordance).
  const instructor = await prisma.instructor.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!instructor) {
    return { items: [] };
  }

  const rows = await prisma.booking.findMany({
    where: {
      instructorId: instructor.id,
      preferredAt: { gte: now },
    },
    orderBy: { preferredAt: 'asc' },
    take: 50,
    select: {
      id: true,
      studentName: true,
      category: true,
      preferredAt: true,
      paymentStatus: true,
    },
  });

  return {
    items: rows.map((b) => ({
      id: b.id,
      // Booking.studentName is the active free-form field (no FK to auth
      // User yet) — mirrors what /api/bookings/instructor renders today.
      counterpartyName: b.studentName,
      category: b.category,
      preferredAt: b.preferredAt.toISOString(),
      paymentStatus: asPaymentStatus(b.paymentStatus),
    })),
  };
}
