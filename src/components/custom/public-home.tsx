//
// Frontstage: the price, then the schools. Policy stays on the terms page.
// Server component so the three schools are in the first HTML response.

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { HomeHero } from '@/components/custom/home-hero';
import { InstructorPreview } from '@/components/custom/instructor-preview';
import { HOMEPAGE_SCHOOL_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import { listHomepageSchools } from '@/lib/discovery/homepage-schools';
import { visitorCatalogueRegionFromHeaders } from '@/lib/discovery/visitor-catalogue-region';
import { headers } from 'next/headers';

export async function PublicHome() {
  const t = await getTranslations('publicHome');
  const headerStore = await headers();
  const region = visitorCatalogueRegionFromHeaders((name) => headerStore.get(name));
  const schools = await listHomepageSchools(HOMEPAGE_SCHOOL_PREVIEW_LIMIT, region).catch(
    () => undefined,
  );

  return (
    <main className="marketplace-home relative isolate w-full min-w-0">
      <HomeHero />

      <section className="border-t border-border">
        <div className="container-page grid min-w-0 gap-6 py-10 lg:py-14">
          <div className="flex min-w-0 items-end justify-between gap-4">
            <h2 className="font-display text-h2 font-normal leading-tight tracking-tight text-foreground">
              {t('providers.title')}
            </h2>
            <Link href="/instructors" className="dlu-text-link shrink-0">
              {t('providers.cta')}
            </Link>
          </div>
          <InstructorPreview
            limit={HOMEPAGE_SCHOOL_PREVIEW_LIMIT}
            initialRows={schools}
            showContact={false}
          />
        </div>
      </section>

      <section className="border-t border-border">
        <div className="container-page flex min-w-0 flex-col items-start gap-4 py-12 lg:py-16 sm:flex-row sm:items-center">
          <Link href="/instructors" className="dlu-ink-pill">
            {t('entry.learnerCta')}
          </Link>
          <Link href="/for-skolor" className="dlu-text-link">
            {t('entry.providerCta')}
          </Link>
        </div>
      </section>
    </main>
  );
}
