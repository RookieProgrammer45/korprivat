import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SchoolRegisterForm } from '@/components/custom/school-register-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listMembershipsForUser } from '@/lib/orgs/service';
import { getSessionUser } from '@/lib/require-auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('forSkolor');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/for-skolor' },
  };
}

function MarketingCopy({ t }: { t: Awaited<ReturnType<typeof getTranslations<'forSkolor'>>> }) {
  return (
    <header className="provider-entry-copy grid gap-4">
      <Badge
        variant="outline"
        className="w-fit border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
      >
        {t('badge')}
      </Badge>
      <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
        {t('title')}
      </h1>
      <p className="text-body-lg text-muted-foreground">{t('body')}</p>
      <ul className="grid gap-2 text-body text-foreground">
        <li className="flex gap-2">
          <span aria-hidden className="text-brand-600">
            •
          </span>
          <span>{t('benefit1')}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-brand-600">
            •
          </span>
          <span>{t('benefit2')}</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-brand-600">
            •
          </span>
          <span>{t('benefit3')}</span>
        </li>
      </ul>
    </header>
  );
}

export default async function ForSkolorPage() {
  const t = await getTranslations('forSkolor');
  const user = await getSessionUser();

  if (user) {
    const memberships = await listMembershipsForUser(user.id, { onlyActive: true });
    if (memberships.some((m) => m.role === 'OWNER' || m.role === 'STAFF')) {
      redirect('/dashboard/school');
    }
  }

  return (
    <main className="provider-entry-shell container-page section min-h-[calc(100dvh-3.5rem)]">
      <div className="mx-auto grid w-full max-w-xl gap-8">
        <MarketingCopy t={t} />

        {user ? (
          <section className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <SchoolRegisterForm />
          </section>
        ) : (
          <section className="grid gap-4 rounded-xl border border-border bg-card p-6 shadow-sm">
            <Button asChild size="lg" className="w-full">
              <Link href="/signup?role=school&next=/for-skolor">{t('ctaSignedOut')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/login?next=/for-skolor">{t('ctaSignIn')}</Link>
            </Button>
            <p className="text-center text-small text-muted-foreground">{t('timeNote')}</p>
          </section>
        )}
      </div>
    </main>
  );
}
