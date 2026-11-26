'use client';

// Terms of service — mirrors the privacy-policy layout: page shell stays a
// thin metadata wrapper, the body lives in this island so the cookie-based
// locale switcher works for every section.

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export const TERMS_VERSION = '2026-10-27';

const SECTION_IDS = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '13',
  '14',
] as const;

export function TermsContent() {
  const t = useTranslations('termsPage');
  const sections = SECTION_IDS.map((id) => {
    const rawItems = t.raw(`sections.${id}.items`);
    const items = Array.isArray(rawItems)
      ? rawItems.filter((item): item is string => typeof item === 'string')
      : [];
    return {
      id,
      title: t(`sections.${id}.title`),
      body: t(`sections.${id}.body`),
      items,
    };
  });

  return (
    <main className="container-page section">
      <div className="surface-panel mx-auto flex max-w-3xl flex-col gap-10 rounded-xl border border-border p-6 sm:p-10">
        <header className="grid gap-3">
          <p className="text-eyebrow text-muted-foreground">{t('hero.eyebrow')}</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('hero.title')}
          </h1>
          <p className="text-caption text-muted-foreground">
            {t('hero.lastUpdated', { version: TERMS_VERSION })}
          </p>
          <p className="text-body-lg text-foreground/90">{t('hero.intro')}</p>
        </header>

        <article className="grid gap-8 text-body text-foreground/90">
          {sections.map((section) => (
            <section key={section.id} className="grid gap-2">
              <h2 className="font-display text-h3 leading-snug tracking-tight text-foreground">
                {section.title}
              </h2>
              <p>{section.body}</p>
              {section.items.length > 0 ? (
                <ul className="grid list-disc gap-1 pl-5 marker:text-muted-foreground/70">
                  {section.items.map((item) => (
                    <li key={item} className="leading-relaxed">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </article>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/contact">{t('cta.contact')}</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/faq">{t('cta.faq')}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
