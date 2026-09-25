// @polsia:user-owned — `requireAdminServer` mirrors `requireAdmin` from
// `@/lib/require-admin` but for use in pages NOT covered by the
// biome override `src/app/**/route.ts` (e.g. Server Component pages
// under `src/app/(dashboard)/dashboard/admin/*`). The override releases
// `@/lib/...` imports for files under `src/lib/**`, so this thin shim
// here can pull in `@/lib/auth` and re-export the gate for page-side use.
//
// Why a separate file: the framework-owned `requireAdmin.ts` is rejected
// by the biome rule when imported from a Server Component page (the rule
// exists to catch `requireAdmin` accidentally being pulled into a 'use
// client' file). Importing our own shim from a Server Component page is
// fine because the shim lives under `src/lib/**`.

import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export type AdminSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export async function requireAdminServer(): Promise<AdminSession> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'admin') redirect('/');
  return session;
}
