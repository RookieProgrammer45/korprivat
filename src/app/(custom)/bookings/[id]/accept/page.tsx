// deep link. The page hosts `<BookingAcceptForm/>` (a client island) which
// reads the booking row, renders a single-page state machine, and POSTs to
// /api/bookings/[id]/accept with the per-booking action token.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingAcceptForm } from '@/components/custom/booking-accept-form';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingAccept');
  return {
    title: t('title'),
    description: t('acceptedBody'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BookingAcceptPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations('bookingAccept');
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : '';

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <BookingAcceptForm bookingId={id} token={token} />
      </div>
    </main>
  );
}
