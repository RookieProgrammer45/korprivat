import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { CityHubKey } from '@/lib/seo/city-hubs';

export async function CitySeoSection({ city }: { city: CityHubKey }) {
  const tSeo = await getTranslations(`instructorsPage.${city}City.seo`);
  const faq = [
    { q: tSeo('faq1q'), a: tSeo('faq1a') },
    { q: tSeo('faq2q'), a: tSeo('faq2a') },
    { q: tSeo('faq3q'), a: tSeo('faq3a') },
  ];

  return (
    <section className="container-page border-t border-border/60 bg-muted/20 py-10">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid gap-4 text-body text-foreground">
          <h2 className="font-display text-h3 leading-tight tracking-tight">{tSeo('lead')}</h2>
          <p className="text-muted-foreground">{tSeo('p1')}</p>
          <p className="text-muted-foreground">{tSeo('p2')}</p>
          <h3 className="mt-2 font-display text-h4 leading-tight">{tSeo('howTitle')}</h3>
          <p className="text-muted-foreground">{tSeo('howBody')}</p>
        </div>
        <aside className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display text-h4 leading-tight">{tSeo('relatedTitle')}</h3>
          <ul className="grid gap-2 text-body">
            <li>
              <Link className="underline underline-offset-4" href="/handledare">
                {tSeo('linkHandledare')}
              </Link>
            </li>
            <li>
              <Link className="underline underline-offset-4" href="/pricing">
                {tSeo('linkPricing')}
              </Link>
            </li>
            <li>
              <Link className="underline underline-offset-4" href="/faq">
                {tSeo('linkFaq')}
              </Link>
            </li>
            <li>
              <Link className="underline underline-offset-4" href="/blog">
                {tSeo('linkBlog')}
              </Link>
            </li>
          </ul>
          <h3 className="mt-2 font-display text-h4 leading-tight">{tSeo('faqTitle')}</h3>
          <dl className="grid gap-3 text-small">
            {faq.map((item) => (
              <div key={item.q} className="grid gap-1">
                <dt className="font-medium text-foreground">{item.q}</dt>
                <dd className="text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </section>
  );
}

export function cityFaqJsonLd(faq: Array<{ q: string; a: string }>) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
