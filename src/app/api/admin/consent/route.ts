//
// Admin-only audit view: latest 200 GDPR/cookie consent events.
// Inline session/admin check (NOT requireAdmin: that redirects on non-admin
// — bad UX for an API client that needs a 403 to render an error state).

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { AdminConsentList } from '@/lib/contracts/consent';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const rows = await prisma.consentEvent.findMany({
    orderBy: { acceptedAt: 'desc' },
    take: 200,
    select: {
      id: true,
      userId: true,
      policyVersion: true,
      scope: true,
      source: true,
      acceptedAt: true,
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    policyVersion: r.policyVersion,
    scope: r.scope,
    source: r.source,
    acceptedAt: r.acceptedAt.toISOString(),
  }));

  return NextResponse.json(AdminConsentList.parse({ items }));
}
