// deep link. The page hosts `<BookingCompleteForm>` (a client island) which
// reads the live booking row, gates the form on `paymentStatus ===
// 'held_escrow' && disputeStatus === null`, and POSTs to
// /api/bookings/[id]/complete with the per-booking action token carried in
// `?token=…`.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingCompleteForm } from '@/components/custom/booking-complete-form';

// Per-request so the deep-link page is never frozen at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingComplete');
  return {
    title: t('title'),
    description: t('body'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BookingCompletePage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations('bookingComplete');
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : '';

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <BookingCompleteForm bookingId={id} token={token} />
      </div>
    </main>
  );
}
