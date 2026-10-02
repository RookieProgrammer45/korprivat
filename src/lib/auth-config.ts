// Add emailAndPassword options, plugins, session, databaseHooks, etc.
// Framework owns db/secret/baseURL/admin() + the owner-admin grant (no-op if set here).

import type { BetterAuthOptions } from 'better-auth';
import { prisma } from '@/lib/db';
import { resetPasswordEmail } from '@/lib/email/reset-password';
import { sendEmail } from '@/lib/email/send';
import { verifyEmailTemplate } from '@/lib/email/verify-email';
import { siteUrl } from '@/lib/site';

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
    // Keep false so sign-up still creates a session (needed for the in-wizard
    // email-verify + photo steps). App guards enforce emailVerified instead.
    requireEmailVerification: false,
    // Force re-auth everywhere after a successful reset (stolen-session hygiene).
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      // Branded page (same pattern as verify-email). Token is validated on POST
      // /api/auth/reset-password — see better-auth email-password docs.
      const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: user.email,
        ...resetPasswordEmail({
          name: user.name,
          resetUrl,
          locale: 'sv',
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // 24 hours — matches verify-email copy.
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, token }) => {
      // Rewrite better-auth's /api/auth/verify-email URL to our branded page.
      const verifyUrl = `${siteUrl}/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: user.email,
        ...verifyEmailTemplate({
          name: user.name,
          verifyUrl,
          locale: 'sv',
        }),
      });
    },
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
