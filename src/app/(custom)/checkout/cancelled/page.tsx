// @polsia:user-owned — landing target of Stripe hosted-checkout `cancelUrl`.
//
// Renders a short message + a link back to `/dashboard/instructor`. The page
// itself is fully static — no DB, no API, no auth check (cancellation is a
// public Stripe-hosted redirect and the user is already on the dashboard
// when they hit Cancel).

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-static';

export async function generateMetadata() {
  const t = await getTranslations('checkout.cancelled');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutCancelledPage() {
  const t = await getTranslations('checkout.cancelled');
  return (
    <main className="container-page section min-h-[calc(100dvh-3.5rem)]">
      <section className="mx-auto grid max-w-xl gap-4 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="text-body text-muted-foreground">{t('body')}</p>
        <div className="mt-2 flex justify-center">
          <Button asChild>
            <Link href="/dashboard/instructor">{t('cta')}</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
