//
// better-auth exposes `requireAuth(req: Request)` (@/lib/require-auth) but
// that throws a 401 response — fine for /api route handlers, wrong shape for
// a Server Component (which must `redirect()` to /login, not respond 401).
//
// `requireDashboardSession()` returns the signed-in user and their effective
// role for the dashboard, or redirects to /login (unauthenticated) / / (signed
// in but role unbound). It reads `headers()` so the page is dynamic — that
// is what unlocks per-request session reads; we don't gate that further here.
//
// `dashboardPathFor(role)` maps a marketplace role to its dashboard leaf
// path. Used by the /dashboard role router, the per-role leaves when a
// wrong-role deep-link arrives, and the handledare clickwrap guard. Keeps
// the trivial "where does role X go?" read consistent across all sites.

import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { prisma } from '@/lib/db';

/**
 * Map a marketplace role to its dashboard leaf path. Single source of
 * truth so /dashboard, the role-gated leaves, and the clickwrap guard all
 * agree on where each role "lives" in the dashboard tree.
 */
export function dashboardPathFor(
  role: MarketplaceRole,
): '/dashboard/student' | '/dashboard/instructor' | '/dashboard/handledare' {
  if (role === 'INSTRUCTOR') return '/dashboard/instructor';
  if (role === 'HANDLEDARE') return '/dashboard/handledare';
  return '/dashboard/student';
}

export interface DashboardSession {
  userId: string;
  email: string;
  name: string;
  // The marketplace role from UserProfile (STUDENT | INSTRUCTOR | HANDLEDARE).
  // Better-auth's built-in role is the admin plugin's "user" | "admin" — that's
  // kept ON the better-auth User row for internal gating (admin views) but the
  // marketplace faces STUDENT/INSTRUCTOR/HANDLEDARE exclusively and we don't
  // want admin to leak there.
  role: MarketplaceRole;
  // True if the underlying better-auth user is admin (POLSIA_OWNER_EMAIL or
  // promoted later). Lets us render admin-only chips while keeping the student
  // or instructor default route reachable.
  isAdmin: boolean;
}

export async function requireDashboardSession(nextPath: string): Promise<DashboardSession> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    const qs = encodeURIComponent(nextPath);
    redirect(`/login?next=${qs}`);
  }

  // Email must be confirmed before any dashboard surface.
  if (!session.user.emailVerified) {
    redirect('/signup');
  }

  const userId = session.user.id;
  const isAdminBetterAuth = session.user.role === 'admin';

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { role: true },
  });
  // Self-heal: the seed user (admins provisioned outside the signup flow, or
  // a User row that pre-dates the UserProfile hook) may lack a profile. This
  // keeps the dashboard accessible to admin/owner without breaking the role
  // router — they default to STUDENT (the marketplace default) and can be
  // recategorised later from a clean UI.
  if (!profile) {
    await prisma.userProfile.create({
      data: { userId, role: 'STUDENT' },
    });
  }

  // The UserProfile.role column carries STUDENT/INSTRUCTOR/HANDLEDARE;
  // the framework-owned /api/auth/welcome helper isn't widened (it's not
  // ours). Users with HANDLEDARE never go through that route — their welcome
  // dispatch is the clickwrap success toast. Fall back to STUDENT if the
  // self-heal flag is true (the column is the DEFAULT STUDENT either way).
  const role: MarketplaceRole = !profile
    ? 'STUDENT'
    : profile.role === 'HANDLEDARE'
      ? 'HANDLEDARE'
      : profile.role === 'INSTRUCTOR'
        ? 'INSTRUCTOR'
        : 'STUDENT';

  return {
    userId,
    email: session.user.email,
    name: session.user.name ?? session.user.email,
    role,
    isAdmin: isAdminBetterAuth,
  };
}
