// @polsia:user-owned — shared signup-resume gate for dashboard entry.
// Mirrors GET /api/signup/state + POST /api/signup/complete so incomplete
// wizard users cannot bypass prerequisites by deep-linking into /dashboard.

import 'server-only';
import { redirect } from 'next/navigation';
import { confirmedPhotoUrl } from '@/lib/business/photo-verification';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { prisma } from '@/lib/db';

export async function requireSignupPrerequisites(
  userId: string,
  role: MarketplaceRole,
): Promise<void> {
  if (role === 'INSTRUCTOR') {
    if (!(await confirmedPhotoUrl(userId))) {
      redirect('/signup');
    }
    const license = await prisma.instructorLicense.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!license) redirect('/signup');
    return;
  }
  if (role === 'HANDLEDARE') {
    const clickwrap = await prisma.clickwrapAcceptance.findUnique({
      where: { userId },
      select: { termsVersion: true },
    });
    if (clickwrap?.termsVersion !== HANDLEDARE_TERMS_VERSION) {
      redirect('/signup');
    }
  }
}
