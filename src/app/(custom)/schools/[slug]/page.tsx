import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ClaimSchoolButton } from '@/components/custom/school-contact-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import { SchoolMarkFallback } from '@/components/custom/school-mark-fallback';
import { schoolPortraitUrl } from '@/lib/discovery/school-portrait';
import { getOrganizationBySlug, listSchoolListedInstructors } from '@/lib/orgs/public';
import { publicAlternates } from '@/lib/seo/alternates';
import { schoolPath } from '@/lib/seo/school-slugs';
import { siteName, siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) {
    return { title: 'DriveLinkUp', robots: { index: false, follow: false } };
  }
  const city = org.city?.trim() || 'Sverige';
  const title = `${org.name} — trafikskola i ${city}`;
  const description = `${org.name} på DriveLinkUp — trafikskola i katalogen i ${city}.`;
  const canonical = `/schools/${org.slug}`;
  return {
    title,
    description,
    alternates: publicAlternates(canonical),
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      url: `${siteUrl}${canonical}`,
    },
  };
}

export default async function SchoolProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);
  if (!org) notFound();

  const t = await getTranslations('schoolProfile');
  const instructors = await listSchoolListedInstructors(org.id);
  const publicRows = instructors.filter(hasCanonicalCategory);
  const aggregates = await loadPublicInstructorAggregates(
    publicRows.map((row) => ({ id: row.id, userId: row.userId })),
  );
  const items = publicRows.map((row) => {
    const aggregate = aggregates.get(row.id) ?? {
      verificationStatus: 'unverified' as const,
      reviewSummary: { count: 0, averageRating: null },
    };
    return toPublicInstructor(row, aggregate, null);
  });

  const city = org.city?.trim() || null;
  const pageUrl = `${siteUrl}/schools/${org.slug}`;

  const addressParts = [org.address, org.postcode, org.city].filter(Boolean);
  const ratings = items
    .map((i) => i.reviewSummary.averageRating)
    .filter((r): r is number => typeof r === 'number');
  const reviewCount = items.reduce((sum, i) => sum + i.reviewSummary.count, 0);
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DrivingSchool',
    name: org.name,
    url: pageUrl,
    ...(addressParts.length > 0
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: org.address ?? undefined,
            postalCode: org.postcode ?? undefined,
            addressLocality: org.city ?? undefined,
            addressCountry: org.country || 'SE',
          },
        }
      : {}),
    ...(org.contactEmail ? { email: org.contactEmail } : {}),
    ...(org.contactPhone ? { telephone: org.contactPhone } : {}),
    ...(avgRating != null && reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: avgRating,
            reviewCount,
          },
        }
      : {}),
  };

  return (
    <main className="container-page min-w-0">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD from server data
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto grid w-full max-w-4xl gap-8 py-section">
        <header className="grid gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
              {org.name}
            </h1>
            <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
              {t('listedBadge')}
            </Badge>
          </div>
          {city ? <p className="text-body text-muted-foreground">{city}</p> : null}
          <ClaimSchoolButton name={org.name} listing={`/schools/${org.slug}`} className="w-fit" />
        </header>

        {(org.contactEmail || org.contactPhone || addressParts.length > 0) && (
          <section className="grid gap-2">
            <h2 className="font-display text-h3 text-foreground">{t('contactHeading')}</h2>
            {addressParts.length > 0 ? (
              <p className="text-body text-muted-foreground">{addressParts.join(', ')}</p>
            ) : null}
            {org.contactEmail ? (
              <p className="text-body text-muted-foreground">{org.contactEmail}</p>
            ) : null}
            {org.contactPhone ? (
              <p className="text-body text-muted-foreground">{org.contactPhone}</p>
            ) : null}
          </section>
        )}

        <section className="grid gap-4">
          <h2 className="font-display text-h3 text-foreground">{t('instructorsHeading')}</h2>
          {items.length === 0 ? (
            <p className="text-body text-muted-foreground">{t('noInstructors')}</p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {items.map((instructor) => (
                <li key={instructor.id}>
                  <Card className="border-border bg-card">
                    <CardContent className="flex gap-4 p-4">
                      {schoolPortraitUrl(instructor.photoUrl) ? (
                        <Image
                          src={schoolPortraitUrl(instructor.photoUrl) ?? ''}
                          alt=""
                          width={72}
                          height={72}
                          unoptimized
                          className="size-[72px] rounded-lg object-cover"
                        />
                      ) : (
                        <SchoolMarkFallback
                          name={instructor.name}
                          categories={instructor.categories}
                          heavy={instructor.publishedPrices?.heavy ?? null}
                          iconLayout="thumb"
                          className="box-border flex size-[72px] shrink-0 items-center justify-center rounded-lg border border-border bg-muted p-2 font-display text-lg font-normal"
                        />
                      )}
                      <div className="grid min-w-0 flex-1 gap-1">
                        <p className="truncate font-medium text-foreground">{instructor.name}</p>
                        <p className="text-small text-muted-foreground">{instructor.city}</p>
                        <Button asChild variant="link" size="sm" className="h-auto w-fit p-0">
                          <Link href={schoolPath(instructor)}>{instructor.name}</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
