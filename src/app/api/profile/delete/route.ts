//
// Self-service account erasure for the signed-in user (GDPR art. 17 — the
// right the /privacy page promises via frank@drivelinkup.com, now wired as
// a button at the bottom of /profile). POST action-style route so the caller
// can't trigger it with a navigational prefetch: it mutates + is destructive.
//
// The whole erase runs in ONE interactive transaction — a partial erase must
// never strand personal data behind a dead user id, and it must never leave
// a User whose marketplace rows still reference it. Order matters:
//   1. Booking-scoped financial/trust rows (scalar FKs, no cascade)
//   2. Reviews on the user's instructor listings (RESTRICT-delete FK)
//   3. Bookings (as student AND as the deleted listings' instructor)
//   4. Instructor rows themselves (AvailabilitySlot cascades along)
//   5. User-owned marketplace rows (scalar userId links)
//   5b. Memberships — plus any Organization left with zero members (the
//       user was the school's last member; ownerless shells serve nobody)
//   6. Email-linked pre-signup rows (waitlist, contact) — same person
//   7. User LAST — cascades Session, Account, Membership (auth.prisma)
//
// Kept deliberately (pseudonymous once the User row is gone): ConsentEvent
// (lawful-basis audit trail), VerificationEvent / DiditWebhookEvent
// (append-only verification audit), and Message bodies already visible to
// other conversation parties. HandledareEnrollment is a legal artefact —
// invariant 7 says never hard-delete, so it is REVOKED, not erased.
//
// Stripe-side records (customers, charges, Connect transfers) and Vercel
// Blob media are outside this transaction's reach — retained per accounting
// rules; blob cleanup is a follow-up ops sweep.

import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { DeleteAccountResponse } from '@/lib/contracts/profile';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const email = user.email.toLowerCase();

  // Resolve the erasure set BEFORE the transaction so the delete set is
  // stable and the transaction body stays short (lock window).
  const instructorRows = await prisma.instructor.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const instructorIds = instructorRows.map((row) => row.id);

  const bookingRows = await prisma.booking.findMany({
    where: {
      OR: [
        { userId: user.id },
        // Anonymous bookings the same person made with this email before
        // signing up — the privacy page promises erasure of the person.
        { studentEmail: email },
        ...(instructorIds.length > 0 ? [{ instructorId: { in: instructorIds } }] : []),
      ],
    },
    select: { id: true },
  });
  const bookingIds = bookingRows.map((row) => row.id);

  try {
    await prisma.$transaction(async (tx) => {
      if (bookingIds.length > 0) {
        await tx.lateCancellationFee.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.bookingReceipt.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.dispute.deleteMany({ where: { bookingId: { in: bookingIds } } });
        await tx.payoutRecord.deleteMany({ where: { bookingId: { in: bookingIds } } });
      }

      if (instructorIds.length > 0) {
        // Review.instructorId is a RESTRICT relation — clear reviews first.
        await tx.review.deleteMany({ where: { instructorId: { in: instructorIds } } });
      }

      if (bookingIds.length > 0) {
        await tx.booking.deleteMany({ where: { id: { in: bookingIds } } });
      }

      if (instructorIds.length > 0) {
        // AvailabilitySlot cascades with the instructor row.
        await tx.instructor.deleteMany({ where: { id: { in: instructorIds } } });
      }

      // Invariant 7: legal artefact — revoke, never hard-delete.
      await tx.handledareEnrollment.updateMany({
        where: { learnerUserId: user.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });

      await tx.userProfile.deleteMany({ where: { userId: user.id } });
      await tx.instructorLicense.deleteMany({ where: { userId: user.id } });
      await tx.clickwrapAcceptance.deleteMany({ where: { userId: user.id } });
      await tx.photoVerification.deleteMany({ where: { userId: user.id } });
      await tx.savedPaymentMethod.deleteMany({ where: { userId: user.id } });
      await tx.rebookingCache.deleteMany({ where: { userId: user.id } });
      await tx.conversationParticipant.deleteMany({ where: { userId: user.id } });

      // School memberships: the school (Organization) is an entity, not the
      // person — keep it alive when other members remain. But if this user
      // was the LAST member, the org would linger as an ownerless shell
      // nobody can manage or claim, so it dies with them. (Membership also
      // cascades at the user.delete below; the explicit deleteMany is what
      // lets the orphan check observe the post-removal state.)
      const memberships = await tx.membership.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
      });
      await tx.membership.deleteMany({ where: { userId: user.id } });
      if (memberships.length > 0) {
        const orgIds = Array.from(new Set(memberships.map((m) => m.organizationId)));
        await tx.organization.deleteMany({
          where: { id: { in: orgIds }, memberships: { none: {} } },
        });
      }
      await tx.waitlistProfile.deleteMany({ where: { email } });
      await tx.waitlistEntry.deleteMany({ where: { email } });
      await tx.contactMessage.deleteMany({ where: { email } });

      // LAST — cascades Session, Account, Membership.
      await tx.user.delete({ where: { id: user.id } });
    });
  } catch (error) {
    // A racing second call deletes the User first; the loser hits P2025 on
    // the user.delete. The account is gone either way — treat as success.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json(DeleteAccountResponse.parse({ deleted: true }));
    }
    console.error('[profile/delete] erasure transaction failed', {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }

  return NextResponse.json(DeleteAccountResponse.parse({ deleted: true }));
}
