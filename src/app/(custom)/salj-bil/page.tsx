import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { SellCarForm } from '@/components/custom/sell-car-form';
import { LocaleLink } from '@/components/locale-link';
import { Button } from '@/components/ui/button';
import { loginHrefWithNext, signupHrefWithNext } from '@/lib/auth-next';
import { dealerCountries } from '@/lib/discovery/dealerships';
import { getSessionUser } from '@/lib/require-auth';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';
import { listOwnerListings } from '@/lib/vehicle-sales/listings';

const NEXT = '/salj-bil';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sellCarPage.meta');
  const locale = await getLocale();
  const title = t('title');
  const description = t('description');
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/salj-bil'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/salj-bil')),
    },
  };
}

export default async function SellCarPage() {
  const t = await getTranslations('sellCarPage');
  const locale = await getLocale();
  const user = await getSessionUser();
  const listings = user ? await listOwnerListings(user.id) : [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-4xl tracking-tight">{t('header.title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('header.lead')}</p>
      {user ? (
        <div className="mt-8 space-y-10">
          <SellCarForm countries={dealerCountries()} />
          <section className="space-y-3">
            <h2 className="text-lg">{t('mine.title')}</h2>
            {listings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('mine.empty')}</p>
            ) : (
              <ul className="space-y-2">
                {listings.map((listing) => (
                  <li key={listing.id}>
                    <LocaleLink
                      className="text-sm underline-offset-4 hover:underline"
                      href={`/bilar-till-salu/${listing.id}`}
                    >
                      {listing.make} {listing.model} · {listing.city}
                    </LocaleLink>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <div className="mt-8 space-y-4 rounded-2xl border border-border p-5">
          <h2 className="text-lg">{t('gate.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('gate.body')}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="min-h-11">
              <Link href={localePath(locale, signupHrefWithNext(NEXT))}>{t('gate.signup')}</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={localePath(locale, loginHrefWithNext(NEXT))}>{t('gate.login')}</Link>
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
