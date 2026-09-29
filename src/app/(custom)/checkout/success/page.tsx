//
// Server Component shell that mounts the polling island. The page itself
// does no DB / API work — the island reads `session_id` from `useSearchParams`
// and polls GET /api/checkout?session_id= to confirm the payment.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutSuccessIsland } from './checkout-success';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('checkout.success.meta');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export const dynamic = 'force-dynamic';

export default function CheckoutSuccessPage() {
  return (
    <main className="container-page section min-h-[calc(100dvh-3.5rem)]">
      <CheckoutSuccessIsland />
    </main>
  );
}
