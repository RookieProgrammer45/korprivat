//
// Calls `requireDashboardSession('/dashboard/handledare')` first (which runs
// `redirect('/login?next=…')` when no session and self-heals a missing
// UserProfile), then enforces a HANDLEDARE-only role check — a STUDENT or
// INSTRUCTOR who follows a handledare dashboard URL gets bounced to their
// own role-correct dashboard so we never leak the clickwrap renewal banner
// (or the future handledare dashboard content) across tiers.
//
// Returns the full context the handledare dashboard renders depends on:
//   - session: dashboard session (from requireDashboardSession)
//   - acceptance: the user's ClickwrapAcceptance row's { termsVersion,
//     acceptedAt } projection, or null when no row exists yet
//   - currentVersion: the HANDLEDARE_TERMS_VERSION constant exported from
//     the clickwrap contract
//   - isCurrent: true iff acceptance != null AND
//     acceptance.termsVersion === currentVersion (the guard against a
//     stale row when the founder bumps the terms text and re-deploys).

import 'server-only';
import { redirect } from 'next/navigation';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import {
  type DashboardSession,
  dashboardPathFor,
  requireDashboardSession,
} from '@/lib/dashboard-guard';
import { prisma } from '@/lib/db';

export interface HandledareClickwrapContext {
  session: DashboardSession;
  acceptance: { termsVersion: string; acceptedAt: string } | null;
  currentVersion: string;
  isCurrent: boolean;
}

export async function requireHandledareClickwrap(
  nextPath: string,
): Promise<HandledareClickwrapContext> {
  const session = await requireDashboardSession(nextPath);

  // Role gate. Only redirect INSTRUCTOR users — they have their own separate
  // dashboard and must never see the handledare clickwrap. STUDENT users are
  // allowed through: a user who just signed up as HANDLEDARE still has
  // role=STUDENT in their session (the signup hook seeds STUDENT by default);
  // the POST /api/clickwrap route flips it to HANDLEDARE on acceptance.
  // Blocking STUDENT here would create a circular dependency where they can
  // never reach the page that would fix their role.
  if (session.role === 'INSTRUCTOR') {
    redirect(dashboardPathFor('INSTRUCTOR'));
  }

  const row = await prisma.clickwrapAcceptance
    .findUnique({
      where: { userId: session.userId },
      select: { termsVersion: true, acceptedAt: true },
    })
    .catch(() => null);

  const acceptance = row
    ? { termsVersion: row.termsVersion, acceptedAt: row.acceptedAt.toISOString() }
    : null;
  const currentVersion = HANDLEDARE_TERMS_VERSION;
  const isCurrent = acceptance !== null && acceptance.termsVersion === currentVersion;

  return { session, acceptance, currentVersion, isCurrent };
}
