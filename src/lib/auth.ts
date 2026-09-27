// Protected core (db/secret/baseURL, admin plugin, multi-host trustedOrigins) + owner-admin grant,
// composed with the app's own databaseHooks. Configure auth in @/lib/auth-config (user-owned).

import 'server-only';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin } from 'better-auth/plugins';
import { authConfig } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

// Compose the owner-admin grant with the app's hooks — don't overwrite them.
const appHooks = authConfig.databaseHooks;

// Multi-host auth: production www + apex, plus any deploy-injected extras
// (preview URLs via BETTER_AUTH_TRUSTED_ORIGINS). baseURL's own origin is
// always trusted implicitly.
const trustedOrigins = [
  'https://www.drivelinkup.com',
  'https://drivelinkup.com',
  ...(env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? []),
];

export const auth = betterAuth({
  ...authConfig,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins,
  databaseHooks: {
    ...appHooks,
    user: {
      ...appHooks?.user,
      create: {
        ...appHooks?.user?.create,
        before: async (user, ctx) => {
          const r = await appHooks?.user?.create?.before?.(user, ctx);
          if (r === false) return false;
          const base = r && typeof r === 'object' && 'data' in r ? r.data : user;
          const ownerEmail = (process.env.OWNER_EMAIL ?? 'support@drivelinkup.com').toLowerCase();
          if (user.email.toLowerCase() === ownerEmail) {
            return { data: { ...base, role: 'admin' } };
          }
          return r;
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
    }),
    ...(authConfig.plugins ?? []),
  ],
});
