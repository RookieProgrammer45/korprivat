// POST /api/cron/reconcile-escrow — nightly: alert on aged held_escrow / stuck payouts.

import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { OWNER_EMAIL } from '@/lib/ownership';
import { authorizeCron } from '@/lib/payments/cron-auth';

export const dynamic = 'force-dynamic';

function alertRecipient(): string {
  return (
    process.env.EMAIL_OVERRIDE_TO?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.OWNER_EMAIL?.trim() ||
    OWNER_EMAIL
  );
}

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const agedHeld = await prisma.booking.findMany({
    where: {
      paymentStatus: 'held_escrow',
      OR: [{ heldAt: { lt: sevenDaysAgo } }, { paidAt: { lt: sevenDaysAgo }, heldAt: null }],
    },
    select: { id: true, paidAt: true, heldAt: true, instructorId: true },
    take: 100,
  });

  const stuckPayouts = await prisma.booking.findMany({
    where: {
      paymentStatus: { in: ['payout_pending', 'payout_failed', 'release_ready'] },
    },
    select: { id: true, paymentStatus: true },
    take: 100,
  });

  const lines = [
    `Aged held_escrow (>7d): ${agedHeld.length}`,
    ...agedHeld.slice(0, 20).map((b) => `  - ${b.id} paidAt=${b.paidAt?.toISOString() ?? 'n/a'}`),
    `Stuck payout states: ${stuckPayouts.length}`,
    ...stuckPayouts.slice(0, 20).map((b) => `  - ${b.id} status=${b.paymentStatus}`),
  ];

  if (agedHeld.length > 0 || stuckPayouts.length > 0) {
    console.error('[reconcile-escrow]', {
      agedHeld: agedHeld.length,
      stuckPayouts: stuckPayouts.length,
    });
    try {
      const mail = notificationEmail({
        subject: '[DriveLinkUp] Escrow reconciliation alert',
        title: 'Escrow reconciliation',
        lines,
      });
      await sendEmail({ to: alertRecipient(), ...mail });
    } catch (err) {
      console.error('[reconcile-escrow] alert failed', err);
    }
  }

  return NextResponse.json({
    ok: true,
    agedHeldEscrow: agedHeld.length,
    stuckPayouts: stuckPayouts.length,
    sampleHeldIds: agedHeld.slice(0, 10).map((b) => b.id),
  });
}
