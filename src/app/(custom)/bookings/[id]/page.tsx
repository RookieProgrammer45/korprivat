import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BookingConfirmPayment } from '@/components/custom/booking-confirm-payment';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookingConfirmPayment.meta');
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BookingDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const rawToken = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const token = typeof rawToken === 'string' && rawToken.length > 0 ? rawToken : undefined;

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <BookingConfirmPayment bookingId={id} token={token} />
      </div>
    </main>
  );
}
