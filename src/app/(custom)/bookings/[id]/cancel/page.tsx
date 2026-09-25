// @polsia:user-owned — no-index shell for the token-bearing cancellation flow.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingCancelForm } from '@/components/custom/booking-cancel-form';

// Per-request so the deep-link page is never frozen at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingCancel');
  return {
    title: t('title'),
    description: t('policy.moreDetails'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BookingCancelPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : '';

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <BookingCancelForm bookingId={id} token={token} />
      </div>
    </main>
  );
}
