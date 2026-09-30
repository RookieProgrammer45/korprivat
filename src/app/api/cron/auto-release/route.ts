// POST /api/cron/auto-release — hourly: release bookings past autoReleaseAt.

import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { payoutBooking } from '@/lib/payments/payouts';

export const dynamic = 'force-dynamic';

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const due = await prisma.booking.findMany({
    where: {
      paymentStatus: 'awaiting_buyer_confirmation',
      autoReleaseAt: { lt: now },
    },
    select: {
      id: true,
      studentName: true,
      instructorId: true,
      locale: true,
    },
    take: 50,
  });

  let released = 0;
  let failed = 0;

  for (const row of due) {
    const claimed = await prisma.booking.updateMany({
      where: {
        id: row.id,
        paymentStatus: 'awaiting_buyer_confirmation',
        autoReleaseAt: { lt: now },
      },
      data: {
        confirmedAt: now,
        paymentStatus: 'release_ready',
      },
    });
    if (claimed.count === 0) continue;

    const result = await payoutBooking(row.id, {
      completedByRole: 'instructor',
      completedByLabel: 'auto_release_48h',
    });

    if (result.kind === 'sent' || result.kind === 'duplicate') {
      released += 1;
      try {
        const instructor = await prisma.instructor.findUnique({
          where: { id: row.instructorId },
          select: { email: true, name: true },
        });
        if (instructor?.email) {
          const locale = row.locale === 'en' ? 'en' : 'sv';
          const mail = notificationEmail({
            subject:
              locale === 'en'
                ? 'Auto-released after 48h — DriveLinkUp'
                : 'Auto-frigjord efter 48h — DriveLinkUp',
            title: locale === 'en' ? 'Payout auto-released' : 'Utbetalning auto-frigjord',
            lines:
              locale === 'en'
                ? [
                    `Hi ${instructor.name},`,
                    `The lesson with ${row.studentName} was auto-confirmed after 48 hours. Payout is processing.`,
                  ]
                : [
                    `Hej ${instructor.name},`,
                    `Lektionen med ${row.studentName} auto-bekräftades efter 48 timmar. Utbetalning behandlas.`,
                  ],
          });
          await sendEmail({ to: instructor.email, ...mail });
        }
      } catch (err) {
        console.error('[cron/auto-release] seller email failed', { bookingId: row.id, err });
      }
    } else {
      failed += 1;
      console.error('[cron/auto-release] payout skipped/failed', { bookingId: row.id, result });
    }
  }

  console.info('[cron/auto-release]', { scanned: due.length, released, failed });
  return NextResponse.json({ ok: true, scanned: due.length, released, failed }, { status: 200 });
}

/** Vercel Cron may GET; treat the same as POST. */
export async function GET(req: Request) {
  return POST(req);
}
