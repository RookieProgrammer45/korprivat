// @polsia:user-owned — /profile server page. metadata + guard + island.
//
// Renders avatar/name/role + the role-correct upcoming-bookings list for the
// signed-in user. The guard redirects unauthed visitors to /login?next=/profile
// (same seam the dashboard layout uses), and the island does the actual data
// fetch from /api/profile via the api-fetch + zod contract path. No body
// data-fetches here — Server Components only assemble metadata, the guard,
// and the composition; DB-detail lives in the /api route handler.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfilePage } from '@/components/custom/profile/profile-page';
import { requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('profile');
  return {
    title: t('title'),
    alternates: { canonical: '/profile' },
    robots: { index: false, follow: false },
  };
}

export default async function ProfileRoutePage() {
  await requireDashboardSession('/profile');
  const t = await getTranslations('profile');
  return (
    <main className="profile-shell container-page section">
      <header className="sr-only">
        <h1>{t('title')}</h1>
      </header>
      <ProfilePage />
    </main>
  );
}
