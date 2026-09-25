// @polsia:user-owned — Server Component shell for the "open or resolve a
// dispute" deep link. The page hosts `<BookingDisputeForm>` (a client island)
// which reads the live booking row, picks between open and resolve modes
// based on `disputeStatus`, and POSTs to /api/bookings/[id]/dispute or
// /api/bookings/[id]/dispute/resolve with the per-booking action token
// carried in `?token=…`.
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingDisputeForm } from '@/components/custom/booking-dispute-form';

// Per-request so the deep-link page is never frozen at build time.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingDispute');
  return {
    title: t('openFormTitle'),
    description: t('openFormLead'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BookingDisputePage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const t = await getTranslations('bookingDispute');
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : '';

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('openFormEyebrow')}
        </h1>
        <BookingDisputeForm bookingId={id} token={token} />
      </div>
    </main>
  );
}
