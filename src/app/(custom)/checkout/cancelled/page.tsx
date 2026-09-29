// Cancelled Stripe Checkout return page.
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';

export default async function CheckoutCancelledPage() {
  const t = await getTranslations('checkout.success');
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="font-display text-h2 tracking-tight">{t('timeoutTitle')}</h1>
      <p className="text-body text-muted-foreground">{t('timeoutBody')}</p>
      <Button asChild>
        <Link href="/dashboard/student">{t('cta')}</Link>
      </Button>
    </main>
  );
}
