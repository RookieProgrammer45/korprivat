// deep link. Mirrors `/bookings/[id]/accept` but hosts
// `<BookingDeclineForm/>` (a sibling client island). The token-bearing
// URL keeps `robots: { index: false, follow: false }` so this page is
// never indexed by search engines.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingDeclineForm } from '@/components/custom/booking-decline-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingDecline');
  return {
    title: t('title'),
    description: t('declinedBody'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BookingDeclinePage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations('bookingDecline');
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : '';

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <BookingDeclineForm bookingId={id} token={token} />
      </div>
    </main>
  );
}
