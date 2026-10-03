// Verification context — HandledareEnrollment legal artefact.
// Never hard-delete; mark REVOKED / EXPIRED only (AGENTS.md invariant 7).

import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import type { HandledareEnrollmentSnapshot } from '@/lib/verification/state';

export const HANDLEDARE_ENROLLMENT_TTL_HOURS = 168; // 7 days

function hashInviteToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function toEnrollmentSnapshot(row: {
  status: string;
  expiresAt: Date;
}): HandledareEnrollmentSnapshot | null {
  if (row.status === 'APPROVED') {
    return { status: 'APPROVED', expiresAt: row.expiresAt };
  }
  if (row.status === 'REVOKED') {
    return { status: 'REVOKED', expiresAt: row.expiresAt };
  }
  if (row.status === 'EXPIRED' || row.expiresAt.getTime() < Date.now()) {
    return { status: 'PENDING', expiresAt: row.expiresAt };
  }
  if (row.status === 'PENDING') {
    return { status: 'PENDING', expiresAt: row.expiresAt };
  }
  return null;
}

export async function loadActiveHandledareEnrollment(
  learnerUserId: string,
): Promise<HandledareEnrollmentSnapshot | null> {
  const row = await prisma.handledareEnrollment.findFirst({
    where: {
      learnerUserId,
      status: { in: ['PENDING', 'APPROVED', 'REVOKED', 'EXPIRED'] },
    },
    orderBy: { createdAt: 'desc' },
    select: { status: true, expiresAt: true },
  });
  if (!row) return null;
  if (row.status === 'PENDING' && row.expiresAt.getTime() < Date.now()) {
    await prisma.handledareEnrollment.updateMany({
      where: { learnerUserId, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    return { status: 'PENDING', expiresAt: row.expiresAt };
  }
  return toEnrollmentSnapshot(row);
}

export async function createHandledareInvite(input: {
  learnerUserId: string;
  handledareEmail: string;
  handledareName?: string | null;
  learnerName?: string | null;
}): Promise<{ enrollmentId: string; inviteUrl: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString('base64url');
  const inviteTokenHash = hashInviteToken(rawToken);
  const expiresAt = new Date(Date.now() + HANDLEDARE_ENROLLMENT_TTL_HOURS * 60 * 60 * 1000);
  const email = input.handledareEmail.trim().toLowerCase();

  // Supersede prior pending invites (mark expired — never delete).
  await prisma.handledareEnrollment.updateMany({
    where: { learnerUserId: input.learnerUserId, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });

  const row = await prisma.handledareEnrollment.create({
    data: {
      learnerUserId: input.learnerUserId,
      handledareEmail: email,
      handledareName: input.handledareName?.trim() || null,
      status: 'PENDING',
      inviteTokenHash,
      expiresAt,
    },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.drivelinkup.com').replace(
    /\/+$/,
    '',
  );
  const inviteUrl = `${appUrl}/onboarding/handledare/${encodeURIComponent(rawToken)}`;

  const mail = notificationEmail({
    subject: 'Handledare-godkännande — DriveLinkUp',
    title: 'Bekräfta handledarskap',
    lines: [
      input.handledareName ? `Hej ${input.handledareName},` : 'Hej,',
      `${input.learnerName ?? 'En elev'} ber dig godkänna handledarskap för övningskörning via DriveLinkUp.`,
      'Öppna länken för att godkänna (giltig i 7 dagar):',
      inviteUrl,
    ],
  });
  await sendEmail({ to: email, ...mail });

  await prisma.userProfile.updateMany({
    where: { userId: input.learnerUserId },
    data: { verificationState: 'HANDLEDARE_PENDING' },
  });

  return { enrollmentId: row.id, inviteUrl, expiresAt };
}

export async function approveHandledareInvite(rawToken: string): Promise<
  | { ok: true; learnerUserId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'not_pending' }
> {
  const inviteTokenHash = hashInviteToken(rawToken);
  const row = await prisma.handledareEnrollment.findUnique({
    where: { inviteTokenHash },
  });
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.status !== 'PENDING') return { ok: false, reason: 'not_pending' };
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.handledareEnrollment.update({
      where: { id: row.id },
      data: { status: 'EXPIRED' },
    });
    return { ok: false, reason: 'expired' };
  }

  const now = new Date();
  await prisma.handledareEnrollment.update({
    where: { id: row.id },
    data: { status: 'APPROVED', approvedAt: now },
  });
  await prisma.userProfile.updateMany({
    where: { userId: row.learnerUserId },
    data: { verificationState: 'ACTIVE' },
  });
  await prisma.verificationEvent.create({
    data: {
      subjectType: 'LEARNER',
      subjectId: row.learnerUserId,
      toStatus: 'ACTIVE',
      fromStatus: 'HANDLEDARE_PENDING',
      note: 'handledare_enrollment_approved',
      metadata: { enrollmentId: row.id },
    },
  });

  return { ok: true, learnerUserId: row.learnerUserId };
}

export async function revokeHandledareEnrollment(
  enrollmentId: string,
  actorId?: string,
): Promise<void> {
  const row = await prisma.handledareEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!row || row.status === 'REVOKED') return;
  await prisma.handledareEnrollment.update({
    where: { id: enrollmentId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
  await prisma.userProfile.updateMany({
    where: { userId: row.learnerUserId, verificationState: 'ACTIVE' },
    data: { verificationState: 'HANDLEDARE_PENDING' },
  });
  await prisma.verificationEvent.create({
    data: {
      subjectType: 'LEARNER',
      subjectId: row.learnerUserId,
      actorId: actorId ?? null,
      toStatus: 'HANDLEDARE_PENDING',
      fromStatus: 'ACTIVE',
      note: 'handledare_enrollment_revoked',
      metadata: { enrollmentId },
    },
  });
}
