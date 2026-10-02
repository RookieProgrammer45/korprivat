//
// Server Component shell that mounts the polling island. Resolves a
// role-aware dashboard CTA href; the island polls GET /api/checkout?session_id=
// to confirm the payment.

import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { CheckoutSuccessIsland } from './checkout-success';
import { auth } from '@/lib/auth';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { prisma } from '@/lib/db';
import { resolveDashboardHome } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.success.meta');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

async function resolveSuccessDashboardHref(): Promise<string> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) return '/dashboard';

    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: { role: true },
    });
    const role: MarketplaceRole =
      profile?.role === 'INSTRUCTOR'
        ? 'INSTRUCTOR'
        : profile?.role === 'HANDLEDARE'
          ? 'HANDLEDARE'
          : 'STUDENT';
    return await resolveDashboardHome(session.user.id, role);
  } catch {
    return '/dashboard';
  }
}

export default async function CheckoutSuccessPage() {
  const dashboardHref = await resolveSuccessDashboardHref();
  const bookingsHref =
    dashboardHref === '/dashboard/student' ? '/dashboard/student/bookings' : undefined;
  return (
    <main className="container-page section min-h-[calc(100dvh-3.5rem)]">
      <CheckoutSuccessIsland
        dashboardHref={dashboardHref}
        bookingsHref={bookingsHref}
      />
    </main>
  );
}
