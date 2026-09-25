// @polsia:user-owned — configure better-auth here (spread into betterAuth() by @/lib/auth).
// Add emailAndPassword options, plugins, session, databaseHooks, etc.
// Framework owns db/secret/baseURL/admin() + the owner-admin grant (no-op if set here).

import type { BetterAuthOptions } from 'better-auth';
import { prisma } from '@/lib/db';

// On user.create (fires once per sign-up), seed the UserProfile row with the
// marketplace role defaulted to STUDENT. The signup form posts the chosen role
// to /api/auth/welcome right after signup, which then updates the row.
// The upsert makes the hook idempotent — if a prior partial create left a
// User without a profile, this squares the row up; the framework-side
// owner-admin grant runs in user.create.before (in @/lib/auth) so it composes
// cleanly with this.
export const authConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
    // The minimum length better-auth enforces; tightening here would tighten
    // the contract for /login too.
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.userProfile
            .upsert({
              where: { userId: user.id },
              create: { userId: user.id, role: 'STUDENT' },
              update: {},
            })
            .catch(() => {
              // The hook must never break signup — swallow + log. The dashboard
              // guard self-heals a missing profile lazily so even an aborted
              // hook here doesn't lock the user out.
            });
        },
      },
    },
  },
};
