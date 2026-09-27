import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingReceipt } from '@/components/custom/booking-receipt';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingReceipt.meta');
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

export default async function BookingReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const rawToken = Array.isArray(query.token) ? query.token[0] : query.token;
  return (
    <main className="container-page section receipt-page">
      <BookingReceipt bookingId={id} token={rawToken} />
    </main>
  );
}
