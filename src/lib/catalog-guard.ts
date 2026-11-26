//
// Catalogue pages are signed-in only. This is the Server Component gate —
// redirect to /login?next=… instead of throwing a 401. API routes use
// requireAuth from @/lib/require-auth.

import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { loginHrefWithNext, sanitizeNext } from '@/lib/auth-next';

export { PUBLIC_CATALOG_PREVIEW_LIMIT } from '@/lib/catalog-preview';

export async function requireCatalogSession(nextPath: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) return;
  redirect(loginHrefWithNext(sanitizeNext(nextPath) ?? '/instructors'));
}
